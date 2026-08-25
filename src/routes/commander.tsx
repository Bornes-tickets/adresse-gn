// src/routes/commander.tsx
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  Check, Home, MapPin, Phone, User, MessageCircle, ShieldCheck, Truck,
  Zap, ArrowRight, Smartphone, Banknote, Sparkles, CreditCard, Building2,
  Briefcase, Landmark, Mail, Globe, FileText, Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { createOrder } from "@/lib/orders.functions";

/* ==================== Types ==================== */
type ClientType = "particulier" | "professionnel" | "institutionnel";
const CLIENT_TYPES: { code: ClientType; label: string; desc: string; icone: any }[] = [
  { code: "particulier",    label: "Particulier",    desc: "Domicile, logement",          icone: Home },
  { code: "professionnel",  label: "Professionnel",  desc: "Commerce, entreprise",        icone: Briefcase },
  { code: "institutionnel", label: "Institutionnel", desc: "Administration, ONG, école",  icone: Landmark },
];
interface Formule {
  code: string;
  label: string;
  prix: number;              // installation (ou paiement unique) — 0 = sur devis
  prix_mensuel?: number;     // abonnement mensuel optionnel
  desc: string;
  avantages: string[];
  populaire?: boolean;
}
const FORMULES: Record<ClientType, Formule[]> = {
  particulier: [
    {
      code: "numerique",
      label: "Numérique seule",
      prix: 40000,
      desc: "Adresse enregistrée, sans balise physique",
      avantages: ["Numéro unique GN-CKY-XXXXXX", "Localisation GPS vérifiée", "Partage du lien et itinéraire"],
    },
    {
      code: "residentiel_standard",
      label: "Résidentiel Standard",
      prix: 150000,
      desc: "Plaque balise posée par un agent agréé",
      avantages: ["Balise physique avec QR code", "Pose par agent Adresse GN", "Relevé GPS de précision", "Fiche adresse et itinéraire"],
      populaire: true,
    },
    {
      code: "residentiel_premium",
      label: "Résidentiel Premium",
      prix: 300000,
      desc: "Balise renforcée + point d'accès détaillé",
      avantages: ["Balise renforcée longue durée", "Pose prioritaire sous 72 h", "Note d'accès détaillée (portail, étage)", "Assistance au remplacement 12 mois"],
    },
  ],
  professionnel: [
    {
      code: "pro_basic",
      label: "Pro Basic",
      prix: 350000,
      prix_mensuel: 50000,
      desc: "Fiche établissement pour les commerces",
      avantages: [
        "1 fiche établissement",
        "Nom, téléphone, horaires",
        "Statistiques de base (30 jours)",
        "QR code téléchargeable",
      ],
    },
    {
      code: "pro_plus",
      label: "Pro Plus",
      prix: 600000,
      prix_mensuel: 150000,
      desc: "Fiche enrichie, équipe et statistiques avancées",
      avantages: [
        "Fiche enrichie (photos, description)",
        "Statistiques détaillées 90 jours",
        "Équipe multi-utilisateurs",
        "Support prioritaire",
      ],
      populaire: true,
    },
    {
      code: "pro_multisites",
      label: "Multi-sites",
      prix: 0,
      desc: "Réseau de sites (à partir de 5)",
      avantages: ["Devis personnalisé", "Tarif dégressif volumique", "Compte pro avec dashboard", "Support dédié"],
    },
  ],
  institutionnel: [
    {
      code: "inst_pack",
      label: "Pack Institutionnel",
      prix: 0,
      desc: "Administration, ONG, ministère, école",
      avantages: ["Devis sur mesure", "Facturation en GNF ou EUR/USD", "Convention et bon de commande", "Pose planifiée par lots"],
      populaire: true,
    },
  ],
};

/* ==================== Paiements ==================== */
type Paiement =
  | "orange_money" | "mtn_money" | "carte_bancaire"
  | "paypal" | "cash" | "virement";
