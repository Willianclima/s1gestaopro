# Fase 0 — Pré-Checagem Somente Leitura (`audit_ro`)

> **Escopo e Autorização:** A Fase 0 é estritamente diagnóstica (`BEGIN READ ONLY; ... ROLLBACK;`) e **não autoriza** provisionamento (`Subfase 1.1`, `1.2A`, `1.2B`, `1.2C`), criação/alteração de roles, schemas, views, grants, dados, migrations ou deploy.

## Arquivos do Pacote

- `docs/fase0/fase0_precheck_readonly_prod.sql` — Execução exclusiva em **Produção** (`s1_audit_ro_prod`, `s1_audit_view_owner_prod`).
- `docs/fase0/fase0_precheck_readonly_dev.sql` — Execução separada em **Desenvolvimento** (`s1_audit_ro_dev`, `s1_audit_view_owner_dev`).

Os dois arquivos são idênticos em lógica, consultas e ordem de colunas, diferindo apenas no rótulo de ambiente (`PRODUCAO` vs `DESENVOLVIMENTO` na Consulta 1) e nos nomes de roles de auditoria (Consulta 7a).

### Execução Recomendada pelo DBA

```bash
psql -v ON_ERROR_STOP=1 -f docs/fase0/fase0_precheck_readonly_prod.sql
# Em sessao separada:
psql -v ON_ERROR_STOP=1 -f docs/fase0/fase0_precheck_readonly_dev.sql
```

---

## Matriz Completa de Validação das 47 Colunas (`src/db/schema.ts` + `drizzle/0000`–`0003`)

- **Composição:** `32` colunas base (`0000`, todas na Subfase `1.2A`) + `7` condicionais (`0002`: `4` na `1.2A`, `3` estruturais sem grant) + `8` condicionais (`0003`: `5` na `1.2A`, `3` estruturais sem grant) = **47 colunas** (`41` com `GRANT SELECT` previsto na Subfase `1.2A`; `6` estritamente sem grant).
- **Nulabilidade bidirecional:** qualquer divergência entre `expected_not_null` e `found_not_null` (`NOT NULL -> NULL` ou `NULL -> NOT NULL`) aciona `INCOMPATÍVEL` e `STOP`.
- **Integridade `serial`/`nextval`:** validada por catálogo em `users.id`, `revoked_sessions.id` e `password_reset_tokens.id` sem assumir nome de sequência e sem ler linhas de negócio.
- **Limite explícito de escopo:** `PK`, `UNIQUE` e `DEFAULT`s não relacionados a `serial` **não** são validados pela Consulta 5.

