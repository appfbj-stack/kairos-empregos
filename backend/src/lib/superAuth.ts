import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Request } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { superAdmins, type SuperAdmin } from '../db/schema.js';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('❌ JWT_SECRET é obrigatório em produção');
}

export const hashPassword = (plain: string) => bcrypt.hash(plain, 10);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

export interface SuperJwtPayload {
  sub: string;
  role: 'SUPER_ADMIN';
  iat?: number;
  exp?: number;
}

export const signSuperToken = (admin: SuperAdmin): string => {
  if (!JWT_SECRET) throw new Error('JWT_SECRET não configurado');
  return jwt.sign(
    { sub: admin.id, role: 'SUPER_ADMIN' } as SuperJwtPayload,
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN as any }
  );
};

export const verifySuperToken = (token: string): SuperJwtPayload => {
  if (!JWT_SECRET) throw new Error('JWT_SECRET não configurado');
  return jwt.verify(token, JWT_SECRET) as SuperJwtPayload;
};

export const loadSuperAdminByEmail = async (email: string): Promise<SuperAdmin | null> => {
  const result = await db
    .select()
    .from(superAdmins)
    .where(eq(superAdmins.email, email.toLowerCase()))
    .limit(1);
  return result[0] ?? null;
};

export const extractSuperToken = (req: Request): string | null => {
  if (req.cookies?.super_token) return req.cookies.super_token;
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return null;
};