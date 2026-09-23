# KAIROS RH — Fase 1

## O que foi implementado

### Banco de dados
- `agencies` — tenants (id UUID, slug único, plano, status, licença)
- `users` — vinculados a uma agency via FK, role enum (ADMIN/RECRUITER/USER), bcrypt hash
- `audit_logs` — log de ações (login, etc.) com agency_id + user_id
- Índices em `tenant_id`, `email`, `slug`, `status`, `created_at`

### Backend
- Express + TypeScript
- JWT (jsonwebtoken) com payload incluindo sub, agencyId, role, slug
- bcryptjs (10 rounds)
- Cookie httpOnly + SameSite=Lax (em prod `None` + `secure`)
- CORS com credenciais
- Zod para validação de entrada
- Pino logger
- `requireAuth` middleware que carrega user + agency do banco a cada request
- `requireRole(...roles)` para autorização por papel
- `tenantId(req)` helper — NUNCA confiar em tenantId do body
- Bloqueio de agência BLOQUEADA/EXPIRADA retorna 403
- Storage layer abstrato (Local + stub S3 preparado)

### Frontend (Next.js 14)
- Tela de login funcional
- Dashboard placeholder
- Header colorido pela `primaryColor` da agência
- Logout limpando cookie + localStorage
- Rewrites no next.config.js (`/api/*` → backend, `/health` → backend)

### Docker / Compose
- 3 serviços: `postgres`, `backend`, `frontend`
- Volume dedicado para currículos (`kairos_rh_storage`)
- Healthcheck no postgres (pg_isready) e containers via wget
- Multi-stage Dockerfiles (Node 22-alpine)
- Não-root user nos containers de runtime

### Testes
- `tests/isolation.ts` valida:
  1. Existência das duas agencies (demo + teste)
  2. Existência dos admins
  3. Senhas da seed batem
  4. JWT carrega agencyId correto por tenant
  5. JWTs de tenants diferentes têm claims diferentes
  6. JWT adulterado é rejeitado
  7. bcryptjs hash/verify funciona

---

## Como rodar local

```bash
# 1. Copie .env
cp backend/.env.example backend/.env

# 2. Suba os containers
docker compose up -d --build

# 3. Migrations
docker compose exec backend sh -c "node --import tsx/esm src/db/migrate.ts"
# Em prod (imagem já buildada):
docker compose exec backend sh -c "node dist/db/migrate.js"

# 4. Seed
docker compose exec backend sh -c "node --import tsx/esm src/db/seed.ts"
```

Acesse:
- http://localhost:8032 → tela de login
- http://localhost:8031/health → health check

---

## Problemas conhecidos (Fase 1)

- Sem rate limiting ainda (Fase 9)
- Sem recuperação de senha (Fase 9)
- Sem testes E2E (Fase 9)
- Sem CI/CD (Fase 9)
- 2FA não implementado

---

## Próxima fase

**Fase 2 — Empresas + Vagas:**
- `companies` table (FK agency_id)
- `jobs` table (FK agency_id + company_id)
- CRUD completo
- Geração automática de slug da vaga
- Botão "Copiar link" + "Compartilhar no WhatsApp"
- Endpoint público `/vagas/[slug]` (sem auth)