import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ChampsMultilingues } from "@/components/admin/ChampsMultilingues";
import { AdminTable, type Colonne } from "@/components/admin/AdminTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  LANGUES,
  LANGUE_LABELS,
  PERIODES,
  PERIODE_LABELS,
  formatGnf,
  texte,
  type CmsPlan,
  type Langue,
  type Multi,
} from "@/lib/cms";
import { cmsDeletePlan, cmsListPlans, cmsSavePlan } from "@/lib/cms.functions";

export const Route = createFileRoute("/admin/_guard/cms/tarifs")({
  head: () => ({
    meta: [
      { title: "Tarifs — Administration Adresse GN" },
      { name: "description", content: "Édition des offres, prix et avantages affichés sur le site." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CmsTarifs,
});

const VIDE = {
  id: null as string | null,
  code: "",
  name: {} as Multi,
  description: {} as Multi,
  features: {} as Record<string, string>,
  price_gnf: 0,
  period: "once",
  popular: false,
  active: true,
  position: 0,
};

function CmsTarifs() {
  const lister = useServerFn(cmsListPlans);
  const enregistrer = useServerFn(cmsSavePlan);
  const supprimer = useServerFn(cmsDeletePlan);
  const qc = useQueryClient();

  const [form, setForm] = useState({ ...VIDE });
  const offres = useQuery({ queryKey: ["cms", "plans"], queryFn: () => lister() });
  const invalider = () => void qc.invalidateQueries({ queryKey: ["cms", "plans"] });

  const versListes = () => {
    const sortie: Record<string, string[]> = {};
    for (const l of LANGUES) {
      const brut = form.features[l] ?? "";
      const items = brut
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean);
      if (items.length) sortie[l] = items;
    }
    return sortie;
  };

  const muter = useMutation({
    mutationFn: () => enregistrer({ data: { ...form, features: versListes() } }),
    onSuccess: () => {
      toast.success("Offre enregistrée.");
      setForm({ ...VIDE });
      invalider();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const muterSuppression = useMutation({
    mutationFn: (id: string) => supprimer({ data: { id } }),
    onSuccess: () => {
      toast.success("Offre supprimée.");
      invalider();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const editer = (p: CmsPlan) => {
    const features: Record<string, string> = {};
    for (const l of LANGUES) features[l] = (p.features?.[l] ?? []).join("\n");
    setForm({
      id: p.id,
      code: p.code,
      name: p.name ?? {},
      description: p.description ?? {},
      features,
      price_gnf: p.price_gnf,
      period: p.period,
      popular: p.popular,
      active: p.active,
      position: p.position,
    });
  };

  const colonnes: Colonne<CmsPlan>[] = [
    {
      cle: "offre",
      entete: "Offre",
      rendu: (l) => (
        <div className="min-w-0">
          <p className="flex items-center gap-2 truncate font-medium text-foreground">
            {texte(l.name) || l.code}
            {l.popular && <Star className="size-3.5 fill-admin-amber text-admin-amber" />}
          </p>
          <p className="truncate font-mono text-xs text-muted-foreground">{l.code}</p>
        </div>
      ),
    },
    {
      cle: "prix",
      entete: "Prix",
      rendu: (l) => (
        <div>
          <p className="font-semibold tabular-nums text-foreground">{formatGnf(l.price_gnf)}</p>
          <p className="text-xs text-muted-foreground">{PERIODE_LABELS[l.period]}</p>
        </div>
      ),
    },
    {
      cle: "avantages",
      entete: "Avantages",
      rendu: (l) => (
        <span className="text-xs text-muted-foreground">{(l.features?.fr ?? []).length} lignes</span>
      ),
    },
    {
      cle: "etat",
      entete: "État",
      rendu: (l) => (
        <Badge
          variant="outline"
          className={
            l.active
              ? "border-admin-green/25 bg-admin-green/10 text-admin-green"
              : "border-admin-slate/25 bg-admin-slate/10 text-admin-slate"
          }
        >
          {l.active ? "Active" : "Masquée"}
        </Badge>
      ),
    },
    {
      cle: "actions",
      entete: "",
      rendu: (l) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => editer(l)}>
            Éditer
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive"
            onClick={() => muterSuppression.mutate(l.id)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
      <Card className="overflow-hidden">
        <CardHeader className="flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">Offres ({offres.data?.length ?? 0})</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setForm({ ...VIDE })}>
            <Plus className="mr-2 size-4" /> Nouvelle offre
          </Button>
        </CardHeader>
        <CardContent>
          <AdminTable
            colonnes={colonnes}
            lignes={offres.data ?? []}
            chargement={offres.isLoading}
            cle={(l) => l.id}
            vide="Aucune offre pour le moment."
          />
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-base">
            {form.id ? "Modifier l'offre" : "Créer une offre"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Code</Label>
              <Input
                value={form.code}
                placeholder="particulier"
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.trim() }))}
              />
            </div>
            <div>
              <Label className="text-xs">Ordre</Label>
              <Input
                type="number"
                value={form.position}
                onChange={(e) => setForm((f) => ({ ...f, position: Number(e.target.value) }))}
              />
            </div>
          </div>
          <ChampsMultilingues
            label="Nom de l'offre"
            valeur={form.name}
            onChange={(name) => setForm((f) => ({ ...f, name }))}
          />
          <ChampsMultilingues
            label="Description"
            valeur={form.description}
            onChange={(description) => setForm((f) => ({ ...f, description }))}
            multiligne
            lignes={3}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Prix (GNF)</Label>
              <Input
                type="number"
                value={form.price_gnf}
                onChange={(e) => setForm((f) => ({ ...f, price_gnf: Number(e.target.value) }))}
              />
            </div>
            <div>
              <Label className="text-xs">Périodicité</Label>
              <Select
                value={form.period}
                onValueChange={(period) => setForm((f) => ({ ...f, period }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIODES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PERIODE_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Avantages (une ligne = un avantage)
            </Label>
            <Tabs defaultValue="fr">
              <TabsList className="h-8">
                {LANGUES.map((l) => (
                  <TabsTrigger key={l} value={l} className="text-xs">
                    {LANGUE_LABELS[l]}
                  </TabsTrigger>
                ))}
              </TabsList>
              {LANGUES.map((l: Langue) => (
                <TabsContent key={l} value={l} className="mt-2">
                  <Textarea
                    dir={l === "ar" ? "rtl" : "ltr"}
                    rows={6}
                    value={form.features[l] ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, features: { ...f.features, [l]: e.target.value } }))
                    }
                  />
                </TabsContent>
              ))}
            </Tabs>
          </div>

          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <Label className="text-sm">Mise en avant</Label>
            <Switch
              checked={form.popular}
              onCheckedChange={(popular) => setForm((f) => ({ ...f, popular }))}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <Label className="text-sm">Visible sur le site</Label>
            <Switch
              checked={form.active}
              onCheckedChange={(active) => setForm((f) => ({ ...f, active }))}
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={() => muter.mutate()} disabled={muter.isPending} className="flex-1">
              {muter.isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
            {form.id && (
              <Button variant="outline" onClick={() => setForm({ ...VIDE })}>
                Annuler
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
