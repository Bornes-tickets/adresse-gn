import { useState } from "react";
import { QrCode, Keyboard, CheckCircle2, XCircle, Radio, Sparkles } from "lucide-react";
import { QrScannerDialog } from "@/components/agent/QrScannerDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeBeaconNumber } from "@/lib/geo";
import { cn } from "@/lib/utils";

interface Props {
  attendu: string;
  confirme: boolean;
  onConfirme: () => void;
}

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
    setErreur(viaQr ? "Le QR scanné ne correspond pas à la tâche assignée." : "Le numéro saisi ne correspond pas.");
    return false;
  };

  return (
    <div className="space-y-4">
      {/* Hero balise attendue */}
      <Card className="overflow-hidden border-0 shadow-lg">
        <div className="bg-gradient-to-br from-indigo-500 via-blue-600 to-cyan-600 p-6 text-white relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_60%)]" />
          <div className="relative text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur mb-3 shadow-lg">
              <Radio className="h-7 w-7" />
            </div>
            <div className="text-xs uppercase tracking-widest text-white/80 font-semibold mb-1">Balise à installer</div>
            <div className="font-mono text-3xl font-bold tracking-tight">{attendu}</div>
            {confirme && (
              <div className="inline-flex items-center gap-1.5 mt-3 rounded-full bg-emerald-500/30 backdrop-blur border border-emerald-300/40 px-3 py-1 text-xs font-semibold">
                <CheckCircle2 className="h-3.5 w-3.5" /> Balise confirmée
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Bouton scan principal */}
      <Card className="border-slate-200 overflow-hidden">
        <CardContent className="p-4 space-y-4">
          <Button
            size="lg"
            className="h-16 w-full text-base font-semibold bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-md"
            onClick={() => { setErreur(null); setScanner(true); }}
          >
            <QrCode className="h-6 w-6 mr-2" />
            Scanner le QR de la plaque
          </Button>

          {/* Séparateur */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-3 text-slate-400 uppercase tracking-widest font-semibold">Ou</span>
            </div>
          </div>

          {/* Saisie manuelle */}
          <div className="space-y-2">
            <Label htmlFor="saisie-numero" className="text-xs font-semibold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Keyboard className="h-3.5 w-3.5" /> Saisir le numéro à la main
            </Label>
            <Input
              id="saisie-numero"
              inputMode="text"
              autoCapitalize="characters"
              placeholder="GN-CKY-000000"
              className="h-14 font-mono text-lg text-center tracking-widest rounded-xl border-slate-300"
              value={saisie}
              onChange={(event) => setSaisie(event.target.value)}
            />
            <Button
              variant="outline"
              size="lg"
              className="h-12 w-full rounded-xl"
              disabled={saisie.trim().length === 0}
              onClick={() => verifier(saisie, false)}
            >
              Vérifier le numéro
            </Button>
          </div>

          {/* Erreur */}
          {erreur && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{erreur}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Astuce */}
      <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 p-3 text-xs text-indigo-800 flex items-start gap-2">
        <Sparkles className="h-4 w-4 mt-0.5 shrink-0 text-indigo-500" />
        <span>Utilisez le scanner QR pour plus de rapidité et éviter les erreurs de frappe.</span>
      </div>

      {scanner && (
        <QrScannerDialog
          onFermer={() => setScanner(false)}
          onDetecte={(texte) => { if (verifier(texte, true)) setScanner(false); }}
        />
      )}
    </div>
  );
}
