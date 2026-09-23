# KAIROS RH — Fase 6

## O que foi implementado

### Banco de dados
- Nova tabela `super_admins` (separada de `users`, sem FK pra agency — é da plataforma, não de tenant)
- Migration 0003

### Backend
- **Auth separada** pra super admin:
  - `POST /api/super-admin/login` — credenciais diferentes
  - `POST /api/super-admin/logout`
  - `GET /api/super-admin/me`
  - Cookie `super_token` (separado do `auth_token` de tenant)
  - JWT com `role: 'SUPER_ADMIN'` (não conflita com o JWT de tenant)
- **Rotas protegidas** com `requireSuperAdmin`:
  - `GET /api/super-admin/agencies` — lista todas (com contadores users/jobs/candidates/companies)
  - `GET /api/super-admin/agencies/:id` — detalhe + métricas + lista de usuários
  - `POST /api/super-admin/agencies` — cria nova agência + admin inicial (retorna credenciais)
  - `PATCH /api/super-admin/agencies/:id/status` — BLOQUEAR / DESBLOQUEAR / ATIVAR / TESTE
  - `PATCH /api/super-admin/agencies/:id/license` — renova N dias (estende license_end + seta status=ATIVA)
  - `PATCH /api/super-admin/users/:userId/toggle-active` — bloquear/reativar usuário específico

### Frontend
- `/super-admin/login` — tela de login separada (visual dark + accent âmbar)
- `/super-admin` — lista de agências com totais agregados (cards no topo)
- `/super-admin/nova` — formulário de criar agência + admin inicial (mostra credenciais geradas)
- `/super-admin/agencias/[id]` — detalhe com:
  - Métricas (users, vagas, candidatos, empresas, candidaturas)
  - Botões: Ativar / Bloquear / Renovar +30/+90/+365 dias
  - Lista de usuários da agência com toggle ativo/bloqueado

### Seed
- Super admin: `super@kairosrh.com` / `super123`

---

## Smoke tests Fase 6 (14/14 ✅)

| # | Teste | Esperado | Resultado |
|---|---|---|---|
| 1 | Login super admin | 200 + token | ✅ |
| 2 | /me super | 200 + name | ✅ |
| 3 | Lista todas agências (com contadores) | 200 + 3 agências | ✅ |
| 4 | Detalhe demo | users=2 apps=25 | ✅ |
| 5 | BLOQUEAR demo | 200 BLOQUEADA | ✅ |
| 6 | Login admin demo (agência BLOQUEADA) | 403 | ✅ |
| 7 | DESBLOQUEAR + RENOVAR 365 | 200 + nova data | ✅ |
| 8 | Login admin demo após desbloqueio | 200 | ✅ |
| 9 | Criar nova agência | 201 (ou 409 dup) | ✅ |
| 10 | Login admin nova agência | 200 | ✅ |
| 11 | Beta cria empresa | 201 | ✅ |
| 12 | Super admin tenta /api/companies | 401 (sem tenant) | ✅ |
| 13 | Logout super | 200 | ✅ |
| 14 | /me após logout | 401 (cookie limpo) | ✅ |

---

## Comportamento multi-tenant

- Super admin vê TODAS as agências (sem restrição de tenant)
- Super admin NÃO tem acesso direto a `/api/companies`, `/api/jobs`, etc. — essas rotas exigem JWT de tenant
- Pra operar DENTRO de uma agência, super admin precisaria impersonar (próxima fase)
- Bloqueio de agência (status=BLOQUEADA) já bloqueia login + /me em todas as rotas autenticadas

---

## Próxima fase (Fase 7 — Leitura de currículo com IA)

- Serviço `AIService` (OpenAI-compatible)
- Endpoint público já envia PDF — agora o texto será extraído e enviado pra IA
- Salvar dados estruturados em `candidates.ai_data` (JSON)
- Tela admin mostra campos extraídos + confiança
- OCR preparado (PDFs scaneados) usando `pdf-parse` + fallback `tesseract.js`
- **Modelo configurável por env** (`OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`)

Sigo pra Fase 7?