const PAIEMENTS: { code: Paiement; label: string; icone: any; desc: string; disponiblePour: ClientType[] }[] = [
  { code: "orange_money",   label: "Orange Money",           icone: Smartphone, desc: "Paiement mobile instantané",  disponiblePour: ["particulier", "professionnel", "institutionnel"] },
  { code: "mtn_money",      label: "MTN Mobile Money",       icone: Smartphone, desc: "Paiement mobile instantané",  disponiblePour: ["particulier", "professionnel", "institutionnel"] },
  { code: "carte_bancaire", label: "Carte bancaire",         icone: CreditCard, desc: "Visa, Mastercard",            disponiblePour: ["particulier", "professionnel", "institutionnel"] },
  { code: "paypal",         label: "PayPal",                 icone: Wallet,     desc: "Compte PayPal international", disponiblePour: ["particulier", "professionnel", "institutionnel"] },
  { code: "cash",           label: "Espèces à la livraison", icone: Banknote,   desc: "À l'installation",            disponiblePour: ["particulier", "professionnel"] },
  { code: "virement",       label: "Virement bancaire",      icone: Building2,  desc: "Institutions et pros",        disponiblePour: ["professionnel", "institutionnel"] },
];

/* ==================== Route + query params ==================== */
type CommanderSearch = { type?: ClientType; formule?: string };
export const Route = createFileRoute("/commander")({
  validateSearch: (search: Record<string, unknown>): CommanderSearch => {
    const type = search["type"];
    const formule = search["formule"];
    const valid: CommanderSearch = {};
    if (type === "particulier" || type === "professionnel" || type === "institutionnel") {
      valid.type = type;
    }
    if (typeof formule === "string") valid.formule = formule;
    return valid;
  },
  head: () => ({
    meta: [
      { title: "Commander votre Adresse GN" },
      { name: "description", content: "Créez votre Adresse GN. Particulier, professionnel ou institutionnel. Paiement Mobile Money, carte bancaire, PayPal, virement ou espèces." },
    ],
  }),
  component: Commander,
});

function formatGNF(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n) + " GNF";
}

