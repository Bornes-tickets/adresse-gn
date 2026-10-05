"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Crosshair,
  Loader2,
  Mail,
  MessageCircle,
  ShieldCheck,
  Smartphone,
  Truck,
  Zap
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase/browser";

import {
  createCheckoutOrder,
  loadPlans,
  loadReference,
} from "../api";
import type {
  CheckoutCreatedOrder,
  CheckoutDraft,
  OtpChannel,
  PublicPlan,
  ReferenceItem,
} from "../types";

type Step =
  | "need"
  | "location"
  | "contact"
  | "offer"
  | "otp"
  | "confirmation";

const STORAGE_KEY = "adresse-gn-next-commander-v1";

const INITIAL_DRAFT: CheckoutDraft = {
  clientType: "particulier",
  placeType: "residential",
  placeName: "",
  lat: null,
  lng: null,
  accuracyM: null,
  regionId: "",
  prefectureId: "",
  communeId: "",
  districtId: "",
  sectorId: "",
  addressLine: "",
  accessPointNote: "",
  fullName: "",
  phone: "",
  email: "",
  planCode: "",
  paymentMethod: "manual",
  raisonSociale: "",
  fonctionContact: "",
  rccm: "",
  nif: "",
  siteWeb: "",
  nbAdresses: 1,
  devisDemande: false,
  instructionsParticulieres: "",
  professionalTier: "pro_plus",
};

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");

  if (digits.length === 12 && digits.startsWith("224")) {
    return `+${digits}`;
  }

  if (digits.length === 9 && digits.startsWith("6")) {
    return `+224${digits}`;
  }

  return null;
}

function planLabel(plan: PublicPlan): string {
  if (plan.code === "residentiel_premium") {
    return "Résidentiel Premium";
  }

  return plan.name?.fr ?? plan.name?.FR ?? plan.name?.en ?? plan.code;
}

function formatGnf(value: number): string {
  return new Intl.NumberFormat("fr-FR").format(Number(value || 0));
}

function planDisplayLabel(
  plan: PublicPlan | null,
  clientType: CheckoutDraft["clientType"],
): string {
  if (!plan) {
    return clientType === "institutionnel"
      ? "Offre institutionnelle"
      : "Formule à choisir";
  }

  if (clientType === "institutionnel" && plan.code === "pro") {
    return "Institutionnel — Sur devis";
  }

  return planLabel(plan);
}

function planRecapFeatures(
  plan: PublicPlan | null,
  clientType: CheckoutDraft["clientType"],
): string[] {
  if (!plan) {
    return clientType === "institutionnel"
      ? [
          "Offre adaptée aux organismes",
          "Référentiel Adresse GN",
          "Localisation et itinéraire",
          "Accompagnement sur devis",
        ]
      : [
          "Numéro Adresse GN V1 après activation",
          "Localisation GPS vérifiée",
          "Lien de partage et itinéraire",
        ];
  }

  if (plan.code === "residentiel_premium") {
    return [
      "Balise renforcée longue durée",
      "Pose prioritaire sous 72 h",
      "Note d’accès détaillée (portail, étage)",
      "Assistance au remplacement 12 mois",
    ];
  }

  const raw = plan.features as unknown;
  const candidates: unknown[] = [];

  if (Array.isArray(raw)) {
    candidates.push(...raw);
  } else if (raw && typeof raw === "object") {
    const record = raw as Record<string, unknown>;

    for (const key of ["fr", "FR", "items", "features", "list"]) {
      const value = record[key];
      if (Array.isArray(value)) {
        candidates.push(...value);
      }
    }

    if (candidates.length === 0) {
      candidates.push(...Object.values(record));
    }
  }

  const extracted = candidates
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);

  if (extracted.length > 0) {
    return extracted;
  }

  if (clientType === "institutionnel") {
    return [
      "Offre institutionnelle sur devis",
      "Organisation adaptée aux organismes",
      "Référentiel Adresse GN",
      "Accompagnement personnalisé",
    ];
  }

  if (plan.code === "numerique") {
    return [
      "Adresse numérique Adresse GN",
      "Numéro Adresse GN V1 après activation",
      "Localisation GPS vérifiée",
      "Lien de partage et itinéraire",
    ];
  }

  if (plan.code === "residentiel_standard") {
    return [
      "Plaque Adresse GN incluse",
      "Installation associée",
      "Localisation GPS vérifiée",
      "Lien de partage et itinéraire",
    ];
  }

  return [
    "Numéro Adresse GN V1 après activation",
    "Localisation GPS vérifiée",
    "Lien de partage et itinéraire",
  ];
}

