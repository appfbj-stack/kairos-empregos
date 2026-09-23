'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface Me {
  user: { id: string; name: string; email: string; role: string };
  agency: { id: string; name: string; slug: string; primaryColor: string | null };
}

const links = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/dashboard/vagas', label: 'Vagas', icon: '💼' },
  { href: '/dashboard/empresas', label: 'Empresas', icon: '🏢' },
  { href: '/dashboard/candidatos', label: 'Candidatos', icon: '👥' },
  { href: '/dashboard/pipeline', label: 'Pipeline', icon: '🧩' },
  { href: '/dashboard/relatorios', label: 'Relatórios', icon: '📈' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    import('@/lib/api').then(({ api }) =>
      api<Me>('/api/auth/me')
        .then(setMe)
        .catch(() => router.push('/'))
    );
  }, [router]);

  // Fecha drawer ao mudar de rota
  useEffect(() => { setOpen(false); }, [pathname]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    localStorage.removeItem('auth_token');
    router.push('/');
  }

  const sidebarContent = (
    <>
      <div className="p-5 border-b border-slate-700">
        <div className="text-xl font-bold">KAIROS RH</div>
        <div className="text-xs text-slate-400 mt-1 truncate">{me ? me.agency.name : '...'}</div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {links.map((l) => {
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition ${
                active ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span>{l.icon}</span>
              <span className="text-sm">{l.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-slate-700">
        <div className="text-xs text-slate-400 mb-2 truncate">
          {me ? `${me.user.name} · ${me.user.role}` : ''}
        </div>
        <button
          onClick={logout}
          className="w-full bg-white/10 hover:bg-white/20 text-sm py-1.5 rounded-lg transition"
        >
          Sair
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Botão hamburger (só mobile) */}
      <button
        onClick={() => setOpen(true)}
        className="md:hidden fixed top-3 left-3 z-40 bg-slate-900 text-white w-10 h-10 rounded-lg shadow-lg flex items-center justify-center text-lg"
        aria-label="Abrir menu"
      >
        ☰
      </button>

      {/* Sidebar desktop (md+) — fixa */}
      <aside className="hidden md:flex w-60 bg-slate-900 text-slate-100 min-h-screen flex-col flex-shrink-0">
        {sidebarContent}
      </aside>

      {/* Drawer mobile */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="relative w-64 max-w-[80vw] bg-slate-900 text-slate-100 h-full flex flex-col">
            <button
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 text-slate-400 hover:text-white text-2xl leading-none"
              aria-label="Fechar menu"
            >
              ×
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}