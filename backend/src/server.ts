import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { logger } from './lib/logger.js';
import { errorHandler, notFound } from './middleware/errors.js';
import authRouter from './routes/auth.js';
import healthRouter from './routes/health.js';
import agenciesRouter from './routes/agencies.js';
import companiesRouter from './routes/companies.js';
import jobsRouter from './routes/jobs.js';
import candidatesRouter from './routes/candidates.js';
import publicRouter from './routes/public.js';
import superAdminRouter, { adminRouter as superAdminProtectedRouter } from './routes/superAdmin.js';
import reportsRouter from './routes/reports.js';

const app = express();
const PORT = Number(process.env.PORT) || 8031;

// Confia no proxy (Caddy) pra pegar IP correto
app.set('trust proxy', 1);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(',') || [
      'http://localhost:8032',
      'http://localhost:3000',
    ],
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Request log
app.use((req, _res, next) => {
  logger.debug({ method: req.method, url: req.url, ip: req.ip }, 'req');
  next();
});

// Rotas
app.use('/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/agencies', agenciesRouter);
app.use('/api/companies', companiesRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/candidates', candidatesRouter);
app.use('/api/public', publicRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/super-admin', superAdminRouter);
app.use('/api/super-admin', superAdminProtectedRouter);

app.get('/', (_req, res) => {
  res.json({ service: 'KAIROS RH API', phase: 1 });
});

app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`🚀 KAIROS RH backend rodando em http://0.0.0.0:${PORT}`);
});