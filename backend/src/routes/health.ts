import { Router } from 'express';
import { pool } from '../db/client.js';
import { STORAGE_DRIVER_NAME } from '../lib/storage.js';

const router = Router();

router.get('/', async (_req, res) => {
  let dbOk = false;
  try {
    await pool.query('SELECT 1');
    dbOk = true;
  } catch {
    dbOk = false;
  }

  res.json({
    ok: dbOk,
    service: 'kairos-rh-backend',
    version: '0.1.0',
    phase: 1,
    timestamp: new Date().toISOString(),
    checks: {
      database: dbOk ? 'ok' : 'down',
      storage: STORAGE_DRIVER_NAME,
    },
  });
});

export default router;