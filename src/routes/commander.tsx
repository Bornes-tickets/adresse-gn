// src/routes/commander.tsx
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Check, Home, MapPin, Phone, User, MessageCircle, ShieldCheck, Truck,
  Zap, ArrowRight, Smartphone, Banknote, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const WHATSAPP_SERVICE = "224620000000";
const PRIX_GNF = 150000;

const AVANTAGES = [
  { icone: ShieldCheck, texte: "Balise physique certifiée avec QR code" },
  { icone: User, texte: "Pose par un agent agréé Adresse GN" },
  { icone: MapPin, texte: "Relevé GPS de précision (< 5 m)" },
  { icone: Truck, texte: "Livraison et pose sous 72 h à Conakry" },
];

type Paiement = "orange_money" | "mtn_money" | "cash";

const PAIEMENTS: { code: Paiement; label: string; icone: any; desc: string }[] = [
  { code: "orange_money", label: "Orange Money", icone: Smartphone, desc: "Paiement mobile" },
  { code: "mtn_money", label: "MTN Mobile Money", icone: Smartphone, desc: "Paiement mobile" },
  { code: "cash", label: "Espèces", icone: Banknote, desc: "À la livraison" },
];

export const Route = createFileRoute("/commander")({
  head: () => ({
    meta: [
      { title: "Commander votre Adresse GN — 150 000 GNF" },
      { name: "description", content: "Commandez votre plaque Adresse GN. Livraison 72 h à Conakry. Paiement Mobile Money ou espèces." },
    ],
  }),
  component: Commander,
});

