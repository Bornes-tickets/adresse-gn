import { useState } from "react";
import { QrCode } from "lucide-react";

import { QrScannerDialog } from "@/components/agent/QrScannerDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeBeaconNumber } from "@/lib/geo";

interface Props {
  attendu: string;
  confirme: boolean;
  onConfirme: () => void;
}

/** Étape 1 — confirmation de la balise par scan ou saisie. */
export function StepBeacon({ attendu, confirme, onConfirme }: Props) {
  const [saisie, setSaisie] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [scanner, setScanner] = useState(false);

  const verifier = (valeur: string, viaQr: boolean) => {
    const extrait = valeur.match(/GN-?[A-Z]{3}-?\d{6}/i)?.[0] ?? valeur;
    const normalise = normalizeBeaconNumber(extrait);
    if (normalise === attendu) {
      setErreur(null);
      onConfirme();
      return true;
    }
    setErreur(
      viaQr
        ? "Le QR scanné ne correspond pas à la tâche assignée."
        : "Le numéro saisi ne correspond pas à la tâche assignée.",
    );
    return false;
  };

  return (
    <Card>
      <CardContent className="space-y-5 py-6">
        <div>
          <p className="text-sm text-muted-foreground">Balise à installer</p>
          <p className="font-mono text-xl font-bold text-foreground">{attendu}</p>
        </div>

        <Button
          size="lg"
          className="h-12 w-full"
          onClick={() => {
            setErreur(null);
            setScanner(true);
          }}
        >
          <QrCode className="size-5" />
          Scanner le QR de la plaque
        </Button>

        <div className="space-y-2">
          <Label htmlFor="saisie-numero">Ou saisir le numéro</Label>
          <Input
            id="saisie-numero"
            inputMode="text"
            autoCapitalize="characters"
            placeholder="GN-CKY-000000"
            className="h-12 font-mono text-base"
            value={saisie}
            onChange={(event) => setSaisie(event.target.value)}
          />
          <Button
            variant="outline"
            size="lg"
            className="h-12 w-full"
            disabled={saisie.trim().length === 0}
            onClick={() => verifier(saisie, false)}
          >
            Vérifier le numéro
          </Button>
        </div>

        {erreur && <p className="text-sm font-medium text-destructive">{erreur}</p>}
        {confirme && <p className="text-sm font-medium text-accent">Balise confirmée.</p>}

        {scanner && (
          <QrScannerDialog
            onFermer={() => setScanner(false)}
            onDetecte={(texte) => {
              if (verifier(texte, true)) setScanner(false);
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}
