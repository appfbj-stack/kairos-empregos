import { Router } from 'express';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { companies } from '../db/schema.js';
import { requireAuth, requireRole, tenantId } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';

const router = Router();

const createSchema = z.object({
  legalName: z.string().min(1, 'Razão social obrigatória'),
  tradeName: z.string().optional().nullable(),
  cnpj: z.string().optional().nullable(),
  contactName: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().length(2).optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.enum(['ATIVA', 'INATIVA', 'SUSPENSA']).optional(),
});

const updateSchema = createSchema.partial();

router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const tid = tenantId(req);
    const rows = await db
      .select()
      .from(companies)
      .where(eq(companies.agencyId, tid));
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
      .from(companies)
      .where(and(eq(companies.id, req.params.id as string), eq(companies.agencyId, tid)))
      .limit(1);
    if (!rows[0]) throw new HttpError(404, 'NOT_FOUND', 'Empresa não encontrada');
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRole('ADMIN', 'RECRUITER'), async (req, res, next) => {
  try {
    const tid = tenantId(req);
    const data = createSchema.parse(req.body);
    const [created] = await db
      .insert(companies)
      .values({ ...data, agencyId: tid })
      .returning();
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireRole('ADMIN', 'RECRUITER'), async (req, res, next) => {
  try {
    const tid = tenantId(req);
    const data = updateSchema.parse(req.body);
    const [updated] = await db
      .update(companies)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(companies.id, req.params.id as string), eq(companies.agencyId, tid)))
      .returning();
    if (!updated) throw new HttpError(404, 'NOT_FOUND', 'Empresa não encontrada');
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const tid = tenantId(req);
    const deleted = await db
      .delete(companies)
      .where(and(eq(companies.id, req.params.id as string), eq(companies.agencyId, tid)))
      .returning();
    if (!deleted[0]) throw new HttpError(404, 'NOT_FOUND', 'Empresa não encontrada');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;