"use client";
// Feuille « Signaler » façon Waze : un toucher = un signalement a la position actuelle.
import { X } from "lucide-react";
import { ALERT_META, ALERT_ORDER, type AlertType } from "@/features/viago/viago-alerts";

export default function ViagoReportSheet({ onPick, onClose, busy }: { onPick: (type: AlertType) => void; onClose: () => void; busy: boolean }) {
  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-[570] mx-auto max-w-[520px] max-h-[88dvh] overflow-y-auto rounded-t-[28px] bg-white px-4 pb-6 pt-3 shadow-[0_-8px_30px_rgba(10,30,50,0.3)]" role="dialog" aria-label="Signaler un événement sur la route">
      <div className="mx-auto h-1.5 w-10 rounded-full bg-slate-300" aria-hidden="true" />
      <div className="mt-2 flex items-center justify-between">
        <p className="text-base font-bold text-slate-900">Que se passe-t-il sur la route ?</p>
        <button type="button" onClick={onClose} aria-label="Fermer" className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-slate-700"><X className="size-5" /></button>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {ALERT_ORDER.map((type) => (
          <button key={type} type="button" disabled={busy} onClick={() => onPick(type)}
            className="flex flex-col items-center gap-1 rounded-2xl border border-slate-200 bg-white px-1 py-3 text-center text-[12px] font-semibold text-slate-800 active:bg-slate-100 disabled:opacity-50">
            <span className="text-3xl leading-none" aria-hidden="true">{ALERT_META[type].emoji}</span>
            <span>{ALERT_META[type].label}</span>
          </button>
        ))}
      </div>
      <p className="mt-3 text-center text-[11px] text-slate-500">Le signalement est placé à votre position actuelle et visible par les autres conducteurs.</p>
    </div>
  );
}
