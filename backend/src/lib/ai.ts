/**
 * AI Service — OpenAI-compatible (OpenRouter, OpenAI, Azure, MiniMax, etc).
 * Se OPENAI_API_KEY não estiver setada, usa um modo STUB que faz regex simples.
 * Saída sempre validada por Zod antes de retornar.
 */
import { z } from 'zod';
import { logger } from './logger.js';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.MiniMax.io/v1';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'MiniMax-M3';

export const AI_ENABLED = !!OPENAI_API_KEY;

// ===== Schema Zod do retorno da IA =====
export const AiResumeSchema = z.object({
  fullName: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  cnh: z.string().nullable().optional(),
  birthDate: z.string().nullable().optional(),
  education: z
    .array(
      z.object({
        level: z.string(),
        institution: z.string().optional().nullable(),
        year: z.string().optional().nullable(),
      })
    )
    .default([]),
  experiences: z
    .array(
      z.object({
        company: z.string().optional().nullable(),
        role: z.string(),
        startDate: z.string().optional().nullable(),
        endDate: z.string().optional().nullable(),
        description: z.string().optional().nullable(),
      })
    )
    .default([]),
  skills: z.array(z.string()).default([]),
  languages: z.array(z.string()).default([]),
  totalExperienceYears: z.number().nullable().optional(),
  expectedSalary: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
});

export type AiResume = z.infer<typeof AiResumeSchema>;

// ===== System prompt =====
const SYSTEM_PROMPT = `Você é um especialista em extração de dados de currículos brasileiros.
Extraia do texto abaixo APENAS informações que você encontra com ALTA CONFIANÇA.
Se uma informação não estiver clara, retorne null. NÃO invente.
Retorne JSON estrito seguindo este schema:

{
  "fullName": string|null,
  "email": string|null,
  "phone": string|null,
  "city": string|null,
  "state": string|null (sigla UF, ex: "SP"),
  "cnh": string|null (categoria: A, B, AB, C, D, E),
  "birthDate": string|null (YYYY-MM-DD se conseguir inferir),
  "education": [{"level": "fundamental|medio|tecnico|superior|pos", "institution": string|null, "year": string|null}],
  "experiences": [{"company": string|null, "role": string, "startDate": "YYYY-MM"|null, "endDate": "YYYY-MM"|null, "description": string|null}],
  "skills": [string],
  "languages": [string],
  "totalExperienceYears": number|null,
  "expectedSalary": string|null,
  "summary": string|null
}

Regras:
- Telefone no formato apenas dígitos (DDD + número)
- Estado sempre sigla de 2 letras maiúsculas
- Datas em ISO 8601 quando possível
- Skills como array simples ["Excel", "Atendimento ao cliente"]
- "summary" deve ser um parágrafo curto (1-3 frases) sobre o perfil
- NÃO inclua campos extras. Use null quando incerto. NÃO invente.`;

/**
 * Extrai JSON de uma resposta de LLM.
 * - Remove blocos <think>...</think> (MiniMax, alguns modelos)
 * - Tenta primeiro JSON fenced em ```json ... ```
 * - Se não achar, busca primeiro {...} no texto restante
 */
function extractJson(text: string): any {
  // Remove blocos <think> (alguns modelos como MiniMax emitem isso)
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '');

  // Tenta fenced primeiro
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fence) {
    try {
      return JSON.parse(fence[1]);
    } catch {}
  }

  // Tenta pegar o primeiro {...}
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch (e) {
      // tenta achar objeto balanceado
    }
  }
  throw new Error('IA não retornou JSON válido');
}

export interface ExtractResumeOptions {
  pdfText: string;
  maxTokens?: number;
  temperature?: number;
}

export async function extractResumeFromText(opts: ExtractResumeOptions): Promise<AiResume> {
  const { pdfText, maxTokens = 2000, temperature = 0.1 } = opts;

  if (!AI_ENABLED) {
    logger.warn('OPENAI_API_KEY não configurada — usando modo STUB (regex simples)');
    return stubExtract(pdfText);
  }

  const res = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: pdfText.slice(0, 15000) },
      ],
      temperature,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`IA retornou ${res.status}: ${body.slice(0, 300)}`);
  }

  const data: any = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('IA não retornou conteúdo');

  const parsed = extractJson(content);
  const validated = AiResumeSchema.safeParse(parsed);
  if (!validated.success) {
    logger.error({ errors: validated.error.format() }, 'IA retornou dados inválidos');
    throw new Error('IA retornou dados fora do schema esperado');
  }
  return validated.data;
}

/**
 * Stub — extração por regex quando não há API key.
 * Útil pra dev/testes.
 */
