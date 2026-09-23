'use client';

import { useEffect, useState } from 'react';

export default function PWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Detecta iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;

    if (isStandalone) {
      setInstalled(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // iOS: mostra instrução manual
    if (isIOS) {
      setShowBanner(true);
    }

    window.addEventListener('appinstalled', () => {
      setInstalled(true);
      setShowBanner(false);
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function install() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstalled(true);
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  }

  if (installed || !showBanner) return null;

  const isIOS = typeof window !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-slate-900 text-white rounded-2xl shadow-2xl p-4 z-50 border border-slate-700">
      <div className="flex items-start gap-3">
        <img src="/icons/icon-192.png" alt="KAIROS RH" className="w-12 h-12 rounded-lg" />
        <div className="flex-1">
          <div className="font-semibold">Instalar KAIROS RH</div>
          {isIOS ? (
            <div className="text-xs text-slate-300 mt-1">
              Toque em <strong>Compartilhar</strong> → <strong>Adicionar à Tela de Início</strong>
            </div>
          ) : (
            <div className="text-xs text-slate-300 mt-1">
              Acesso rápido direto do seu celular, sem barra do navegador
            </div>
          )}
        </div>
        <button onClick={() => setShowBanner(false)} className="text-slate-400 hover:text-white text-lg leading-none">×</button>
      </div>
      {!isIOS && (
        <button
          onClick={install}
          className="mt-3 w-full bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-bold py-2 rounded-lg transition"
        >
          Instalar agora
        </button>
      )}
    </div>
  );
}