-- ============================================================================
-- Migração 0002: Sessões Revogáveis, Credenciais e Integridade de Vínculos OS
-- ============================================================================

-- 1. Criação da tabela de revogações persistentes de sessão
CREATE TABLE IF NOT EXISTS "revoked_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"identifier" text NOT NULL,
	"revoked_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "revoked_sessions_lookup_idx" ON "revoked_sessions" USING btree ("type", "identifier");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "revoked_sessions_expires_idx" ON "revoked_sessions" USING btree ("expires_at");
--> statement-breakpoint

-- 2. Adição de campos para credenciais na tabela users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "force_password_change" boolean DEFAULT false;
--> statement-breakpoint

-- 3. Blindagem de integridade referencial: Foreign key RESTRICT entre service_orders e usuarios
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'service_orders_client_id_usuarios_id_fk'
      AND table_name = 'service_orders'
  ) THEN
    ALTER TABLE "service_orders" 
    ADD CONSTRAINT "service_orders_client_id_usuarios_id_fk" 
    FOREIGN KEY ("client_id") REFERENCES "usuarios"("id") 
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