function stubExtract(text: string): AiResume {
  const phoneMatch = text.match(/(?:\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}/);
  const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  const cnhMatch = text.match(/CNH\s*[:\s]*([ABCDE]{1,2})/i);

  // Nome: primeira linha que tem 2+ palavras e começa com maiúscula
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const nameLine = lines.find((l) => /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+){1,}/.test(l));
  const fullName = nameLine?.split(/\s{2,}/)[0] ?? null;

  // Cidade/UF: "Cidade/UF" ou "Cidade - UF"
  const cityMatch = text.match(/([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç\s]+)[\/\-]\s*([A-Z]{2})/);

  // Experiências: linhas que começam com cargo em maiúscula + data
  const experiences: AiResume['experiences'] = [];
  const expRegex = /([A-Z][A-Za-z\s]{3,40})\s+(?:na|em|no|at)\s+([A-Z][\w\s.&-]{2,40})\s*[\(\|]?\s*(\d{4}|\d{1,2}\/\d{4})?/g;
  let m;
  while ((m = expRegex.exec(text)) !== null && experiences.length < 5) {
    experiences.push({ role: m[1].trim(), company: m[2].trim(), startDate: m[3] ?? null });
  }

  // Skills: palavras conhecidas comuns
  const skillsList = ['Excel', 'Word', 'PowerPoint', 'Atendimento', 'Vendas', 'Liderança', 'Comunicação', 'Pacote Office', 'Inglês', 'Espanhol', 'CNH', 'Carro', 'Moto'];
  const skills = skillsList.filter((s) => new RegExp(s, 'i').test(text));

  return {
    fullName,
    email: emailMatch?.[0] ?? null,
    phone: phoneMatch?.[0]?.replace(/\D/g, '') ?? null,
    city: cityMatch?.[1]?.trim() ?? null,
    state: cityMatch?.[2] ?? null,
    cnh: cnhMatch?.[1]?.toUpperCase() ?? null,
    birthDate: null,
    education: [],
    experiences,
    skills,
    languages: [],
    totalExperienceYears: null,
    expectedSalary: null,
    summary: 'Resumo gerado em modo stub (sem API de IA configurada). Configure OPENAI_API_KEY para extração completa.',
  };
}

/**
 * Extrai texto de um PDF (buffer).
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  // pdfjs-dist (Mozilla PDF.js) é mais robusto que pdf-parse em PDFs modernos.
  try {
    // @ts-ignore — pdfjs-dist não tem types oficiais completos
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    // Resolve worker via URL (ESM não tem require.resolve)
    // ai.ts compila para /app/dist/lib/ai.js → 2 '..' leva a /app (onde está node_modules)
    const { fileURLToPath } = await import('node:url');
    const { dirname, join } = await import('node:path');
    const { pathToFileURL } = await import('node:url');
    const workerPath = join(dirname(fileURLToPath(import.meta.url)), '../../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;

    const data = await pdfjs.getDocument({
      data: new Uint8Array(buffer),
      isEvalSupported: false,
      disableFontFace: true,
      useSystemFonts: false,
    }).promise;

    let text = '';
    for (let i = 1; i <= data.numPages; i++) {
      const page = await data.getPage(i);
      const content = await page.getTextContent();
      text += content.items
        .map((item: any) => ('str' in item ? item.str : ''))
        .join(' ') + '\n';
    }
    return text.trim();
  } catch (err: any) {
    throw new Error(`Falha ao extrair texto do PDF: ${err.message}. Se for PDF scaneado, use OCR.`);
  }
}

// ===== MATCHING CANDIDATO × VAGA =====

export const MatchSchema = z.object({
  match: z.enum(['ALTO', 'MEDIO', 'BAIXO']),
  score: z.number().min(0).max(100),
  matches: z.array(z.object({
    requirement: z.string(),
    found: z.string(),
  })).default([]),
  missing: z.array(z.object({
    requirement: z.string(),
    reason: z.string(),
  })).default([]),
  summary: z.string(),
  disclaimer: z.string().default(
    'Esta análise é uma ferramenta AUXILIAR. Não constitui decisão automática de contratação. O recrutador deve sempre avaliar o candidato pessoalmente.'
  ),
});

export type Match = z.infer<typeof MatchSchema>;

export interface MatchInput {
  job: {
    title: string;
    description: string | null;
    requirements: string | null;
    benefits: string | null;
    contractType: string | null;
    modality: string | null;
    schedule: string | null;
    city: string | null;
    state: string | null;
  };
  candidate: {
    fullName: string;
    email: string | null;
    phone: string;
    city: string | null;
    state: string | null;
    desiredRole: string | null;
    experience: string | null;
    education: string | null;
    skills: string | null; // CSV
    availability: string | null;
    cnh: string | null;
    aiData: any | null; // já extraído pela Fase 7
  };
}

const MATCH_SYSTEM_PROMPT = `Você é um assistente que ajuda RECRUTADORES a analisar compatibilidade entre candidato e vaga.
NÃO tome decisões de contratação. Sua análise é APENAS auxiliar.

Compare os dados do candidato com os requisitos da vaga e retorne JSON estrito:

{
  "match": "ALTO" | "MEDIO" | "BAIXO",
  "score": número 0-100,
  "matches": [{"requirement": "requisito X", "found": "evidência no candidato Y"}],
  "missing": [{"requirement": "requisito X", "reason": "por que não foi possível confirmar"}],
  "summary": "parágrafo curto (1-3 frases) explicando o veredito",
  "disclaimer": "sempre esta frase: 'Esta análise é uma ferramenta AUXILIAR. Não constitui decisão automática de contratação. O recrutador deve sempre avaliar o candidato pessoalmente.'"
}

Critérios:
- ALTO: candidato atende a maioria clara dos requisitos
- MEDIO: atende parcialmente, vale entrevista
- BAIXO: faltam requisitos essenciais
- score é uma confiança geral 0-100
- matches[] deve listar REQUISITOS ENCONTRADOS com EVIDÊNCIA do candidato
- missing[] deve listar REQUISITOS NÃO CONFIRMADOS com motivo
- Seja conservador: se não tem informação, vai pra missing, não invente`;

/**
 * Stub para matching quando não há API key.
 * Baseado em regras simples (palavras-chave + cidade).
 */
