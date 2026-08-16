// src/components/public/ShareBar.tsx
import { useState } from "react";
import { Share2, Copy, Check, MessageCircle, Send, Navigation2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  /** Numéro de balise (ex : GN-CKY-582741). */
  numero: string;
  /** Nom de l'adresse pour l'aperçu (ex : "Maison Diallo"). */
  nom?: string | null;
  /** Coordonnées GPS pour ouvrir Maps/Waze. */
  lat?: number | null;
  lng?: number | null;
}

function vibrate() { try { navigator.vibrate?.(15); } catch {} }

function ouvrirMaps(lat: number, lng: number, label: string) {
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const encoded = encodeURIComponent(label);
  const url = isIos
    ? `maps://?q=${encoded}&ll=${lat},${lng}`
    : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${encoded}`;
  window.open(url, "_blank", "noopener");
}

export function ShareBar({ numero, nom, lat, lng }: Props) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}/a/${numero}` : "";
  const titre = nom ? `${nom} — ${numero}` : `Adresse ${numero}`;
  const texte = `📍 ${titre}\nVoir sur Adresse GN : ${url}`;

  const partagerNatif = async () => {
    vibrate();
    if (navigator.share) {
      try {
        await navigator.share({ title: titre, text: texte, url });
      } catch { /* utilisateur annule */ }
    } else {
      copier();
    }
  };

  const copier = async () => {
    vibrate();
    try {
      await navigator.clipboard.writeText(texte);
      setCopied(true);
      toast.success("Lien copié dans le presse-papiers");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Impossible de copier");
    }
  };

  const whatsapp = () => {
    vibrate();
    window.open(`https://wa.me/?text=${encodeURIComponent(texte)}`, "_blank", "noopener");
  };

  const sms = () => {
    vibrate();
    window.open(`sms:?&body=${encodeURIComponent(texte)}`, "_self");
  };

  const yAGps = lat != null && lng != null;

  return (
    <div className="space-y-3">
      {/* Bouton principal : Itinéraire */}
      {yAGps && (
        <Button
          size="lg"
          className="w-full h-14 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg text-base font-semibold"
          onClick={() => { vibrate(); ouvrirMaps(lat!, lng!, titre); }}
        >
          <Navigation2 className="h-5 w-5 mr-2" />
          Itinéraire vers cette adresse
        </Button>
      )}

      {/* Actions de partage */}
      <div className="grid grid-cols-4 gap-2">
        <button onClick={partagerNatif}
          className="flex flex-col items-center gap-1.5 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:scale-95 transition-all">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center">
            <Share2 className="h-5 w-5" />
          </div>
          <span className="text-[10px] font-semibold text-slate-700">Partager</span>
        </button>

        <button onClick={whatsapp}
          className="flex flex-col items-center gap-1.5 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:scale-95 transition-all">
          <div className="h-10 w-10 rounded-full bg-[#25D366] text-white flex items-center justify-center">
            <MessageCircle className="h-5 w-5" />
          </div>
          <span className="text-[10px] font-semibold text-slate-700">WhatsApp</span>
        </button>

        <button onClick={sms}
          className="flex flex-col items-center gap-1.5 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:scale-95 transition-all">
          <div className="h-10 w-10 rounded-full bg-sky-500 text-white flex items-center justify-center">
            <Send className="h-5 w-5" />
          </div>
          <span className="text-[10px] font-semibold text-slate-700">SMS</span>
        </button>

        <button onClick={copier}
          className="flex flex-col items-center gap-1.5 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:scale-95 transition-all">
          <div className={`h-10 w-10 rounded-full flex items-center justify-center transition-colors ${copied ? "bg-emerald-500 text-white" : "bg-slate-800 text-white"}`}>
            {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
          </div>
          <span className="text-[10px] font-semibold text-slate-700">{copied ? "Copié !" : "Copier"}</span>
        </button>
      </div>
    </div>
  );
}

