/** Rendu léger d'un contenu CMS (paragraphes, titres, listes, séparateurs). */
import { useMemo } from "react";

import { cn } from "@/lib/utils";

function inline(texte: string) {
  // Gras **texte** uniquement, pour rester simple et sûr.
  const morceaux = texte.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return morceaux.map((morceau, index) =>
    morceau.startsWith("**") && morceau.endsWith("**") ? (
      <strong key={index} className="font-semibold text-foreground">
        {morceau.slice(2, -2)}
      </strong>
    ) : (
      <span key={index}>{morceau}</span>
    ),
  );
}

export function CmsRichText({
  contenu,
  className,
}: {
  contenu: string;
  className?: string;
}) {
  const blocs = useMemo(
    () =>
      contenu
        .replace(/\r\n/g, "\n")
        .split(/\n{2,}/)
        .map((b) => b.trim())
        .filter(Boolean),
    [contenu],
  );

  return (
    <div className={cn("space-y-5 text-base leading-relaxed text-slate-600", className)}>
      {blocs.map((bloc, index) => {
        if (/^###\s+/.test(bloc)) {
          return (
            <h3
              key={index}
              className="text-display pt-2 text-lg font-bold text-foreground"
            >
              {inline(bloc.replace(/^###\s+/, ""))}
            </h3>
          );
        }
        if (/^##\s+/.test(bloc)) {
          return (
            <h2
              key={index}
              className="text-display pt-4 text-2xl font-extrabold text-foreground"
            >
              {inline(bloc.replace(/^##\s+/, ""))}
            </h2>
          );
        }
        if (/^(-{3,}|\*{3,})$/.test(bloc)) {
          return <hr key={index} className="border-slate-200/70" />;
        }
        const lignes = bloc.split("\n").map((l) => l.trim());
        if (lignes.every((l) => /^[-*•]\s+/.test(l))) {
          return (
            <ul key={index} className="list-disc space-y-2 ps-6">
              {lignes.map((ligne, i) => (
                <li key={i}>{inline(ligne.replace(/^[-*•]\s+/, ""))}</li>
              ))}
            </ul>
          );
        }
        if (lignes.every((l) => /^\d+[.)]\s+/.test(l))) {
          return (
            <ol key={index} className="list-decimal space-y-2 ps-6">
              {lignes.map((ligne, i) => (
                <li key={i}>{inline(ligne.replace(/^\d+[.)]\s+/, ""))}</li>
              ))}
            </ol>
          );
        }
        return <p key={index}>{inline(bloc)}</p>;
      })}
    </div>
  );
}
