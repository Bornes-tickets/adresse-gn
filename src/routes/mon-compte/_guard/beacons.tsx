import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeCanvas } from "qrcode.react";
import { ExternalLink, Pencil, Trash2, Truck } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { CATEGORY_LABELS, categoryLabel } from "@/lib/geo";
import type { OwnerBeacon } from "@/lib/portal";
import {
  ownerBeacons,
  ownerCreateReport,
  ownerSuspendBeacon,
  ownerUpdateBeacon,
} from "@/lib/owner.functions";

export const Route = createFileRoute("/mon-compte/_guard/beacons")({
  head: () => ({
    meta: [
      { title: "Mes balises — Adresse GN" },
      {
        name: "description",
        content:
          "Gérez vos balises Adresse GN : nom, catégorie, visibilité, QR code et signalement de déménagement.",
      },
      { property: "og:title", content: "Mes balises — Adresse GN" },
      { property: "og:description", content: "Gestion de vos adresses et de leurs QR codes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MesBalisesPage,
});

function MesBalisesPage() {
  const queryClient = useQueryClient();
  const [edition, setEdition] = useState<OwnerBeacon | null>(null);
  const [qr, setQr] = useState<OwnerBeacon | null>(null);
  const [suppression, setSuppression] = useState<OwnerBeacon | null>(null);
  const [demenagement, setDemenagement] = useState<OwnerBeacon | null>(null);

  const { data, isPending } = useQuery({
    queryKey: ["owner-beacons"],
    queryFn: () => ownerBeacons(),
  });

  const rafraichir = () => queryClient.invalidateQueries({ queryKey: ["owner-beacons"] });

  const suspendre = useMutation({
    mutationFn: (addressId: string) => ownerSuspendBeacon({ data: { addressId } }),
    onSuccess: () => {
      toast.success("Balise suspendue.");
      setSuppression(null);
      rafraichir();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Mes balises</h1>
        <p className="text-sm text-muted-foreground">
          Les adresses dont vous êtes propriétaire enregistré.
        </p>
      </div>

      {isPending && <Skeleton className="h-40 w-full" />}

      {!isPending && !data?.length && (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Vous ne possédez encore aucune balise. Depuis la fiche publique d'une adresse, utilisez
            « Ceci est mon adresse ? » pour en réclamer la propriété.
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {data?.map((b) => (
          <Card key={b.address_id}>
            <CardContent className="space-y-4 pt-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="font-mono text-sm text-primary">{b.public_number}</p>
                  <p className="font-medium text-foreground">{b.name ?? "Sans nom"}</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{categoryLabel(b.category)}</Badge>
                    <Badge variant={b.visibility === "public" ? "default" : "outline"}>
                      {b.visibility === "public" ? "Publique" : "Privée"}
                    </Badge>
                    {b.status !== "active" && <Badge variant="destructive">Suspendue</Badge>}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href={`/a/${b.public_number}`} target="_blank" rel="noreferrer">
                      <ExternalLink className="size-4" />
                      Carte
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setEdition(b)}>
                    <Pencil className="size-4" />
                    Modifier
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setQr(b)}>
                    QR
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setDemenagement(b)}>
                    <Truck className="size-4" />
                    Déménagement
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSuppression(b)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>

              <div className="h-24 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={b.searches_30d}>
                    <XAxis dataKey="day" hide />
                    <Tooltip
                      labelFormatter={(v) => new Date(String(v)).toLocaleDateString("fr-FR")}
                      formatter={(v) => [`${v} recherche(s)`, ""]}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-muted-foreground">Recherches sur les 30 derniers jours</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <EditionDrawer balise={edition} onClose={() => setEdition(null)} onSaved={rafraichir} />
      <QrDialog balise={qr} onClose={() => setQr(null)} />
      <DemenagementDialog balise={demenagement} onClose={() => setDemenagement(null)} />

      <AlertDialog open={!!suppression} onOpenChange={(o) => !o && setSuppression(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspendre cette adresse ?</AlertDialogTitle>
            <AlertDialogDescription>
              L'adresse {suppression?.public_number} ne sera plus visible publiquement. Les données
              et l'historique sont conservés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => suppression && suspendre.mutate(suppression.address_id)}
            >
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EditionDrawer({
  balise,
  onClose,
  onSaved,
}: {
  balise: OwnerBeacon | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nom, setNom] = useState("");
  const [categorie, setCategorie] = useState("habitation");
  const [visibilite, setVisibilite] = useState("public");
  const [note, setNote] = useState("");
  const [initialise, setInitialise] = useState<string | null>(null);

  if (balise && initialise !== balise.address_id) {
    setInitialise(balise.address_id);
    setNom(balise.name ?? "");
    setCategorie(balise.category);
    setVisibilite(balise.visibility);
    setNote(balise.access_point_note ?? "");
  }

  const enregistrer = useMutation({
    mutationFn: () =>
      ownerUpdateBeacon({
        data: {
          addressId: balise!.address_id,
          name: nom,
          category: categorie,
          visibility: visibilite,
          accessPointNote: note,
        },
      }),
    onSuccess: () => {
      toast.success("Balise mise à jour.");
      onSaved();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={!!balise} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifier {balise?.public_number}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nom">Nom du lieu</Label>
            <Input id="nom" value={nom} onChange={(e) => setNom(e.target.value)} maxLength={120} />
          </div>
          <div className="space-y-2">
            <Label>Catégorie</Label>
            <Select value={categorie} onValueChange={setCategorie}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Visibilité</Label>
            <Select value={visibilite} onValueChange={setVisibilite}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Publique</SelectItem>
                <SelectItem value="private">Privée</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="note">Indication d'accès</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={400}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={() => enregistrer.mutate()} disabled={enregistrer.isPending}>
            {enregistrer.isPending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QrDialog({ balise, onClose }: { balise: OwnerBeacon | null; onClose: () => void }) {
  const telecharger = () => {
    const canvas = document.querySelector<HTMLCanvasElement>("#qr-balise canvas");
    if (!canvas || !balise) return;
    const lien = document.createElement("a");
    lien.href = canvas.toDataURL("image/png");
    lien.download = `${balise.public_number}.png`;
    lien.click();
  };

  return (
    <Dialog open={!!balise} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>QR code · {balise?.public_number}</DialogTitle>
        </DialogHeader>
        <div id="qr-balise" className="flex justify-center py-4">
          {balise && (
            <QRCodeCanvas
              value={`${typeof window !== "undefined" ? window.location.origin : ""}/a/${balise.public_number}`}
              size={220}
              includeMargin
            />
          )}
        </div>
        <DialogFooter>
          <Button onClick={telecharger}>Télécharger en PNG</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DemenagementDialog({
  balise,
  onClose,
}: {
  balise: OwnerBeacon | null;
  onClose: () => void;
}) {
  const [details, setDetails] = useState("");

  const envoyer = useMutation({
    mutationFn: () =>
      ownerCreateReport({
        data: {
          number: balise!.public_number,
          reason: "moving",
          description: details,
        },
      }),
    onSuccess: () => {
      toast.success("Déménagement signalé : notre équipe vous contactera.");
      setDetails("");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={!!balise} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Signaler un déménagement</DialogTitle>
        </DialogHeader>
        <Textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={4}
          placeholder="Nouvelle localisation, date prévue…"
          maxLength={1000}
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={() => envoyer.mutate()} disabled={envoyer.isPending}>
            Envoyer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
