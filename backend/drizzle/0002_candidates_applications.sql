CREATE TYPE "public"."application_stage" AS ENUM('NOVO', 'EM_ANALISE', 'PRE_SELECIONADO', 'ENTREVISTA', 'APROVADO', 'ENVIADO_EMPRESA', 'CONTRATADO', 'REPROVADO');--> statement-breakpoint
CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"stage" "application_stage" DEFAULT 'NOVO' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"email" varchar(255),
	"phone" varchar(20) NOT NULL,
	"cpf" varchar(14),
	"city" varchar(100),
	"state" varchar(2),
	"birth_date" date,
	"education" text,
	"experience" text,
	"desired_role" text,
	"salary_expectation" numeric(12, 2),
	"availability" text,
	"cnh" varchar(5),
	"notes" text,
	"tags" text,
	"resume_key" varchar(500),
	"resume_filename" varchar(255),
	"resume_uploaded_at" timestamp with time zone,
	"ai_extracted_at" timestamp with time zone,
	"ai_data" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "applications_agency_idx" ON "applications" USING btree ("agency_id");--> statement-breakpoint
CREATE INDEX "applications_candidate_idx" ON "applications" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "applications_job_idx" ON "applications" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "applications_stage_idx" ON "applications" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "candidates_agency_idx" ON "candidates" USING btree ("agency_id");--> statement-breakpoint
CREATE INDEX "candidates_email_idx" ON "candidates" USING btree ("email");--> statement-breakpoint
CREATE INDEX "candidates_phone_idx" ON "candidates" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "candidates_city_idx" ON "candidates" USING btree ("city");