'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface Me {
  user: { id: string; name: string; email: string; role: string };
}

const links = [
  { href: '/super-admin', label: 'Agências', icon: '🏢' },
  { href: '/super-admin/nova', label: 'Criar agência', icon: '➕' },
];

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('super_token');
    if (!token) {
      if (!pathname.includes('/login')) router.push('/super-admin/login');
      setAuthChecked(true);
      return;
    }
    fetch('/api/super-admin/me', { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' })
      .then(async (r) => {
        if (r.status === 401) {
          localStorage.removeItem('super_token');
          router.push('/super-admin/login');
          return;
        }
        setMe(await r.json());
      })
      .catch(() => {})
      .finally(() => setAuthChecked(true));
  }, [pathname, router]);

  // Fecha drawer ao mudar de rota
  useEffect(() => { setOpen(false); }, [pathname]);

  async function logout() {
    await fetch('/api/super-admin/logout', { method: 'POST', credentials: 'include' });
    localStorage.removeItem('super_token');
    router.push('/super-admin/login');
  }

  if (pathname.includes('/login')) {
    return <div className="min-h-screen bg-slate-900">{children}</div>;
  }

  if (!authChecked || !me) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Carregando...</div>;
  }

  const sidebarContent = (
    <>
      <div className="p-5 border-b border-slate-700">
        <div className="text-xs uppercase tracking-wide text-amber-400 mb-1">SUPER ADMIN</div>
        <div className="text-xl font-bold">KAIROS RH</div>
        <div className="text-xs text-slate-400 mt-1 truncate">{me.user.name}</div>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {links.map((l) => {
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${active ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5'}`}
            >
              <span>{l.icon}</span>
              <span>{l.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-slate-700">
        <button onClick={logout} className="w-full bg-white/10 hover:bg-white/20 text-sm py-1.5 rounded-lg transition">
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

      {/* Sidebar desktop */}
      <aside className="hidden md:flex w-64 bg-slate-900 text-slate-100 flex-col flex-shrink-0">
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

      <main className="flex-1 min-w-0 overflow-auto p-4 md:p-6 pt-16 md:pt-6">{children}</main>
    </>
  );
}