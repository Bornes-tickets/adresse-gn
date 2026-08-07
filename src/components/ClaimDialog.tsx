import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

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

async function fichierEnBase64(fichier: File, fileReadError: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resolve(String(lecteur.result));
    lecteur.onerror = () => reject(new Error(fileReadError));
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
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [nom, setNom] = useState("");
  const [tel, setTel] = useState("");
  const [details, setDetails] = useState("");
  const [fichier, setFichier] = useState<File | null>(null);

  const envoyer = useMutation({
    mutationFn: async () => {
      const base64 = fichier ? await fichierEnBase64(fichier, t("claim.fileReadError")) : null;
      const explication = [
        nom.trim() ? t("claim.declaredOwner", { name: nom.trim() }) : "",
        tel.trim() ? t("claim.phoneLabel", { phone: tel.trim() }) : "",
        details.trim(),
      ]
        .filter(Boolean)
        .join("\n");
      return createClaim({
        data: { number, explanation: explication, photoBase64: base64 },
      });
    },

    onSuccess: () => {
      toast.success(t("claim.success"));
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
            {t("claim.title")}
          </DialogTitle>
          <DialogDescription className="font-mono">{number}</DialogDescription>
        </DialogHeader>

        {isMine ? (
          <p className="text-sm text-muted-foreground">
            {t("claim.alreadyMine")}{" "}
            <Link to="/mon-compte/beacons" className="text-primary underline">
              {t("claim.manageBeacons")}
            </Link>
          </p>
        ) : !isAuthenticated ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("claim.loginPrompt")}
            </p>
            <Button asChild size="lg" className="w-full">
              <Link to="/login">{t("claim.login")}</Link>
            </Button>
          </div>
        ) : claimStatus === "pending" ? (
          <p className="text-sm text-muted-foreground">
            {t("claim.underReview", { status: CLAIM_STATUS_LABELS['pending'] })}
          </p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="claim-nom">{t("claim.ownerName")}</Label>
              <Input
                id="claim-nom"
                className="h-11 text-base"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="claim-tel">{t("claim.phone")}</Label>
              <Input
                id="claim-tel"
                className="h-11 text-base"
                value={tel}
                onChange={(e) => setTel(e.target.value)}
                maxLength={30}
                placeholder={t("claim.phonePlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="claim-details">{t("claim.justification")}</Label>
              <Textarea
                id="claim-details"
                className="text-base"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder={t("claim.justificationPlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="claim-fichier">{t("claim.proofFile")}</Label>
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
                {t("claim.cancel")}
              </Button>
              <Button
                className="h-11 w-full sm:w-auto"
                onClick={() => envoyer.mutate()}
                disabled={envoyer.isPending}
              >
                {envoyer.isPending ? t("claim.submitting") : t("claim.submit")}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
