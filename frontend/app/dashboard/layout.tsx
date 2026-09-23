import Sidebar from '@/components/Sidebar';
import PWAInstall from '@/components/PWAInstall';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 min-w-0 p-4 md:p-6 pt-16 md:pt-6">{children}</main>
      <PWAInstall />
    </div>
  );
}