function planRecapServices(
  plan: PublicPlan | null,
  clientType: CheckoutDraft["clientType"],
) {
  if (clientType === "institutionnel") {
    return [
      {
        icon: "1",
        title: plan?.requires_quote ? "Offre sur devis" : "Offre institutionnelle",
        detail: "Conditions confirmées avant activation",
      },
      {
        icon: "2",
        title: "Traitement suivi",
        detail: "Suivi de la demande institutionnelle",
      },
      {
        icon: "3",
        title: "Référentiel national",
        detail: "Région, préfecture et commune",
      },
      {
        icon: "4",
        title: "Accompagnement personnalisé",
        detail: "Cadrage selon le besoin de l'organisme",
      },
    ];
  }

  if (!plan) {
    return [
      { icon: "1", title: "Demande vérifiée", detail: "Validation avant activation" },
      { icon: "2", title: "Traitement suivi", detail: "Suivi de la demande et de son statut" },
      { icon: "3", title: "Référentiel national", detail: "Région, préfecture et commune" },
      { icon: "4", title: "Support Adresse GN", detail: "Accompagnement selon le besoin" },
    ];
  }

  return [
    {
      icon: "1",
      title: plan.plate_included ? "Plaque incluse" : "Adresse numérique",
      detail: plan.plate_included
        ? "Plaque Adresse GN prévue dans la formule"
        : "Aucune plaque physique incluse",
    },
    {
      icon: "2",
      title: plan.installation_required
        ? "Installation associée"
        : "Activation simplifiée",
      detail: plan.installation_required
        ? "Pose associée à la formule"
        : "Activation sans installation physique obligatoire",
    },
    {
      icon: "3",
      title: "Référentiel Adresse GN",
      detail: "Région, préfecture et commune",
    },
    {
      icon: "4",
      title: "Support Adresse GN",
      detail: "Accompagnement selon la formule choisie",
    },
  ];
}

const SERVICE_CARD_ICONS = [
  ShieldCheck,
  Zap,
  Truck,
  MessageCircle,
] as const;

const SERVICE_CARD_ICON_STYLES = [
  "bg-emerald-100 text-emerald-600",
  "bg-orange-100 text-orange-500",
  "bg-sky-100 text-sky-600",
  "bg-violet-100 text-violet-600",
] as const;

const PROFESSIONAL_TIERS = [
  {
    code: "pro_basic",
    label: "Pro Basic",
    priceGnf: 350000,
    recurringGnf: 0,
    description: "Fiche etablissement pour les commerces",
    note: "Tarif de reference, devis confirme avant activation",
    popular: false,
    recapFeatures: [
      "Fiche etablissement professionnelle",
      "Localisation GPS verifiee",
      "Lien de partage et itineraire",
      "Statistiques essentielles",
    ],
    recapServices: [
      { icon: "1", title: "1 etablissement", detail: "Gestion standard de votre presence Adresse GN" },
      { icon: "2", title: "Activation suivie", detail: "Validation et suivi de votre demande" },
      { icon: "3", title: "Referentiel Adresse GN", detail: "Region, prefecture et commune" },
      { icon: "4", title: "Support standard", detail: "Accompagnement selon le besoin" },
    ],
  },
  {
    code: "pro_plus",
    label: "Pro Plus",
    priceGnf: 600000,
    recurringGnf: 50000,
    description: "Fiche enrichie, equipe et statistiques avancees",
    note: "A l'installation, puis 50 000 GNF / mois",
    popular: true,
    recapFeatures: [
      "Fiche enrichie (photos, description)",
      "Statistiques et suivi d'utilisation",
      "Gestion multi-utilisateurs",
      "Support prioritaire",
    ],
    recapServices: [
      { icon: "1", title: "Fiche enrichie", detail: "Contenu professionnel plus complet" },
      { icon: "2", title: "Statistiques avancees", detail: "Suivi renforce de l'utilisation" },
      { icon: "3", title: "Equipe multi-utilisateurs", detail: "Gestion partagee de la presence" },
      { icon: "4", title: "Support prioritaire", detail: "Accompagnement renforce" },
    ],
  },
  {
    code: "multi_sites",
    label: "Multi-sites",
    priceGnf: null,
    recurringGnf: 0,
    description: "Reseaux de sites, a partir de 5 etablissements",
    note: "Proposition personnalisee selon votre parc de sites",
    popular: false,
    recapFeatures: [
      "Gestion de plusieurs etablissements",
      "Vue consolidee des sites",
      "Organisation multi-utilisateurs",
      "Accompagnement personnalise",
    ],
    recapServices: [
      { icon: "1", title: "Plusieurs etablissements", detail: "Gestion centralisee de votre reseau" },
      { icon: "2", title: "Vue consolidee", detail: "Suivi global des sites rattaches" },
      { icon: "3", title: "Deploiement multi-sites", detail: "Organisation adaptee a votre implantation" },
      { icon: "4", title: "Accompagnement dedie", detail: "Cadrage selon le nombre de sites" },
    ],
  },
] as const;

function clientTypeForPlan(
  planCode: string,
): CheckoutDraft["clientType"] {
  if (planCode === "pro") {
    return "professionnel";
  }

  return "particulier";
}

