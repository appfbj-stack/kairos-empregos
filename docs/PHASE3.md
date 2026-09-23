# KAIROS RH — Fase 3

## O que foi implementado

### Banco de dados
- `candidates` — banco de talentos (FK agency_id, dados pessoais, currículo, aiData preparado pra Fase 7)
- `applications` — candidaturas (FK agency_id + candidate_id + job_id, enum `application_stage`)
- 1 novo enum: `application_stage` (NOVO, EM_ANALISE, PRE_SELECIONADO, ENTREVISTA, APROVADO, ENVIADO_EMPRESA, CONTRATADO, REPROVADO)

### Backend
- **Endpoint público** de candidatura: `POST /api/public/agencies/:slug/jobs/:slug/apply`
  - Aceita JSON com campos + currículo em base64 (até 5MB, valida header `%PDF-`)
  - **Auto-detecta candidato existente** por telefone OU e-mail (na mesma agency)
  - Atualiza dados básicos + currículo se já existir
  - Cria `candidate` (novo) + `application` (se ainda não houver pra essa vaga)
  - Retorna `confirmationMessage` da agência
- **Endpoints admin** (autenticados):
  - `GET /api/candidates` — lista banco de talentos (busca por nome/telefone/email/cargo)
  - `GET /api/candidates/:id` — detalhe + histórico de candidaturas
  - `GET /api/candidates/:id/resume` — download protegido (inline PDF)
  - `PUT /api/candidates/applications/:appId/stage` — move no Kanban (preparado pra Fase 5)
  - `GET /api/candidates/by-job/:jobId` — candidaturas agrupadas por vaga
- **Storage corrigido**:
  - Path absoluto (relativo ao source, não ao cwd)
  - Compatibilidade Windows (case-insensitive)

### Frontend
- `/vagas/[agencySlug]/[jobSlug]/candidatar` — formulário completo (whatsapp, e-mail, CPF, cidade/UF, formação, experiência, cargo desejado, pretensão, CNH, currículo PDF, consentimento LGPD)
- `/vagas/[agencySlug]/[jobSlug]/candidatar/confirmado` — tela de confirmação com mensagem customizada da agência
- `/dashboard/candidatos` — banco de talentos com busca ao vivo
- `/dashboard/candidatos/[id]` — detalhe do candidato + candidaturas + mudança de stage inline
- Sidebar com "Candidatos"

### Seed
- 30 candidatos fictícios + 25 candidaturas com estágios variados (NOVO → CONTRATADO)

---

## Smoke tests Fase 3 (14/14 ✅)

| # | Teste | Esperado | Resultado |
|---|---|---|---|
| 1 | GET /api/candidates demo | 200 + lista | ✅ |
| 2 | Busca por nome | 3 resultados | ✅ |
| 3 | POST candidatura novo candidato | 201 + newCandidate=true | ✅ |
| 4 | POST duplicado (mesmo telefone) | 201 + newCandidate=false | ✅ |
| 5 | POST com PDF válido | 201 + currículo salvo | ✅ |
| 6 | POST com JPG disfarçado | 415 | ✅ |
| 7 | POST em vaga RASCUNHO | 404 | ✅ |
| 8 | TESTE vê só seus candidatos | isolado | ✅ |
| 9 | DEMO busca candidato TESTE | 0 (isolamento!) | ✅ |
| 10 | TESTE vê seu candidato | 1 | ✅ |
| 11 | GET /resume autorizado | 200 + PDF | ✅ |
| 12 | PUT stage | 200 + EM_ANALISE | ✅ |
| 13 | 2ª candidatura duplicada (mesma vaga) | 1 app só | ✅ |
| 14 | GET /by-job/:id | 4 candidaturas | ✅ |

---

## Próxima fase (Fase 4 — Currículo PDF completo)

Já está parcialmente pronta. Falta:
- Substituir/excluir currículo pelo admin
- OCR preparado (PDFs scaneados) — biblioteca `pdf-parse` ou `tesseract.js`
- Visualização inline com PDF.js
- Limite de tamanho e MIME já implementado

**Próxima parada real: Fase 5 — CRM Kanban visual**
- Drag-and-drop entre colunas (Kanban)
- Filtros por vaga
- Notas internas por candidatura
- Tags personalizadas