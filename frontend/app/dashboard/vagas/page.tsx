'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Company {
  id: string;
  legalName: string;
  tradeName: string | null;
}

interface Job {
  id: string;
  slug: string;
  title: string;
  city: string | null;
  state: string | null;
  contractType: string | null;
  modality: string | null;
  salary: string | null;
  vacancies: number;
  status: 'RASCUNHO' | 'PUBLICADA' | 'PAUSADA' | 'ENCERRADA';
  companyId: string;
  companyName: string | null;
  createdAt: string;
}

interface Me {
  agency: { slug: string };
}

const STATUS_COLOR: Record<string, string> = {
  RASCUNHO: 'bg-slate-100 text-slate-700',
  PUBLICADA: 'bg-emerald-100 text-emerald-700',
  PAUSADA: 'bg-amber-100 text-amber-700',
  ENCERRADA: 'bg-red-100 text-red-700',
};

export default function VagasPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [agencySlug, setAgencySlug] = useState<string>('demo');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const [form, setForm] = useState({
    companyId: '',
    title: '',
    description: '',
    city: 'Sorocaba',
    state: 'SP',
    salary: '',
    contractType: 'CLT',
    modality: 'PRESENCIAL',
    schedule: '',
    requirements: '',
    benefits: '',
    vacancies: 1,
    status: 'RASCUNHO',
  });

  function load() {
    setLoading(true);
    Promise.all([api<Job[]>('/api/jobs'), api<Company[]>('/api/companies'), api<Me>('/api/auth/me')])
      .then(([j, c, m]) => {
        setJobs(j);
        setCompanies(c);
        setAgencySlug(m.agency.slug);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api('/api/jobs', { method: 'POST', body: JSON.stringify({ ...form, salary: form.salary ? Number(form.salary) : null }) });
      setShowForm(false);
      setForm({ ...form, title: '', description: '', requirements: '', benefits: '', schedule: '' });
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function changeStatus(id: string, status: Job['status']) {
    try {
      await api(`/api/jobs/${id}`, { method: 'PUT', body: JSON.stringify({ status }) });
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  function publicUrl(slug: string) {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/vagas/${agencySlug}/${slug}`;
  }

  async function copyLink(slug: string) {
    try {
      await navigator.clipboard.writeText(publicUrl(slug));
      setCopied(slug);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setError('Não foi possível copiar');
    }
  }

  function whatsappLink(j: Job) {
    const url = publicUrl(j.slug);
    const txt = `🚀 *${j.title}*\n\n📍 ${j.city || ''}${j.state ? '/' + j.state : ''}\n💼 ${j.contractType || ''} · ${j.modality || ''}\n\nCandidate-se: ${url}`;
    return `https://wa.me/?text=${encodeURIComponent(txt)}`;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Vagas</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-brand-500 text-white px-4 py-2 rounded-lg hover:bg-brand-600 transition"
        >
          {showForm ? 'Cancelar' : '+ Nova vaga'}
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4">{error}</div>}

      {showForm && (
        <form onSubmit={submit} className="bg-white rounded-xl shadow p-4 mb-4 grid grid-cols-2 gap-3">
          <select required value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })} className="px-3 py-2 border rounded-lg col-span-2">
            <option value="">Selecione a empresa *</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.tradeName || c.legalName}</option>
            ))}
          </select>
          <input required placeholder="Título da vaga *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="px-3 py-2 border rounded-lg col-span-2" />
          <input placeholder="Cidade" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="px-3 py-2 border rounded-lg" />
          <input placeholder="UF" maxLength={2} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })} className="px-3 py-2 border rounded-lg" />
          <input placeholder="Salário (R$)" type="number" step="0.01" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} className="px-3 py-2 border rounded-lg" />
          <select value={form.contractType} onChange={(e) => setForm({ ...form, contractType: e.target.value })} className="px-3 py-2 border rounded-lg">
            <option>CLT</option><option>PJ</option><option>TEMPORARIO</option><option>ESTAGIO</option><option>FREELA</option>
          </select>
          <select value={form.modality} onChange={(e) => setForm({ ...form, modality: e.target.value })} className="px-3 py-2 border rounded-lg">
            <option>PRESENCIAL</option><option>REMOTO</option><option>HIBRIDO</option>
          </select>
          <input type="number" min={1} placeholder="Qtd vagas" value={form.vacancies} onChange={(e) => setForm({ ...form, vacancies: Number(e.target.value) })} className="px-3 py-2 border rounded-lg" />
          <input placeholder="Horário" value={form.schedule} onChange={(e) => setForm({ ...form, schedule: e.target.value })} className="px-3 py-2 border rounded-lg" />
          <textarea placeholder="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="px-3 py-2 border rounded-lg col-span-2" rows={2} />
          <textarea placeholder="Requisitos" value={form.requirements} onChange={(e) => setForm({ ...form, requirements: e.target.value })} className="px-3 py-2 border rounded-lg" rows={2} />
          <textarea placeholder="Benefícios" value={form.benefits} onChange={(e) => setForm({ ...form, benefits: e.target.value })} className="px-3 py-2 border rounded-lg" rows={2} />
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="px-3 py-2 border rounded-lg">
            <option value="RASCUNHO">Salvar como rascunho</option>
            <option value="PUBLICADA">Publicar agora</option>
          </select>
          <button type="submit" className="bg-emerald-600 text-white py-2 rounded-lg hover:bg-emerald-700">Salvar vaga</button>
        </form>
      )}

      {loading ? (
        <div className="text-slate-500">Carregando...</div>
      ) : jobs.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center text-slate-500">Nenhuma vaga cadastrada.</div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="p-3">Título</th>
                <th className="p-3">Empresa</th>
                <th className="p-3">Cidade</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Vagas</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} className="border-t hover:bg-slate-50">
                  <td className="p-3 font-medium">{j.title}</td>
                  <td className="p-3">{j.companyName}</td>
                  <td className="p-3">{j.city}{j.state ? `/${j.state}` : ''}</td>
                  <td className="p-3">{j.contractType} · {j.modality}</td>
                  <td className="p-3">{j.vacancies}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLOR[j.status]}`}>{j.status}</span>
                  </td>
                  <td className="p-3 text-right space-x-2 whitespace-nowrap">
                    {j.status === 'PUBLICADA' && (
                      <>
                        <button onClick={() => copyLink(j.slug)} className="text-xs bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded">
                          {copied === j.slug ? '✓ Copiado!' : '📋 Copiar link'}
                        </button>
                        <a href={whatsappLink(j)} target="_blank" rel="noreferrer" className="text-xs bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-2 py-1 rounded">
                          💬 WhatsApp
                        </a>
                      </>
                    )}
                    {j.status === 'RASCUNHO' && (
                      <button onClick={() => changeStatus(j.id, 'PUBLICADA')} className="text-xs bg-emerald-600 text-white px-2 py-1 rounded hover:bg-emerald-700">
                        Publicar
                      </button>
                    )}
                    {j.status === 'PUBLICADA' && (
                      <button onClick={() => changeStatus(j.id, 'PAUSADA')} className="text-xs bg-amber-500 text-white px-2 py-1 rounded hover:bg-amber-600">
                        Pausar
                      </button>
                    )}
                    {j.status === 'PAUSADA' && (
                      <button onClick={() => changeStatus(j.id, 'PUBLICADA')} className="text-xs bg-emerald-600 text-white px-2 py-1 rounded hover:bg-emerald-700">
                        Reativar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}