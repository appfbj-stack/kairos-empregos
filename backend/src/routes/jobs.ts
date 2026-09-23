import { Router } from 'express';
import { z } from 'zod';
import { and, eq, desc } from 'drizzle-orm';
import { db } from '../db/client.js';
import { jobs, companies, candidates, auditLogs } from '../db/schema.js';
import { requireAuth, requireRole, tenantId } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { slugify, uniqueSlug } from '../lib/slug.js';
import { matchCandidateToJob } from '../lib/ai.js';

const router = Router();

const createSchema = z.object({
  companyId: z.string().uuid('Empresa inválida'),
  title: z.string().min(1, 'Título obrigatório'),
  description: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().length(2).optional().nullable(),
  salary: z.union([z.number(), z.string()]).optional().nullable(),
  contractType: z.enum(['CLT', 'PJ', 'TEMPORARIO', 'ESTAGIO', 'FREELA']).optional().nullable(),
  modality: z.enum(['PRESENCIAL', 'REMOTO', 'HIBRIDO']).optional().nullable(),
  schedule: z.string().optional().nullable(),
  requirements: z.string().optional().nullable(),
  benefits: z.string().optional().nullable(),
  vacancies: z.number().int().positive().optional().default(1),
  deadlineAt: z.string().date().optional().nullable(),
  status: z.enum(['RASCUNHO', 'PUBLICADA', 'PAUSADA', 'ENCERRADA']).optional(),
});

const updateSchema = createSchema.partial();

