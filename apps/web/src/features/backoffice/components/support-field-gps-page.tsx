"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  CheckCircle2,
  Clipboard,
  Crosshair,
  Download,
  Loader2,
  LockKeyhole,
  MapPin,
  Navigation,
  Play,
  Save,
  ShieldCheck,
  Square,
  Trash2,
} from "lucide-react";

import {
  toast,
} from "sonner";

import {
  Button,
} from "@/components/ui/button";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  Input,
} from "@/components/ui/input";

import {
  Label,
} from "@/components/ui/label";

import {
  Textarea,
} from "@/components/ui/textarea";

import {
  getAccessToken,
} from "@/lib/supabase/browser";

import {
  getBackofficeMe,
  type BackofficeIdentity,
} from "../api";


type LiveGpsFix = {
  latitude: number;
  longitude: number;
  accuracyM: number;
  timestampMs: number;
};


type FieldSample = {
  sample_id: string;
  captured_at_utc: string;
  profile: string;
  raw_longitude: string;
  raw_latitude: string;
  device_reported_accuracy_m: string;
  environment_class: string;
  expected_access_reference: string;
  expected_road_or_path_reference: string;
  expected_routable: string;
  ground_truth_method: string;
  movement_state: string;
  capture_device_class: string;
  weather_or_visibility_note: string;
  operator_notes: string;
};


const STORAGE_KEY =
  "adresse-gn-p8e29-field-gps-v1";


const CSV_COLUMNS: Array<
  keyof FieldSample
> = [
  "sample_id",
  "captured_at_utc",
  "profile",
  "raw_longitude",
  "raw_latitude",
  "device_reported_accuracy_m",
  "environment_class",
  "expected_access_reference",
  "expected_road_or_path_reference",
  "expected_routable",
  "ground_truth_method",
  "movement_state",
  "capture_device_class",
  "weather_or_visibility_note",
  "operator_notes",
];


const ENVIRONMENT_CLASSES = [
  "dense_urban",
  "peri_urban",
  "rural_paved",
  "rural_unpaved",
  "intersection_or_parallel_roads",
  "one_way_or_direction_restricted",
  "pedestrian_specific_access",
  "edge_of_mapped_network",
  "known_off_network_negative_control",
] as const;


function csvCell(
  value: string,
) {
  return `"${value.replaceAll(
    '"',
    '""',
  )}"`;
}


function toCsv(
  rows: FieldSample[],
) {
  const header =
    CSV_COLUMNS
      .map(csvCell)
      .join(",");

  const body =
    rows.map(
      (row) =>
        CSV_COLUMNS
          .map(
            (column) =>
              csvCell(
                row[column] ?? "",
              ),
          )
          .join(","),
    );

  return [
    header,
    ...body,
    "",
  ].join("\r\n");
}


function readStoredSamples():
  FieldSample[] {
  if (
    typeof window ===
    "undefined"
  ) {
    return [];
  }

  try {
    const raw =
      window.localStorage
        .getItem(
          STORAGE_KEY,
        );

    if (!raw) {
      return [];
    }

    const parsed =
      JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed as FieldSample[];
  } catch {
    return [];
  }
}


function nextSampleId(
  current: string,
) {
  const match =
    /^GN-FIELD-(\d+)$/
      .exec(current.trim());

  if (!match) {
    return "";
  }

  const number =
    Number(match[1]);

  if (
    !Number.isInteger(number)
  ) {
    return "";
  }

  return `GN-FIELD-${String(
    number + 1,
  ).padStart(
    match[1].length,
    "0",
  )}`;
}


