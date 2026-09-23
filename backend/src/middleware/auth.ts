import type { Request, Response, NextFunction } from 'express';
import { extractToken, verifyToken } from '../lib/auth.js';
import { db } from '../db/client.js';
import { users, agencies, type User, type Agency } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

export interface AuthContext {
  user: User;
  agency: Agency;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Não autenticado' });
    }
    const payload = verifyToken(token);

    const result = await db
      .select({ user: users, agency: agencies })
      .from(users)
      .innerJoin(agencies, eq(users.agencyId, agencies.id))
      .where(and(eq(users.id, payload.sub), eq(users.isActive, true)))
      .limit(1);

    const row = result[0];
    if (!row) {
      return res.status(401).json({ error: 'Sessão inválida' });
    }

    // Bloqueio de agência expirada/bloqueada
    if (row.agency.status === 'BLOQUEADA' || row.agency.status === 'EXPIRADA') {
      return res.status(403).json({ error: 'Agência bloqueada ou expirada' });
    }

    req.auth = { user: row.user, agency: row.agency };
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Token inválido' });
    }
    return res.status(401).json({ error: 'Erro de autenticação' });
  }
};

export const requireRole = (...roles: Array<'ADMIN' | 'RECRUITER' | 'USER'>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) return res.status(401).json({ error: 'Não autenticado' });
    if (!roles.includes(req.auth.user.role)) {
      return res.status(403).json({ error: 'Permissão insuficiente' });
    }
    next();
  };
};

/**
 * Helper para multi-tenant: sempre retorna o agencyId do usuário autenticado.
 * NUNCA aceitar agencyId do body/query em endpoints autenticados.
 */
export const tenantId = (req: Request): string => {
  if (!req.auth) throw new Error('tenantId chamado sem auth');
  return req.auth.agency.id;
};