function Commander() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    nom: "",
    telephone: "",
    commune: "",
    adresse: "",
    point_acces: "",
    paiement: "orange_money" as Paiement,
    notes: "",
  });

  const set = (k: keyof typeof form, v: string) => setForm({ ...form, [k]: v });

  const valide =
    form.nom.trim().length >= 2 &&
    /^(\+?224)?\s?\d{9}$/.test(form.telephone.replace(/\s/g, "")) &&
    form.commune.trim().length >= 2 &&
    form.adresse.trim().length >= 5;

  const soumettre = async () => {
    if (!valide) { toast.error("Merci de remplir tous les champs obligatoires"); return; }
    setBusy(true);
    // MVP : bascule sur WhatsApp avec le récap pré-rempli.
    // Remplace par un vrai POST vers ton backend quand tu auras une table `orders`.
    const paiementLabel = PAIEMENTS.find((p) => p.code === form.paiement)?.label ?? form.paiement;
    const message = [
      "🏠 *Nouvelle commande Adresse GN*",
      "",
      `👤 *Nom :* ${form.nom}`,
      `📱 *Téléphone :* ${form.telephone}`,
      `🗺️ *Commune :* ${form.commune}`,
      `📍 *Adresse :* ${form.adresse}`,
      form.point_acces && `🚪 *Point d'accès :* ${form.point_acces}`,
      "",
      "📦 *Pack :* Résidentiel Standard",
      `💰 *Prix :* ${new Intl.NumberFormat("fr-FR").format(PRIX_GNF)} GNF (paiement unique)`,
      `💳 *Paiement :* ${paiementLabel}`,
      form.notes && `📝 *Notes :* ${form.notes}`,
      "",
      "Merci de me confirmer la disponibilité et l'horaire de pose. 🙏",
    ].filter(Boolean).join("\n");
    const url = `https://wa.me/${WHATSAPP_SERVICE}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener");
    setBusy(false);
    toast.success("Ouverture de WhatsApp — envoyez le message pour confirmer votre commande.");
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero résumé pack */}
      <section className="gradient-signature-soft px-4 pt-8 pb-14 sm:px-6 md:pt-16 md:pb-20 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mx-auto flex w-fit items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 backdrop-blur border border-white/20">
            <Sparkles className="size-3.5 text-white" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-white">Offre la plus populaire</span>
          </div>
          <h1 className="text-display mt-4 text-3xl md:text-5xl font-extrabold text-white leading-tight">
            Créer mon Adresse GN
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm md:text-lg text-white/85 leading-relaxed">
            Complétez ce formulaire — un agent vous contacte sous 24 h pour confirmer la pose.
          </p>
        </div>
      </section>

      {/* Contenu */}
      <section className="px-4 sm:px-6 lg:px-8 -mt-8 md:-mt-12 pb-16">
        <div className="mx-auto max-w-5xl grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Formulaire */}
          <div className="lg:col-span-3 rounded-3xl bg-white shadow-xl border border-slate-200 p-6 md:p-8">
            <h2 className="text-lg md:text-xl font-bold text-slate-900 mb-1">Vos informations</h2>
            <p className="text-xs text-slate-500 mb-6">Champs marqués * obligatoires</p>

            <div className="space-y-4">
              <div>
                <Label htmlFor="nom" className="text-xs font-semibold uppercase tracking-wider text-slate-600">Nom complet *</Label>
                <Input
                  id="nom"
                  value={form.nom}
                  onChange={(e) => set("nom", e.target.value)}
                  placeholder="Ex : Aminata Diallo"
                  className="h-12 mt-1.5"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tel" className="text-xs font-semibold uppercase tracking-wider text-slate-600">Téléphone / WhatsApp *</Label>
                  <div className="relative mt-1.5">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                    <Input
                      id="tel"
                      type="tel"
                      value={form.telephone}
                      onChange={(e) => set("telephone", e.target.value)}
                      placeholder="+224 620 XX XX XX"
                      className="h-12 pl-10 font-mono"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="commune" className="text-xs font-semibold uppercase tracking-wider text-slate-600">Commune *</Label>
                  <div className="relative mt-1.5">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                    <Input
                      id="commune"
                      value={form.commune}
                      onChange={(e) => set("commune", e.target.value)}
                      placeholder="Ex : Kaloum, Ratoma…"
                      className="h-12 pl-10"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="adresse" className="text-xs font-semibold uppercase tracking-wider text-slate-600">Adresse de pose *</Label>
                <Textarea
                  id="adresse"
                  value={form.adresse}
                  onChange={(e) => set("adresse", e.target.value)}
                  placeholder="Ex : Quartier Coleah, Rue KA-045, Villa bleue à côté de la mosquée…"
                  rows={2}
                  className="mt-1.5 resize-none"
                />
              </div>

              <div>
                <Label htmlFor="point" className="text-xs font-semibold uppercase tracking-wider text-slate-600">Point d'accès (facultatif)</Label>
                <Input
                  id="point"
                  value={form.point_acces}
                  onChange={(e) => set("point_acces", e.target.value)}
                  placeholder="Ex : Portail vert, sonnette au 1er étage…"
                  className="h-12 mt-1.5"
                />
              </div>

              {/* Paiement */}
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2 block">Mode de paiement *</Label>
                <div className="grid grid-cols-3 gap-2">
                  {PAIEMENTS.map((p) => {
                    const Ic = p.icone;
                    const sel = form.paiement === p.code;
                    return (
                      <button
                        key={p.code}
                        type="button"
                        onClick={() => set("paiement", p.code)}
                        className={cn(
                          "p-3 rounded-xl border-2 text-left transition-all active:scale-95",
                          sel
                            ? "border-accent bg-accent/5 shadow-sm"
                            : "border-slate-200 hover:border-slate-300"
                        )}
                      >
                        <Ic className={cn("size-5 mb-1", sel ? "text-accent" : "text-slate-500")} />
                        <div className={cn("text-xs font-bold", sel ? "text-accent" : "text-slate-900")}>{p.label}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{p.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label htmlFor="notes" className="text-xs font-semibold uppercase tracking-wider text-slate-600">Instructions particulières (facultatif)</Label>
                <Textarea
                  id="notes"
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  placeholder="Ex : Horaire de pose souhaité, personne à joindre…"
                  rows={2}
                  className="mt-1.5 resize-none"
                />
              </div>

              <Button
                onClick={soumettre}
                disabled={!valide || busy}
                className={cn(
                  "w-full h-14 text-base font-semibold rounded-2xl transition-all",
                  valide
                    ? "bg-gradient-to-r from-accent to-accent-dark text-accent-foreground shadow-lg shadow-accent/25 hover:shadow-accent/40 active:scale-[0.98]"
                    : "bg-slate-200 text-slate-500 cursor-not-allowed"
                )}
              >
                <MessageCircle className="size-5 mr-2" />
                Envoyer ma commande via WhatsApp
                <ArrowRight className="size-5 ml-1" />
              </Button>

              <p className="text-[11px] text-center text-slate-500">
                Aucun paiement en ligne à cette étape. Un agent vous rappelle sous 24 h pour confirmer la pose et le paiement.
              </p>
            </div>
          </div>

          {/* Récapitulatif pack */}
          <aside className="lg:col-span-2 space-y-4">
            {/* Card pack */}
            <div className="rounded-3xl bg-white shadow-xl border-2 border-accent/20 overflow-hidden">
              <div className="bg-gradient-to-br from-accent to-accent-dark p-4">
                <div className="flex items-center gap-2 text-white/80 text-[10px] font-bold uppercase tracking-widest">
                  <Home className="size-3" /> Résidentiel Standard
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-3xl md:text-4xl font-extrabold text-white">
                    {new Intl.NumberFormat("fr-FR").format(PRIX_GNF)}
                  </span>
                  <span className="text-sm font-medium text-white/85">GNF</span>
                </div>
                <div className="text-[11px] text-white/75 mt-1">Paiement unique · Sans abonnement</div>
              </div>
              <div className="p-5">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Ce qui est inclus</div>
                <ul className="space-y-2.5">
                  {AVANTAGES.map(({ icone: Ic, texte }, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent/15">
                        <Check className="size-3 text-accent" />
                      </div>
                      <span className="text-xs text-slate-700 leading-relaxed">{texte}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Trust */}
            <div className="rounded-2xl bg-white border border-slate-200 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <ShieldCheck className="size-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Agents certifiés</div>
                  <div className="text-[10px] text-slate-500">Pose garantie et vérifiée</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
                  <Zap className="size-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">72 h à Conakry</div>
                  <div className="text-[10px] text-slate-500">Pose sous 3 jours ouvrés</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center">
                  <MessageCircle className="size-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Support WhatsApp</div>
                  <div className="text-[10px] text-slate-500">7j/7 en français, poular, malinké</div>
                </div>
              </div>
            </div>

            {/* Comparaison */}
            <div className="text-center">
              <Link
                to="/tarifs"
                className="text-xs text-slate-500 hover:text-slate-900 underline underline-offset-4"
              >
                Voir toutes les offres →
              </Link>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

