// src/components/InstallBanner.tsx
import { useState } from "react";
import { Download, X, Share, PlusSquare, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { cn } from "@/lib/utils";

export function InstallBanner({ variant = "bottom" }: { variant?: "bottom" | "inline" }) {
  const { canInstall, installed, needsManualIosGuide, promptInstall, dismiss } = usePWAInstall();
  const [showIosGuide, setShowIosGuide] = useState(false);

  if (installed || !canInstall) return null;

  const handleClick = async () => {
    if (needsManualIosGuide) {
      setShowIosGuide(true);
      return;
    }
    await promptInstall();
  };

  return (
    <>
      <div
        className={cn(
          "z-50 shadow-lg",
          variant === "bottom"
            ? "fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96"
            : "relative w-full",
        )}
        style={variant === "bottom" ? { paddingBottom: "env(safe-area-inset-bottom, 0px)" } : undefined}
      >
        <div className="rounded-2xl bg-gradient-to-br from-amber-500 via-orange-600 to-rose-600 p-4 text-white">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 shrink-0 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur">
              <Smartphone className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm">Installer Adresse GN</div>
              <div className="text-xs text-white/90 mt-0.5 leading-snug">
                Accès rapide depuis votre écran d'accueil, mode hors-ligne, notifications.
              </div>
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  className="bg-white text-orange-700 hover:bg-white/90 h-8 shadow"
                  onClick={handleClick}
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Installer
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-white hover:bg-white/15 h-8"
                  onClick={dismiss}
                >
                  Plus tard
                </Button>
              </div>
            </div>
            <button
              onClick={dismiss}
              className="text-white/70 hover:text-white transition"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Guide iOS manuel (pas de prompt natif) */}
      <Dialog open={showIosGuide} onOpenChange={setShowIosGuide}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-orange-600" />
              Installer sur iPhone
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="rounded-xl bg-slate-50 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-orange-600 text-white flex items-center justify-center shrink-0 text-xs font-bold">
                  1
                </div>
                <div>
                  <div className="font-semibold">Appuyez sur le bouton Partager</div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-1">
                    <Share className="h-4 w-4" />
                    en bas de Safari
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-orange-600 text-white flex items-center justify-center shrink-0 text-xs font-bold">
                  2
                </div>
                <div>
                  <div className="font-semibold">Choisissez « Sur l'écran d'accueil »</div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-1">
                    <PlusSquare className="h-4 w-4" />
                    dans le menu qui apparaît
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-orange-600 text-white flex items-center justify-center shrink-0 text-xs font-bold">
                  3
                </div>
                <div>
                  <div className="font-semibold">Appuyez sur « Ajouter »</div>
                  <div className="text-xs text-slate-600 mt-1">L'icône Adresse GN apparaîtra sur votre écran d'accueil.</div>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-500 italic">
              Note : cette fonctionnalité n'est disponible que dans Safari (pas Chrome iOS).
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
