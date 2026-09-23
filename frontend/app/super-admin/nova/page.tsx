'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { superApi } from '@/lib/superApi';

export default function NovaAgenciaPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    slug: '',
    plan: 'ESSENCIAL',
    adminEmail: '',
    adminPassword: '',
    adminName: '',
    licenseDays: 30,
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<{ agency: any; credentials: any } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await superApi<{ agency: any; credentials: any }>('/api/super-admin/agencies', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setCreated({ agency: result.agency, credentials: result.credentials });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    return (
      <div className="p-6 max-w-xl">
        <div className="bg-white rounded-xl shadow p-6">
          <div className="text-3xl mb-3">✅</div>
          <h1 className="text-2xl font-bold mb-2">Agência criada!</h1>
          <p className="text-slate-600 mb-4">A agência <strong>{created.agency.name}</strong> (slug <code>/{created.agency.slug}</code>) está ativa.</p>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <div className="font-semibold mb-1">Credenciais do admin</div>
            <div className="text-sm">E-mail: <code>{created.credentials.email}</code></div>
            <div className="text-sm">Senha: <code>{created.credentials.password}</code></div>
            <div className="text-xs text-slate-500 mt-2">Copie e envie ao cliente por canal seguro.</div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => router.push('/super-admin')} className="bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-700">
              Voltar para lista
            </button>
            <button onClick={() => setCreated(null)} className="bg-slate-200 px-4 py-2 rounded-lg hover:bg-slate-300">
              Criar outra
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-2xl font-bold mb-4">Nova agência</h1>

      <form onSubmit={submit} className="bg-white rounded-xl shadow p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Nome da agência *</label>
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: form.slug || e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-') })} className="w-full px-3 py-2 border rounded-lg" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Slug (URL)</label>
          <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="w-full px-3 py-2 border rounded-lg" placeholder="auto a partir do nome" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Plano</label>
            <select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
              <option value="ESSENCIAL">Essencial (R$ 397/ano)</option>
              <option value="PROFISSIONAL">Profissional (R$ 697/ano)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Licença (dias)</label>
            <input type="number" min={1} value={form.licenseDays} onChange={(e) => setForm({ ...form, licenseDays: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-lg" />
          </div>
        </div>

        <hr />

        <h3 className="font-semibold">Admin inicial</h3>
        <div>
          <label className="block text-sm font-medium mb-1">Nome completo *</label>
          <input required value={form.adminName} onChange={(e) => setForm({ ...form, adminName: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">E-mail *</label>
            <input required type="email" value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Senha *</label>
            <input required minLength={6} type="text" value={form.adminPassword} onChange={(e) => setForm({ ...form, adminPassword: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
          </div>
        </div>

        {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>}

        <button type="submit" disabled={submitting} className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold py-2.5 rounded-lg disabled:opacity-50">
          {submitting ? 'Criando...' : 'Criar agência'}
        </button>
      </form>
    </div>
  );
}