import type { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { superAdmins, type SuperAdmin } from '../db/schema.js';
import { extractSuperToken, verifySuperToken } from '../lib/superAuth.js';

declare global {
  namespace Express {
    interface Request {
      superAdmin?: SuperAdmin;
    }
  }
}

export const requireSuperAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = extractSuperToken(req);
    if (!token) return res.status(401).json({ error: 'Não autenticado como super admin' });
    const payload = verifySuperToken(token);
    if (payload.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Acesso restrito ao super admin' });
    }
    const result = await db
      .select()
      .from(superAdmins)
      .where(eq(superAdmins.id, payload.sub))
      .limit(1);
    const admin = result[0];
    if (!admin || !admin.isActive) {
      return res.status(401).json({ error: 'Sessão inválida' });
    }
    req.superAdmin = admin;
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado' });
    }
    return res.status(401).json({ error: 'Token inválido' });
  }
};