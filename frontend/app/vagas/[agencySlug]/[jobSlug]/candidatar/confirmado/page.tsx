'use client';

import { useSearchParams, useParams } from 'next/navigation';
import Link from 'next/link';

export default function ConfirmadoPage() {
  const search = useSearchParams();
  const params = useParams<{ agencySlug: string; jobSlug: string }>();
  const msg = search.get('msg') || 'Recebemos sua candidatura!';
  const job = search.get('job') || '';
  const isNew = search.get('new') === 'true';

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-emerald-50 to-white">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="w-20 h-20 mx-auto bg-emerald-100 rounded-full flex items-center justify-center text-4xl mb-4">
          ✓
        </div>
        <h1 className="text-2xl font-bold text-emerald-700 mb-2">Candidatura enviada!</h1>
        {job && <p className="text-slate-600 mb-4">{job}</p>}
        <p className="text-slate-700 mb-6">{msg}</p>
        {isNew && (
          <p className="text-xs text-slate-500 mb-4 bg-slate-50 p-2 rounded">
            Você foi adicionado(a) ao banco de talentos da agência.
          </p>
        )}
        <Link
          href={`/vagas/${params.agencySlug}`}
          className="inline-block bg-slate-900 text-white px-5 py-2 rounded-lg hover:bg-slate-700 transition"
        >
          Ver outras vagas
        </Link>
      </div>
    </div>
  );
}