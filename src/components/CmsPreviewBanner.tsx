/** Bandeau d'aperçu admin : rappelle que le contenu n'est pas public. */
import { Link } from "@tanstack/react-router";
import { Eye } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { CMS_STATUS_LABELS } from "@/lib/cms";

export function CmsPreviewBanner({
  statut,
  retour,
}: {
  statut?: string | null;
  retour: string;
}) {
  return (
    <div className="sticky top-0 z-40 border-b border-amber-300/60 bg-amber-50 px-4 py-3 text-amber-900 sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 text-sm">
        <Eye className="size-4 shrink-0" aria-hidden="true" />
        <span className="font-medium">Mode aperçu administrateur</span>
        {statut && (
          <Badge variant="outline" className="border-amber-400/60 bg-white/60 text-amber-900">
            {CMS_STATUS_LABELS[statut] ?? statut}
          </Badge>
        )}
        <span className="text-amber-800/80">
          Ce contenu n'est pas visible par le public tant qu'il n'est pas publié.
        </span>
        <Link to={retour} className="ms-auto font-medium underline">
          Retour au back-office
        </Link>
      </div>
    </div>
  );
}

export function CmsPreviewEtat({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6">
      <p className="text-slate-500">{message}</p>
    </div>
  );
}
