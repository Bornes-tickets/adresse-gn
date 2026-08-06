import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { statusLabel, statusTone } from "@/lib/admin";

export interface Colonne<T> {
  cle: string;
  entete: string;
  rendu: (ligne: T) => ReactNode;
  classe?: string;
}

interface Props<T> {
  colonnes: Colonne<T>[];
  lignes: T[];
  chargement?: boolean;
  vide?: string;
  page?: number;
  pageSize?: number;
  total?: number;
  onPage?: (page: number) => void;
  cle?: (ligne: T) => string;
}

/** Table admin générique avec pagination serveur. */
export function AdminTable<T extends Record<string, any>>({
  colonnes,
  lignes,
  chargement,
  vide = "Aucun résultat.",
  page = 1,
  pageSize = 20,
  total,
  onPage,
  cle,
}: Props<T>) {
  const pages = total != null ? Math.max(1, Math.ceil(total / pageSize)) : 1;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {colonnes.map((c) => (
                <TableHead key={c.cle} className={c.classe}>
                  {c.entete}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {chargement ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {colonnes.map((c) => (
                    <TableCell key={c.cle}>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : lignes.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={colonnes.length}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  {vide}
                </TableCell>
              </TableRow>
            ) : (
              lignes.map((ligne, i) => (
                <TableRow key={cle ? cle(ligne) : (ligne['id'] ?? i)}>
                  {colonnes.map((c) => (
                    <TableCell key={c.cle} className={c.classe}>
                      {c.rendu(ligne)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {total != null && onPage && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {total} résultat{total > 1 ? "s" : ""} — page {page} / {pages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPage(page - 1)}
            >
              Précédent
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pages}
              onClick={() => onPage(page + 1)}
            >
              Suivant
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Pastille de statut colorée. */
export function StatutBadge({ valeur }: { valeur: string | null | undefined }) {
  const ton = statusTone(valeur);
  const classe =
    ton === "ok"
      ? "bg-accent/15 text-accent border-accent/30"
      : ton === "warn"
        ? "bg-primary/10 text-primary border-primary/25"
        : ton === "bad"
          ? "bg-destructive/10 text-destructive border-destructive/25"
          : "bg-muted text-muted-foreground border-border";
  return (
    <Badge variant="outline" className={classe}>
      {statusLabel(valeur)}
    </Badge>
  );
}
