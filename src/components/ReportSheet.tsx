import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

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
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface ReportSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  beaconId: string | null;
  number: string;
}

const RAISON_VALUES = ["wrong_location", "closed", "damaged_beacon", "other"] as const;

export function ReportSheet({ open, onOpenChange, beaconId, number }: ReportSheetProps) {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  const RAISONS = [
    { value: "wrong_location", label: t("report.reasons.wrongLocation") },
    { value: "closed", label: t("report.reasons.closed") },
    { value: "damaged_beacon", label: t("report.reasons.damagedBeacon") },
    { value: "other", label: t("report.reasons.other") },
  ];
  const [reason, setReason] = useState<string>(RAISON_VALUES[0]);
  const [description, setDescription] = useState("");
  const [envoi, setEnvoi] = useState(false);

  const envoyer = async () => {
    if (!beaconId || !user) return;
    setEnvoi(true);
    const { error } = await supabase.from("reports").insert({
      beacon_id: beaconId,
      reporter_id: user.id,
      reason,
      description: description.trim() || null,
    });
    setEnvoi(false);
    if (error) {
      toast.error(t("report.failed", { error: error.message }));
      return;
    }
    toast.success(t("report.success"));
    setDescription("");
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Flag className="size-5 text-destructive" />
            {t("report.title")}
          </SheetTitle>
          <SheetDescription className="font-mono">{number}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-6">
          {!isAuthenticated ? (
            <>
              <p className="text-sm text-muted-foreground">
                {t("report.loginPrompt")}
              </p>
              <Button asChild size="lg">
                <Link to="/login">{t("report.login")}</Link>
              </Button>
            </>
          ) : (
            <>
              <RadioGroup value={reason} onValueChange={setReason} className="gap-3">
                {RAISONS.map((item) => (
                  <div key={item.value} className="flex items-center gap-2">
                    <RadioGroupItem value={item.value} id={`raison-${item.value}`} />
                    <Label htmlFor={`raison-${item.value}`}>{item.label}</Label>
                  </div>
                ))}
              </RadioGroup>

              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={t("report.detailsPlaceholder")}
                rows={3}
              />

              <Button size="lg" onClick={envoyer} disabled={envoi || !beaconId}>
                {envoi ? t("report.submitting") : t("report.submit")}
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
