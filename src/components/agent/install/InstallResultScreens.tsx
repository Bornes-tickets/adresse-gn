import { CheckCircle2, ExternalLink, MessageCircle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SUPERVISOR_WHATSAPP } from "@/lib/install";

/** Écran de succès plein écran après enregistrement. */
export function InstallSuccess({ numero, onSuivante }: { numero: string; onSuivante: () => void }) {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-6 text-center">
      <CheckCircle2 className="size-20 animate-[pulse_1.6s_ease-in-out_infinite] text-accent" />
      <p className="text-lg font-semibold text-foreground">
        Balise <span className="font-mono">{numero}</span> installée avec succès.
      </p>
      <div className="w-full max-w-sm space-y-3">
        <Button
          size="lg"
          variant="outline"
          className="h-12 w-full"
          onClick={() => window.open(`/a/${numero}`, "_blank", "noopener")}
        >
          <ExternalLink className="size-5" />
          Voir la fiche
        </Button>
        <Button size="lg" className="h-12 w-full" onClick={onSuivante}>
          Installer la balise suivante
        </Button>
      </div>
    </div>
  );
}

/** Écran d'erreur plein écran avec réessai et contact superviseur. */
export function InstallError({
  message,
  onReessayer,
}: {
  message: string;
  onReessayer: () => void;
}) {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-6 text-center">
      <div className="space-y-2">
        <h1 className="text-lg font-semibold text-destructive">Enregistrement impossible</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      <div className="w-full max-w-sm space-y-3">
        <Button size="lg" className="h-12 w-full" onClick={onReessayer}>
          <RefreshCw className="size-5" />
          Réessayer
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-12 w-full"
          onClick={() =>
            window.open(
              `https://wa.me/${SUPERVISOR_WHATSAPP}?text=${encodeURIComponent(
                "Problème d'installation : " + message,
              )}`,
              "_blank",
              "noopener",
            )
          }
        >
          <MessageCircle className="size-5" />
          Contacter le superviseur
        </Button>
      </div>
    </div>
  );
}
