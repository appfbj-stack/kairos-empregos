import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Request } from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users, agencies, type User, type Agency } from '../db/schema.js';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('❌ JWT_SECRET é obrigatório em produção');
  }
}

export interface JwtPayload {
  sub: string; // user id
  agencyId: string;
  role: 'ADMIN' | 'RECRUITER' | 'USER';
  slug: string;
  iat?: number;
  exp?: number;
}

export const hashPassword = (plain: string) => bcrypt.hash(plain, 10);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

export const signToken = (user: User, agency: Agency): string => {
  if (!JWT_SECRET) throw new Error('JWT_SECRET não configurado');
  return jwt.sign(
    {
      sub: user.id,
      agencyId: agency.id,
      role: user.role,
      slug: agency.slug,
    } as JwtPayload,
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN as any }
  );
};

export const verifyToken = (token: string): JwtPayload => {
  if (!JWT_SECRET) throw new Error('JWT_SECRET não configurado');
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
};

export interface AuthUserContext {
  user: User;
  agency: Agency;
}

export const loadUserByEmail = async (
  email: string
): Promise<{ user: User; agency: Agency } | null> => {
  const result = await db
    .select({
      user: users,
      agency: agencies,
    })
    .from(users)
    .innerJoin(agencies, eq(users.agencyId, agencies.id))
    .where(and(eq(users.email, email.toLowerCase()), eq(users.isActive, true)))
    .limit(1);

  return result[0] ?? null;
};

export const extractToken = (req: Request): string | null => {
  // 1. Cookie httpOnly
  if (req.cookies?.auth_token) return req.cookies.auth_token;
  // 2. Authorization Bearer
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return null;
};