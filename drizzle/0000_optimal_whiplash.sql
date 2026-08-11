CREATE TABLE "access_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color" text,
	"is_system_default" boolean DEFAULT false,
	"permissions" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"document" text,
	"phone" text,
	"email" text,
	"address" text,
	"lat" double precision,
	"lng" double precision,
	"formatted_address" text,
	"is_address_validated" boolean DEFAULT false,
	"notes" text,
	"user_type" text,
	"status" text DEFAULT 'ativo',
	"data" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"timestamp" text NOT NULL,
	"username" text NOT NULL,
	"user_id" text,
	"status" text NOT NULL,
	"user_type" text,
	"details" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "professionals" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"document" text,
	"email" text,
	"role" text,
	"specialty" text,
	"specialties" jsonb,
	"user_type" text DEFAULT 'profissional',
	"failed_attempts" integer DEFAULT 0,
	"blocked" boolean DEFAULT false,
	"work_location" text,
	"google_uid" text,
	"data" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "service_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#3b82f6' NOT NULL,
	"sla_hours" integer DEFAULT 24,
	"reminder_interval_hours" integer DEFAULT 4,
	"reminder_enabled" boolean DEFAULT true,
	"notify_gestor" boolean DEFAULT true,
	"notify_technician" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "service_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text,
	"title" text NOT NULL,
	"description" text,
	"category" text,
	"status" text DEFAULT 'aberto' NOT NULL,
	"priority" text DEFAULT 'medium',
	"assigned_to" text,
	"start_date" text,
	"end_date" text,
	"notes" text,
	"location" text,
	"lat" double precision,
	"lng" double precision,
	"history" jsonb,
	"images" jsonb,
	"completed_images" jsonb,
	"unread_by_client" boolean DEFAULT false,
	"unread_by_professional" boolean DEFAULT false,
	"has_missing_material" boolean DEFAULT false,
	"missing_material_description" text,
	"data" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "system_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"timestamp" text NOT NULL,
	"action" text NOT NULL,
	"details" text,
	"category" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"uid" text NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"document" text,
	"user_type" text,
	"status" text DEFAULT 'ativo',
	"warehouse_id" text,
	"work_location" text,
	"google_uid" text,
	"data" jsonb,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_uid_unique" UNIQUE("uid")
);
