"use client";
// Apercu d'itineraire façon Google Maps : carte pleine page, carte depart/arrivee en haut,
// feuille du bas avec modes, duree, distance et bouton Demarrer. Purement presentationnel.
import { Bike, CarFront, Footprints, X } from "lucide-react";
import { formatMinutes, type RouteCandidate } from "@/features/viago/viago-alternatives";

type Profile = "car" | "motorcycle" | "foot";

type Props = {
  profile: Profile;
  onProfile: (profile: Profile) => void;
  candidates: RouteCandidate[];
  chosen: number;
  onChoose: (index: number) => void;
  altBusy: boolean;
  distanceLabel: string;
  durationS: number | null;
  arrivalLabel: string | null;
  onClose: () => void;
  onStart: () => void;
};

const MODES: { id: Profile; label: string; Icon: typeof CarFront }[] = [
  { id: "car", label: "Voiture", Icon: CarFront },
  { id: "motorcycle", label: "Moto", Icon: Bike },
  { id: "foot", label: "À pied", Icon: Footprints },
];

export default function ViagoRoutePreview(p: Props) {
  const fastest = p.candidates[0]?.duration ?? null;
  return (
    <>
      <section className="pointer-events-auto absolute inset-x-0 bottom-0 z-[520] mx-auto max-w-[560px] rounded-t-[28px] bg-gradient-to-b from-[#0b5d8f] to-[#0a6f7e] px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-2 shadow-[0_-6px_28px_rgba(10,30,50,0.22)]" aria-label="Itinéraire proposé">
        <div className="mx-auto h-1.5 w-10 rounded-full bg-white/40" aria-hidden="true" />
        <div className="mt-2 flex items-center justify-between">
          <div className="flex flex-1 items-center justify-around" role="tablist" aria-label="Mode de déplacement">
            {MODES.map(({ id, label, Icon }) => {
              const active = id === p.profile;
              return (
                <button key={id} type="button" role="tab" aria-selected={active} onClick={() => p.onProfile(id)}
                  className={`flex flex-col items-center gap-0.5 border-b-2 px-3 pb-1.5 pt-1 text-xs font-semibold ${active ? "border-[#8cf5c4] text-[#8cf5c4]" : "border-transparent text-sky-100"}`}>
                  <Icon className="size-5" aria-hidden="true" />
                  <span>{active && p.durationS !== null ? formatMinutes(p.durationS) : label}</span>
                </button>
              );
            })}
          </div>
          <button type="button" onClick={p.onClose} aria-label="Fermer l’itinéraire"
            className="ml-2 flex size-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-sky-50"><X className="size-5" /></button>
        </div>

        <div className="mt-3 border-t border-white/20 pt-3">
          <p className="text-[26px] font-medium leading-tight text-[#ffd27a]">
            {p.durationS !== null ? formatMinutes(p.durationS) : "--"} <span className="text-lg font-normal text-sky-50">({p.distanceLabel})</span>
          </p>
          <p className="mt-0.5 text-[13px] text-sky-100">
            {p.chosen === 0 ? "Itinéraire le plus rapide" : "Autre itinéraire"}{p.arrivalLabel ? ` · arrivée ${p.arrivalLabel}` : ""} · estimation hors trafic en direct
          </p>
        </div>

        {(p.candidates.length > 1 || p.altBusy) && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="radiogroup" aria-label="Itinéraires proposés">
            {p.candidates.map((c, i) => {
              const selected = i === p.chosen;
              const gap = c.duration !== null && fastest !== null ? Math.round((c.duration - fastest) / 60) : null;
              return (
                <button key={i} type="button" role="radio" aria-checked={selected} onClick={() => p.onChoose(i)}
                  className={`shrink-0 rounded-xl border px-3 py-1.5 text-left ${selected ? "border-[#8cf5c4] bg-white/20" : "border-white/25 bg-white/10"}`}>
                  <span className="block text-sm font-bold text-white">{c.duration !== null ? formatMinutes(c.duration) : "--"}</span>
                  <span className="block text-[11px] text-sky-100">{i === 0 ? "Le plus rapide" : gap !== null && gap > 0 ? `+${gap} min` : "Alternative"}</span>
                </button>
              );
            })}
            {p.altBusy && <span className="shrink-0 self-center px-2 text-[11px] text-sky-100">Recherche d’autres itinéraires…</span>}
          </div>
        )}

        <button type="button" onClick={p.onStart}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-[#12b886] py-3 text-[15px] font-bold text-white shadow-md">
          Démarrer
        </button>
      </section>
    </>
  );
}
