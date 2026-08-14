import { Home, Building2, ShoppingBag, Landmark, Sparkles, Info, Eye, EyeOff, User, Phone, ShieldCheck, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORY_LABELS, isCommercialCategory } from "@/lib/geo";
import type { InstallDetails } from "@/components/agent/install/types";
import { cn } from "@/lib/utils";

interface Props {
  details: InstallDetails;
  onChange: (details: InstallDetails) => void;
}

const CAT_ICONS: Record<string, any> = {
  habitation: Home,
  commerce: ShoppingBag,
  entreprise: Building2,
  administration: Landmark,
};

export function StepDetails({ details, onChange }: Props) {
  const set = <K extends keyof InstallDetails>(cle: K, valeur: InstallDetails[K]) =>
    onChange({ ...details, [cle]: valeur });
  const nomRequis = isCommercialCategory(details.category);

  return (
    <div className="space-y-4">
      {/* Hero */}
      <Card className="overflow-hidden border-0 shadow-lg">
        <div className="bg-gradient-to-br from-violet-500 via-fuchsia-600 to-pink-600 p-6 text-white relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_60%)]" />
          <div className="relative text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur mb-3 shadow-lg">
              <Info className="h-7 w-7" />
            </div>
            <div className="text-xs uppercase tracking-widest text-white/80 font-semibold mb-1">Détails de l'adresse</div>
            <div className="text-xl font-bold">Informations complémentaires</div>
          </div>
        </div>
      </Card>

      {/* Section catégorie — cards visuelles */}
      <Card className="border-slate-200">
        <CardContent className="p-4">
          <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-3 block">Catégorie de lieu</Label>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(CATEGORY_LABELS).map(([valeur, label]) => {
              const Ic = CAT_ICONS[valeur] ?? Home;
              const sel = details.category === valeur;
              return (
                <button
                  key={valeur}
                  type="button"
                  onClick={() => set("category", valeur)}
                  className={cn(
                    "p-3 rounded-xl border-2 transition-all text-left",
                    sel
                      ? "border-violet-500 bg-gradient-to-br from-violet-50 to-fuchsia-50 shadow-md"
                      : "border-slate-200 hover:border-slate-300 bg-white",
                  )}
                >
                  <div className={cn(
                    "h-9 w-9 rounded-lg flex items-center justify-center mb-2 transition",
                    sel ? "bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow" : "bg-slate-100 text-slate-500",
                  )}>
                    <Ic className="h-4 w-4" />
                  </div>
                  <div className={cn("text-sm font-semibold", sel ? "text-violet-700" : "text-slate-700")}>{label}</div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Nom du lieu */}
      <Card className="border-slate-200">
        <CardContent className="p-4 space-y-2">
          <Label htmlFor="nom-lieu" className="text-xs font-semibold uppercase tracking-wider text-slate-600">
            Nom du lieu {nomRequis && <span className="text-rose-500">*</span>}
          </Label>
          <Input
            id="nom-lieu"
            className="h-12 rounded-xl"
            value={details.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder={nomRequis ? "Ex : Pharmacie du Port" : "Ex : Maison Camara (optionnel)"}
          />
        </CardContent>
      </Card>

      {/* Point d'accès */}
      <Card className="border-slate-200">
        <CardContent className="p-4 space-y-2">
          <Label htmlFor="point-acces" className="text-xs font-semibold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
            <MapPin className="h-3 w-3" /> Point d'accès
          </Label>
          <Textarea
            id="point-acces"
            rows={3}
            className="rounded-xl"
            value={details.access_point_note}
            onChange={(e) => set("access_point_note", e.target.value)}
            placeholder="Ex : Portail bleu à droite du bâtiment"
          />
        </CardContent>
      </Card>

      {/* Visibilité — toggle cards */}
      <Card className="border-slate-200">
        <CardContent className="p-4">
          <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-3 block">Visibilité de l'adresse</Label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => set("visibility", "private")}
              className={cn(
                "p-3 rounded-xl border-2 transition-all",
                details.visibility === "private"
                  ? "border-slate-800 bg-slate-50 shadow-md"
                  : "border-slate-200 hover:border-slate-300",
              )}
            >
              <div className={cn(
                "h-9 w-9 rounded-lg flex items-center justify-center mb-2",
                details.visibility === "private" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500",
              )}>
                <EyeOff className="h-4 w-4" />
              </div>
              <div className="text-sm font-semibold text-slate-900 text-left">Privée</div>
              <div className="text-[10px] text-slate-500 text-left mt-0.5">Visible par le propriétaire</div>
            </button>
            <button
              type="button"
              onClick={() => set("visibility", "public")}
              className={cn(
                "p-3 rounded-xl border-2 transition-all",
                details.visibility === "public"
                  ? "border-emerald-500 bg-emerald-50 shadow-md"
                  : "border-slate-200 hover:border-slate-300",
              )}
            >
              <div className={cn(
                "h-9 w-9 rounded-lg flex items-center justify-center mb-2",
                details.visibility === "public" ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500",
              )}>
                <Eye className="h-4 w-4" />
              </div>
              <div className="text-sm font-semibold text-slate-900 text-left">Publique</div>
              <div className="text-[10px] text-slate-500 text-left mt-0.5">Trouvable dans la recherche</div>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Propriétaire */}
      <Card className="border-slate-200">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-slate-500" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">Propriétaire / responsable</span>
          </div>
          <div className="space-y-2">
            <Input
              className="h-12 rounded-xl"
              value={details.owner_name}
              onChange={(e) => set("owner_name", e.target.value)}
              placeholder="Nom complet"
            />
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="tel"
                inputMode="tel"
                className="h-12 rounded-xl pl-9"
                value={details.owner_phone}
                onChange={(e) => set("owner_phone", e.target.value)}
                placeholder="+224 6XX XX XX XX"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Consentement RGPD */}
      <Card className={cn(
        "border-2 overflow-hidden transition-all",
        details.consent ? "border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-50" : "border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50",
      )}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="consentement"
              checked={details.consent}
              onCheckedChange={(v) => set("consent", v === true)}
              className="mt-1 h-5 w-5"
            />
            <div className="flex-1">
              <Label htmlFor="consentement" className="text-sm font-semibold text-slate-900 leading-snug cursor-pointer flex items-center gap-1.5">
                <ShieldCheck className={cn("h-4 w-4", details.consent ? "text-emerald-600" : "text-amber-600")} />
                Consentement RGPD
              </Label>
              <p className="text-xs text-slate-700 mt-1 leading-relaxed">
                Le propriétaire consent à l'enregistrement de cette adresse et a été informé de la politique de confidentialité.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Astuce */}
      <div className="rounded-xl bg-gradient-to-br from-violet-50 to-fuchsia-50 border border-violet-200 p-3 text-xs text-violet-800 flex items-start gap-2">
        <Sparkles className="h-4 w-4 mt-0.5 shrink-0 text-violet-500" />
        <span>Les commerces et entreprises doivent obligatoirement porter un nom pour être identifiables.</span>
      </div>
    </div>
  );
}
