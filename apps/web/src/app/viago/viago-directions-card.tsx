"use client";
// Carte "itineraire" façon Google Maps : champs depart / etapes / arrivee, suggestions, menu ⋮.
// Purement presentationnelle : toute la logique (recherche, routage) reste dans page.tsx.
import { useState } from "react";
import { ArrowUpDown, LocateFixed, MapPin, MoreVertical, Plus, Search, Share2, Settings2, RotateCcw, X } from "lucide-react";

export type DirectionsRole = "start" | "end" | number; // number = index d'etape
export type Suggestion = { id: string; label: string; sub?: string; agn?: boolean };

type Props = {
  startValue: string;
  endValue: string;
  stops: { value: string; placeholder: string }[];
  focus: DirectionsRole | null;
  searching: boolean;
  slowSearch?: boolean;
  suggestions: Suggestion[];
  canShare: boolean;
  onFocus: (role: DirectionsRole) => void;
  onChange: (role: DirectionsRole, value: string) => void;
  onSubmit: (role: DirectionsRole) => void;
  onPickSuggestion: (id: string) => void;
  onUseMyPosition: () => void;
  onPickOnMap: (role: "start" | "end") => void;
  onSwap: () => void;
  onAddStop: () => void;
  onRemoveStop: (index: number) => void;
  onShare: () => void;
  onTools: () => void;
  onReset: () => void;
  onDismiss: () => void;
};

function Row({ role, value, placeholder, marker, props, trailing }: {
  role: DirectionsRole; value: string; placeholder: string; marker: React.ReactNode; props: Props; trailing?: React.ReactNode;
}) {
  const active = props.focus === role;
  return (
    <form onSubmit={(e) => { e.preventDefault(); props.onSubmit(role); }} className="flex items-center gap-2">
      <span className="flex w-5 shrink-0 justify-center" aria-hidden="true">{marker}</span>
      <input type="text" value={value} enterKeyHint="search" autoComplete="off"
        onFocus={() => props.onFocus(role)} onChange={(e) => props.onChange(role, e.target.value)}
        aria-label={role === "start" ? "Point de départ" : role === "end" ? "Destination" : `Étape ${(role as number) + 1}`}
        placeholder={placeholder}
        className={`h-11 min-w-0 flex-1 truncate bg-transparent text-[15px] font-semibold outline-none placeholder:font-normal placeholder:text-sky-100/70 ${role === "start" ? "text-[#a8dcff]" : "text-white"} ${active ? "" : ""}`} />
      {active && value.trim().length > 0 && (
        <button type="submit" aria-label="Rechercher" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#12b886] text-white"><Search className="size-4" /></button>
      )}
      {trailing}
    </form>
  );
}

