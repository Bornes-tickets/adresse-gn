import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Languages, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AdminTable, type Colonne } from "@/components/admin/AdminTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CmsTranslation } from "@/lib/cms";
import { cmsDeleteTranslation, cmsListTranslations, cmsSaveTranslation } from "@/lib/cms.functions";

export const Route = createFileRoute("/admin/_guard/cms/traductions")({
  head: () => ({
    meta: [
      { title: "Traductions — Administration Adresse GN" },
      { name: "description", content: "Dictionnaire des textes du site en français, anglais et arabe." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CmsTraductions,
});

const VIDE = { id: null as string | null, namespace: "common", key: "", fr: "", en: "", ar: "" };

function CmsTraductions() {
  const lister = useServerFn(cmsListTranslations);
  const enregistrer = useServerFn(cmsSaveTranslation);
  const supprimer = useServerFn(cmsDeleteTranslation);
  const qc = useQueryClient();

  const [form, setForm] = useState({ ...VIDE });
  const [filtre, setFiltre] = useState("");

  const traductions = useQuery({ queryKey: ["cms", "translations"], queryFn: () => lister() });
  const invalider = () => void qc.invalidateQueries({ queryKey: ["cms", "translations"] });

  const muter = useMutation({
    mutationFn: () => enregistrer({ data: { ...form } }),
    onSuccess: () => {
      toast.success("Traduction enregistrée.");
      setForm({ ...VIDE });
      invalider();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const muterSuppression = useMutation({
    mutationFn: (id: string) => supprimer({ data: { id } }),
    onSuccess: () => {
      toast.success("Traduction supprimée.");
      invalider();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lignes = useMemo(() => {
    const t = filtre.trim().toLowerCase();
    const base = traductions.data ?? [];
    if (!t) return base;
    return base.filter((l) =>
      [l.namespace, l.key, l.fr, l.en, l.ar].some((v) => (v ?? "").toLowerCase().includes(t)),
    );
  }, [traductions.data, filtre]);

  const manquantes = (traductions.data ?? []).filter((l) => !l.en || !l.ar).length;

  const colonnes: Colonne<CmsTranslation>[] = [
    {
      cle: "cle",
      entete: "Clé",
      rendu: (l) => (
        <div className="min-w-0">
          <p className="truncate font-mono text-xs text-foreground">{l.key}</p>
          <Badge
            variant="outline"
            className="mt-1 border-admin-violet/25 bg-admin-violet/10 text-admin-violet"
          >
            {l.namespace}
          </Badge>
        </div>
      ),
    },
    { cle: "fr", entete: "Français", rendu: (l) => <span className="text-sm">{l.fr ?? "—"}</span> },
    { cle: "en", entete: "English", rendu: (l) => <span className="text-sm">{l.en ?? "—"}</span> },
    {
      cle: "ar",
      entete: "العربية",
      rendu: (l) => (
        <span dir="rtl" className="block text-sm">
          {l.ar ?? "—"}
        </span>
      ),
    },
    {
      cle: "actions",
      entete: "",
      rendu: (l) => (
        <div className="flex justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              setForm({
                id: l.id,
                namespace: l.namespace,
                key: l.key,
                fr: l.fr ?? "",
                en: l.en ?? "",
                ar: l.ar ?? "",
              })
            }
          >
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
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <Card className="overflow-hidden">
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Languages className="size-4 text-admin-violet" />
              Traductions ({traductions.data?.length ?? 0})
            </CardTitle>
            {manquantes > 0 && (
              <Badge
                variant="outline"
                className="border-admin-amber/25 bg-admin-amber/10 text-admin-amber"
              >
                {manquantes} incomplète{manquantes > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filtre}
              onChange={(e) => setFiltre(e.target.value)}
              placeholder="Rechercher une clé ou un texte…"
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          <AdminTable
            colonnes={colonnes}
            lignes={lignes}
            chargement={traductions.isLoading}
            cle={(l) => l.id}
            vide="Aucune traduction."
          />
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-base">
            {form.id ? "Modifier la traduction" : "Ajouter une traduction"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Espace de noms</Label>
              <Input
                value={form.namespace}
                onChange={(e) => setForm((f) => ({ ...f, namespace: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Clé</Label>
              <Input
                value={form.key}
                placeholder="nav.pricing"
                onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Français</Label>
            <Input value={form.fr} onChange={(e) => setForm((f) => ({ ...f, fr: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs">English</Label>
            <Input value={form.en} onChange={(e) => setForm((f) => ({ ...f, en: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs">العربية</Label>
            <Input
              dir="rtl"
              value={form.ar}
              onChange={(e) => setForm((f) => ({ ...f, ar: e.target.value }))}
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button onClick={() => muter.mutate()} disabled={muter.isPending} className="flex-1">
              {muter.isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
            <Button variant="outline" onClick={() => setForm({ ...VIDE })}>
              <Plus className="size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
