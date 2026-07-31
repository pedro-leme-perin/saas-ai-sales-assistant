# Como usar o Claude Code neste projeto

Guia para o Pedro. Sem jargão. Se algo aqui não fizer sentido, é falha do guia —
peça para o Claude reescrever a parte que não entendeu.

---

## 1. O que é o Claude Code

É o Claude rodando dentro de uma janela preta de terminal, **dentro da pasta do
projeto**. A diferença para o Cowork é simples:

- **Cowork** = enxerga seus sites logados (Railway, Cloudflare, Upstash). Não roda
  os testes do projeto.
- **Claude Code** = enxerga e mexe nos arquivos do projeto direto, e **roda os
  testes**. Não enxerga site nenhum.

**Regra de bolso:**

> Vai mexer em arquivo do projeto → **Claude Code**
> Vai mexer em site com login → **Cowork**

Na dúvida, pergunte. Nenhuma escolha errada quebra nada — no pior caso o Claude
avisa que precisa da outra ferramenta.

---

## 2. Como abrir (uma vez por sessão)

1. Aperte a tecla **Windows**, digite `powershell`, aperte **Enter**
2. Cole exatamente isto e aperte **Enter**:

```
cd "C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL"
```

3. Cole isto e aperte **Enter**:

```
claude
```

Pronto. Está aberto. A partir daqui você conversa em português normal.

**Se der erro dizendo que `claude` não foi encontrado:** o Claude Code não está
instalado. Peça ajuda no Cowork — ele te passa o comando de instalação.

---

## 3. A primeira mensagem (a mais importante)

Sempre comece uma sessão nova colando **este texto**:

```
Pasta: C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL

Leia antes de tudo: LEIA-ME SEMPRE.txt, CLAUDE.md,
docs/operations/s85-next-session-prompt.md e a cauda de PROJECT_HISTORY.md.

Depois rode: git log -3 --oneline e git status -sb

Me diga onde paramos e o que você sugere fazer hoje.

Importante: eu não programo. Explique suas escolhas em português simples e me
entregue comandos prontos para copiar.
```

Isso faz o Claude ler o histórico do projeto e saber exatamente onde tudo parou —
sem você precisar explicar nada.

> **Por que isso funciona:** cada sessão do Claude começa do zero, sem memória.
> O que dá continuidade ao projeto são esses documentos. É por isso que eles são
> atualizados no fim de toda sessão. **Eles são a sua rede de segurança, não o
> assistente.**

Quando terminar de trabalhar, peça:

```
Atualize a documentação da sessão e crie o prompt da próxima.
```

---

## 4. O que esperar na tela

**O Claude vai pedir permissão** antes de mexer em arquivo ou rodar comando.
Aparece algo como "Do you want to make this edit?" com opções. Você responde
`yes` (ou aperta Enter na opção de aceitar).

Se não entendeu o que ele vai fazer, **responda `no` e pergunte**. Recusar nunca
quebra nada.

**Vai aparecer muito texto passando.** É normal — são os testes e o build
rodando. Não precisa ler.

**Comandos úteis dentro do Claude Code:**

| Digite   | Faz                               |
| -------- | --------------------------------- |
| `/clear` | limpa a conversa e começa do zero |
| `/exit`  | fecha                             |

---

## 5. Coisas deste projeto que você precisa saber

Não para entender — só para não se assustar.

**O projeto se defende sozinho antes de aceitar mudança.** Quando o Claude for
salvar algo, três coisas rodam automaticamente: formatação, verificação de erros
de código, e conferência do formato da mensagem. **Se travar ali, é proteção
funcionando.** Peça para o Claude corrigir e tentar de novo.

**Existe um portão de segurança que não pode ser afrouxado.** O projeto recusa
qualquer dependência com vulnerabilidade grave. Se algum dia um assistente
sugerir "desligar temporariamente" essa verificação para destravar, **diga não**.
Foi um trabalho grande conquistar isso, e existe um jeito certo de tratar exceção
(está documentado no `docs/adr/015-*.md`).

**Nunca cole senha, chave ou token no chat.** Nem aqui, nem no Cowork. O jeito
certo é você copiar do painel de origem e colar no painel de destino, sem passar
pelo assistente. Se algum assistente pedir, recuse e me avise.

---

## 6. Frases prontas para o que ainda falta

Copie e cole a que quiser fazer.

**Limpar os pedidos de atualização pendentes:**

```
Temos 16 PRs do Dependabot abertos desde abril. Faça a triagem: liste quais
ainda fazem sentido, feche os obsoletos, e me diga quais valem mesclar.
```

**Melhorar a cobertura de testes:**

```
Continue o item T4f: amplifique os testes do próximo service. Rode os testes
localmente antes de commitar e me mostre o resultado.
```

**Testar se o backup realmente funciona:**

```
O backup do Postgres roda toda noite mas nunca foi restaurado. Faça um teste de
restore numa branch descartável da Neon e me diga se funciona de verdade.
```

**Quando algo quebrar:**

```
O CI ficou vermelho. Descubra o motivo com o gh, me explique em português
simples o que aconteceu, e proponha a correção antes de aplicar.
```

**Quando você não entender alguma resposta:**

```
Não entendi. Explique de novo, do zero, como se eu nunca tivesse visto isso.
```

Essa última é a mais importante do guia. Use sem constrangimento.

---

## 7. Quando voltar para o Cowork

Volte para cá quando o trabalho for em site com login:

- alertas de billing em Cloudflare, Neon e Upstash
- migrar as contas para o e-mail institucional (`pedro.perin@theiadvisor.com`)
- as fases restantes do Stripe
- provisionar o ambiente de staging
- conferir se um alerta chegou de verdade no e-mail

---

## 8. Se algo der muito errado

Nada que você fizer conversando com o Claude é irreversível. Tudo que é salvo no
projeto pode ser desfeito.

Se ficar perdido, abra o Claude Code e cole:

```
Alguma coisa deu errado e eu não sei o quê. Rode git status e git log -5
--oneline, me diga o estado atual em português simples, e me diga se algo
precisa ser desfeito.
```

Se o site sair do ar, você vai receber **e-mail em até 5 minutos** em
`pedro.perin@theiadvisor.com` — há três monitores externos vigiando desde
31/07/2026. Você não vai descobrir por acaso, como aconteceu em junho.

---

## 9. Uma coisa sobre o futuro

Este projeto vai processar pagamento e guardar dado de cliente. Antes do primeiro
cliente pagante, vale ter **uma pessoa técnica de confiança** dando uma olhada de
vez em quando — não para substituir o trabalho com o Claude, mas porque decisões
de segurança e conformidade legal pedem um humano com nome e responsabilidade.

Não é urgente e não é fracasso. É como todo produto sério funciona.

---

_Criado em 2026-07-31 (S84). Se o projeto mudar de estrutura, peça ao Claude para
atualizar este guia._
