/**
 * Endpoints PÚBLICOS (sem auth) — leitura + candidatura.
 * Apenas leitura ou POST de candidatura (com rate-limit preparado pra fase futura).
 * Não vaza dados entre tenants.
 */
import { Router } from 'express';
import { z } from 'zod';
import { and, eq, or } from 'drizzle-orm';
import { db } from '../db/client.js';
import { jobs, companies, agencies, candidates, applications } from '../db/schema.js';
import { HttpError } from '../middleware/errors.js';
import { storage } from '../lib/storage.js';
import { logger } from '../lib/logger.js';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const router = Router();

const MAX_PDF_BYTES = 5 * 1024 * 1024; // 5MB

router.get('/agencies/:agencySlug/jobs/:jobSlug', async (req, res, next) => {
  try {
    const { agencySlug, jobSlug } = req.params;
    const agency = await db
      .select()
      .from(agencies)
      .where(eq(agencies.slug, agencySlug))
      .limit(1);
    if (!agency[0]) throw new HttpError(404, 'NOT_FOUND', 'Agência não encontrada');
    if (agency[0].status !== 'ATIVA' && agency[0].status !== 'TESTE') {
      throw new HttpError(403, 'AGENCY_BLOCKED', 'Agência indisponível');
    }
    const rows = await db
      .select({
        id: jobs.id,
        slug: jobs.slug,
        title: jobs.title,
        description: jobs.description,
        city: jobs.city,
        state: jobs.state,
        salary: jobs.salary,
        contractType: jobs.contractType,
        modality: jobs.modality,
        schedule: jobs.schedule,
        requirements: jobs.requirements,
        benefits: jobs.benefits,
        vacancies: jobs.vacancies,
        publishedAt: jobs.publishedAt,
        deadlineAt: jobs.deadlineAt,
        company: { id: companies.id, tradeName: companies.tradeName, legalName: companies.legalName },
      })
      .from(jobs)
      .innerJoin(companies, eq(jobs.companyId, companies.id))
      .where(and(eq(jobs.agencyId, agency[0].id), eq(jobs.slug, jobSlug), eq(jobs.status, 'PUBLICADA')))
      .limit(1);
    if (!rows[0]) throw new HttpError(404, 'NOT_FOUND', 'Vaga não encontrada ou não publicada');
    res.json({
      job: rows[0],
      agency: {
        name: agency[0].name, slug: agency[0].slug, primaryColor: agency[0].primaryColor,
        logoUrl: agency[0].logoUrl, phone: agency[0].phone, whatsapp: agency[0].whatsapp,
        email: agency[0].email, city: agency[0].city, state: agency[0].state,
        description: agency[0].description, confirmationMessage: agency[0].confirmationMessage,
      },
    });
  } catch (err) { next(err); }
});

router.get('/agencies/:agencySlug/jobs', async (req, res, next) => {
  try {
    const { agencySlug } = req.params;
    const { city, contractType } = req.query;
    const agency = await db
      .select({ id: agencies.id, name: agencies.name, slug: agencies.slug, primaryColor: agencies.primaryColor, logoUrl: agencies.logoUrl, status: agencies.status })
      .from(agencies).where(eq(agencies.slug, agencySlug)).limit(1);
    if (!agency[0]) throw new HttpError(404, 'NOT_FOUND', 'Agência não encontrada');
    if (agency[0].status !== 'ATIVA' && agency[0].status !== 'TESTE') {
      throw new HttpError(403, 'AGENCY_BLOCKED', 'Agência indisponível');
    }
    const filters: any[] = [eq(jobs.agencyId, agency[0].id), eq(jobs.status, 'PUBLICADA')];
    if (city) filters.push(eq(jobs.city, String(city)));
    if (contractType) filters.push(eq(jobs.contractType, contractType as any));
    const rows = await db
      .select({
        id: jobs.id, slug: jobs.slug, title: jobs.title, city: jobs.city, state: jobs.state,
        contractType: jobs.contractType, modality: jobs.modality, salary: jobs.salary,
        publishedAt: jobs.publishedAt, deadlineAt: jobs.deadlineAt,
      })
      .from(jobs)
      .where(and(...filters))
      .orderBy(jobs.publishedAt);
    res.json({ agency: agency[0], jobs: rows });
  } catch (err) { next(err); }
});

/**
 * POST /api/public/agencies/:agencySlug/jobs/:jobSlug/apply
 * Candidatura pública. Não exige auth.
 *
 * Body JSON (multipart-like via JSON base64 pra simplificar):
 * { fullName, email?, phone, cpf?, city?, state?, birthDate?, education?, experience?,
 *   desiredRole?, salaryExpectation?, availability?, cnh?, notes?,
 *   resumeBase64?, resumeFilename? }
 *
 * Auto-detecta candidato existente por telefone OU email (na mesma agency).
 */
const applySchema = z.object({
  fullName: z.string().min(2, 'Nome completo obrigatório'),
  email: z.string().email().optional().nullable().or(z.literal('')),
  phone: z.string().min(8, 'Telefone obrigatório'),
  cpf: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().length(2).optional().nullable(),
  birthDate: z.string().date().optional().nullable(),
  education: z.string().optional().nullable(),
  experience: z.string().optional().nullable(),
  desiredRole: z.string().optional().nullable(),
  salaryExpectation: z.union([z.number(), z.string()]).optional().nullable(),
  availability: z.string().optional().nullable(),
  cnh: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  resumeBase64: z.string().optional().nullable(),
  resumeFilename: z.string().optional().nullable(),
});