export default function ViagoDirectionsCard(props: Props) {
  const [menu, setMenu] = useState(false);
  const item = "flex w-full items-center gap-3 px-4 py-3 text-left text-[14px] text-white hover:bg-white/10";
  return (
    <div className="pointer-events-auto absolute left-3 right-3 top-[calc(0.75rem+env(safe-area-inset-top,0px))] z-[530] mx-auto max-w-[460px]">
      <div className="rounded-2xl bg-gradient-to-br from-[#0b5d8f] via-[#0a7a8a] to-[#0a7a64] px-3 py-1.5 shadow-[0_6px_24px_rgba(10,30,50,0.22)]">
        <Row role="start" value={props.startValue} placeholder="Choisir le point de départ" props={props}
          marker={<span className="size-3 rounded-full border-[3px] border-[#a8dcff] bg-white/10" />}
          trailing={
            <div className="relative">
              <button type="button" aria-label="Plus d’options" aria-expanded={menu} onClick={() => setMenu((v) => !v)}
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-sky-100 hover:bg-white/10"><MoreVertical className="size-5" /></button>
              {menu && (
                <div className="absolute right-0 top-10 z-10 w-64 overflow-hidden rounded-xl bg-[#0e4f7c] py-1 shadow-[0_8px_30px_rgba(10,30,50,0.3)]" role="menu">
                  <button type="button" role="menuitem" className={item} onClick={() => { setMenu(false); props.onAddStop(); }}><Plus className="size-5 text-sky-100" />Ajouter une étape</button>
                  <button type="button" role="menuitem" className={item} onClick={() => { setMenu(false); props.onUseMyPosition(); }}><LocateFixed className="size-5 text-sky-100" />Utiliser ma position actuelle</button>
                  <button type="button" role="menuitem" className={item} onClick={() => { setMenu(false); props.onSwap(); }}><ArrowUpDown className="size-5 text-sky-100" />Inverser départ et arrivée</button>
                  {props.canShare && <button type="button" role="menuitem" className={item} onClick={() => { setMenu(false); props.onShare(); }}><Share2 className="size-5 text-sky-100" />Partager l’itinéraire</button>}
                  <button type="button" role="menuitem" className={item} onClick={() => { setMenu(false); props.onTools(); }}><Settings2 className="size-5 text-sky-100" />Options et outils</button>
                  <button type="button" role="menuitem" className={item} onClick={() => { setMenu(false); props.onReset(); }}><RotateCcw className="size-5 text-sky-100" />Réinitialiser</button>
                </div>
              )}
            </div>
          } />
        {props.stops.map((s, i) => (
          <div key={i} className="border-t border-white/15">
            <Row role={i} value={s.value} placeholder={s.placeholder} props={props}
              marker={<span className="flex size-4 items-center justify-center rounded-full bg-white/25 text-[10px] font-bold text-white">{i + 1}</span>}
              trailing={<button type="button" aria-label={`Supprimer l’étape ${i + 1}`} onClick={() => props.onRemoveStop(i)} className="flex size-9 shrink-0 items-center justify-center rounded-full text-sky-100 hover:bg-white/10"><X className="size-4" /></button>} />
          </div>
        ))}
        <div className="border-t border-white/15">
          <Row role="end" value={props.endValue} placeholder="Saisir une Adresse GN ou une destination" props={props}
            marker={<MapPin className="size-4 text-[#d93025]" />}
            trailing={<button type="button" onClick={props.onSwap} aria-label="Inverser départ et arrivée" className="flex size-9 shrink-0 items-center justify-center rounded-full text-sky-100 hover:bg-white/10"><ArrowUpDown className="size-5" /></button>} />
        </div>
      </div>

      {props.focus !== null && (
        <div className="mt-2 max-h-[55dvh] overflow-y-auto rounded-2xl bg-[#0e4f7c] py-1 shadow-[0_6px_24px_rgba(10,30,50,0.22)]" role="listbox" aria-label="Suggestions">
          {props.focus === "start" && (
            <button type="button" className={item} onClick={props.onUseMyPosition}><LocateFixed className="size-5 text-[#a8dcff]" /><span className="font-semibold text-[#a8dcff]">Ma position actuelle</span></button>
          )}
          {(props.focus === "start" || props.focus === "end") && (
            <button type="button" className={item} onClick={() => props.onPickOnMap(props.focus as "start" | "end")}><MapPin className="size-5 text-sky-100" />Choisir sur la carte</button>
          )}
          {props.searching && (
            <p className="px-4 py-3 text-sm text-sky-100">
              Recherche…{props.slowSearch && <span className="mt-1 block text-xs">Le service Adresse GN se réveille, cela peut prendre jusqu’à une minute la première fois.</span>}
            </p>
          )}
          {props.suggestions.map((s) => (
            <button key={s.id} type="button" role="option" aria-selected={false} className={item} onClick={() => props.onPickSuggestion(s.id)}>
              <MapPin className={`size-5 shrink-0 ${s.agn ? "text-[#0b7f78]" : "text-sky-200"}`} />
              <span className="min-w-0"><span className="block truncate font-medium">{s.label}</span>{s.sub && <span className="block truncate text-xs text-sky-100">{s.sub}</span>}</span>
            </button>
          ))}
          <button type="button" onClick={props.onDismiss} className="w-full px-4 py-2 text-right text-xs font-semibold text-sky-100">Fermer</button>
        </div>
      )}
    </div>
  );
}
