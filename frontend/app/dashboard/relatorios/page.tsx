'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface Dashboard {
  totals: { totalJobs: number; activeJobs: number; totalCandidates: number; totalCompanies: number; totalApplications: number; hiredCount: number; conversionRate: number };
  byStage: Array<{ stage: string; count: number }>;
  topJobs: Array<{ id: string; title: string; company: string | null; applicationsCount: number; status: string }>;
  timeseries: Array<{ day: string; count: number }>;
}

const STAGE_LABEL: Record<string, string> = {
  NOVO: 'Novos',
  EM_ANALISE: 'Em análise',
  PRE_SELECIONADO: 'Pré-selecionados',
  ENTREVISTA: 'Entrevistas',
  APROVADO: 'Aprovados',
  ENVIADO_EMPRESA: 'Enviados p/ empresa',
  CONTRATADO: 'Contratados',
  REPROVADO: 'Reprovados',
};

const STAGE_COLOR: Record<string, string> = {
  NOVO: 'bg-slate-500',
  EM_ANALISE: 'bg-blue-500',
  PRE_SELECIONADO: 'bg-amber-500',
  ENTREVISTA: 'bg-purple-500',
  APROVADO: 'bg-emerald-500',
  ENVIADO_EMPRESA: 'bg-cyan-500',
  CONTRATADO: 'bg-green-600',
  REPROVADO: 'bg-red-500',
};

export default function RelatoriosPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Dashboard>('/api/reports/dashboard')
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 text-slate-500">Carregando relatórios...</div>;
  if (error || !data) return <div className="p-6 text-red-600">{error || 'Erro ao carregar'}</div>;

  const { totals, byStage, topJobs, timeseries } = data;
  const maxByStage = Math.max(...byStage.map((b) => b.count), 1);
  const maxTs = Math.max(...timeseries.map((t) => t.count), 1);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Relatórios</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card label="Vagas abertas" value={totals.activeJobs} subtitle={`${totals.totalJobs} no total`} />
        <Card label="Candidatos" value={totals.totalCandidates} />
        <Card label="Candidaturas" value={totals.totalApplications} />
        <Card label="Contratações" value={totals.hiredCount} highlight subtitle={`Taxa de conversão: ${totals.conversionRate}%`} />
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="font-semibold mb-4">Pipeline global</h2>
          {byStage.length === 0 ? (
            <div className="text-slate-500 text-sm">Sem candidaturas ainda.</div>
          ) : (
            <div className="space-y-2">
              {byStage.map((b) => (
                <div key={b.stage}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{STAGE_LABEL[b.stage] || b.stage}</span>
                    <span className="font-medium">{b.count}</span>
                  </div>
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${STAGE_COLOR[b.stage] || 'bg-slate-400'} transition-all`}
                      style={{ width: `${(b.count / maxByStage) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="font-semibold mb-4">Top 5 vagas</h2>
          {topJobs.length === 0 ? (
            <div className="text-slate-500 text-sm">Sem vagas ainda.</div>
          ) : (
            <div className="space-y-2">
              {topJobs.map((j) => (
                <Link
                  key={j.id}
                  href={`/dashboard/pipeline?job=${j.id}`}
                  className="flex items-center justify-between p-2 hover:bg-slate-50 rounded"
                >
                  <div>
                    <div className="text-sm font-medium">{j.title}</div>
                    <div className="text-xs text-slate-500">{j.company || '—'} · {j.status}</div>
                  </div>
                  <div className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-xs font-medium">
                    {j.applicationsCount} cand.
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-5">
        <h2 className="font-semibold mb-4">Candidaturas nos últimos 30 dias</h2>
        {timeseries.length === 0 ? (
          <div className="text-slate-500 text-sm">Sem dados no período.</div>
        ) : (
          <div className="flex items-end gap-1 h-40">
            {timeseries.map((t) => (
              <div
                key={t.day}
                className="flex-1 bg-brand-500 rounded-t hover:bg-brand-600 transition relative group"
                style={{ height: `${(t.count / maxTs) * 100}%`, minHeight: '4px' }}
                title={`${t.day}: ${t.count}`}
              >
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 text-xs bg-slate-900 text-white px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap">
                  {t.day.slice(5)}: {t.count}
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="mt-2 text-xs text-slate-400 text-center">Passe o mouse sobre as barras para detalhes</div>
      </div>
    </div>
  );
}

function Card({ label, value, subtitle, highlight }: { label: string; value: number; subtitle?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl shadow p-4 ${highlight ? 'bg-emerald-50 ring-1 ring-emerald-200' : 'bg-white'}`}>
      <div className="text-xs text-slate-500 uppercase tracking-wide">{label}</div>
      <div className={`text-3xl font-bold mt-1 ${highlight ? 'text-emerald-700' : ''}`}>{value}</div>
      {subtitle && <div className="text-xs text-slate-500 mt-1">{subtitle}</div>}
    </div>
  );
}