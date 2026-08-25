/**
 * src/routes/suivi.$token.tsx
 * Page publique de suivi d'une commande — accessible sans compte.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  Check, Clock, MapPin, Package, Truck, Phone, MessageCircle, AlertCircle,
  Copy, Bookmark, BookmarkCheck,
} from "lucide-react";
import { toast } from "sonner";
import { getOrderByToken } from "@/lib/orders.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/suivi/$token")({
  head: () => ({
    meta: [
      { title: "Suivi de votre commande — ADRESSE GN" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SuiviPage,
});

const STATUS_ORDER = ["pending", "confirmed", "in_progress", "installed", "active"] as const;
const STATUS_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  pending: { label: "En attente de validation", icon: Clock, color: "text-amber-600 bg-amber-50" },
  confirmed: { label: "Confirmée · agent assigné", icon: Check, color: "text-sky-600 bg-sky-50" },
  in_progress: { label: "Agent en route", icon: Truck, color: "text-violet-600 bg-violet-50" },
  installed: { label: "Plaque posée", icon: Package, color: "text-emerald-600 bg-emerald-50" },
  active: { label: "Adresse active ✓", icon: MapPin, color: "text-emerald-700 bg-emerald-100" },
  cancelled: { label: "Annulée", icon: AlertCircle, color: "text-rose-600 bg-rose-50" },
};

// Labels lisibles pour les modes de paiement
const PAYMENT_LABELS: Record<string, string> = {
  orange_money: "Orange Money",
  mtn_money: "MTN Mobile Money",
  carte_bancaire: "Carte bancaire",
  paypal: "PayPal",
  cash: "Espèces à la livraison",
  virement: "Virement bancaire",
};

// Labels lisibles pour les formules (fallback = formule_label déjà stocké en DB)
const FORMULE_LABELS: Record<string, string> = {
  numerique: "Numérique seule",
  residentiel_standard: "Résidentiel Standard",
  residentiel_premium: "Résidentiel Premium",
  pro_basic: "Pro Basic",
  pro_plus: "Pro Plus",
  pro_multisites: "Multi-sites",
  inst_pack: "Pack Institutionnel",
};

const CLIENT_TYPE_LABELS: Record<string, string> = {
  particulier: "Particulier",
  professionnel: "Professionnel",
  institutionnel: "Institutionnel",
};

function formatGNF(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n) + " GNF";
}

function SuiviPage() {
  const { token } = Route.useParams();
  const fetchOrder = useServerFn(getOrderByToken);

  const { data: order, isPending, isError } = useQuery({
    queryKey: ["order-suivi", token],
    queryFn: () => fetchOrder({ data: { token } }),
    refetchInterval: 30_000,
  });

  // État : token déjà présent dans localStorage ?
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    try {
      const existing = JSON.parse(localStorage.getItem("agn.guest_orders") || "[]") as Array<{ token: string }>;
      setSaved(existing.some((e) => e.token === token));
    } catch { setSaved(false); }
  }, [token]);

  const copierLien = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Lien copié dans le presse-papier");
    } catch {
      toast.error("Impossible de copier le lien");
    }
  };

  const enregistrerDansMesCommandes = () => {
    if (!order) return;
    try {
      const existing = JSON.parse(localStorage.getItem("agn.guest_orders") || "[]") as Array<any>;
      if (existing.some((e) => e.token === token)) {
        toast.info("Cette commande est déjà enregistrée");
        setSaved(true);
        return;
      }
      const next = [
        ...existing,
        {
          token,
          formule: order.formule_label ?? FORMULE_LABELS[order.formule_code] ?? "Commande",
          at: Date.now(),
        },
      ];
      localStorage.setItem("agn.guest_orders", JSON.stringify(next));
      setSaved(true);
      toast.success("Commande enregistrée sur cet appareil");
    } catch {
      toast.error("Enregistrement impossible");
    }
  };

  if (isPending) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-slate-500">Chargement de votre commande…</p>
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <AlertCircle className="mx-auto size-12 text-rose-500" />
        <h1 className="mt-4 text-2xl font-bold text-slate-900">Commande introuvable</h1>
        <p className="mt-2 text-slate-500">
          Le lien est peut-être expiré ou incorrect. Contactez-nous sur WhatsApp.
        </p>
        <Link
          to="/"
          className="mt-6 inline-block rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white"
        >
          Retour à l'accueil
        </Link>
      </div>
    );
  }

  const currentStatus = STATUS_LABELS[order.status] ?? STATUS_LABELS.pending;
  const CurrentIcon = currentStatus.icon;
  const currentIndex = STATUS_ORDER.indexOf(order.status as any);

  // Affichages lisibles
  const formuleAffichee =
    order.formule_label || FORMULE_LABELS[order.formule_code] || order.formule_code;
  const paiementAffiche =
    PAYMENT_LABELS[order.payment_method] || order.payment_method;
  const typeAffiche =
    CLIENT_TYPE_LABELS[order.client_type] || order.client_type;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* En-tête */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className={cn("flex size-12 items-center justify-center rounded-xl", currentStatus.color)}>
              <CurrentIcon className="size-6" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                Commande #{order.id.slice(0, 8).toUpperCase()}
              </p>
              <h1 className="text-lg font-bold text-slate-950">{currentStatus.label}</h1>
            </div>
          </div>

          {/* Progression */}
          {order.status !== "cancelled" && (
            <div className="mt-6">
              <div className="relative flex items-center justify-between">
                <div aria-hidden className="absolute left-4 right-4 top-3 h-0.5 bg-slate-200" />
                <div
                  aria-hidden
                  className="absolute left-4 top-3 h-0.5 bg-accent transition-all"
                  style={{ width: `calc(${(currentIndex / (STATUS_ORDER.length - 1)) * 100}% - 32px)` }}
                />
                {STATUS_ORDER.map((s, i) => {
                  const done = i <= currentIndex;
                  return (
                    <div key={s} className="relative z-10 flex flex-col items-center gap-1.5">
                      <span
                        className={cn(
                          "flex size-6 items-center justify-center rounded-full text-[10px] font-bold ring-2 ring-white",
                          done ? "bg-accent text-white" : "bg-slate-200 text-slate-500",
                        )}
                      >
                        {done ? <Check className="size-3" /> : i + 1}
                      </span>
                      <span className="text-center text-[9px] font-medium text-slate-600">
                        {STATUS_LABELS[s].label.split(" ")[0]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Détails commande */}
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Détails</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Client</dt>
              <dd className="text-right font-medium text-slate-900">
                {order.full_name} <span className="text-xs text-slate-400">({typeAffiche})</span>
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Téléphone</dt>
              <dd className="text-right font-medium text-slate-900">{order.phone}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Adresse</dt>
              <dd className="text-right font-medium text-slate-900">{order.address_line}</dd>
            </div>
            {order.quartier && (
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Quartier</dt>
                <dd className="text-right font-medium text-slate-900">{order.quartier}</dd>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Formule</dt>
              <dd className="text-right font-medium text-slate-900">{formuleAffichee}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Paiement</dt>
              <dd className="text-right font-medium text-slate-900">{paiementAffiche}</dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-slate-100 pt-2">
              <dt className="text-slate-500">Montant</dt>
              <dd className="text-right font-bold text-slate-950">
                {order.prix_ttc > 0 ? formatGNF(order.prix_ttc) : "Sur devis"}
              </dd>
            </div>
          </dl>
        </div>

        {/* Actions — partage / sauvegarde */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={copierLien}
            className="flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 transition active:scale-[0.98] active:bg-slate-50"
          >
            <Copy className="size-4" />
            Copier le lien
          </button>
          <button
            type="button"
            onClick={enregistrerDansMesCommandes}
            disabled={saved}
            className={cn(
              "flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition active:scale-[0.98]",
              saved
                ? "border border-emerald-200 bg-emerald-50 text-emerald-700 cursor-default"
                : "border border-slate-300 bg-white text-slate-700 active:bg-slate-50",
            )}
          >
            {saved ? (
              <>
                <BookmarkCheck className="size-4" />
                Enregistrée
              </>
            ) : (
              <>
                <Bookmark className="size-4" />
                Enregistrer
              </>
            )}
          </button>
        </div>

        {/* Contact équipe */}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <a
            href="https://wa.me/224620000000"
            target="_blank"
            rel="noreferrer"
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-500 text-sm font-semibold text-white transition active:scale-[0.98]"
          >
            <MessageCircle className="size-4" />
            WhatsApp
          </a>
          <a
            href="tel:+224620000000"
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-slate-950 text-sm font-semibold text-white transition active:scale-[0.98]"
          >
            <Phone className="size-4" />
            Appeler
          </a>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Enregistrez ce lien ou cliquez sur « Enregistrer » pour le retrouver depuis cet appareil.
        </p>
      </div>
    </div>
  );
}

