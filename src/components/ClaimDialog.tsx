import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { createClaim } from "@/lib/owner.functions";
import { CLAIM_STATUS_LABELS } from "@/lib/portal";

interface ClaimDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  number: string;
  claimStatus: string | null;
  isMine: boolean;
}

async function fichierEnBase64(fichier: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resolve(String(lecteur.result));
    lecteur.onerror = () => reject(new Error("Lecture du fichier impossible."));
    lecteur.readAsDataURL(fichier);
  });
}

export function ClaimDialog({
  open,
  onOpenChange,
  number,
  claimStatus,
  isMine,
}: ClaimDialogProps) {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [nom, setNom] = useState("");
  const [tel, setTel] = useState("");
  const [details, setDetails] = useState("");
  const [fichier, setFichier] = useState<File | null>(null);

  const envoyer = useMutation({
    mutationFn: async () => {
      const base64 = fichier ? await fichierEnBase64(fichier) : null;
      const explication = [
        nom.trim() ? `Propriétaire déclaré : ${nom.trim()}` : "",
        tel.trim() ? `Téléphone : ${tel.trim()}` : "",
        details.trim(),
      ]
        .filter(Boolean)
        .join("\n");
      return createClaim({
        data: { number, explanation: explication, photoBase64: base64 },
      });
    },

    onSuccess: () => {
      toast.success("Demande envoyée. Notre équipe vérifie sous 48 h.");
      setDetails("");
      setFichier(null);
      queryClient.invalidateQueries({ queryKey: ["beacon-context", number] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto sm:w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            Réclamer cette adresse
          </DialogTitle>
          <DialogDescription className="font-mono">{number}</DialogDescription>
        </DialogHeader>

        {isMine ? (
          <p className="text-sm text-muted-foreground">
            Cette adresse vous appartient déjà.{" "}
            <Link to="/mon-compte/beacons" className="text-primary underline">
              Gérer mes balises
            </Link>
          </p>
        ) : !isAuthenticated ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Connectez-vous pour déclarer que ce lieu est le vôtre.
            </p>
            <Button asChild size="lg" className="w-full">
              <Link to="/login">Se connecter</Link>
            </Button>
          </div>
        ) : claimStatus === "pending" ? (
          <p className="text-sm text-muted-foreground">
            Votre demande est en cours d'examen ({CLAIM_STATUS_LABELS['pending']}).
          </p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="claim-nom">Nom du propriétaire ou de l'occupant</Label>
              <Input
                id="claim-nom"
                className="h-11 text-base"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="claim-tel">Téléphone de contact</Label>
              <Input
                id="claim-tel"
                className="h-11 text-base"
                value={tel}
                onChange={(e) => setTel(e.target.value)}
                maxLength={30}
                placeholder="+224 ..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="claim-details">Justification</Label>
              <Textarea
                id="claim-details"
                className="text-base"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="Bail, facture, titre foncier, lien avec le lieu…"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="claim-fichier">Pièce justificative (photo ou PDF)</Label>
              <Input
                id="claim-fichier"
                type="file"
                className="h-11 text-base file:h-full"
                accept="image/*,application/pdf"
                onChange={(e) => setFichier(e.target.files?.[0] ?? null)}
              />
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                className="h-11 w-full sm:w-auto"
                onClick={() => onOpenChange(false)}
              >
                Annuler
              </Button>
              <Button
                className="h-11 w-full sm:w-auto"
                onClick={() => envoyer.mutate()}
                disabled={envoyer.isPending}
              >
                {envoyer.isPending ? "Envoi…" : "Envoyer la demande"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
