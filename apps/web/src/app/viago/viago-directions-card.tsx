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
        className={`h-11 min-w-0 flex-1 truncate bg-transparent text-[15px] font-semibold outline-none placeholder:font-normal placeholder:text-slate-500 ${role === "start" ? "text-[#1a73e8]" : "text-slate-900"} ${active ? "" : ""}`} />
      {active && value.trim().length > 0 && (
        <button type="submit" aria-label="Rechercher" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#0b7f78] text-white"><Search className="size-4" /></button>
      )}
      {trailing}
    </form>
  );
}

export default function ViagoDirectionsCard(props: Props) {
  const [menu, setMenu] = useState(false);
  const item = "flex w-full items-center gap-3 px-4 py-3 text-left text-[14px] text-slate-800 hover:bg-slate-50";
  return (
    <div className="pointer-events-auto absolute left-3 right-3 top-3 z-[530] mx-auto max-w-[460px]">
      <div className="rounded-2xl bg-white px-3 py-1.5 shadow-[0_6px_24px_rgba(10,30,50,0.22)]">
        <Row role="start" value={props.startValue} placeholder="Choisir le point de départ" props={props}
          marker={<span className="size-3 rounded-full border-[3px] border-[#1a73e8] bg-white" />}
          trailing={
            <div className="relative">
              <button type="button" aria-label="Plus d’options" aria-expanded={menu} onClick={() => setMenu((v) => !v)}
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"><MoreVertical className="size-5" /></button>
              {menu && (
                <div className="absolute right-0 top-10 z-10 w-64 overflow-hidden rounded-xl bg-white py-1 shadow-[0_8px_30px_rgba(10,30,50,0.3)]" role="menu">
                  <button type="button" role="menuitem" className={item} onClick={() => { setMenu(false); props.onAddStop(); }}><Plus className="size-5 text-slate-500" />Ajouter une étape</button>
                  <button type="button" role="menuitem" className={item} onClick={() => { setMenu(false); props.onUseMyPosition(); }}><LocateFixed className="size-5 text-slate-500" />Utiliser ma position actuelle</button>
                  <button type="button" role="menuitem" className={item} onClick={() => { setMenu(false); props.onSwap(); }}><ArrowUpDown className="size-5 text-slate-500" />Inverser départ et arrivée</button>
                  {props.canShare && <button type="button" role="menuitem" className={item} onClick={() => { setMenu(false); props.onShare(); }}><Share2 className="size-5 text-slate-500" />Partager l’itinéraire</button>}
                  <button type="button" role="menuitem" className={item} onClick={() => { setMenu(false); props.onTools(); }}><Settings2 className="size-5 text-slate-500" />Options et outils</button>
                  <button type="button" role="menuitem" className={item} onClick={() => { setMenu(false); props.onReset(); }}><RotateCcw className="size-5 text-slate-500" />Réinitialiser</button>
                </div>
              )}
            </div>
          } />
        {props.stops.map((s, i) => (
          <div key={i} className="border-t border-slate-100">
            <Row role={i} value={s.value} placeholder={s.placeholder} props={props}
              marker={<span className="flex size-4 items-center justify-center rounded-full bg-slate-600 text-[10px] font-bold text-white">{i + 1}</span>}
              trailing={<button type="button" aria-label={`Supprimer l’étape ${i + 1}`} onClick={() => props.onRemoveStop(i)} className="flex size-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"><X className="size-4" /></button>} />
          </div>
        ))}
        <div className="border-t border-slate-100">
          <Row role="end" value={props.endValue} placeholder="Saisir une Adresse GN ou une destination" props={props}
            marker={<MapPin className="size-4 text-[#d93025]" />}
            trailing={<button type="button" onClick={props.onSwap} aria-label="Inverser départ et arrivée" className="flex size-9 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"><ArrowUpDown className="size-5" /></button>} />
        </div>
      </div>

      {props.focus !== null && (
        <div className="mt-2 max-h-[55dvh] overflow-y-auto rounded-2xl bg-white py-1 shadow-[0_6px_24px_rgba(10,30,50,0.22)]" role="listbox" aria-label="Suggestions">
          {props.focus === "start" && (
            <button type="button" className={item} onClick={props.onUseMyPosition}><LocateFixed className="size-5 text-[#1a73e8]" /><span className="font-semibold text-[#1a73e8]">Ma position actuelle</span></button>
          )}
          {(props.focus === "start" || props.focus === "end") && (
            <button type="button" className={item} onClick={() => props.onPickOnMap(props.focus as "start" | "end")}><MapPin className="size-5 text-slate-500" />Choisir sur la carte</button>
          )}
          {props.searching && (
            <p className="px-4 py-3 text-sm text-slate-500">
              Recherche…{props.slowSearch && <span className="mt-1 block text-xs">Le service Adresse GN se réveille, cela peut prendre jusqu’à une minute la première fois.</span>}
            </p>
          )}
          {props.suggestions.map((s) => (
            <button key={s.id} type="button" role="option" aria-selected={false} className={item} onClick={() => props.onPickSuggestion(s.id)}>
              <MapPin className={`size-5 shrink-0 ${s.agn ? "text-[#0b7f78]" : "text-slate-400"}`} />
              <span className="min-w-0"><span className="block truncate font-medium">{s.label}</span>{s.sub && <span className="block truncate text-xs text-slate-500">{s.sub}</span>}</span>
            </button>
          ))}
          <button type="button" onClick={props.onDismiss} className="w-full px-4 py-2 text-right text-xs font-semibold text-slate-500">Fermer</button>
        </div>
      )}
    </div>
  );
}
