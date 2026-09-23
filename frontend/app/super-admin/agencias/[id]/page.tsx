'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { superApi } from '@/lib/superApi';

interface Detail {
  agency: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    status: string;
    licenseStart: string | null;
    licenseEnd: string | null;
    primaryColor: string | null;
    email: string | null;
    phone: string | null;
    city: string | null;
    state: string | null;
  };
  metrics: { usersCount: number; jobsCount: number; candidatesCount: number; companiesCount: number; applicationsCount: number };
  users: Array<{ id: string; name: string; email: string; role: string; isActive: boolean; lastLoginAt: string | null }>;
}

export default function AgenciaDetalhePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    superApi<Detail>(`/api/super-admin/agencies/${params.id}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, [params.id]);

  async function setStatus(status: string) {
    try {
      await superApi(`/api/super-admin/agencies/${params.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      load();
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function renew(days: number) {
    try {
      await superApi(`/api/super-admin/agencies/${params.id}/license`, {
        method: 'PATCH',
        body: JSON.stringify({ days }),
      });
      load();
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function toggleUser(userId: string) {
    try {
      await superApi(`/api/super-admin/users/${userId}/toggle-active`, { method: 'PATCH' });
      load();
    } catch (e: any) {
      alert(e.message);
    }
  }

  if (loading) return <div className="p-6 text-slate-500">Carregando...</div>;
  if (error || !data) return <div className="p-6 text-red-600">{error || 'Agência não encontrada'}</div>;

  const { agency, metrics, users } = data;
  const expired = agency.licenseEnd && new Date(agency.licenseEnd) < new Date();

  return (
    <div className="p-6">
      <button onClick={() => router.push('/super-admin')} className="text-sm text-slate-500 hover:text-slate-700 mb-3">
        ← Voltar
      </button>

      <div className="bg-white rounded-xl shadow p-6 mb-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <span className="w-4 h-4 rounded-full" style={{ backgroundColor: agency.primaryColor || '#0F172A' }}></span>
              {agency.name}
            </h1>
            <div className="text-sm text-slate-600 mt-1">
              /{agency.slug} · {agency.city}{agency.state ? `/${agency.state}` : ''}
              {agency.email && ` · ${agency.email}`}
              {agency.phone && ` · ${agency.phone}`}
            </div>
          </div>
          <div className="flex gap-2">
            {agency.status !== 'ATIVA' && (
              <button onClick={() => setStatus('ATIVA')} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-sm">
                Ativar
              </button>
            )}
            {agency.status !== 'BLOQUEADA' && (
              <button onClick={() => setStatus('BLOQUEADA')} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-sm">
                Bloquear
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mt-6">
          <Stat label="Plano" value={agency.plan} />
          <Stat label="Status" value={agency.status} highlight={expired ? 'text-red-600' : ''} />
          <Stat label="Licença até" value={agency.licenseEnd ? new Date(agency.licenseEnd).toLocaleDateString('pt-BR') : '—'} />
          <Stat label="Usuários" value={metrics.usersCount} />
          <Stat label="Vagas" value={metrics.jobsCount} />
        </div>

        <div className="grid grid-cols-3 gap-3 mt-3">
          <Stat label="Empresas" value={metrics.companiesCount} />
          <Stat label="Candidatos" value={metrics.candidatesCount} />
          <Stat label="Candidaturas" value={metrics.applicationsCount} />
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <span className="text-sm font-medium text-slate-700 mr-2">Renovar licença:</span>
          <button onClick={() => renew(30)} className="bg-slate-100 hover:bg-slate-200 px-3 py-1 rounded text-sm">+30 dias</button>
          <button onClick={() => renew(90)} className="bg-slate-100 hover:bg-slate-200 px-3 py-1 rounded text-sm">+90 dias</button>
          <button onClick={() => renew(365)} className="bg-slate-100 hover:bg-slate-200 px-3 py-1 rounded text-sm">+1 ano</button>
        </div>
      </div>

      <h2 className="text-xl font-bold mb-3">Usuários</h2>
      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="p-3">Nome</th>
              <th className="p-3">E-mail</th>
              <th className="p-3">Role</th>
              <th className="p-3">Último login</th>
              <th className="p-3">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="p-3 font-medium">{u.name}</td>
                <td className="p-3 text-slate-600">{u.email}</td>
                <td className="p-3">{u.role}</td>
                <td className="p-3 text-xs text-slate-500">
                  {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('pt-BR') : '—'}
                </td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${u.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                    {u.isActive ? 'Ativo' : 'Bloqueado'}
                  </span>
                </td>
                <td className="p-3 text-right">
                  <button onClick={() => toggleUser(u.id)} className="text-xs bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded">
                    {u.isActive ? 'Bloquear' : 'Reativar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: any; highlight?: string }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <div className="text-xs text-slate-500 uppercase tracking-wide">{label}</div>
      <div className={`text-lg font-bold mt-1 ${highlight || ''}`}>{value}</div>
    </div>
  );
}