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
   * Send dunning email (payment recovery sequence D+1, D+3, D+7).
   * Session 42: enterprise billing recovery.
   */
  async sendDunningEmail(params: {
    stage: 'D1' | 'D3' | 'D7';
    recipientEmail: string;
    companyName: string;
    amount: number; // cents
    currency: string;
    hostedInvoiceUrl: string | null;
    graceDeadline: Date;
  }): Promise<{ success: boolean; messageId?: string }> {
    const {
      stage,
      recipientEmail,
      companyName,
      amount,
      currency,
      hostedInvoiceUrl,
      graceDeadline,
    } = params;

    if (!this.apiKey) {
      this.logger.warn(`RESEND_API_KEY not configured — skipping dunning ${stage} email`);
      return { success: false };
    }

    const formattedAmount = this.formatCurrency(amount, currency);
    const formattedDeadline = graceDeadline.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const subject = this.dunningSubject(stage, formattedAmount);
    const html = this.buildDunningTemplate({
      stage,
      companyName,
      amount: formattedAmount,
      hostedInvoiceUrl,
      graceDeadline: formattedDeadline,
    });

    try {
      const result = await this.send({ to: recipientEmail, subject, html });
      this.logger.log(
        `Dunning ${stage} email sent to ${recipientEmail} (messageId: ${result?.id})`,
      );
      return { success: true, messageId: result?.id };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send dunning ${stage} email to ${recipientEmail}: ${message}`);
      return { success: false };
    }
  }

  /**
   * Send confirmation email after hard deletion was executed (LGPD Art. 16, III).
   * Session 43: fires after the scheduled cron deletes the user account.
   */
  async sendAccountDeletedEmail(params: {
    recipientEmail: string;
    userName: string;
    deletedAt: Date;
  }): Promise<{ success: boolean; messageId?: string }> {
    const { recipientEmail, userName, deletedAt } = params;

    if (!this.apiKey) {
      this.logger.warn('RESEND_API_KEY not configured — skipping account-deleted email');
      return { success: false };
    }

    const formattedDate = deletedAt.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>Conta excluida — TheIAdvisor</title></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <tr><td style="background:linear-gradient(135deg,#64748b,#334155);padding:32px 40px;text-align:center;">
          <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;">TheIAdvisor</h1>
        </td></tr>
        <tr><td style="padding:40px;">
          <h2 style="color:#18181b;margin:0 0 16px;font-size:20px;">Sua conta foi excluida</h2>
          <p style="color:#52525b;font-size:16px;line-height:1.6;margin:0 0 16px;">
            Ola <strong>${userName}</strong>, confirmamos que sua conta e seus
            dados pessoais foram <strong>excluidos permanentemente</strong> em
            <strong>${formattedDate}</strong>, conforme sua solicitacao.
          </p>
          <p style="color:#52525b;font-size:14px;line-height:1.6;margin:0 0 16px;">
            Esta acao cumpre a Lei Geral de Protecao de Dados (LGPD, Art. 16, III).
            Mantemos apenas registros minimos exigidos por lei (obrigacoes fiscais,
            auditoria de seguranca) de forma anonimizada.
          </p>
          <p style="color:#52525b;font-size:14px;line-height:1.6;margin:0 0 16px;">
            Esta decisao e irreversivel. Se voce deseja voltar a usar o TheIAdvisor,
            sera necessario criar uma nova conta do zero.
          </p>
        </td></tr>
        <tr><td style="background-color:#fafafa;padding:24px 40px;border-top:1px solid #e4e4e7;">
          <p style="color:#a1a1aa;font-size:12px;margin:0;text-align:center;">
            Duvidas? Entre em contato com team@theiadvisor.com.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();

    try {
      const result = await this.send({
        to: recipientEmail,
        subject: 'Sua conta foi excluida — TheIAdvisor',
        html,
      });
      this.logger.log(`Account-deleted email sent to ${recipientEmail} (messageId: ${result?.id})`);
      return { success: true, messageId: result?.id };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send account-deleted email to ${recipientEmail}: ${message}`);
      return { success: false };
    }
  }

  /**
   * Session 44 — Weekly coaching digest for a single vendor.
   * Non-fatal: failures logged, never thrown.
   */
  async sendCoachingReportEmail(params: {
    recipientEmail: string;
    userName: string;
    companyName: string;
    weekStart: Date;
    weekEnd: Date;
    metrics: {
      calls: {
        total: number;
        completed: number;
        missed: number;
        conversionRate: number;
      };
      whatsapp: { chats: number; messagesSent: number };
      ai: {
        suggestionsShown: number;
        suggestionsUsed: number;
        adoptionRate: number;
      };
    };
    insights: string[];
    recommendations: string[];
  }): Promise<{ success: boolean; messageId?: string }> {
    const { recipientEmail, userName, weekStart, weekEnd, metrics, insights, recommendations } =
      params;

    if (!this.apiKey) {
      this.logger.warn('RESEND_API_KEY not configured — skipping coaching email');
      return { success: false };
    }

    const fmtDate = (d: Date) =>
      d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const period = `${fmtDate(weekStart)} — ${fmtDate(new Date(weekEnd.getTime() - 1))}`;
    const pct = (n: number) => `${Math.round(n * 100)}%`;

    const insightsHtml = insights
      .map((s) => `<li style="margin-bottom:6px;">${this.escapeHtml(s)}</li>`)
      .join('');
    const recsHtml = recommendations
      .map((s) => `<li style="margin-bottom:6px;">${this.escapeHtml(s)}</li>`)
      .join('');

    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>Seu coaching semanal — TheIAdvisor</title></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="620" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <tr><td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:28px 40px;">
          <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;">Seu coaching semanal</h1>
          <p style="color:#e0e7ff;margin:4px 0 0;font-size:13px;">${period}</p>
        </td></tr>
        <tr><td style="padding:32px 40px;">
          <p style="color:#18181b;font-size:16px;margin:0 0 18px;">Ola <strong>${this.escapeHtml(userName)}</strong>,</p>
          <p style="color:#52525b;font-size:14px;line-height:1.6;margin:0 0 24px;">
            Aqui esta um resumo da sua performance com recomendacoes geradas por IA.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e4e4e7;border-radius:8px;margin-bottom:24px;">
            <tr>
              <td style="padding:14px;border-bottom:1px solid #e4e4e7;width:50%;">
                <div style="color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;">Ligacoes</div>
                <div style="color:#18181b;font-size:18px;font-weight:700;margin-top:4px;">${metrics.calls.completed}/${metrics.calls.total}</div>
                <div style="color:#a1a1aa;font-size:12px;">conversao ${pct(metrics.calls.conversionRate)}</div>
              </td>
              <td style="padding:14px;border-bottom:1px solid #e4e4e7;border-left:1px solid #e4e4e7;width:50%;">
                <div style="color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;">WhatsApp</div>
                <div style="color:#18181b;font-size:18px;font-weight:700;margin-top:4px;">${metrics.whatsapp.messagesSent}</div>
                <div style="color:#a1a1aa;font-size:12px;">mensagens em ${metrics.whatsapp.chats} chats</div>
              </td>
            </tr>
            <tr>
              <td style="padding:14px;width:50%;">
                <div style="color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;">Adocao IA</div>
                <div style="color:#18181b;font-size:18px;font-weight:700;margin-top:4px;">${pct(metrics.ai.adoptionRate)}</div>
                <div style="color:#a1a1aa;font-size:12px;">${metrics.ai.suggestionsUsed}/${metrics.ai.suggestionsShown} sugestoes</div>
              </td>
              <td style="padding:14px;border-left:1px solid #e4e4e7;width:50%;">
                <div style="color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;">Perdidas</div>
                <div style="color:#ef4444;font-size:18px;font-weight:700;margin-top:4px;">${metrics.calls.missed}</div>
                <div style="color:#a1a1aa;font-size:12px;">ligacoes nao atendidas</div>
              </td>
            </tr>
          </table>
          <h2 style="color:#18181b;font-size:15px;margin:0 0 10px;">Insights</h2>
          <ul style="color:#52525b;font-size:14px;line-height:1.55;margin:0 0 22px;padding-left:20px;">${insightsHtml}</ul>
          <h2 style="color:#18181b;font-size:15px;margin:0 0 10px;">Recomendacoes</h2>
          <ul style="color:#52525b;font-size:14px;line-height:1.55;margin:0 0 8px;padding-left:20px;">${recsHtml}</ul>
          <p style="color:#a1a1aa;font-size:12px;margin:24px 0 0;">
            Voce recebe este resumo toda segunda-feira. Ajuste preferencias em Configuracoes.
          </p>
        </td></tr>
        <tr><td style="background-color:#fafafa;padding:20px 40px;border-top:1px solid #e4e4e7;">
          <p style="color:#a1a1aa;font-size:12px;margin:0;text-align:center;">TheIAdvisor — Coaching por IA</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();

    try {
      const result = await this.send({
        to: recipientEmail,
        subject: `Seu coaching da semana ${period}`,
        html,
      });
      this.logger.log(`Coaching email sent to ${recipientEmail} (messageId: ${result?.id})`);
      return { success: true, messageId: result?.id };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send coaching email to ${recipientEmail}: ${msg}`);
      return { success: false };
    }
  }

  /**
   * Usage threshold alert email (Session 55 — Feature A2).
   * Sent when a tenant crosses 80% / 95% / 100% of any metered quota.
   */
  async sendUsageThresholdEmail(params: {
    recipientEmail: string;
    recipientName: string;
    companyName: string;
    metricLabel: string;
    threshold: number;
    used: number;
    limit: number;
    periodEnd: Date;
  }): Promise<{ success: boolean; messageId?: string }> {
    const {
      recipientEmail,
      recipientName,
      companyName,
      metricLabel,
      threshold,
      used,
      limit,
      periodEnd,
    } = params;

    if (!this.apiKey) {
      this.logger.warn('RESEND_API_KEY not configured — skipping usage alert email');
      return { success: false };
    }

    const headerColor = threshold >= 100 ? '#dc2626' : threshold >= 95 ? '#ea580c' : '#ca8a04';
    const periodEndStr = periodEnd.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const subject =
      threshold >= 100
        ? `[Limite atingido] ${this.escapeHtml(metricLabel)} — ${this.escapeHtml(companyName)}`
        : `[Alerta ${threshold}%] ${this.escapeHtml(metricLabel)} — ${this.escapeHtml(companyName)}`;

    const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>${this.escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 20px;">
    <tr><td align="center">
      <table width="620" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <tr><td style="background:${headerColor};padding:24px 32px;">
          <h1 style="color:#ffffff;margin:0;font-size:20px;font-weight:700;">Consumo em ${threshold}%</h1>
          <p style="color:#ffffff;margin:4px 0 0;font-size:13px;opacity:0.9;">${this.escapeHtml(metricLabel)} — ${this.escapeHtml(companyName)}</p>
        </td></tr>
        <tr><td style="padding:28px 32px;">
          <p style="color:#18181b;font-size:15px;margin:0 0 14px;">Olá <strong>${this.escapeHtml(recipientName)}</strong>,</p>
          <p style="color:#52525b;font-size:14px;line-height:1.6;margin:0 0 18px;">
            Sua empresa atingiu <strong>${threshold}%</strong> do limite de <strong>${this.escapeHtml(metricLabel)}</strong>
            no período de cobrança atual. O ciclo fecha em <strong>${periodEndStr}</strong>.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e4e4e7;border-radius:8px;margin-bottom:20px;">
            <tr>
              <td style="padding:14px;border-bottom:1px solid #e4e4e7;">
                <div style="color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;">Uso atual</div>
                <div style="color:#18181b;font-size:18px;font-weight:700;margin-top:4px;">${used}</div>
              </td>
              <td style="padding:14px;border-bottom:1px solid #e4e4e7;border-left:1px solid #e4e4e7;">
                <div style="color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;">Limite do plano</div>
                <div style="color:#18181b;font-size:18px;font-weight:700;margin-top:4px;">${limit}</div>
              </td>
            </tr>
          </table>
          <p style="color:#52525b;font-size:14px;line-height:1.6;margin:0 0 16px;">
            ${
              threshold >= 100
                ? 'Novas chamadas podem ser bloqueadas até o próximo ciclo. Considere aumentar o plano para manter a operação.'
                : 'Avalie se é hora de fazer upgrade para evitar interrupções ao atingir 100%.'
            }
          </p>
          <a href="${this.frontendUrl}/dashboard/billing" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:14px;font-weight:600;">
            Ver plano e faturas
          </a>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:14px 32px;color:#71717a;font-size:11px;text-align:center;">
          TheIAdvisor · noreply@theiadvisor.com
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

    try {
      const result = await this.send({ to: recipientEmail, subject, html });
      return { success: Boolean(result?.id), messageId: result?.id };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send usage alert to ${recipientEmail}: ${msg}`);
      return { success: false };
    }
  }

  private escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Get circuit breaker status (for health check)
   */
  getCircuitBreakerStatus(): { name: string; state: string } {
    const info = this.circuitBreaker.getHealthInfo();
    return { name: info.name, state: info.state };
  }

  private formatCurrency(amountCents: number, currency: string): string {
    const value = amountCents / 100;
    try {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: currency.toUpperCase(),
      }).format(value);
    } catch {
      return `${currency.toUpperCase()} ${value.toFixed(2)}`;
    }
  }

  private dunningSubject(stage: 'D1' | 'D3' | 'D7', amount: string): string {
    switch (stage) {
      case 'D1':
        return `Nao conseguimos processar seu pagamento de ${amount}`;
      case 'D3':
        return `Atencao: pagamento pendente de ${amount} — TheIAdvisor`;
      case 'D7':
        return `Ultimo aviso: sua conta sera suspensa em 48h`;
    }
  }

  private buildDunningTemplate(params: {
    stage: 'D1' | 'D3' | 'D7';
    companyName: string;
    amount: string;
    hostedInvoiceUrl: string | null;
    graceDeadline: string;
  }): string {
    const { stage, companyName, amount, hostedInvoiceUrl, graceDeadline } = params;
    const cta = hostedInvoiceUrl ?? `${this.frontendUrl}/dashboard/billing`;

    const { headline, tone, body, urgency } = this.dunningCopy(stage, amount, graceDeadline);
    const accent = stage === 'D1' ? '#3b82f6' : stage === 'D3' ? '#f59e0b' : '#dc2626';

    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${headline}</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f4f5; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5; padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background:${accent}; padding:24px 40px; text-align:center;">
              <h1 style="color:#ffffff; margin:0; font-size:20px; font-weight:700;">TheIAdvisor</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <p style="color:#a1a1aa; font-size:12px; text-transform:uppercase; letter-spacing:0.1em; margin:0 0 8px;">${tone}</p>
              <h2 style="color:#18181b; margin:0 0 16px; font-size:22px;">${headline}</h2>
              <p style="color:#52525b; font-size:16px; line-height:1.6; margin:0 0 16px;">Ola, <strong>${companyName}</strong>.</p>
              <p style="color:#52525b; font-size:16px; line-height:1.6; margin:0 0 24px;">${body}</p>
              ${urgency ? `<p style="background:#fef2f2; border-left:4px solid #dc2626; padding:12px 16px; color:#7f1d1d; font-size:14px; margin:0 0 24px;">${urgency}</p>` : ''}
              <p style="color:#52525b; font-size:14px; margin:0 0 8px;">Valor pendente:</p>
              <p style="color:#18181b; font-size:28px; font-weight:700; margin:0 0 24px;">${amount}</p>
              <p style="color:#71717a; font-size:13px; margin:0 0 32px;">Prazo para regularizar sem suspensao: <strong>${graceDeadline}</strong></p>
              <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="background-color:${accent}; border-radius:8px;">
                    <a href="${cta}" style="display:inline-block; padding:14px 32px; color:#ffffff; text-decoration:none; font-size:16px; font-weight:600;">Atualizar pagamento</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color:#fafafa; padding:20px 40px; border-top:1px solid #e4e4e7;">
              <p style="color:#a1a1aa; font-size:12px; margin:0; text-align:center;">
                Precisa de ajuda? Responda este email ou escreva para team@theiadvisor.com
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

  private dunningCopy(
    stage: 'D1' | 'D3' | 'D7',
    amount: string,
    deadline: string,
  ): { headline: string; tone: string; body: string; urgency: string | null } {
    switch (stage) {
      case 'D1':
        return {
          tone: 'Aviso de pagamento',
          headline: 'Tivemos um problema com seu pagamento',
          body: `Nao conseguimos processar a cobranca de ${amount} no cartao cadastrado. Isso acontece — cartao expirado, limite, ou erro temporario do banco. Atualize seu meio de pagamento para continuar usando o TheIAdvisor sem interrupcoes.`,
          urgency: null,
        };
      case 'D3':
        return {
          tone: 'Atencao',
          headline: 'Seu acesso esta em risco',
          body: `Ja tentamos processar o pagamento de ${amount} algumas vezes sem sucesso. Se voce nao atualizar o meio de pagamento ate ${deadline}, sua conta sera suspensa.`,
          urgency:
            'Apos suspensao, seu time perde acesso ao dashboard, chamadas e analytics. A recuperacao e imediata assim que o pagamento e confirmado.',
        };
      case 'D7':
        return {
          tone: 'Ultimo aviso',
          headline: 'Sua conta sera suspensa em 48 horas',
          body: `Este e o aviso final. O valor de ${amount} continua pendente. Se nao recebermos o pagamento em 48h, suspenderemos o acesso de todos os usuarios da ${''}sua empresa ate regularizacao.`,
          urgency:
            'Todos os dados sao preservados. Voce podera reativar a conta a qualquer momento pagando a fatura em aberto.',
        };
    }
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

  // =====================================================
  // 📬 NOTIFICATION DIGEST (session 48)
  // =====================================================
  async sendNotificationDigestEmail(params: {
    recipientEmail: string;
    recipientName: string;
    entries: Array<{ type: string; title: string; message: string; at: Date }>;
  }): Promise<void> {
    const { recipientEmail, recipientName, entries } = params;
    if (!entries || entries.length === 0) return;
    if (!this.apiKey) {
      this.logger.warn('RESEND_API_KEY not configured — skipping digest email');
      return;
    }
    const html = this.buildDigestHtml(recipientName, entries);
    try {
      await this.send({
        to: recipientEmail,
        subject: `Seu resumo diário — ${entries.length} notificação(ões)`,
        html,
      });
      this.logger.log(`Digest email sent to=${recipientEmail} count=${entries.length}`);
    } catch (err) {
      this.logger.error(`Digest email failed: ${String(err)}`);
    }
  }

  private buildDigestHtml(
    name: string,
    entries: Array<{ type: string; title: string; message: string; at: Date }>,
  ): string {
    const fmt = new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
    });
    const rows = entries
      .map(
        (e) => `
      <div style="padding:16px; border-bottom:1px solid #e4e4e7;">
        <div style="font-size:12px; color:#6366F1; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:4px;">${this.escapeHtml(
          e.type,
        )}</div>
        <div style="font-size:16px; font-weight:600; color:#18181b; margin-bottom:4px;">${this.escapeHtml(
          e.title,
        )}</div>
        <div style="font-size:14px; color:#52525b; margin-bottom:4px;">${this.escapeHtml(e.message)}</div>
        <div style="font-size:12px; color:#a1a1aa;">${fmt.format(e.at)}</div>
      </div>`,
      )
      .join('');
    return `<!DOCTYPE html>
<html><body style="margin:0; background-color:#f4f4f5; font-family:Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff; border-radius:12px;">
        <tr><td style="background:linear-gradient(135deg,#6366F1,#8B5CF6); padding:32px; border-radius:12px 12px 0 0;">
          <h1 style="margin:0; color:#fff; font-size:24px;">Seu resumo diário</h1>
          <p style="margin:4px 0 0; color:rgba(255,255,255,0.9);">Olá, ${this.escapeHtml(name)}</p>
        </td></tr>
        <tr><td>${rows}</td></tr>
        <tr><td style="padding:24px; background:#fafafa; font-size:12px; color:#a1a1aa; text-align:center; border-radius:0 0 12px 12px;">
          Ajuste suas preferências em Settings &rarr; Notifications.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`.trim();
  }

  // =====================================================
  // 📬 CSAT INVITE (session 50)
  // =====================================================
  async sendCsatInvite(params: {
    recipientEmail: string;
    recipientName: string | null;
    message: string;
    link: string;
  }): Promise<void> {
    const { recipientEmail, recipientName, message, link } = params;
    if (!this.apiKey) {
      this.logger.warn('RESEND_API_KEY not configured — skipping csat invite');
      return;
    }
    const html = this.buildCsatInviteHtml(recipientName, message, link);
    try {
      await this.send({
        to: recipientEmail,
        subject: 'Como foi seu atendimento?',
        html,
      });
      this.logger.log(`CSAT invite sent to=${recipientEmail}`);
    } catch (err) {
      this.logger.error(`CSAT invite failed: ${String(err)}`);
      throw err;
    }
  }

  private buildCsatInviteHtml(name: string | null, message: string, link: string): string {
    const greeting = name ? `Olá, ${this.escapeHtml(name)}` : 'Olá';
    return `<!DOCTYPE html>
<html><body style="margin:0; background-color:#f4f4f5; font-family:Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff; border-radius:12px;">
        <tr><td style="background:linear-gradient(135deg,#10B981,#059669); padding:32px; border-radius:12px 12px 0 0;">
          <h1 style="margin:0; color:#fff; font-size:24px;">Sua opinião importa</h1>
          <p style="margin:4px 0 0; color:rgba(255,255,255,0.9);">${greeting}</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="font-size:16px; color:#18181b;">${this.escapeHtml(message)}</p>
          <p style="margin:32px 0;">
            <a href="${link}" style="background:#10B981; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:600; display:inline-block;">Avaliar atendimento</a>
          </p>
          <p style="font-size:12px; color:#a1a1aa;">Leva menos de 1 minuto. Link expira em 72h.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`.trim();
  }

  // =====================================================
  // 📤 SCHEDULED EXPORT (session 51)
  // =====================================================
  async sendScheduledExportEmail(params: {
    recipients: string[];
    exportName: string;
    resource: string;
    rowCount: number;
    filename: string;
    format: 'CSV' | 'JSON';
    content: string;
  }): Promise<void> {
    const { recipients, exportName, resource, rowCount, filename, format, content } = params;
    if (!this.apiKey) {
      this.logger.warn('RESEND_API_KEY not configured — skipping scheduled export email');
      return;
    }
    if (!recipients || recipients.length === 0) return;
    const html = this.buildScheduledExportHtml(exportName, resource, rowCount, filename);
    const subject = `${exportName} · ${rowCount} linha(s)`;
    const base64 = Buffer.from(content, 'utf8').toString('base64');
    try {
      await this.circuitBreaker.execute(async () => {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: this.fromEmail,
            to: recipients,
            subject,
            html,
            attachments: [
              {
                filename,
                content: base64,
                content_type: format === 'CSV' ? 'text/csv' : 'application/json',
              },
            ],
          }),
        });
        if (!response.ok) {
          const body = await response.text();
          throw new Error(`Resend API error ${response.status}: ${body}`);
        }
        return response.json() as Promise<unknown>;
      });
      this.logger.log(
        `Scheduled export email sent to=${recipients.length} recipient(s) rows=${rowCount} file=${filename}`,
      );
    } catch (err) {
      this.logger.error(`Scheduled export email failed: ${String(err)}`);
      throw err;
    }
  }

  private buildScheduledExportHtml(
    exportName: string,
    resource: string,
    rowCount: number,
    filename: string,
  ): string {
    return `<!DOCTYPE html>
<html><body style="margin:0; background-color:#f4f4f5; font-family:Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff; border-radius:12px;">
        <tr><td style="background:linear-gradient(135deg,#0EA5E9,#6366F1); padding:32px; border-radius:12px 12px 0 0;">
          <h1 style="margin:0; color:#fff; font-size:22px;">${this.escapeHtml(exportName)}</h1>
          <p style="margin:4px 0 0; color:rgba(255,255,255,0.9);">Export agendado · ${this.escapeHtml(resource)}</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="font-size:16px; color:#18181b;">Segue em anexo o arquivo <strong>${this.escapeHtml(filename)}</strong> com <strong>${rowCount}</strong> linha(s).</p>
          <p style="font-size:12px; color:#a1a1aa; margin-top:24px;">Para ajustar a programação ou desativar, acesse Configurações &rarr; Exportações agendadas.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`.trim();
  }

  // =====================================================
  // DSAR (S60a) — LGPD Art. 18
  // =====================================================
  /**
   * Notifies the data subject (titular) that their DSAR artefact is ready.
   * Sent post-completion of EXTRACT_DSAR background job.
   *
   * Best-effort: if Resend is not configured we log + return success=false
   * so the worker does NOT retry the entire DSAR job (idempotent).
   */
  async sendDsarReadyEmail(params: {
    recipientEmail: string;
    recipientName?: string | null;
    requestType: string;
    downloadUrl: string;
    expiresAt: Date;
    requestId: string;
  }): Promise<{ success: boolean; messageId?: string }> {
    const { recipientEmail, recipientName, requestType, downloadUrl, expiresAt, requestId } =
      params;
    if (!this.apiKey) {
      this.logger.warn('RESEND_API_KEY not configured — skipping DSAR ready email');
      return { success: false };
    }

    const html = this.buildDsarReadyHtml({
      recipientName: recipientName ?? null,
      requestType,
      downloadUrl,
      expiresAt,
      requestId,
    });
    try {
      const result = await this.send({
        to: recipientEmail,
        subject: `Sua solicitação LGPD (${requestType}) está disponível`,
        html,
      });
      this.logger.log(`DSAR ready email sent to ${recipientEmail} (id=${result?.id})`);
      return { success: true, messageId: result?.id };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      this.logger.error(`DSAR ready email failed for ${recipientEmail}: ${msg}`);
      return { success: false };
    }
  }

  /**
   * Notifies the data subject that their DSAR was rejected, with reason.
   * Sent immediately after manager reject action (sync, fire-and-forget).
   */
  async sendDsarRejectedEmail(params: {
    recipientEmail: string;
    recipientName?: string | null;
    requestType: string;
    reason: string;
    requestId: string;
  }): Promise<{ success: boolean; messageId?: string }> {
    const { recipientEmail, recipientName, requestType, reason, requestId } = params;
    if (!this.apiKey) {
      this.logger.warn('RESEND_API_KEY not configured — skipping DSAR rejection email');
      return { success: false };
    }

    const html = this.buildDsarRejectedHtml({
      recipientName: recipientName ?? null,
      requestType,
      reason,
      requestId,
    });
    try {
      const result = await this.send({
        to: recipientEmail,
        subject: `Atualização sobre sua solicitação LGPD (${requestType})`,
        html,
      });
      this.logger.log(`DSAR rejection email sent to ${recipientEmail} (id=${result?.id})`);
      return { success: true, messageId: result?.id };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      this.logger.error(`DSAR rejection email failed for ${recipientEmail}: ${msg}`);
      return { success: false };
    }
  }

  private buildDsarReadyHtml(params: {
    recipientName: string | null;
    requestType: string;
    downloadUrl: string;
    expiresAt: Date;
    requestId: string;
  }): string {
    const { recipientName, requestType, downloadUrl, expiresAt, requestId } = params;
    const greeting = recipientName ? `Olá, ${this.escapeHtml(recipientName)}` : 'Olá';
    const expiry = this.escapeHtml(expiresAt.toISOString());
    return `<!DOCTYPE html>
<html><body style="margin:0;background:#f4f4f5;font-family:Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 20px;">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;">
      <tr><td style="background:linear-gradient(135deg,#10B981,#0EA5E9);padding:32px;border-radius:12px 12px 0 0;">
        <h1 style="margin:0;color:#fff;font-size:22px;">Sua solicitação está pronta</h1>
        <p style="margin:4px 0 0;color:rgba(255,255,255,0.9);">${this.escapeHtml(requestType)} · LGPD Art. 18</p>
      </td></tr>
      <tr><td style="padding:32px;">
        <p style="font-size:16px;color:#18181b;">${greeting},</p>
        <p style="font-size:14px;color:#3f3f46;">
          Concluímos o processamento da sua solicitação <strong>${this.escapeHtml(requestType)}</strong>.
          O artefato gerado está disponível para download através do link seguro abaixo.
        </p>
        <p style="text-align:center;margin:24px 0;">
          <a href="${this.escapeHtml(downloadUrl)}" style="display:inline-block;padding:14px 28px;background:#10B981;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Baixar artefato</a>
        </p>
        <p style="font-size:12px;color:#71717a;">
          Este link expira em <strong>${expiry}</strong> (UTC). Após expirar, será necessário abrir uma nova solicitação.
        </p>
        <p style="font-size:11px;color:#a1a1aa;margin-top:24px;">ID da solicitação: ${this.escapeHtml(requestId)}</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`.trim();
  }

  private buildDsarRejectedHtml(params: {
    recipientName: string | null;
    requestType: string;
    reason: string;
    requestId: string;
  }): string {
    const { recipientName, requestType, reason, requestId } = params;
    const greeting = recipientName ? `Olá, ${this.escapeHtml(recipientName)}` : 'Olá';
    return `<!DOCTYPE html>
<html><body style="margin:0;background:#f4f4f5;font-family:Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 20px;">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;">
      <tr><td style="background:linear-gradient(135deg,#F59E0B,#EF4444);padding:32px;border-radius:12px 12px 0 0;">
        <h1 style="margin:0;color:#fff;font-size:22px;">Atualização sobre sua solicitação</h1>
        <p style="margin:4px 0 0;color:rgba(255,255,255,0.9);">${this.escapeHtml(requestType)} · LGPD Art. 18</p>
      </td></tr>
      <tr><td style="padding:32px;">
        <p style="font-size:16px;color:#18181b;">${greeting},</p>
        <p style="font-size:14px;color:#3f3f46;">
          Após análise, sua solicitação <strong>${this.escapeHtml(requestType)}</strong> não pôde ser concluída.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border-left:4px solid #EF4444;padding:16px;margin:16px 0;">
          <tr><td style="font-size:13px;color:#991b1b;">${this.escapeHtml(reason)}</td></tr>
        </table>
        <p style="font-size:12px;color:#71717a;">Você pode contestar esta decisão respondendo a este e-mail ou abrindo nova solicitação com informações adicionais.</p>
        <p style="font-size:11px;color:#a1a1aa;margin-top:24px;">ID da solicitação: ${this.escapeHtml(requestId)}</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`.trim();
  }
}
