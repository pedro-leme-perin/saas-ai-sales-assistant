// =====================================================
// 📞 VOICE NUMBERS SERVICE
//
// Provisioning of the per-tenant voice number decided in ADR-018.
//
// Why this is its own module and not a method on CompaniesService: buying a number is a
// bounded context of its own (Building Microservices Cap. 2). It talks to Twilio, it deals
// with regulatory bundles, it has a release path, and it has failure modes that have nothing
// to do with company CRUD. Bolting it onto CompaniesService would drag the Twilio SDK into a
// service that has no business knowing telephony exists.
// =====================================================

import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CircuitBreaker } from '../../common/resilience/circuit-breaker';

/** A number offered by Twilio, trimmed to what the caller actually needs to choose one. */
export interface AvailableVoiceNumber {
  phoneNumber: string;
  friendlyName: string;
  locality: string | null;
  region: string | null;
  /** Whether the number can place and receive calls. Always true given we filter on it. */
  voiceEnabled: boolean;
}

@Injectable()
export class VoiceNumbersService {
  private readonly logger = new Logger(VoiceNumbersService.name);
  private readonly twilioClient: Twilio | null = null;
  private readonly breaker: CircuitBreaker;

  /**
   * Regulatory bundle required by Anatel for Brazilian local numbers. Without it Twilio
   * rejects the purchase outright. Configurable because it is account-specific and expires.
   */
  private readonly brRegulatoryBundleSid: string;
  private readonly brAddressSid: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');

    if (accountSid && authToken) {
      this.twilioClient = new Twilio(accountSid, authToken);
    } else {
      this.logger.warn('Twilio credentials absent — voice number provisioning is disabled');
    }

    this.brRegulatoryBundleSid =
      this.configService.get<string>('TWILIO_BR_REGULATORY_BUNDLE_SID') || '';
    this.brAddressSid = this.configService.get<string>('TWILIO_BR_ADDRESS_SID') || '';

