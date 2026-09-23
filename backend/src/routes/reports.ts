/**
 * Relatórios — métricas e funil.
 * Todos os endpoints respeitam multi-tenant (filtro por agency_id do JWT).
 */
import { Router } from 'express';
import { and, eq, sql, desc, gte } from 'drizzle-orm';
import { db } from '../db/client.js';
import { jobs, candidates, applications, companies } from '../db/schema.js';
import { requireAuth, tenantId } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/dashboard', async (req, res, next) => {
  try {
    const tid = tenantId(req);

    // Contadores globais
    const [
      [{ totalJobs }],
      [{ activeJobs }],
      [{ totalCandidates }],
      [{ totalCompanies }],
      [{ totalApplications }],
    ] = await Promise.all([
      db.select({ totalJobs: sql<number>`COUNT(*)::int` }).from(jobs).where(eq(jobs.agencyId, tid)),
      db.select({ activeJobs: sql<number>`COUNT(*)::int` }).from(jobs).where(and(eq(jobs.agencyId, tid), eq(jobs.status, 'PUBLICADA'))),
      db.select({ totalCandidates: sql<number>`COUNT(*)::int` }).from(candidates).where(eq(candidates.agencyId, tid)),
      db.select({ totalCompanies: sql<number>`COUNT(*)::int` }).from(companies).where(eq(companies.agencyId, tid)),
      db.select({ totalApplications: sql<number>`COUNT(*)::int` }).from(applications).where(eq(applications.agencyId, tid)),
    ]);

    // Candidatos por estágio (Kanban global da agência)
    const byStage = await db
      .select({
        stage: applications.stage,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(applications)
      .where(eq(applications.agencyId, tid))
      .groupBy(applications.stage);

    // Top 5 vagas por nº de candidaturas
    const topJobs = await db
      .select({
        id: jobs.id,
        title: jobs.title,
        company: companies.tradeName,
        applicationsCount: sql<number>`(SELECT COUNT(*)::int FROM ${applications} WHERE ${applications.jobId} = ${jobs.id})`,
        status: jobs.status,
      })
      .from(jobs)
      .leftJoin(companies, eq(jobs.companyId, companies.id))
      .where(eq(jobs.agencyId, tid))
      .orderBy(desc(sql`(SELECT COUNT(*)::int FROM ${applications} WHERE ${applications.jobId} = ${jobs.id})`))
      .limit(5);

    // Conversão: % de contratados sobre total de candidaturas
    const [{ hiredCount }] = await db
      .select({ hiredCount: sql<number>`COUNT(*)::int` })
      .from(applications)
      .where(and(eq(applications.agencyId, tid), eq(applications.stage, 'CONTRATADO')));
    const conversionRate = totalApplications > 0 ? Math.round((hiredCount / totalApplications) * 100) : 0;

    // Série dos últimos 30 dias (candidaturas/dia)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const timeseries = await db
      .select({
        day: sql<string>`date_trunc('day', ${applications.createdAt})::date::text`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(applications)
      .where(and(eq(applications.agencyId, tid), gte(applications.createdAt, thirtyDaysAgo)))
      .groupBy(sql`date_trunc('day', ${applications.createdAt})::date`)
      .orderBy(sql`date_trunc('day', ${applications.createdAt})::date`);

    res.json({
      totals: { totalJobs, activeJobs, totalCandidates, totalCompanies, totalApplications, hiredCount, conversionRate },
      byStage,
      topJobs,
      timeseries,
    });
  } catch (err) { next(err); }
});

// Funil de uma vaga específica
router.get('/jobs/:jobId/funnel', async (req, res, next) => {
  try {
    const tid = tenantId(req);
    const jobId = req.params.jobId as string;

    // Valida tenant
    const job = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, jobId), eq(jobs.agencyId, tid)))
      .limit(1);
    if (!job[0]) {
      return res.status(404).json({ error: 'Vaga não encontrada' });
    }

    const stages = ['NOVO', 'EM_ANALISE', 'PRE_SELECIONADO', 'ENTREVISTA', 'APROVADO', 'ENVIADO_EMPRESA', 'CONTRATADO', 'REPROVADO'];
    const counts = await db
      .select({
        stage: applications.stage,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(applications)
      .where(eq(applications.jobId, jobId))
      .groupBy(applications.stage);

    const stageMap: Record<string, number> = {};
    counts.forEach((c) => { stageMap[c.stage] = c.count; });

    // Calcula taxa de conversão cumulativa
    const funnel = stages.map((s) => ({
      stage: s,
      count: stageMap[s] || 0,
    }));
    const total = funnel.reduce((acc, f) => acc + f.count, 0);

    res.json({
      job: { id: job[0].id, title: job[0].title, status: job[0].status },
      funnel,
      total,
    });
  } catch (err) { next(err); }
});

// Atividade recente (audit log + applications)
router.get('/activity', async (req, res, next) => {
  try {
    const tid = tenantId(req);
    const limit = Math.min(Number(req.query.limit) || 20, 100);

    const recent = await db
      .select({
        id: applications.id,
        action: sql<string>`'application'`,
        createdAt: applications.createdAt,
        stage: applications.stage,
        jobTitle: jobs.title,
        candidateName: candidates.fullName,
      })
      .from(applications)
      .innerJoin(jobs, eq(applications.jobId, jobs.id))
      .innerJoin(candidates, eq(applications.candidateId, candidates.id))
      .where(eq(applications.agencyId, tid))
      .orderBy(desc(applications.createdAt))
      .limit(limit);

    res.json(recent);
  } catch (err) { next(err); }
});

export default router;