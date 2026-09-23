'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Company {
  id: string;
  legalName: string;
  tradeName: string | null;
  cnpj: string | null;
  contactName: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  status: 'ATIVA' | 'INATIVA' | 'SUSPENSA';
}

export default function EmpresasPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ legalName: '', tradeName: '', cnpj: '', contactName: '', phone: '', whatsapp: '', email: '', city: '', state: '' });
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api<Company[]>('/api/companies')
      .then(setCompanies)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api('/api/companies', { method: 'POST', body: JSON.stringify(form) });
      setForm({ legalName: '', tradeName: '', cnpj: '', contactName: '', phone: '', whatsapp: '', email: '', city: '', state: '' });
      setShowForm(false);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Empresas</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-brand-500 text-white px-4 py-2 rounded-lg hover:bg-brand-600 transition"
        >
          {showForm ? 'Cancelar' : '+ Nova empresa'}
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4">{error}</div>}

      {showForm && (
        <form onSubmit={submit} className="bg-white rounded-xl shadow p-4 mb-4 grid grid-cols-2 gap-3">
          <input required placeholder="Razão social *" value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} className="px-3 py-2 border rounded-lg" />
          <input placeholder="Nome fantasia" value={form.tradeName} onChange={(e) => setForm({ ...form, tradeName: e.target.value })} className="px-3 py-2 border rounded-lg" />
          <input placeholder="CNPJ" value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} className="px-3 py-2 border rounded-lg" />
          <input placeholder="Responsável" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} className="px-3 py-2 border rounded-lg" />
          <input placeholder="Telefone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="px-3 py-2 border rounded-lg" />
          <input placeholder="WhatsApp" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} className="px-3 py-2 border rounded-lg" />
          <input placeholder="E-mail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="px-3 py-2 border rounded-lg" />
          <input placeholder="Cidade" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="px-3 py-2 border rounded-lg" />
          <input placeholder="UF" maxLength={2} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })} className="px-3 py-2 border rounded-lg" />
          <button type="submit" className="col-span-2 bg-emerald-600 text-white py-2 rounded-lg hover:bg-emerald-700">Salvar</button>
        </form>
      )}

      {loading ? (
        <div className="text-slate-500">Carregando...</div>
      ) : companies.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center text-slate-500">Nenhuma empresa cadastrada ainda.</div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="p-3">Razão social</th>
                <th className="p-3">Fantasia</th>
                <th className="p-3">CNPJ</th>
                <th className="p-3">Cidade/UF</th>
                <th className="p-3">Contato</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id} className="border-t hover:bg-slate-50">
                  <td className="p-3 font-medium">{c.legalName}</td>
                  <td className="p-3">{c.tradeName || '—'}</td>
                  <td className="p-3 text-slate-600">{c.cnpj || '—'}</td>
                  <td className="p-3">{c.city ? `${c.city}/${c.state}` : '—'}</td>
                  <td className="p-3 text-slate-600">{c.contactName || c.email || '—'}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${c.status === 'ATIVA' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {c.status}
                    </span>
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