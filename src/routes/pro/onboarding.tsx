import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { PLANS, formatGnf } from "@/lib/portal";
import { proBusiness, proCreateBusiness } from "@/lib/pro.functions";

export const Route = createFileRoute("/pro/onboarding")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Créer mon espace professionnel — Adresse GN" },
      {
        name: "description",
        content:
          "Inscrivez votre entreprise sur Adresse GN : fiche établissement, statistiques de visibilité et offres Basic ou Plus.",
      },
      { property: "og:title", content: "Créer mon espace professionnel — Adresse GN" },
      {
        property: "og:description",
        content: "Rendez votre commerce facile à trouver avec une adresse vérifiée.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [etape, setEtape] = useState(1);
  const [plan, setPlan] = useState<"basic" | "plus">("basic");
  const [form, setForm] = useState({
    tradeName: "",
    legalName: "",
    category: "",
    taxId: "",
    contactPhone: "",
    contactEmail: "",
    headquartersAddress: "",
  });

  const existant = useQuery({
    queryKey: ["pro-business"],
    queryFn: () => proBusiness(),
    enabled: !!user,
  });

  if (existant.data) {
    navigate({ to: "/pro", replace: true });
  }

  const creer = useMutation({
    mutationFn: () =>
      proCreateBusiness({
        data: {
          tradeName: form.tradeName,
          legalName: form.legalName || null,
          category: form.category || null,
          taxId: form.taxId || null,
          contactPhone: form.contactPhone || null,
          contactEmail: form.contactEmail || null,
          headquartersAddress: form.headquartersAddress || null,
          planCode: plan,
        },
      }),
    onSuccess: () => {
      toast.success("Espace professionnel créé. Paiement à finaliser sur place.");
      navigate({ to: "/pro", replace: true });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const champ = (cle: keyof typeof form, valeur: string) =>
    setForm((precedent) => ({ ...precedent, [cle]: valeur }));

  if (loading) return null;

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold text-foreground">Espace professionnel</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Connectez-vous pour inscrire votre entreprise.
        </p>
        <Button className="mt-6" onClick={() => navigate({ to: "/login" })}>
          Se connecter
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Créer mon espace professionnel</h1>
        <p className="text-sm text-muted-foreground">Étape {etape} sur 3</p>
      </div>

      {etape === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informations de l'entreprise</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="trade">Nom commercial *</Label>
              <Input
                id="trade"
                value={form.tradeName}
                onChange={(e) => champ("tradeName", e.target.value)}
                maxLength={160}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="legal">Raison sociale</Label>
              <Input
                id="legal"
                value={form.legalName}
                onChange={(e) => champ("legalName", e.target.value)}
                maxLength={160}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cat">Secteur d'activité</Label>
                <Input
                  id="cat"
                  value={form.category}
                  onChange={(e) => champ("category", e.target.value)}
                  maxLength={40}
                  placeholder="Restaurant, pharmacie…"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tax">NIF / RCCM</Label>
                <Input
                  id="tax"
                  value={form.taxId}
                  onChange={(e) => champ("taxId", e.target.value)}
                  maxLength={60}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone</Label>
                <Input
                  id="phone"
                  value={form.contactPhone}
                  onChange={(e) => champ("contactPhone", e.target.value)}
                  maxLength={30}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email de contact</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => champ("contactEmail", e.target.value)}
                  maxLength={160}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hq">Adresse du siège</Label>
              <Textarea
                id="hq"
                value={form.headquartersAddress}
                onChange={(e) => champ("headquartersAddress", e.target.value)}
                rows={2}
                maxLength={400}
              />
            </div>
            <Button disabled={!form.tradeName.trim()} onClick={() => setEtape(2)} className="w-full sm:w-auto">
              Continuer
            </Button>
          </CardContent>
        </Card>
      )}

      {etape === 2 && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {PLANS.map((offre) => (
              <Card
                key={offre.code}
                className={
                  plan === offre.code ? "border-primary ring-1 ring-primary" : "cursor-pointer"
                }
                onClick={() => setPlan(offre.code)}
              >
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-base">
                    {offre.label}
                    {plan === offre.code && <Check className="size-4 text-primary" />}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Installation {formatGnf(offre.setupGnf)} · {formatGnf(offre.monthlyGnf)}/mois
                  </p>
                  <ul className="space-y-1 text-sm text-foreground">
                    {offre.features.map((f) => (
                      <li key={f} className="flex gap-2">
                        <Check className="mt-0.5 size-4 text-accent" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setEtape(1)} className="w-full sm:w-auto">
              Retour
            </Button>
            <Button onClick={() => setEtape(3)} className="w-full sm:w-auto">Continuer</Button>
          </div>
        </div>
      )}

      {etape === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Récapitulatif</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Entreprise</dt>
                <dd className="font-medium text-foreground">{form.tradeName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Offre</dt>
                <dd className="font-medium text-foreground">
                  {PLANS.find((p) => p.code === plan)?.label}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Montant mensuel</dt>
                <dd className="font-medium text-foreground">
                  {formatGnf(PLANS.find((p) => p.code === plan)?.monthlyGnf)}
                </dd>
              </div>
            </dl>
            <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              Paiement à finaliser sur place : un conseiller Adresse GN vous contactera pour
              encaisser l'abonnement et activer votre fiche.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => setEtape(2)} className="w-full sm:w-auto">
                Retour
              </Button>
              <Button onClick={() => creer.mutate()} disabled={creer.isPending} className="w-full sm:w-auto">
                {creer.isPending ? "Création…" : "Créer mon espace pro"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
