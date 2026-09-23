import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Endpoint placeholder — Fase 1 só valida isolamento multi-tenant.
// Cada agency só vê seus próprios dados (nada aqui vazaria entre tenants).
router.get('/', requireAuth, (_req, res) => {
  res.json({ message: 'Fase 2 — empresas e vagas virão aqui' });
});

export default router;