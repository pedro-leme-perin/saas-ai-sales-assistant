# S66-D — Conventional Commits Enforcement (commitlint)

**Sessão:** S66-D
**Data:** 27/04/2026
**Objetivo:** Garantir que toda mensagem de commit siga
[Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/),
permitindo geração automática de changelog/release notes futuros.

---

## 1. Stack

- **@commitlint/cli 19.6.1** — validador
- **@commitlint/config-conventional 19.6.0** — preset oficial
- **.husky/commit-msg** — hook que invoca `commitlint --edit "$1"`

Total novo: 2 deps + 2 arquivos (config + hook). Zero alteração em pre-commit existente (S65).

---

## 2. Formato exigido

```
<type>(<scope>): <subject>

<optional body>

<optional footer>
```

### Types permitidos

| Type       | Quando usar                               |
| ---------- | ----------------------------------------- |
| `feat`     | Nova funcionalidade user-facing           |
| `fix`      | Bugfix                                    |
| `chore`    | Tooling/meta/release sem impacto user     |
| `docs`     | Apenas documentação                       |
| `refactor` | Reestruturação sem mudar comportamento    |
| `test`     | Adição/edição de testes                   |
| `style`    | Formatação/whitespace, sem semântica      |
| `perf`     | Melhoria de performance                   |
| `build`    | Build system / deps externas              |
| `ci`       | CI/CD config (`.github/workflows`, husky) |
| `revert`   | Revert de commit anterior                 |

### Regras (commitlint.config.js)

| Rule                   | Valor                                   | Severidade |
| ---------------------- | --------------------------------------- | ---------- |
| `header-max-length`    | 100 chars                               | error      |
| `subject-case`         | never start-case/pascal-case/upper-case | error      |
| `subject-empty`        | never                                   | error      |
| `subject-full-stop`    | never `.`                               | error      |
| `type-empty`           | never                                   | error      |
| `type-case`            | always lower-case                       | error      |
| `type-enum`            | 11 types acima                          | error      |
| `scope-case`           | always lower-case                       | error      |
| `body-leading-blank`   | always                                  | warn       |
| `footer-leading-blank` | always                                  | warn       |
| `body-max-line-length` | 200 chars                               | warn       |

`header-max-length` aumentado para 100 (default 72) porque convenção do projeto inclui subjects descritivos como `feat(s66-c): coverage ratchet defensivo 65/55/62/65 -> 68/58/65/68`.

`body-max-line-length` aumentado para 200 (default 100) — nossos commits incluem tabelas markdown e listas de arquivos.

---

## 3. Exemplos

### Aceitos

```
feat(s66-c): coverage ratchet defensivo 65/55/62/65 -> 68/58/65/68
```

```
fix(s66-a1): replace 15 `as any` casts with typed `as unknown as DtoType`
```

```
test(s66-b): add 7 controller specs (contacts/announcements/webhooks/...)
```

```
docs(api): document /webhooks signature rotation flow
```

```
chore(deps): bump prisma 5.21 -> 5.22
```

### Rejeitados

```
Adding feature             # missing type
WIP                        # missing type, no colon
feat: Adding Feature.      # subject-case (PascalCase) + subject-full-stop
ABC: feature              # type-enum (ABC not allowed)
feature(scope): subject   # type-enum (singular "feat", not "feature")
```

---

## 4. Bypass (emergências)

Em caso de validador com bug ou commit de emergência:

```bash
HUSKY=0 git commit -m "anything"
```

Se bypass for recorrente, abrir issue para refinar regras.

---

## 5. Onboarding

Após `pnpm install`, hook é ativado automaticamente via husky `prepare` script (já configurado em S65).

Verificar manualmente:

```bash
ls -la .husky/_/commit-msg     # deve existir após pnpm install
echo "test" | npx --no-install commitlint   # deve falhar com input inválido
```

---

## 6. Workflow do dev

1. Stage changes: `git add -- <files>`
2. Commit: `git commit -m "feat(scope): subject"` ou `git commit` (abre editor)
3. Hook valida. Se aceito → commit prossegue. Se rejeitado → mensagem de erro com regras violadas; corrigir e tentar novamente.

Exemplo de erro:

```
✖   subject must not be sentence-case [subject-case]
✖   header must be smaller than 100 characters [header-max-length]
```

---

## 7. Roadmap

- [ ] **S66-D follow-up**: adicionar `--from HEAD~5 --to HEAD` para validar último 5 commits em CI (catch retroactive violations).
- [ ] **Auto-changelog generation**: usar `conventional-changelog-cli` para gerar `CHANGELOG.md` automaticamente em releases.
- [ ] **Semantic versioning**: derivar versão automática (major/minor/patch) baseada em types (`feat!`/`fix`/`feat`).

---

**Status:** S66-D entregue. Hook ativo após `pnpm install`.
