/** Champs de saisie multilingues (fr / en / ar) pour le module CMS. */
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { LANGUES, LANGUE_LABELS, type Langue, type Multi } from "@/lib/cms";

interface Props {
  label: string;
  valeur: Multi;
  onChange: (valeur: Multi) => void;
  multiligne?: boolean;
  lignes?: number;
  placeholder?: string;
}

export function ChampsMultilingues({
  label,
  valeur,
  onChange,
  multiligne,
  lignes = 6,
  placeholder,
}: Props) {
  const maj = (langue: Langue, texte: string) => onChange({ ...valeur, [langue]: texte });

  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      <Tabs defaultValue="fr">
        <TabsList className="h-8">
          {LANGUES.map((l) => (
            <TabsTrigger key={l} value={l} className="text-xs">
              {LANGUE_LABELS[l]}
              {valeur[l] ? <span className="ml-1 text-admin-green">•</span> : null}
            </TabsTrigger>
          ))}
        </TabsList>
        {LANGUES.map((l) => (
          <TabsContent key={l} value={l} className="mt-2">
            {multiligne ? (
              <Textarea
                dir={l === "ar" ? "rtl" : "ltr"}
                rows={lignes}
                value={valeur[l] ?? ""}
                placeholder={placeholder}
                onChange={(e) => maj(l, e.target.value)}
              />
            ) : (
              <Input
                dir={l === "ar" ? "rtl" : "ltr"}
                value={valeur[l] ?? ""}
                placeholder={placeholder}
                onChange={(e) => maj(l, e.target.value)}
              />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
