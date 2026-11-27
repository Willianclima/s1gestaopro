-- ============================================================================
-- S1 GESTAO PRO — FASE 0: PRE-CHECAGEM SOMENTE LEITURA (PRODUCAO)
-- Arquivo: fase0_precheck_readonly_prod.sql
-- Execucao recomendada:
--   psql -v ON_ERROR_STOP=1 -f docs/fase0/fase0_precheck_readonly_prod.sql
--
-- REGRAS OBRIGATORIAS:
--   1. Executar integralmente dentro de BEGIN READ ONLY; ... ROLLBACK;
--   2. Nao alterar dados, schema, roles, grants, PUBLIC, RLS ou extensions.
--   3. Nao ler linhas de tabelas de negocio nem exportar hashes, segredos,
--      senhas, tokens, strings de conexao ou dados pessoais.
--   4. Consulta 5 valida apenas: existencia da tabela/coluna, tipo PG exato,
--      nulabilidade bidirecional (NOT NULL vs NULL) e integridade de serial
--      (sequencia associada + nextval). PKs, UNIQUEs e DEFAULTs nao-serial
--      NAO sao validados por esta pre-checagem.
--   5. Este roteiro NAO autoriza o provisionamento da arquitetura audit_ro.
-- ============================================================================

BEGIN READ ONLY;

-- ----------------------------------------------------------------------------
-- CONSULTA 1: Contexto da Sessao, Identidade Efetiva e Versao do PostgreSQL
-- ----------------------------------------------------------------------------
SELECT
  'PRODUCAO'::text AS target_environment,
  current_database() AS database_name,
  session_user::text AS session_user_name,
  current_user::text AS current_user_name,
  (session_user IS DISTINCT FROM current_user) AS session_vs_effective_diverged,
  current_setting('transaction_read_only') AS observed_tx_read_only,
  su.rolsuper AS session_rolsuper,
  su.rolcreaterole AS session_rolcreaterole,
  su.rolbypassrls AS session_rolbypassrls,
  su.rolcanlogin AS session_rolcanlogin,
  cu.rolsuper AS current_rolsuper,
  cu.rolcreaterole AS current_rolcreaterole,
  cu.rolbypassrls AS current_rolbypassrls,
  cu.rolcanlogin AS current_rolcanlogin,
  current_setting('server_version_num')::integer AS pg_version_num,
  version() AS pg_version_full,
  CASE
    WHEN current_setting('server_version_num')::integer < 150000
      THEN 'STOP - VERSAO EOL / NAO SUPORTADA (< 15)'
    WHEN current_setting('server_version_num')::integer BETWEEN 150000 AND 189999
      THEN 'OK - SUPORTADA E COBERTA (15-18)'
    WHEN current_setting('server_version_num')::integer BETWEEN 190000 AND 199999
      THEN 'STOP - PG 19 OFICIALMENTE SUPORTADO, POREM NAO VALIDADO NESTE ROTEIRO'
    ELSE 'STOP - VERSAO DESCONHECIDA / NAO VALIDADA'
  END AS pg_version_gate_status
FROM pg_roles su
JOIN pg_roles cu ON cu.rolname = current_user
WHERE su.rolname = session_user;

-- ----------------------------------------------------------------------------
-- CONSULTA 2: Inventario de Bancos do Cluster e Superficie PUBLIC
-- (Escopo informativo para futuros passos T0/CP-T3; sem acesso a outros DBs)
-- ----------------------------------------------------------------------------
SELECT
  d.datname AS database_name,
  d.datistemplate AS is_template,
  d.datallowconn AS allow_conn,
  has_database_privilege('PUBLIC', d.datname, 'CONNECT') AS public_has_connect,
  has_database_privilege('PUBLIC', d.datname, 'TEMP') AS public_has_temp,
  has_database_privilege('PUBLIC', d.datname, 'CREATE') AS public_has_create
FROM pg_database d
ORDER BY d.datname;

-- ----------------------------------------------------------------------------
-- CONSULTA 3: Existencia das 10 Tabelas Esperadas no Schema public
-- ----------------------------------------------------------------------------
WITH expected_tables(ord, table_name, origin_migration, requirement_tier) AS (
  VALUES
    ( 1, 'users',                 '0000', 'OBRIGATORIA'),
    ( 2, 'usuarios',              '0000', 'OBRIGATORIA'),
    ( 3, 'professionals',         '0000', 'OBRIGATORIA'),
    ( 4, 'service_orders',        '0000', 'OBRIGATORIA'),
    ( 5, 'service_categories',    '0000', 'OBRIGATORIA'),
    ( 6, 'system_logs',           '0000', 'OBRIGATORIA'),
    ( 7, 'login_attempts',        '0000', 'OBRIGATORIA'),
    ( 8, 'access_profiles',       '0000', 'OBRIGATORIA'),
    ( 9, 'revoked_sessions',      '0002', 'CONDICIONAL'),
    (10, 'password_reset_tokens', '0003', 'CONDICIONAL')
)
SELECT
  et.ord,
  et.table_name,
  et.origin_migration,
  et.requirement_tier,
  (c.oid IS NOT NULL) AS table_exists,
  c.relkind::text AS found_relkind,
  CASE
    WHEN c.oid IS NOT NULL AND et.requirement_tier = 'OBRIGATORIA'
      THEN 'OK - PRESENTE'
    WHEN c.oid IS NOT NULL AND et.requirement_tier = 'CONDICIONAL'
      THEN 'PRESENTE (AGUARDANDO PROVA DA MIGRATION)'
    WHEN c.oid IS NULL AND et.requirement_tier = 'OBRIGATORIA'
      THEN 'STOP - TABELA OBRIGATORIA AUSENTE'
    ELSE 'STOP / PENDENTE - TABELA CONDICIONAL AUSENTE'
  END AS table_gate_status
