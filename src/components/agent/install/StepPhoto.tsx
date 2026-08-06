import { useRef, useState } from "react";
import { Camera, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { compresserImage } from "@/lib/install";

interface Props {
  photo: string | null;
  onPhoto: (dataUrl: string | null) => void;
}

/** Étape 3 — photo de l'entrée, compressée côté client. */
export function StepPhoto({ photo, onPhoto }: Props) {
  const champ = useRef<HTMLInputElement>(null);
  const [enCours, setEnCours] = useState(false);

  const traiter = async (fichier: File | undefined) => {
    if (!fichier) return;
    setEnCours(true);
    try {
      onPhoto(await compresserImage(fichier));
    } catch {
      toast.error("Impossible de traiter cette photo");
    } finally {
      setEnCours(false);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-4 py-6">
        <p className="text-sm text-muted-foreground">
          Photographiez l'entrée avec la plaque visible. Photo obligatoire.
        </p>

        <input
          ref={champ}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(event) => void traiter(event.target.files?.[0])}
        />

        {photo && (
          <img
            src={photo}
            alt="Aperçu de l'entrée photographiée"
            className="w-full rounded-lg border border-border object-cover"
          />
        )}

        <Button
          size="lg"
          variant={photo ? "outline" : "default"}
          className="h-12 w-full"
          disabled={enCours}
          onClick={() => champ.current?.click()}
        >
          {enCours ? (
            <Loader2 className="size-5 animate-spin" />
          ) : photo ? (
            <RotateCcw className="size-5" />
          ) : (
            <Camera className="size-5" />
          )}
          {photo ? "Reprendre la photo" : "Prendre la photo"}
        </Button>
      </CardContent>
    </Card>
  );
}