router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const tid = tenantId(req);
    const status = req.query.status as string | undefined;
    let whereClause: any = eq(jobs.agencyId, tid);
    if (status) {
      const { and: andOp } = await import('drizzle-orm');
      whereClause = andOp(eq(jobs.agencyId, tid), eq(jobs.status, status as any));
    }
    const rows = await db
      .select({
        id: jobs.id,
        slug: jobs.slug,
        title: jobs.title,
        city: jobs.city,
        state: jobs.state,
        contractType: jobs.contractType,
        modality: jobs.modality,
        salary: jobs.salary,
        vacancies: jobs.vacancies,
        status: jobs.status,
        deadlineAt: jobs.deadlineAt,
        publishedAt: jobs.publishedAt,
        companyId: jobs.companyId,
        companyName: companies.tradeName,
        companyLegalName: companies.legalName,
        createdAt: jobs.createdAt,
      })
      .from(jobs)
      .leftJoin(companies, eq(jobs.companyId, companies.id))
      .where(whereClause)
      .orderBy(desc(jobs.createdAt));
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const tid = tenantId(req);
    const rows = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, req.params.id as string), eq(jobs.agencyId, tid)))
      .limit(1);
    if (!rows[0]) throw new HttpError(404, 'NOT_FOUND', 'Vaga não encontrada');
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRole('ADMIN', 'RECRUITER'), async (req, res, next) => {
  try {
    const tid = tenantId(req);
    const data = createSchema.parse(req.body);

    // Garante que a empresa pertence ao mesmo tenant
    const company = await db
      .select()
      .from(companies)
      .where(and(eq(companies.id, data.companyId), eq(companies.agencyId, tid)))
      .limit(1);
    if (!company[0]) {
      throw new HttpError(400, 'INVALID_COMPANY', 'Empresa não pertence a esta agência');
    }

    // Slug único por agency
    const slug = await uniqueSlug(
      `${data.title} ${company[0].tradeName || company[0].legalName} ${data.city || ''}`.trim(),
      async (candidate) => {
        const found = await db
          .select({ id: jobs.id })
          .from(jobs)
          .where(and(eq(jobs.agencyId, tid), eq(jobs.slug, candidate)))
          .limit(1);
        return found.length > 0;
      }
    );

    const [created] = await db
      .insert(jobs)
      .values({
        agencyId: tid,
        companyId: data.companyId,
        slug,
        title: data.title,
        description: data.description ?? null,
        city: data.city ?? null,
        state: data.state ?? null,
        salary: data.salary != null ? String(data.salary) : null,
        contractType: data.contractType ?? null,
        modality: data.modality ?? null,
        schedule: data.schedule ?? null,
        requirements: data.requirements ?? null,
        benefits: data.benefits ?? null,
        vacancies: data.vacancies ?? 1,
        deadlineAt: data.deadlineAt ?? null,
        status: data.status ?? 'RASCUNHO',
        publishedAt: data.status === 'PUBLICADA' ? new Date() : null,
      })
      .returning();

    await db.insert(auditLogs).values({
      agencyId: tid,
      userId: req.auth!.user.id,
      action: 'job.create',
      resource: 'job',
      resourceId: created.id,
      ip: req.ip,
    });

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireRole('ADMIN', 'RECRUITER'), async (req, res, next) => {
  try {
    const tid = tenantId(req);
    const data = updateSchema.parse(req.body);

    const existing = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, req.params.id as string), eq(jobs.agencyId, tid)))
      .limit(1);
    if (!existing[0]) throw new HttpError(404, 'NOT_FOUND', 'Vaga não encontrada');

    // Se mudou pra PUBLICADA pela primeira vez, seta publishedAt
    let publishedAt = existing[0].publishedAt;
    if (data.status === 'PUBLICADA' && !existing[0].publishedAt) {
      publishedAt = new Date();
    }

    const [updated] = await db
      .update(jobs)
      .set({
        title: data.title ?? existing[0].title,
        description: data.description ?? existing[0].description,
        city: data.city ?? existing[0].city,
        state: data.state ?? existing[0].state,
        salary: data.salary != null ? String(data.salary) : existing[0].salary,
        contractType: data.contractType ?? existing[0].contractType,
        modality: data.modality ?? existing[0].modality,
        schedule: data.schedule ?? existing[0].schedule,
        requirements: data.requirements ?? existing[0].requirements,
        benefits: data.benefits ?? existing[0].benefits,
        vacancies: data.vacancies ?? existing[0].vacancies,
        deadlineAt: data.deadlineAt ?? existing[0].deadlineAt,
        status: data.status ?? existing[0].status,
        publishedAt,
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, req.params.id as string))
      .returning();

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const tid = tenantId(req);
    const deleted = await db
      .delete(jobs)
      .where(and(eq(jobs.id, req.params.id as string), eq(jobs.agencyId, tid)))
      .returning();
    if (!deleted[0]) throw new HttpError(404, 'NOT_FOUND', 'Vaga não encontrada');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Fase 8 — Matching candidato × vaga
router.post('/:jobId/match/:candidateId', async (req, res, next) => {
  try {
    const tid = tenantId(req);
    const jobId = req.params.jobId as string;
    const candidateId = req.params.candidateId as string;

    // Validação multi-tenant de vaga
    const job = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, jobId), eq(jobs.agencyId, tid)))
      .limit(1);
    if (!job[0]) throw new HttpError(404, 'NOT_FOUND', 'Vaga não encontrada');

    // Validação multi-tenant de candidato
    const cand = await db
      .select()
      .from(candidates)
      .where(and(eq(candidates.id, candidateId), eq(candidates.agencyId, tid)))
      .limit(1);
    if (!cand[0]) throw new HttpError(404, 'NOT_FOUND', 'Candidato não encontrado');

    const aiData = cand[0].aiData ? JSON.parse(cand[0].aiData) : null;

    const result = await matchCandidateToJob({
      job: {
        title: job[0].title,
        description: job[0].description,
        requirements: job[0].requirements,
        benefits: job[0].benefits,
        contractType: job[0].contractType,
        modality: job[0].modality,
        schedule: job[0].schedule,
        city: job[0].city,
        state: job[0].state,
      },
      candidate: {
        fullName: cand[0].fullName,
        email: cand[0].email,
        phone: cand[0].phone,
        city: cand[0].city,
        state: cand[0].state,
        desiredRole: cand[0].desiredRole,
        experience: cand[0].experience,
        education: cand[0].education,
        skills: cand[0].tags,
        availability: cand[0].availability,
        cnh: cand[0].cnh,
        aiData,
      },
    });

    // Audit log
    await db.insert(auditLogs).values({
      agencyId: tid,
      userId: req.auth!.user.id,
      action: 'job.match',
      resource: 'job',
      resourceId: jobId,
      metadata: JSON.stringify({ candidateId, match: result.match, score: result.score }),
      ip: req.ip,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;