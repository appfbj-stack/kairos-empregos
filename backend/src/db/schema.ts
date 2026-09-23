import {
  pgTable,
  serial,
  text,
  varchar,
  timestamp,
  uuid,
  boolean,
  pgEnum,
  index,
  integer,
  date,
  numeric,
} from 'drizzle-orm/pg-core';

// ===== ENUMS =====
export const userRoleEnum = pgEnum('user_role', ['ADMIN', 'RECRUITER', 'USER']);
export const agencyStatusEnum = pgEnum('agency_status', ['TESTE', 'ATIVA', 'BLOQUEADA', 'EXPIRADA']);
export const agencyPlanEnum = pgEnum('agency_plan', ['ESSENCIAL', 'PROFISSIONAL']);
export const companyStatusEnum = pgEnum('company_status', ['ATIVA', 'INATIVA', 'SUSPENSA']);
export const jobStatusEnum = pgEnum('job_status', ['RASCUNHO', 'PUBLICADA', 'PAUSADA', 'ENCERRADA']);
export const jobContractTypeEnum = pgEnum('job_contract_type', ['CLT', 'PJ', 'TEMPORARIO', 'ESTAGIO', 'FREELA']);
export const jobModalityEnum = pgEnum('job_modality', ['PRESENCIAL', 'REMOTO', 'HIBRIDO']);

// ===== AGENCIES (TENANTS) =====
export const agencies = pgTable(
  'agencies',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    slug: varchar('slug').notNull().unique(),
    plan: agencyPlanEnum('plan').notNull().default('ESSENCIAL'),
    status: agencyStatusEnum('status').notNull().default('TESTE'),
    licenseStart: timestamp('license_start', { withTimezone: true }),
    licenseEnd: timestamp('license_end', { withTimezone: true }),
    logoUrl: text('logo_url'),
    primaryColor: varchar('primary_color', { length: 7 }).default('#0F172A'),
    phone: varchar('phone', { length: 20 }),
    whatsapp: varchar('whatsapp', { length: 20 }),
    email: varchar('email', { length: 255 }),
    address: text('address'),
    city: varchar('city', { length: 100 }),
    state: varchar('state', { length: 2 }),
    description: text('description'),
    confirmationMessage: text('confirmation_message'),
    privacyPolicy: text('privacy_policy'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    slugIdx: index('agencies_slug_idx').on(t.slug),
    statusIdx: index('agencies_status_idx').on(t.status),
  })
);

// ===== USERS (vinculados a uma agency) =====
export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    agencyId: uuid('agency_id')
      .notNull()
      .references(() => agencies.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    passwordHash: text('password_hash').notNull(),
    role: userRoleEnum('role').notNull().default('RECRUITER'),
    isActive: boolean('is_active').notNull().default(true),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    emailIdx: index('users_email_idx').on(t.email),
    agencyIdx: index('users_agency_idx').on(t.agencyId),
  })
);

// ===== AUDIT LOGS =====
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: serial('id').primaryKey(),
    agencyId: uuid('agency_id').references(() => agencies.id, { onDelete: 'set null' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 100 }).notNull(),
    resource: varchar('resource', { length: 100 }),
    resourceId: varchar('resource_id', { length: 100 }),
    ip: varchar('ip', { length: 45 }),
    userAgent: text('user_agent'),
    metadata: text('metadata'), // JSON string
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    agencyIdx: index('audit_agency_idx').on(t.agencyId),
    actionIdx: index('audit_action_idx').on(t.action),
    createdIdx: index('audit_created_idx').on(t.createdAt),
  })
);

// Tipos TS
export type Agency = typeof agencies.$inferSelect;
export type NewAgency = typeof agencies.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;

// ===== COMPANIES (FK agency) =====
export const companies = pgTable(
  'companies',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    agencyId: uuid('agency_id')
      .notNull()
      .references(() => agencies.id, { onDelete: 'cascade' }),
    legalName: text('legal_name').notNull(), // razão social
    tradeName: text('trade_name'), // nome fantasia
    cnpj: varchar('cnpj', { length: 18 }),
    contactName: text('contact_name'), // responsável
    phone: varchar('phone', { length: 20 }),
    whatsapp: varchar('whatsapp', { length: 20 }),
    email: varchar('email', { length: 255 }),
    address: text('address'),
    city: varchar('city', { length: 100 }),
    state: varchar('state', { length: 2 }),
    notes: text('notes'),
    status: companyStatusEnum('status').notNull().default('ATIVA'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    agencyIdx: index('companies_agency_idx').on(t.agencyId),
    cnpjIdx: index('companies_cnpj_idx').on(t.cnpj),
    statusIdx: index('companies_status_idx').on(t.status),
  })
);

