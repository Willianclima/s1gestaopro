-- ============================================================================
-- Migração 0003: Tabela de Tokens de Ativação e Redefinição Segura de Senha
-- ============================================================================

CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"user_id" text NOT NULL,
	"document" text,
	"purpose" text DEFAULT 'activation' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_pwd_reset_token_hash" ON "password_reset_tokens" USING btree ("token_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_pwd_reset_user_id" ON "password_reset_tokens" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_pwd_reset_expires_at" ON "password_reset_tokens" USING btree ("expires_at");
