# KAIROS RH

Plataforma SaaS multi-tenant para agências de emprego e recrutamento.

**Stack:** Next.js 14 + TypeScript + Tailwind (frontend) · Node 22 + Express + Drizzle + PostgreSQL 16 (backend) · Docker Compose · IA via MiniMax-M3 (OpenAI-compatible)

---

## Status

✅ **MVP completo** — todas as 9 fases do PRD entregues e testadas (87 smoke tests passando).

Ver detalhes em `docs/PHASE1.md` ... `docs/PHASE9.md`.

---

## Quick start

```bash
cd kairos-rh
cp backend/.env.example backend/.env

docker compose up -d --build

docker compose exec backend node --import tsx/esm src/db/migrate.ts
docker compose exec backend node --import tsx/esm src/db/seed.ts
```

**Acesso:**
- Frontend: http://localhost:8032
- API: http://localhost:8031
- Health: http://localhost:8031/health

---

## Credenciais demo

| Perfil | E-mail | Senha |
|---|---|---|
| Admin Agência Demo | `admin@demo.com` | `admin123` |
| Recrutador Demo | `recrutador@demo.com` | `recruiter123` |
| Admin Agência Teste (isolamento) | `admin@teste.com` | `admin123` |
| Super Admin (plataforma) | `super@kairosrh.com` | `super123` |

---

## Arquitetura

```
kairos-rh/
├── backend/                # API Node + Express + Drizzle
│   ├── src/
│   │   ├── db/             # schema, client, migrate, seed
│   │   ├── lib/            # auth, ai, slug, storage, logger, superAuth
│   │   ├── middleware/     # auth (JWT + tenant), superAdmin, errors
│   │   ├── routes/         # auth, health, agencies, companies, jobs,
│   │   │                   # candidates, public, superAdmin, reports
│   │   └── server.ts
│   ├── tests/              # isolation.ts (testes unitários)
│   ├── drizzle/            # SQL migrations
│   ├── storage/            # volume para currículos PDF
│   └── Dockerfile
├── frontend/               # Next.js 14 PWA
│   ├── app/
│   │   ├── (auth)/login
│   │   ├── dashboard/      # KPIs, vagas, empresas, candidatos, pipeline, relatórios
│   │   ├── super-admin/    # plataforma: lista/cria/gerencia agências
│   │   └── vagas/          # público: lista, detalhe, candidatar
│   ├── components/         # Sidebar
│   ├── lib/                # api, superApi
│   └── Dockerfile
├── docker-compose.yml
├── docs/                   # PHASE1..9.md
├── smoke-test-phase*.ps1   # testes E2E de cada fase
└── README.md
```

---

## Multi-tenant

- Cada agência é um tenant (`agencies` table).
- Toda query autenticada passa por `tenantId(req)` (NUNCA aceita tenantId do body).
- Bloqueio automático se `agency.status = BLOQUEADA | EXPIRADA`.
- **87 smoke tests** validam isolamento entre tenants.

---

## API (47 rotas)

Ver `docs/PHASE9.md` para tabela completa.

| Categoria | Endpoints |
|---|---|
| Auth | login, logout, me, whoami |
| Empresas | CRUD |
| Vagas | CRUD + match |
| Candidatos | CRUD + apply + resume + extract |
| Candidaturas | CRUD + stage + notes |
| Público | vaga detalhe/lista + candidatura |
| Super Admin | auth + agencies + ações |
| Relatórios | dashboard + funnel + activity |

---

## IA (Fase 7 e 8)

- **Provider:** MiniMax-M3 (`api.MiniMax.io/v1`, OpenAI-compatible)
- **Fase 7:** extração de currículo PDF → JSON estruturado validado por Zod
- **Fase 8:** matching candidato × vaga → score 0-100 + matches/missing + disclaimer
- **Modo STUB** automático se `OPENAI_API_KEY` ausente (regex simples pra dev)
- System prompts explícitos: "NÃO invente", "ferramenta AUXILIAR, não decisão automática"

---

## Banco de dados (8 tabelas)

`agencies`, `users`, `super_admins`, `companies`, `jobs`, `candidates`, `applications`, `audit_logs`

Migrations em `backend/drizzle/` (auto-aplicadas via `db:migrate`).

---

## Deploy

1. Subir código pro GitHub
2. Criar projeto Dokploy apontando pro repo
3. Configurar env vars: `JWT_SECRET`, `ADMIN_TOKEN`, `OPENAI_API_KEY`, `DB_PASS`
4. Apontar subdomínio `rh.fbautomacao.space` pro container web (porta 8032)
5. Apontar `/api/*` e `/health` pro backend (porta 8031) via Caddy
6. Rodar migrations e seed via terminal Dokploy

---

## Licença

Privado. Uso restrito ao proprietário.
