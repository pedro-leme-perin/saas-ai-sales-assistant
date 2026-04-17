// =====================================================
// 📧 EMAIL SERVICE — Resend Integration
// =====================================================
// Following Release It! — Circuit Breaker + Timeout patterns
// =====================================================

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CircuitBreaker } from '@common/resilience/circuit-breaker';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}

interface ResendResponse {
  id: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly apiKey: string;
  private readonly fromEmail: string;
  private readonly frontendUrl: string;
  private readonly circuitBreaker: CircuitBreaker;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('RESEND_API_KEY') || '';
    this.fromEmail = this.configService.get<string>('EMAIL_FROM') || 'noreply@theiadvisor.com';
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';

    this.circuitBreaker = new CircuitBreaker({
      name: 'Resend',
      failureThreshold: 3,
      resetTimeoutMs: 30_000,
      callTimeoutMs: 10_000,
    });
  }

  /**
   * Send team invitation email
   */
  async sendInviteEmail(params: {
    recipientEmail: string;
    inviterName: string;
    companyName: string;
    role: string;
  }): Promise<{ success: boolean; messageId?: string }> {
    const { recipientEmail, inviterName, companyName, role } = params;

    if (!this.apiKey) {
      this.logger.warn('RESEND_API_KEY not configured — skipping invite email');
      return { success: false };
    }

    const signUpUrl = `${this.frontendUrl}/sign-up?invited=true&email=${encodeURIComponent(recipientEmail)}`;
    const roleLabel = this.translateRole(role);

    const html = this.buildInviteTemplate({
      inviterName,
      companyName,
      roleLabel,
      signUpUrl,
      recipientEmail,
    });

    try {
      const result = await this.send({
        to: recipientEmail,
        subject: `${inviterName} convidou você para ${companyName}`,
        html,
      });

      this.logger.log(`Invite email sent to ${recipientEmail} (messageId: ${result?.id})`);

      return { success: true, messageId: result?.id };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send invite email to ${recipientEmail}: ${message}`);
      return { success: false };
    }
  }

  /**
   * Low-level send via Resend API with circuit breaker
   */
  private async send(options: SendEmailOptions): Promise<ResendResponse | null> {
    return this.circuitBreaker.execute(async () => {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: options.from || this.fromEmail,
          to: [options.to],
          subject: options.subject,
          html: options.html,
          reply_to: options.replyTo,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Resend API error ${response.status}: ${body}`);
      }

      return response.json() as Promise<ResendResponse>;
    }) as Promise<ResendResponse | null>;
  }

  /**
   * Send LGPD account deletion request confirmation email
   */
  async sendDeletionRequestEmail(params: {
    recipientEmail: string;
    userName: string;
    scheduledDeletionDate: Date;
  }): Promise<{ success: boolean; messageId?: string }> {
    const { recipientEmail, userName, scheduledDeletionDate } = params;

    if (!this.apiKey) {
      this.logger.warn('RESEND_API_KEY not configured — skipping deletion request email');
      return { success: false };
    }

    const formattedDate = scheduledDeletionDate.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmacao de solicitacao de exclusao</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f4f5; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5; padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background:linear-gradient(135deg,#3b82f6,#1d4ed8); padding:32px 40px; text-align:center;">
              <h1 style="color:#ffffff; margin:0; font-size:24px; font-weight:700;">
                TheIAdvisor
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h2 style="color:#18181b; margin:0 0 16px; font-size:20px;">
                Solicitacao de exclusao recebida
              </h2>
              <p style="color:#52525b; font-size:16px; line-height:1.6; margin:0 0 24px;">
                Ola <strong>${userName}</strong>, confirmamos o recebimento da sua
                solicitacao de exclusao de conta conforme a LGPD (Art. 18, VI).
              </p>
              <p style="color:#52525b; font-size:14px; line-height:1.6; margin:0 0 16px;">
                Sua conta foi suspensa e a exclusao definitiva dos seus dados esta
                agendada para <strong>${formattedDate}</strong>.
              </p>
              <p style="color:#52525b; font-size:14px; line-height:1.6; margin:0 0 32px;">
                Se voce mudar de ideia, entre em contato com nossa equipe antes dessa
                data para cancelar a solicitacao.
              </p>
              <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="background-color:#3b82f6; border-radius:8px;">
                    <a href="mailto:team@theiadvisor.com" style="display:inline-block; padding:14px 32px; color:#ffffff; text-decoration:none; font-size:16px; font-weight:600;">
                      Entrar em contato
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color:#fafafa; padding:24px 40px; border-top:1px solid #e4e4e7;">
              <p style="color:#a1a1aa; font-size:12px; margin:0; text-align:center;">
                Este email foi enviado automaticamente em resposta a sua solicitacao
                de exclusao de conta. Se voce nao fez esta solicitacao, entre em
                contato imediatamente com team@theiadvisor.com.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

    try {
      const result = await this.send({
        to: recipientEmail,
        subject: 'Confirmacao de solicitacao de exclusao — TheIAdvisor',
        html,
      });

      this.logger.log(
        `Deletion request email sent to ${recipientEmail} (messageId: ${result?.id})`,
      );

      return { success: true, messageId: result?.id };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send deletion request email to ${recipientEmail}: ${message}`);
      return { success: false };
    }
  }

  /**
   * Get circuit breaker status (for health check)
   */
  getCircuitBreakerStatus(): { name: string; state: string } {
    const info = this.circuitBreaker.getHealthInfo();
    return { name: info.name, state: info.state };
  }

  private translateRole(role: string): string {
    const roleMap: Record<string, string> = {
      OWNER: 'Proprietário',
      ADMIN: 'Administrador',
      MANAGER: 'Gerente',
      VENDOR: 'Vendedor',
    };
    return roleMap[role] || role;
  }

  private buildInviteTemplate(params: {
    inviterName: string;
    companyName: string;
    roleLabel: string;
    signUpUrl: string;
    recipientEmail: string;
  }): string {
    const { inviterName, companyName, roleLabel, signUpUrl } = params;

    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Convite para ${companyName}</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f4f5; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5; padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#3b82f6,#1d4ed8); padding:32px 40px; text-align:center;">
              <h1 style="color:#ffffff; margin:0; font-size:24px; font-weight:700;">
                TheIAdvisor
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="color:#18181b; margin:0 0 16px; font-size:20px;">
                Você foi convidado!
              </h2>
              <p style="color:#52525b; font-size:16px; line-height:1.6; margin:0 0 24px;">
                <strong>${inviterName}</strong> convidou você para se juntar à equipe
                <strong>${companyName}</strong> como <strong>${roleLabel}</strong>.
              </p>
              <p style="color:#52525b; font-size:14px; line-height:1.6; margin:0 0 32px;">
                Com o TheIAdvisor, você terá acesso a sugestões de IA em tempo real
                durante ligações e conversas no WhatsApp, ajudando a fechar mais vendas.
              </p>
              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="background-color:#3b82f6; border-radius:8px;">
                    <a href="${signUpUrl}" style="display:inline-block; padding:14px 32px; color:#ffffff; text-decoration:none; font-size:16px; font-weight:600;">
                      Aceitar Convite
                    </a>
                  </td>
                </tr>
              </table>
              <p style="color:#a1a1aa; font-size:12px; text-align:center; margin:24px 0 0;">
                Se o botão não funcionar, copie e cole este link no navegador:<br>
                <a href="${signUpUrl}" style="color:#3b82f6; word-break:break-all;">${signUpUrl}</a>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#fafafa; padding:24px 40px; border-top:1px solid #e4e4e7;">
              <p style="color:#a1a1aa; font-size:12px; margin:0; text-align:center;">
                Este email foi enviado porque alguém convidou você para uma equipe.
                Se você não esperava este convite, pode ignorar esta mensagem.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
  }
}
