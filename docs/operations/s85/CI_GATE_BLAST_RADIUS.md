# Alcance do gate que aprovava sem validar (S85)

**Data:** 2026-08-01
**Correção:** `bc0f733` — `ci-gate` passou a exigir `success` explícito em cada job
**Escopo desta medição:** todas as 347 execuções do workflow `CI` em `main`, evento `push`
**Método:** `actions/runs?branch=main&event=push` paginado, mais `runs/<id>/jobs` para cada
uma — 347 chamadas, 1.408 linhas de job. Nenhuma execução foi reprocessada.

---

## O defeito

O passo do `ci-gate` reprovava assim:

```bash
if [[ "…frontend.result" == "failure" || "…backend.result" == "failure" || … ]]; then exit 1; fi
```

O job roda sob `if: always()`. Um job do GitHub Actions conclui em `success`, `failure`,
`cancelled`, `skipped` ou `neutral` — a comparação só enxergava um desses cinco. `skipped` e
`cancelled` caíam no caminho de aprovação. E `skipped` é justamente o estado que
`frontend`/`backend`/`security` assumem quando o `install`, do qual dependem, falha.

Resultado: **o check "CI Gate" ficava verde sobre uma build que não compilou, não rodou teste
nenhum e não passou pelo audit de segurança.**

---

## Tamanho medido

| Medida                                                          | Valor  |
| --------------------------------------------------------------- | ------ |
| Execuções analisadas                                            | 347    |
| Execuções sem o job `CI Gate` (anteriores à sua criação)        | 13     |
| Execuções com `CI Gate` = `success`                             | 153    |
| **Destas, com algum job de validação presente e não-`success`** | **44** |
| Commits distintos afetados                                      | 44     |
| **Commits cujo conteúdo nenhuma execução posterior validou**    | **0**  |

Causa das 44:

| Causa                                                        | Execuções |
| ------------------------------------------------------------ | --------- |
| `install` falhou → `frontend`/`backend`/`security` `skipped` | 41        |
| Execução cancelada por concorrência (`cancel-in-progress`)   | 3         |

Distribuição no tempo: 41 das 44 estão entre 2026-03-27 e 2026-04-29. As três restantes são
cancelamentos por concorrência — `1b8fba9` (22/04), `10b72ee` (31/07) e `d5d9783` (01/08),
este último desta própria sessão, quando um push seguido cancelou a execução anterior.

### Uma armadilha de contagem, registrada porque quase virou o número reportado

A primeira passagem acusou **102** commits. Estava errada: comparava cada execução histórica
contra a lista de jobs de **hoje**, e o job `security` só existe desde S70 (28/04/2026). As 99
execuções anteriores apareciam como "Security ausente" — que não é gate frouxo, é gate de outra
época. Contando apenas os jobs que existiam em cada execução, o número real é 44.

---

## Por que não há nada a reprocessar

`main` é linear e cada execução valida a **árvore inteira** no commit em que roda, não o
diff. Para os 44 commits afetados, existe pelo menos uma execução posterior em `main` com
`frontend`, `backend` e `security` todos verdes — verificado cruzando os SHAs com
`git log --reverse main`. Cobertura posterior: **44 de 44**.

Ou seja: 44 commits entraram sem a própria validação, e o conteúdo de todos eles foi validado
depois, como parte de uma árvore posterior. **O estado atual de `main` está integralmente
validado.** Reexecutar CI histórico não produziria informação nova.

O limite honesto dessa afirmação: uma execução verde posterior prova que a suíte passou sobre
aquele código, não que o código está correto — se um defeito atravessou os 44 commits e
continua em `main`, ele atravessou também as execuções verdes. Isso é limitação de qualquer
suíte, não buraco de gate.

### Recomendação

Nenhuma ação corretiva. O defeito era de janela, não de resíduo: ele deixava passar, não
corrompia. A correção já está em `bc0f733` e foi exercitada de verdade no mesmo dia — em
`a5a8cd3` o job `Backend` falhou e o `CI Gate` falhou junto, coisa que a versão anterior não
faria se o job tivesse sido pulado.

---

## Tabela completa