| # | Tabela | Coluna | Origem | Subfase `1.2A` | Tipo PG Esperado | `expected_not_null` | Validação `serial`/Seq | Declaração de Referência |
|---:|---|---|---:|---:|---|---:|---:|---|
| 1 | `users` | `id` | `0000` | Sim | `integer` | `true` (`NOT NULL`) | **Sim** | `serial PRIMARY KEY NOT NULL` |
| 2 | `users` | `uid` | `0000` | Sim | `text` | `true` (`NOT NULL`) | Não | `text NOT NULL` |
| 3 | `users` | `email` | `0000` | Sim | `text` | `true` (`NOT NULL`) | Não | `text NOT NULL` |
| 4 | `users` | `document` | `0000` | Sim | `text` | `false` (`NULL`) | Não | `text` |
| 5 | `users` | `user_type` | `0000` | Sim | `text` | `false` (`NULL`) | Não | `text` |
| 6 | `users` | `status` | `0000` | Sim | `text` | `false` (`NULL`) | Não | `text DEFAULT 'ativo'` |
| 7 | `users` | `google_uid` | `0000` | Sim | `text` | `false` (`NULL`) | Não | `text` |
| 8 | `usuarios` | `id` | `0000` | Sim | `text` | `true` (`NOT NULL`) | Não | `text PRIMARY KEY NOT NULL` |
| 9 | `usuarios` | `document` | `0000` | Sim | `text` | `false` (`NULL`) | Não | `text` |
| 10 | `usuarios` | `email` | `0000` | Sim | `text` | `false` (`NULL`) | Não | `text` |
| 11 | `usuarios` | `user_type` | `0000` | Sim | `text` | `false` (`NULL`) | Não | `text` |
| 12 | `usuarios` | `status` | `0000` | Sim | `text` | `false` (`NULL`) | Não | `text DEFAULT 'ativo'` |
| 13 | `professionals` | `id` | `0000` | Sim | `text` | `true` (`NOT NULL`) | Não | `text PRIMARY KEY NOT NULL` |
| 14 | `professionals` | `name` | `0000` | Sim | `text` | `true` (`NOT NULL`) | Não | `text NOT NULL` |
| 15 | `professionals` | `document` | `0000` | Sim | `text` | `false` (`NULL`) | Não | `text` |
| 16 | `professionals` | `email` | `0000` | Sim | `text` | `false` (`NULL`) | Não | `text` |
| 17 | `professionals` | `blocked` | `0000` | Sim | `boolean` | `false` (`NULL`) | Não | `boolean DEFAULT false` |
| 18 | `professionals` | `google_uid` | `0000` | Sim | `text` | `false` (`NULL`) | Não | `text` |
| 19 | `service_orders` | `id` | `0000` | Sim | `text` | `true` (`NOT NULL`) | Não | `text PRIMARY KEY NOT NULL` |
| 20 | `service_orders` | `client_id` | `0000` | Sim | `text` | `false` (`NULL`) | Não | `text` |
| 21 | `service_orders` | `category` | `0000` | Sim | `text` | `false` (`NULL`) | Não | `text` |
| 22 | `service_orders` | `status` | `0000` | Sim | `text` | `true` (`NOT NULL`) | Não | `text DEFAULT 'aberto' NOT NULL` |
| 23 | `service_orders` | `assigned_to` | `0000` | Sim | `text` | `false` (`NULL`) | Não | `text` |
| 24 | `service_categories` | `id` | `0000` | Sim | `text` | `true` (`NOT NULL`) | Não | `text PRIMARY KEY NOT NULL` |
| 25 | `service_categories` | `name` | `0000` | Sim | `text` | `true` (`NOT NULL`) | Não | `text NOT NULL` |
| 26 | `system_logs` | `id` | `0000` | Sim | `text` | `true` (`NOT NULL`) | Não | `text PRIMARY KEY NOT NULL` |
| 27 | `system_logs` | `category` | `0000` | Sim | `text` | `true` (`NOT NULL`) | Não | `text NOT NULL` |
| 28 | `login_attempts` | `id` | `0000` | Sim | `text` | `true` (`NOT NULL`) | Não | `text PRIMARY KEY NOT NULL` |
| 29 | `login_attempts` | `user_id` | `0000` | Sim | `text` | `false` (`NULL`) | Não | `text` |
| 30 | `login_attempts` | `status` | `0000` | Sim | `text` | `true` (`NOT NULL`) | Não | `text NOT NULL` |
| 31 | `access_profiles` | `id` | `0000` | Sim | `text` | `true` (`NOT NULL`) | Não | `text PRIMARY KEY NOT NULL` |
| 32 | `access_profiles` | `is_system_default` | `0000` | Sim | `boolean` | `false` (`NULL`) | Não | `boolean DEFAULT false` |
| 33 | `users` | `force_password_change` | `0002` (Cond.) | Sim | `boolean` | `false` (`NULL`) | Não | `boolean DEFAULT false` |
| 34 | `users` | `password_hash` | `0002` (Cond.) | **Não** | `text` | `false` (`NULL`) | Não | `text` (sem grant) |
| 35 | `revoked_sessions` | `id` | `0002` (Cond.) | Sim | `integer` | `true` (`NOT NULL`) | **Sim** | `serial PRIMARY KEY NOT NULL` |
| 36 | `revoked_sessions` | `type` | `0002` (Cond.) | Sim | `text` | `true` (`NOT NULL`) | Não | `text NOT NULL` |
| 37 | `revoked_sessions` | `identifier` | `0002` (Cond.) | **Não** | `text` | `true` (`NOT NULL`) | Não | `text NOT NULL` (sem grant) |
| 38 | `revoked_sessions` | `revoked_at` | `0002` (Cond.) | **Não** | `timestamp without time zone` | `true` (`NOT NULL`) | Não | `timestamp DEFAULT now() NOT NULL` (sem grant) |
| 39 | `revoked_sessions` | `expires_at` | `0002` (Cond.) | Sim | `timestamp without time zone` | `false` (`NULL`) | Não | `timestamp` |
| 40 | `password_reset_tokens` | `id` | `0003` (Cond.) | Sim | `integer` | `true` (`NOT NULL`) | **Sim** | `serial PRIMARY KEY NOT NULL` |
| 41 | `password_reset_tokens` | `token_hash` | `0003` (Cond.) | **Não** | `text` | `true` (`NOT NULL`) | Não | `text NOT NULL` (sem grant) |
| 42 | `password_reset_tokens` | `user_id` | `0003` (Cond.) | Sim | `text` | `true` (`NOT NULL`) | Não | `text NOT NULL` |
| 43 | `password_reset_tokens` | `document` | `0003` (Cond.) | **Não** | `text` | `false` (`NULL`) | Não | `text` (sem grant) |
| 44 | `password_reset_tokens` | `purpose` | `0003` (Cond.) | Sim | `text` | `true` (`NOT NULL`) | Não | `text DEFAULT 'activation' NOT NULL` |
| 45 | `password_reset_tokens` | `expires_at` | `0003` (Cond.) | Sim | `timestamp without time zone` | `true` (`NOT NULL`) | Não | `timestamp NOT NULL` |
| 46 | `password_reset_tokens` | `used_at` | `0003` (Cond.) | Sim | `timestamp without time zone` | `false` (`NULL`) | Não | `timestamp` |
| 47 | `password_reset_tokens` | `created_at` | `0003` (Cond.) | **Não** | `timestamp without time zone` | `true` (`NOT NULL`) | Não | `timestamp DEFAULT now() NOT NULL` (sem grant) |

