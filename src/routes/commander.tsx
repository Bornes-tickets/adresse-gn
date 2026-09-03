import { FormEvent, useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Crosshair,
  Home,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  QrCode,
  Smartphone,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/commander")({
  component: CommanderPage,
});

type Step = "need" | "location" | "contact" | "offer" | "otp" | "confirmation";
type OtpChannel = "whatsapp" | "email" | "sms";

type Plan = {
  id: string;
  code: string;
  name: Record<string, string> | null;
  description: Record<string, string> | null;
  features: Record<string, unknown> | null;
  price_gnf: number;
  price_from_gnf: number | null;
  price_to_gnf: number | null;
  recurring_price_gnf: number;
  billing_period: string;
  audience: string | null;
  requires_quote: boolean;
  plate_available: boolean;
  plate_included: boolean;
  installation_required: boolean;
  popular: boolean;
  active: boolean;
  position: number;
};

type Draft = {
  clientType: "particulier" | "professionnel" | "institution";
  placeType: "residential" | "business" | "company" | "other";
  placeName: string;

  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  addressLine: string;
  accessPointNote: string;

  communeId: string | null;
  districtId: string | null;
  sectorId: string | null;

  fullName: string;
  phone: string;
  email: string;

  planCode: string;
  paymentMethod: string;
};

type CreatedOrder = {
  order_id: string;
  order_ref: string;
};

const STORAGE_KEY = "adresse-gn-commander-v1";

const STEPS: Step[] = ["need", "location", "contact", "offer", "otp", "confirmation"];

const INITIAL_DRAFT: Draft = {
  clientType: "particulier",
  placeType: "residential",
  placeName: "",

  lat: null,
  lng: null,
  accuracy: null,
  addressLine: "",
  accessPointNote: "",

  communeId: null,
  districtId: null,
  sectorId: null,

  fullName: "",
  phone: "",
  email: "",

  planCode: "",
  paymentMethod: "orange_money",
};

function CommanderPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("need");
  const [draft, setDraft] = useState<Draft>(INITIAL_DRAFT);

  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);

  const [otpChannel, setOtpChannel] = useState<OtpChannel>("whatsapp");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  const [loading, setLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [error, setError] = useState("");

  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null);

  const stepIndex = STEPS.indexOf(step);
  const progress = step === "confirmation" ? 100 : ((stepIndex + 1) / 5) * 100;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const saved = JSON.parse(raw) as Partial<Draft>;
      setDraft((current) => ({ ...current, ...saved }));
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (step === "confirmation") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [draft, step]);

  useEffect(() => {
    void loadPlans();
  }, []);

  async function loadPlans() {
    setPlansLoading(true);

    const { data, error: plansError } = await supabase
      .from("cms_plans")
      .select(
        [
          "id",
          "code",
          "name",
          "description",
          "features",
          "price_gnf",
          "price_from_gnf",
          "price_to_gnf",
          "recurring_price_gnf",
          "billing_period",
          "audience",
          "requires_quote",
          "plate_available",
          "plate_included",
          "installation_required",
          "popular",
          "active",
          "position",
        ].join(",")
      )
      .eq("active", true)
      .order("position", { ascending: true });

    setPlansLoading(false);

    if (plansError) {
      setError("Impossible de charger les offres Adresse GN.");
      return;
    }

    setPlans((data ?? []) as unknown as Plan[]);
  }

  const visiblePlans = useMemo(() => {
    return plans.filter((plan) => {
      if (!plan.audience) return true;

      if (draft.clientType === "particulier") {
        return ["individual", "residential"].includes(plan.audience);
      }

      if (draft.clientType === "professionnel") {
        return ["business", "professional", "api"].includes(plan.audience);
      }

      return ["institution", "institutional", "business"].includes(plan.audience);
    });
  }, [plans, draft.clientType]);

  function updateDraft<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function goNext() {
    setError("");

    if (step === "need") {
      setStep("location");
      return;
    }

    if (step === "location") {
      if (draft.lat === null || draft.lng === null) {
        setError("Confirmez d'abord la position GPS du lieu.");
        return;
      }

      setStep("contact");
      return;
    }

    if (step === "contact") {
      if (!draft.fullName.trim()) {
        setError("Renseignez le nom et prénom.");
        return;
      }

      if (!normalizeGuineaPhone(draft.phone)) {
        setError("Renseignez un numéro guinéen valide.");
        return;
      }

      setStep("offer");
      return;
    }

    if (step === "offer") {
      if (!draft.planCode) {
        setError("Choisissez une offre.");
        return;
      }

      setStep("otp");
    }
  }

  function goBack() {
    setError("");

    if (step === "need") {
      navigate({ to: "/" });
      return;
    }

    if (step === "location") setStep("need");
    if (step === "contact") setStep("location");
    if (step === "offer") setStep("contact");
    if (step === "otp") setStep("offer");
  }

  function requestCurrentPosition() {
    setError("");

    if (!navigator.geolocation) {
      setError("La géolocalisation n'est pas disponible sur cet appareil.");
      return;
    }

    setGeoLoading(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDraft((current) => ({
          ...current,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }));
        setGeoLoading(false);
      },
      (geoError) => {
        setGeoLoading(false);

        if (geoError.code === geoError.PERMISSION_DENIED) {
          setError("Autorisez l'accès à votre position pour continuer.");
          return;
        }

        setError("Impossible de récupérer votre position. Réessayez.");
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
      }
    );
  }

  function changeOtpChannel(channel: OtpChannel) {
    setOtpChannel(channel);
    setOtpCode("");
    setOtpSent(false);
    setError("");
  }

  async function sendOtp() {
    const phone = normalizeGuineaPhone(draft.phone);
    const email = draft.email.trim().toLowerCase();

    if (otpChannel === "email") {
      if (!email || !isValidEmail(email)) {
        setError("Ajoutez une adresse e-mail valide dans l'étape Coordonnées.");
        return;
      }
    } else if (!phone) {
      setError("Numéro de téléphone invalide.");
      return;
    }

    setLoading(true);
    setError("");

    const { error: otpError } =
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
            options:
              otpChannel === "whatsapp"
                ? {
                    channel: "whatsapp",
                    shouldCreateUser: true,
                    data: {
                      full_name: draft.fullName.trim(),
                      adresse_gn_verification_channel: "whatsapp",
                    },
                  }
                : {
                    channel: "sms",
                    shouldCreateUser: true,
                    data: {
                      full_name: draft.fullName.trim(),
                      adresse_gn_verification_channel: "sms",
                    },
                  },
          });

    setLoading(false);

    if (otpError) {
      const label = otpChannelLabel(otpChannel);
      setError(otpError.message || `Impossible d'envoyer le code par ${label}.`);
      return;
    }

    setOtpSent(true);
  }

  async function verifyOtpAndSubmit(event: FormEvent) {
    event.preventDefault();

    if (otpCode.trim().length < 6) {
      setError("Saisissez le code de vérification reçu.");
      return;
    }

    const phone = normalizeGuineaPhone(draft.phone);
    const email = draft.email.trim().toLowerCase();

    if (otpChannel === "email") {
      if (!email || !isValidEmail(email)) {
        setError("Adresse e-mail invalide.");
        return;
      }
    } else if (!phone) {
      setError("Numéro de téléphone invalide.");
      return;
    }

    setLoading(true);
    setError("");

    const { error: verifyError } =
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

    if (verifyError) {
      setLoading(false);
      setError(verifyError.message || "Le code saisi est invalide ou expiré.");
      return;
    }

    // Mémorise le canal choisi pour que la RPC puisse distinguer
    // WhatsApp / e-mail / SMS tout en gardant la même signature V1.
    const { error: metadataError } = await supabase.auth.updateUser({
      data: {
        adresse_gn_verification_channel: otpChannel,
        adresse_gn_contact_phone: phone,
      },
    });

    if (metadataError) {
      setLoading(false);
      setError("La vérification a réussi, mais le profil n'a pas pu être finalisé.");
      return;
    }

    const { data, error: rpcError } = await supabase.rpc("submit_address_order_v1", {
      p_plan_code: draft.planCode,
      p_client_type: draft.clientType,
      p_full_name: draft.fullName.trim(),
      p_email: draft.email.trim() || null,
      p_payment_method: draft.paymentMethod || null,

      p_place_type: draft.placeType,
      p_place_name: draft.placeName.trim() || null,

      p_lat: draft.lat,
      p_lng: draft.lng,
      p_accuracy_m: draft.accuracy,

      p_commune_id: draft.communeId,
      p_district_id: draft.districtId,
      p_sector_id: draft.sectorId,

      p_address_line: draft.addressLine.trim() || null,
      p_access_point_note: draft.accessPointNote.trim() || null,

      p_devis_demande: false,
      p_submission_channel: detectSubmissionChannel(),
    });

    setLoading(false);

    if (rpcError) {
      setError(rpcError.message || "La demande n'a pas pu être enregistrée.");
      return;
    }

    const result = Array.isArray(data) ? data[0] : data;

    if (!result?.order_id || !result?.order_ref) {
      setError("La demande a été traitée, mais sa référence n'a pas été retournée.");
      return;
    }

    setCreatedOrder(result as CreatedOrder);
    localStorage.removeItem(STORAGE_KEY);
    setStep("confirmation");
  }

  return (
    <div className="min-h-[calc(100vh-56px)] bg-slate-50 md:min-h-[calc(100vh-64px)]">
      <div className="mx-auto w-full max-w-2xl px-4 py-4 sm:px-6 sm:py-8">
        {step !== "confirmation" && (
          <div className="mb-3 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={goBack}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm"
              aria-label="Retour"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center justify-between text-xs font-medium text-slate-500">
                <span>Créer mon Adresse GN</span>
                <span>Étape {Math.min(stepIndex + 1, 5)} sur 5</span>
              </div>

              <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-[#16B7A5] transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        )}

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          {step === "need" && (
            <NeedStep
              draft={draft}
              onClientType={(value) => updateDraft("clientType", value)}
              onPlaceType={(value) => updateDraft("placeType", value)}
            />
          )}

          {step === "location" && (
            <LocationStep
              draft={draft}
              geoLoading={geoLoading}
              onLocate={requestCurrentPosition}
              onAddressLine={(value) => updateDraft("addressLine", value)}
              onPlaceName={(value) => updateDraft("placeName", value)}
              onAccessNote={(value) => updateDraft("accessPointNote", value)}
            />
          )}

          {step === "contact" && (
            <ContactStep
              draft={draft}
              onFullName={(value) => updateDraft("fullName", value)}
              onPhone={(value) => updateDraft("phone", value)}
              onEmail={(value) => updateDraft("email", value)}
            />
          )}

          {step === "offer" && (
            <OfferStep
              plans={visiblePlans}
              loading={plansLoading}
              selectedCode={draft.planCode}
              onSelect={(code) => updateDraft("planCode", code)}
            />
          )}

          {step === "otp" && (
            <OtpStep
              phone={normalizeGuineaPhone(draft.phone) || draft.phone}
              email={draft.email.trim()}
              channel={otpChannel}
              otpCode={otpCode}
              otpSent={otpSent}
              loading={loading}
              onChannelChange={changeOtpChannel}
              onOtpChange={setOtpCode}
              onSendOtp={sendOtp}
              onSubmit={verifyOtpAndSubmit}
            />
          )}

          {step === "confirmation" && (
            <ConfirmationStep
              createdOrder={createdOrder}
              onHome={() => navigate({ to: "/" })}
            />
          )}

          {error && step !== "confirmation" && (
            <div
              className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              role="alert"
            >
              {error}
            </div>
          )}

          {step !== "otp" && step !== "confirmation" && (
            <button
              type="button"
              onClick={goNext}
              className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#2E4A7B] px-5 font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading}
            >
              Continuer
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>

        {step !== "confirmation" && (
          <p className="mt-4 text-center text-xs leading-5 text-slate-500">
            Votre numéro Adresse GN n'est créé qu'après validation de votre demande.
          </p>
        )}
      </div>
    </div>
  );
}

function NeedStep({
  draft,
  onClientType,
  onPlaceType,
}: {
  draft: Draft;
  onClientType: (value: Draft["clientType"]) => void;
  onPlaceType: (value: Draft["placeType"]) => void;
}) {
  return (
    <>
      <p className="text-sm font-semibold text-[#16B7A5]">Votre besoin</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
        Quelle adresse souhaitez-vous créer ?
      </h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Choisissez le type de client puis le lieu à identifier.
      </p>

      <div className="mt-6">
        <label className="mb-2 block text-sm font-semibold text-slate-800">
          Vous êtes
        </label>

        <div className="grid grid-cols-3 gap-2">
          {[
            ["particulier", "Particulier"],
            ["professionnel", "Professionnel"],
            ["institution", "Institution"],
          ].map(([value, label]) => (
            <ChoiceButton
              key={value}
              selected={draft.clientType === value}
              onClick={() => onClientType(value as Draft["clientType"])}
            >
              {label}
            </ChoiceButton>
          ))}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <PlaceCard
          icon={<Home className="h-5 w-5" />}
          title="Domicile"
          text="Maison, appartement, résidence"
          selected={draft.placeType === "residential"}
          onClick={() => onPlaceType("residential")}
        />

        <PlaceCard
          icon={<MapPin className="h-5 w-5" />}
          title="Commerce"
          text="Boutique, pharmacie, restaurant…"
          selected={draft.placeType === "business"}
          onClick={() => onPlaceType("business")}
        />

        <PlaceCard
          icon={<QrCode className="h-5 w-5" />}
          title="Entreprise"
          text="Bureau, agence, dépôt, site"
          selected={draft.placeType === "company"}
          onClick={() => onPlaceType("company")}
        />

        <PlaceCard
          icon={<Crosshair className="h-5 w-5" />}
          title="Autre lieu"
          text="École, association, autre site"
          selected={draft.placeType === "other"}
          onClick={() => onPlaceType("other")}
        />
      </div>
    </>
  );
}

function LocationStep({
  draft,
  geoLoading,
  onLocate,
  onAddressLine,
  onPlaceName,
  onAccessNote,
}: {
  draft: Draft;
  geoLoading: boolean;
  onLocate: () => void;
  onAddressLine: (value: string) => void;
  onPlaceName: (value: string) => void;
  onAccessNote: (value: string) => void;
}) {
  const hasLocation = draft.lat !== null && draft.lng !== null;

  return (
    <>
      <p className="text-sm font-semibold text-[#16B7A5]">Localisation</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
        Où se trouve votre adresse ?
      </h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Placez-vous idéalement sur le lieu à enregistrer pour obtenir une position précise.
      </p>

      <button
        type="button"
        onClick={onLocate}
        disabled={geoLoading}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-[#16B7A5]/30 bg-[#16B7A5]/10 px-4 py-4 font-semibold text-[#0C776C] disabled:opacity-60"
      >
        {geoLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Crosshair className="h-5 w-5" />
        )}
        {geoLoading ? "Localisation en cours…" : "Utiliser ma position actuelle"}
      </button>

      {hasLocation && (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-full bg-emerald-600 p-1 text-white">
              <Check className="h-4 w-4" />
            </div>

            <div>
              <p className="font-semibold text-emerald-900">Position détectée</p>
              <p className="mt-1 text-sm text-emerald-800">
                {draft.lat?.toFixed(6)}, {draft.lng?.toFixed(6)}
              </p>

              {draft.accuracy !== null && (
                <p className="mt-1 text-xs text-emerald-700">
                  Précision estimée : ±{Math.round(draft.accuracy)} m
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-4">
        <Field
          label="Nom du lieu"
          value={draft.placeName}
          placeholder="Ex. Domicile, Restaurant Le Damier…"
          onChange={onPlaceName}
        />

        <Field
          label="Adresse / repère"
          value={draft.addressLine}
          placeholder="Ex. Nongo, près du carrefour…"
          onChange={onAddressLine}
        />

        <Field
          label="Indication d'accès"
          value={draft.accessPointNote}
          placeholder="Ex. portail bleu, entrée côté route…"
          onChange={onAccessNote}
        />
      </div>
    </>
  );
}

function ContactStep({
  draft,
  onFullName,
  onPhone,
  onEmail,
}: {
  draft: Draft;
  onFullName: (value: string) => void;
  onPhone: (value: string) => void;
  onEmail: (value: string) => void;
}) {
  return (
    <>
      <p className="text-sm font-semibold text-[#16B7A5]">Coordonnées</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
        Qui doit recevoir cette Adresse GN ?
      </h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Le téléphone sera vérifié par SMS à la dernière étape.
      </p>

      <div className="mt-6 space-y-4">
        <Field
          label="Nom et prénom *"
          value={draft.fullName}
          placeholder="Votre nom complet"
          onChange={onFullName}
          autoComplete="name"
        />

        <Field
          label="Téléphone *"
          value={draft.phone}
          placeholder="+224 623 26 87 81"
          onChange={onPhone}
          autoComplete="tel"
          inputMode="tel"
        />

        <Field
          label="E-mail"
          value={draft.email}
          placeholder="exemple@email.com"
          onChange={onEmail}
          autoComplete="email"
          inputMode="email"
        />
      </div>
    </>
  );
}

function OfferStep({
  plans,
  loading,
  selectedCode,
  onSelect,
}: {
  plans: Plan[];
  loading: boolean;
  selectedCode: string;
  onSelect: (code: string) => void;
}) {
  return (
    <>
      <p className="text-sm font-semibold text-[#16B7A5]">Offre</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
        Choisissez votre formule
      </h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Le montant final est récupéré directement depuis le catalogue Adresse GN.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[#2E4A7B]" />
        </div>
      ) : plans.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Aucune offre active ne correspond actuellement à ce profil.
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {plans.map((plan) => {
            const selected = selectedCode === plan.code;
            const name = localized(plan.name, plan.code);
            const description = localized(plan.description, "");

            return (
              <button
                type="button"
                key={plan.id}
                onClick={() => onSelect(plan.code)}
                className={[
                  "w-full rounded-2xl border p-4 text-left transition",
                  selected
                    ? "border-[#16B7A5] bg-[#16B7A5]/5 ring-2 ring-[#16B7A5]/10"
                    : "border-slate-200 bg-white hover:border-slate-300",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-slate-900">{name}</p>

                      {plan.popular && (
                        <span className="rounded-full bg-[#16B7A5]/10 px-2 py-1 text-[11px] font-bold text-[#0C776C]">
                          Recommandée
                        </span>
                      )}
                    </div>

                    {description && (
                      <p className="mt-1 text-sm leading-5 text-slate-600">
                        {description}
                      </p>
                    )}
                  </div>

                  <div
                    className={[
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                      selected
                        ? "border-[#16B7A5] bg-[#16B7A5] text-white"
                        : "border-slate-300 text-transparent",
                    ].join(" ")}
                  >
                    <Check className="h-4 w-4" />
                  </div>
                </div>

                <div className="mt-4 flex items-end justify-between gap-3 border-t border-slate-100 pt-3">
                  <div>
                    <p className="text-xl font-extrabold text-[#2E4A7B]">
                      {formatPlanPrice(plan)}
                    </p>

                    {plan.recurring_price_gnf > 0 && (
                      <p className="mt-1 text-xs text-slate-500">
                        + {formatGnf(plan.recurring_price_gnf)} /{" "}
                        {plan.billing_period === "month" ? "mois" : plan.billing_period}
                      </p>
                    )}
                  </div>

                  {plan.plate_included && (
                    <span className="text-xs font-semibold text-slate-500">
                      Plaque incluse
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

function OtpStep({
  phone,
  email,
  channel,
  otpCode,
  otpSent,
  loading,
  onChannelChange,
  onOtpChange,
  onSendOtp,
  onSubmit,
}: {
  phone: string;
  email: string;
  channel: OtpChannel;
  otpCode: string;
  otpSent: boolean;
  loading: boolean;
  onChannelChange: (channel: OtpChannel) => void;
  onOtpChange: (value: string) => void;
  onSendOtp: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  const destination =
    channel === "email"
      ? email || "aucune adresse e-mail renseignée"
      : phone;

  return (
    <>
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2E4A7B]/10 text-[#2E4A7B]">
        {channel === "whatsapp" ? (
          <MessageCircle className="h-7 w-7" />
        ) : channel === "email" ? (
          <Mail className="h-7 w-7" />
        ) : (
          <Smartphone className="h-7 w-7" />
        )}
      </div>

      <div className="mt-4 text-center">
        <p className="text-sm font-semibold text-[#16B7A5]">Vérification</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
          Choisissez comment recevoir votre code
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Sélectionnez le canal qui vous convient. WhatsApp est recommandé lorsque disponible.
        </p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <OtpChannelCard
          selected={channel === "whatsapp"}
          disabled={loading}
          icon={<MessageCircle className="h-5 w-5" />}
          title="WhatsApp"
          subtitle="Rapide et recommandé"
          badge="Recommandé"
          onClick={() => onChannelChange("whatsapp")}
        />

        <OtpChannelCard
          selected={channel === "email"}
          disabled={loading}
          icon={<Mail className="h-5 w-5" />}
          title="E-mail"
          subtitle={email ? maskEmail(email) : "E-mail requis"}
          onClick={() => onChannelChange("email")}
        />

        <OtpChannelCard
          selected={channel === "sms"}
          disabled={loading}
          icon={<Smartphone className="h-5 w-5" />}
          title="SMS"
          subtitle="Sur votre téléphone"
          onClick={() => onChannelChange("sms")}
        />
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Code envoyé vers
        </p>
        <p className="mt-1 break-all text-sm font-semibold text-slate-800">
          {channel === "email" ? destination : maskPhone(destination)}
        </p>
      </div>

      {!otpSent ? (
        <button
          type="button"
          disabled={loading}
          onClick={onSendOtp}
          className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#2E4A7B] px-5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Recevoir mon code par {otpChannelLabel(channel)}
        </button>
      ) : (
        <form className="mt-6" onSubmit={onSubmit}>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Code envoyé par {otpChannelLabel(channel)}. Saisissez les 6 chiffres reçus.
          </div>

          <label className="mb-2 mt-5 block text-sm font-semibold text-slate-800">
            Code de vérification
          </label>

          <input
            value={otpCode}
            onChange={(event) =>
              onOtpChange(event.target.value.replace(/\D/g, "").slice(0, 6))
            }
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            className="h-14 w-full rounded-2xl border border-slate-300 bg-white px-4 text-center text-2xl font-bold tracking-[0.35em] outline-none transition focus:border-[#16B7A5] focus:ring-4 focus:ring-[#16B7A5]/10"
          />

          <button
            type="submit"
            disabled={loading || otpCode.length < 6}
            className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#2E4A7B] px-5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Vérifier et envoyer ma demande
          </button>

          <div className="mt-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-center sm:gap-4">
            <button
              type="button"
              disabled={loading}
              onClick={onSendOtp}
              className="py-2 text-sm font-semibold text-[#2E4A7B] disabled:opacity-60"
            >
              Renvoyer le code
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => onChannelChange(channel === "whatsapp" ? "email" : "whatsapp")}
              className="py-2 text-sm font-semibold text-slate-600 disabled:opacity-60"
            >
              Changer de méthode
            </button>
          </div>
        </form>
      )}
    </>
  );
}

function OtpChannelCard({
  selected,
  disabled,
  icon,
  title,
  subtitle,
  badge,
  onClick,
}: {
  selected: boolean;
  disabled: boolean;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "relative rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60",
        selected
          ? "border-[#16B7A5] bg-[#16B7A5]/5 ring-2 ring-[#16B7A5]/10"
          : "border-slate-200 bg-white hover:border-slate-300",
      ].join(" ")}
    >
      {badge && (
        <span className="absolute right-3 top-3 rounded-full bg-[#16B7A5]/10 px-2 py-1 text-[10px] font-bold text-[#0C776C]">
          {badge}
        </span>
      )}

      <div
        className={[
          "flex h-9 w-9 items-center justify-center rounded-xl",
          selected ? "bg-[#16B7A5] text-white" : "bg-slate-100 text-[#2E4A7B]",
        ].join(" ")}
      >
        {icon}
      </div>

      <p className="mt-3 font-bold text-slate-900">{title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p>
    </button>
  );
}

function ConfirmationStep({
  createdOrder,
  onHome,
}: {
  createdOrder: CreatedOrder | null;
  onHome: () => void;
}) {
  return (
    <div className="py-4 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
        <Check className="h-8 w-8" />
      </div>

      <p className="mt-5 text-sm font-semibold text-[#16B7A5]">
        Demande enregistrée
      </p>

      <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
        Votre demande Adresse GN a bien été reçue.
      </h1>

      {createdOrder?.order_ref && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Référence de demande
          </p>
          <p className="mt-1 text-xl font-extrabold tracking-wide text-[#2E4A7B]">
            {createdOrder.order_ref}
          </p>
        </div>
      )}

      <p className="mt-5 text-sm leading-6 text-slate-600">
        Vous pourrez suivre la validation, l'attribution de votre numéro Adresse GN
        et l'installation éventuelle de votre plaque.
      </p>

      <button
        type="button"
        onClick={onHome}
        className="mt-7 h-12 w-full rounded-2xl bg-[#2E4A7B] px-5 font-semibold text-white"
      >
        Retour à l'accueil
      </button>
    </div>
  );
}

function ChoiceButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-xl border px-2 py-3 text-xs font-semibold transition sm:text-sm",
        selected
          ? "border-[#16B7A5] bg-[#16B7A5]/10 text-[#0C776C]"
          : "border-slate-200 bg-white text-slate-600",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function PlaceCard({
  icon,
  title,
  text,
  selected,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "min-h-32 rounded-2xl border p-4 text-left transition",
        selected
          ? "border-[#16B7A5] bg-[#16B7A5]/5 ring-2 ring-[#16B7A5]/10"
          : "border-slate-200 bg-white hover:border-slate-300",
      ].join(" ")}
    >
      <div
        className={[
          "flex h-9 w-9 items-center justify-center rounded-xl",
          selected
            ? "bg-[#16B7A5] text-white"
            : "bg-slate-100 text-[#2E4A7B]",
        ].join(" ")}
      >
        {icon}
      </div>

      <p className="mt-3 font-bold text-slate-900">{title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{text}</p>
    </button>
  );
}

function Field({
  label,
  value,
  placeholder,
  onChange,
  autoComplete,
  inputMode,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-800">{label}</span>

      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#16B7A5] focus:ring-4 focus:ring-[#16B7A5]/10"
      />
    </label>
  );
}

function otpChannelLabel(channel: OtpChannel) {
  if (channel === "whatsapp") return "WhatsApp";
  if (channel === "email") return "e-mail";
  return "SMS";
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function maskPhone(value: string) {
  const normalized = value.replace(/\s+/g, "");
  if (normalized.length < 7) return value;
  return `${normalized.slice(0, 6)}•••${normalized.slice(-3)}`;
}

function maskEmail(value: string) {
  const [local, domain] = value.split("@");
  if (!local || !domain) return value;

  const visible = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${visible}•••@${domain}`;
}

function normalizeGuineaPhone(value: string): string | null {
  const cleaned = value.replace(/[^\d+]/g, "");

  if (/^\+224\d{9}$/.test(cleaned)) {
    return cleaned;
  }

  const digits = cleaned.replace(/\D/g, "");

  if (/^224\d{9}$/.test(digits)) {
    return `+${digits}`;
  }

  if (/^00224\d{9}$/.test(digits)) {
    return `+${digits.slice(2)}`;
  }

  if (/^\d{9}$/.test(digits)) {
    return `+224${digits}`;
  }

  return null;
}

function localized(value: Record<string, string> | null, fallback: string) {
  if (!value) return fallback;
  return value.fr || value.en || fallback;
}

function formatGnf(value: number | null | undefined) {
  if (value === null || value === undefined) return "Sur devis";
  return `${new Intl.NumberFormat("fr-FR").format(value)} GNF`;
}

function formatPlanPrice(plan: Plan) {
  if (plan.requires_quote) return "Sur devis";

  const from = plan.price_from_gnf ?? plan.price_gnf;
  const to = plan.price_to_gnf ?? plan.price_gnf;

  if (from !== to) {
    return `${formatGnf(from)} – ${formatGnf(to)}`;
  }

  return formatGnf(plan.price_gnf);
}

function detectSubmissionChannel() {
  const capacitor = (
    window as typeof window & {
      Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
    }
  ).Capacitor;

  if (capacitor?.isNativePlatform?.()) {
    const platform = capacitor.getPlatform?.();

    if (platform === "android" || platform === "ios") {
      return platform;
    }
  }

  return "web";
}
