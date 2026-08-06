import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";

interface Props {
  onDetecte: (valeur: string) => void;
  onFermer: () => void;
}

/** Scanner QR plein écran (html5-qrcode chargé dynamiquement, navigateur seul). */
export function QrScannerDialog({ onDetecte, onFermer }: Props) {
  const conteneurId = "agn-qr-reader";
  const [erreur, setErreur] = useState<string | null>(null);
  const arreter = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    let annule = false;

    void (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        const scanner = new Html5Qrcode(conteneurId);
        arreter.current = async () => {
          try {
            await scanner.stop();
            scanner.clear();
          } catch {
            /* déjà arrêté */
          }
        };
        if (annule) return;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (texte) => {
            onDetecte(texte);
          },
          undefined,
        );
      } catch {
        if (!annule) {
          setErreur(
            "Caméra indisponible. Autorisez l'accès ou saisissez le numéro à la main.",
          );
        }
      }
    })();

    return () => {
      annule = true;
      void arreter.current?.();
    };
  }, [onDetecte]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div
        className="flex items-center justify-between border-b border-border px-4 py-3"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <span className="text-sm font-medium text-foreground">Scanner le QR</span>
        <Button size="icon" variant="ghost" aria-label="Fermer" onClick={onFermer}>
          <X className="size-5" />
        </Button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
        <div id={conteneurId} className="w-full max-w-sm overflow-hidden rounded-lg" />
        {erreur ? (
          <p className="text-center text-sm text-destructive">{erreur}</p>
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            Cadrez le QR code de la plaque.
          </p>
        )}
      </div>
    </div>
  );
}
