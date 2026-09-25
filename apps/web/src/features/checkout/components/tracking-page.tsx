"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { loadTracking } from "../api";
import type { PublicTrackingOrder } from "../types";

export default function TrackingPage({
  token,
}: {
  token: string;
}) {
  const [data, setData] = useState<PublicTrackingOrder | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    loadTracking(token, controller.signal)
      .then(setData)
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Impossible de charger le suivi.",
          );
        }
      });

    return () => controller.abort();
  }, [token]);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <Card>
        <CardHeader>
          <CardTitle>Suivi de ma demande</CardTitle>
        </CardHeader>

        <CardContent>
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          {!data && !error && (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Chargement du suivi…
            </div>
          )}

          {data && (
            <div className="space-y-5">
              <div>
                <p className="text-sm text-muted-foreground">
                  Référence
                </p>
                <p className="text-xl font-semibold">
                  {data.order_ref}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Info label="Statut" value={data.status} />
                <Info
                  label="Formule"
                  value={data.formule_label ?? data.formule_code ?? "—"}
                />
                <Info label="Nom" value={data.full_name ?? "—"} />
                <Info label="Téléphone" value={data.phone ?? "—"} />
                <Info label="Adresse" value={data.address_line ?? "—"} />
                <Info
                  label="Installation"
                  value={data.installation_status ?? "—"}
                />
              </div>

              <Button variant="outline" asChild>
                <Link href="/">Retour à l’accueil</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg bg-muted/50 p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}
