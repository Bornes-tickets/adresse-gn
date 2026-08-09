/** Statut CMS sous forme de badge coloré. */
import { Badge } from "@/components/ui/badge";
import { CMS_STATUS_LABELS } from "@/lib/cms";
import { cn } from "@/lib/utils";

const TONS: Record<string, string> = {
  published: "bg-admin-green/12 text-admin-green border-admin-green/25",
  draft: "bg-admin-amber/12 text-admin-amber border-admin-amber/25",
  archived: "bg-admin-slate/12 text-admin-slate border-admin-slate/25",
};

export function BadgeStatutCms({ statut }: { statut: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", TONS[statut] ?? TONS['archived'])}>
      {CMS_STATUS_LABELS[statut] ?? statut}
    </Badge>
  );
}
