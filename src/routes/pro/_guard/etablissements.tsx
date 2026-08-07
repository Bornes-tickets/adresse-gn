import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { JOURS } from "@/lib/portal";
import type { ProEstablishment } from "@/lib/portal";
import {
  proAvailableAddresses,
  proCreateEstablishment,
  proDeletePhoto,
  proEstablishments,
  proUpdateEstablishment,
} from "@/lib/pro.functions";

export const Route = createFileRoute("/pro/_guard/etablissements")({
  head: () => ({
    meta: [
      { title: "Mes établissements — Espace pro Adresse GN" },
      {
        name: "description",
        content:
          "Créez et enrichissez les fiches de vos établissements : nom commercial, téléphone, horaires, photos et description.",
      },
      { property: "og:title", content: "Mes établissements — Espace pro Adresse GN" },
      { property: "og:description", content: "Gestion des fiches établissements." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EtablissementsPage,
});

type FormState = {
  addressId: string;
  businessName: string;
  phone: string;
  description: string;
  openingHours: Record<string, string>;
  coverBase64: string | null;
  photosBase64: string[];
};

const VIDE: FormState = {
  addressId: "",
  businessName: "",
  phone: "",
  description: "",
  openingHours: {},
  coverBase64: null,
  photosBase64: [],
};

async function enBase64(fichier: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resolve(String(lecteur.result));
    lecteur.onerror = () => reject(new Error("Lecture impossible."));
    lecteur.readAsDataURL(fichier);
  });
}

function EtablissementsPage() {
  const queryClient = useQueryClient();
  const [ouvert, setOuvert] = useState(false);
  const [edite, setEdite] = useState<ProEstablishment | null>(null);
  const [form, setForm] = useState<FormState>(VIDE);

  const fiches = useQuery({
    queryKey: ["pro-establishments"],
    queryFn: () => proEstablishments(),
  });
  const adresses = useQuery({
    queryKey: ["pro-available-addresses"],
    queryFn: () => proAvailableAddresses(),
  });

  const rafraichir = () => {
    queryClient.invalidateQueries({ queryKey: ["pro-establishments"] });
    queryClient.invalidateQueries({ queryKey: ["pro-available-addresses"] });
  };

  const enregistrer = useMutation({
    mutationFn: async () => {
      const payload = {
        addressId: form.addressId,
        businessName: form.businessName,
        phone: form.phone || null,
        description: form.description || null,
        openingHours: form.openingHours,
        coverBase64: form.coverBase64,
        photosBase64: form.photosBase64,
      };
      return edite
        ? proUpdateEstablishment({ data: { ...payload, id: edite.id } })
        : proCreateEstablishment({ data: payload });
    },
    onSuccess: () => {
      toast.success(edite ? "Fiche mise à jour." : "Fiche créée.");
      setOuvert(false);
      setEdite(null);
      setForm(VIDE);
      rafraichir();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const supprimerPhoto = useMutation({
    mutationFn: (input: { id: string; photoId: string }) => proDeletePhoto({ data: input }),
    onSuccess: () => {
      toast.success("Photo supprimée.");
      rafraichir();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ouvrirCreation = () => {
    setEdite(null);
    setForm(VIDE);
    setOuvert(true);
  };

  const ouvrirEdition = (fiche: ProEstablishment) => {
    setEdite(fiche);
    setForm({
      addressId: fiche.address_id,
      businessName: fiche.business_name,
      phone: fiche.phone ?? "",
      description: fiche.description ?? "",
      openingHours: fiche.opening_hours ?? {},
      coverBase64: null,
      photosBase64: [],
    });
    setOuvert(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Mes établissements</h1>
          <p className="text-sm text-muted-foreground">
            Une fiche par adresse dont vous êtes propriétaire.
          </p>
        </div>
        <Button onClick={ouvrirCreation} className="w-full sm:w-auto">
          <Plus className="size-4" />
          Nouvelle fiche
        </Button>
      </div>

      {fiches.isPending && <Skeleton className="h-40 w-full" />}
      {!fiches.isPending && !fiches.data?.length && (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Aucune fiche pour l'instant. Vous devez d'abord posséder une adresse (réclamation
            validée) pour y créer un établissement.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {fiches.data?.map((f) => (
          <Card key={f.id}>
            <CardContent className="space-y-3 pt-6">
              {f.cover_url && (
                <img
                  src={f.cover_url}
                  alt={`Photo de couverture de ${f.business_name}`}
                  loading="lazy"
                  className="h-40 w-full rounded-md object-cover"
                />
              )}
              <div className="space-y-1">
                <p className="font-medium text-foreground">{f.business_name}</p>
                <p className="font-mono text-xs text-primary">{f.public_number}</p>
                {f.phone && <p className="text-sm text-muted-foreground">{f.phone}</p>}
              </div>
              {f.description && (
                <p className="line-clamp-3 text-sm text-muted-foreground">{f.description}</p>
              )}
              {!!f.photos.length && (
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {f.photos.map((p) => (
                    <div key={p.id} className="relative">
                      <img
                        src={p.url}
                        alt={`Photo de ${f.business_name}`}
                        loading="lazy"
                        className="aspect-square w-full rounded-md object-cover"
                      />
                      <button
                        type="button"
                        aria-label="Supprimer la photo"
                        onClick={() => supprimerPhoto.mutate({ id: f.id, photoId: p.id })}
                        className="absolute -right-1 -top-1 rounded-full bg-destructive p-1 text-destructive-foreground"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">
                  {Object.keys(f.opening_hours ?? {}).length} jour(s) d'horaires
                </Badge>
                <Button size="sm" variant="outline" onClick={() => ouvrirEdition(f)}>
                  Modifier
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={ouvert} onOpenChange={setOuvert}>
        <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto sm:w-full">
          <DialogHeader>
            <DialogTitle>{edite ? "Modifier la fiche" : "Nouvelle fiche établissement"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {!edite && (
              <div className="space-y-2">
                <Label>Adresse</Label>
                <Select
                  value={form.addressId}
                  onValueChange={(v) => setForm((p) => ({ ...p, addressId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir une adresse possédée" />
                  </SelectTrigger>
                  <SelectContent>
                    {adresses.data?.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.public_number} — {a.name ?? "Sans nom"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!adresses.data?.length && (
                  <p className="text-xs text-muted-foreground">
                    Aucune adresse disponible sans fiche.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="nom-commercial">Nom commercial</Label>
              <Input
                id="nom-commercial"
                value={form.businessName}
                onChange={(e) => setForm((p) => ({ ...p, businessName: e.target.value }))}
                maxLength={120}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tel-etab">Téléphone</Label>
              <Input
                id="tel-etab"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                maxLength={30}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="desc-etab">Description</Label>
              <Textarea
                id="desc-etab"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                rows={3}
                maxLength={2000}
              />
            </div>

            <div className="space-y-2">
              <Label>Horaires d'ouverture</Label>
              {JOURS.map((jour) => (
                <div key={jour.key} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                  <span className="text-sm text-muted-foreground sm:w-20">{jour.label}</span>
                  <Input
                    value={form.openingHours[jour.key] ?? ""}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        openingHours: { ...p.openingHours, [jour.key]: e.target.value },
                      }))
                    }
                    placeholder="08:00-18:00 ou Fermé"
                    maxLength={40}
                  />
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="cover">Photo de couverture</Label>
              <Input
                id="cover"
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const fichier = e.target.files?.[0];
                  if (!fichier) return;
                  setForm((p) => ({ ...p, coverBase64: null }));
                  const base64 = await enBase64(fichier);
                  setForm((p) => ({ ...p, coverBase64: base64 }));
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="galerie" className="flex items-center gap-2">
                <ImagePlus className="size-4" />
                Photos supplémentaires (max 8)
              </Label>
              <Input
                id="galerie"
                type="file"
                accept="image/*"
                multiple
                onChange={async (e) => {
                  const fichiers = [...(e.target.files ?? [])].slice(0, 8);
                  const images = await Promise.all(fichiers.map(enBase64));
                  setForm((p) => ({ ...p, photosBase64: images }));
                }}
              />
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setOuvert(false)} className="w-full sm:w-auto">
              Annuler
            </Button>
            <Button
              onClick={() => enregistrer.mutate()}
              disabled={
                enregistrer.isPending || !form.businessName.trim() || (!edite && !form.addressId)
              }
              className="w-full sm:w-auto"
            >
              {enregistrer.isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
