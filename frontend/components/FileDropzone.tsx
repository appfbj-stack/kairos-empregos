'use client';

import { useCallback, useRef, useState } from 'react';

interface FileDropzoneProps {
  value: File | null;
  onChange: (file: File | null) => void;
  accept?: string;
  maxBytes?: number;
  label?: string;
  hint?: string;
  disabled?: boolean;
  /** Quando true, mostra estado de "substituir" (arquivo existente) */
  replaceMode?: boolean;
  currentFilename?: string | null;
}

export function FileDropzone({
  value,
  onChange,
  accept = 'application/pdf,.pdf',
  maxBytes = 5 * 1024 * 1024,
  label = 'Currículo (PDF, máx 5MB)',
  hint,
  disabled = false,
  replaceMode = false,
  currentFilename = null,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = useCallback(
    (file: File): string | null => {
      if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
        return 'Apenas PDF é aceito.';
      }
      if (file.size > maxBytes) {
        return `Arquivo muito grande (máx ${(maxBytes / 1024 / 1024).toFixed(0)}MB).`;
      }
      return null;
    },
    [maxBytes]
  );

  const handleFile = useCallback(
    (file: File | null) => {
      setError(null);
      if (!file) {
        onChange(null);
        return;
      }
      const err = validate(file);
      if (err) {
        setError(err);
        onChange(null);
        return;
      }
      onChange(file);
    },
    [onChange, validate]
  );

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setDragOver(true);
  }

  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }

  function clear() {
    handleFile(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  const showReplace = replaceMode && currentFilename && !value;
  const showFile = value || showReplace;

  return (
    <div>
      {label && <label className="block text-sm font-medium mb-1">{label}</label>}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => !disabled && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={[
          'relative w-full border-2 border-dashed rounded-xl p-6 text-center transition cursor-pointer select-none',
          dragOver ? 'border-brand-500 bg-brand-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100',
          disabled ? 'opacity-50 cursor-not-allowed' : '',
          error ? 'border-red-400 bg-red-50' : '',
        ].join(' ')}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={(e) => handleFile(e.target.files?.[0] || null)}
          disabled={disabled}
          className="hidden"
        />

        {!showFile && (
          <div className="text-slate-500">
            <div className="text-3xl mb-1">📄</div>
            <div className="text-sm">
              <span className="font-semibold text-brand-600">Clique</span> ou arraste o PDF aqui
            </div>
            {hint && <div className="text-xs mt-1 text-slate-400">{hint}</div>}
          </div>
        )}

        {showFile && (
          <div className="flex items-center justify-between gap-3 text-left">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-2xl">📄</span>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm text-slate-800 truncate">
                  {value?.name || currentFilename}
                </div>
                {value && (
                  <div className="text-xs text-slate-500">
                    {(value.size / 1024).toFixed(0)} KB
                  </div>
                )}
                {showReplace && !value && (
                  <div className="text-xs text-amber-600">Clique ou arraste pra substituir</div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                clear();
              }}
              className="shrink-0 text-slate-400 hover:text-red-600 text-xl leading-none"
              aria-label="Remover arquivo"
            >
              ✕
            </button>
          </div>
        )}
      </div>
      {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
    </div>
  );
}