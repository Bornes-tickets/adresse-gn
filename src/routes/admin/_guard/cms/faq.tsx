import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ChampsMultilingues } from "@/components/admin/ChampsMultilingues";
import { AdminTable, type Colonne } from "@/components/admin/AdminTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { texte, type CmsFaq, type Multi } from "@/lib/cms";
import { cmsDeleteFaq, cmsListFaq, cmsSaveFaq } from "@/lib/cms.functions";

export const Route = createFileRoute("/admin/_guard/cms/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — Administration Adresse GN" },
      { name: "description", content: "Questions fréquentes multilingues du site public." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CmsFaqPage,
});

const VIDE = {
  id: null as string | null,
  category: "",
  question: {} as Multi,
  answer: {} as Multi,
  position: 0,
  published: true,
};

function CmsFaqPage() {
  const lister = useServerFn(cmsListFaq);
  const enregistrer = useServerFn(cmsSaveFaq);
  const supprimer = useServerFn(cmsDeleteFaq);
  const qc = useQueryClient();

  const [form, setForm] = useState({ ...VIDE });
  const faq = useQuery({ queryKey: ["cms", "faq"], queryFn: () => lister() });
  const invalider = () => void qc.invalidateQueries({ queryKey: ["cms", "faq"] });

  const muter = useMutation({
    mutationFn: (entree?: Partial<typeof VIDE>) =>
      enregistrer({
        data: { ...form, ...entree, category: (entree?.category ?? form.category) || null },
      }),
    onSuccess: () => {
      toast.success("Question enregistrée.");
      setForm({ ...VIDE });
      invalider();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const muterVisible = useMutation({
    mutationFn: (l: CmsFaq) =>
      enregistrer({
        data: {
          id: l.id,
          category: l.category,
          question: l.question,
          answer: l.answer,
          position: l.position,
          published: !l.published,
        },
      }),
    onSuccess: invalider,
    onError: (e: Error) => toast.error(e.message),
  });

  const muterSuppression = useMutation({
    mutationFn: (id: string) => supprimer({ data: { id } }),
    onSuccess: () => {
      toast.success("Question supprimée.");
      invalider();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const colonnes: Colonne<CmsFaq>[] = [
    {
      cle: "question",
      entete: "Question",
      rendu: (l) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{texte(l.question) || "—"}</p>
          <p className="line-clamp-1 text-xs text-muted-foreground">{texte(l.answer)}</p>
        </div>
      ),
    },
    {
      cle: "categorie",
      entete: "Catégorie",
      rendu: (l) =>
        l.category ? (
          <Badge variant="outline" className="border-admin-cyan/25 bg-admin-cyan/10 text-admin-cyan">
            {l.category}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    { cle: "ordre", entete: "Ordre", rendu: (l) => <span className="tabular-nums">{l.position}</span> },
    {
      cle: "visible",
      entete: "Visible",
      rendu: (l) => (
        <Switch checked={l.published} onCheckedChange={() => muterVisible.mutate(l)} />
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
                category: l.category ?? "",
                question: l.question ?? {},
                answer: l.answer ?? {},
                position: l.position,
                published: l.published,
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
    <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
      <Card className="overflow-hidden">
        <CardHeader className="flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">Questions ({faq.data?.length ?? 0})</CardTitle>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" asChild>
              <a href="/faq?preview=1" target="_blank" rel="noreferrer">
                Aperçu
              </a>
            </Button>
            <Button size="sm" variant="outline" onClick={() => setForm({ ...VIDE })}>
              <Plus className="mr-2 size-4" /> Nouvelle question
            </Button>
          </div>

        </CardHeader>
        <CardContent>
          <AdminTable
            colonnes={colonnes}
            lignes={faq.data ?? []}
            chargement={faq.isLoading}
            cle={(l) => l.id}
            vide="Aucune question pour le moment."
          />
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-base">
            {form.id ? "Modifier la question" : "Ajouter une question"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ChampsMultilingues
            label="Question"
            valeur={form.question}
            onChange={(question) => setForm((f) => ({ ...f, question }))}
          />
          <ChampsMultilingues
            label="Réponse"
            valeur={form.answer}
            onChange={(answer) => setForm((f) => ({ ...f, answer }))}
            multiligne
            lignes={6}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Catégorie</Label>
              <Input
                value={form.category}
                placeholder="Général"
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Ordre d'affichage</Label>
              <Input
                type="number"
                value={form.position}
                onChange={(e) => setForm((f) => ({ ...f, position: Number(e.target.value) }))}
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <Label className="text-sm">Publiée sur le site</Label>
            <Switch
              checked={form.published}
              onCheckedChange={(published) => setForm((f) => ({ ...f, published }))}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => muter.mutate(undefined)} disabled={muter.isPending} className="flex-1">
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
