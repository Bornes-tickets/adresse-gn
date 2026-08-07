import { useState } from "react";
import { Link } from "@tanstack/react-router";
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
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface ReportSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  beaconId: string | null;
  number: string;
}

const RAISONS = [
  { value: "wrong_location", label: "Localisation incorrecte" },
  { value: "closed", label: "Lieu fermé ou inexistant" },
  { value: "damaged_beacon", label: "Balise abîmée ou illisible" },
  { value: "other", label: "Autre" },
];

export function ReportSheet({ open, onOpenChange, beaconId, number }: ReportSheetProps) {
  const { user, isAuthenticated } = useAuth();
  const [reason, setReason] = useState(RAISONS[0]!.value);
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
      toast.error("Signalement impossible : " + error.message);
      return;
    }
    toast.success("Merci, votre signalement a été transmis.");
    setDescription("");
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Flag className="size-5 text-destructive" />
            Signaler un problème
          </SheetTitle>
          <SheetDescription className="font-mono">{number}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-6">
          {!isAuthenticated ? (
            <>
              <p className="text-sm text-muted-foreground">
                Connectez-vous pour signaler un problème sur cette adresse.
              </p>
              <Button asChild size="lg">
                <Link to="/login">Se connecter</Link>
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
                placeholder="Détails (optionnel)"
                rows={3}
              />

              <Button size="lg" onClick={envoyer} disabled={envoi || !beaconId}>
                {envoi ? "Envoi…" : "Envoyer le signalement"}
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
