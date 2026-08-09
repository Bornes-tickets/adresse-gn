import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { BadgeStatutCms } from "@/components/admin/BadgeStatutCms";
import { ChampsMultilingues } from "@/components/admin/ChampsMultilingues";
import { AdminTable, type Colonne } from "@/components/admin/AdminTable";
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
import { formatDateTimeFr } from "@/lib/admin";
import { CMS_STATUSES, CMS_STATUS_LABELS, slugifier, texte, type CmsPage, type Multi } from "@/lib/cms";
import { cmsDeletePage, cmsListPages, cmsSavePage } from "@/lib/cms.functions";

export const Route = createFileRoute("/admin/_guard/cms/pages")({
  head: () => ({
    meta: [
      { title: "Pages du site — Administration Adresse GN" },
      { name: "description", content: "Édition des pages éditoriales multilingues du site." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CmsPages,
});

const VIDE = {
  id: null as string | null,
  slug: "",
  status: "draft",
  title: {} as Multi,
  excerpt: {} as Multi,
  body: {} as Multi,
  seo_title: {} as Multi,
  seo_description: {} as Multi,
  cover_url: "",
  position: 0,
};

function CmsPages() {
  const lister = useServerFn(cmsListPages);
  const enregistrer = useServerFn(cmsSavePage);
  const supprimer = useServerFn(cmsDeletePage);
  const qc = useQueryClient();

  const [form, setForm] = useState({ ...VIDE });
  const pages = useQuery({ queryKey: ["cms", "pages"], queryFn: () => lister() });
  const invalider = () => void qc.invalidateQueries({ queryKey: ["cms", "pages"] });

  const muter = useMutation({
    mutationFn: () =>
      enregistrer({
        data: {
          ...form,
          slug: form.slug || slugifier(texte(form.title)),
          cover_url: form.cover_url || null,
        },
      }),
    onSuccess: () => {
      toast.success("Page enregistrée.");
      setForm({ ...VIDE });
      invalider();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const muterSuppression = useMutation({
    mutationFn: (id: string) => supprimer({ data: { id } }),
    onSuccess: () => {
      toast.success("Page supprimée.");
      invalider();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const editer = (p: CmsPage) =>
    setForm({
      id: p.id,
      slug: p.slug,
      status: p.status,
      title: p.title ?? {},
      excerpt: p.excerpt ?? {},
      body: p.body ?? {},
      seo_title: p.seo_title ?? {},
      seo_description: p.seo_description ?? {},
      cover_url: p.cover_url ?? "",
      position: p.position ?? 0,
    });

  const colonnes: Colonne<CmsPage>[] = [
    {
      cle: "titre",
      entete: "Titre",
      rendu: (l) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{texte(l.title) || "—"}</p>
          <p className="truncate text-xs text-muted-foreground">/{l.slug}</p>
        </div>
      ),
    },
    { cle: "statut", entete: "Statut", rendu: (l) => <BadgeStatutCms statut={l.status} /> },
    {
      cle: "langues",
      entete: "Langues",
      rendu: (l) => (
        <span className="text-xs text-muted-foreground">
          {(["fr", "en", "ar"] as const).filter((x) => l.title?.[x]).join(" · ") || "—"}
        </span>
      ),
    },
    {
      cle: "maj",
      entete: "Modifiée",
      rendu: (l) => <span className="text-xs">{formatDateTimeFr(l.updated_at)}</span>,
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
          <CardTitle className="text-base">Pages ({pages.data?.length ?? 0})</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setForm({ ...VIDE })}>
            <Plus className="mr-2 size-4" /> Nouvelle page
          </Button>
        </CardHeader>
        <CardContent>
          <AdminTable
            colonnes={colonnes}
            lignes={pages.data ?? []}
            chargement={pages.isLoading}
            cle={(l) => l.id}
            vide="Aucune page pour le moment."
          />
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-base">
            {form.id ? "Modifier la page" : "Créer une page"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ChampsMultilingues
            label="Titre"
            valeur={form.title}
            onChange={(title) => setForm((f) => ({ ...f, title }))}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Slug</Label>
              <Input
                value={form.slug}
                placeholder={slugifier(texte(form.title)) || "a-propos"}
                onChange={(e) => setForm((f) => ({ ...f, slug: slugifier(e.target.value) }))}
              />
            </div>
            <div>
              <Label className="text-xs">Statut</Label>
              <Select
                value={form.status}
                onValueChange={(status) => setForm((f) => ({ ...f, status }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CMS_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {CMS_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <ChampsMultilingues
            label="Résumé"
            valeur={form.excerpt}
            onChange={(excerpt) => setForm((f) => ({ ...f, excerpt }))}
            multiligne
            lignes={3}
          />
          <ChampsMultilingues
            label="Contenu"
            valeur={form.body}
            onChange={(body) => setForm((f) => ({ ...f, body }))}
            multiligne
            lignes={10}
          />
          <ChampsMultilingues
            label="Titre SEO"
            valeur={form.seo_title}
            onChange={(seo_title) => setForm((f) => ({ ...f, seo_title }))}
          />
          <ChampsMultilingues
            label="Description SEO"
            valeur={form.seo_description}
            onChange={(seo_description) => setForm((f) => ({ ...f, seo_description }))}
            multiligne
            lignes={3}
          />
          <div>
            <Label className="text-xs">Image de couverture (URL)</Label>
            <Input
              value={form.cover_url}
              onChange={(e) => setForm((f) => ({ ...f, cover_url: e.target.value }))}
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
