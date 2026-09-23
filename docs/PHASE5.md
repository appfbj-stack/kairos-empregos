# KAIROS RH — Fase 5

## O que foi implementado

### Backend
- **Nova rota**: `PUT /api/candidates/applications/:appId/notes` — atualiza notas internas (max 2000 chars)
- Backend já tinha (Fase 3): `PUT /api/candidates/applications/:appId/stage` + `GET /api/candidates/by-job/:jobId`
- Validação Zod: stage deve ser enum válido; notas limitadas em 2000 chars
- Multi-tenant preservado (cross-tenant → 404)

### Frontend
- **Página `/dashboard/pipeline`** — Kanban visual estilo Trello
  - Seletor de vaga no topo
  - 8 colunas de estágio (Novo → Contratado + Reprovado)
  - Cards com nome, telefone, cidade, cargo desejado, ícone de currículo, notas internas
  - **Drag-and-drop com @dnd-kit/core** entre colunas
  - Atualização otimista (move o card visualmente antes do backend confirmar)
  - Rollback automático se a API falhar
  - `DragOverlay` mostra preview rotacionado enquanto arrasta
- **Sidebar** agora tem "Pipeline"
- Card é clicável (abre `/dashboard/candidatos/[id]`), separadamente do drag
- Instalado `@dnd-kit/core` (e sortable/utilities pra fase futura)

---

## Smoke tests Fase 5 (8/8 ✅)

| # | Teste | Esperado | Resultado |
|---|---|---|---|
| 1 | Candidaturas por stage | agrupadas | ✅ |
| 2 | PUT stage NOVO→ENTREVISTA | 200 | ✅ |
| 3 | PUT notes (78 chars) | 200 | ✅ |
| 4 | Stage inválido | 400 | ✅ |
| 5 | Notes > 2000 chars | 400 | ✅ |
| 6 | TESTE move candidatura DEMO | 404 | ✅ |
| 7 | Stage persistiu | ENTREVISTA | ✅ |
| 8 | Isolamento by-job | DEMO 2, TESTE 0 | ✅ |

---

## UX do Kanban

- Click no card → abre perfil do candidato (NÃO move)
- Drag no card → move de coluna (com preview rotacionado)
- Coluna alvo destaca com anel durante hover
- Atualização otimista: card já aparece na nova coluna enquanto a API processa
- Se a API falhar, card volta pra coluna original

---

## Próxima fase (Fase 6 — Super Admin)

- Tabela `super_admins` (separada de `users` de agência)
- Login separado em `/super-admin/login`
- Painel `/super-admin`:
  - Lista de agências (plano, status, licença, contadores)
  - Ações: BLOQUEAR, DESBLOQUEAR, RENOVAR, REVERTER PRA TESTE
  - Criar nova agência (signup manual)
  - Visualizar métricas globais (MRR simulado, total candidatos, etc)
- Status automático: tarefa cron diária muda `status` para `EXPIRADA` quando `license_end < NOW()`
- Caddy: novo subdomínio `admin.fbautomacao.space` (ou manter local)

Sigo pra Fase 6?