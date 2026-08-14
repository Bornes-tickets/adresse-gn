import { CheckCircle2, Clock, ExternalLink, MessageCircle, RefreshCw, Sparkles, XCircle, Cloud, CloudOff, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SUPERVISOR_WHATSAPP } from "@/lib/install";
import { cn } from "@/lib/utils";

export function InstallSuccess({ numero, onSuivante }: { numero: string; onSuivante: () => void }) {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-6 px-4">
      {/* Cercle succès animé */}
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-emerald-500/30 animate-ping" />
        <div className="absolute inset-4 rounded-full bg-emerald-500/50 animate-pulse" />
        <div className="relative h-32 w-32 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-2xl">
          <CheckCircle2 className="h-16 w-16 text-white" strokeWidth={2.5} />
        </div>
      </div>

      {/* Confetti icons */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 text-emerald-700 px-3 py-1 text-xs font-semibold">
          <Sparkles className="h-3 w-3" /> Installation validée
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Balise installée !</h1>
        <div className="font-mono text-lg font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
          {numero}
        </div>
      </div>

      {/* Encouragement */}
      <Card className="border-amber-200 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 w-full max-w-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Trophy className="h-8 w-8 text-amber-500" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-slate-900">Merci !</div>
              <div className="text-xs text-slate-600">Vous aidez la Guinée à s'orienter.</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="w-full max-w-sm space-y-2">
        <Button
          size="lg"
          className="h-14 w-full text-base font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg"
          onClick={onSuivante}
        >
          <Sparkles className="h-5 w-5 mr-2" />
          Installer la balise suivante
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-12 w-full rounded-xl border-slate-300"
          onClick={() => window.open(`/a/${numero}`, "_blank", "noopener")}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Voir la fiche publique
        </Button>
      </div>
    </div>
  );
}

export function InstallSuccessLocal({ numero, onSuivante }: { numero: string; onSuivante: () => void }) {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-6 px-4">
      {/* Cercle avec icône offline */}
      <div className="relative">
        <div className="h-32 w-32 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-2xl">
          <CloudOff className="h-16 w-16 text-white" strokeWidth={2} />
        </div>
        <div className="absolute -bottom-1 -right-1 h-12 w-12 rounded-full bg-white shadow-lg flex items-center justify-center">
          <Clock className="h-6 w-6 text-amber-600" />
        </div>
      </div>

      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 text-amber-700 px-3 py-1 text-xs font-semibold">
          <Cloud className="h-3 w-3" /> En attente de synchronisation
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Enregistrée localement</h1>
        <div className="font-mono text-lg font-bold text-slate-700">{numero}</div>
      </div>

      <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 w-full max-w-sm">
        <CardContent className="p-4 text-center">
          <p className="text-sm text-slate-700">
            L'installation sera envoyée automatiquement dès que votre appareil retrouvera une connexion internet.
          </p>
        </CardContent>
      </Card>

      <div className="w-full max-w-sm">
        <Button
          size="lg"
          className="h-14 w-full text-base font-semibold bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white shadow-lg"
          onClick={onSuivante}
        >
          <Sparkles className="h-5 w-5 mr-2" />
          Installer la balise suivante
        </Button>
      </div>
    </div>
  );
}

export function InstallError({ message, onReessayer }: { message: string; onReessayer: () => void }) {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-6 px-4">
      {/* Cercle erreur */}
      <div className="relative">
        <div className="h-32 w-32 rounded-full bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center shadow-2xl">
          <XCircle className="h-16 w-16 text-white" strokeWidth={2.5} />
        </div>
      </div>

      <div className="text-center space-y-2 max-w-sm">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 text-rose-700 px-3 py-1 text-xs font-semibold">
          <XCircle className="h-3 w-3" /> Erreur d'enregistrement
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Impossible d'enregistrer</h1>
        <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
      </div>

      <div className="w-full max-w-sm space-y-2">
        <Button
          size="lg"
          className="h-14 w-full text-base font-semibold bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white shadow-lg"
          onClick={onReessayer}
        >
          <RefreshCw className="h-5 w-5 mr-2" />
          Réessayer
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-12 w-full rounded-xl border-emerald-300 text-emerald-700 hover:bg-emerald-50"
          onClick={() =>
            window.open(
              `https://wa.me/${SUPERVISOR_WHATSAPP}?text=${encodeURIComponent("Problème d'installation : " + message)}`,
              "_blank",
              "noopener",
            )
          }
        >
          <MessageCircle className="h-4 w-4 mr-2" />
          Contacter le superviseur
        </Button>
      </div>
    </div>
  );
}
