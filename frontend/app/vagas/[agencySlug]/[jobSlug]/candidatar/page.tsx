'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { publicApi } from '@/lib/api';

interface JobData {
  job: { title: string; city: string | null; state: string | null; company: { tradeName: string | null; legalName: string } };
  agency: { name: string; slug: string; primaryColor: string | null; confirmationMessage: string | null };
}

export default function CandidatarPage() {
  const params = useParams<{ agencySlug: string; jobSlug: string }>();
  const router = useRouter();
  const [job, setJob] = useState<JobData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    cpf: '',
    city: '',
    state: '',
    birthDate: '',
    education: '',
    experience: '',
    desiredRole: '',
    salaryExpectation: '',
    availability: 'Imediata',
    cnh: '',
    notes: '',
    consent: false,
  });
  const [resume, setResume] = useState<File | null>(null);

  useEffect(() => {
    publicApi<JobData>(`/api/public/agencies/${params.agencySlug}/jobs/${params.jobSlug}`)
      .then(setJob)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [params.agencySlug, params.jobSlug]);

  function fileToBase64(f: File): Promise<string> {
    return new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = () => res(String(reader.result).split(',')[1]);
      reader.onerror = rej;
      reader.readAsDataURL(f);
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.consent) {
      setError('Você precisa aceitar a Política de Privacidade para se candidatar.');
      return;
    }
    setSubmitting(true);
    try {
      const payload: any = {
        fullName: form.fullName,
        email: form.email || undefined,
        phone: form.phone,
        cpf: form.cpf || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        birthDate: form.birthDate || undefined,
        education: form.education || undefined,
        experience: form.experience || undefined,
        desiredRole: form.desiredRole || undefined,
        salaryExpectation: form.salaryExpectation ? Number(form.salaryExpectation) : undefined,
        availability: form.availability || undefined,
        cnh: form.cnh || undefined,
        notes: form.notes || undefined,
      };
      if (resume) {
        if (resume.size > 5 * 1024 * 1024) {
          throw new Error('Currículo deve ter no máximo 5MB');
        }
        payload.resumeBase64 = await fileToBase64(resume);
        payload.resumeFilename = resume.name;
      }
      const result = await publicApi<{ confirmationMessage: string; jobTitle: string; agencyName: string; newCandidate: boolean }>(
        `/api/public/agencies/${params.agencySlug}/jobs/${params.jobSlug}/apply`,
        { method: 'POST', body: JSON.stringify(payload) }
      );
      const qs = new URLSearchParams({
        msg: result.confirmationMessage,
        job: result.jobTitle,
        new: String(result.newCandidate),
      });
      router.push(`/vagas/${params.agencySlug}/${params.jobSlug}/candidatar/confirmado?${qs}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-500">Carregando...</div>;
  if (error || !job) return <div className="min-h-screen flex items-center justify-center text-red-600 p-4">{error || 'Vaga não encontrada'}</div>;

  const primary = job.agency.primaryColor || '#0F172A';

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(to bottom, #f8fafc 0%, #e2e8f0 100%)' }}>
      <header style={{ backgroundColor: primary }} className="text-white px-4 py-5 shadow">
        <div className="max-w-2xl mx-auto">
          <div className="text-xs opacity-80 mb-1">CANDIDATURA</div>
          <h1 className="text-xl font-bold">{job.job.title}</h1>
          <div className="text-sm opacity-90 mt-1">
            {job.job.company.tradeName || job.job.company.legalName} · {job.job.city}{job.job.state ? `/${job.job.state}` : ''}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4">
        <form onSubmit={submit} className="bg-white rounded-2xl shadow p-6 space-y-4">
          <h2 className="font-bold text-lg">Seus dados</h2>

          <div>
            <label className="block text-sm font-medium mb-1">Nome completo *</label>
            <input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">WhatsApp *</label>
              <input required type="tel" placeholder="(15) 99999-9999" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">E-mail</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">CPF</label>
              <input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Data de nascimento</label>
              <input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Cidade</label>
              <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">UF</label>
              <input maxLength={2} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })} className="w-full px-3 py-2 border rounded-lg" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Cargo desejado</label>
            <input value={form.desiredRole} onChange={(e) => setForm({ ...form, desiredRole: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Pretensão salarial</label>
              <input type="number" step="0.01" value={form.salaryExpectation} onChange={(e) => setForm({ ...form, salaryExpectation: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Disponibilidade</label>
              <select value={form.availability} onChange={(e) => setForm({ ...form, availability: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                <option>Imediata</option>
                <option>15 dias</option>
                <option>30 dias</option>
                <option>A combinar</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Formação</label>
            <textarea rows={2} value={form.education} onChange={(e) => setForm({ ...form, education: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Experiência profissional</label>
            <textarea rows={3} value={form.experience} onChange={(e) => setForm({ ...form, experience: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">CNH</label>
              <select value={form.cnh} onChange={(e) => setForm({ ...form, cnh: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                <option value="">Não tenho</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="AB">AB</option>
                <option value="C">C</option>
                <option value="D">D</option>
                <option value="E">E</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Observações</label>
            <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Currículo (PDF, máx 5MB)</label>
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => setResume(e.target.files?.[0] || null)}
              className="w-full text-sm"
            />
            {resume && (
              <div className="text-xs text-slate-600 mt-1">
                {resume.name} · {(resume.size / 1024).toFixed(0)} KB
              </div>
            )}
          </div>

          <div className="bg-slate-50 p-3 rounded-lg">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.consent}
                onChange={(e) => setForm({ ...form, consent: e.target.checked })}
                className="mt-1"
              />
              <span>
                Autorizo o uso dos meus dados para participar do processo seletivo, conforme a LGPD.
              </span>
            </label>
          </div>

          {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg transition disabled:opacity-50"
          >
            {submitting ? 'Enviando...' : 'ENVIAR CANDIDATURA'}
          </button>
        </form>
      </main>
    </div>
  );
}