FROM expected_tables et
LEFT JOIN pg_namespace n
  ON n.nspname = 'public'
LEFT JOIN pg_class c
  ON c.relnamespace = n.oid
 AND c.relname = et.table_name
 AND c.relkind IN ('r', 'p')
ORDER BY et.ord;

-- ----------------------------------------------------------------------------
-- CONSULTA 4a: Objetos Estruturais das Migrations 0002 e 0003 (Somente Catalogo)
-- ----------------------------------------------------------------------------
WITH expected_objects(ord, migration_id, object_type, object_name, target_table) AS (
  VALUES
    ( 1, '0002', 'TABLE',      'revoked_sessions',                         'revoked_sessions'),
    ( 2, '0002', 'INDEX',      'revoked_sessions_lookup_idx',              'revoked_sessions'),
    ( 3, '0002', 'INDEX',      'revoked_sessions_expires_idx',             'revoked_sessions'),
    ( 4, '0002', 'COLUMN',     'password_hash',                            'users'),
    ( 5, '0002', 'COLUMN',     'force_password_change',                    'users'),
    ( 6, '0002', 'FK',         'service_orders_client_id_usuarios_id_fk',  'service_orders'),
    ( 7, '0003', 'TABLE',      'password_reset_tokens',                    'password_reset_tokens'),
    ( 8, '0003', 'UNIQUE',     'password_reset_tokens_token_hash_unique',  'password_reset_tokens'),
    ( 9, '0003', 'INDEX',      'idx_pwd_reset_token_hash',                 'password_reset_tokens'),
    (10, '0003', 'INDEX',      'idx_pwd_reset_user_id',                    'password_reset_tokens'),
    (11, '0003', 'INDEX',      'idx_pwd_reset_expires_at',                 'password_reset_tokens')
)
SELECT
  eo.ord,
  eo.migration_id,
  eo.object_type,
  eo.target_table,
  eo.object_name,
  CASE eo.object_type
    WHEN 'TABLE' THEN EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = eo.object_name AND c.relkind IN ('r', 'p')
    )
    WHEN 'INDEX' THEN EXISTS (
      SELECT 1 FROM pg_class idx
      JOIN pg_namespace n ON n.oid = idx.relnamespace
      JOIN pg_index i ON i.indexrelid = idx.oid
      JOIN pg_class tbl ON tbl.oid = i.indrelid
      WHERE n.nspname = 'public'
        AND idx.relname = eo.object_name
        AND idx.relkind IN ('i', 'I')
        AND tbl.relname = eo.target_table
    )
    WHEN 'COLUMN' THEN EXISTS (
      SELECT 1 FROM pg_attribute a
      JOIN pg_class tbl ON tbl.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = tbl.relnamespace
      WHERE n.nspname = 'public'
        AND tbl.relname = eo.target_table
        AND a.attname = eo.object_name
        AND a.attnum > 0
        AND NOT a.attisdropped
    )
    WHEN 'UNIQUE' THEN EXISTS (
      SELECT 1 FROM pg_constraint con
      JOIN pg_class tbl ON tbl.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = tbl.relnamespace
      WHERE n.nspname = 'public'
        AND tbl.relname = eo.target_table
        AND con.conname = eo.object_name
        AND con.contype = 'u'
    )
    WHEN 'FK' THEN EXISTS (
      SELECT 1 FROM pg_constraint con
      JOIN pg_class tbl ON tbl.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = tbl.relnamespace
      WHERE n.nspname = 'public'
        AND tbl.relname = eo.target_table
        AND con.conname = eo.object_name
        AND con.contype = 'f'
        AND con.confdeltype = 'r'
        AND con.confupdtype = 'c'
    )
    ELSE false
  END AS object_present_and_matched
FROM expected_objects eo
ORDER BY eo.ord;

-- ----------------------------------------------------------------------------
-- CONSULTA 4b: Evidencia Auxiliar de __drizzle_migrations (Sem Exportar Hashes)
-- NOTA: Catalogo puro (nao falha se a tabela/schema drizzle nao existir).
--       COUNT(*) e MAX(created_at) sao apenas evidencias auxiliares e NAO provam
--       quais migrations foram aplicadas. O DBA deve comparar localmente o
--       historico operacional com o schema esperado e registrar no relatorio
--       somente "corresponde" ou "nao corresponde" (sem exportar hashes).
-- ----------------------------------------------------------------------------
SELECT
  n.nspname AS migrations_schema,
  c.relname AS migrations_table,
  pg_get_userbyid(c.relowner) AS table_owner,
  st.n_live_tup AS estimated_live_rows_aux_only,
  STRING_AGG(a.attname || ':' || format_type(a.atttypid, a.atttypmod), ', ' ORDER BY a.attnum) AS catalog_columns
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_stat_user_tables st ON st.relid = c.oid
LEFT JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
WHERE c.relname = '__drizzle_migrations'
  AND c.relkind IN ('r', 'p')
