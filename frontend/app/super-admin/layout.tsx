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

  useEffect(() => {
    const token = localStorage.getItem('super_token');
    if (!token) {
      // Não está logado: redireciona (exceto na página de login)
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

  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col">
        <div className="p-5 border-b border-slate-700">
          <div className="text-xs uppercase tracking-wide text-amber-400 mb-1">SUPER ADMIN</div>
          <div className="text-xl font-bold">KAIROS RH</div>
          <div className="text-xs text-slate-400 mt-1">{me.user.name}</div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link key={l.href} href={l.href} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${active ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5'}`}>
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
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}