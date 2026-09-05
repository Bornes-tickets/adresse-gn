"use client";

import Link from "next/link";
import {
  useState,
} from "react";
import { Flag } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import {
  Textarea,
} from "@/components/ui/textarea";

import {
  createAddressReport,
  type ReportReason,
} from "@/features/reports/api";

import {
  useAuth,
} from "@/hooks/useAuth";


interface ReportSheetProps {
  open: boolean;

  onOpenChange:
    (open: boolean) => void;

  beaconId: string | null;

  number: string;
}


const REASONS:
  Array<{
    value: ReportReason;
    label: string;
  }> = [
    {
      value:
        "wrong_location",

      label:
        "Localisation incorrecte",
    },

    {
      value:
        "closed",

      label:
        "Lieu fermé ou inexistant",
    },

    {
      value:
        "damaged_beacon",

      label:
        "Balise abîmée ou illisible",
    },

    {
      value:
        "other",

      label:
        "Autre",
    },
  ];


export function ReportSheet({
  open,
  onOpenChange,
  beaconId,
  number,
}: ReportSheetProps) {
  const {
    isAuthenticated,
  } =
    useAuth();


  const [
    reason,
    setReason,
  ] =
    useState<ReportReason>(
      "wrong_location",
    );


  const [
    description,
    setDescription,
  ] =
    useState("");


  const [
    submitting,
    setSubmitting,
  ] =
    useState(false);


  async function sendReport() {
    if (
      !beaconId ||
      !isAuthenticated ||
      submitting
    ) {
      return;
    }


    setSubmitting(true);


    try {
      await createAddressReport(
        number,
        reason,
        description,
      );


      toast.success(
        "Merci, votre signalement a été transmis.",
      );


      setDescription("");


      onOpenChange(
        false,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Une erreur est survenue.";


      toast.error(
        `Signalement impossible : ${message}`,
      );
    } finally {
      setSubmitting(false);
    }
  }


  const returnTo =
    `/a/${encodeURIComponent(number)}`;


  const loginHref =
    `/login?returnTo=${encodeURIComponent(returnTo)}`;


  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
    >
      <SheetContent
        side="bottom"
        className="max-h-[85dvh] overflow-y-auto rounded-t-2xl"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Flag className="size-5 text-destructive" />

            Signaler un problème
          </SheetTitle>

          <SheetDescription className="font-mono">
            {number}
          </SheetDescription>
        </SheetHeader>


        <div className="flex flex-col gap-4 px-4 pb-6">
          {!isAuthenticated ? (
            <>
              <p className="text-sm text-muted-foreground">
                Connectez-vous pour signaler un problème sur cette adresse.
              </p>

              <Button
                asChild
                size="lg"
              >
                <Link
                  href={loginHref}
                >
                  Se connecter
                </Link>
              </Button>
            </>
          ) : (
            <>
              <RadioGroup
                value={reason}
                onValueChange={(
                  value,
                ) => {
                  setReason(
                    value as ReportReason,
                  );
                }}
                className="gap-3"
              >
                {REASONS.map(
                  (item) => (
                    <div
                      key={
                        item.value
                      }
                      className="flex items-center gap-2"
                    >
                      <RadioGroupItem
                        value={
                          item.value
                        }
                        id={
                          `raison-${item.value}`
                        }
                      />

                      <Label
                        htmlFor={
                          `raison-${item.value}`
                        }
                      >
                        {
                          item.label
                        }
                      </Label>
                    </div>
                  ),
                )}
              </RadioGroup>


              <Textarea
                value={description}
                onChange={(
                  event,
                ) => {
                  setDescription(
                    event.target.value,
                  );
                }}
                placeholder="Détails (optionnel)"
                rows={3}
              />


              <Button
                size="lg"
                onClick={
                  sendReport
                }
                disabled={
                  submitting ||
                  !beaconId
                }
              >
                {
                  submitting
                    ? "Envoi…"
                    : "Envoyer le signalement"
                }
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}