export default function CommanderPage({
  initialPlanCode = "",
}: {
  initialPlanCode?: string;
}) {
  const initialPlan = [
    "numerique",
    "residentiel_standard",
    "pro",
  ].includes(initialPlanCode)
    ? initialPlanCode
    : "";

  const [step, setStep] = useState<Step>("need");
  const [draft, setDraft] = useState<CheckoutDraft>(() => ({
    ...INITIAL_DRAFT,
    planCode: initialPlan,
    clientType: clientTypeForPlan(initialPlan),
  }));
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [regions, setRegions] = useState<ReferenceItem[]>([]);
  const [prefectures, setPrefectures] = useState<ReferenceItem[]>([]);
  const [communes, setCommunes] = useState<ReferenceItem[]>([]);
  const [districts, setDistricts] = useState<ReferenceItem[]>([]);
  const [sectors, setSectors] = useState<ReferenceItem[]>([]);
  const [otpChannel, setOtpChannel] = useState<OtpChannel>("whatsapp");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<CheckoutCreatedOrder | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(
            raw,
          ) as Partial<CheckoutDraft>;

          setDraft({
            ...INITIAL_DRAFT,
            ...saved,
            paymentMethod: "manual",
            ...(initialPlan
              ? {
                  planCode: initialPlan,
                  clientType: clientTypeForPlan(initialPlan),
                }
              : {}),
          });
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [initialPlan]);

  useEffect(() => {
    if (step !== "confirmation") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    }
  }, [draft, step]);

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      loadPlans(controller.signal),
      loadReference("regions", undefined, controller.signal),
    ])
      .then(([planItems, regionItems]) => {
        setPlans(planItems);
        setRegions(regionItems);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Chargement impossible.",
          );
        }
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!draft.regionId) {
      return;
    }

    const controller = new AbortController();

    loadReference(
      "prefectures",
      { key: "region_id", value: draft.regionId },
      controller.signal,
    )
      .then(setPrefectures)
      .catch(() => {
        if (!controller.signal.aborted) {
          setError("Impossible de charger les pr├®fectures.");
        }
      });

    return () => controller.abort();
  }, [draft.regionId]);

  useEffect(() => {
    if (!draft.prefectureId) {
      return;
    }

    const controller = new AbortController();

    loadReference(
      "communes",
      { key: "prefecture_id", value: draft.prefectureId },
      controller.signal,
    )
      .then(setCommunes)
      .catch(() => {
        if (!controller.signal.aborted) {
          setError("Impossible de charger les communes.");
        }
      });

    return () => controller.abort();
  }, [draft.prefectureId]);

  useEffect(() => {
    if (!draft.communeId) {
      return;
    }

    const controller = new AbortController();

    loadReference(
      "districts",
      { key: "commune_id", value: draft.communeId },
      controller.signal,
    )
      .then(setDistricts)
      .catch(() => {
        if (!controller.signal.aborted) {
          setError("Impossible de charger les quartiers/districts.");
        }
      });

    return () => controller.abort();
  }, [draft.communeId]);

  useEffect(() => {
    if (!draft.districtId) {
      return;
    }

    const controller = new AbortController();

    loadReference(
      "sectors",
      { key: "district_id", value: draft.districtId },
      controller.signal,
    )
      .then(setSectors)
      .catch(() => {
        if (!controller.signal.aborted) {
          setError("Impossible de charger les secteurs.");
        }
      });

    return () => controller.abort();
  }, [draft.districtId]);

  const visiblePlans = useMemo(
    () =>
      plans.filter((plan) => {
        if (!plan.active) return false;
        if (!plan.audience) return true;

        if (draft.clientType === "particulier") {
          return ["individual", "residential"].includes(plan.audience);
        }

        if (draft.clientType === "professionnel") {
          return ["business", "professional", "api"].includes(plan.audience);
        }

        return ["institution", "institutional", "business"].includes(
          plan.audience,
        );
      }),
    [plans, draft.clientType],
  );

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.code === draft.planCode) ?? null,
    [plans, draft.planCode],
  );

  const selectedProfessionalTier = useMemo(
    () =>
      PROFESSIONAL_TIERS.find(
        (tier) => tier.code === draft.professionalTier,
      ) ?? PROFESSIONAL_TIERS[1],
    [draft.professionalTier],
  );

  useEffect(() => {
    if (draft.planCode || visiblePlans.length === 0) {
      return;
    }

    const preferred =
      visiblePlans.find((plan) => plan.popular) ??
      visiblePlans[0];

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft((current) => ({
      ...current,
      planCode: preferred.code,
    }));
  }, [draft.planCode, visiblePlans]);

  function patch(values: Partial<CheckoutDraft>) {
    setDraft((current) => ({ ...current, ...values }));
  }

  function next() {
    setError("");

    if (step === "need") {
      setStep("location");
      return;
    }

    if (step === "location") {
      if (draft.lat === null || draft.lng === null) {
        setError("Confirmez la position GPS du lieu.");
        return;
      }

      if (!draft.communeId) {
        setError("S├®lectionnez la commune.");
        return;
      }

      setStep("contact");
      return;
    }

    if (step === "contact") {
      if (!draft.fullName.trim()) {
        setError("Renseignez le nom et pr├®nom.");
        return;
      }

      if (!normalizePhone(draft.phone)) {
        setError("Renseignez un num├®ro guin├®en valide.");
        return;
      }

      setStep("offer");
      return;
    }

    if (step === "offer") {
      if (!selectedPlan) {
        setError("Choisissez une offre.");
        return;
      }

      setStep("otp");
    }
  }

  function back() {
    setError("");
    if (step === "location") setStep("need");
    if (step === "contact") setStep("location");
    if (step === "offer") setStep("contact");
    if (step === "otp") setStep("offer");
  }

  function continueToOtp() {
    setError("");

    if (!selectedPlan) {
      setError("Choisissez une formule.");
      return;
    }

    if (
      draft.clientType !== "particulier" &&
      !draft.raisonSociale.trim()
    ) {
      setError("Renseignez la raison sociale.");
      return;
    }

    if (!draft.fullName.trim()) {
      setError("Renseignez le nom du contact.");
      return;
    }

    if (!normalizePhone(draft.phone)) {
      setError("Renseignez un numéro guinéen valide.");
      return;
    }

    if (draft.lat === null || draft.lng === null) {
      setError("Confirmez la position GPS du lieu.");
      return;
    }

    if (!draft.communeId) {
      setError("Sélectionnez la commune.");
      return;
    }

    setOtpSent(false);
    setOtpCode("");
    setStep("otp");
  }

  function locate() {
    if (!navigator.geolocation) {
      setError("La g├®olocalisation n'est pas disponible.");
      return;
    }

    setGeoLoading(true);
    setError("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        patch({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracyM: position.coords.accuracy,
        });
        setGeoLoading(false);
      },
      () => {
        setGeoLoading(false);
        setError("Impossible de r├®cup├®rer la position.");
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
      },
    );
  }

  async function sendOtp() {
    const phone = normalizePhone(draft.phone);
    const email = draft.email.trim().toLowerCase();

    if (otpChannel === "email") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setError("Ajoutez une adresse e-mail valide.");
        return;
      }
    } else if (!phone) {
      setError("Num├®ro de t├®l├®phone invalide.");
      return;
    }

    setLoading(true);
    setError("");

    const result =
      otpChannel === "email"
        ? await supabase.auth.signInWithOtp({
            email,
            options: {
              shouldCreateUser: true,
              data: {
                full_name: draft.fullName.trim(),
                adresse_gn_contact_phone: phone,
                adresse_gn_verification_channel: "email",
              },
            },
          })
        : await supabase.auth.signInWithOtp({
            phone: phone!,
            options: {
              channel: otpChannel,
              shouldCreateUser: true,
              data: {
                full_name: draft.fullName.trim(),
                adresse_gn_contact_phone: phone,
                adresse_gn_verification_channel: otpChannel,
              },
            },
          });

    setLoading(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setOtpSent(true);
  }

  async function verifyAndSubmit(event: FormEvent) {
    event.preventDefault();

    if (otpCode.trim().length < 6) {
      setError("Saisissez le code re├ºu.");
      return;
    }

    const phone = normalizePhone(draft.phone);
    const email = draft.email.trim().toLowerCase();

    setLoading(true);
    setError("");

    const verify =
      otpChannel === "email"
        ? await supabase.auth.verifyOtp({
            email,
            token: otpCode.trim(),
            type: "email",
          })
        : await supabase.auth.verifyOtp({
            phone: phone!,
            token: otpCode.trim(),
            type: "sms",
          });

    if (verify.error) {
      setLoading(false);
      setError(verify.error.message);
      return;
    }

    const metadata = await supabase.auth.updateUser({
      data: {
        adresse_gn_verification_channel: otpChannel,
        adresse_gn_contact_phone: phone,
      },
    });

    if (metadata.error) {
      setLoading(false);
      setError("Le profil n'a pas pu ├¬tre finalis├®.");
      return;
    }

    if (!selectedPlan) {
      setLoading(false);
      setError("L'offre n'est plus disponible.");
      return;
    }

    try {
      const order = await createCheckoutOrder(
        draft,
        selectedPlan.requires_quote,
      );

      setCreated(order);
      setStep("confirmation");
      localStorage.removeItem(STORAGE_KEY);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "La commande n'a pas pu ├¬tre cr├®├®e.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f6f8]">
      <section className="bg-[linear-gradient(115deg,#496795_0%,#5a76a0_58%,#478b9f_100%)] pb-16 pt-5 text-white sm:pb-[74px]">
        <div className="mx-auto max-w-[930px] px-4 text-center sm:px-5">
          <h1 className="text-[25px] font-black leading-none tracking-tight sm:text-[28px]">
            Créer mon Adresse GN
          </h1>
          <p className="mx-auto mt-2 max-w-[500px] text-[9px] leading-4 text-white/90">
            Choisissez votre profil et votre formule, puis complétez votre demande.
          </p>
        </div>
      </section>

      <section className="-mt-9 pb-16">
        <div className="mx-auto grid max-w-[930px] gap-4 px-4 sm:px-5 lg:grid-cols-[minmax(0,600px)_286px] lg:items-start">
          <Card className="rounded-[18px] border border-slate-200 bg-white shadow-lg">
            <CardContent className="p-4 sm:p-[18px]">
              {error && (
                <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
                  {error}
                </div>
              )}

              {step === "confirmation" && created ? (
                <div className="space-y-5">
                  <div className="rounded-2xl border border-teal-100 bg-teal-50 p-5">
                    <span className="mb-3 flex size-10 items-center justify-center rounded-full bg-teal-600 text-white">
                      <Check className="size-5" />
                    </span>
                    <h2 className="text-lg font-extrabold text-slate-950">
                      Votre demande est enregistrée
                    </h2>
                    <p className="mt-2 text-sm text-slate-600">
                      Référence : <strong>{created.order_ref}</strong>
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {selectedPlan?.requires_quote !== true && (
                      <Button asChild>
                        <Link href={`/commande/${created.order_ref}/paiement`}>
                          Régler ma commande
                        </Link>
                      </Button>
                    )}
                    <Button asChild variant="outline">
                      <Link href={`/suivi/${created.guest_token}`}>
                        Suivre ma demande
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : step === "otp" ? (
                <form className="space-y-5" onSubmit={verifyAndSubmit}>
                  <SectionHeading number="6" title="Vérification" />

                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      ["whatsapp", "WhatsApp"],
                      ["email", "E-mail"],
                      ["sms", "SMS"],
                    ].map(([value, label]) => (
                      <button
                        type="button"
                        key={value}
                        onClick={() => {
                          setOtpChannel(value as OtpChannel);
                          setOtpSent(false);
                          setOtpCode("");
                        }}
                        className={`rounded-xl border p-3 text-center text-xs font-bold ${
                          otpChannel === value
                            ? "border-teal-500 bg-teal-50 text-teal-800"
                            : "border-slate-200 bg-white text-slate-700"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={sendOtp}
                    disabled={loading}
                  >
                    Recevoir le code
                  </Button>

                  {otpSent && (
                    <Field label="Code reçu">
                      <Input
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        value={otpCode}
                        onChange={(event) =>
                          setOtpCode(
                            event.target.value.replace(/\D/g, "").slice(0, 6),
                          )
                        }
                        placeholder="000000"
                      />
                    </Field>
                  )}

                  <Button
                    type="submit"
                    disabled={loading || !otpSent}
                    className="w-full bg-teal-600 hover:bg-teal-700"
                  >
                    {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
                    Vérifier et envoyer ma commande
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => {
                      setError("");
                      setOtpSent(false);
                      setOtpCode("");
                      setStep("need");
                    }}
                  >
                    <ArrowLeft className="mr-2 size-4" />
                    Modifier ma commande
                  </Button>
                </form>
              ) : (
                <div className="space-y-5">
                  <section>
                    <SectionHeading number="1" title="Vous êtes..." />
                    <div className="grid gap-2.5 sm:grid-cols-3">
                      {[
                        ["particulier", "Particulier", "Domicile, logement"],
                        ["professionnel", "Professionnel", "Commerce, entreprise"],
                        ["institutionnel", "Institutionnel", "Administration, ONG, école"],
                      ].map(([value, label, detail]) => (
                        <button
                          type="button"
                          key={value}
                          onClick={() =>
                            patch({
                              clientType: value as CheckoutDraft["clientType"],
                              planCode: "",
                            })
                          }
                          className={`rounded-xl border px-3 py-3 text-left transition ${
                            draft.clientType === value
                              ? "border-teal-500 bg-teal-50 ring-1 ring-teal-500/20"
                              : "border-slate-200 bg-white hover:border-slate-300"
                          }`}
                        >
                          <span className="block text-[11px] font-extrabold text-slate-950">
                            {label}
                          </span>
                          <span className="mt-1 block text-[9px] text-slate-500">
                            {detail}
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>

                  <section>
                    <SectionHeading number="2" title="Votre formule" />
                    {draft.clientType === "professionnel" ? (
                      <div className="space-y-2">
                        {PROFESSIONAL_TIERS.map((tier) => {
                          const selected =
                            draft.professionalTier === tier.code;

                          return (
                            <button
                              type="button"
                              key={tier.code}
                              onClick={() =>
                                patch({
                                  professionalTier: tier.code,
                                })
                              }
                              className={`flex w-full items-center justify-between gap-4 rounded-[10px] border px-3 py-2.5 text-left transition ${
                                selected
                                  ? "border-teal-500 bg-teal-50/70 ring-1 ring-teal-500/20"
                                  : "border-slate-200 bg-white hover:border-slate-300"
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-[10px] font-extrabold text-slate-950">
                                    {tier.label}
                                  </span>
                                  {tier.popular && (
                                    <span className="rounded-full bg-teal-600 px-2 py-0.5 text-[6px] font-extrabold uppercase tracking-[0.08em] text-white">
                                      Plus populaire
                                    </span>
                                  )}
                                </div>
                                <p className="mt-0.5 text-[8px] leading-3.5 text-slate-500">
                                  {tier.description}
                                </p>
                              </div>

                              <div className="shrink-0 text-right">
                                <strong className="block text-[10px] text-slate-950">
                                  {tier.priceGnf === null
                                    ? "Sur devis"
                                    : `${formatGnf(tier.priceGnf)} GNF`}
                                </strong>
                                <span className="mt-0.5 block max-w-[165px] text-[6.5px] leading-3 text-slate-400">
                                  {tier.note}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {visiblePlans.map((plan) => (
                          <button
                            type="button"
                            key={plan.id}
                            onClick={() => patch({ planCode: plan.code })}
                            className={`flex w-full items-center justify-between gap-4 rounded-[10px] border px-3 py-2.5 text-left transition ${
                              draft.planCode === plan.code
                                ? "border-teal-500 bg-teal-50/70 ring-1 ring-teal-500/20"
                                : "border-slate-200 bg-white hover:border-slate-300"
                            }`}
                          >
                            <span className="text-[10px] font-extrabold text-slate-950">
                              {plan.code === "numerique"
                                  ? "Numérique seule"
                                  : plan.code === "residentiel_standard"
                                    ? "Résidentiel Standard"
                                    : planLabel(plan)}
                            </span>
                            <strong className="shrink-0 text-[10px] text-slate-950">
                              {plan.requires_quote
                                ? "Sur devis"
                                : `${formatGnf(plan.price_gnf)} GNF`}
                            </strong>
                          </button>
                        ))}
                      </div>
                    )}

                    {draft.clientType === "particulier" &&
                      !visiblePlans.some(
                        (plan) => plan.code === "residentiel_premium",
                      ) && (
                        <button
                          type="button"
                          disabled
                          aria-disabled="true"
                          title="Cette formule est affichée à titre tarifaire. Son plan de commande backend n'est pas encore activé."
                          className="flex w-full cursor-not-allowed items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left opacity-90"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[11px] font-extrabold text-slate-950">
                                Résidentiel Premium
                              </span>
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[7px] font-extrabold uppercase text-slate-500">
                                Bientôt disponible
                              </span>
                            </div>
                            <p className="mt-1 text-[9px] text-slate-500">
                              Balise renforcée + point d&apos;accès détaillé
                            </p>
                          </div>
                          <strong className="shrink-0 text-right text-[11px] text-slate-950">
                            300 000 GNF
                          </strong>
                        </button>
                      )}

                    {draft.clientType !== "particulier" && (
                      <div className="mt-3 w-[112px]">
                        <Field label="Nombre d'établissements">
                          <Input
                            type="number"
                            min={1}
                            max={1000}
                            value={String(draft.nbAdresses)}
                            onChange={(event) =>
                              patch({
                                nbAdresses: Math.max(
                                  1,
                                  Number.parseInt(event.target.value || "1", 10),
                                ),
                              })
                            }
                            className="h-8 text-xs"
                          />
                        </Field>
                      </div>
                    )}
                  </section>

                  <section>
                    <SectionHeading number="3" title="Vos coordonnées" />
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                      {draft.clientType !== "particulier" && (
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="sm:col-span-2">
                            <Field label="Raison sociale *">
                              <Input
                                value={draft.raisonSociale}
                                onChange={(event) =>
                                  patch({ raisonSociale: event.target.value })
                                }
                                placeholder="Ex : Ma Société SARL"
                              />
                            </Field>
                          </div>

                          <Field label="Fonction du contact">
                            <Input
                              value={draft.fonctionContact}
                              onChange={(event) =>
                                patch({ fonctionContact: event.target.value })
                              }
                              placeholder="Ex : Directeur"
                            />
                          </Field>

                          <Field label="RCCM">
                            <Input
                              value={draft.rccm}
                              onChange={(event) =>
                                patch({ rccm: event.target.value })
                              }
                              placeholder="Ex : GN.CKY.2024.B.1234"
                            />
                          </Field>

                          <Field label="NIF (identifiant fiscal)">
                            <Input
                              value={draft.nif}
                              onChange={(event) =>
                                patch({ nif: event.target.value })
                              }
                              placeholder="Numéro d'identification fiscale"
                            />
                          </Field>

                          <Field label="Site web">
                            <Input
                              value={draft.siteWeb}
                              onChange={(event) =>
                                patch({ siteWeb: event.target.value })
                              }
                              placeholder="https://..."
                            />
                          </Field>
                        </div>
                      )}

                      <div
                        className={`grid gap-4 sm:grid-cols-2 ${
                          draft.clientType !== "particulier" ? "mt-4" : ""
                        }`}
                      >
                        <div className="sm:col-span-2">
                          <Field label="Nom du contact *">
                            <Input
                              value={draft.fullName}
                              onChange={(event) =>
                                patch({ fullName: event.target.value })
                              }
                              placeholder="Ex : Aminata Diallo"
                            />
                          </Field>
                        </div>

                        <Field label="Téléphone / WhatsApp *">
                          <Input
                            value={draft.phone}
                            onChange={(event) =>
                              patch({ phone: event.target.value })
                            }
                            placeholder="+224 6XX XX XX XX"
                          />
                        </Field>

                        <Field label="E-mail">
                          <Input
                            type="email"
                            value={draft.email}
                            onChange={(event) =>
                              patch({ email: event.target.value })
                            }
                            placeholder="contact@exemple.gn"
                          />
                        </Field>
                      </div>
                    </div>
                  </section>

                  <section>
                    <SectionHeading number="4" title="Adresse de pose" />

                    <div className="grid gap-4 sm:grid-cols-2">
                      <ReferenceSelect
                        label="Région"
                        value={draft.regionId}
                        items={regions}
                        onChange={(regionId) => {
                          setPrefectures([]);
                          setCommunes([]);
                          setDistricts([]);
                          setSectors([]);
                          patch({
                            regionId,
                            prefectureId: "",
                            communeId: "",
                            districtId: "",
                            sectorId: "",
                          });
                        }}
                      />

                      <ReferenceSelect
                        label="Préfecture"
                        value={draft.prefectureId}
                        items={prefectures}
                        disabled={!draft.regionId}
                        onChange={(prefectureId) => {
                          setCommunes([]);
                          setDistricts([]);
                          setSectors([]);
                          patch({
                            prefectureId,
                            communeId: "",
                            districtId: "",
                            sectorId: "",
                          });
                        }}
                      />

                      <ReferenceSelect
                        label="Commune *"
                        value={draft.communeId}
                        items={communes}
                        disabled={!draft.prefectureId}
                        onChange={(communeId) => {
                          setDistricts([]);
                          setSectors([]);
                          patch({
                            communeId,
                            districtId: "",
                            sectorId: "",
                          });
                        }}
                      />

                      <ReferenceSelect
                        label="Quartier / district"
                        value={draft.districtId}
                        items={districts}
                        disabled={!draft.communeId}
                        onChange={(districtId) => {
                          setSectors([]);
                          patch({ districtId, sectorId: "" });
                        }}
                      />

                      <ReferenceSelect
                        label="Secteur"
                        value={draft.sectorId}
                        items={sectors}
                        disabled={!draft.districtId}
                        onChange={(sectorId) =>
                          patch({ sectorId })
                        }
                      />

                      <Field label="Adresse détaillée">
                        <Input
                          value={draft.addressLine}
                          onChange={(event) =>
                            patch({ addressLine: event.target.value })
                          }
                          placeholder="Quartier, rue, repères..."
                        />
                      </Field>
                    </div>

                    <div className="mt-4">
                      <Field label="Point d'accès (facultatif)">
                        <Input
                          value={draft.accessPointNote}
                          onChange={(event) =>
                            patch({ accessPointNote: event.target.value })
                          }
                          placeholder="Ex : portail vert, sonnette au 1er étage..."
                        />
                      </Field>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={locate}
                        disabled={geoLoading}
                        className="border-teal-200 text-teal-700"
                      >
                        {geoLoading ? (
                          <Loader2 className="mr-2 size-4 animate-spin" />
                        ) : (
                          <Crosshair className="mr-2 size-4" />
                        )}
                        Confirmer ma position GPS
                      </Button>

                      {draft.lat !== null && draft.lng !== null && (
                        <span className="text-[10px] font-semibold text-teal-700">
                          Position confirmée
                          {draft.accuracyM !== null
                            ? ` · précision ${Math.round(draft.accuracyM)} m`
                            : ""}
                        </span>
                      )}
                    </div>
                  </section>

                  <section>
                    <SectionHeading number="5" title="Mode de paiement" />

                    <div className="grid gap-2.5 sm:grid-cols-3">
                      {[
                        ["Orange Money", "Bientôt disponible", false],
                        ["MTN Mobile Money", "Bientôt disponible", false],
                        ["Carte bancaire", "Bientôt disponible", false],
                        ["PayPal", "Non activé", false],
                        ["Espèces à la livraison", "Selon disponibilité", false],
                        ["Virement bancaire", "Disponible", true],
                      ].map(([label, detail, active]) =>
                        active ? (
                          <button
                            type="button"
                            key={String(label)}
                            onClick={() => patch({ paymentMethod: "manual" })}
                            className="rounded-xl border border-teal-500 bg-teal-50 px-3 py-3 text-left ring-1 ring-teal-500/10"
                          >
                            <span className="block text-[10px] font-extrabold text-slate-950">
                              {label}
                            </span>
                            <span className="mt-1 block text-[8px] text-teal-700">
                              {detail}
                            </span>
                          </button>
                        ) : (
                          <div
                            key={String(label)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-3 opacity-65"
                          >
                            <span className="block text-[10px] font-extrabold text-slate-700">
                              {label}
                            </span>
                            <span className="mt-1 block text-[8px] text-slate-500">
                              {detail}
                            </span>
                          </div>
                        ),
                      )}
                    </div>

                    {draft.clientType !== "particulier" && (
                      <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-3">
                        <input
                          type="checkbox"
                          checked={draft.devisDemande}
                          onChange={(event) =>
                            patch({ devisDemande: event.target.checked })
                          }
                          className="mt-0.5 size-4 rounded border-slate-300 accent-teal-600"
                        />
                        <span>
                          <span className="block text-[10px] font-extrabold text-slate-800">
                            Je souhaite recevoir un devis officiel
                          </span>
                          <span className="mt-0.5 block text-[8px] text-slate-500">
                            Bon de commande, facture pro forma ou convention selon le dossier.
                          </span>
                        </span>
                      </label>
                    )}

                    <div className="mt-4">
                      <Field label="Instructions particulières (facultatif)">
                        <textarea
                          className="min-h-20 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10"
                          value={draft.instructionsParticulieres}
                          onChange={(event) =>
                            patch({
                              instructionsParticulieres: event.target.value,
                            })
                          }
                          placeholder="Horaire de pose souhaité, personne à joindre, urgence..."
                        />
                      </Field>
                    </div>
                  </section>

                  <Button
                    type="button"
                    onClick={continueToOtp}
                    className="w-full bg-teal-600 py-5 text-sm font-extrabold hover:bg-teal-700"
                  >
                    Envoyer ma commande
                    <ArrowRight className="ml-2 size-4" />
                  </Button>

                  <p className="text-center text-[9px] text-slate-400">
                    Aucun paiement n&apos;est débité à cette étape.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <aside className="space-y-3 lg:sticky lg:top-20">
            <div className="overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-lg">
              <div className="bg-teal-600 px-4 py-3.5 text-white">
                <p className="text-[8px] font-extrabold uppercase tracking-[0.12em] text-white/80">
                  Récapitulatif
                </p>
                <p className="mt-2 text-xs font-extrabold">
                  {draft.clientType === "professionnel"
                    ? selectedProfessionalTier.label
                    : planDisplayLabel(selectedPlan, draft.clientType)}
                </p>
                <div className="mt-1 flex items-end gap-1">
                  <strong className="text-[28px] leading-none">
                    {draft.clientType === "professionnel"
                      ? selectedProfessionalTier.priceGnf === null
                        ? "Sur devis"
                        : formatGnf(selectedProfessionalTier.priceGnf)
                      : selectedPlan
                        ? selectedPlan.requires_quote
                          ? "Sur devis"
                          : formatGnf(selectedPlan.price_gnf)
                        : "—"}
                  </strong>
                  {(
                    draft.clientType === "professionnel"
                      ? selectedProfessionalTier.priceGnf !== null
                      : selectedPlan && !selectedPlan.requires_quote
                  ) && (
                    <span className="pb-0.5 text-[8px] font-bold">GNF</span>
                  )}
                </div>
                {draft.clientType === "professionnel" ? (
                  <p className="mt-1 text-[7px] leading-3 text-white/80">
                    {selectedProfessionalTier.note}
                  </p>
                ) : (
                  selectedPlan &&
                  !selectedPlan.requires_quote && (
                    <p className="mt-1 text-[7px] text-white/80">
                      {Number(selectedPlan.recurring_price_gnf || 0) > 0
                        ? `Puis ${formatGnf(selectedPlan.recurring_price_gnf)} GNF / ${selectedPlan.billing_period}`
                        : "Paiement unique"}
                    </p>
                  )
                )}
              </div>

              <div className="p-5">
                <p className="text-[8px] font-extrabold uppercase tracking-[0.12em] text-slate-400">
                  Ce qui est inclus
                </p>

                <div className="mt-3 space-y-2 text-[8.5px] text-slate-600">
                  {(draft.clientType === "professionnel"
                    ? selectedProfessionalTier.recapFeatures
                    : planRecapFeatures(selectedPlan, draft.clientType)
                  ).map((item) => (
                    <div key={item} className="flex gap-2">
                      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-600">
                        <Check className="size-2.5" />
                      </span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-[18px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="space-y-2.5 text-[8px]">
                {(draft.clientType === "professionnel"
                  ? selectedProfessionalTier.recapServices
                  : planRecapServices(selectedPlan, draft.clientType)
                ).map(({ title, detail }, index) => {
                  const ServiceIcon =
                    SERVICE_CARD_ICONS[index % SERVICE_CARD_ICONS.length];
                  const iconStyle =
                    SERVICE_CARD_ICON_STYLES[
                      index % SERVICE_CARD_ICON_STYLES.length
                    ];

                  return (
                    <div key={title} className="flex items-start gap-2.5">
                      <span
                        className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${iconStyle}`}
                      >
                        <ServiceIcon className="size-3.5" />
                      </span>
                      <div>
                        <strong className="text-[8.5px] text-slate-900">
                          {title}
                        </strong>
                        <p className="mt-0.5 leading-3 text-slate-500">
                          {detail}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <Link
              href="/tarifs"
              className="block text-center text-[9px] font-semibold text-slate-500 hover:text-teal-700"
            >
              Voir toutes les offres
            </Link>
          </aside>
        </div>
      </section>
    </main>
  );
}
function SectionHeading({
  number,
  title,
}: {
  number: string;
  title: string;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="flex size-6 items-center justify-center rounded-full bg-teal-600 text-[11px] font-extrabold text-white">
        {number}
      </span>
      <h2 className="text-[13px] font-extrabold text-slate-950">
        {title}
      </h2>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ReferenceSelect({
  label,
  value,
  items,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  items: ReferenceItem[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <Field label={label}>
      <select
        className="h-10 w-full rounded-md border bg-background px-3 text-sm disabled:opacity-50"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      >
        <option value="">Sélectionner</option>
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
    </Field>
  );
}
