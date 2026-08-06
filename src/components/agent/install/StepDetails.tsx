import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORY_LABELS, isCommercialCategory } from "@/lib/geo";
import type { InstallDetails } from "@/components/agent/install/types";

interface Props {
  details: InstallDetails;
  onChange: (details: InstallDetails) => void;
}

/** Étape 4 — détails de l'adresse et consentement du propriétaire. */
export function StepDetails({ details, onChange }: Props) {
  const set = <K extends keyof InstallDetails>(cle: K, valeur: InstallDetails[K]) =>
    onChange({ ...details, [cle]: valeur });

  const nomRequis = isCommercialCategory(details.category);

  return (
    <Card>
      <CardContent className="space-y-5 py-6">
        <div className="space-y-2">
          <Label>Catégorie prévue</Label>
          <Select value={details.category} onValueChange={(v) => set("category", v)}>
            <SelectTrigger className="h-12">
              <SelectValue placeholder="Choisir une catégorie" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CATEGORY_LABELS).map(([valeur, label]) => (
                <SelectItem key={valeur} value={valeur}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="nom-lieu">Nom du lieu {nomRequis ? "(requis)" : "(optionnel)"}</Label>
          <Input
            id="nom-lieu"
            className="h-12"
            value={details.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder={nomRequis ? "Ex : Pharmacie du Port" : "Ex : Maison Camara"}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="point-acces">Point d'accès</Label>
          <Textarea
            id="point-acces"
            rows={3}
            value={details.access_point_note}
            onChange={(e) => set("access_point_note", e.target.value)}
            placeholder="Ex : Portail bleu à droite du bâtiment"
          />
        </div>

        <div className="space-y-2">
          <Label>Visibilité</Label>
          <RadioGroup
            value={details.visibility}
            onValueChange={(v) => set("visibility", v as InstallDetails["visibility"])}
            className="gap-3"
          >
            <div className="flex items-center gap-3">
              <RadioGroupItem value="private" id="vis-privee" />
              <Label htmlFor="vis-privee" className="font-normal">
                Privée
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <RadioGroupItem value="public" id="vis-publique" />
              <Label htmlFor="vis-publique" className="font-normal">
                Publique
              </Label>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label htmlFor="prop-nom">Nom du propriétaire / responsable</Label>
          <Input
            id="prop-nom"
            className="h-12"
            value={details.owner_name}
            onChange={(e) => set("owner_name", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="prop-tel">Téléphone du propriétaire / responsable</Label>
          <Input
            id="prop-tel"
            type="tel"
            inputMode="tel"
            className="h-12"
            value={details.owner_phone}
            onChange={(e) => set("owner_phone", e.target.value)}
            placeholder="+224 6XX XX XX XX"
          />
        </div>

        <div className="flex items-start gap-3 rounded-md border border-border p-3">
          <Checkbox
            id="consentement"
            checked={details.consent}
            onCheckedChange={(v) => set("consent", v === true)}
            className="mt-0.5"
          />
          <Label htmlFor="consentement" className="text-sm font-normal leading-snug">
            Le propriétaire consent à l'enregistrement de cette adresse et a été informé de la
            politique de confidentialité.
          </Label>
        </div>
      </CardContent>
    </Card>
  );
}