GROUP BY n.nspname, c.relname, c.relowner, st.n_live_tup
ORDER BY n.nspname;

-- ----------------------------------------------------------------------------
-- CONSULTA 5: Matriz Completa das 47 Colunas
--   Valida:
--     1. Existencia da tabela/coluna em public
--     2. Tipo PostgreSQL exato (format_type(atttypid, atttypmod))
--     3. Nulabilidade bidirecional (found_not_null vs expected_not_null)
--     4. Para colunas serial (users.id, revoked_sessions.id, password_reset_tokens.id):
--        integer + NOT NULL + attidentity = '' + atthasdef + DEFAULT nextval('...'::regclass)
--        + exatamente 1 sequencia owned (deptype='a') + pg_get_serial_sequence nao-nulo
--        + dependencia do default (deptype='n') no mesmo OID de sequencia + seqtypid = int4.
--   Nao valida: PKs, UNIQUEs ou DEFAULTs nao relacionados a serial.
-- ----------------------------------------------------------------------------
WITH expected_columns(
  ord,
  table_name,
  column_name,
  origin_migration,
  is_conditional_migration,
  in_subfase_1_2a_grant,
  expected_pg_type,
  expected_not_null,
  expects_serial_sequence,
  repo_sql_decl_ref
) AS (
  VALUES
    -- Base 0000 (32 colunas — Subfase 1.2A = true)
    ( 1, 'users',                 'id',                    '0000', false, true,  'integer',                     true,  true,  'serial PRIMARY KEY NOT NULL'),
    ( 2, 'users',                 'uid',                   '0000', false, true,  'text',                        true,  false, 'text NOT NULL (UNIQUE via users_uid_unique)'),
    ( 3, 'users',                 'email',                 '0000', false, true,  'text',                        true,  false, 'text NOT NULL'),
    ( 4, 'users',                 'document',              '0000', false, true,  'text',                        false, false, 'text'),
    ( 5, 'users',                 'user_type',             '0000', false, true,  'text',                        false, false, 'text'),
    ( 6, 'users',                 'status',                '0000', false, true,  'text',                        false, false, 'text DEFAULT ''ativo'''),
    ( 7, 'users',                 'google_uid',            '0000', false, true,  'text',                        false, false, 'text'),

    ( 8, 'usuarios',              'id',                    '0000', false, true,  'text',                        true,  false, 'text PRIMARY KEY NOT NULL'),
    ( 9, 'usuarios',              'document',              '0000', false, true,  'text',                        false, false, 'text'),
    (10, 'usuarios',              'email',                 '0000', false, true,  'text',                        false, false, 'text'),
    (11, 'usuarios',              'user_type',             '0000', false, true,  'text',                        false, false, 'text'),
    (12, 'usuarios',              'status',                '0000', false, true,  'text',                        false, false, 'text DEFAULT ''ativo'''),

    (13, 'professionals',         'id',                    '0000', false, true,  'text',                        true,  false, 'text PRIMARY KEY NOT NULL'),
    (14, 'professionals',         'name',                  '0000', false, true,  'text',                        true,  false, 'text NOT NULL'),
    (15, 'professionals',         'document',              '0000', false, true,  'text',                        false, false, 'text'),
    (16, 'professionals',         'email',                 '0000', false, true,  'text',                        false, false, 'text'),
    (17, 'professionals',         'blocked',               '0000', false, true,  'boolean',                     false, false, 'boolean DEFAULT false'),
    (18, 'professionals',         'google_uid',            '0000', false, true,  'text',                        false, false, 'text'),

    (19, 'service_orders',        'id',                    '0000', false, true,  'text',                        true,  false, 'text PRIMARY KEY NOT NULL'),
    (20, 'service_orders',        'client_id',             '0000', false, true,  'text',                        false, false, 'text'),
    (21, 'service_orders',        'category',              '0000', false, true,  'text',                        false, false, 'text'),
    (22, 'service_orders',        'status',                '0000', false, true,  'text',                        true,  false, 'text DEFAULT ''aberto'' NOT NULL'),
    (23, 'service_orders',        'assigned_to',           '0000', false, true,  'text',                        false, false, 'text'),

    (24, 'service_categories',    'id',                    '0000', false, true,  'text',                        true,  false, 'text PRIMARY KEY NOT NULL'),
    (25, 'service_categories',    'name',                  '0000', false, true,  'text',                        true,  false, 'text NOT NULL'),

    (26, 'system_logs',           'id',                    '0000', false, true,  'text',                        true,  false, 'text PRIMARY KEY NOT NULL'),
    (27, 'system_logs',           'category',              '0000', false, true,  'text',                        true,  false, 'text NOT NULL'),

    (28, 'login_attempts',        'id',                    '0000', false, true,  'text',                        true,  false, 'text PRIMARY KEY NOT NULL'),
    (29, 'login_attempts',        'user_id',               '0000', false, true,  'text',                        false, false, 'text'),
    (30, 'login_attempts',        'status',                '0000', false, true,  'text',                        true,  false, 'text NOT NULL'),

    (31, 'access_profiles',       'id',                    '0000', false, true,  'text',                        true,  false, 'text PRIMARY KEY NOT NULL'),
    (32, 'access_profiles',       'is_system_default',     '0000', false, true,  'boolean',                     false, false, 'boolean DEFAULT false'),

    -- Condicional 0002 (7 colunas: 4 em Subfase 1.2A + 3 somente estruturais)
    (33, 'users',                 'force_password_change', '0002', true,  true,  'boolean',                     false, false, 'boolean DEFAULT false'),
    (34, 'users',                 'password_hash',         '0002', true,  false, 'text',                        false, false, 'text (SEM GRANT na Subfase 1.2A)'),
    (35, 'revoked_sessions',      'id',                    '0002', true,  true,  'integer',                     true,  true,  'serial PRIMARY KEY NOT NULL'),
    (36, 'revoked_sessions',      'type',                  '0002', true,  true,  'text',                        true,  false, 'text NOT NULL'),
    (37, 'revoked_sessions',      'identifier',            '0002', true,  false, 'text',                        true,  false, 'text NOT NULL (SEM GRANT na Subfase 1.2A)'),
    (38, 'revoked_sessions',      'revoked_at',            '0002', true,  false, 'timestamp without time zone', true,  false, 'timestamp DEFAULT now() NOT NULL (SEM GRANT na Subfase 1.2A)'),
    (39, 'revoked_sessions',      'expires_at',            '0002', true,  true,  'timestamp without time zone', false, false, 'timestamp'),

    -- Condicional 0003 (8 colunas: 5 em Subfase 1.2A + 3 somente estruturais)
    (40, 'password_reset_tokens', 'id',                    '0003', true,  true,  'integer',                     true,  true,  'serial PRIMARY KEY NOT NULL'),
    (41, 'password_reset_tokens', 'token_hash',            '0003', true,  false, 'text',                        true,  false, 'text NOT NULL (SEM GRANT na Subfase 1.2A)'),
    (42, 'password_reset_tokens', 'user_id',               '0003', true,  true,  'text',                        true,  false, 'text NOT NULL'),
    (43, 'password_reset_tokens', 'document',              '0003', true,  false, 'text',                        false, false, 'text (SEM GRANT na Subfase 1.2A)'),
    (44, 'password_reset_tokens', 'purpose',               '0003', true,  true,  'text',                        true,  false, 'text DEFAULT ''activation'' NOT NULL'),
    (45, 'password_reset_tokens', 'expires_at',            '0003', true,  true,  'timestamp without time zone', true,  false, 'timestamp NOT NULL'),
    (46, 'password_reset_tokens', 'used_at',               '0003', true,  true,  'timestamp without time zone', false, false, 'timestamp'),
    (47, 'password_reset_tokens', 'created_at',            '0003', true,  false, 'timestamp without time zone', true,  false, 'timestamp DEFAULT now() NOT NULL (SEM GRANT na Subfase 1.2A)')
),
catalog_check AS (
  SELECT
    ec.*,
    (c.oid IS NOT NULL) AS table_exists,
    (a.attnum IS NOT NULL) AS column_exists,
    format_type(a.atttypid, a.atttypmod) AS found_pg_type,
    a.attnotnull AS found_not_null,
    a.attidentity::text AS found_attidentity,
    a.atthasdef AS found_atthasdef,
    ad.oid AS ad_oid,
    pg_get_expr(ad.adbin, ad.adrelid) AS found_default_expr,
    CASE
      WHEN c.oid IS NOT NULL AND a.attnum IS NOT NULL AND ec.expects_serial_sequence
        THEN pg_get_serial_sequence(quote_ident(n.nspname) || '.' || quote_ident(c.relname), a.attname)
      ELSE NULL
    END AS pg_serial_seq_name,
    COALESCE(owned_seq.owned_seq_count, 0) AS owned_seq_count,
    owned_seq.owned_seq_oid,
    owned_seq.owned_seq_fqn,
    owned_seq.owned_seq_is_int4,
    COALESCE(def_dep.default_seq_dep_count, 0) AS default_seq_dep_count,
    def_dep.default_seq_oid
  FROM expected_columns ec
  LEFT JOIN pg_namespace n
    ON n.nspname = 'public'
  LEFT JOIN pg_class c
    ON c.relnamespace = n.oid
   AND c.relname = ec.table_name
   AND c.relkind IN ('r', 'p')
  LEFT JOIN pg_attribute a
    ON a.attrelid = c.oid
   AND a.attname = ec.column_name
   AND a.attnum > 0
   AND NOT a.attisdropped
  LEFT JOIN pg_attrdef ad
    ON ad.adrelid = c.oid
   AND ad.adnum = a.attnum
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*)::integer AS owned_seq_count,
      CASE WHEN COUNT(*) = 1 THEN MIN(seq.oid::bigint)::oid ELSE NULL END AS owned_seq_oid,
      STRING_AGG(quote_ident(sn.nspname) || '.' || quote_ident(seq.relname), ', ' ORDER BY seq.oid) AS owned_seq_fqn,
      BOOL_AND(sq.seqtypid = 'pg_catalog.int4'::regtype) AS owned_seq_is_int4
    FROM pg_depend d
    JOIN pg_class seq
      ON seq.oid = d.objid
     AND d.classid = 'pg_class'::regclass
     AND seq.relkind = 'S'
    JOIN pg_namespace sn
      ON sn.oid = seq.relnamespace
    JOIN pg_sequence sq
      ON sq.seqrelid = seq.oid
    WHERE d.refclassid = 'pg_class'::regclass
      AND d.refobjid = c.oid
      AND d.refobjsubid = a.attnum
      AND d.deptype = 'a'
  ) owned_seq ON (c.oid IS NOT NULL AND a.attnum IS NOT NULL)
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*)::integer AS default_seq_dep_count,
      CASE WHEN COUNT(*) = 1 THEN MIN(seq2.oid::bigint)::oid ELSE NULL END AS default_seq_oid
    FROM pg_depend d2
    JOIN pg_class seq2
      ON seq2.oid = d2.refobjid
     AND d2.refclassid = 'pg_class'::regclass
     AND seq2.relkind = 'S'
    WHERE d2.classid = 'pg_attrdef'::regclass
      AND d2.objid = ad.oid
      AND d2.deptype = 'n'
  ) def_dep ON (ad.oid IS NOT NULL)
),
evaluated AS (
  SELECT
    cc.*,
    CASE
      WHEN NOT cc.table_exists OR NOT cc.column_exists OR cc.found_pg_type IS NULL
        THEN 'NAO CONFIRMADO'
      WHEN cc.found_pg_type = cc.expected_pg_type
        THEN 'COMPATIVEL'
      ELSE 'INCOMPATIVEL'
    END AS type_check,
    CASE
      WHEN NOT cc.table_exists OR NOT cc.column_exists OR cc.found_not_null IS NULL
        THEN 'NAO CONFIRMADO'
      WHEN cc.found_not_null = cc.expected_not_null
        THEN 'COMPATIVEL'
      ELSE 'INCOMPATIVEL'
    END AS nullability_check,
    CASE
      WHEN NOT cc.expects_serial_sequence
        THEN 'N/A'
      WHEN NOT cc.table_exists OR NOT cc.column_exists
        THEN 'NAO CONFIRMADO'
      WHEN cc.found_pg_type = 'integer'
       AND cc.found_not_null IS TRUE
       AND cc.found_attidentity = ''
       AND cc.found_atthasdef IS TRUE
       AND cc.ad_oid IS NOT NULL
       AND cc.found_default_expr ~ '^(pg_catalog\.)?nextval\(''([^'']|'''')*''::(pg_catalog\.)?regclass\)$'
       AND cc.owned_seq_count = 1
       AND cc.pg_serial_seq_name IS NOT NULL
       AND cc.default_seq_dep_count = 1
       AND cc.default_seq_oid = cc.owned_seq_oid
       AND cc.owned_seq_is_int4 IS TRUE
        THEN 'COMPATIVEL'
      ELSE 'INCOMPATIVEL'
    END AS serial_check
  FROM catalog_check cc
)
SELECT
  ev.ord,
  ev.table_name,
  ev.column_name,
  ev.origin_migration,
  ev.is_conditional_migration,
  ev.in_subfase_1_2a_grant,
  ev.expected_pg_type,
  ev.found_pg_type,
  ev.type_check,
  ev.expected_not_null,
  ev.found_not_null,
  ev.nullability_check,
  ev.expects_serial_sequence,
  ev.owned_seq_fqn,
  ev.pg_serial_seq_name,
  ev.owned_seq_count,
  ev.default_seq_dep_count,
  ev.owned_seq_is_int4,
  ev.found_attidentity,
  ev.found_default_expr,
  ev.serial_check,
  ev.repo_sql_decl_ref,
  CASE
    WHEN NOT ev.table_exists OR NOT ev.column_exists
      THEN 'NAO CONFIRMADO'
    WHEN ev.type_check = 'NAO CONFIRMADO'
      OR ev.nullability_check = 'NAO CONFIRMADO'
      OR ev.serial_check = 'NAO CONFIRMADO'
      THEN 'NAO CONFIRMADO'
    WHEN ev.type_check = 'INCOMPATIVEL'
      OR ev.nullability_check = 'INCOMPATIVEL'
      OR ev.serial_check = 'INCOMPATIVEL'
      THEN 'INCOMPATIVEL'
    WHEN ev.is_conditional_migration
      THEN 'COMPATIVEL (CONDICIONAL A CONFIRMACAO DA MIGRATION)'
    ELSE 'COMPATIVEL'
  END AS validation_status,
  (
    NOT ev.table_exists
    OR NOT ev.column_exists
    OR ev.type_check <> 'COMPATIVEL'
    OR ev.nullability_check <> 'COMPATIVEL'
    OR (ev.expects_serial_sequence AND ev.serial_check <> 'COMPATIVEL')
  ) AS stop_trigger
FROM evaluated ev
ORDER BY ev.ord;

-- ----------------------------------------------------------------------------
-- CONSULTA 5b: Resumo Executivo da Matriz de 47 Colunas (Gate Binario STOP)
-- ----------------------------------------------------------------------------
WITH expected_columns(
  ord, table_name, column_name, origin_migration, is_conditional_migration,
  in_subfase_1_2a_grant, expected_pg_type, expected_not_null, expects_serial_sequence
) AS (
  VALUES
    ( 1, 'users',                 'id',                    '0000', false, true,  'integer',                     true,  true),
    ( 2, 'users',                 'uid',                   '0000', false, true,  'text',                        true,  false),
    ( 3, 'users',                 'email',                 '0000', false, true,  'text',                        true,  false),
    ( 4, 'users',                 'document',              '0000', false, true,  'text',                        false, false),
    ( 5, 'users',                 'user_type',             '0000', false, true,  'text',                        false, false),
    ( 6, 'users',                 'status',                '0000', false, true,  'text',                        false, false),
    ( 7, 'users',                 'google_uid',            '0000', false, true,  'text',                        false, false),
    ( 8, 'usuarios',              'id',                    '0000', false, true,  'text',                        true,  false),
    ( 9, 'usuarios',              'document',              '0000', false, true,  'text',                        false, false),
    (10, 'usuarios',              'email',                 '0000', false, true,  'text',                        false, false),
    (11, 'usuarios',              'user_type',             '0000', false, true,  'text',                        false, false),
    (12, 'usuarios',              'status',                '0000', false, true,  'text',                        false, false),
    (13, 'professionals',         'id',                    '0000', false, true,  'text',                        true,  false),
    (14, 'professionals',         'name',                  '0000', false, true,  'text',                        true,  false),
    (15, 'professionals',         'document',              '0000', false, true,  'text',                        false, false),
    (16, 'professionals',         'email',                 '0000', false, true,  'text',                        false, false),
    (17, 'professionals',         'blocked',               '0000', false, true,  'boolean',                     false, false),
    (18, 'professionals',         'google_uid',            '0000', false, true,  'text',                        false, false),
    (19, 'service_orders',        'id',                    '0000', false, true,  'text',                        true,  false),
    (20, 'service_orders',        'client_id',             '0000', false, true,  'text',                        false, false),
    (21, 'service_orders',        'category',              '0000', false, true,  'text',                        false, false),
    (22, 'service_orders',        'status',                '0000', false, true,  'text',                        true,  false),
    (23, 'service_orders',        'assigned_to',           '0000', false, true,  'text',                        false, false),
    (24, 'service_categories',    'id',                    '0000', false, true,  'text',                        true,  false),
    (25, 'service_categories',    'name',                  '0000', false, true,  'text',                        true,  false),
    (26, 'system_logs',           'id',                    '0000', false, true,  'text',                        true,  false),
    (27, 'system_logs',           'category',              '0000', false, true,  'text',                        true,  false),
    (28, 'login_attempts',        'id',                    '0000', false, true,  'text',                        true,  false),
    (29, 'login_attempts',        'user_id',               '0000', false, true,  'text',                        false, false),
    (30, 'login_attempts',        'status',                '0000', false, true,  'text',                        true,  false),
    (31, 'access_profiles',       'id',                    '0000', false, true,  'text',                        true,  false),
    (32, 'access_profiles',       'is_system_default',     '0000', false, true,  'boolean',                     false, false),
    (33, 'users',                 'force_password_change', '0002', true,  true,  'boolean',                     false, false),
    (34, 'users',                 'password_hash',         '0002', true,  false, 'text',                        false, false),
    (35, 'revoked_sessions',      'id',                    '0002', true,  true,  'integer',                     true,  true),
    (36, 'revoked_sessions',      'type',                  '0002', true,  true,  'text',                        true,  false),
    (37, 'revoked_sessions',      'identifier',            '0002', true,  false, 'text',                        true,  false),
    (38, 'revoked_sessions',      'revoked_at',            '0002', true,  false, 'timestamp without time zone', true,  false),
    (39, 'revoked_sessions',      'expires_at',            '0002', true,  true,  'timestamp without time zone', false, false),
    (40, 'password_reset_tokens', 'id',                    '0003', true,  true,  'integer',                     true,  true),
    (41, 'password_reset_tokens', 'token_hash',            '0003', true,  false, 'text',                        true,  false),
    (42, 'password_reset_tokens', 'user_id',               '0003', true,  true,  'text',                        true,  false),
    (43, 'password_reset_tokens', 'document',              '0003', true,  false, 'text',                        false, false),
    (44, 'password_reset_tokens', 'purpose',               '0003', true,  true,  'text',                        true,  false),
    (45, 'password_reset_tokens', 'expires_at',            '0003', true,  true,  'timestamp without time zone', true,  false),
    (46, 'password_reset_tokens', 'used_at',               '0003', true,  true,  'timestamp without time zone', false, false),
    (47, 'password_reset_tokens', 'created_at',            '0003', true,  false, 'timestamp without time zone', true,  false)
),
evaluated AS (
  SELECT
    ec.*,
    (c.oid IS NOT NULL) AS table_exists,
    (a.attnum IS NOT NULL) AS column_exists,
    (format_type(a.atttypid, a.atttypmod) = ec.expected_pg_type) AS type_ok,
    (a.attnotnull = ec.expected_not_null) AS nullability_ok,
    CASE
      WHEN NOT ec.expects_serial_sequence THEN true
      WHEN c.oid IS NULL OR a.attnum IS NULL THEN false
      ELSE (
        format_type(a.atttypid, a.atttypmod) = 'integer'
        AND a.attnotnull IS TRUE
        AND a.attidentity = ''
        AND a.atthasdef IS TRUE
        AND ad.oid IS NOT NULL
        AND pg_get_expr(ad.adbin, ad.adrelid) ~ '^(pg_catalog\.)?nextval\(''([^'']|'''')*''::(pg_catalog\.)?regclass\)$'
        AND owned_seq.owned_seq_count = 1
        AND pg_get_serial_sequence(quote_ident(n.nspname) || '.' || quote_ident(c.relname), a.attname) IS NOT NULL
        AND def_dep.default_seq_dep_count = 1
        AND def_dep.default_seq_oid = owned_seq.owned_seq_oid
        AND owned_seq.owned_seq_is_int4 IS TRUE
      )
    END AS serial_ok
  FROM expected_columns ec
  LEFT JOIN pg_namespace n
    ON n.nspname = 'public'
  LEFT JOIN pg_class c
    ON c.relnamespace = n.oid
   AND c.relname = ec.table_name
   AND c.relkind IN ('r', 'p')
  LEFT JOIN pg_attribute a
    ON a.attrelid = c.oid
   AND a.attname = ec.column_name
   AND a.attnum > 0
   AND NOT a.attisdropped
  LEFT JOIN pg_attrdef ad
    ON ad.adrelid = c.oid
   AND ad.adnum = a.attnum
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*)::integer AS owned_seq_count,
      CASE WHEN COUNT(*) = 1 THEN MIN(seq.oid::bigint)::oid ELSE NULL END AS owned_seq_oid,
      BOOL_AND(sq.seqtypid = 'pg_catalog.int4'::regtype) AS owned_seq_is_int4
    FROM pg_depend d
    JOIN pg_class seq
      ON seq.oid = d.objid
     AND d.classid = 'pg_class'::regclass
     AND seq.relkind = 'S'
    JOIN pg_sequence sq
      ON sq.seqrelid = seq.oid
    WHERE d.refclassid = 'pg_class'::regclass
      AND d.refobjid = c.oid
      AND d.refobjsubid = a.attnum
      AND d.deptype = 'a'
  ) owned_seq ON (c.oid IS NOT NULL AND a.attnum IS NOT NULL)
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*)::integer AS default_seq_dep_count,
      CASE WHEN COUNT(*) = 1 THEN MIN(seq2.oid::bigint)::oid ELSE NULL END AS default_seq_oid
    FROM pg_depend d2
    JOIN pg_class seq2
      ON seq2.oid = d2.refobjid
     AND d2.refclassid = 'pg_class'::regclass
     AND seq2.relkind = 'S'
    WHERE d2.classid = 'pg_attrdef'::regclass
      AND d2.objid = ad.oid
      AND d2.deptype = 'n'
  ) def_dep ON (ad.oid IS NOT NULL)
)
SELECT
  origin_migration,
  COUNT(*)::integer AS total_columns,
  COUNT(*) FILTER (WHERE in_subfase_1_2a_grant)::integer AS cols_in_subfase_1_2a,
  COUNT(*) FILTER (WHERE NOT in_subfase_1_2a_grant)::integer AS cols_structural_only,
  COUNT(*) FILTER (WHERE table_exists AND column_exists AND type_ok AND nullability_ok AND serial_ok)::integer AS passed_all_checks,
  COUNT(*) FILTER (WHERE NOT table_exists OR NOT column_exists)::integer AS missing_or_unconfirmed,
  COUNT(*) FILTER (WHERE table_exists AND column_exists AND NOT type_ok)::integer AS type_mismatch_count,
  COUNT(*) FILTER (WHERE table_exists AND column_exists AND NOT nullability_ok)::integer AS nullability_mismatch_count,
  COUNT(*) FILTER (WHERE expects_serial_sequence AND table_exists AND column_exists AND NOT serial_ok)::integer AS serial_failure_count,
  CASE
    WHEN COUNT(*) FILTER (WHERE NOT (table_exists AND column_exists AND type_ok AND nullability_ok AND serial_ok)) > 0
      THEN 'STOP'
    WHEN origin_migration IN ('0002', '0003')
      THEN 'CONDICIONAL A PROVA DA MIGRATION'
    ELSE 'PASS'
  END AS group_gate_status
