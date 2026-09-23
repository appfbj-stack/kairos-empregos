# KAIROS RH — Fase 7

## O que foi implementado

### Backend
- **`src/lib/ai.ts`** — AI Service OpenAI-compatible
  - `extractResumeFromText({pdfText})` — chama `/chat/completions` com system prompt estruturado
  - `extractPdfText(buffer)` — extrai texto via `pdf-parse`
  - **Validação Zod** rigorosa da saída da IA (nenhum JSON livre é salvo sem schema)
  - **Modo STUB** automático se `OPENAI_API_KEY` não estiver setada (regex simples)
  - JSON output forçado (`response_format: { type: 'json_object' }`)
  - System prompt com regras explícitas: "NÃO invente", "null quando incerto"

- **3 novas rotas admin**:
  - `POST /api/candidates/:id/extract-resume` — extrai dados via IA, salva em `ai_data` + `ai_extracted_at`, e preenche campos vazios do candidato
  - `PUT /api/candidates/:id/resume` — substitui currículo (valida PDF + 5MB)
  - `DELETE /api/candidates/:id/resume` — remove currículo (limpa também aiData)

### Frontend
- Botão **"🤖 Extrair com IA"** no detalhe do candidato (próximo ao currículo)
- Mostra JSON estruturado extraído abaixo do botão após sucesso
- Loading state ("⏳ Extraindo...")
- Tratamento de erro via alert

### Schema de saída (Zod)
```ts
{
  fullName, email, phone, city, state, cnh, birthDate,
  education: [{ level, institution, year }],
  experiences: [{ company, role, startDate, endDate, description }],
  skills: string[],
  languages: string[],
  totalExperienceYears,
  expectedSalary,
  summary
}
```

### Configuração (env)
```
OPENAI_API_KEY=sk-...           # se ausente, usa modo STUB
OPENAI_BASE_URL=https://api.openai.com/v1  # ou OpenRouter
OPENAI_MODEL=gpt-4o-mini       # ou qualquer modelo compatível
```

---

## Smoke tests Fase 7 (10/10 ✅)

| # | Teste | Esperado | Resultado |
|---|---|---|---|
| 1 | POST candidatura com PDF | 201 | ✅ |
| 2 | Extract PDF fake | 422 (sem texto) | ✅ |
| 3 | PUT substituir PDF | 200 | ✅ |
| 4 | Re-extract | 422 | ✅ |
| 5 | aiExtractedAt vazio | null | ✅ |
| 6 | JPG em vez de PDF | 415 | ✅ |
| 7 | Candidato sem PDF | OK | ✅ |
| 8 | DELETE resume | 200 | ✅ |
| 9 | Extract sem PDF | 400 | ✅ |
| 10 | Cross-tenant extract | 404 | ✅ |

---

## Próxima fase (Fase 8 — Matching candidato × vaga)

- Novo endpoint: `POST /api/jobs/:id/match/:candidateId` (análise de compatibilidade)
- Apenas plano PROFISSIONAL (status check)
- LLM recebe descrição da vaga + dados do candidato, retorna JSON:
  ```
  { match: 'ALTO'|'MEDIO'|'BAIXO', score: 0-100, 
    matches: [{req, found}], 
    missing: [{req, reason}] }
  ```
- Frontend: botão "Analisar compatibilidade" no detalhe do candidato (quando aplicável)
- Disclaimer claro: "ferramenta auxiliar, não decisão automática"

Sigo pra Fase 8?