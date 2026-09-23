import { Router } from 'express';
import { z } from 'zod';
import { and, eq, desc, ilike, or, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { candidates, applications, jobs, companies } from '../db/schema.js';
import { requireAuth, requireRole, tenantId } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';

const router = Router();

router.use(requireAuth);

// Listar banco de talentos (com busca)
router.get('/', async (req, res, next) => {
  try {
    const tid = tenantId(req);
    const { q, city, status } = req.query;

    const where: any[] = [eq(candidates.agencyId, tid)];
    if (q) {
      const term = `%${String(q)}%`;
      where.push(or(
        ilike(candidates.fullName, term),
        ilike(candidates.email, term),
        ilike(candidates.phone, term),
        ilike(candidates.desiredRole, term),
      ));
    }
    if (city) where.push(ilike(candidates.city, `%${String(city)}%`));

    const rows = await db
      .select({
        id: candidates.id,
        fullName: candidates.fullName,
        email: candidates.email,
        phone: candidates.phone,
        city: candidates.city,
        state: candidates.state,
        desiredRole: candidates.desiredRole,
        resumeFilename: candidates.resumeFilename,
        resumeUploadedAt: candidates.resumeUploadedAt,
        createdAt: candidates.createdAt,
        applicationsCount: sql<number>`(SELECT COUNT(*)::int FROM ${applications} WHERE ${applications.candidateId} = ${candidates.id})`,
      })
      .from(candidates)
      .where(and(...where))
      .orderBy(desc(candidates.createdAt))
      .limit(200);

    res.json(rows);
  } catch (err) { next(err); }
});

// Detalhe do candidato + candidaturas
router.get('/:id', async (req, res, next) => {
  try {
    const tid = tenantId(req);
    const id = req.params.id as string;

    const cand = await db
      .select()
      .from(candidates)
      .where(and(eq(candidates.id, id), eq(candidates.agencyId, tid)))
      .limit(1);
    if (!cand[0]) throw new HttpError(404, 'NOT_FOUND', 'Candidato não encontrado');

    const apps = await db
      .select({
        id: applications.id,
        stage: applications.stage,
        notes: applications.notes,
        createdAt: applications.createdAt,
        job: { id: jobs.id, slug: jobs.slug, title: jobs.title },
        company: { id: companies.id, tradeName: companies.tradeName },
      })
      .from(applications)
      .innerJoin(jobs, eq(applications.jobId, jobs.id))
      .innerJoin(companies, eq(jobs.companyId, companies.id))
      .where(eq(applications.candidateId, id))
      .orderBy(desc(applications.createdAt));

    res.json({ candidate: cand[0], applications: apps });
  } catch (err) { next(err); }
});

// Download do currículo (autorizado)
router.get('/:id/resume', async (req, res, next) => {
  try {
    const tid = tenantId(req);
    const id = req.params.id as string;
    const cand = await db
      .select()
      .from(candidates)
      .where(and(eq(candidates.id, id), eq(candidates.agencyId, tid)))
      .limit(1);
    if (!cand[0] || !cand[0].resumeKey) throw new HttpError(404, 'NOT_FOUND', 'Currículo não encontrado');
    const buf = await storage.read(cand[0].resumeKey);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${cand[0].resumeFilename || 'curriculo.pdf'}"`);
    res.send(buf);
  } catch (err) { next(err); }
});

// Extrair dados do currículo com IA (Fase 7)
router.post('/:id/extract-resume', async (req, res, next) => {
  try {
    const tid = tenantId(req);
    const id = req.params.id as string;
    const cand = await db
      .select()
      .from(candidates)
      .where(and(eq(candidates.id, id), eq(candidates.agencyId, tid)))
      .limit(1);
    if (!cand[0]) throw new HttpError(404, 'NOT_FOUND', 'Candidato não encontrado');
    if (!cand[0].resumeKey) throw new HttpError(400, 'NO_RESUME', 'Candidato sem currículo');

    const buf = await storage.read(cand[0].resumeKey);
    let text: string;
    try {
      text = await extractPdfText(buf);
    } catch (err: any) {
      // PDF inválido OU scaneado (sem camada de texto)
      throw new HttpError(422, 'EMPTY_PDF', err.message || 'PDF sem texto extraível (pode ser scaneado)');
    }
    if (!text || text.length < 50) {
      throw new HttpError(422, 'EMPTY_PDF', 'PDF sem texto extraível (pode ser scaneado)');
    }

    const extracted = await extractResumeFromText({ pdfText: text });

    // Persiste no banco (não sobrescreve dados já preenchidos — só adiciona se vazio)
    const updates: any = {
      aiExtractedAt: new Date(),
      aiData: JSON.stringify(extracted),
      updatedAt: new Date(),
    };
    if (!cand[0].fullName && extracted.fullName) updates.fullName = extracted.fullName;
    if (!cand[0].email && extracted.email) updates.email = extracted.email.toLowerCase();
    if (!cand[0].phone && extracted.phone) updates.phone = extracted.phone.replace(/\D/g, '');
    if (!cand[0].city && extracted.city) updates.city = extracted.city;
    if (!cand[0].state && extracted.state) updates.state = extracted.state;
    if (!cand[0].cnh && extracted.cnh) updates.cnh = extracted.cnh;
    if (!cand[0].education && extracted.education.length > 0) updates.education = JSON.stringify(extracted.education);
    if (!cand[0].experience && extracted.experiences.length > 0) {
      updates.experience = extracted.experiences
        .map((e) => `${e.role} ${e.company ? 'em ' + e.company : ''}`.trim())
        .join('\n');
    }

    await db.update(candidates).set(updates).where(eq(candidates.id, id));

    res.json({ ok: true, extracted, textLength: text.length });
  } catch (err) { next(err); }
});

// Substituir currículo (admin)
const replaceResumeSchema = z.object({
  resumeBase64: z.string(),
  resumeFilename: z.string(),
});

router.put('/:id/resume', async (req, res, next) => {
  try {
    const tid = tenantId(req);
    const id = req.params.id as string;
    const data = replaceResumeSchema.parse(req.body);

    const cand = await db
      .select()
      .from(candidates)
      .where(and(eq(candidates.id, id), eq(candidates.agencyId, tid)))
      .limit(1);
    if (!cand[0]) throw new HttpError(404, 'NOT_FOUND', 'Candidato não encontrado');

    const buf = Buffer.from(data.resumeBase64, 'base64');
    if (buf.length > 5 * 1024 * 1024) throw new HttpError(413, 'TOO_LARGE', 'Máx 5MB');
    if (buf.slice(0, 5).toString('ascii') !== '%PDF-') throw new HttpError(415, 'NOT_PDF', 'Não é PDF válido');

    // Apaga o antigo (se houver)
    if (cand[0].resumeKey) {
      await storage.delete(cand[0].resumeKey).catch(() => {});
    }

    const newKey = `agencies/${tid}/candidates/${id}.pdf`;
    await storage.save(newKey, buf);

    await db.update(candidates).set({
      resumeKey: newKey,
      resumeFilename: data.resumeFilename,
      resumeUploadedAt: new Date(),
      // Limpa AI antiga pra forçar nova extração
      aiData: null,
      aiExtractedAt: null,
      updatedAt: new Date(),
    }).where(eq(candidates.id, id));

    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.delete('/:id/resume', async (req, res, next) => {
  try {
    const tid = tenantId(req);
    const id = req.params.id as string;
    const cand = await db
      .select()
      .from(candidates)
      .where(and(eq(candidates.id, id), eq(candidates.agencyId, tid)))
      .limit(1);
    if (!cand[0]) throw new HttpError(404, 'NOT_FOUND', 'Candidato não encontrado');
    if (cand[0].resumeKey) await storage.delete(cand[0].resumeKey).catch(() => {});
    await db.update(candidates).set({
      resumeKey: null,
      resumeFilename: null,
      resumeUploadedAt: null,
      aiData: null,
      aiExtractedAt: null,
      updatedAt: new Date(),
    }).where(eq(candidates.id, id));
    res.json({ ok: true });
  } catch (err) { next(err); }
});

import { storage } from '../lib/storage.js';
import { extractPdfText, extractResumeFromText } from '../lib/ai.js';

// Atualizar stage de uma candidatura
router.put('/applications/:appId/stage', async (req, res, next) => {
  try {
    const tid = tenantId(req);
    const appId = req.params.appId as string;
    const stage = z.enum([
      'NOVO','EM_ANALISE','PRE_SELECIONADO','ENTREVISTA','APROVADO','ENVIADO_EMPRESA','CONTRATADO','REPROVADO'
    ]).parse(req.body?.stage);

    const [updated] = await db
      .update(applications)
      .set({ stage, updatedAt: new Date() })
      .where(and(eq(applications.id, appId), eq(applications.agencyId, tid)))
      .returning();
    if (!updated) throw new HttpError(404, 'NOT_FOUND', 'Candidatura não encontrada');
    res.json(updated);
  } catch (err) { next(err); }
});

// Atualizar notas internas de uma candidatura
router.put('/applications/:appId/notes', async (req, res, next) => {
  try {
    const tid = tenantId(req);
    const appId = req.params.appId as string;
    const notes = z.string().max(2000).parse(req.body?.notes ?? '');

    const [updated] = await db
      .update(applications)
      .set({ notes, updatedAt: new Date() })
      .where(and(eq(applications.id, appId), eq(applications.agencyId, tid)))
      .returning();
    if (!updated) throw new HttpError(404, 'NOT_FOUND', 'Candidatura não encontrada');
    res.json(updated);
  } catch (err) { next(err); }
});

// Lista candidaturas por vaga (pra Kanban futuro)
router.get('/by-job/:jobId', async (req, res, next) => {
  try {
    const tid = tenantId(req);
    const jobId = req.params.jobId as string;
    const rows = await db
      .select({
        id: applications.id,
        stage: applications.stage,
        notes: applications.notes,
        createdAt: applications.createdAt,
        candidate: {
          id: candidates.id,
          fullName: candidates.fullName,
          phone: candidates.phone,
          email: candidates.email,
          city: candidates.city,
          desiredRole: candidates.desiredRole,
          resumeFilename: candidates.resumeFilename,
        },
      })
      .from(applications)
      .innerJoin(candidates, eq(applications.candidateId, candidates.id))
      .where(and(eq(applications.jobId, jobId), eq(applications.agencyId, tid)))
      .orderBy(desc(applications.createdAt));
    res.json(rows);
  } catch (err) { next(err); }
});

export default router;