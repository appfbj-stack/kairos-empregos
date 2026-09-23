'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { superApi } from '@/lib/superApi';

interface Agency {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  licenseStart: string | null;
  licenseEnd: string | null;
  city: string | null;
  state: string | null;
  primaryColor: string | null;
  createdAt: string;
  usersCount: number;
  jobsCount: number;
  candidatesCount: number;
  companiesCount: number;
}

const STATUS_COLOR: Record<string, string> = {
  ATIVA: 'bg-emerald-100 text-emerald-700',
  TESTE: 'bg-blue-100 text-blue-700',
  BLOQUEADA: 'bg-red-100 text-red-700',
  EXPIRADA: 'bg-amber-100 text-amber-700',
};

export default function SuperAdminPage() {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<{ blocked: number; names: string[] } | null>(null);

  function load() {
    setLoading(true);
    superApi<Agency[]>('/api/super-admin/agencies')
      .then(setAgencies)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  async function checkExpirations() {
    if (!confirm('Bloquear todas as agências com licença vencida (licenseEnd < hoje)? Essa ação muda o status para EXPIRADA.')) return;
    setChecking(true);
    setCheckResult(null);
    try {
      const r = await superApi<{ blocked: number; agencies: Array<{ name: string }> }>(
        '/api/super-admin/agencies/check-expirations',
        { method: 'POST' }
      );
      setCheckResult({ blocked: r.blocked, names: r.agencies.map((a) => a.name) });
      load();
    } catch (e: any) {
      alert('Erro: ' + e.message);
    } finally {
      setChecking(false);
    }
  }

  // Totais globais
  const totals = agencies.reduce(
    (acc, a) => ({
      users: acc.users + a.usersCount,
      jobs: acc.jobs + a.jobsCount,
      candidates: acc.candidates + a.candidatesCount,
      companies: acc.companies + a.companiesCount,
    }),
    { users: 0, jobs: 0, candidates: 0, companies: 0 }
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Agências</h1>
          <p className="text-sm text-slate-500">Gestão de tenants da plataforma</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={checkExpirations}
            disabled={checking}
            className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50"
            title="Bloquear agências com licença vencida"
          >
            {checking ? '⏳ Verificando...' : '🔄 Verificar expirações'}
          </button>
          <Link href="/super-admin/nova" className="bg-amber-500 hover:bg-amber-600 text-slate-900 px-4 py-2 rounded-lg font-medium">
            + Nova agência
          </Link>
        </div>
      </div>

      {checkResult && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${checkResult.blocked > 0 ? 'bg-amber-50 border border-amber-300 text-amber-800' : 'bg-emerald-50 border border-emerald-300 text-emerald-800'}`}>
          {checkResult.blocked === 0 ? (
            <>✅ Nenhuma agência vencida. Tudo certo.</>
          ) : (
            <>
              🚫 <strong>{checkResult.blocked}</strong> agência(s) bloqueada(s) por licença vencida: {checkResult.names.join(', ')}
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card label="Agências" value={agencies.length} />
        <Card label="Usuários" value={totals.users} />
        <Card label="Vagas" value={totals.jobs} />
        <Card label="Candidatos" value={totals.candidates} />
      </div>

      {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4">{error}</div>}

      {loading ? (
        <div className="text-slate-500">Carregando...</div>
      ) : agencies.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center text-slate-500">Nenhuma agência cadastrada.</div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="p-3">Agência</th>
                <th className="p-3">Plano</th>
                <th className="p-3">Status</th>
                <th className="p-3">Licença</th>
                <th className="p-3 text-right">Users</th>
                <th className="p-3 text-right">Vagas</th>
                <th className="p-3 text-right">Cands</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {agencies.map((a) => {
                const expired = a.licenseEnd && new Date(a.licenseEnd) < new Date();
                return (
                  <tr key={a.id} className="border-t hover:bg-slate-50">
                    <td className="p-3">
                      <div className="font-medium flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: a.primaryColor || '#0F172A' }}></span>
                        {a.name}
                      </div>
                      <div className="text-xs text-slate-500">/{a.slug} · {a.city}{a.state ? `/${a.state}` : ''}</div>
                    </td>
                    <td className="p-3">{a.plan}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLOR[a.status] || 'bg-slate-100 text-slate-700'}`}>
                        {a.status}
                      </span>
                    </td>
                    <td className="p-3 text-xs">
                      {a.licenseEnd ? new Date(a.licenseEnd).toLocaleDateString('pt-BR') : '—'}
                      {expired && <span className="ml-2 text-red-600">vencida</span>}
                    </td>
                    <td className="p-3 text-right">{a.usersCount}</td>
                    <td className="p-3 text-right">{a.jobsCount}</td>
                    <td className="p-3 text-right">{a.candidatesCount}</td>
                    <td className="p-3 text-right">
                      <Link href={`/super-admin/agencias/${a.id}`} className="text-xs bg-slate-900 text-white px-2 py-1 rounded hover:bg-slate-700">
                        Gerenciar →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Card({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-xl shadow p-4">
      <div className="text-xs text-slate-500 uppercase tracking-wide">{label}</div>
      <div className="text-3xl font-bold mt-1">{value}</div>
    </div>
  );
}