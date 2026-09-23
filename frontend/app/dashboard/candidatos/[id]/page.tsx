'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface CandidateDetail {
  candidate: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string;
    cpf: string | null;
    city: string | null;
    state: string | null;
    birthDate: string | null;
    education: string | null;
    experience: string | null;
    desiredRole: string | null;
    salaryExpectation: string | null;
    availability: string | null;
    cnh: string | null;
    notes: string | null;
    resumeFilename: string | null;
    resumeUploadedAt: string | null;
    createdAt: string;
  };
  applications: Array<{
    id: string;
    stage: string;
    notes: string | null;
    createdAt: string;
    job: { id: string; slug: string; title: string };
    company: { id: string; tradeName: string | null };
  }>;
}

const STAGE_COLOR: Record<string, string> = {
  NOVO: 'bg-slate-100 text-slate-700',
  EM_ANALISE: 'bg-blue-100 text-blue-700',
  PRE_SELECIONADO: 'bg-amber-100 text-amber-700',
  ENTREVISTA: 'bg-purple-100 text-purple-700',
  APROVADO: 'bg-emerald-100 text-emerald-700',
  ENVIADO_EMPRESA: 'bg-cyan-100 text-cyan-700',
  CONTRATADO: 'bg-green-200 text-green-800',
  REPROVADO: 'bg-red-100 text-red-700',
};

const STAGES = ['NOVO', 'EM_ANALISE', 'PRE_SELECIONADO', 'ENTREVISTA', 'APROVADO', 'ENVIADO_EMPRESA', 'CONTRATADO', 'REPROVADO'];

interface MatchResult {
  match: 'ALTO' | 'MEDIO' | 'BAIXO';
  score: number;
  matches: Array<{ requirement: string; found: string }>;
  missing: Array<{ requirement: string; reason: string }>;
  summary: string;
  disclaimer: string;
}

const MATCH_COLOR: Record<string, string> = {
  ALTO: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  MEDIO: 'bg-amber-100 text-amber-800 border-amber-300',
  BAIXO: 'bg-red-100 text-red-800 border-red-300',
};

