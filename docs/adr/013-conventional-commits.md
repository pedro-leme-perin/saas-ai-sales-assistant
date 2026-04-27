# ADR-013: Conventional Commits enforcement (commitlint)

- **Status:** Aceito
- **Data:** 2026-04-27
- **Autores:** Pedro Leme Perin
- **Referências:** [Conventional Commits 1.0.0 spec](https://www.conventionalcommits.org/en/v1.0.0/);
  _Continuous Delivery_ — release engineering; commitlint.js docs;
  Angular contributor guide (origem do formato).

## Contexto

Antes de S66-D, mensagens de commit no monorepo seguiam convenção informal:

- `feat(s64-c): relax global functions floor 65 -> 60` (formato inspirado mas não validado)
- `fix(s60a): unwrap envelope in dsar.service to expose items to UI`

Sem validação, drift era inevitável:

- Subjects aleatórios sem type prefix (`Adding feature`, `WIP`)
- Type case inconsistente (`Feat:`, `feat:`, `FEAT:`)
- Period at end (`fix: bug.` vs `fix: bug`)
- Body line-length irregular (algumas tabelas markdown com 200+ chars, outras com 60)

Custos identificados:

1. **Auto-changelog impossível**: ferramentas como `conventional-changelog-cli` exigem formato strict para parsear types e gerar release notes.
2. **Semantic versioning manual**: sem types validados, derivar major/minor/patch é error-prone.
3. **Code review fricção**: reviewers gastam tempo validando format em vez de conteúdo.
4. **Searchability ruim**: `git log --grep="^feat"` falha quando commits usam variantes.

## Decisão

**Adotar Conventional Commits 1.0.0** com validação automática via commitlint hook (`.husky/commit-msg`).

Stack:

- `@commitlint/cli` v19.x
- `@commitlint/config-conventional` v19.x (preset oficial)
- Hook `commit-msg` invoca `npx --no-install commitlint --edit "$1"`

Formato exigido:

```
<type>(<scope>): <subject>

<optional body>

<optional footer>
```

**11 types permitidos** (config + custom enum):

| Type       | Quando usar                            |
| ---------- | -------------------------------------- |
| `feat`     | Nova funcionalidade user-facing        |
| `fix`      | Bugfix                                 |
| `chore`    | Tooling/meta sem impacto user          |
| `docs`     | Apenas documentação                    |
| `refactor` | Reestruturação sem mudar comportamento |
| `test`     | Adição/edição de testes                |
| `style`    | Formatação/whitespace, sem semântica   |
| `perf`     | Melhoria de performance                |
| `build`    | Build system / deps externas           |
| `ci`       | CI/CD config                           |
| `revert`   | Revert de commit anterior              |

**Custom rules** (commitlint.config.js, sobre config-conventional):

| Rule                                          | Valor                                         | Razão                                                                                                       |
| --------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `header-max-length`                           | 100 (vs default 72)                           | Subjects descritivos do projeto (e.g. `feat(s66-c): coverage ratchet defensivo 65/55/62/65 -> 68/58/65/68`) |
| `body-max-line-length`                        | 200 (vs default 100)                          | Tabelas markdown e listas de arquivos                                                                       |
| `subject-case`                                | never `start-case`/`pascal-case`/`upper-case` | Pega `Adding Feature`                                                                                       |
| `subject-empty`                               | never                                         | Obvious                                                                                                     |
| `subject-full-stop`                           | never `.`                                     | Convention                                                                                                  |
| `type-empty`                                  | never                                         | Obvious                                                                                                     |
| `type-case`                                   | always `lower-case`                           | Pega `FEAT:`                                                                                                |
| `scope-case`                                  | always `lower-case`                           | Pega `(S66-D)` (correto: `(s66-d)`)                                                                         |
| `body-leading-blank` / `footer-leading-blank` | warn                                          | Conventional                                                                                                |

Bypass: `HUSKY=0 git commit ...` (emergências apenas).

## Consequências

### Positivas

- **Auto-changelog futuro viável**: `conventional-changelog-cli` parsea log e gera CHANGELOG.md automático.
- **Semantic versioning derivable**: `feat!` (breaking) → major; `feat` → minor; `fix` → patch.
- **Searchability**: `git log --grep="^fix"` retorna apenas bugfixes consistentemente.
- **Code review focus**: reviewers validam conteúdo, não format (commitlint pega format antes).
- **Onboarding**: format codified em `commitlint.config.js` + `docs/operations/s66/COMMITLINT.md` — devs novos têm referência única.

### Negativas / trade-offs aceitos

- **Aprendizado curto**: devs precisam aprender 11 types + scope kebab-case. Mitigation: doc + erros do hook são auto-explicativos.
- **Bypass risk**: emergency commits podem ignorar hook via `HUSKY=0`. Mitigation: PR review pega bypass via mensagem do commit (post-mortem).
- **Performance**: hook adiciona ~500ms-1s por commit. Aceitável.
- **Header limit 100**: ainda força brevidade; commits experimentais podem precisar editar.

## Compliance

Como verificar:

- **Hook ativação**: `.husky/commit-msg` deve existir + `.husky/_/commit-msg` gerado pelo husky `prepare`.
- **CI / git log audit**: `git log --pretty=format:"%s" | grep -vE "^(feat|fix|chore|docs|refactor|test|style|perf|build|ci|revert)(\(.+\))?: "` deve retornar apenas commits pré-S66-D.
- **Commit message validation pre-merge**: GitHub Actions opcional (não implementado): `commitlint --from origin/main --to HEAD` em PR.

## Notas

### Alternativas consideradas e descartadas

1. **gitlint** — Python-based, similar funcionalidade. Descartado: stack Node, adicionar Python é fricção.
2. **Custom regex validator** (sem commitlint) — manual, frágil. Descartado: commitlint é battle-tested em milhares de projetos.
3. **Husky pre-commit message validation** — Husky 9 oferece `commit-msg` hook nativo; usamos.
4. **Header-max-length default (72)** — testado e descartado: subjects do projeto são descritivos demais (e.g. multi-version coverage diff). Relaxado para 100.
5. **Body-max-line-length default (100)** — descartado pelo mesmo motivo. Relaxado para 200.

### Meta-validação

S66-D commit (`9c7e858`) foi o primeiro a passar pelo hook recém-instalado: dogfooding bem-sucedido. Hook validou sua própria instalação.

### Roadmap futuro (não-blocking)

- **Auto-changelog**: integrar `conventional-changelog-cli` em release script. Gerar `CHANGELOG.md` automático em tags.
- **Semantic-release**: ferramenta full-stack (`semantic-release`) que automatiza versioning + tagging + changelog + publish. Avaliação custo-benefício pendente.
- **CI-side commitlint**: GitHub Action `wagoid/commitlint-github-action` valida PR commits. Pega bypass `HUSKY=0` mid-development.

### Sessão original

- **S66-D (`9c7e858`)** — commitlint hook + config + doc inicial. Ver `docs/operations/s66/COMMITLINT.md`.
