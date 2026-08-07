import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Loader2, Save } from "lucide-react";

import {
  InstallError,
  InstallSuccess,
  InstallSuccessLocal,
} from "@/components/agent/install/InstallResultScreens";
import { StepBeacon } from "@/components/agent/install/StepBeacon";
import { StepDetails } from "@/components/agent/install/StepDetails";
import { StepGps } from "@/components/agent/install/StepGps";
import { StepIndicator } from "@/components/agent/install/StepIndicator";
import { StepPhoto } from "@/components/agent/install/StepPhoto";
import { StepSummary } from "@/components/agent/install/StepSummary";
import { DETAILS_VIDES, type InstallDetails } from "@/components/agent/install/types";
import { Button } from "@/components/ui/button";
import { useOnline } from "@/hooks/useOnline";
import { enfilerInstallation } from "@/lib/agent-db";
import { syncQueue } from "@/lib/agent-sync";
import { dataUrlVersBlob } from "@/lib/install";
import { isCommercialCategory } from "@/lib/geo";
import type { InstallMeasure } from "@/lib/install";
import { submitInstallation } from "@/lib/install.functions";

export const Route = createFileRoute("/agent/_guard/install/$number")({
  component: Install,
});

/** Brouillon persistant : survit à un remount (retour de l'appareil photo, refresh du jeton). */
interface Brouillon {
  etape: number;
  baliseOk: boolean;
  mesures: InstallMeasure[];
  photo: string | null;
  details: InstallDetails;
  clientUuid: string;
}

function lireBrouillon(numero: string): Brouillon | null {
  if (typeof window === "undefined") return null;
  try {
    const brut = window.sessionStorage.getItem(`install-draft:${numero}`);
    return brut ? (JSON.parse(brut) as Brouillon) : null;
  } catch {
    return null;
  }
}

