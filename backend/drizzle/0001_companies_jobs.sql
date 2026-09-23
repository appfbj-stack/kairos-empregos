CREATE TYPE "public"."company_status" AS ENUM('ATIVA', 'INATIVA', 'SUSPENSA');--> statement-breakpoint
CREATE TYPE "public"."job_contract_type" AS ENUM('CLT', 'PJ', 'TEMPORARIO', 'ESTAGIO', 'FREELA');--> statement-breakpoint
CREATE TYPE "public"."job_modality" AS ENUM('PRESENCIAL', 'REMOTO', 'HIBRIDO');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('RASCUNHO', 'PUBLICADA', 'PAUSADA', 'ENCERRADA');--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"legal_name" text NOT NULL,
	"trade_name" text,
	"cnpj" varchar(18),
	"contact_name" text,
	"phone" varchar(20),
	"whatsapp" varchar(20),
	"email" varchar(255),
	"address" text,
	"city" varchar(100),
	"state" varchar(2),
	"notes" text,
	"status" "company_status" DEFAULT 'ATIVA' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"slug" varchar(255) NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"city" varchar(100),
	"state" varchar(2),
	"salary" numeric(12, 2),
	"contract_type" "job_contract_type",
	"modality" "job_modality",
	"schedule" text,
	"requirements" text,
	"benefits" text,
	"vacancies" integer DEFAULT 1 NOT NULL,
	"published_at" timestamp with time zone,
	"deadline_at" date,
	"status" "job_status" DEFAULT 'RASCUNHO' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "companies_agency_idx" ON "companies" USING btree ("agency_id");--> statement-breakpoint
CREATE INDEX "companies_cnpj_idx" ON "companies" USING btree ("cnpj");--> statement-breakpoint
CREATE INDEX "companies_status_idx" ON "companies" USING btree ("status");--> statement-breakpoint
CREATE INDEX "jobs_agency_idx" ON "jobs" USING btree ("agency_id");--> statement-breakpoint
CREATE INDEX "jobs_company_idx" ON "jobs" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "jobs_status_idx" ON "jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "jobs_slug_idx" ON "jobs" USING btree ("slug");