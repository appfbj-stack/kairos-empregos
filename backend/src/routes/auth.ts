import { Router } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { auditLogs, users } from '../db/schema.js';
import { loadUserByEmail, verifyPassword, signToken } from '../lib/auth.js';
import { requireAuth, tenantId } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const ctx = await loadUserByEmail(email);
    if (!ctx) {
      throw new HttpError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha inválidos');
    }

    const ok = await verifyPassword(password, ctx.user.passwordHash);
    if (!ok) {
      throw new HttpError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha inválidos');
    }

    if (ctx.agency.status === 'BLOQUEADA' || ctx.agency.status === 'EXPIRADA') {
      throw new HttpError(403, 'AGENCY_BLOCKED', 'Agência bloqueada ou expirada');
    }

    // Atualiza lastLoginAt
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, ctx.user.id));

    const token = signToken(ctx.user, ctx.agency);

    // Audit log
    await db.insert(auditLogs).values({
      agencyId: ctx.agency.id,
      userId: ctx.user.id,
      action: 'login',
      ip: req.ip,
      userAgent: req.headers['user-agent']?.slice(0, 500) || null,
    });

    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    res.json({
      user: {
        id: ctx.user.id,
        name: ctx.user.name,
        email: ctx.user.email,
        role: ctx.user.role,
      },
      agency: {
        id: ctx.agency.id,
        name: ctx.agency.name,
        slug: ctx.agency.slug,
        plan: ctx.agency.plan,
      },
      token,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (_req, res) => {
  res.clearCookie('auth_token', { path: '/' });
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  const { user, agency } = req.auth!;
  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    agency: {
      id: agency.id,
      name: agency.name,
      slug: agency.slug,
      plan: agency.plan,
      status: agency.status,
      primaryColor: agency.primaryColor,
      logoUrl: agency.logoUrl,
    },
  });
});

router.get('/whoami', requireAuth, (req, res) => {
  res.json({ tenantId: tenantId(req), agency: req.auth!.agency.slug });
});

export default router;