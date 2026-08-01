// =====================================================
// 📞 set-company-whatsapp-number — Unit Tests
// Cobre as regras puras do script: validacao E.164, unicidade e sobrescrita.
// O caminho de banco nao e exercitado aqui — o script e guardado por
// `require.main === module`, entao importa-lo nao abre conexao.
// =====================================================

import {
  E164_PATTERN,
  validateE164,
  checkUniqueness,
  checkOverwrite,
  parseArgs,
  ScriptError,
  type CompanyRow,
} from '../../scripts/set-company-whatsapp-number';

const company = (id: string, name = 'ACME'): CompanyRow => ({
  id,
  name,
  whatsappPhoneNumberId: '+14155238886',
});

describe('set-company-whatsapp-number', () => {
  describe('validateE164', () => {
    it.each([
      ['+14155238886', 'sandbox da Twilio'],
      ['+5516988583222', 'celular BR'],
      ['+15077634719', 'numero de voz da conta'],
      ['+12345678', 'minimo: 8 digitos'],
      ['+123456789012345', 'maximo: 15 digitos'],
    ])('aceita %s (%s)', (input) => {
      expect(validateE164(input)).toEqual({ ok: true });
    });

    // O caso que motiva o validador: TWILIO_WHATSAPP_NUMBER carrega o prefixo,
    // mas extractPhone() o remove antes da busca do tenant. Gravar com prefixo
    // faz toda mensagem entrante errar o tenant, em silencio.
    it('rejeita o prefixo whatsapp: e aponta a forma correta', () => {
      const result = validateE164('whatsapp:+14155238886');

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('esperado falha');
      expect(result.reason).toContain('whatsapp:');
      expect(result.reason).toContain('+14155238886');
      expect(result.reason).toContain('extractPhone');
    });

    it.each([
      ['14155238886', 'sem +'],
      ['+04155238886', 'codigo de pais comecando em 0'],
      ['+1415523', 'curto demais'],
      ['+1234567890123456', 'longo demais'],
      ['+1415 523 8886', 'com espacos internos'],
      ['+1-415-523-8886', 'com hifens'],
      ['', 'vazio'],
      ['+', 'so o sinal'],
    ])('rejeita %s (%s)', (input) => {
      expect(validateE164(input).ok).toBe(false);
    });

    it('rejeita espaco em volta em vez de aparar silenciosamente', () => {
      const result = validateE164(' +14155238886 ');

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('esperado falha');
      expect(result.reason).toContain('whitespace');
    });

    it('E164_PATTERN nao casa multilinha (ancoras nao sao /m)', () => {
      expect(E164_PATTERN.test('+14155238886\nlixo')).toBe(false);
      expect(E164_PATTERN.test('lixo\n+14155238886')).toBe(false);
    });
  });

  describe('checkUniqueness', () => {
    it('passa quando ninguem detem o numero', () => {
      expect(checkUniqueness('c1', [])).toEqual({ ok: true });
    });

    it('passa quando o unico detentor e a propria company alvo (idempotencia)', () => {
      expect(checkUniqueness('c1', [company('c1')])).toEqual({ ok: true });
    });

    it('aborta quando outra company detem o numero, nomeando o conflito', () => {
      const result = checkUniqueness('c1', [company('c2', 'Outra Ltda')]);

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('esperado falha');
      expect(result.reason).toContain('c2');
      expect(result.reason).toContain('Outra Ltda');
    });

    it('lista todos os detentores quando ha mais de um', () => {
      const result = checkUniqueness('c1', [company('c2', 'Duas'), company('c3', 'Tres')]);

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('esperado falha');
      expect(result.reason).toContain('c2');
      expect(result.reason).toContain('c3');
    });
  });

  describe('checkOverwrite', () => {
    it('permite escrever sobre null', () => {
      expect(checkOverwrite(null, '+14155238886', false)).toEqual({ ok: true });
    });

    it('trata string vazia como nao preenchido', () => {
      expect(checkOverwrite('', '+14155238886', false)).toEqual({ ok: true });
    });

    it('vira no-op quando o valor ja e o pedido', () => {
      expect(checkOverwrite('+14155238886', '+14155238886', false)).toEqual({
        ok: true,
        noop: true,
      });
    });

    it('recusa sobrescrever valor diferente sem --force', () => {
      const result = checkOverwrite('+5516988583222', '+14155238886', false);

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('esperado falha');
      expect(result.reason).toContain('--force');
      expect(result.reason).toContain('+5516988583222');
    });

    it('permite sobrescrever valor diferente com --force', () => {
      expect(checkOverwrite('+5516988583222', '+14155238886', true)).toEqual({ ok: true });
    });

    it('no-op tem precedencia sobre --force (nada a escrever)', () => {
      expect(checkOverwrite('+14155238886', '+14155238886', true)).toEqual({
        ok: true,
        noop: true,
      });
    });
  });

  describe('parseArgs', () => {
    it('extrai number, company-id e flags', () => {
      expect(
        parseArgs(['--number', '+14155238886', '--company-id', 'c1', '--dry-run', '--force']),
      ).toEqual({ number: '+14155238886', companyId: 'c1', force: true, dryRun: true });
    });

    it('deixa companyId indefinido quando omitido', () => {
      expect(parseArgs(['--number', '+14155238886'])).toEqual({
        number: '+14155238886',
        companyId: undefined,
        force: false,
        dryRun: false,
      });
    });

    it('exige --number', () => {
      expect(() => parseArgs(['--dry-run'])).toThrow(ScriptError);
    });

    it('rejeita argumento desconhecido em vez de ignorar', () => {
      expect(() => parseArgs(['--number', '+14155238886', '--nao-existe'])).toThrow(
        /unknown argument/,
      );
    });

    it('rejeita --company-id vazio', () => {
      expect(() => parseArgs(['--number', '+14155238886', '--company-id', ''])).toThrow(
        ScriptError,
      );
    });
  });
});
