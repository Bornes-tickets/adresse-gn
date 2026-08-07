import { Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { categoryLabel } from "@/lib/geo";
import { moyenne, type InstallMeasure } from "@/lib/install";
import type { InstallDetails } from "@/components/agent/install/types";

interface Props {
  numero: string;
  mesures: InstallMeasure[];
  photo: string | null;
  details: InstallDetails;
  onModifier: (etape: number) => void;
}

function Section({
  titre,
  etape,
  onModifier,
  children,
}: {
  titre: string;
  etape: number;
  onModifier: (etape: number) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2 border-b border-border pb-4 last:border-0 last:pb-0">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">{titre}</h2>
        <Button size="sm" variant="ghost" onClick={() => onModifier(etape)}>
          <Pencil className="size-3.5" />
          Modifier
        </Button>
      </div>
      {children}
    </div>
  );
}

function Ligne({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-right font-medium text-foreground">{valeur}</span>
    </div>
  );
}

/** Étape 5 — récapitulatif avant enregistrement. */
export function StepSummary({ numero, mesures, photo, details, onModifier }: Props) {
  const lat = moyenne(mesures.map((m) => m.lat));
  const lng = moyenne(mesures.map((m) => m.lng));
  const precision = moyenne(mesures.map((m) => m.accuracy_m));

  return (
    <Card>
      <CardContent className="space-y-4 py-6">
        <Section titre="Balise" etape={1} onModifier={onModifier}>
          <p className="font-mono text-lg font-bold text-foreground">{numero}</p>
        </Section>

        <Section titre="Position" etape={2} onModifier={onModifier}>
          <Ligne label="Latitude" valeur={lat.toFixed(6)} />
          <Ligne label="Longitude" valeur={lng.toFixed(6)} />
          <Ligne label="Précision moyenne" valeur={`± ${Math.round(precision)} m`} />
        </Section>

        <Section titre="Photo" etape={3} onModifier={onModifier}>
          {photo ? (
            <img
              src={photo}
              alt="Entrée de l'adresse"
              className="size-24 rounded-md border border-border object-cover"
            />
          ) : (
            <p className="text-sm text-destructive">Photo manquante</p>
          )}
        </Section>

        <Section titre="Détails" etape={4} onModifier={onModifier}>
          <Ligne label="Catégorie" valeur={categoryLabel(details.category)} />
          <Ligne label="Nom du lieu" valeur={details.name || "—"} />
          <Ligne
            label="Visibilité"
            valeur={details.visibility === "public" ? "Publique" : "Privée"}
          />
          <Ligne label="Point d'accès" valeur={details.access_point_note || "—"} />
          <Ligne label="Propriétaire" valeur={details.owner_name || "—"} />
          <Ligne label="Téléphone" valeur={details.owner_phone || "—"} />
          <div className="pt-2">
            <Badge variant={details.consent ? "default" : "destructive"}>
              {details.consent ? "Consentement obtenu" : "Consentement manquant"}
            </Badge>
          </div>
        </Section>
      </CardContent>
    </Card>
  );
}
