// src/components/public/ClaimAddressCard.tsx
import { UserPlus, ShieldCheck, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

interface Props {
  numero: string;
  hasOwner?: boolean;
  ownerName?: string | null;
}

export function ClaimAddressCard({ numero, hasOwner, ownerName }: Props) {
  // Cas 1 : déjà revendiquée
  if (hasOwner) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-emerald-900">Adresse vérifiée</div>
          <div className="text-xs text-emerald-700 mt-0.5 truncate">
            {ownerName ? `Propriétaire : ${ownerName}` : "Un propriétaire a revendiqué cette adresse."}
          </div>
        </div>
      </div>
    );
  }

  // Cas 2 : disponible à la revendication
  return (
    <div className="rounded-2xl border-2 border-violet-200 bg-gradient-to-br from-violet-50 via-fuchsia-50 to-pink-50 p-4 overflow-hidden relative">
      <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-gradient-to-br from-violet-300/30 to-pink-300/30 blur-2xl pointer-events-none" />
      <div className="relative">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-violet-500 via-fuchsia-600 to-pink-600 text-white flex items-center justify-center shrink-0 shadow-md">
            <UserPlus className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <div className="text-sm font-bold text-slate-900">C'est votre lieu ?</div>
              <Sparkles className="h-3.5 w-3.5 text-violet-600" />
            </div>
            <div className="text-xs text-slate-700 mt-1 leading-relaxed">
              Devenez propriétaire de cette adresse pour la personnaliser (nom, photo, description) et recevoir vos livraisons.
            </div>
          </div>
        </div>
        <ul className="mt-3 space-y-1.5 text-xs text-slate-700 pl-14">
          <li className="flex items-center gap-1.5">
            <div className="h-1 w-1 rounded-full bg-violet-600" />
            Personnalisez le nom affiché
          </li>
          <li className="flex items-center gap-1.5">
            <div className="h-1 w-1 rounded-full bg-violet-600" />
            Ajoutez une photo, une description
          </li>
          <li className="flex items-center gap-1.5">
            <div className="h-1 w-1 rounded-full bg-violet-600" />
            Recevez des notifications pour les visites
          </li>
        </ul>
        <Link to="/a/$number" params={{ number: numero }} className="block mt-4">
          <Button className="w-full h-12 bg-gradient-to-r from-violet-500 via-fuchsia-600 to-pink-600 hover:from-violet-600 hover:via-fuchsia-700 hover:to-pink-700 text-white shadow-md font-semibold">
            <UserPlus className="h-4 w-4 mr-2" />
            Devenir propriétaire
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </Link>
        <div className="mt-2 text-center text-[10px] text-slate-500">
          Gratuit · Vérification par SMS
        </div>
      </div>
    </div>
  );
}

