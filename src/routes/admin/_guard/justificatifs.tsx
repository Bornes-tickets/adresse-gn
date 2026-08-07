import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Image as ImageIcon, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

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
import { Textarea } from "@/components/ui/textarea";
import { formatDateTimeFr } from "@/lib/admin";
import {
  adminDeleteInstallDoc,
  adminInstallDocs,
  adminInstallDocsQueue,
  adminReviewInstallDoc,
  adminUploadInstallDoc,
} from "@/lib/install-docs.functions";

export const Route = createFileRoute("/admin/_guard/justificatifs")({
  head: () => ({
    meta: [
      { title: "Justificatifs d'installation — Administration Adresse GN" },
      {
        name: "description",
        content:
          "Déposer, consulter et valider les photos et justificatifs des installations en attente.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminJustificatifs,
});

const LIBELLES_KIND: Record<string, string> = {
  photo: "Photo",
  recu: "Reçu",
  attestation: "Attestation",
  autre: "Autre",
};

function lireFichier(fichier: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resolve(String(lecteur.result));
    lecteur.onerror = () => reject(new Error("Lecture du fichier impossible."));
    lecteur.readAsDataURL(fichier);
  });
}

function AdminJustificatifs() {
  const listerFile = useServerFn(adminInstallDocsQueue);
  const listerDocs = useServerFn(adminInstallDocs);
  const envoyer = useServerFn(adminUploadInstallDoc);
  const statuer = useServerFn(adminReviewInstallDoc);
  const supprimer = useServerFn(adminDeleteInstallDoc);
  const qc = useQueryClient();

  const [statut, setStatut] = useState("tous");
  const [selection, setSelection] = useState<string | null>(null);
  const [kind, setKind] = useState("photo");
  const [libelle, setLibelle] = useState("");
  const [motif, setMotif] = useState("");
  const champFichier = useRef<HTMLInputElement>(null);

  const file = useQuery({
    queryKey: ["admin", "install-docs-queue", statut],
    queryFn: () => listerFile({ data: { statut: statut === "tous" ? null : statut } }),
  });

  const courante = (file.data ?? []).find((l) => l.id === selection) ?? null;

  const docs = useQuery({
    queryKey: ["admin", "install-docs", selection],
    queryFn: () => listerDocs({ data: { pendingId: selection! } }),
    enabled: !!selection,
  });

  const rafraichir = () => {
    qc.invalidateQueries({ queryKey: ["admin", "install-docs", selection] });
    qc.invalidateQueries({ queryKey: ["admin", "install-docs-queue"] });
  };

  const muterEnvoi = useMutation({
    mutationFn: async (fichier: File) => {
      const base64 = await lireFichier(fichier);
      return envoyer({
        data: {
          pendingId: selection!,
          kind,
          label: libelle || fichier.name,
          mimeType: fichier.type || "image/jpeg",
          base64,
        },
      });
    },
    onSuccess: () => {
      toast.success("Justificatif déposé — en attente de validation.");
      setLibelle("");
      if (champFichier.current) champFichier.current.value = "";
      rafraichir();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const muterStatut = useMutation({
    mutationFn: (v: { docId: string; statut: string; note?: string | null }) =>
      statuer({ data: v }),
    onSuccess: () => {
      toast.success("Statut du justificatif mis à jour.");
      setMotif("");
      rafraichir();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const muterSuppression = useMutation({
    mutationFn: (docId: string) => supprimer({ data: { docId } }),
    onSuccess: () => {
      toast.success("Justificatif supprimé.");
      rafraichir();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Justificatifs d'installation</h1>
          <p className="text-sm text-muted-foreground">
            Déposez, consultez et validez les photos et pièces liées aux installations en attente.
          </p>
        </div>
        <div className="w-48">
          <Label className="text-xs">Statut installation</Label>
          <Select value={statut} onValueChange={setStatut}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tous">Tous</SelectItem>
              <SelectItem value="pending">À planifier</SelectItem>
              <SelectItem value="assigned">Assignée</SelectItem>
              <SelectItem value="planned">Planifiée</SelectItem>
              <SelectItem value="done">Terminée</SelectItem>
              <SelectItem value="cancelled">Annulée</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">
              Installations en attente ({file.data?.length ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {file.isLoading ? (
              <p className="text-sm text-muted-foreground">Chargement…</p>
            ) : (file.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune installation.</p>
            ) : (
              (file.data ?? []).map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setSelection(l.id)}
                  className={`w-full rounded-md border p-3 text-left transition ${
                    selection === l.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm">{l.beacon_number ?? "—"}</span>
                    <Badge variant="outline">{l.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {l.client} · {l.order_ref ?? "—"}
                  </p>
                  <p className="mt-1 text-xs">
                    {l.docs.total} pièce(s) · {l.docs.pending} en attente ·{" "}
                    {l.docs.approved} validée(s) · {l.docs.rejected} rejetée(s)
                  </p>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {!selection ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                Sélectionnez une installation à gauche pour gérer ses justificatifs.
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Déposer une pièce —{" "}
                    <span className="font-mono">{courante?.beacon_number ?? "—"}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <Label className="text-xs">Type</Label>
                      <Select value={kind} onValueChange={setKind}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(LIBELLES_KIND).map(([v, l]) => (
                            <SelectItem key={v} value={v}>
                              {l}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-xs">Libellé (optionnel)</Label>
                      <Input
                        value={libelle}
                        onChange={(e) => setLibelle(e.target.value)}
                        placeholder="Ex. Façade avec balise posée"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Fichier (JPEG, PNG, WEBP ou PDF — max 8 Mo)</Label>
                    <Input
                      ref={champFichier}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      onChange={(e) => {
                        const fichier = e.target.files?.[0];
                        if (fichier) muterEnvoi.mutate(fichier);
                      }}
                      disabled={muterEnvoi.isPending}
                    />
                  </div>
                  {muterEnvoi.isPending ? (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Upload className="h-4 w-4 animate-pulse" /> Envoi en cours…
                    </p>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Pièces déposées ({docs.data?.length ?? 0})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-xs">Motif (obligatoire pour un rejet)</Label>
                    <Textarea
                      value={motif}
                      onChange={(e) => setMotif(e.target.value)}
                      rows={2}
                      placeholder="Ex. photo floue, balise non visible"
                    />
                  </div>

                  {docs.isLoading ? (
                    <p className="text-sm text-muted-foreground">Chargement…</p>
                  ) : (docs.data ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Aucun justificatif pour cette installation.
                    </p>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {(docs.data ?? []).map((d) => {
                        const estImage = (d.mime_type ?? "").startsWith("image/");
                        return (
                          <div key={d.id} className="overflow-hidden rounded-lg border border-border">
                            <div className="flex h-40 items-center justify-center bg-muted/40">
                              {estImage && d.url ? (
                                <img
                                  src={d.url}
                                  alt={d.label ?? "Justificatif d'installation"}
                                  className="h-40 w-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <FileText className="h-10 w-10 text-muted-foreground" />
                              )}
                            </div>
                            <div className="space-y-2 p-3">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-medium">
                                  {LIBELLES_KIND[d.kind] ?? d.kind}
                                </span>
                                <Badge
                                  variant={
                                    d.status === "approved"
                                      ? "secondary"
                                      : d.status === "rejected"
                                        ? "destructive"
                                        : "outline"
                                  }
                                >
                                  {d.status === "approved"
                                    ? "Validée"
                                    : d.status === "rejected"
                                      ? "Rejetée"
                                      : "En attente"}
                                </Badge>
                              </div>
                              <p className="truncate text-xs text-muted-foreground">
                                {d.label ?? "Sans libellé"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDateTimeFr(d.created_at)}
                                {d.size_bytes
                                  ? ` · ${Math.round(Number(d.size_bytes) / 1024)} Ko`
                                  : ""}
                              </p>
                              {d.review_note ? (
                                <p className="text-xs text-destructive">Motif : {d.review_note}</p>
                              ) : null}
                              <div className="flex flex-wrap gap-2">
                                {d.url ? (
                                  <Button asChild size="sm" variant="ghost">
                                    <a href={d.url} target="_blank" rel="noreferrer">
                                      <ImageIcon className="mr-1 h-4 w-4" /> Ouvrir
                                    </a>
                                  </Button>
                                ) : null}
                                {d.status !== "approved" ? (
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      muterStatut.mutate({
                                        docId: d.id,
                                        statut: "approved",
                                        note: motif || null,
                                      })
                                    }
                                  >
                                    Valider
                                  </Button>
                                ) : null}
                                {d.status !== "rejected" ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      muterStatut.mutate({
                                        docId: d.id,
                                        statut: "rejected",
                                        note: motif,
                                      })
                                    }
                                  >
                                    Rejeter
                                  </Button>
                                ) : null}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => muterSuppression.mutate(d.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
