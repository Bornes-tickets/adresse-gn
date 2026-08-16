// src/components/public/OnboardingSheet.tsx
import { useEffect, useState, useRef } from "react";
import { QrCode, Share2, UserPlus, X, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const KEY = "agn-onboarding-seen";

const SLIDES = [
  {
    icon: QrCode,
    title: "Bienvenue sur Adresse GN",
    text: "Chaque lieu en Guinée a un numéro unique. Vous venez d'en scanner un — voici ce que vous pouvez faire.",
    grad: "from-amber-500 via-orange-600 to-rose-600",
  },
  {
    icon: Share2,
    title: "Partagez votre adresse",
    text: "Envoyez ce numéro par WhatsApp ou SMS pour recevoir livraisons, taxis et visiteurs sans jamais expliquer votre chemin.",
    grad: "from-emerald-500 via-teal-600 to-cyan-600",
  },
  {
    icon: UserPlus,
    title: "C'est votre lieu ?",
    text: "Devenez propriétaire de cette adresse pour la personnaliser, ajouter votre commerce ou recevoir des notifications.",
    grad: "from-violet-500 via-fuchsia-600 to-pink-600",
  },
];

export function OnboardingSheet({ forceOpen = false }: { forceOpen?: boolean }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    if (forceOpen) { setOpen(true); return; }
    try {
      if (!localStorage.getItem(KEY)) setOpen(true);
    } catch {}
  }, [forceOpen]);

  const fermer = () => {
    setOpen(false);
    try { localStorage.setItem(KEY, "1"); } catch {}
  };

  const suivant = () => {
    if (index < SLIDES.length - 1) setIndex(index + 1);
    else fermer();
  };

  const precedent = () => { if (index > 0) setIndex(index - 1); };

  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0]!.clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0]!.clientX - touchStartX.current;
    if (Math.abs(dx) > 40) { if (dx < 0) suivant(); else precedent(); }
    touchStartX.current = null;
  };

  if (!open) return null;

  const slide = SLIDES[index]!;
  const Icon = slide.icon;

  return (
    <div className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center"
      onClick={fermer}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 duration-300"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Poignée + close */}
        <div className="relative pt-3 pb-1">
          <div className="mx-auto h-1.5 w-12 rounded-full bg-slate-300 sm:hidden" />
          <button onClick={fermer} className="absolute top-3 right-3 h-9 w-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center" aria-label="Fermer">
            <X className="h-4 w-4 text-slate-600" />
          </button>
        </div>

        {/* Slide */}
        <div className="px-8 pt-6 pb-8 text-center">
          <div className={cn("h-24 w-24 rounded-3xl mx-auto flex items-center justify-center text-white shadow-xl bg-gradient-to-br", slide.grad)}>
            <Icon className="h-12 w-12" />
          </div>
          <h2 className="mt-6 text-2xl font-bold text-slate-900">{slide.title}</h2>
          <p className="mt-3 text-sm text-slate-600 leading-relaxed">{slide.text}</p>
        </div>

        {/* Indicateurs */}
        <div className="flex items-center justify-center gap-2 pb-5">
          {SLIDES.map((_, i) => (
            <button key={i} onClick={() => setIndex(i)}
              className={cn(
                "h-2 rounded-full transition-all",
                i === index ? "w-8 bg-gradient-to-r from-amber-500 to-orange-600" : "w-2 bg-slate-300",
              )}
              aria-label={`Aller à la slide ${i + 1}`} />
          ))}
        </div>

        {/* Action */}
        <div className="px-6 pb-6 flex gap-2" style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}>
          {index > 0 && (
            <Button variant="outline" className="flex-1 h-12" onClick={precedent}>Retour</Button>
          )}
          <Button className="flex-1 h-12 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md" onClick={suivant}>
            {index === SLIDES.length - 1 ? "C'est parti" : "Suivant"}
            {index < SLIDES.length - 1 && <ChevronRight className="h-4 w-4 ml-1" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

