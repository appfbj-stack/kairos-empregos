/**
 * Super Admin — gestão de TODAS as agências da plataforma.
 * Isolado do tenant auth (login separado, cookie diferente).
 */
import { Router } from 'express';
import { z } from 'zod';
import { sql, eq, desc } from 'drizzle-orm';
import { db } from '../db/client.js';
import {
  agencies,
  users,
  companies,
  jobs,
  candidates,
  applications,
  superAdmins,
} from '../db/schema.js';
import { requireSuperAdmin } from '../middleware/superAdmin.js';
import {
  signSuperToken,
  verifyPassword,
  hashPassword,
  loadSuperAdminByEmail,
} from '../lib/superAuth.js';
import { HttpError } from '../middleware/errors.js';
import { slugify } from '../lib/slug.js';

const authRouter = Router();

// ===== AUTH SUPER ADMIN =====
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const admin = await loadSuperAdminByEmail(email);
    if (!admin || !admin.isActive) {
      throw new HttpError(401, 'INVALID_CREDENTIALS', 'Credenciais inválidas');
    }
    const ok = await verifyPassword(password, admin.passwordHash);
    if (!ok) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Credenciais inválidas');

    await db.update(superAdmins).set({ lastLoginAt: new Date() }).where(eq(superAdmins.id, admin.id));

    const token = signSuperToken(admin);
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('super_token', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });
    res.json({
      user: { id: admin.id, name: admin.name, email: admin.email, role: 'SUPER_ADMIN' },
      token,
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie('super_token', { path: '/' });
  res.json({ ok: true });
});

authRouter.get('/me', requireSuperAdmin, (req, res) => {
  const a = req.superAdmin!;
  res.json({ user: { id: a.id, name: a.name, email: a.email, role: 'SUPER_ADMIN' } });
});

// ===== ROTAS ADMINISTRATIVAS =====
const adminRouter = Router();
adminRouter.use(requireSuperAdmin);

adminRouter.get('/agencies', async (_req, res, next) => {
  try {
    const rows = await db
      .select({
        id: agencies.id,
        name: agencies.name,
        slug: agencies.slug,
        plan: agencies.plan,
        status: agencies.status,
        licenseStart: agencies.licenseStart,
        licenseEnd: agencies.licenseEnd,
        city: agencies.city,
        state: agencies.state,
        primaryColor: agencies.primaryColor,
        createdAt: agencies.createdAt,
      })
      .from(agencies)
      .orderBy(desc(agencies.createdAt));

    // Buscar contadores em paralelo (mais simples e confiável que subqueries)
    const enriched = await Promise.all(rows.map(async (a) => {
      const [{ count: usersCount }] = await db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(users)
        .where(eq(users.agencyId, a.id));
      const [{ count: jobsCount }] = await db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(jobs)
        .where(eq(jobs.agencyId, a.id));
      const [{ count: candidatesCount }] = await db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(candidates)
        .where(eq(candidates.agencyId, a.id));
      const [{ count: companiesCount }] = await db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(companies)
        .where(eq(companies.agencyId, a.id));
      return { ...a, usersCount, jobsCount, candidatesCount, companiesCount };
    }));

    res.json(enriched);
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/agencies/:id', async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const ag = await db.select().from(agencies).where(eq(agencies.id, id)).limit(1);
    if (!ag[0]) throw new HttpError(404, 'NOT_FOUND', 'Agência não encontrada');

    const [{ count: usersCount }] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(users)
      .where(eq(users.agencyId, id));
    const [{ count: jobsCount }] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(jobs)
      .where(eq(jobs.agencyId, id));
    const [{ count: candidatesCount }] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(candidates)
      .where(eq(candidates.agencyId, id));
    const [{ count: companiesCount }] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(companies)
      .where(eq(companies.agencyId, id));
    const [{ count: applicationsCount }] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(applications)
      .where(eq(applications.agencyId, id));

    const agUsers = await db.select().from(users).where(eq(users.agencyId, id));
    res.json({
      agency: ag[0],
      metrics: { usersCount, jobsCount, candidatesCount, companiesCount, applicationsCount },
      users: agUsers.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, isActive: u.isActive, lastLoginAt: u.lastLoginAt })),
    });
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).optional(),
  plan: z.enum(['ESSENCIAL', 'PROFISSIONAL']).optional(),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(6),
  adminName: z.string().min(2),
  licenseDays: z.number().int().positive().optional().default(30),
});

adminRouter.post('/agencies', async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body);
    const slug = data.slug ? slugify(data.slug) : slugify(data.name);
    const existing = await db.select().from(agencies).where(eq(agencies.slug, slug)).limit(1);
    if (existing[0]) throw new HttpError(409, 'SLUG_TAKEN', 'Já existe agência com esse slug');

    const licenseStart = new Date();
    const licenseEnd = new Date(licenseStart.getTime() + data.licenseDays * 86400000);

    const [created] = await db.insert(agencies).values({
      name: data.name,
      slug,
      plan: data.plan || 'ESSENCIAL',
      status: 'TESTE',
      licenseStart,
      licenseEnd,
    }).returning();

    const passwordHash = await hashPassword(data.adminPassword);
    const [adminUser] = await db.insert(users).values({
      agencyId: created.id,
      name: data.adminName,
      email: data.adminEmail.toLowerCase(),
      passwordHash,
      role: 'ADMIN',
    }).returning();

    res.status(201).json({
      agency: { id: created.id, name: created.name, slug: created.slug, plan: created.plan, status: created.status },
      adminUser: { id: adminUser.id, email: adminUser.email, role: adminUser.role },
      credentials: { email: adminUser.email, password: data.adminPassword },
    });
  } catch (err) {
    next(err);
  }
});

const statusSchema = z.object({
  status: z.enum(['TESTE', 'ATIVA', 'BLOQUEADA', 'EXPIRADA']),
});

adminRouter.patch('/agencies/:id/status', async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const { status } = statusSchema.parse(req.body);
    const [updated] = await db
      .update(agencies)
      .set({ status, updatedAt: new Date() })
      .where(eq(agencies.id, id))
      .returning();
    if (!updated) throw new HttpError(404, 'NOT_FOUND', 'Agência não encontrada');
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

const renewSchema = z.object({
  days: z.number().int().positive(),
});

adminRouter.patch('/agencies/:id/license', async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const { days } = renewSchema.parse(req.body);
    const ag = await db.select().from(agencies).where(eq(agencies.id, id)).limit(1);
    if (!ag[0]) throw new HttpError(404, 'NOT_FOUND', 'Agência não encontrada');

    const base = ag[0].licenseEnd && ag[0].licenseEnd > new Date() ? ag[0].licenseEnd : new Date();
    const newEnd = new Date(base.getTime() + days * 86400000);

    const [updated] = await db
      .update(agencies)
      .set({ licenseEnd: newEnd, status: 'ATIVA', updatedAt: new Date() })
      .where(eq(agencies.id, id))
      .returning();
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// Toggle user active (bloquear/reativar usuário específico)
adminRouter.patch('/users/:userId/toggle-active', async (req, res, next) => {
  try {
    const userId = req.params.userId as string;
    const u = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!u[0]) throw new HttpError(404, 'NOT_FOUND', 'Usuário não encontrado');
    const [updated] = await db
      .update(users)
      .set({ isActive: !u[0].isActive, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default authRouter;
export { adminRouter };