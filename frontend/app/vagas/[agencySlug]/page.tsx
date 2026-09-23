'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { publicApi } from '@/lib/api';

interface PublicJobs {
  agency: { name: string; slug: string; primaryColor: string | null; city: string | null; state: string | null };
  jobs: Array<{
    id: string;
    slug: string;
    title: string;
    city: string | null;
    state: string | null;
    contractType: string | null;
    modality: string | null;
  }>;
}

export default function AgencyPublicPage() {
  const params = useParams<{ agencySlug: string }>();
  const [data, setData] = useState<PublicJobs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    publicApi<PublicJobs>(`/api/public/agencies/${params.agencySlug}/jobs`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [params.agencySlug]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-500">Carregando...</div>;
  if (error || !data) return <div className="min-h-screen flex items-center justify-center text-red-600">{error || 'Agência não encontrada'}</div>;

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(to bottom, #f8fafc 0%, #e2e8f0 100%)' }}>
      <header style={{ backgroundColor: data.agency.primaryColor || '#0F172A' }} className="text-white px-4 py-6 shadow">
        <div className="max-w-3xl mx-auto">
          <div className="text-xs opacity-80 mb-1">PORTAL DE VAGAS</div>
          <h1 className="text-3xl font-bold">{data.agency.name}</h1>
          <div className="text-sm opacity-90 mt-1">{data.agency.city}{data.agency.state ? `/${data.agency.state}` : ''}</div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4">
        {data.jobs.length === 0 ? (
          <div className="bg-white rounded-2xl shadow p-8 text-center text-slate-500">
            Nenhuma vaga publicada no momento.
          </div>
        ) : (
          <div className="space-y-3">
            {data.jobs.map((j) => (
              <Link
                key={j.id}
                href={`/vagas/${data.agency.slug}/${j.slug}`}
                className="block bg-white rounded-xl shadow p-4 hover:shadow-lg transition"
              >
                <div className="font-semibold text-lg">{j.title}</div>
                <div className="text-sm text-slate-600 mt-1">
                  {j.city}{j.state ? `/${j.state}` : ''} · {j.contractType} · {j.modality}
                </div>
                <div className="text-emerald-600 text-sm font-medium mt-2">Ver vaga →</div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}