router.post('/agencies/:agencySlug/jobs/:jobSlug/apply', async (req, res, next) => {
  try {
    const { agencySlug, jobSlug } = req.params;
    const data = applySchema.parse(req.body);

    const agency = await db.select().from(agencies).where(eq(agencies.slug, agencySlug)).limit(1);
    if (!agency[0]) throw new HttpError(404, 'NOT_FOUND', 'Agência não encontrada');
    if (agency[0].status !== 'ATIVA' && agency[0].status !== 'TESTE') {
      throw new HttpError(403, 'AGENCY_BLOCKED', 'Agência indisponível');
    }

    const job = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.agencyId, agency[0].id), eq(jobs.slug, jobSlug), eq(jobs.status, 'PUBLICADA')))
      .limit(1);
    if (!job[0]) throw new HttpError(404, 'NOT_FOUND', 'Vaga não encontrada ou não publicada');

    // LGPD: consentimento presumido pelo ato de envio, mas Fase 9 pode exigir checkbox.

    // Auto-detecta candidato existente: phone OU email na mesma agency
    const phoneDigits = data.phone.replace(/\D/g, '');
    const filters = [eq(candidates.agencyId, agency[0].id)];
    const orClauses: any[] = [];
    if (data.phone) orClauses.push(eq(candidates.phone, phoneDigits));
    if (data.email) orClauses.push(eq(candidates.email, data.email.toLowerCase()));
    let existing: any[] = [];
    if (orClauses.length > 0) {
      existing = await db
        .select()
        .from(candidates)
        .where(and(...filters, or(...orClauses)))
        .limit(1);
    }

    // Valida currículo se enviado
    let resumeKey: string | null = null;
    let resumeFilename: string | null = null;
    if (data.resumeBase64 && data.resumeFilename) {
      const buf = Buffer.from(data.resumeBase64, 'base64');
      if (buf.length > MAX_PDF_BYTES) {
        throw new HttpError(413, 'RESUME_TOO_LARGE', `Currículo excede ${MAX_PDF_BYTES / 1024 / 1024}MB`);
      }
      // Validação simples: começa com %PDF-
      const header = buf.slice(0, 5).toString('ascii');
      if (header !== '%PDF-') {
        throw new HttpError(415, 'RESUME_NOT_PDF', 'Arquivo precisa ser um PDF válido');
      }
      resumeFilename = data.resumeFilename;
      resumeKey = `agencies/${agency[0].id}/candidates/${randomUUID()}.pdf`;
      await storage.save(resumeKey, buf);
    }

    let candidateId: string;
    let created = false;

    if (existing[0]) {
      // Atualiza dados básicos + currículo novo (se enviado)
      candidateId = existing[0].id;
      const updates: any = { updatedAt: new Date() };
      if (data.fullName) updates.fullName = data.fullName;
      if (data.email) updates.email = data.email.toLowerCase();
      if (data.phone) updates.phone = phoneDigits;
      if (data.cpf) updates.cpf = data.cpf;
      if (data.city) updates.city = data.city;
      if (data.state) updates.state = data.state;
      if (data.birthDate) updates.birthDate = data.birthDate;
      if (data.education) updates.education = data.education;
      if (data.experience) updates.experience = data.experience;
      if (data.desiredRole) updates.desiredRole = data.desiredRole;
      if (data.salaryExpectation != null) updates.salaryExpectation = String(data.salaryExpectation);
      if (data.availability) updates.availability = data.availability;
      if (data.cnh) updates.cnh = data.cnh;
      if (data.notes) updates.notes = data.notes;
      if (resumeKey) {
        updates.resumeKey = resumeKey;
        updates.resumeFilename = resumeFilename;
        updates.resumeUploadedAt = new Date();
      }
      await db.update(candidates).set(updates).where(eq(candidates.id, candidateId));
    } else {
      const [createdRow] = await db
        .insert(candidates)
        .values({
          agencyId: agency[0].id,
          fullName: data.fullName,
          email: data.email ? data.email.toLowerCase() : null,
          phone: phoneDigits,
          cpf: data.cpf || null,
          city: data.city || null,
          state: data.state || null,
          birthDate: data.birthDate || null,
          education: data.education || null,
          experience: data.experience || null,
          desiredRole: data.desiredRole || null,
          salaryExpectation: data.salaryExpectation != null ? String(data.salaryExpectation) : null,
          availability: data.availability || null,
          cnh: data.cnh || null,
          notes: data.notes || null,
          resumeKey,
          resumeFilename,
          resumeUploadedAt: resumeKey ? new Date() : null,
        })
        .returning();
      candidateId = createdRow.id;
      created = true;
    }

    // Verifica se já existe application pra essa vaga+candidato
    const existingApp = await db
      .select()
      .from(applications)
      .where(and(
        eq(applications.candidateId, candidateId),
        eq(applications.jobId, job[0].id),
        eq(applications.agencyId, agency[0].id),
      ))
      .limit(1);

    if (existingApp[0]) {
      logger.info({ candidateId, jobId: job[0].id }, 'Candidatura duplicada ignorada');
    } else {
      await db.insert(applications).values({
        agencyId: agency[0].id,
        candidateId,
        jobId: job[0].id,
        stage: 'NOVO',
      });
    }

    res.status(201).json({
      ok: true,
      candidateId,
      newCandidate: created,
      jobTitle: job[0].title,
      agencyName: agency[0].name,
      confirmationMessage: agency[0].confirmationMessage
        || 'Recebemos sua candidatura! Em breve entraremos em contato.',
    });
  } catch (err) { next(err); }
});

export default router;