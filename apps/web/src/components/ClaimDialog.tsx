"use client";

import Link from "next/link";
import {
  useState,
} from "react";

import {
  ShieldCheck,
} from "lucide-react";

import {
  toast,
} from "sonner";

import {
  Button,
} from "@/components/ui/button";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  Input,
} from "@/components/ui/input";

import {
  Label,
} from "@/components/ui/label";

import {
  Textarea,
} from "@/components/ui/textarea";

import {
  createAddressClaim,
  type ClaimStatus,
} from "@/features/claims/api";

import {
  useAuth,
} from "@/hooks/useAuth";


interface ClaimDialogProps {
  open: boolean;

  onOpenChange:
    (open: boolean) => void;

  number: string;

  claimStatus: ClaimStatus;

  isMine: boolean;

  onClaimCreated?: () => void;
}


export function ClaimDialog({
  open,
  onOpenChange,
  number,
  claimStatus,
  isMine,
  onClaimCreated,
}: ClaimDialogProps) {
  const {
    isAuthenticated,
  } =
    useAuth();

  const [
    nom,
    setNom,
  ] =
    useState("");

  const [
    tel,
    setTel,
  ] =
    useState("");

  const [
    details,
    setDetails,
  ] =
    useState("");

  const [
    fichier,
    setFichier,
  ] =
    useState<File | null>(
      null,
    );

  const [
    submitting,
    setSubmitting,
  ] =
    useState(false);


  const returnTo =
    `/a/${encodeURIComponent(number)}`;

  const loginHref =
    `/login?returnTo=${encodeURIComponent(returnTo)}`;


  async function envoyer() {
    if (
      !isAuthenticated ||
      submitting
    ) {
      return;
    }

    setSubmitting(true);

    try {
      await createAddressClaim(
        number,
        {
          ownerName: nom,
          phone: tel,
          details,
          evidenceFile: fichier,
        },
      );

      toast.success(
        "Demande envoyée. Notre équipe vérifie sous 48 h.",
      );

      setDetails("");
      setFichier(null);

      onClaimCreated?.();

      onOpenChange(
        false,
      );

    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : (
              "Impossible d'envoyer "
              + "la demande."
            ),
      );

    } finally {
      setSubmitting(false);
    }
  }


  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto sm:w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />

            Réclamer cette adresse
          </DialogTitle>

          <DialogDescription className="font-mono">
            {number}
          </DialogDescription>
        </DialogHeader>


        {isMine ? (
          <p className="text-sm text-muted-foreground">
            Cette adresse vous appartient déjà.{" "}

            <Link
              href="/mon-compte/beacons"
              className="text-primary underline"
            >
              Gérer mes balises
            </Link>
          </p>

        ) : !isAuthenticated ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Connectez-vous pour déclarer que ce lieu est le vôtre.
            </p>

            <Button
              asChild
              size="lg"
              className="w-full"
            >
              <Link
                href={loginHref}
              >
                Se connecter
              </Link>
            </Button>
          </div>

        ) : claimStatus === "pending" ? (
          <p className="text-sm text-muted-foreground">
            Votre demande est en cours d'examen (En attente).
          </p>

        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="claim-nom">
                Nom du propriétaire ou de l'occupant
              </Label>

              <Input
                id="claim-nom"
                className="h-11 text-base"
                value={nom}
                onChange={(event) =>
                  setNom(
                    event.target.value,
                  )
                }
                maxLength={120}
              />
            </div>


            <div className="space-y-2">
              <Label htmlFor="claim-tel">
                Téléphone de contact
              </Label>

              <Input
                id="claim-tel"
                className="h-11 text-base"
                value={tel}
                onChange={(event) =>
                  setTel(
                    event.target.value,
                  )
                }
                maxLength={30}
                placeholder="+224 ..."
              />
            </div>


            <div className="space-y-2">
              <Label htmlFor="claim-details">
                Justification
              </Label>

              <Textarea
                id="claim-details"
                className="text-base"
                value={details}
                onChange={(event) =>
                  setDetails(
                    event.target.value,
                  )
                }
                rows={3}
                maxLength={1000}
                placeholder="Bail, facture, titre foncier, lien avec le lieu…"
              />
            </div>


            <div className="space-y-2">
              <Label htmlFor="claim-fichier">
                Pièce justificative (photo ou PDF)
              </Label>

              <Input
                id="claim-fichier"
                type="file"
                className="h-11 text-base file:h-full"
                accept="image/*,application/pdf"
                onChange={(event) =>
                  setFichier(
                    event.target.files?.[0]
                    ?? null,
                  )
                }
              />
            </div>


            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                className="h-11 w-full sm:w-auto"
                onClick={() =>
                  onOpenChange(false)
                }
              >
                Annuler
              </Button>

              <Button
                className="h-11 w-full sm:w-auto"
                onClick={envoyer}
                disabled={submitting}
              >
                {
                  submitting
                    ? "Envoi…"
                    : "Envoyer la demande"
                }
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}