    // Release It! — Stability Patterns. Twilio's number API is a third-party dependency on a
    // human-facing path (onboarding); a stuck call there must fail fast, not hang the request.
    this.breaker = new CircuitBreaker({
      name: 'TwilioNumbers',
      failureThreshold: 3,
      resetTimeoutMs: 30_000,
      callTimeoutMs: 15_000, // number purchase is slower than a normal API call
    });
  }

  /**
   * Lists numbers available for purchase. Read-only, costs nothing, safe to call repeatedly.
   *
   * @param countryCode ISO 3166-1 alpha-2, e.g. `BR`
   * @param areaCode    optional local prefix, e.g. `16` for Ribeirão Preto
   * @param limit       how many to return; Twilio caps this well above anything useful here
   */
  async listAvailable(
    countryCode: string,
    areaCode?: string,
    limit = 20,
  ): Promise<AvailableVoiceNumber[]> {
    const client = this.requireClient();

    const results = await this.breaker.execute(() =>
      client.availablePhoneNumbers(countryCode.toUpperCase()).local.list({
        voiceEnabled: true,
        ...(areaCode ? { contains: areaCode } : {}),
        limit,
      }),
    );

    return results.map((n) => ({
      phoneNumber: n.phoneNumber,
      friendlyName: n.friendlyName,
      locality: n.locality ?? null,
      region: n.region ?? null,
      voiceEnabled: true,
    }));
  }

  /**
   * Buys a number and assigns it to a tenant, atomically from the tenant's point of view.
   *
   * ADR-018 §4.1. The ordering here is deliberate and is the whole risk of this method:
   *
   *   1. verify the tenant exists and has no number yet  → cheap, reversible, no money spent
   *   2. buy from Twilio                                 → costs money, hard to undo
   *   3. persist on the Company                          → cheap, but if it fails we have paid
   *                                                        for a number nobody owns
   *
   * Step 3 failing after step 2 succeeded is the dangerous window: a purchased number with no
   * owner in our database, billing every month, invisible. We close it by releasing the number
   * back to Twilio in the catch — a compensating action, since a distributed transaction with
   * a third party is not available (DDIA Cap. 9: no cross-system atomicity, so compensate).
   *
   * @throws ConflictException      tenant already has a number, or the number was taken
   * @throws BadRequestException    regulatory bundle not configured for the country
   * @throws NotFoundException      tenant does not exist or is inactive
   */
  async provisionForCompany(
    companyId: string,
    phoneNumber: string,
    actorUserId: string | null,
  ): Promise<{ phoneNumber: string; sid: string }> {
    const client = this.requireClient();

    const company = await this.prisma.company.findFirst({
      where: { id: companyId, isActive: true, deletedAt: null },
      select: { id: true, voicePhoneNumber: true, name: true },
    });
    if (!company) {
      throw new NotFoundException(`Company ${companyId} not found or inactive`);
    }

    // One number per tenant. Replacing a live number is a different, riskier operation
    // (in-flight calls, caller ID recognition by the tenant's customers) and must be an
    // explicit release-then-provision, never an accidental side effect of a second call here.
    if (company.voicePhoneNumber) {
      throw new ConflictException(
        `Company ${companyId} already has the voice number ${company.voicePhoneNumber}. Release it before provisioning another.`,
      );
    }

    const isBrazilian = phoneNumber.startsWith('+55');
    if (isBrazilian && !this.brRegulatoryBundleSid) {
      // Anatel requires a bundle for local BR numbers; buying without one fails at Twilio with
      // an opaque error. Fail here instead, with a message that says what to do.
      throw new BadRequestException(
        'TWILIO_BR_REGULATORY_BUNDLE_SID is not configured — Brazilian local numbers cannot be provisioned',
      );
    }

    const webhookBase = this.configService.get<string>('TWILIO_WEBHOOK_URL') || '';

    let purchased: { phoneNumber: string; sid: string };
    try {
      const created = await this.breaker.execute(() =>
        client.incomingPhoneNumbers.create({
          phoneNumber,
          friendlyName: `${company.name} — TheIAdvisor`,
          ...(isBrazilian
            ? {
                bundleSid: this.brRegulatoryBundleSid,
                ...(this.brAddressSid ? { addressSid: this.brAddressSid } : {}),
              }
            : {}),
          // Point the number at our inbound webhook at purchase time. A number that rings
          // nowhere is worse than no number: the tenant's customers hear silence.
          ...(webhookBase
            ? {
                voiceUrl: `${webhookBase}/api/calls/webhook/voice`,
                voiceMethod: 'POST',
                statusCallback: `${webhookBase}/api/calls/webhook/status`,
                statusCallbackMethod: 'POST',
              }
            : {}),
        }),
      );
      purchased = { phoneNumber: created.phoneNumber, sid: created.sid };
    } catch (error) {
      const message = (error as Error).message ?? 'unknown error';
      this.logger.error(
        `Twilio refused to sell ${phoneNumber} to company ${companyId}: ${message}`,
      );
      // 21422 = number no longer available. Very common: numbers are sold between the moment
      // a list is rendered and the moment the user clicks buy — which is exactly how the
      // Ribeirão Preto number was lost on 06/08/2026.
      if (message.includes('21422') || message.toLowerCase().includes('not available')) {
        throw new ConflictException(
          `The number ${phoneNumber} is no longer available. Search again and pick another.`,
        );
      }
      throw error;
    }

    try {
      await this.prisma.company.update({
        where: { id: companyId },
        data: {
          voicePhoneNumber: purchased.phoneNumber,
          voicePhoneSid: purchased.sid,
        },
      });
    } catch (dbError) {
      // The compensating action. We already paid; if we cannot record the ownership, holding
      // the number is strictly worse than releasing it — an orphan number bills forever and
      // nobody knows it exists.
      this.logger.error(
        `Persisting ${purchased.phoneNumber} for company ${companyId} failed — releasing the number to avoid an orphan: ${(dbError as Error).message}`,
      );
      await this.releaseFromTwilio(purchased.sid).catch((releaseError) => {
        // Compensation failed too. This is the one state a human must know about, because the
        // number now bills with no owner and no automated path will find it.
        this.logger.error(
          `ORPHANED TWILIO NUMBER — ${purchased.phoneNumber} (${purchased.sid}) is purchased, unassigned, and could not be released: ${(releaseError as Error).message}. Release it manually in the Twilio console.`,
        );
      });

      // P2002 on voice_phone_number: another tenant claimed the same number concurrently. The
      // global unique index doing exactly the job ADR-018 gave it.
      if (dbError instanceof Prisma.PrismaClientKnownRequestError && dbError.code === 'P2002') {
        throw new ConflictException(
          `The number ${purchased.phoneNumber} is already assigned to another company`,
        );
      }
      throw dbError;
    }

    await this.audit(companyId, actorUserId, AuditAction.CREATE, purchased.sid, {
      phoneNumber: purchased.phoneNumber,
      sid: purchased.sid,
    });

    this.logger.log(
      `Provisioned ${purchased.phoneNumber} (${purchased.sid}) for company ${companyId}`,
    );
    return purchased;
  }

  /**
   * Releases the tenant's number back to Twilio and clears it from the Company.
   *
   * Ordering is the mirror of provisioning: clear the database FIRST, then release at Twilio.
   * If the Twilio call fails we are left with a number we still pay for but no longer route —
   * annoying and visible. The opposite order would leave the Company pointing at a number
   * somebody else can now buy, which is a routing hazard: inbound calls for a stranger's
   * number resolving to this tenant.
   *
   * @throws NotFoundException when the tenant has no number to release
   */
  async releaseForCompany(companyId: string, actorUserId: string | null): Promise<void> {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId },
      select: { voicePhoneNumber: true, voicePhoneSid: true },
    });
    if (!company?.voicePhoneNumber) {
      throw new NotFoundException(`Company ${companyId} has no voice number to release`);
    }

    const { voicePhoneNumber, voicePhoneSid } = company;

    await this.prisma.company.update({
      where: { id: companyId },
      data: { voicePhoneNumber: null, voicePhoneSid: null, voiceDefaultUserId: null },
    });

    if (voicePhoneSid) {
      try {
        await this.releaseFromTwilio(voicePhoneSid);
      } catch (error) {
        // Not rethrown: from the tenant's perspective the number is gone and no longer routes,
        // which is what they asked for. The billing leftover is our problem, and it is loud in
        // the logs rather than silent in the database.
        this.logger.error(
          `Company ${companyId} released ${voicePhoneNumber} in the database, but Twilio still holds ${voicePhoneSid} and will keep billing it: ${(error as Error).message}`,
        );
      }
    } else {
      this.logger.warn(
        `Company ${companyId} had ${voicePhoneNumber} with no SID recorded — cannot release at Twilio, do it manually`,
      );
    }

    await this.audit(
      companyId,
      actorUserId,
      AuditAction.DELETE,
      voicePhoneSid ?? voicePhoneNumber,
      {
        phoneNumber: voicePhoneNumber,
        sid: voicePhoneSid,
      },
    );

    this.logger.log(`Released ${voicePhoneNumber} from company ${companyId}`);
  }

  /** Current assignment for a tenant. Null number means the tenant cannot place calls yet. */
  async getForCompany(
    companyId: string,
  ): Promise<{ phoneNumber: string | null; sid: string | null }> {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId },
      select: { voicePhoneNumber: true, voicePhoneSid: true },
    });
    if (!company) {
      throw new NotFoundException(`Company ${companyId} not found`);
    }
    return { phoneNumber: company.voicePhoneNumber, sid: company.voicePhoneSid };
  }

  private requireClient(): Twilio {
    if (!this.twilioClient) {
      throw new ServiceUnavailableException('Twilio is not configured on this environment');
    }
    return this.twilioClient;
  }

  private async releaseFromTwilio(sid: string): Promise<void> {
    const client = this.requireClient();
    await this.breaker.execute(() => client.incomingPhoneNumbers(sid).remove());
  }

  /**
   * Fire-and-forget audit trail (CLAUDE.md §11.7 — never blocks the hot path).
   * Provisioning is a billable, externally-visible mutation; it must leave a trace.
   */
  private async audit(
    companyId: string,
    userId: string | null,
    action: AuditAction,
    resourceId: string,
    newValues: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          companyId,
          userId,
          action,
          resource: 'VOICE_NUMBER',
          resourceId,
          newValues: newValues as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      this.logger.warn(`voice-number audit failed: ${(err as Error).message}`);
    }
  }
}
