import { useRef, useState } from "react";
import { Camera, Loader2, RotateCcw, CheckCircle2, Sparkles, ImageOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { compresserImage } from "@/lib/install";

interface Props {
  photo: string | null;
  onPhoto: (dataUrl: string | null) => void;
}

const CONSEILS = [
  "Cadrez la balise entière et son environnement",
  "Photographiez de jour ou avec bon éclairage",
  "Évitez le contre-jour et le flou",
];

export function StepPhoto({ photo, onPhoto }: Props) {
  const champ = useRef<HTMLInputElement>(null);
  const [enCours, setEnCours] = useState(false);

  const traiter = async (fichier: File | undefined) => {
    if (!fichier) return;
    setEnCours(true);
    try {
      onPhoto(await compresserImage(fichier));
    } catch { toast.error("Impossible de traiter cette photo"); }
    finally { setEnCours(false); }
  };

  return (
    <div className="space-y-4">
      {/* Hero photo */}
      <Card className="overflow-hidden border-0 shadow-lg">
        <div className="bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 p-6 text-white relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_60%)]" />
          <div className="relative text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur mb-3 shadow-lg">
              <Camera className="h-7 w-7" />
            </div>
            <div className="text-xs uppercase tracking-widest text-white/80 font-semibold mb-1">Justificatif</div>
            <div className="text-xl font-bold">Photo de la balise installée</div>
            <div className="text-sm text-white/80 mt-1">Obligatoire pour valider la pose</div>
          </div>
        </div>
      </Card>

      <input
        ref={champ}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => void traiter(event.target.files?.[0])}
      />

      {/* Preview ou placeholder */}
      {photo ? (
        <Card className="overflow-hidden border-emerald-200 shadow-lg">
          <div className="relative">
            <img
              src={photo}
              alt="Aperçu de la photo"
              className="w-full h-72 object-cover"
            />
            <div className="absolute top-3 right-3">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 text-white px-3 py-1 text-xs font-semibold shadow-lg">
                <CheckCircle2 className="h-3.5 w-3.5" /> Photo prise
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="border-dashed border-2 border-sky-200 bg-gradient-to-br from-sky-50 to-blue-50 overflow-hidden">
          <CardContent className="py-12 text-center">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-sky-100">
              <ImageOff className="h-8 w-8 text-sky-500" />
            </div>
            <div className="text-sm font-semibold text-slate-900">Aucune photo</div>
            <div className="text-xs text-slate-600 mt-1">Utilisez le bouton ci-dessous</div>
          </CardContent>
        </Card>
      )}

      {/* Bouton principal */}
      <Button
        size="lg"
        className={
          photo
            ? "h-14 w-full text-base font-semibold border-2 border-sky-300 text-sky-700 bg-white hover:bg-sky-50 rounded-xl"
            : "h-14 w-full text-base font-semibold bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white shadow-lg"
        }
        variant={photo ? "outline" : "default"}
        disabled={enCours}
        onClick={() => champ.current?.click()}
      >
        {enCours ? <Loader2 className="h-5 w-5 mr-2 animate-spin" />
          : photo ? <RotateCcw className="h-5 w-5 mr-2" />
          : <Camera className="h-5 w-5 mr-2" />}
        {enCours ? "Compression…" : photo ? "Reprendre la photo" : "Prendre la photo"}
      </Button>

      {/* Conseils */}
      <Card className="bg-gradient-to-br from-sky-50 to-blue-50 border-sky-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-sky-600" />
            <span className="text-xs font-semibold uppercase tracking-wider text-sky-800">Conseils</span>
          </div>
          <ul className="space-y-1.5">
            {CONSEILS.map((c, i) => (
              <li key={i} className="text-xs text-slate-700 flex items-start gap-1.5">
                <span className="text-sky-500 mt-0.5">✓</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