| Data       | Commit    | Causa          | Jobs                              |
| ---------- | --------- | -------------- | --------------------------------- |
| 2026-03-27 | `5fba2b8` | install falhou | Backend/Frontend skipped          |
| 2026-03-27 | `7f5d83f` | install falhou | Backend/Frontend skipped          |
| 2026-03-27 | `c979680` | install falhou | Backend/Frontend skipped          |
| 2026-03-28 | `2c537dd` | install falhou | Backend/Frontend skipped          |
| 2026-03-28 | `4bae881` | install falhou | Backend/Frontend skipped          |
| 2026-03-28 | `7a940e6` | install falhou | Backend/Frontend skipped          |
| 2026-03-28 | `a6ee3e0` | install falhou | Backend/Frontend skipped          |
| 2026-03-29 | `bf7fc78` | install falhou | Backend/Frontend skipped          |
| 2026-03-30 | `43af571` | install falhou | Backend/Frontend skipped          |
| 2026-03-31 | `643bcbc` | install falhou | Backend/Frontend skipped          |
| 2026-03-31 | `92bf097` | install falhou | Backend/Frontend skipped          |
| 2026-04-02 | `1b30ad3` | install falhou | Backend/Frontend skipped          |
| 2026-04-02 | `8310f5a` | install falhou | Backend/Frontend skipped          |
| 2026-04-02 | `b06b207` | install falhou | Backend/Frontend skipped          |
| 2026-04-02 | `e69ef71` | install falhou | Backend/Frontend skipped          |
| 2026-04-02 | `f4a3981` | install falhou | Backend/Frontend skipped          |
| 2026-04-03 | `3c8184b` | install falhou | Backend/Frontend skipped          |
| 2026-04-03 | `5352e3a` | install falhou | Backend/Frontend skipped          |
| 2026-04-03 | `6cc5f34` | install falhou | Backend/Frontend skipped          |
| 2026-04-03 | `7bfd46f` | install falhou | Backend/Frontend skipped          |
| 2026-04-03 | `9166372` | install falhou | Backend/Frontend skipped          |
| 2026-04-03 | `b7e009d` | install falhou | Backend/Frontend skipped          |
| 2026-04-03 | `b86ee52` | install falhou | Backend/Frontend skipped          |
| 2026-04-03 | `ba79d32` | install falhou | Backend/Frontend skipped          |
| 2026-04-03 | `fce4871` | install falhou | Backend/Frontend skipped          |
| 2026-04-04 | `15ff94e` | install falhou | Backend/Frontend skipped          |
| 2026-04-04 | `68e4c97` | install falhou | Backend/Frontend skipped          |
| 2026-04-04 | `6e45f56` | install falhou | Backend/Frontend skipped          |
| 2026-04-04 | `cf66c4e` | install falhou | Backend/Frontend skipped          |
| 2026-04-04 | `f7b3794` | install falhou | Backend/Frontend skipped          |
| 2026-04-05 | `0a78e32` | install falhou | Backend/Frontend skipped          |
| 2026-04-05 | `89027b8` | install falhou | Backend/Frontend skipped          |
| 2026-04-05 | `a30fbbf` | install falhou | Backend/Frontend skipped          |
| 2026-04-05 | `d2ab386` | install falhou | Backend/Frontend skipped          |
| 2026-04-13 | `89945bb` | install falhou | Backend/Frontend skipped          |
| 2026-04-14 | `48b24ab` | install falhou | Backend/Frontend skipped          |
| 2026-04-14 | `c13438c` | install falhou | Backend/Frontend skipped          |
| 2026-04-14 | `e4edd14` | install falhou | Backend/Frontend skipped          |
| 2026-04-16 | `00b6766` | install falhou | Backend/Frontend skipped          |
| 2026-04-16 | `c8370e1` | install falhou | Backend/Frontend skipped          |
| 2026-04-22 | `1b8fba9` | cancelada      | Backend/Frontend cancelled        |
| 2026-04-29 | `8a7c2f3` | install falhou | Backend/Frontend/Security skipped |
| 2026-07-31 | `10b72ee` | cancelada      | Backend/Frontend cancelled        |
| 2026-08-01 | `d5d9783` | cancelada      | Frontend cancelled                |

---

## Lição

Já registrada como **#74** em `PROJECT_HISTORY.md`: negar o estado ruim não é o mesmo que
exigir o bom. Esta medição acrescenta o corolário de método: **ao medir alcance histórico, use
a configuração vigente na época, não a de hoje.** A diferença aqui foi 102 contra 44 — um fator
de 2,3, e a versão inflada é a que soaria mais alarmante.