---

## Critérios de `STOP`

1. `observed_tx_read_only <> 'on'`, divergência injustificada entre `session_user` e `current_user`, ou alvo diferente do ambiente esperado.
2. Versão do PostgreSQL `< 15` (EOL), `19.x` (suportada oficialmente porém ainda não validada neste roteiro) ou desconhecida; apenas `15–18` segue sem `STOP`.
3. Ausência de qualquer das 8 tabelas obrigatórias (`0000`) ou incompletude estrutural de `0002`/`0003`.
4. Conferência local do DBA em `__drizzle_migrations` inconclusiva ou `"não corresponde"` (sem exportar hashes).
5. Qualquer tabela/coluna ausente ou `NÃO CONFIRMADO` na matriz de 47 colunas.
6. Qualquer divergência de tipo (`found_pg_type <> expected_pg_type`, incluindo `timestamptz` em vez de `timestamp without time zone`).
7. Qualquer divergência bidirecional de nulabilidade (`found_not_null <> expected_not_null`).
8. Qualquer falha nas 3 colunas `serial` (`users.id`, `revoked_sessions.id`, `password_reset_tokens.id`).
9. Uso de colunas de `0002`/`0003` para liberar avanço sem confirmação formal das respectivas migrations.
10. `rls_enabled = true` em qualquer das 10 tabelas, pré-existência de `s1_audit_*` ou `audit_ro`, ou exposições críticas em `PUBLIC`, `SECURITY DEFINER` ou `pg_default_acl`.

---

## Modelo Sanitizado de Relatório do DBA

```text
================================================================================
RELATORIO DE PRE-CHECAGEM FASE 0 — S1 GESTAO PRO (SOMENTE LEITURA)
================================================================================
1. EXECUCAO (SEM SENHAS, TOKENS, HOSTS OU STRINGS DE CONEXAO)
   - Ambiente / Arquivo           : [ PRODUCAO | DESENVOLVIMENTO ] / [ arquivo ]
   - Comando utilizado            : psql -v ON_ERROR_STOP=1 -f <arquivo>
   - Data/Hora (UTC)              : [ YYYY-MM-DD HH:MM UTC ]

2. SESSAO E VERSAO (CONSULTA 1)
   - observed_tx_read_only        : [ on | off ]
   - session_vs_effective_diverged: [ false | true ]
   - pg_version_num / status      : [ numero | OK (15-18) | STOP ]

3. TABELAS E MIGRATIONS (CONSULTAS 3, 4a, 4b)
   - Tabelas 0000 (8/8)           : [ TODAS PRESENTES | AUSENTE: listar ]
   - Objetos 0002 / 0003          : [ COMPLETO | INCOMPLETO | AUSENTE ]
   - Conferencia local __drizzle_migrations (sem hashes): [ corresponde | nao corresponde | ausente/inconclusivo ]

4. MATRIZ DAS 47 COLUNAS (CONSULTAS 5 E 5b)
   - Base 0000 (32 cols)          : [ 32/32 COMPATIVEL | DIVERGENCIAS/STOP ]
   - Condicional 0002 (7 cols)    : [ X/7 COMPATIVEL (CONDICIONAL) | DIVERGENCIAS/STOP ]
   - Condicional 0003 (8 cols)    : [ X/8 COMPATIVEL (CONDICIONAL) | DIVERGENCIAS/STOP ]
   - Serial/Sequencia (3 cols)    : [ 3/3 COMPATIVEL | FALHA: listar tabela.coluna ]
   - Nulabilidade bidirecional    : [ 47/47 COMPATIVEL | DIVERGENCIAS: listar tabela.coluna ]
   - Escopo nao validado          : PKs, UNIQUEs e DEFAULTs nao-serial nao validados na Fase 0.

5. RLS, COLISOES E SUPERFICIE DE SEGURANCA (CONSULTAS 2, 6, 7a, 7b, 8a, 8b, 8c)
   - RLS habilitado em public.*   : [ NENHUMA | TABELAS: listar ]
   - Roles s1_audit_* / schema audit_ro: [ LIVRES | JA EXISTEM (STOP) ]
   - PUBLIC / SECURITY DEFINER / pg_default_acl / pg_extension: [ SEM ACHADOS | ACHADOS: descrever sem segredos ]

6. DIVERGENCIAS (SEM DADOS DE NEGOCIO / SEM CORRECAO AUTOMATICA)
   - [ Nenhuma | Registrar tabela.coluna, tipo esperado vs encontrado, nulabilidade e serial ]

7. DECISAO DA FASE 0
   - Parecer                      : [ STOP (BLOQUEADO) | APTO PARA SOLICITAR AUTORIZACAO DA SUBFASE 1.1 ]
================================================================================
```