function stubMatch(input: MatchInput): Match {
  let score = 50;
  const matches: Match['matches'] = [];
  const missing: Match['missing'] = [];

  const req = (input.job.requirements || '').toLowerCase();
  const candExp = (input.candidate.experience || '').toLowerCase();
  const candEdu = (input.candidate.education || '').toLowerCase();

  // Ensino médio
  if (req.includes('ensino médio') || req.includes('ensino medio')) {
    if (candEdu.includes('médio') || candEdu.includes('medio') || candEdu.includes('superior')) {
      matches.push({ requirement: 'Ensino médio', found: 'Candidato possui formação compatível' });
      score += 15;
    } else {
      missing.push({ requirement: 'Ensino médio', reason: 'Formação do candidato não confirma' });
      score -= 10;
    }
  }

  // Experiência industrial
  if (req.includes('industrial') || req.includes('produção') || req.includes('producao')) {
    if (candExp.includes('industrial') || candExp.includes('produção') || candExp.includes('fabrica')) {
      matches.push({ requirement: 'Experiência industrial', found: candExp.slice(0, 80) });
      score += 20;
    } else {
      missing.push({ requirement: 'Experiência industrial', reason: 'Sem evidência no histórico' });
      score -= 15;
    }
  }

  // Cidade
  if (input.job.city && input.candidate.city) {
    if (input.job.city.toLowerCase() === input.candidate.city.toLowerCase()) {
      matches.push({ requirement: `Residir em ${input.job.city}`, found: `Candidato em ${input.candidate.city}` });
      score += 10;
    } else {
      missing.push({ requirement: `Residir em ${input.job.city}`, reason: `Candidato em ${input.candidate.city}` });
      score -= 5;
    }
  }

  score = Math.max(0, Math.min(100, score));
  const match: 'ALTO' | 'MEDIO' | 'BAIXO' = score >= 70 ? 'ALTO' : score >= 40 ? 'MEDIO' : 'BAIXO';

  return {
    match,
    score,
    matches,
    missing,
    summary: `Modo STUB (sem OPENAI_API_KEY): score ${score}/100 baseado em regras simples. Configure IA para análise semântica real.`,
    disclaimer: 'Esta análise é uma ferramenta AUXILIAR. Não constitui decisão automática de contratação.',
  };
}

export async function matchCandidateToJob(input: MatchInput): Promise<Match> {
  if (!AI_ENABLED) {
    logger.warn('OPENAI_API_KEY não configurada — usando STUB para matching');
    return stubMatch(input);
  }

  const userPrompt = `
# VAGA
${JSON.stringify(input.job, null, 2)}

# CANDIDATO
${JSON.stringify(input.candidate, null, 2)}

Analise a compatibilidade e retorne o JSON conforme schema.`;

  const res = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: MATCH_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`IA retornou ${res.status}: ${body.slice(0, 300)}`);
  }

  const data: any = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('IA não retornou conteúdo');

  const parsed = extractJson(content);
  const validated = MatchSchema.safeParse(parsed);
  if (!validated.success) {
    logger.error({ errors: validated.error.format() }, 'Matching IA retornou dados inválidos');
    throw new Error('IA retornou dados fora do schema esperado');
  }
  return validated.data;
}