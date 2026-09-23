# KAIROS RH — Fase 2

## O que foi implementado

### Banco de dados
- `companies` — empresas clientes (FK agency_id, status enum, dados completos)
- `jobs` — vagas (FK agency_id + company_id, slug único por tenant, enums de status/contract/modality)
- 4 novos enums: `company_status`, `job_status`, `job_contract_type`, `job_modality`

### Backend
- **Rotas autenticadas** (`requireAuth` + `tenantId`):
  - `GET/POST /api/companies`
  - `GET/PUT/DELETE /api/companies/:id`
  - `GET/POST /api/jobs`
  - `GET/PUT/DELETE /api/jobs/:id`
- **Endpoint público** (sem auth):
  - `GET /api/public/agencies/:agencySlug/jobs` (lista vagas publicadas)
  - `GET /api/public/agencies/:agencySlug/jobs/:jobSlug` (detalhe da vaga)
- **Slug automático**: `${titulo} ${empresa} ${cidade}` → kebab-case, sufixo numérico se já existir
- **RBAC**: POST/PUT exigem ADMIN ou RECRUITER; DELETE exige ADMIN
- **Auditoria**: log de `job.create` em `audit_logs`
- **Proteção multi-tenant**: companyId em POST /api/jobs é validado contra o tenant (impede usar empresa de outro tenant)

### Frontend
- Sidebar com navegação (Dashboard, Vagas, Empresas)
- Dashboard com cards de atalhos + link do portal público da agência
- Página `/dashboard/empresas` — lista + form de cadastro
- Página `/dashboard/vagas` — lista + form completo + botões "Copiar link" + "Compartilhar no WhatsApp"
- Página pública `/vagas/[agencySlug]` — lista de vagas publicadas
- Página pública `/vagas/[agencySlug]/[jobSlug]` — detalhe com botão "CANDIDATAR-SE" (Fase 3)

### Schema
| Tabela | FKs | Índices |
|---|---|---|
| `companies` | agency_id (cascade) | agency_id, cnpj, status |
| `jobs` | agency_id (cascade), company_id (restrict) | agency_id, company_id, status, slug |

---

## Como testar

```bash
# Backend
cd backend
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/kairos_rh_test \
  npx tsx src/db/seed.ts
npm run dev   # ou npx tsx src/server.ts

# Frontend (outro terminal)
cd frontend
NEXT_PUBLIC_API_URL=http://localhost:8031 npm run dev
```

Acesse:
- http://localhost:8032/login
- http://localhost:8032/dashboard/vagas
- http://localhost:8032/dashboard/empresas
- http://localhost:8032/vagas/demo (público)
- http://localhost:8032/vagas/demo/auxiliar-de-producao-abc-industrial-sorocaba (público)

---

## Smoke tests Fase 2 (15 testes — todos passaram ✅)

| # | Teste | Esperado | Resultado |
|---|---|---|---|
| 1 | DEMO `/api/companies` | 200, 3 empresas | ✅ |
| 2 | TESTE `/api/companies` | 200, 1 empresa | ✅ |
| 3 | DEMO acessa empresa TESTE por ID | 404 (isolamento) | ✅ |
| 4 | DEMO `/api/jobs` | 200, 10 vagas | ✅ |
| 5 | TESTE `/api/jobs` | 200, 2 vagas | ✅ |
| 6 | Public lista vagas DEMO | 200, 10 | ✅ |
| 7 | Public vaga específica | 200 + title | ✅ |
| 8 | Public vaga rascunho (não PUBLICADA) | 404 | ✅ |
| 9 | Public agência inexistente | 404 | ✅ |
| 10 | POST criar vaga | 201 + slug auto | ✅ |
| 11 | PUT pausar vaga | 200 PAUSADA | ✅ |
| 12 | DELETE vaga | 200 | ✅ |
| 13 | TESTE deleta vaga DEMO | 404 (isolamento) | ✅ |
| 14 | POST sem auth | 401 | ✅ |
| 15 | DEMO usa companyId TESTE | 400 (cross-tenant) | ✅ |

---

## Próxima fase (Fase 3)

- Formulário de candidatura na página pública `/vagas/[agencySlug]/[jobSlug]/candidatar`
- Criar tabela `candidates` (banco de talentos) + `applications` (candidatura)
- Auto-match candidato existente por telefone/email (evitar duplicados)
- Página de confirmação da candidatura
- Admin vê candidato entrar no pipeline (Fase 5 — Kanban)