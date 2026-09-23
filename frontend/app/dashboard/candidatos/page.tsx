'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface Candidate {
  id: string;
  fullName: string;
  email: string | null;
  phone: string;
  city: string | null;
  state: string | null;
  desiredRole: string | null;
  resumeFilename: string | null;
  resumeUploadedAt: string | null;
  createdAt: string;
  applicationsCount: number;
}

export default function CandidatosPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    const url = q ? `/api/candidates?q=${encodeURIComponent(q)}` : '/api/candidates';
    api<Candidate[]>(url)
      .then(setCandidates)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [q]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Banco de talentos</h1>
        <div className="text-sm text-slate-500">{candidates.length} candidato(s)</div>
      </div>

      <input
        type="text"
        placeholder="Buscar por nome, telefone, e-mail ou cargo..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="w-full px-4 py-2 mb-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
      />

      {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4">{error}</div>}

      {loading ? (
        <div className="text-slate-500">Carregando...</div>
      ) : candidates.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center text-slate-500">
          Nenhum candidato ainda. Compartilhe o link de uma vaga no WhatsApp!
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="p-3">Nome</th>
                <th className="p-3">Contato</th>
                <th className="p-3">Cidade</th>
                <th className="p-3">Cargo desejado</th>
                <th className="p-3">Currículo</th>
                <th className="p-3">Candidaturas</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <tr key={c.id} className="border-t hover:bg-slate-50">
                  <td className="p-3">
                    <Link href={`/dashboard/candidatos/${c.id}`} className="font-medium text-brand-500 hover:underline">
                      {c.fullName}
                    </Link>
                  </td>
                  <td className="p-3 text-slate-600">
                    {c.phone}
                    {c.email && <div className="text-xs">{c.email}</div>}
                  </td>
                  <td className="p-3">{c.city}{c.state ? `/${c.state}` : ''}</td>
                  <td className="p-3">{c.desiredRole || '—'}</td>
                  <td className="p-3">
                    {c.resumeFilename ? (
                      <span className="text-xs bg-slate-100 px-2 py-0.5 rounded">📄 {c.resumeFilename}</span>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-xs">{c.applicationsCount}</span>
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