"use client";

import { useState, useEffect } from "react";

export function OnigrowthModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  // Mount the content only while open so its animation state resets on close
  // instead of being reset from inside an effect.
  if (!open) return null;
  return <OnigrowthModalContent onClose={onClose} />;
}

function OnigrowthModalContent({ onClose }: { onClose: () => void }) {
  const [show, setShow] = useState(false);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => setShow(true));
    const t = setTimeout(() => setShowContent(true), 100);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(t);
      document.body.style.overflow = "";
    };
  }, []);

  function handleClose() {
    setShowContent(false);
    setShow(false);
    setTimeout(onClose, 300);
  }

  const features = [
    {
      title: "Blueprint Lead Magnet",
      svg: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>,
    },
    {
      title: "Carrusel IG",
      svg: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" /></svg>,
    },
    {
      title: "Scripts de Ventas",
      svg: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>,
    },
    {
      title: "Calendario",
      svg: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>,
    },
    {
      title: "Marco Estratégico",
      svg: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" /></svg>,
    },
    {
      title: "Plantillas Copy",
      svg: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      style={{ transition: "opacity 0.3s", opacity: show ? 1 : 0 }}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={handleClose} />

      <div
        className="relative w-full max-w-lg rounded-2xl border border-gray-700/60 bg-gray-900 overflow-hidden shadow-2xl shadow-black/50 max-h-[90vh] overflow-y-auto"
        style={{
          transition: "transform 0.4s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s",
          transform: showContent ? "scale(1)" : "scale(0.9)",
          opacity: showContent ? 1 : 0,
        }}
      >
        {/* Green glow top */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#39FF14] to-transparent" />

        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors z-10"
          aria-label="Cerrar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="p-6 sm:p-8">
          <p className="text-[#39FF14] text-[10px] font-bold uppercase tracking-[0.35em] mb-2">
            Nuestro Producto
          </p>
          <h3 className="text-xl sm:text-2xl font-black text-white leading-tight">
            Deja de adivinar qué <span className="text-[#39FF14]">pedirle a la IA</span>
          </h3>
          <p className="mt-3 text-sm text-gray-400 leading-relaxed">
            <span className="text-white font-bold">Onigrowth</span> es un kit de prompts y plantillas estratégicas para
            emprendedores que quieren usar la IA como herramienta real de crecimiento.
          </p>

          {/* Badges */}
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-gray-800/60 bg-gray-800/40 px-4 py-1.5">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Compatible</span>
            <div className="h-3 w-px bg-gray-700/60" />
            <span className="text-[11px] font-bold text-gray-300">ChatGPT</span>
            <span className="text-[11px] font-bold text-gray-300">Claude</span>
            <span className="text-[11px] font-bold text-gray-300">Gemini</span>
          </div>

          {/* Features */}
          <div className="mt-5 grid grid-cols-3 gap-2">
            {features.map((item) => (
              <div
                key={item.title}
                className="rounded-lg border border-gray-800/60 bg-gray-800/30 p-2.5 text-center flex flex-col items-center gap-1.5"
              >
                <div className="text-[#39FF14]">{item.svg}</div>
                <p className="text-[10px] font-semibold text-gray-300 leading-tight">{item.title}</p>
              </div>
            ))}
          </div>

          {/* CTA */}
          <a
            href="https://www.onigrowth.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="group mt-6 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#39FF14] px-6 py-3 text-sm font-bold text-black uppercase tracking-wider transition-all duration-300 hover:bg-[#32e012] hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(57,255,20,0.25)]"
          >
            Obtener Mi Kit
            <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}