FROM evaluated
GROUP BY origin_migration
ORDER BY origin_migration;

-- ----------------------------------------------------------------------------
-- CONSULTA 6: Row-Level Security (RLS) e Politicas nas 10 Tabelas
-- ----------------------------------------------------------------------------
WITH expected_tables(ord, table_name) AS (
  VALUES
    ( 1, 'users'),
    ( 2, 'usuarios'),
    ( 3, 'professionals'),
    ( 4, 'service_orders'),
    ( 5, 'service_categories'),
    ( 6, 'system_logs'),
    ( 7, 'login_attempts'),
    ( 8, 'access_profiles'),
    ( 9, 'revoked_sessions'),
    (10, 'password_reset_tokens')
)
SELECT
  et.ord,
  et.table_name,
  (c.oid IS NOT NULL) AS table_exists,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced,
  COUNT(p.oid)::integer AS policy_count
FROM expected_tables et
LEFT JOIN pg_namespace n
  ON n.nspname = 'public'
LEFT JOIN pg_class c
  ON c.relnamespace = n.oid
 AND c.relname = et.table_name
 AND c.relkind IN ('r', 'p')
LEFT JOIN pg_policy p
  ON p.polrelid = c.oid
GROUP BY et.ord, et.table_name, c.oid, c.relrowsecurity, c.relforcerowsecurity
ORDER BY et.ord;

