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
import { formatDateFr } from "@/lib/admin";
import { CMS_STATUSES, CMS_STATUS_LABELS, slugifier, texte, type CmsPost, type Multi } from "@/lib/cms";
import { cmsDeletePost, cmsListPosts, cmsSavePost } from "@/lib/cms.functions";

export const Route = createFileRoute("/admin/_guard/cms/blog")({
  head: () => ({
    meta: [
      { title: "Blog — Administration Adresse GN" },
      { name: "description", content: "Rédaction et publication des articles multilingues." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CmsBlog,
});

const VIDE = {
  id: null as string | null,
  slug: "",
  status: "draft",
  category: "",
  cover_url: "",
  title: {} as Multi,
  excerpt: {} as Multi,
  body: {} as Multi,
  seo_title: {} as Multi,
  seo_description: {} as Multi,
};

function CmsBlog() {
  const lister = useServerFn(cmsListPosts);
  const enregistrer = useServerFn(cmsSavePost);
  const supprimer = useServerFn(cmsDeletePost);
  const qc = useQueryClient();

  const [form, setForm] = useState({ ...VIDE });
  const articles = useQuery({ queryKey: ["cms", "posts"], queryFn: () => lister() });
  const invalider = () => void qc.invalidateQueries({ queryKey: ["cms", "posts"] });

  const muter = useMutation({
    mutationFn: () =>
      enregistrer({
        data: {
          ...form,
          slug: form.slug || slugifier(texte(form.title)),
          category: form.category || null,
          cover_url: form.cover_url || null,
        },
      }),
    onSuccess: () => {
      toast.success("Article enregistré.");
      setForm({ ...VIDE });
      invalider();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const muterSuppression = useMutation({
    mutationFn: (id: string) => supprimer({ data: { id } }),
    onSuccess: () => {
      toast.success("Article supprimé.");
      invalider();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const editer = (p: CmsPost) =>
    setForm({
      id: p.id,
      slug: p.slug,
      status: p.status,
      category: p.category ?? "",
      cover_url: p.cover_url ?? "",
      title: p.title ?? {},
      excerpt: p.excerpt ?? {},
      body: p.body ?? {},
      seo_title: p.seo_title ?? {},
      seo_description: p.seo_description ?? {},
    });

  const colonnes: Colonne<CmsPost>[] = [
    {
      cle: "titre",
      entete: "Article",
      rendu: (l) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{texte(l.title) || "—"}</p>
          <p className="truncate text-xs text-muted-foreground">/blog/{l.slug}</p>
        </div>
      ),
    },
    {
      cle: "categorie",
      entete: "Catégorie",
      rendu: (l) => <span className="text-xs">{l.category ?? "—"}</span>,
    },
    { cle: "statut", entete: "Statut", rendu: (l) => <BadgeStatutCms statut={l.status} /> },
    {
      cle: "date",
      entete: "Publié le",
      rendu: (l) => <span className="text-xs">{formatDateFr(l.published_at)}</span>,
    },
    {
      cle: "actions",
      entete: "",
      rendu: (l) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" asChild>
            <a href={`/blog/${l.slug}?preview=true`} target="_blank" rel="noreferrer">
              Aperçu
            </a>
          </Button>
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
          <CardTitle className="text-base">Articles ({articles.data?.length ?? 0})</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setForm({ ...VIDE })}>
            <Plus className="mr-2 size-4" /> Nouvel article
          </Button>
        </CardHeader>
        <CardContent>
          <AdminTable
            colonnes={colonnes}
            lignes={articles.data ?? []}
            chargement={articles.isLoading}
            cle={(l) => l.id}
            vide="Aucun article pour le moment."
          />
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-base">
            {form.id ? "Modifier l'article" : "Créer un article"}
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
                placeholder={slugifier(texte(form.title)) || "mon-article"}
                onChange={(e) => setForm((f) => ({ ...f, slug: slugifier(e.target.value) }))}
              />
            </div>
            <div>
              <Label className="text-xs">Catégorie</Label>
              <Input
                value={form.category}
                placeholder="Annonces"
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
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
            <div>
              <Label className="text-xs">Couverture (URL)</Label>
              <Input
                value={form.cover_url}
                onChange={(e) => setForm((f) => ({ ...f, cover_url: e.target.value }))}
              />
            </div>
          </div>
          <ChampsMultilingues
            label="Chapeau"
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
            lignes={12}
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
