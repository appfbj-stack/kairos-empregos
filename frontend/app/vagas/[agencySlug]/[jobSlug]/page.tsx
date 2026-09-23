'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { publicApi } from '@/lib/api';

interface PublicJobData {
  job: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    city: string | null;
    state: string | null;
    salary: string | null;
    contractType: string | null;
    modality: string | null;
    schedule: string | null;
    requirements: string | null;
    benefits: string | null;
    vacancies: number;
    publishedAt: string | null;
    deadlineAt: string | null;
    company: { id: string; tradeName: string | null; legalName: string };
  };
  agency: {
    name: string;
    slug: string;
    primaryColor: string | null;
    phone: string | null;
    whatsapp: string | null;
    email: string | null;
    city: string | null;
    state: string | null;
    description: string | null;
    confirmationMessage: string | null;
  };
}

const CONTRACT_LABEL: Record<string, string> = {
  CLT: 'CLT',
  PJ: 'Pessoa Jurídica',
  TEMPORARIO: 'Temporário',
  ESTAGIO: 'Estágio',
  FREELA: 'Freelancer',
};
const MODALITY_LABEL: Record<string, string> = {
  PRESENCIAL: 'Presencial',
  REMOTO: 'Remoto',
  HIBRIDO: 'Híbrido',
};

export default function PublicJobPage() {
  const params = useParams<{ agencySlug: string; jobSlug: string }>();
  const router = useRouter();
  const [data, setData] = useState<PublicJobData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    publicApi<PublicJobData>(`/api/public/agencies/${params.agencySlug}/jobs/${params.jobSlug}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [params.agencySlug, params.jobSlug]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-500">Carregando vaga...</div>;
  if (error || !data) return <div className="min-h-screen flex items-center justify-center text-red-600">{error || 'Vaga não encontrada'}</div>;

  const { job, agency } = data;

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(to bottom, #f8fafc 0%, #e2e8f0 100%)' }}>
      <header style={{ backgroundColor: agency.primaryColor || '#0F172A' }} className="text-white px-4 py-5 shadow">
        <div className="max-w-3xl mx-auto">
          <div className="text-xs opacity-80 mb-1">VAGA DE EMPREGO</div>
          <h1 className="text-2xl font-bold">{job.title}</h1>
          <div className="mt-2 text-sm opacity-90">
            {job.company.tradeName || job.company.legalName} · {job.city}{job.state ? `/${job.state}` : ''}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-4">
        <div className="bg-white rounded-2xl shadow p-6 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <div>
              <div className="text-slate-500 text-xs uppercase">Salário</div>
              <div className="font-semibold">{job.salary ? `R$ ${job.salary}` : 'A combinar'}</div>
            </div>
            <div>
              <div className="text-slate-500 text-xs uppercase">Contratação</div>
              <div className="font-semibold">{CONTRACT_LABEL[job.contractType || ''] || '—'}</div>
            </div>
            <div>
              <div className="text-slate-500 text-xs uppercase">Modalidade</div>
              <div className="font-semibold">{MODALITY_LABEL[job.modality || ''] || '—'}</div>
            </div>
            <div>
              <div className="text-slate-500 text-xs uppercase">Vagas</div>
              <div className="font-semibold">{job.vacancies}</div>
            </div>
            {job.schedule && (
              <div>
                <div className="text-slate-500 text-xs uppercase">Horário</div>
                <div className="font-semibold">{job.schedule}</div>
              </div>
            )}
            {job.deadlineAt && (
              <div>
                <div className="text-slate-500 text-xs uppercase">Prazo</div>
                <div className="font-semibold">{new Date(job.deadlineAt).toLocaleDateString('pt-BR')}</div>
              </div>
            )}
          </div>

          {job.description && (
            <div>
              <h2 className="font-semibold mb-1">Descrição</h2>
              <p className="text-slate-700 text-sm whitespace-pre-line">{job.description}</p>
            </div>
          )}
          {job.requirements && (
            <div>
              <h2 className="font-semibold mb-1">Requisitos</h2>
              <p className="text-slate-700 text-sm whitespace-pre-line">{job.requirements}</p>
            </div>
          )}
          {job.benefits && (
            <div>
              <h2 className="font-semibold mb-1">Benefícios</h2>
              <p className="text-slate-700 text-sm whitespace-pre-line">{job.benefits}</p>
            </div>
          )}

          <button
            onClick={() => router.push(`/vagas/${params.agencySlug}/${params.jobSlug}/candidatar`)}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-lg font-bold py-4 rounded-xl transition shadow-lg"
          >
            CANDIDATAR-SE
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow p-6 text-sm">
          <h2 className="font-semibold mb-2">Sobre a agência</h2>
          <div className="font-medium">{agency.name}</div>
          {agency.description && <p className="text-slate-600 mt-1">{agency.description}</p>}
          <div className="mt-2 text-slate-600 text-xs">
            {agency.city}{agency.state ? `/${agency.state}` : ''}
            {agency.phone && ` · ${agency.phone}`}
            {agency.email && ` · ${agency.email}`}
          </div>
        </div>

        <div className="text-center text-xs text-slate-400 py-4">
          KAIROS RH · plataforma de recrutamento
        </div>
      </main>
    </div>
  );
}