export default function CandidatoDetalhe() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<CandidateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [extracting, setExtracting] = useState(false);
  const [extractResult, setExtractResult] = useState<any>(null);
  const [openingResume, setOpeningResume] = useState(false);
  const [matchByJob, setMatchByJob] = useState<Record<string, { loading: boolean; result: MatchResult | null; error: string | null }>>({});

  function load() {
    setLoading(true);
    api<CandidateDetail>(`/api/candidates/${params.id}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [params.id]);

  async function changeStage(appId: string, stage: string) {
    try {
      await api(`/api/candidates/applications/${appId}/stage`, { method: 'PUT', body: JSON.stringify({ stage }) });
      load();
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function extractResume() {
    setExtracting(true);
    setExtractResult(null);
    try {
      const res = await api<{ ok: boolean; extracted: any; textLength: number }>(`/api/candidates/${params.id}/extract-resume`, { method: 'POST' });
      setExtractResult(res);
      load();
    } catch (e: any) {
      alert('Erro: ' + e.message);
    } finally {
      setExtracting(false);
    }
  }

  async function openResume(candidateId: string, filename: string) {
    setOpeningResume(true);
    try {
      // Fetch com Bearer do localStorage (link <a> direto não envia credencial)
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      const res = await fetch(`/api/candidates/${candidateId}/resume`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      // Libera blob URL depois que a aba abrir
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e: any) {
      alert('Erro ao abrir PDF: ' + e.message);
    } finally {
      setOpeningResume(false);
    }
  }

  async function analyzeMatch(jobId: string) {
    setMatchByJob((p) => ({ ...p, [jobId]: { loading: true, result: null, error: null } }));
    try {
      const res = await api<MatchResult>(`/api/jobs/${jobId}/match/${params.id}`, { method: 'POST' });
      setMatchByJob((p) => ({ ...p, [jobId]: { loading: false, result: res, error: null } }));
    } catch (e: any) {
      setMatchByJob((p) => ({ ...p, [jobId]: { loading: false, result: null, error: e.message } }));
    }
  }

  if (loading) return <div className="p-6 text-slate-500">Carregando...</div>;
  if (error || !data) return <div className="p-6 text-red-600">{error || 'Candidato não encontrado'}</div>;

  const c = data.candidate;

  return (
    <div className="p-6 max-w-4xl">
      <button onClick={() => router.push('/dashboard/candidatos')} className="text-sm text-slate-500 hover:text-slate-700 mb-3">
        ← Voltar
      </button>

      <div className="bg-white rounded-xl shadow p-6 mb-4">
        <h1 className="text-2xl font-bold">{c.fullName}</h1>
        <div className="text-sm text-slate-600 mt-1">
          {c.phone} · {c.email || 'sem e-mail'} · {c.city}{c.state ? `/${c.state}` : ''}
        </div>
        {c.desiredRole && <div className="text-sm mt-2"><strong>Cargo desejado:</strong> {c.desiredRole}</div>}
        {c.salaryExpectation && <div className="text-sm"><strong>Pretensão:</strong> R$ {c.salaryExpectation}</div>}
        {c.availability && <div className="text-sm"><strong>Disponibilidade:</strong> {c.availability}</div>}
        {c.cnh && <div className="text-sm"><strong>CNH:</strong> {c.cnh}</div>}

        {c.resumeFilename && (
          <div className="mt-4 p-3 bg-slate-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">📄 {c.resumeFilename}</div>
                {c.resumeUploadedAt && (
                  <div className="text-xs text-slate-500">
                    Enviado em {new Date(c.resumeUploadedAt).toLocaleString('pt-BR')}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => openResume(c.id, c.resumeFilename!)}
                  disabled={openingResume}
                  className="bg-brand-500 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-brand-600 disabled:opacity-50"
                >
                  {openingResume ? '⏳ Abrindo...' : 'Abrir'}
                </button>
                <button
                  onClick={extractResume}
                  disabled={extracting}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-sm disabled:opacity-50"
                >
                  {extracting ? '⏳ Extraindo...' : '🤖 Extrair com IA'}
                </button>
              </div>
            </div>
            {extractResult && (
              <div className="mt-3 p-2 bg-emerald-50 border border-emerald-200 rounded text-xs">
                ✅ Extraído: {extractResult.textLength} chars de texto.
                <details className="mt-2">
                  <summary className="cursor-pointer text-slate-600">Ver JSON</summary>
                  <pre className="mt-2 bg-white p-2 rounded text-[10px] overflow-x-auto">
                    {JSON.stringify(extractResult.extracted, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </div>
        )}

        {c.experience && (
          <div className="mt-4">
            <h3 className="font-semibold mb-1">Experiência</h3>
            <p className="text-sm text-slate-700 whitespace-pre-line">{c.experience}</p>
          </div>
        )}
        {c.education && (
          <div className="mt-3">
            <h3 className="font-semibold mb-1">Formação</h3>
            <p className="text-sm text-slate-700 whitespace-pre-line">{c.education}</p>
          </div>
        )}
        {c.notes && (
          <div className="mt-3">
            <h3 className="font-semibold mb-1">Observações</h3>
            <p className="text-sm text-slate-700 whitespace-pre-line">{c.notes}</p>
          </div>
        )}
      </div>

      <h2 className="text-xl font-bold mb-3">Candidaturas</h2>
      {data.applications.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center text-slate-500">Nenhuma candidatura.</div>
      ) : (
        <div className="space-y-3">
          {data.applications.map((a) => {
            const m = matchByJob[a.job.id];
            return (
              <div key={a.id} className="bg-white rounded-xl shadow p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{a.job.title}</div>
                    <div className="text-sm text-slate-600">{a.company.tradeName || '—'}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      Candidatou-se em {new Date(a.createdAt).toLocaleString('pt-BR')}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${STAGE_COLOR[a.stage]}`}>{a.stage}</span>
                    <select
                      value={a.stage}
                      onChange={(e) => changeStage(a.id, e.target.value)}
                      className="text-xs border rounded px-2 py-1"
                    >
                      {STAGES.map((s) => (
                        <option key={s} value={s}>→ {s}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => analyzeMatch(a.job.id)}
                      disabled={m?.loading}
                      className="text-xs bg-purple-100 text-purple-700 hover:bg-purple-200 px-2 py-1 rounded disabled:opacity-50"
                    >
                      {m?.loading ? '⏳ Analisando...' : '🤖 Analisar compatibilidade'}
                    </button>
                  </div>
                </div>

                {m?.error && (
                  <div className="mt-3 bg-red-50 text-red-700 p-2 rounded text-xs">{m.error}</div>
                )}

                {m?.result && (
                  <div className={`mt-3 p-3 rounded-lg border ${MATCH_COLOR[m.result.match]}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-bold">Match: {m.result.match} · Score: {m.result.score}/100</div>
                    </div>
                    <p className="text-sm italic mb-2">{m.result.summary}</p>
                    {m.result.matches.length > 0 && (
                      <div className="mb-2">
                        <div className="text-xs font-bold text-emerald-800 mb-1">✅ Compatibilidades</div>
                        <ul className="text-xs space-y-1">
                          {m.result.matches.map((mm, i) => (
                            <li key={i}><strong>{mm.requirement}:</strong> {mm.found}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {m.result.missing.length > 0 && (
                      <div className="mb-2">
                        <div className="text-xs font-bold text-red-800 mb-1">⚠️ Não confirmadas</div>
                        <ul className="text-xs space-y-1">
                          {m.result.missing.map((mm, i) => (
                            <li key={i}><strong>{mm.requirement}:</strong> {mm.reason}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <p className="text-[10px] text-slate-600 italic mt-2">{m.result.disclaimer}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}