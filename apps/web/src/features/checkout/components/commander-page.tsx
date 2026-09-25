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
  Smartphone,
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
  return plan.name?.fr ?? plan.name?.FR ?? plan.name?.en ?? plan.code;
}

function formatGnf(value: number): string {
  return new Intl.NumberFormat("fr-FR").format(Number(value || 0));
}

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
      setPrefectures([]);
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
          setError("Impossible de charger les préfectures.");
        }
      });

    return () => controller.abort();
  }, [draft.regionId]);

  useEffect(() => {
    if (!draft.prefectureId) {
      setCommunes([]);
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
      setDistricts([]);
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
      setSectors([]);
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
        setError("Sélectionnez la commune.");
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

      if (!normalizePhone(draft.phone)) {
        setError("Renseignez un numéro guinéen valide.");
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

  function locate() {
    if (!navigator.geolocation) {
      setError("La géolocalisation n'est pas disponible.");
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
        setError("Impossible de récupérer la position.");
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
      setError("Numéro de téléphone invalide.");
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
      setError("Saisissez le code reçu.");
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
      setError("Le profil n'a pas pu être finalisé.");
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
          : "La commande n'a pas pu être créée.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link href="/" className="text-sm text-muted-foreground">
          ← Retour à l’accueil
        </Link>

        <h1 className="mt-4 text-3xl font-semibold tracking-tight">
          Commander mon Adresse GN
        </h1>

        <p className="mt-2 text-muted-foreground">
          Type de besoin → localisation → coordonnées → offre → vérification → suivi.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {step === "need" && "Votre besoin"}
            {step === "location" && "Localisation"}
            {step === "contact" && "Coordonnées"}
            {step === "offer" && "Votre offre"}
            {step === "otp" && "Vérification OTP"}
            {step === "confirmation" && "Confirmation"}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {step === "need" && (
            <>
              {initialPlan && (
                <div className="rounded-xl border bg-muted/50 p-4 text-sm">
                  Une offre a été présélectionnée depuis la page des tarifs.
                  Vous pourrez la confirmer à l’étape « Votre offre ».
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ["particulier", "Particulier"],
                  ["professionnel", "Professionnel"],
                  ["institutionnel", "Institution"],
                ].map(([value, label]) => (
                  <button
                    type="button"
                    key={value}
                    onClick={() =>
                      patch({
                        clientType: value as CheckoutDraft["clientType"],
                        planCode: "",
                      })
                    }
                    className={`rounded-xl border p-4 text-left ${
                      draft.clientType === value ? "bg-muted" : ""
                    }`}
                  >
                    <strong>{label}</strong>
                  </button>
                ))}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Type de lieu">
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={draft.placeType}
                    onChange={(event) =>
                      patch({
                        placeType:
                          event.target.value as CheckoutDraft["placeType"],
                      })
                    }
                  >
                    <option value="residential">Résidence</option>
                    <option value="business">Commerce</option>
                    <option value="company">Entreprise</option>
                    <option value="other">Autre</option>
                  </select>
                </Field>

                <Field label="Nom du lieu">
                  <Input
                    value={draft.placeName}
                    onChange={(event) =>
                      patch({ placeName: event.target.value })
                    }
                    placeholder="Ex. Résidence Barry"
                  />
                </Field>
              </div>
            </>
          )}

          {step === "location" && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={locate}
                disabled={geoLoading}
              >
                {geoLoading ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Crosshair className="mr-2 size-4" />
                )}
                Utiliser ma position
              </Button>

              {draft.lat !== null && draft.lng !== null && (
                <div className="rounded-lg bg-muted p-3 text-sm">
                  GPS confirmé — précision env.{" "}
                  {Math.round(draft.accuracyM ?? 0)} m
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <ReferenceSelect
                  label="Région"
                  value={draft.regionId}
                  items={regions}
                  onChange={(regionId) =>
                    patch({
                      regionId,
                      prefectureId: "",
                      communeId: "",
                      districtId: "",
                      sectorId: "",
                    })
                  }
                />
                <ReferenceSelect
                  label="Préfecture"
                  value={draft.prefectureId}
                  items={prefectures}
                  disabled={!draft.regionId}
                  onChange={(prefectureId) =>
                    patch({
                      prefectureId,
                      communeId: "",
                      districtId: "",
                      sectorId: "",
                    })
                  }
                />
                <ReferenceSelect
                  label="Commune"
                  value={draft.communeId}
                  items={communes}
                  disabled={!draft.prefectureId}
                  onChange={(communeId) =>
                    patch({
                      communeId,
                      districtId: "",
                      sectorId: "",
                    })
                  }
                />
                <ReferenceSelect
                  label="Quartier / district"
                  value={draft.districtId}
                  items={districts}
                  disabled={!draft.communeId}
                  onChange={(districtId) =>
                    patch({ districtId, sectorId: "" })
                  }
                />
                <ReferenceSelect
                  label="Secteur"
                  value={draft.sectorId}
                  items={sectors}
                  disabled={!draft.districtId}
                  onChange={(sectorId) => patch({ sectorId })}
                />
                <Field label="Repère / adresse">
                  <Input
                    value={draft.addressLine}
                    onChange={(event) =>
                      patch({ addressLine: event.target.value })
                    }
                  />
                </Field>
              </div>

              <Field label="Indications d’accès">
                <textarea
                  className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={draft.accessPointNote}
                  onChange={(event) =>
                    patch({ accessPointNote: event.target.value })
                  }
                />
              </Field>
            </>
          )}

          {step === "contact" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nom et prénom">
                <Input
                  value={draft.fullName}
                  onChange={(event) =>
                    patch({ fullName: event.target.value })
                  }
                />
              </Field>

              <Field label="Téléphone">
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
                />
              </Field>
            </div>
          )}

          {step === "offer" && (
            <div className="grid gap-4 md:grid-cols-3">
              {visiblePlans.map((plan) => (
                <button
                  type="button"
                  key={plan.id}
                  onClick={() => patch({ planCode: plan.code })}
                  className={`rounded-xl border p-5 text-left ${
                    draft.planCode === plan.code ? "bg-muted" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <strong>{planLabel(plan)}</strong>
                    {draft.planCode === plan.code && (
                      <Check className="size-5" />
                    )}
                  </div>

                  <p className="mt-3 text-xl font-semibold">
                    {plan.requires_quote
                      ? "Sur devis"
                      : `${formatGnf(plan.price_gnf)} GNF`}
                  </p>
                </button>
              ))}
            </div>
          )}

          {step === "otp" && (
            <form className="space-y-5" onSubmit={verifyAndSubmit}>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  {
                    value: "whatsapp" as const,
                    label: "WhatsApp",
                    icon: MessageCircle,
                  },
                  {
                    value: "email" as const,
                    label: "E-mail",
                    icon: Mail,
                  },
                  {
                    value: "sms" as const,
                    label: "SMS",
                    icon: Smartphone,
                  },
                ].map(({ value, label, icon: Icon }) => (
                  <button
                    type="button"
                    key={value}
                    onClick={() => {
                      setOtpChannel(value);
                      setOtpSent(false);
                      setOtpCode("");
                    }}
                    className={`rounded-xl border p-4 ${
                      otpChannel === value ? "bg-muted" : ""
                    }`}
                  >
                    <Icon className="mx-auto mb-2 size-5" />
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
                      setOtpCode(event.target.value)
                    }
                    placeholder="000000"
                  />
                </Field>
              )}

              <Button
                type="submit"
                disabled={loading || !otpSent}
              >
                {loading && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}
                Vérifier et confirmer
              </Button>

              <p className="text-xs text-muted-foreground">
                Cette tranche conserve le transport OTP actuel pendant la
                migration. Le raccordement production Meta WhatsApp / Bird SMS
                restera isolé derrière le même tunnel fonctionnel.
              </p>
            </form>
          )}

          {step === "confirmation" && created && (
            <div className="space-y-5">
              <div className="rounded-xl bg-muted p-5">
                <Check className="mb-3 size-7" />
                <p className="text-lg font-semibold">
                  Votre demande Adresse GN est enregistrée.
                </p>
                <p className="mt-2">
                  Référence : <strong>{created.order_ref}</strong>
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                {plans.find(
                  (plan) => plan.code === draft.planCode,
                )?.requires_quote !== true && (
                  <Button asChild>
                    <Link
                      href={`/commande/${created.order_ref}/paiement`}
                    >
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
          )}

          {step !== "confirmation" && step !== "otp" && (
            <div className="flex items-center justify-between gap-3 pt-2">
              {step !== "need" ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={back}
                >
                  <ArrowLeft className="mr-2 size-4" />
                  Retour
                </Button>
              ) : (
                <span />
              )}

              <Button type="button" onClick={next}>
                Continuer
                <ArrowRight className="ml-2 size-4" />
              </Button>
            </div>
          )}

          {step === "otp" && (
            <Button
              type="button"
              variant="ghost"
              onClick={back}
            >
              <ArrowLeft className="mr-2 size-4" />
              Modifier l’offre
            </Button>
          )}
        </CardContent>
      </Card>
    </main>
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