function Commander() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const submitOrder = useServerFn(createOrder);
  const [type, setType] = useState<ClientType>(search.type ?? "particulier");
  const initialFormule = search.formule ?? FORMULES[search.type ?? "particulier"][0]?.code ?? "";
  const [formuleCode, setFormuleCode] = useState<string>(initialFormule);
  const [paiement, setPaiement] = useState<Paiement>("orange_money");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    nom: "", telephone: "", email: "",
    commune: "", adresse: "", point_acces: "", notes: "",
    raison_sociale: "", fonction: "", rccm: "", nif: "", site_web: "",
    nb_adresses: "1", devis_souhaite: false,
  });
  const set = (k: keyof typeof form, v: any) => setForm({ ...form, [k]: v });
  const formulesDispo = FORMULES[type];
  const formule = formulesDispo.find((f) => f.code === formuleCode) ?? formulesDispo[0]!;
  const paiementsDispo = useMemo(() => PAIEMENTS.filter((p) => p.disponiblePour.includes(type)), [type]);
  useEffect(() => {
    if (search.type && search.type !== type) setType(search.type);
    if (search.formule && search.formule !== formuleCode) {
      const t = search.type ?? type;
      const exists = FORMULES[t].some((f) => f.code === search.formule);
      if (exists) setFormuleCode(search.formule);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.type, search.formule]);
  const changerType = (t: ClientType) => {
    setType(t);
    const first = FORMULES[t][0];
    if (first) setFormuleCode(first.code);
    if (!PAIEMENTS.find((p) => p.code === paiement && p.disponiblePour.includes(t))) {
      const firstPay = PAIEMENTS.find((p) => p.disponiblePour.includes(t));
      if (firstPay) setPaiement(firstPay.code);
    }
  };
  const requiresPro = type === "professionnel" || type === "institutionnel";
  const isDevis = formule.prix === 0 || form.devis_souhaite;
  const valide =
    form.nom.trim().length >= 2 &&
    /^(\+?224)?\s?\d{9}$/.test(form.telephone.replace(/\s/g, "")) &&
    form.commune.trim().length >= 2 &&
    form.adresse.trim().length >= 5 &&
    (!requiresPro || form.raison_sociale.trim().length >= 2) &&
    (!requiresPro || form.email.trim().length >= 5);
  const nbAdresses = requiresPro ? Number(form.nb_adresses || "1") : 1;
  const prixInstallation = formule.prix * nbAdresses;
  const prixMensuel = (formule.prix_mensuel ?? 0) * nbAdresses;

  const soumettre = async () => {
    if (!valide) { toast.error("Merci de remplir tous les champs obligatoires"); return; }
    setBusy(true);

    try {
      // 1. Enregistre la commande côté serveur (retourne guest_token + tracking_url + whatsapp_url)
      const result = await submitOrder({
        data: {
          client_type: type,
          full_name: form.nom.trim(),
          phone: form.telephone.trim(),
          email: form.email.trim() || undefined,
          address_line: form.adresse.trim(),
          quartier: form.commune.trim(),
          city: "Conakry",
          notes: [
            form.point_acces && `Point d'accès : ${form.point_acces}`,
            form.notes && form.notes,
          ].filter(Boolean).join(" | ") || undefined,
          raison_sociale: form.raison_sociale.trim() || undefined,
          fonction: form.fonction.trim() || undefined,
          rccm: form.rccm.trim() || undefined,
          nif: form.nif.trim() || undefined,
          site_web: form.site_web.trim() || undefined,
          nb_adresses: nbAdresses,
          devis_demande: isDevis,
          formule_code: formule.code,
          formule_label: formule.label,
          prix_ttc: isDevis ? 0 : prixInstallation,
          payment_method: paiement,
        },
      });

      // 2. Sauvegarde locale du token pour retrouver ses commandes plus tard
      try {
        const existing = JSON.parse(localStorage.getItem("agn.guest_orders") || "[]");
        localStorage.setItem(
          "agn.guest_orders",
          JSON.stringify([
            ...existing,
            {
              token: result.guest_token,
              formule: formule.label,
              at: Date.now(),
            },
          ]),
        );
      } catch {}

      // 3. Ouvre WhatsApp pré-rempli vers l'équipe Adresse GN
      window.open(result.whatsapp_url, "_blank", "noopener");

      // 4. Redirige vers la page de suivi (bookmarkable)
      toast.success("Commande enregistrée ! Nous vous contactons sous 24 h.");
      navigate({ to: "/suivi/$token", params: { token: result.guest_token } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      console.error("[commander] submit error:", err);
      toast.error(`Enregistrement impossible : ${message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero */}
      <section className="gradient-signature-soft px-4 pt-8 pb-14 sm:px-6 md:pt-16 md:pb-20 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mx-auto flex w-fit items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 backdrop-blur border border-white/20">
            <Sparkles className="size-3.5 text-white" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-white">Commander en 2 minutes</span>
          </div>
          <h1 className="text-display mt-4 text-3xl md:text-5xl font-extrabold text-white leading-tight">
            Créer mon Adresse GN
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm md:text-lg text-white/85 leading-relaxed">
            Choisissez votre profil et votre formule. Un agent vous contacte sous 24 h pour confirmer.
          </p>
        </div>
      </section>
      <section className="px-4 sm:px-6 lg:px-8 -mt-8 md:-mt-12 pb-16">
        <div className="mx-auto max-w-5xl grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Formulaire */}
          <div className="lg:col-span-3 rounded-3xl bg-white shadow-xl border border-slate-200 p-6 md:p-8 space-y-8">
            {/* 1. Type client */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <span className="flex size-7 items-center justify-center rounded-full bg-accent text-accent-foreground text-xs font-bold">1</span>
                <h2 className="text-base md:text-lg font-bold text-slate-900">Vous êtes…</h2>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {CLIENT_TYPES.map((c) => {
                  const Ic = c.icone;
                  const sel = type === c.code;
                  return (
                    <button key={c.code} type="button" onClick={() => changerType(c.code)}
                      className={cn(
                        "p-3 rounded-xl border-2 text-left transition-all active:scale-95",
                        sel ? "border-accent bg-accent/5 shadow-sm" : "border-slate-200 hover:border-slate-300"
                      )}>
                      <Ic className={cn("size-5 mb-1.5", sel ? "text-accent" : "text-slate-500")} />
                      <div className={cn("text-xs font-bold", sel ? "text-accent" : "text-slate-900")}>{c.label}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">{c.desc}</div>
                    </button>
                  );
                })}
              </div>
            </section>
            {/* 2. Formule */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <span className="flex size-7 items-center justify-center rounded-full bg-accent text-accent-foreground text-xs font-bold">2</span>
                <h2 className="text-base md:text-lg font-bold text-slate-900">Votre formule</h2>
              </div>
              <div className="space-y-2">
                {formulesDispo.map((f) => {
                  const sel = formuleCode === f.code;
                  return (
                    <button key={f.code} type="button" onClick={() => setFormuleCode(f.code)}
                      className={cn(
                        "w-full p-4 rounded-xl border-2 text-left transition-all active:scale-[0.99] relative",
                        sel ? "border-accent bg-accent/5 shadow-sm" : "border-slate-200 hover:border-slate-300"
                      )}>
                      {f.populaire && (
                        <span className="absolute -top-2 right-3 rounded-full bg-gradient-to-r from-accent to-accent-dark px-2 py-0.5 text-[9px] font-bold text-white uppercase tracking-widest">
                          Plus populaire
                        </span>
                      )}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className={cn("text-sm font-bold", sel ? "text-accent" : "text-slate-900")}>{f.label}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{f.desc}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className={cn("text-base font-extrabold", sel ? "text-accent" : "text-slate-900")}>
                            {f.prix === 0 ? "Sur devis" : formatGNF(f.prix)}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {f.prix === 0
                              ? "personnalisé"
                              : f.prix_mensuel
                                ? `à l'installation, puis ${formatGNF(f.prix_mensuel)} / mois`
                                : "paiement unique"}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {requiresPro && formule.prix > 0 && (
                <div className="mt-3">
                  <Label htmlFor="nb" className="text-xs font-semibold uppercase tracking-wider text-slate-600">Nombre d'établissements</Label>
                  <Input id="nb" type="number" min="1" value={form.nb_adresses}
                    onChange={(e) => set("nb_adresses", e.target.value)}
                    className="h-11 mt-1.5 max-w-[140px] font-mono" />
                </div>
              )}
            </section>
            {/* 3. Coordonnées */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <span className="flex size-7 items-center justify-center rounded-full bg-accent text-accent-foreground text-xs font-bold">3</span>
                <h2 className="text-base md:text-lg font-bold text-slate-900">Vos coordonnées</h2>
              </div>
              {requiresPro && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="sm:col-span-2">
                    <Label htmlFor="rs" className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                      {type === "institutionnel" ? "Nom de l'institution *" : "Raison sociale *"}
                    </Label>
                    <div className="relative mt-1.5">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                      <Input id="rs" value={form.raison_sociale} onChange={(e) => set("raison_sociale", e.target.value)}
                        placeholder={type === "institutionnel" ? "Ex : Ministère de la Ville" : "Ex : Ma Société SARL"}
                        className="h-11 pl-10" />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="fn" className="text-xs font-semibold uppercase tracking-wider text-slate-600">Fonction du contact</Label>
                    <Input id="fn" value={form.fonction} onChange={(e) => set("fonction", e.target.value)}
                      placeholder="Ex : Directeur" className="h-11 mt-1.5" />
                  </div>
                  <div>
                    <Label htmlFor="rccm" className="text-xs font-semibold uppercase tracking-wider text-slate-600">RCCM</Label>
                    <Input id="rccm" value={form.rccm} onChange={(e) => set("rccm", e.target.value)}
                      placeholder="Ex : GN.CKY.2024.B.1234" className="h-11 mt-1.5 font-mono" />
                  </div>
                  <div>
                    <Label htmlFor="nif" className="text-xs font-semibold uppercase tracking-wider text-slate-600">NIF (identifiant fiscal)</Label>
                    <Input id="nif" value={form.nif} onChange={(e) => set("nif", e.target.value)}
                      placeholder="Numéro d'identification fiscale" className="h-11 mt-1.5 font-mono" />
                  </div>
                  <div>
                    <Label htmlFor="web" className="text-xs font-semibold uppercase tracking-wider text-slate-600">Site web</Label>
                    <div className="relative mt-1.5">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                      <Input id="web" value={form.site_web} onChange={(e) => set("site_web", e.target.value)}
                        placeholder="https://…" className="h-11 pl-10" />
                    </div>
                  </div>
                </div>
              )}
              <div>
                <Label htmlFor="nom" className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  {requiresPro ? "Nom du contact *" : "Nom complet *"}
                </Label>
                <div className="relative mt-1.5">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                  <Input id="nom" value={form.nom} onChange={(e) => set("nom", e.target.value)}
                    placeholder="Ex : Aminata Diallo" className="h-11 pl-10" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <div>
                  <Label htmlFor="tel" className="text-xs font-semibold uppercase tracking-wider text-slate-600">Téléphone / WhatsApp *</Label>
                  <div className="relative mt-1.5">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                    <Input id="tel" type="tel" value={form.telephone} onChange={(e) => set("telephone", e.target.value)}
                      placeholder="+224 620 XX XX XX" className="h-11 pl-10 font-mono" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Email {requiresPro && "*"}
                  </Label>
                  <div className="relative mt-1.5">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                    <Input id="email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)}
                      placeholder="contact@exemple.gn" className="h-11 pl-10" />
                  </div>
                </div>
              </div>
            </section>
            {/* 4. Adresse */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <span className="flex size-7 items-center justify-center rounded-full bg-accent text-accent-foreground text-xs font-bold">4</span>
                <h2 className="text-base md:text-lg font-bold text-slate-900">Adresse de pose</h2>
              </div>
              <div>
                <Label htmlFor="commune" className="text-xs font-semibold uppercase tracking-wider text-slate-600">Commune *</Label>
                <div className="relative mt-1.5">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                  <Input id="commune" value={form.commune} onChange={(e) => set("commune", e.target.value)}
                    placeholder="Ex : Kaloum, Ratoma, Dixinn…" className="h-11 pl-10" />
                </div>
              </div>
              <div className="mt-3">
                <Label htmlFor="adresse" className="text-xs font-semibold uppercase tracking-wider text-slate-600">Adresse détaillée *</Label>
                <Textarea id="adresse" value={form.adresse} onChange={(e) => set("adresse", e.target.value)}
                  placeholder="Quartier, rue, repères…" rows={2} className="mt-1.5 resize-none" />
              </div>
              <div className="mt-3">
                <Label htmlFor="point" className="text-xs font-semibold uppercase tracking-wider text-slate-600">Point d'accès (facultatif)</Label>
                <Input id="point" value={form.point_acces} onChange={(e) => set("point_acces", e.target.value)}
                  placeholder="Ex : Portail vert, sonnette au 1er étage…" className="h-11 mt-1.5" />
              </div>
            </section>
            {/* 5. Paiement */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <span className="flex size-7 items-center justify-center rounded-full bg-accent text-accent-foreground text-xs font-bold">5</span>
                <h2 className="text-base md:text-lg font-bold text-slate-900">Mode de paiement</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {paiementsDispo.map((p) => {
                  const Ic = p.icone;
                  const sel = paiement === p.code;
                  return (
                    <button key={p.code} type="button" onClick={() => setPaiement(p.code)}
                      className={cn(
                        "p-3 rounded-xl border-2 text-left transition-all active:scale-95",
                        sel ? "border-accent bg-accent/5 shadow-sm" : "border-slate-200 hover:border-slate-300"
                      )}>
                      <Ic className={cn("size-5 mb-1.5", sel ? "text-accent" : "text-slate-500")} />
                      <div className={cn("text-xs font-bold leading-tight", sel ? "text-accent" : "text-slate-900")}>{p.label}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">{p.desc}</div>
                    </button>
                  );
                })}
              </div>
              {requiresPro && (
                <label className="flex items-start gap-2 mt-3 cursor-pointer p-3 rounded-lg border border-dashed border-slate-300 hover:bg-slate-50 transition-colors">
                  <input type="checkbox" checked={form.devis_souhaite}
                    onChange={(e) => set("devis_souhaite", e.target.checked)}
                    className="mt-0.5 size-4 rounded border-slate-300 text-accent focus:ring-accent" />
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Je souhaite recevoir un devis officiel</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Bon de commande, facture pro forma, convention</div>
                  </div>
                </label>
              )}
            </section>
            {/* 6. Notes */}
            <section>
              <Label htmlFor="notes" className="text-xs font-semibold uppercase tracking-wider text-slate-600">Instructions particulières (facultatif)</Label>
              <Textarea id="notes" value={form.notes} onChange={(e) => set("notes", e.target.value)}
                placeholder="Horaire de pose souhaité, personne à joindre, urgence…" rows={2} className="mt-1.5 resize-none" />
            </section>
            {/* Submit */}
            <div className="pt-2 border-t border-slate-200">
              <Button onClick={soumettre} disabled={!valide || busy}
                className={cn(
                  "w-full h-14 text-base font-semibold rounded-2xl transition-all",
                  valide && !busy
                    ? "bg-gradient-to-r from-accent to-accent-dark text-accent-foreground shadow-lg shadow-accent/25 hover:shadow-accent/40 active:scale-[0.98]"
                    : "bg-slate-200 text-slate-500 cursor-not-allowed"
                )}>
                <MessageCircle className="size-5 mr-2" />
                {busy ? "Enregistrement…" : isDevis ? "Demander un devis" : "Envoyer ma commande"}
                <ArrowRight className="size-5 ml-1" />
              </Button>
              <p className="text-[11px] text-center text-slate-500 mt-3">
                Aucun paiement en ligne à cette étape. Un agent vous rappelle sous 24 h pour confirmer.
              </p>
            </div>
          </div>
          {/* Récapitulatif */}
          <aside className="lg:col-span-2 space-y-4 lg:sticky lg:top-24 self-start">
            <div className="rounded-3xl bg-white shadow-xl border-2 border-accent/20 overflow-hidden">
              <div className="bg-gradient-to-br from-accent to-accent-dark p-4">
                <div className="flex items-center gap-2 text-white/80 text-[10px] font-bold uppercase tracking-widest">
                  <FileText className="size-3" /> Récapitulatif
                </div>
                <div className="mt-1 text-sm font-bold text-white">{formule.label}</div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl md:text-4xl font-extrabold text-white">
                    {isDevis
                      ? "Sur devis"
                      : new Intl.NumberFormat("fr-FR").format(prixInstallation)}
                  </span>
                  {!isDevis && <span className="text-sm font-medium text-white/85">GNF</span>}
                </div>
                <div className="text-[11px] text-white/75 mt-1">
                  {isDevis
                    ? "Étude personnalisée · Devis sous 48 h"
                    : formule.prix_mensuel
                      ? `à l'installation, puis ${formatGNF(prixMensuel)} par mois`
                      : "Paiement unique · Sans abonnement"}
                </div>
                {requiresPro && nbAdresses > 1 && !isDevis && (
                  <div className="text-[10px] text-white/70 mt-1">
                    {nbAdresses} × {formatGNF(formule.prix)}
                  </div>
                )}
              </div>
              <div className="p-5">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Ce qui est inclus</div>
                <ul className="space-y-2.5">
                  {formule.avantages.map((a, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent/15">
                        <Check className="size-3 text-accent" />
                      </div>
                      <span className="text-xs text-slate-700 leading-relaxed">{a}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="rounded-2xl bg-white border border-slate-200 p-4 space-y-3">
              {[
                { Ic: ShieldCheck, t: "Agents certifiés", d: "Pose garantie et vérifiée", cls: "bg-emerald-100 text-emerald-600" },
                { Ic: Zap,         t: "72 h à Conakry",   d: "Pose sous 3 jours ouvrés",  cls: "bg-orange-100 text-orange-600" },
                { Ic: Truck,       t: "Couverture nationale", d: "Conakry, Kindia, Kankan…", cls: "bg-sky-100 text-sky-600" },
                { Ic: MessageCircle, t: "Support 7j/7",   d: "Français, poular, malinké", cls: "bg-violet-100 text-violet-600" },
              ].map(({ Ic, t, d, cls }, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", cls)}>
                    <Ic className="size-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">{t}</div>
                    <div className="text-[10px] text-slate-500">{d}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-center">
              <Link to="/tarifs" className="text-xs text-slate-500 hover:text-slate-900 underline underline-offset-4">
                Voir toutes les offres →
              </Link>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