// ===== JOBS (FK agency + company) =====
export const jobs = pgTable(
  'jobs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    agencyId: uuid('agency_id')
      .notNull()
      .references(() => agencies.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'restrict' }),
    slug: varchar('slug', { length: 255 }).notNull(),
    title: text('title').notNull(),
    description: text('description'),
    city: varchar('city', { length: 100 }),
    state: varchar('state', { length: 2 }),
    salary: numeric('salary', { precision: 12, scale: 2 }),
    contractType: jobContractTypeEnum('contract_type'),
    modality: jobModalityEnum('modality'),
    schedule: text('schedule'), // horário
    requirements: text('requirements'),
    benefits: text('benefits'),
    vacancies: integer('vacancies').notNull().default(1),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    deadlineAt: date('deadline_at'),
    status: jobStatusEnum('status').notNull().default('RASCUNHO'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    agencyIdx: index('jobs_agency_idx').on(t.agencyId),
    companyIdx: index('jobs_company_idx').on(t.companyId),
    statusIdx: index('jobs_status_idx').on(t.status),
    slugIdx: index('jobs_slug_idx').on(t.slug),
  })
);

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;

// ===== CANDIDATES (banco de talentos, FK agency) =====
export const candidates = pgTable(
  'candidates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    agencyId: uuid('agency_id')
      .notNull()
      .references(() => agencies.id, { onDelete: 'cascade' }),
    fullName: text('full_name').notNull(),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 20 }).notNull(),
    cpf: varchar('cpf', { length: 14 }),
    city: varchar('city', { length: 100 }),
    state: varchar('state', { length: 2 }),
    birthDate: date('birth_date'),
    education: text('education'),
    experience: text('experience'),
    desiredRole: text('desired_role'),
    salaryExpectation: numeric('salary_expectation', { precision: 12, scale: 2 }),
    availability: text('availability'),
    cnh: varchar('cnh', { length: 5 }),
    notes: text('notes'),
    tags: text('tags'), // CSV simples por enquanto
    resumeKey: varchar('resume_key', { length: 500 }), // path no storage abstrato
    resumeFilename: varchar('resume_filename', { length: 255 }),
    resumeUploadedAt: timestamp('resume_uploaded_at', { withTimezone: true }),
    aiExtractedAt: timestamp('ai_extracted_at', { withTimezone: true }), // Fase 7
    aiData: text('ai_data'), // JSON extraído pela IA — Fase 7
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    agencyIdx: index('candidates_agency_idx').on(t.agencyId),
    emailIdx: index('candidates_email_idx').on(t.email),
    phoneIdx: index('candidates_phone_idx').on(t.phone),
    cityIdx: index('candidates_city_idx').on(t.city),
  })
);

// ===== APPLICATIONS (FK candidate + job) =====
export const applicationStageEnum = pgEnum('application_stage', [
  'NOVO',
  'EM_ANALISE',
  'PRE_SELECIONADO',
  'ENTREVISTA',
  'APROVADO',
  'ENVIADO_EMPRESA',
  'CONTRATADO',
  'REPROVADO',
]);

export const applications = pgTable(
  'applications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    agencyId: uuid('agency_id')
      .notNull()
      .references(() => agencies.id, { onDelete: 'cascade' }),
    candidateId: uuid('candidate_id')
      .notNull()
      .references(() => candidates.id, { onDelete: 'cascade' }),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    stage: applicationStageEnum('stage').notNull().default('NOVO'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    agencyIdx: index('applications_agency_idx').on(t.agencyId),
    candidateIdx: index('applications_candidate_idx').on(t.candidateId),
    jobIdx: index('applications_job_idx').on(t.jobId),
    stageIdx: index('applications_stage_idx').on(t.stage),
  })
);

export type Candidate = typeof candidates.$inferSelect;
export type NewCandidate = typeof candidates.$inferInsert;
export type Application = typeof applications.$inferSelect;
export type NewApplication = typeof applications.$inferInsert;

// ===== SUPER ADMINS (dono da plataforma) =====
export const superAdmins = pgTable('super_admins', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type SuperAdmin = typeof superAdmins.$inferSelect;
export type NewSuperAdmin = typeof superAdmins.$inferInsert;