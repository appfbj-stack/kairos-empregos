'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Me {
  user: { id: string; name: string; email: string; role: string };
  agency: { id: string; name: string; slug: string; plan: string; status: string; primaryColor: string | null };
}

export default function DashboardPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(async (res) => {
        if (res.status === 401) { router.push('/'); return; }
        setMe(await res.json());
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-500">Carregando...</div>;
  if (!me) return null;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Olá, {me.user.name} 👋</h1>
        <p className="text-slate-600 text-sm mt-1">
          {me.agency.name} · Plano {me.agency.plan} · Status {me.agency.status}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Vagas abertas', value: 0, href: '/dashboard/vagas' },
          { label: 'Candidatos novos', value: '—', href: '#' },
          { label: 'Em análise', value: '—', href: '#' },
          { label: 'Env. p/ empresa', value: '—', href: '#' },
        ].map((c) => (
          <Link key={c.label} href={c.href} className="bg-white rounded-xl shadow p-4 hover:shadow-md transition">
            <div className="text-xs text-slate-500 uppercase tracking-wide">{c.label}</div>
            <div className="text-3xl font-bold mt-1">{c.value}</div>
          </Link>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Link href="/dashboard/vagas" className="bg-white rounded-xl shadow p-6 hover:shadow-md transition">
          <div className="text-2xl mb-2">💼</div>
          <div className="font-semibold">Vagas</div>
          <div className="text-sm text-slate-500 mt-1">Cadastre, publique e compartilhe vagas no WhatsApp.</div>
        </Link>
        <Link href="/dashboard/empresas" className="bg-white rounded-xl shadow p-6 hover:shadow-md transition">
          <div className="text-2xl mb-2">🏢</div>
          <div className="font-semibold">Empresas</div>
          <div className="text-sm text-slate-500 mt-1">Empresas clientes e seus dados de contato.</div>
        </Link>
      </div>

      <div className="mt-6 bg-slate-900 text-white rounded-xl p-5">
        <div className="font-semibold mb-1">🌐 Portal público da sua agência</div>
        <p className="text-sm text-slate-300 mb-3">
          Compartilhe este link para candidatos verem todas as vagas publicadas:
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-white/10 px-3 py-2 rounded text-sm truncate">
            {typeof window !== 'undefined' ? `${window.location.origin}/vagas/${me.agency.slug}` : `/vagas/${me.agency.slug}`}
          </code>
          <a
            href={`/vagas/${me.agency.slug}`}
            target="_blank"
            rel="noreferrer"
            className="bg-white text-slate-900 px-3 py-2 rounded text-sm font-medium hover:bg-slate-100"
          >
            Abrir ↗
          </a>
        </div>
      </div>

      <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
        <strong>📍 Próximas fases:</strong> Candidatos + CRM Kanban (Fases 3–5), Super Admin (Fase 6), IA de currículo (Fase 7), Matching (Fase 8).
      </div>
    </div>
  );
}