-- ----------------------------------------------------------------------------
-- CONSULTA 7a: Pre-existencia das Roles de Auditoria (PRODUCAO)
-- ----------------------------------------------------------------------------
WITH expected_roles(role_name) AS (
  VALUES
    ('s1_audit_ro_prod'),
    ('s1_audit_view_owner_prod')
)
SELECT
  er.role_name,
  (r.oid IS NOT NULL) AS role_already_exists,
  r.rolcanlogin,
  r.rolsuper,
  r.rolcreaterole,
  r.rolbypassrls,
  CASE WHEN r.oid IS NOT NULL THEN 'STOP - ROLE JA EXISTE' ELSE 'OK - LIVRE' END AS role_gate_status
FROM expected_roles er
LEFT JOIN pg_roles r ON r.rolname = er.role_name
ORDER BY er.role_name;

-- ----------------------------------------------------------------------------
-- CONSULTA 7b: Pre-existencia do Schema audit_ro
-- ----------------------------------------------------------------------------
SELECT
  'audit_ro'::text AS schema_name,
  (n.oid IS NOT NULL) AS schema_already_exists,
  pg_get_userbyid(n.nspowner) AS current_owner,
  CASE WHEN n.oid IS NOT NULL THEN 'STOP - SCHEMA audit_ro JA EXISTE' ELSE 'OK - LIVRE' END AS schema_gate_status
