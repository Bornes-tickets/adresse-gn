"use client";

import {
  ArrowRight,
  BadgeCheck,
  CircleAlert,
  Loader2,
  MapPin,
  Search,
} from "lucide-react";
import {
  FormEvent,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { searchAddress } from "@/features/addresses/api";
import type {
  AddressSearchResponse,
  BeaconResult,
} from "@/features/addresses/types";


function displayName(
  result: BeaconResult,
): string {
  if (result.business_name) {
    return result.business_name;
  }

  if (result.name) {
    return result.name;
  }

  return "Adresse GN";
}


export function AddressSearchForm() {
  const [number, setNumber] =
    useState("");

  const [response, setResponse] =
    useState<AddressSearchResponse | null>(
      null,
    );

  const [loading, setLoading] =
    useState(false);

  const [networkError, setNetworkError] =
    useState<string | null>(null);

  const abortControllerRef =
    useRef<AbortController | null>(
      null,
    );


  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const value =
      number.trim();

    if (!value) {
      setResponse({
        status: "invalid",
        beacon_id: null,
        result: null,
        message:
          "Saisissez un numéro Adresse GN.",
      });

      return;
    }

    abortControllerRef.current?.abort();

    const controller =
      new AbortController();

    abortControllerRef.current =
      controller;

    setLoading(true);
    setResponse(null);
    setNetworkError(null);

    try {
      const result =
        await searchAddress(
          value,
          controller.signal,
        );

      setResponse(result);

      if (
        result.status === "found" &&
        result.result
      ) {
        setNumber(
          result.result.public_number,
        );
      }
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        return;
      }

      setNetworkError(
        error instanceof Error
          ? error.message
          : "Impossible d'effectuer la recherche.",
      );
    } finally {
      if (
        abortControllerRef.current ===
        controller
      ) {
        setLoading(false);
      }
    }
  }


  const found =
    response?.status === "found" &&
    response.result
      ? response.result
      : null;


  return (
    <div className="w-full max-w-2xl">
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-white/35 bg-white/95 p-2 shadow-xl shadow-primary/10 backdrop-blur"
      >
        <div className="flex items-center gap-2">
          <div className="hidden pl-3 text-muted-foreground sm:block">
            <Search className="size-5" />
          </div>

          <Input
            value={number}
            onChange={(event) => {
              setNumber(
                event.target.value,
              );

              if (response) {
                setResponse(null);
              }

              if (networkError) {
                setNetworkError(null);
              }
            }}
            placeholder="Ex. GN-CKY-582741 ou 582741"
            aria-label="Numéro Adresse GN"
            autoComplete="off"
            spellCheck={false}
            className="h-12 border-0 bg-transparent text-base shadow-none focus-visible:ring-0 sm:text-base"
          />

          <Button
            type="submit"
            disabled={loading}
            className="h-11 shrink-0 gap-2 px-5"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span className="hidden sm:inline">
                  Recherche
                </span>
              </>
            ) : (
              <>
                <span className="hidden sm:inline">
                  Trouver
                </span>

                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </div>
      </form>


      <p className="mt-3 text-sm text-white/70">
        Entrez votre numéro Adresse GN
        complet ou simplement ses
        6 chiffres.
      </p>


      {networkError && (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-left text-sm text-red-800">
          <CircleAlert className="mt-0.5 size-5 shrink-0" />

          <div>
            <p className="font-semibold">
              Service momentanément indisponible
            </p>

            <p className="mt-1">
              {networkError}
            </p>
          </div>
        </div>
      )}


      {response &&
        response.status !== "found" && (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-left text-sm text-amber-900">
            <CircleAlert className="mt-0.5 size-5 shrink-0" />

            <div>
              <p className="font-semibold">
                {response.status ===
                "not_found"
                  ? "Adresse introuvable"
                  : response.status ===
                      "rate_limited"
                    ? "Trop de recherches"
                    : "Numéro invalide"}
              </p>

              <p className="mt-1">
                {response.message ??
                  "Impossible d'effectuer cette recherche."}
              </p>
            </div>
          </div>
        )}


      {found && (
        <div className="mt-5 overflow-hidden rounded-2xl border border-emerald-200 bg-white text-left shadow-xl shadow-primary/10">
          <div className="border-b border-border bg-emerald-50/70 px-5 py-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
              <BadgeCheck className="size-5" />

              Adresse trouvée
            </div>
          </div>

          <div className="p-5">
            <p className="font-mono text-sm font-bold tracking-wide text-primary">
              {found.public_number}
            </p>

            <h2 className="mt-2 text-xl font-bold tracking-tight text-foreground">
              {displayName(found)}
            </h2>

            <div className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 size-4 shrink-0" />

              <span>
                {found.access_point_note ??
                  "Position géographique disponible"}
              </span>
            </div>

            {found.description && (
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                {found.description}
              </p>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                {found.category}
              </span>

              {found.verification_level ===
                "verified" && (
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
                  Adresse vérifiée
                </span>
              )}
            </div>

            {found.lat !== null &&
              found.lng !== null && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${found.lat},${found.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
                >
                  <MapPin className="size-4" />

                  Ouvrir l’itinéraire

                  <ArrowRight className="size-4" />
                </a>
              )}
          </div>
        </div>
      )}
    </div>
  );
}