export function SupportFieldGpsPage() {
  const router =
    useRouter();

  const watchIdRef =
    useRef<number | null>(
      null,
    );

  const [
    identity,
    setIdentity,
  ] = useState<
    BackofficeIdentity | null
  >(null);

  const [
    authLoading,
    setAuthLoading,
  ] = useState(true);

  const [
    watching,
    setWatching,
  ] = useState(false);

  const [
    liveFix,
    setLiveFix,
  ] = useState<
    LiveGpsFix | null
  >(null);

  const [
    frozenFix,
    setFrozenFix,
  ] = useState<
    LiveGpsFix | null
  >(null);

  const [
    geoError,
    setGeoError,
  ] = useState<
    string | null
  >(null);

  const [
    samples,
    setSamples,
  ] = useState<
    FieldSample[]
  >([]);

  const [
    sampleId,
    setSampleId,
  ] = useState(
    "GN-FIELD-0002",
  );

  const [
    profile,
    setProfile,
  ] = useState(
    "",
  );

  const [
    environmentClass,
    setEnvironmentClass,
  ] = useState(
    "",
  );

  const [
    expectedAccess,
    setExpectedAccess,
  ] = useState("");

  const [
    expectedRoad,
    setExpectedRoad,
  ] = useState("");

  const [
    expectedRoutable,
    setExpectedRoutable,
  ] = useState(
    "",
  );

  const [
    groundTruthMethod,
    setGroundTruthMethod,
  ] = useState(
    "",
  );

  const [
    movementState,
    setMovementState,
  ] = useState(
    "",
  );

  const [
    captureDeviceClass,
    setCaptureDeviceClass,
  ] = useState(
    "",
  );

  const [
    weatherNote,
    setWeatherNote,
  ] = useState("");

  const [
    operatorNotes,
    setOperatorNotes,
  ] = useState("");


  useEffect(() => {
    const storedSamples =
      readStoredSamples();

    const timer =
      window.setTimeout(
        () => {
          setSamples(
            storedSamples,
          );
        },
        0,
      );

    return () => {
      window.clearTimeout(
        timer,
      );
    };
  }, []);


  useEffect(() => {
    const controller =
      new AbortController();

    async function bootstrap() {
      try {
        const token =
          await getAccessToken();

        if (!token) {
          router.replace(
            "/login?returnTo=%2Fsupport%2Fterrain-gps",
          );

          return;
        }

        const me =
          await getBackofficeMe(
            token,
            controller.signal,
          );

        if (
          controller.signal.aborted
        ) {
          return;
        }

        setIdentity(
          me.user,
        );
      } catch (error) {
        if (
          controller.signal.aborted
        ) {
          return;
        }

        toast.error(
          error instanceof Error
            ? error.message
            : "Accès au mode terrain impossible.",
        );

        router.replace(
          "/login?returnTo=%2Fsupport%2Fterrain-gps",
        );
      } finally {
        if (
          !controller.signal.aborted
        ) {
          setAuthLoading(
            false,
          );
        }
      }
    }

    void bootstrap();

    return () => {
      controller.abort();
    };
  }, [router]);


  useEffect(() => {
    return () => {
      if (
        watchIdRef.current !==
        null
      ) {
        navigator.geolocation
          .clearWatch(
            watchIdRef.current,
          );

        watchIdRef.current =
          null;
      }
    };
  }, []);


  function startGps() {
    if (
      typeof navigator ===
        "undefined"
      || !navigator.geolocation
    ) {
      setGeoError(
        "La géolocalisation n'est pas disponible sur cet appareil.",
      );

      return;
    }

    if (
      watchIdRef.current !==
      null
    ) {
      return;
    }

    setGeoError(null);
    setWatching(true);

    watchIdRef.current =
      navigator.geolocation
        .watchPosition(
          (position) => {
            setLiveFix({
              latitude:
                position.coords
                  .latitude,

              longitude:
                position.coords
                  .longitude,

              accuracyM:
                position.coords
                  .accuracy,

              timestampMs:
                position.timestamp,
            });

            setGeoError(null);
          },

          (error) => {
            setGeoError(
              `GPS indisponible : ${error.message}`,
            );
          },

          {
            enableHighAccuracy:
              true,

            maximumAge:
              0,

            timeout:
              20000,
          },
        );
  }


  function stopGps() {
    if (
      watchIdRef.current !==
      null
    ) {
      navigator.geolocation
        .clearWatch(
          watchIdRef.current,
        );

      watchIdRef.current =
        null;
    }

    setWatching(false);
  }


  function freezeCurrentFix() {
    if (!liveFix) {
      toast.error(
        "Aucune position GPS disponible.",
      );

      return;
    }

    setFrozenFix({
      ...liveFix,
    });

    toast.success(
      "Position GPS figée. Les coordonnées ne changeront plus pour cette mesure.",
    );
  }


  function cancelFrozenFix() {
    setFrozenFix(null);
  }


  function persistSamples(
    next: FieldSample[],
  ) {
    window.localStorage
      .setItem(
        STORAGE_KEY,
        JSON.stringify(next),
      );

    setSamples(next);
  }


  function saveSample() {
    if (!frozenFix) {
      toast.error(
        "Figez d'abord une position GPS.",
      );

      return;
    }

    const cleanId =
      sampleId.trim();

    if (!cleanId) {
      toast.error(
        "Le sample_id est obligatoire.",
      );

      return;
    }

    if (
      samples.some(
        (sample) =>
          sample.sample_id ===
          cleanId,
      )
    ) {
      toast.error(
        "Ce sample_id existe déjà sur cet appareil.",
      );

      return;
    }

    if (
      !profile
      || !environmentClass
      || !expectedRoutable
      || !groundTruthMethod
      || !movementState
      || !captureDeviceClass.trim()
    ) {
      toast.error(
        "Renseignez explicitement tous les champs obligatoires du ground truth.",
      );

      return;
    }


    if (
      expectedRoutable ===
        "true"
      && (
        !expectedAccess.trim()
        || !expectedRoad.trim()
      )
    ) {
      toast.error(
        "Pour un point routable, renseignez l'accès réel et la route/chemin attendu.",
      );

      return;
    }

    const sample:
      FieldSample = {
        sample_id:
          cleanId,

        captured_at_utc:
          new Date(
            frozenFix.timestampMs,
          ).toISOString(),

        profile,

        raw_longitude:
          String(
            frozenFix.longitude,
          ),

        raw_latitude:
          String(
            frozenFix.latitude,
          ),

        device_reported_accuracy_m:
          String(
            frozenFix.accuracyM,
          ),

        environment_class:
          environmentClass,

        expected_access_reference:
          expectedAccess.trim(),

        expected_road_or_path_reference:
          expectedRoad.trim(),

        expected_routable:
          expectedRoutable,

        ground_truth_method:
          groundTruthMethod,

        movement_state:
          movementState,

        capture_device_class:
          captureDeviceClass
            .trim(),

        weather_or_visibility_note:
          weatherNote.trim(),

        operator_notes:
          operatorNotes.trim(),
      };

    const next = [
      ...samples,
      sample,
    ];

    persistSamples(next);

    const nextId =
      nextSampleId(cleanId);

    if (nextId) {
      setSampleId(nextId);
    }

    setFrozenFix(null);

    setProfile("");
    setEnvironmentClass("");
    setExpectedRoutable("");
    setGroundTruthMethod("");
    setMovementState("");
    setCaptureDeviceClass("");

    setExpectedAccess("");
    setExpectedRoad("");
    setWeatherNote("");
    setOperatorNotes("");

    toast.success(
      `${cleanId} enregistré localement.`,
    );
  }


  function exportCsv() {
    if (
      samples.length ===
      0
    ) {
      toast.error(
        "Aucune mesure à exporter.",
      );

      return;
    }

    const csv =
      toCsv(samples);

    const blob =
      new Blob(
        [csv],
        {
          type:
            "text/csv;charset=utf-8",
        },
      );

    const url =
      URL.createObjectURL(
        blob,
      );

    const anchor =
      document.createElement(
        "a",
      );

    anchor.href = url;

    anchor.download =
      "block14_p8e29_field_gps_capture_mobile.csv";

    document.body
      .appendChild(anchor);

    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(
      url,
    );

    toast.success(
      "CSV terrain généré.",
    );
  }


  async function copyCsv() {
    if (
      samples.length ===
      0
    ) {
      toast.error(
        "Aucune mesure à copier.",
      );

      return;
    }

    try {
      await navigator.clipboard
        .writeText(
          toCsv(samples),
        );

      toast.success(
        "CSV copié dans le presse-papiers.",
      );
    } catch {
      toast.error(
        "Copie impossible sur cet appareil.",
      );
    }
  }


  function clearLocalDataset() {
    if (
      !window.confirm(
        "Supprimer toutes les mesures terrain enregistrées uniquement sur cet appareil ?",
      )
    ) {
      return;
    }

    window.localStorage
      .removeItem(
        STORAGE_KEY,
      );

    setSamples([]);

    toast.success(
      "Dataset local supprimé.",
    );
  }


  if (authLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }


  if (!identity) {
    return null;
  }


  const shownFix =
    frozenFix ?? liveFix;


  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <ShieldCheck className="size-4" />
              P8-E29 Â· collecte terrain
            </div>

            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Capture GPS terrain
            </h1>

            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Capture brute du GPS et ground truth indépendant.
              Aucun snap, aucun K et aucun rayon ne sont exécutés sur cet écran.
            </p>
          </div>

          <div className="rounded-xl border bg-muted/40 px-3 py-2 text-xs">
            <div className="font-semibold">
              {identity.full_name ?? "Back-office"}
            </div>
            <div className="text-muted-foreground">
              {identity.role}
            </div>
          </div>
        </div>
      </header>


      <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Navigation className="size-4" />
                GPS live
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border bg-muted/30 p-3">
                  <div className="text-[11px] uppercase text-muted-foreground">
                    Latitude
                  </div>

                  <div className="mt-1 break-all font-mono text-sm font-semibold">
                    {shownFix
                      ? shownFix.latitude
                      : "—"}
                  </div>
                </div>

                <div className="rounded-xl border bg-muted/30 p-3">
                  <div className="text-[11px] uppercase text-muted-foreground">
                    Longitude
                  </div>

                  <div className="mt-1 break-all font-mono text-sm font-semibold">
                    {shownFix
                      ? shownFix.longitude
                      : "—"}
                  </div>
                </div>

                <div className="rounded-xl border bg-muted/30 p-3">
                  <div className="text-[11px] uppercase text-muted-foreground">
                    Précision
                  </div>

                  <div className="mt-1 font-mono text-lg font-bold">
                    {shownFix
                      ? `Â± ${shownFix.accuracyM} m`
                      : "—"}
                  </div>
                </div>

                <div className="rounded-xl border bg-muted/30 p-3">
                  <div className="text-[11px] uppercase text-muted-foreground">
                    Heure UTC
                  </div>

                  <div className="mt-1 break-all font-mono text-xs">
                    {shownFix
                      ? new Date(
                          shownFix.timestampMs,
                        ).toISOString()
                      : "—"}
                  </div>
                </div>
              </div>


              {frozenFix ? (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                  <LockKeyhole className="size-4 shrink-0" />
                  Position figée. Les mises à jour GPS live ne modifieront plus cet échantillon.
                </div>
              ) : (
                <div className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
                  Les coordonnées restent en direct jusqu&apos;à ce que vous appuyiez sur
                  Â« Figer cette position Â».
                </div>
              )}


              {geoError && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  {geoError}
                </div>
              )}


              <div className="grid gap-2 sm:grid-cols-2">
                {!watching ? (
                  <Button
                    type="button"
                    onClick={startGps}
                  >
                    <Play className="mr-2 size-4" />
                    Démarrer GPS
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={stopGps}
                  >
                    <Square className="mr-2 size-4" />
                    Arrêter GPS
                  </Button>
                )}

                <Button
                  type="button"
                  variant="secondary"
                  disabled={!liveFix || !!frozenFix}
                  onClick={freezeCurrentFix}
                >
                  <Crosshair className="mr-2 size-4" />
                  Figer cette position
                </Button>
              </div>


              {frozenFix && (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={cancelFrozenFix}
                >
                  Annuler le gel
                </Button>
              )}
            </CardContent>
          </Card>


          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Download className="size-4" />
                Dataset local
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border bg-muted/30 p-4">
                <span className="text-sm text-muted-foreground">
                  Mesures enregistrées
                </span>

                <strong className="font-mono text-2xl">
                  {samples.length}
                </strong>
              </div>

              <div className="grid gap-2">
                <Button
                  type="button"
                  disabled={samples.length === 0}
                  onClick={exportCsv}
                >
                  <Download className="mr-2 size-4" />
                  Exporter le CSV
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  disabled={samples.length === 0}
                  onClick={() => void copyCsv()}
                >
                  <Clipboard className="mr-2 size-4" />
                  Copier le CSV
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  disabled={samples.length === 0}
                  onClick={clearLocalDataset}
                >
                  <Trash2 className="mr-2 size-4" />
                  Effacer le dataset local
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Ce stockage reste local à cet appareil.
                Il ne crée aucune donnée dans Supabase ou Django.
              </p>
            </CardContent>
          </Card>
        </div>


        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="size-4" />
              Ground truth terrain
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="sample-id">
                Sample ID
              </Label>

              <Input
                id="sample-id"
                value={sampleId}
                onChange={(event) =>
                  setSampleId(
                    event.target.value,
                  )
                }
                placeholder="GN-FIELD-0002"
              />
            </div>


            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="profile">
                  Profil
                </Label>

                <select
                  id="profile"
                  value={profile}
                  onChange={(event) =>
                    setProfile(
                      event.target.value,
                    )
                  }
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="" disabled>
                    Choisir le profil
                  </option>

                  <option value="car">
                    car
                  </option>
                  <option value="motorcycle">
                    motorcycle
                  </option>
                  <option value="foot">
                    foot
                  </option>
                </select>
              </div>


              <div className="space-y-2">
                <Label htmlFor="movement">
                  Mouvement
                </Label>

                <select
                  id="movement"
                  value={movementState}
                  onChange={(event) =>
                    setMovementState(
                      event.target.value,
                    )
                  }
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="" disabled>
                    Choisir le mouvement
                  </option>

                  <option value="stationary">
                    stationary
                  </option>
                  <option value="moving">
                    moving
                  </option>
                </select>
              </div>
            </div>


            <div className="space-y-2">
              <Label htmlFor="environment">
                Classe d&apos;environnement
              </Label>

              <select
                id="environment"
                value={environmentClass}
                onChange={(event) =>
                  setEnvironmentClass(
                    event.target.value,
                  )
                }
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="" disabled>
                  Choisir la classe
                </option>

                {ENVIRONMENT_CLASSES.map(
                  (value) => (
                    <option
                      key={value}
                      value={value}
                    >
                      {value}
                    </option>
                  ),
                )}
              </select>
            </div>


            <div className="space-y-2">
              <Label htmlFor="access">
                Accès réel observé
              </Label>

              <Textarea
                id="access"
                value={expectedAccess}
                onChange={(event) =>
                  setExpectedAccess(
                    event.target.value,
                  )
                }
                placeholder="Ex. Portail de la cour accessible en voiture depuis la route"
              />
            </div>


            <div className="space-y-2">
              <Label htmlFor="road">
                Route ou chemin attendu
              </Label>

              <Textarea
                id="road"
                value={expectedRoad}
                onChange={(event) =>
                  setExpectedRoad(
                    event.target.value,
                  )
                }
                placeholder="Ex. Route non goudronnée desservant réellement l'accès"
              />
            </div>


            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="routable">
                  Routable attendu
                </Label>

                <select
                  id="routable"
                  value={expectedRoutable}
                  onChange={(event) =>
                    setExpectedRoutable(
                      event.target.value,
                    )
                  }
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="" disabled>
                    Choisir le routage attendu
                  </option>

                  <option value="true">
                    true
                  </option>
                  <option value="false">
                    false
                  </option>
                </select>
              </div>


              <div className="space-y-2">
                <Label htmlFor="ground-truth">
                  Méthode ground truth
                </Label>

                <select
                  id="ground-truth"
                  value={groundTruthMethod}
                  onChange={(event) =>
                    setGroundTruthMethod(
                      event.target.value,
                    )
                  }
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="" disabled>
                    Choisir la méthode
                  </option>

                  <option value="visual_on_site">
                    visual_on_site
                  </option>

                  <option value="verified_off_network_on_site">
                    verified_off_network_on_site
                  </option>
                </select>
              </div>
            </div>


            <div className="space-y-2">
              <Label htmlFor="device-class">
                Classe appareil
              </Label>

              <Input
                id="device-class"
                value={captureDeviceClass}
                onChange={(event) =>
                  setCaptureDeviceClass(
                    event.target.value,
                  )
                }
                placeholder="Ex. android_phone"
              />
            </div>


            <div className="space-y-2">
              <Label htmlFor="weather">
                Météo / visibilité
              </Label>

              <Input
                id="weather"
                value={weatherNote}
                onChange={(event) =>
                  setWeatherNote(
                    event.target.value,
                  )
                }
                placeholder="Optionnel"
              />
            </div>


            <div className="space-y-2">
              <Label htmlFor="notes">
                Notes opérateur
              </Label>

              <Textarea
                id="notes"
                value={operatorNotes}
                onChange={(event) =>
                  setOperatorNotes(
                    event.target.value,
                  )
                }
                placeholder="Contexte utile de la mesure"
              />
            </div>


            <Button
              type="button"
              size="lg"
              className="w-full"
              disabled={
                !frozenFix
                || !profile
                || !environmentClass
                || !expectedRoutable
                || !groundTruthMethod
                || !movementState
                || !captureDeviceClass.trim()
                || (
                  expectedRoutable === "true"
                  && (
                    !expectedAccess.trim()
                    || !expectedRoad.trim()
                  )
                )
              }
              onClick={saveSample}
            >
              {frozenFix ? (
                <Save className="mr-2 size-4" />
              ) : (
                <LockKeyhole className="mr-2 size-4" />
              )}

              Enregistrer la mesure terrain
            </Button>


            {frozenFix && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                <CheckCircle2 className="size-4 shrink-0" />
                Le GPS est figé pour cet échantillon. Vous pouvez compléter le ground truth sans modifier les coordonnées capturées.
              </div>
            )}
          </CardContent>
        </Card>
      </div>


      {samples.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Dernières mesures locales
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="px-2 py-2">
                      ID
                    </th>

                    <th className="px-2 py-2">
                      UTC
                    </th>

                    <th className="px-2 py-2">
                      Latitude
                    </th>

                    <th className="px-2 py-2">
                      Longitude
                    </th>

                    <th className="px-2 py-2">
                      Accuracy
                    </th>

                    <th className="px-2 py-2">
                      Classe
                    </th>

                    <th className="px-2 py-2">
                      Routable
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {samples
                    .slice()
                    .reverse()
                    .slice(0, 10)
                    .map(
                      (sample) => (
                        <tr
                          key={sample.sample_id}
                          className="border-b"
                        >
                          <td className="px-2 py-2 font-mono font-semibold">
                            {sample.sample_id}
                          </td>

                          <td className="px-2 py-2 font-mono">
                            {sample.captured_at_utc}
                          </td>

                          <td className="px-2 py-2 font-mono">
                            {sample.raw_latitude}
                          </td>

                          <td className="px-2 py-2 font-mono">
                            {sample.raw_longitude}
                          </td>

                          <td className="px-2 py-2 font-mono">
                            {sample.device_reported_accuracy_m} m
                          </td>

                          <td className="px-2 py-2">
                            {sample.environment_class}
                          </td>

                          <td className="px-2 py-2">
                            {sample.expected_routable}
                          </td>
                        </tr>
                      ),
                    )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