FROM (SELECT 1) s
LEFT JOIN pg_namespace n ON n.nspname = 'audit_ro';

-- ----------------------------------------------------------------------------
-- CONSULTA 8a: Privilegios de PUBLIC no Banco Atual e no Schema public
-- ----------------------------------------------------------------------------
SELECT
  current_database() AS database_name,
  has_database_privilege('PUBLIC', current_database(), 'CONNECT') AS db_public_connect,
  has_database_privilege('PUBLIC', current_database(), 'TEMP') AS db_public_temp,
  has_database_privilege('PUBLIC', current_database(), 'CREATE') AS db_public_create,
  has_schema_privilege('PUBLIC', 'public', 'USAGE') AS schema_public_usage,
  has_schema_privilege('PUBLIC', 'public', 'CREATE') AS schema_public_create;

-- ----------------------------------------------------------------------------
-- CONSULTA 8b: Funcoes SECURITY DEFINER Nao-Sistema e pg_default_acl
-- ----------------------------------------------------------------------------
SELECT
  'SECURITY_DEFINER_PROC'::text AS artifact_kind,
  n.nspname AS schema_name,
  p.proname AS object_name,
  pg_get_userbyid(p.proowner) AS owner_name,
  p.prosecdef AS is_security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND n.nspname NOT LIKE 'pg_toast%'
  AND p.prosecdef IS TRUE
UNION ALL
SELECT
  'DEFAULT_ACL'::text AS artifact_kind,
  COALESCE(n.nspname, '<ALL_SCHEMAS>') AS schema_name,
  d.defaclobjtype::text AS object_name,
  pg_get_userbyid(d.defaclrole) AS owner_name,
  NULL::boolean AS is_security_definer
FROM pg_default_acl d
LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
ORDER BY artifact_kind, schema_name, object_name;

-- ----------------------------------------------------------------------------
-- CONSULTA 8c: Extensoes Instaladas (pg_extension)
-- ----------------------------------------------------------------------------
SELECT
  e.extname AS extension_name,
  e.extversion AS extension_version,
  n.nspname AS extension_schema,
  pg_get_userbyid(e.extowner) AS extension_owner
FROM pg_extension e
JOIN pg_namespace n ON n.oid = e.extnamespace
ORDER BY e.extname;

ROLLBACK;
