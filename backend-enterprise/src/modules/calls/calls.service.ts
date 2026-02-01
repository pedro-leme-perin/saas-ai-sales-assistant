import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { Twilio } from 'twilio';
import { CallStatus } from '@prisma/client';

@Injectable()
export class CallsService {
  private readonly logger = new Logger(CallsService.name);
  private readonly twilioClient: Twilio | null = null;
  private readonly twilioPhoneNumber: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    this.twilioPhoneNumber = this.configService.get<string>('TWILIO_PHONE_NUMBER') || '';

    if (accountSid && authToken) {
      this.twilioClient = new Twilio(accountSid, authToken);
      this.logger.log('✅ Twilio client initialized');
    } else {
      this.logger.warn('⚠️ Twilio credentials not configured');
    }
  }

  async findAll(companyId: string) {
    return this.prisma.call.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async findOne(id: string, companyId: string) {
    const call = await this.prisma.call.findFirst({
      where: { id, companyId },
    });
    if (!call) {
      throw new NotFoundException('Call not found');
    }
    return call;
  }

  async create(companyId: string, data: any) {
    return this.prisma.call.create({
      data: {
        ...data,
        companyId,
      },
    });
  }

  async update(id: string, companyId: string, data: any) {
    await this.findOne(id, companyId);
    return this.prisma.call.update({
      where: { id },
      data,
    });
  }

  async initiateCall(
    companyId: string,
    userId: string,
    phoneNumber: string,
    webhookUrl: string,
  ) {
    if (!this.twilioClient) {
      throw new Error('Twilio not configured');
    }

    this.logger.log(`Initiating call to ${phoneNumber}`);

    try {
      // Criar registro da chamada no banco
      const call = await this.prisma.call.create({
        data: {
          companyId,
          userId,
          phoneNumber,
          direction: 'OUTBOUND',
          status: CallStatus.INITIATED,
          duration: 0,
        },
      });

      // Iniciar chamada via Twilio
      const twilioCall = await this.twilioClient.calls.create({
        to: phoneNumber,
        from: this.twilioPhoneNumber,
        url: `${webhookUrl}/api/calls/webhook/voice/${call.id}`,
        statusCallback: `${webhookUrl}/api/calls/webhook/status/${call.id}`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        statusCallbackMethod: 'POST',
      });

      // Atualizar com SID do Twilio
      await this.prisma.call.update({
        where: { id: call.id },
        data: {
          twilioCallSid: twilioCall.sid,
          status: CallStatus.INITIATED,
        },
      });

      this.logger.log(`Call initiated: ${twilioCall.sid}`);

      return {
        ...call,
        twilioCallSid: twilioCall.sid,
      };
    } catch (error) {
      this.logger.error('Failed to initiate call:', error);
      throw error;
    }
  }

  async endCall(id: string, companyId: string) {
    const call = await this.findOne(id, companyId);

    if (!this.twilioClient || !call.twilioCallSid) {
      throw new Error('Cannot end call - Twilio not configured or no SID');
    }

    try {
      await this.twilioClient.calls(call.twilioCallSid).update({
        status: 'completed',
      });

      return this.prisma.call.update({
        where: { id },
        data: { status: CallStatus.COMPLETED },
      });
    } catch (error) {
      this.logger.error('Failed to end call:', error);
      throw error;
    }
  }

  async handleStatusWebhook(callId: string, status: string, duration?: number) {
    this.logger.log(`Call ${callId} status update: ${status}`);

    const statusMap: Record<string, CallStatus> = {
      initiated: CallStatus.INITIATED,
      ringing: CallStatus.RINGING,
      'in-progress': CallStatus.IN_PROGRESS,
      completed: CallStatus.COMPLETED,
      busy: CallStatus.BUSY,
      'no-answer': CallStatus.NO_ANSWER,
      failed: CallStatus.FAILED,
      canceled: CallStatus.CANCELED,
    };

    const callStatus = statusMap[status] || CallStatus.INITIATED;

    return this.prisma.call.update({
      where: { id: callId },
      data: {
        status: callStatus,
        ...(duration && { duration }),
      },
    });
  }

  async getCallStats(companyId: string) {
    const calls = await this.prisma.call.findMany({
      where: { companyId },
    });

    const total = calls.length;
    const completed = calls.filter(c => c.status === CallStatus.COMPLETED).length;
    const totalDuration = calls.reduce((sum, c) => sum + (c.duration || 0), 0);

    return {
      total,
      completed,
      avgDuration: total > 0 ? Math.round(totalDuration / total) : 0,
      successRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }
}