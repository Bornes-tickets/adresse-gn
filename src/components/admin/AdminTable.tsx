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

/** Table admin générique avec pagination serveur : table dès md, cartes empilées en mobile. */
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
      {/* Vue tableau (md et plus) */}
      <div className="hidden overflow-x-auto rounded-lg border border-border bg-card md:block">
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

      {/* Vue cartes (mobile, sous md) */}
      <div className="space-y-3 md:hidden">
        {chargement ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-border bg-card p-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ))
        ) : lignes.length === 0 ? (
          <div className="rounded-lg border border-border bg-card py-10 text-center text-sm text-muted-foreground">
            {vide}
          </div>
        ) : (
          lignes.map((ligne, i) => (
            <div
              key={cle ? cle(ligne) : (ligne['id'] ?? i)}
              className="space-y-2 rounded-lg border border-border bg-card p-4"
            >
              {colonnes.map((c) => (
                <div key={c.cle} className="flex items-start justify-between gap-3 text-sm">
                  <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {c.entete}
                  </span>
                  <span className="min-w-0 flex-1 break-words text-right text-foreground">
                    {c.rendu(ligne)}
                  </span>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {total != null && onPage && (
        <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground sm:flex-row sm:justify-between">
          <span>
            {total} résultat{total > 1 ? "s" : ""} — page {page} / {pages}
          </span>
          <div className="flex w-full gap-2 sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-none"
              disabled={page <= 1}
              onClick={() => onPage(page - 1)}
            >
              Précédent
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-none"
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
