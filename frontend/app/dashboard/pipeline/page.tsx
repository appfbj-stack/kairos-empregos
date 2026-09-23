'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { api } from '@/lib/api';

interface Job {
  id: string;
  slug: string;
  title: string;
  city: string | null;
  state: string | null;
  status: string;
  companyName: string | null;
}

interface Application {
  id: string;
  stage: string;
  notes: string | null;
  createdAt: string;
  candidate: {
    id: string;
    fullName: string;
    phone: string;
    email: string | null;
    city: string | null;
    desiredRole: string | null;
    resumeFilename: string | null;
  };
}

const STAGES = [
  { id: 'NOVO', label: 'Novo', color: 'bg-slate-100 border-slate-300' },
  { id: 'EM_ANALISE', label: 'Em análise', color: 'bg-blue-50 border-blue-300' },
  { id: 'PRE_SELECIONADO', label: 'Pré-selecionado', color: 'bg-amber-50 border-amber-300' },
  { id: 'ENTREVISTA', label: 'Entrevista', color: 'bg-purple-50 border-purple-300' },
  { id: 'APROVADO', label: 'Aprovado', color: 'bg-emerald-50 border-emerald-300' },
  { id: 'ENVIADO_EMPRESA', label: 'Enviado p/ empresa', color: 'bg-cyan-50 border-cyan-300' },
  { id: 'CONTRATADO', label: 'Contratado', color: 'bg-green-100 border-green-400' },
  { id: 'REPROVADO', label: 'Reprovado', color: 'bg-red-50 border-red-300' },
];

export default function PipelinePage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    api<Job[]>('/api/jobs').then((j) => {
      setJobs(j);
      if (j.length > 0) setSelectedJobId(j[0].id);
    });
  }, []);

  function loadApps(jobId: string) {
    setLoading(true);
    api<Application[]>(`/api/candidates/by-job/${jobId}`)
      .then(setApplications)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (selectedJobId) loadApps(selectedJobId);
  }, [selectedJobId]);

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  async function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const appId = String(e.active.id);
    const newStage = e.over?.id ? String(e.over.id) : null;
    if (!newStage) return;

    const app = applications.find((a) => a.id === appId);
    if (!app || app.stage === newStage) return;

    setApplications((prev) => prev.map((a) => (a.id === appId ? { ...a, stage: newStage } : a)));

    try {
      await api(`/api/candidates/applications/${appId}/stage`, {
        method: 'PUT',
        body: JSON.stringify({ stage: newStage }),
      });
    } catch (err: any) {
      alert('Erro ao mover: ' + err.message);
      setApplications((prev) => prev.map((a) => (a.id === appId ? { ...a, stage: app.stage } : a)));
    }
  }

  const activeApp = applications.find((a) => a.id === activeId);

  return (
    <div className="p-6 h-screen flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Pipeline / Kanban</h1>
          <p className="text-sm text-slate-500">Arraste os cards entre as colunas</p>
        </div>
        <select
          value={selectedJobId || ''}
          onChange={(e) => setSelectedJobId(e.target.value)}
          className="px-4 py-2 border border-slate-300 rounded-lg bg-white"
        >
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.title} {j.city ? `(${j.city})` : ''} — {j.status}
            </option>
          ))}
        </select>
      </div>

      {!loading && applications.length === 0 && (
        <div className="bg-white rounded-xl p-8 text-center text-slate-500">
          Nenhuma candidatura para esta vaga.
        </div>
      )}

      {loading ? (
        <div className="text-slate-500">Carregando...</div>
      ) : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex-1 overflow-x-auto">
            <div className="flex gap-3 min-w-max pb-4">
              {STAGES.map((s) => (
                <DroppableColumn
                  key={s.id}
                  stageId={s.id}
                  label={s.label}
                  color={s.color}
                  applications={applications.filter((a) => a.stage === s.id)}
                />
              ))}
            </div>
          </div>
          <DragOverlay>
            {activeApp ? <CardContent app={activeApp} dragging /> : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}

function DroppableColumn({
  stageId,
  label,
  color,
  applications,
}: {
  stageId: string;
  label: string;
  color: string;
  applications: Application[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stageId });
  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-72 rounded-xl border-2 ${color} ${isOver ? 'ring-2 ring-brand-500' : ''}`}
    >
      <div className="p-3 border-b border-slate-200 flex items-center justify-between">
        <h3 className="font-semibold text-sm">{label}</h3>
        <span className="text-xs bg-white px-2 py-0.5 rounded-full">{applications.length}</span>
      </div>
      <div className="p-2 space-y-2 min-h-[200px]">
        {applications.map((a) => (
          <DraggableCard key={a.id} app={a} />
        ))}
      </div>
    </div>
  );
}

function DraggableCard({ app }: { app: Application }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: app.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`bg-white rounded-lg shadow p-3 hover:shadow-md transition cursor-grab active:cursor-grabbing ${
        isDragging ? 'opacity-30' : ''
      }`}
    >
      <Link href={`/dashboard/candidatos/${app.candidate.id}`} className="block" onClick={(e) => e.stopPropagation()}>
        <CardContent app={app} />
      </Link>
    </div>
  );
}

function CardContent({ app, dragging }: { app: Application; dragging?: boolean }) {
  return (
    <div className={dragging ? 'rotate-2 shadow-2xl bg-white rounded-lg p-3' : ''}>
      <div className="font-semibold text-sm">{app.candidate.fullName}</div>
      <div className="text-xs text-slate-500 mt-1">
        {app.candidate.phone}
        {app.candidate.city && ` · ${app.candidate.city}`}
      </div>
      {app.candidate.desiredRole && (
        <div className="text-xs text-slate-600 mt-1">{app.candidate.desiredRole}</div>
      )}
      {app.candidate.resumeFilename && (
        <div className="text-xs text-slate-500 mt-2 flex items-center gap-1">📄 {app.candidate.resumeFilename}</div>
      )}
      {app.notes && (
        <div className="text-xs bg-amber-50 p-1.5 rounded mt-2 line-clamp-2">{app.notes}</div>
      )}
    </div>
  );
}