function Install() {
  const { number } = Route.useParams();
  const numero = number.toUpperCase();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const enregistrer = useServerFn(submitInstallation);
  const isOnline = useOnline();

  const brouillon = useRef<Brouillon | null>(lireBrouillon(numero));
  const [etape, setEtape] = useState(brouillon.current?.etape ?? 1);
  const [baliseOk, setBaliseOk] = useState(brouillon.current?.baliseOk ?? false);
  const [mesures, setMesures] = useState<InstallMeasure[]>(brouillon.current?.mesures ?? []);
  const [photo, setPhoto] = useState<string | null>(brouillon.current?.photo ?? null);
  const [details, setDetails] = useState<InstallDetails>(
    brouillon.current?.details ?? DETAILS_VIDES,
  );
  const [envoi, setEnvoi] = useState(false);
  const [resultat, setResultat] = useState<"succes" | "local" | string | null>(null);
  const clientUuid = useRef<string>(brouillon.current?.clientUuid ?? crypto.randomUUID());

  // Sauvegarde du brouillon à chaque changement (aucun reset intempestif du formulaire).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(
        `install-draft:${numero}`,
        JSON.stringify({
          etape,
          baliseOk,
          mesures,
          photo,
          details,
          clientUuid: clientUuid.current,
        } satisfies Brouillon),
      );
    } catch {
      /* quota dépassé : le formulaire reste utilisable en mémoire */
    }
  }, [numero, etape, baliseOk, mesures, photo, details]);

  const viderBrouillon = () => {
    try {
      window.sessionStorage.removeItem(`install-draft:${numero}`);
    } catch {
      /* ignoré */
    }
  };

  const detailsValides =
    details.consent &&
    details.category.length > 0 &&
    (!isCommercialCategory(details.category) || details.name.trim().length > 0);

  const peutContinuer =
    (etape === 1 && baliseOk) ||
    (etape === 2 && mesures.length === 3) ||
    (etape === 3 && !!photo) ||
    (etape === 4 && detailsValides);


  const enfiler = async () => {
    await enfilerInstallation({
      client_uuid: clientUuid.current,
      beacon_number: numero,
      measures: mesures,
      photo_blob: photo ? dataUrlVersBlob(photo) : null,
      category: details.category,
      name: details.name.trim() || null,
      visibility: details.visibility,
      access_point_note: details.access_point_note.trim() || null,
      owner_name: details.owner_name.trim() || null,
      owner_phone: details.owner_phone.trim() || null,
      consent: true,
      created_at: new Date().toISOString(),
    });
    viderBrouillon();
    setResultat("local");
  };


  const envoyer = async () => {
    console.log("Bouton validation cliqué");
    console.log("Photo state:", photo ? `présente (${photo.length} car.)` : "ABSENTE");
    console.log("Mesures:", mesures.length, "En ligne:", isOnline);
    setEnvoi(true);
    try {
      if (!isOnline) {
        console.log("Hors ligne → mise en file locale");
        await enfiler();
        return;
      }
      console.log("Avant upload");
      const reponse = await enregistrer({
        data: {
          beacon_number: numero,
          measures: mesures,
          photo_base64: photo ?? "",
          category: details.category,
          name: details.name.trim() || null,
          visibility: details.visibility,
          access_point_note: details.access_point_note.trim() || null,
          owner_name: details.owner_name.trim() || null,
          owner_phone: details.owner_phone.trim() || null,
          consent: true,
          client_uuid: clientUuid.current,
        },
      });
      console.log("Après upload", reponse);
      if (reponse.success) {
        viderBrouillon();
        await queryClient.invalidateQueries({ queryKey: ["agent-tasks"] });
        await queryClient.invalidateQueries({ queryKey: ["agent-history"] });
        setResultat("succes");
      } else {
        setResultat(reponse.message ?? "Erreur inconnue.");
      }
    } catch (erreur) {
      // Panne réseau pendant l'envoi : bascule automatique en file locale.
      console.error("Échec de l'envoi, bascule hors ligne", erreur);
      await enfiler();
      void syncQueue();
    } finally {
      setEnvoi(false);
    }
  };


  const allerAuxTaches = () => {
    console.log("Avant navigate", "/agent/tasks");
    navigate({ to: "/agent/tasks", replace: true });
  };

  if (resultat === "succes") {
    return <InstallSuccess numero={numero} onSuivante={allerAuxTaches} />;
  }

  if (resultat === "local") {
    return <InstallSuccessLocal numero={numero} onSuivante={allerAuxTaches} />;
  }


  if (resultat) {
    return <InstallError message={resultat} onReessayer={() => setResultat(null)} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Button
          size="icon"
          variant="ghost"
          aria-label="Retour aux tâches"
          onClick={() => navigate({ to: "/agent/tasks" })}
        >
          <ArrowLeft className="size-5" />
        </Button>
        <h1 className="text-lg font-bold text-foreground">Installation</h1>
      </div>

      <StepIndicator etape={etape} />

      {etape === 1 && (
        <StepBeacon attendu={numero} confirme={baliseOk} onConfirme={() => setBaliseOk(true)} />
      )}
      {etape === 2 && <StepGps mesures={mesures} onMesures={setMesures} />}
      {etape === 3 && <StepPhoto photo={photo} onPhoto={setPhoto} />}
      {etape === 4 && <StepDetails details={details} onChange={setDetails} />}
      {etape === 5 && (
        <StepSummary
          numero={numero}
          mesures={mesures}
          photo={photo}
          details={details}
          onModifier={setEtape}
        />
      )}

      <div className="flex gap-3">
        {etape > 1 && (
          <Button
            size="lg"
            variant="outline"
            className="h-12 flex-1"
            onClick={() => setEtape(etape - 1)}
          >
            Retour
          </Button>
        )}
        {etape < 5 ? (
          <Button
            size="lg"
            className="h-12 flex-1"
            disabled={!peutContinuer}
            onClick={() => setEtape(etape + 1)}
          >
            Continuer
            <ArrowRight className="size-5" />
          </Button>
        ) : (
          <Button
            size="lg"
            className="h-12 flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
            disabled={envoi || !detailsValides || mesures.length !== 3 || !photo}
            onClick={() => void envoyer()}
          >
            {envoi ? <Loader2 className="size-5 animate-spin" /> : <Save className="size-5" />}
            Confirmer et enregistrer
          </Button>
        )}
      </div>
    </div>
  );
}
