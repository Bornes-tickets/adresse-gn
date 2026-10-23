"use client";

import {
  AgentInstallStepBeacon,
} from "@/features/agent/components/install/agent-install-step-beacon";

import {
  AgentInstallStepIndicator,
} from "@/features/agent/components/install/agent-install-step-indicator";

import {
  AgentInstallStepGps,
} from "@/features/agent/components/install/agent-install-step-gps";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  Loader2,
  ShieldCheck,
} from "lucide-react";

import {
  useParams,
  useRouter,
} from "next/navigation";

import {
  toast,
} from "sonner";

import {
  AgentApiError,
  completeAgentTask,
  listAgentTasks,
  type AgentCompleteMeasure,
  type AgentCompletePayload,
  type AgentTask,
} from "@/features/agent/api";

import {
  getAccessToken,
} from "@/lib/supabase/browser";


const GPS_MAX_ACCURACY_M =
  3.0;

const GPS_MEASURE_COUNT =
  3;

const GPS_MEASURE_DELAY_MS =
  2000;

const PHOTO_MAX_BYTES =
  500 * 1024;




const CATEGORIES = [
  [
    "habitation",
    "Habitation",
  ],
  [
    "restaurant",
    "Restaurant",
  ],
  [
    "hotel",
    "Hôtel",
  ],
  [
    "bar",
    "Bar",
  ],
  [
    "commerce",
    "Commerce",
  ],
  [
    "entreprise",
    "Entreprise",
  ],
  [
    "administration",
    "Administration",
  ],
  [
    "ecole",
    "École",
  ],
  [
    "sante",
    "Sant?",
  ],
  [
    "pharmacie",
    "Pharmacie",
  ],
  [
    "banque",
    "Banque",
  ],
  [
    "tourisme",
    "Tourisme",
  ],
  [
    "other",
    "Autre",
  ],
] as const;


type Step =
  | 1
  | 2
  | 3
  | 4
  | 5;


type DetailsState = {
  category: string;
  name: string;
  accessPointNote: string;
  consent: boolean;
};


function sleep(
  delayMs: number,
) {
  return new Promise<void>(
    (
      resolve,
    ) => {
      window.setTimeout(
        resolve,
        delayMs,
      );
    },
  );
}


function readGpsPosition() {
  return new Promise<GeolocationPosition>(
    (
      resolve,
      reject,
    ) => {
      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        {
          enableHighAccuracy:
            true,

          maximumAge:
            0,

          timeout:
            20000,
        },
      );
    },
  );
}


function mean(
  values: number[],
) {
  if (
    values.length === 0
  ) {
    return 0;
  }

  return (
    values.reduce(
      (
        total,
        value,
      ) =>
        total + value,
      0,
    )
    / values.length
  );
}


/*
 * AGENT_V1_CONFIRMATION_FORMAT
 *
 * DB/API canonical:
 *   CCCCC-NNNNNNNNC
 *
 * UI:
 *   CCCCC-NNNNNNNN-C
 *
 * Task-scoped short input:
 *   NNNNNNNNC
 *
 * IMPORTANT:
 * The commune prefix for a short input comes exclusively
 * from the already assigned task.
 */
type AgentV1NumberParts = {
  communeCode: string;
  nationalId: string;
  checkDigit: string;
  canonical: string;
  display: string;
};


function parseAgentV1AddressNumber(
  value: string,
): AgentV1NumberParts | null {
  const normalized =
    value
      .trim()
      .toUpperCase();

  const match =
    normalized.match(
      /^([A-Z]{3}[0-9]{2})-([0-9]{8})([0-9])$/,
    );

  if (!match) {
    return null;
  }

  const communeCode =
    match[1];

  const nationalId =
    match[2];

  const checkDigit =
    match[3];

  return {
    communeCode,
    nationalId,
    checkDigit,

    canonical:
      `${communeCode}-`
      + `${nationalId}`
      + `${checkDigit}`,

    display:
      `${communeCode}-`
      + `${nationalId}-`
      + `${checkDigit}`,
  };
}


function formatAgentV1AddressNumber(
  value: string,
) {
  const parsed =
    parseAgentV1AddressNumber(
      value,
    );

  return (
    parsed?.display
    ?? value
      .trim()
      .toUpperCase()
  );
}


function canonicalizeAgentV1Confirmation(
  input: string,
  assignedPublicNumber: string,
) {
  const assigned =
    parseAgentV1AddressNumber(
      assignedPublicNumber,
    );

  if (!assigned) {
    return null;
  }


  const compact =
    input
      .trim()
      .toUpperCase()
      .replace(
        /[\s-]+/g,
        "",
      );


  /*
   * Nine digits alone are valid only in this task-scoped
   * confirmation screen because the commune is already
   * authoritative from the assigned task.
   */
  if (
    /^[0-9]{9}$/.test(
      compact,
    )
  ) {
    return (
      `${assigned.communeCode}-`
      + compact
    );
  }


  const full =
    compact.match(
      /^([A-Z]{3}[0-9]{2})([0-9]{9})$/,
    );


  if (!full) {
    return null;
  }


  return (
    `${full[1]}-`
    + `${full[2]}`
  );
}


function formatAgentV1ConfirmationInput(
  input: string,
  assignedPublicNumber: string,
) {
  const assigned =
    parseAgentV1AddressNumber(
      assignedPublicNumber,
    );

  const raw =
    input
      .trim()
      .toUpperCase();

  const compact =
    raw.replace(
      /[\s-]+/g,
      "",
    );


  if (
    assigned
    && /^[0-9]{9}$/.test(
      compact,
    )
  ) {
    return (
      `${assigned.communeCode}-`
      + `${compact.slice(0, 8)}-`
      + `${compact.slice(8)}`
    );
  }


  const full =
    compact.match(
      /^([A-Z]{3}[0-9]{2})([0-9]{8})([0-9])$/,
    );


  if (full) {
    return (
      `${full[1]}-`
      + `${full[2]}-`
      + `${full[3]}`
    );
  }


  return raw;
}


function dataUrlByteLength(
  dataUrl: string,
) {
  const comma =
    dataUrl.indexOf(
      ",",
    );

  const base64 =
    comma >= 0
      ? dataUrl.slice(
          comma + 1,
        )
      : dataUrl;

  const padding =
    base64.endsWith(
      "==",
    )
      ? 2
      : base64.endsWith(
            "=",
          )
        ? 1
        : 0;

  return (
    Math.floor(
      (
        base64.length
        * 3
      )
      / 4,
    )
    - padding
  );
}


function loadImage(
  file: File,
) {
  return new Promise<HTMLImageElement>(
    (
      resolve,
      reject,
    ) => {
      const image =
        new Image();

      const objectUrl =
        URL.createObjectURL(
          file,
        );

      image.onload = () => {
        URL.revokeObjectURL(
          objectUrl,
        );

        resolve(
          image,
        );
      };

      image.onerror = () => {
        URL.revokeObjectURL(
          objectUrl,
        );

        reject(
          new Error(
            "Impossible de lire cette image.",
          ),
        );
      };

      image.src =
        objectUrl;
    },
  );
}


async function compressPhoto(
  file: File,
) {
  const image =
    await loadImage(
      file,
    );

  const dimensions = [
    1600,
    1400,
    1200,
    1000,
    800,
  ];

  const qualities = [
    0.86,
    0.78,
    0.70,
    0.62,
    0.54,
    0.46,
  ];


  for (
    const maxDimension
    of dimensions
  ) {
    const largest =
      Math.max(
        image.naturalWidth,
        image.naturalHeight,
      );

    const ratio =
      largest > maxDimension
        ? maxDimension
          / largest
        : 1;

    const width =
      Math.max(
        1,
        Math.round(
          image.naturalWidth
          * ratio,
        ),
      );

    const height =
      Math.max(
        1,
        Math.round(
          image.naturalHeight
          * ratio,
        ),
      );

    const canvas =
      document.createElement(
        "canvas",
      );

    canvas.width =
      width;

    canvas.height =
      height;

    const context =
      canvas.getContext(
        "2d",
      );

    if (!context) {
      throw new Error(
        "Compression photo indisponible.",
      );
    }


    context.drawImage(
      image,
      0,
      0,
      width,
      height,
    );


    for (
      const quality
      of qualities
    ) {
      const dataUrl =
        canvas.toDataURL(
          "image/jpeg",
          quality,
        );

      if (
        dataUrlByteLength(
          dataUrl,
        )
        <= PHOTO_MAX_BYTES
      ) {
        return dataUrl;
      }
    }
  }


  throw new Error(
    "La photo reste supérieure à 500 KiB après compression.",
  );
}


function getOrCreateClientUuid(
  pendingInstallationId: string,
) {
  const key =
    `adresse-gn-agent-install-client-uuid:${pendingInstallationId}`;

  const existing =
    window.localStorage.getItem(
      key,
    );

  if (existing) {
    return existing;
  }


  if (
    typeof crypto ===
      "undefined"
    || typeof crypto.randomUUID
      !== "function"
  ) {
    throw new Error(
      "Impossible de générer la clé d’idempotence.",
    );
  }


  const value =
    crypto.randomUUID();

  window.localStorage.setItem(
    key,
    value,
  );

  return value;
}


function clearClientUuid(
  pendingInstallationId: string,
) {
  window.localStorage.removeItem(
    `adresse-gn-agent-install-client-uuid:${pendingInstallationId}`,
  );
}


function StepIndicator({
  step,
}: {
  step: Step;
}) {
  return (
    <AgentInstallStepIndicator
      step={step}
    />
  );
}


export function AgentInstallPage() {
  const router =
    useRouter();

  const params =
    useParams();

  const rawPendingId =
    params[
      "pendingInstallationId"
    ];

  const pendingInstallationId =
    Array.isArray(
      rawPendingId,
    )
      ? (
          rawPendingId[0]
          ?? ""
        )
      : (
          rawPendingId
          ?? ""
        );


  const [
    loading,
    setLoading,
  ] = useState(
    true,
  );

  const [
    task,
    setTask,
  ] = useState<AgentTask | null>(
    null,
  );

  const [
    loadError,
    setLoadError,
  ] = useState<string | null>(
    null,
  );

  const [
    step,
    setStep,
  ] = useState<Step>(
    1,
  );

  const [
    clientUuid,
    setClientUuid,
  ] = useState(
    "",
  );

  const [
    beaconInput,
    setBeaconInput,
  ] = useState(
    "",
  );

  const [
    beaconConfirmed,
    setBeaconConfirmed,
  ] = useState(
    false,
  );

  const [
    measures,
    setMeasures,
  ] = useState<
    AgentCompleteMeasure[]
  >(
    [],
  );

  const [
    currentAccuracy,
    setCurrentAccuracy,
  ] = useState<number | null>(
    null,
  );

  const [
    gpsMessage,
    setGpsMessage,
  ] = useState<string | null>(
    null,
  );

  const [
    gpsWatching,
    setGpsWatching,
  ] = useState(
    false,
  );

  const [
    gpsCapturing,
    setGpsCapturing,
  ] = useState(
    false,
  );

  const [
    photo,
    setPhoto,
  ] = useState<string | null>(
    null,
  );

  const [
    photoBusy,
    setPhotoBusy,
  ] = useState(
    false,
  );

  const [
    details,
    setDetails,
  ] = useState<DetailsState>({
    category:
      "habitation",

    name:
      "",

    accessPointNote:
      "",

    consent:
      false,
  });

  const [
    submitting,
    setSubmitting,
  ] = useState(
    false,
  );

  const [
    submitError,
    setSubmitError,
  ] = useState<string | null>(
    null,
  );

  const [
    completed,
    setCompleted,
  ] = useState(
    false,
  );


  const watchIdRef =
    useRef<number | null>(
      null,
    );

  const photoInputRef =
    useRef<HTMLInputElement | null>(
      null,
    );


  useEffect(
    () => {
      const controller =
        new AbortController();


      async function load() {
        try {
          const token =
            await getAccessToken();

          if (!token) {
            router.replace(
              "/agent/login",
            );

            return;
          }


          const response =
            await listAgentTasks(
              token,
              controller.signal,
            );

          const found =
            response.items.find(
              (
                item,
              ) =>
                item
                  .pending_installation_id
                === pendingInstallationId,
            );


          if (!found) {
            setLoadError(
              "Cette intervention n’est plus disponible dans vos tâches actives.",
            );

            return;
          }


          if (
            !found
              .can_start_installation
          ) {
            setLoadError(
              "Cette intervention n’est pas encore démarrable.",
            );

            return;
          }


          if (
            found
              .installation_requirements
              .gps_measure_count
            !== GPS_MEASURE_COUNT
            || found
              .installation_requirements
              .gps_max_accuracy_m
            !== GPS_MAX_ACCURACY_M
          ) {
            setLoadError(
              "Le contrat GPS de cette intervention n’est pas compatible avec Agent V1.",
            );

            return;
          }


          const uuid =
            getOrCreateClientUuid(
              pendingInstallationId,
            );


          setClientUuid(
            uuid,
          );

          setDetails(
            (
              previous,
            ) => ({
              ...previous,

              name:
                found.site
                  .place_name
                || previous.name,

              accessPointNote:
                found.site
                  .access_point_note
                || "",
            }),
          );

          setTask(
            found,
          );
        } catch (error) {
          if (
            error instanceof
              DOMException
            && error.name ===
              "AbortError"
          ) {
            return;
          }


          setLoadError(
            error instanceof Error
              ? error.message
              : "Impossible de charger l’intervention.",
          );
        } finally {
          if (
            !controller
              .signal
              .aborted
          ) {
            setLoading(
              false,
            );
          }
        }
      }


      void load();


      return () => {
        controller.abort();
      };
    },
    [
      pendingInstallationId,
      router,
    ],
  );


  useEffect(
    () => {
      return () => {
        if (
          watchIdRef.current
          !== null
          && typeof navigator
            !== "undefined"
          && navigator
            .geolocation
        ) {
          navigator
            .geolocation
            .clearWatch(
              watchIdRef.current,
            );
        }
      };
    },
    [],
  );


  function stopGpsWatch() {
    if (
      watchIdRef.current
      !== null
      && navigator
        .geolocation
    ) {
      navigator
        .geolocation
        .clearWatch(
          watchIdRef.current,
        );
    }

    watchIdRef.current =
      null;

    setGpsWatching(
      false,
    );
  }


  function startGpsWatch() {
    setGpsMessage(
      null,
    );

    if (
      !(
        "geolocation"
        in navigator
      )
    ) {
      setGpsMessage(
        "La géolocalisation n’est pas disponible sur cet appareil.",
      );

      return;
    }


    if (
      watchIdRef.current
      !== null
    ) {
      return;
    }


    const watchId =
      navigator
        .geolocation
        .watchPosition(
          (
            position,
          ) => {
            setCurrentAccuracy(
              position
                .coords
                .accuracy,
            );

            setGpsMessage(
              null,
            );
          },

          (
            error,
          ) => {
            setGpsMessage(
              error.code === 1
                ? "Autorisation GPS refusée."
                : `Position GPS indisponible : ${error.message}`,
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


    watchIdRef.current =
      watchId;

    setGpsWatching(
      true,
    );
  }


  async function captureGps() {
    if (
      gpsCapturing
    ) {
      return;
    }


    if (
      !(
        "geolocation"
        in navigator
      )
    ) {
      setGpsMessage(
        "La géolocalisation n’est pas disponible.",
      );

      return;
    }


    setGpsCapturing(
      true,
    );

    setGpsMessage(
      null,
    );

    setMeasures(
      [],
    );


    try {
      const captured:
        AgentCompleteMeasure[] =
          [];


      for (
        let index = 0;
        index
          < GPS_MEASURE_COUNT;
        index += 1
      ) {
        if (
          index > 0
        ) {
          await sleep(
            GPS_MEASURE_DELAY_MS,
          );
        }


        const position =
          await readGpsPosition();


        setCurrentAccuracy(
          position
            .coords
            .accuracy,
        );


        if (
          position
            .coords
            .accuracy
          > GPS_MAX_ACCURACY_M
        ) {
          throw new Error(
            `Précision insuffisante : ±${position.coords.accuracy.toFixed(
              1,
            )} m. Chaque mesure doit être ≤ 3,0 m.`,
          );
        }


        captured.push({
          lat:
            position
              .coords
              .latitude,

          lng:
            position
              .coords
              .longitude,

          accuracy_m:
            position
              .coords
              .accuracy,

          taken_at:
            new Date(
              position.timestamp,
            ).toISOString(),
        });


        setMeasures(
          [
            ...captured,
          ],
        );
      }


      toast.success(
        "3 mesures GPS enregistrées",
      );
    } catch (error) {
      setMeasures(
        [],
      );

      setGpsMessage(
        error instanceof Error
          ? error.message
          : "Acquisition GPS impossible.",
      );
    } finally {
      setGpsCapturing(
        false,
      );
    }
  }


  async function onPhotoFile(
    file:
      | File
      | undefined,
  ) {
    if (!file) {
      return;
    }


    setPhotoBusy(
      true,
    );

    setSubmitError(
      null,
    );


    try {
      const compressed =
        await compressPhoto(
          file,
        );


      if (
        !compressed.startsWith(
          "data:image/jpeg;base64,",
        )
      ) {
        throw new Error(
          "La photo produite n’est pas un JPEG valide.",
        );
      }


      if (
        dataUrlByteLength(
          compressed,
        )
        > PHOTO_MAX_BYTES
      ) {
        throw new Error(
          "La photo dépasse la limite de 500 KiB.",
        );
      }


      setPhoto(
        compressed,
      );

      toast.success(
        "Photo prête",
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Impossible de préparer la photo.",
      );
    } finally {
      setPhotoBusy(
        false,
      );
    }
  }


  function confirmBeacon(
    rawValue?: string,
  ) {
    if (!task) {
      return false;
    }


    const entered =
      canonicalizeAgentV1Confirmation(
        rawValue
          ?? beaconInput,
        task.beacon.public_number,
      );

    const expected =
      task
        .beacon
        .public_number
        .trim()
        .toUpperCase();


    if (
      !entered
      || entered !== expected
    ) {
      setBeaconConfirmed(
        false,
      );

      toast.error(
        "Le numéro saisi ne correspond pas à la balise Adresse GN assignée.",
      );

      return false;
    }


    setBeaconInput(
      formatAgentV1AddressNumber(
        expected,
      ),
    );

    setBeaconConfirmed(
      true,
    );

    toast.success(
      "Balise confirmée",
    );

    return true;
  }


  function detailsValid() {
    if (!task) {
      return false;
    }


    if (
      !details
        .category
        .trim()
    ) {
      return false;
    }


    if (
      !details
        .name
        .trim()
    ) {
      return false;
    }


    if (
      task
        .installation_requirements
        .access_point_note_required
      && !details
        .accessPointNote
        .trim()
    ) {
      return false;
    }


    if (
      details.consent
      !== true
    ) {
      return false;
    }


    return true;
  }


  function canAdvance() {
    if (
      step === 1
    ) {
      return beaconConfirmed;
    }


    if (
      step === 2
    ) {
      return (
        measures.length
        === GPS_MEASURE_COUNT
        && measures.every(
          (
            measure,
          ) =>
            measure
              .accuracy_m
            <= GPS_MAX_ACCURACY_M,
        )
      );
    }


    if (
      step === 3
    ) {
      return Boolean(
        photo,
      );
    }


    if (
      step === 4
    ) {
      return detailsValid();
    }


    return true;
  }


  function nextStep() {
    if (
      !canAdvance()
    ) {
      return;
    }


    setStep(
      (
        current,
      ) =>
        Math.min(
          5,
          current + 1,
        ) as Step,
    );
  }


  function previousStep() {
    setStep(
      (
        current,
      ) =>
        Math.max(
          1,
          current - 1,
        ) as Step,
    );
  }


  async function submit() {
    if (
      !task
      || !photo
      || !clientUuid
      || !detailsValid()
      || measures.length
        !== GPS_MEASURE_COUNT
    ) {
      setSubmitError(
        "Le dossier de pose n’est pas complet.",
      );

      return;
    }


    if (
      measures.some(
        (
          measure,
        ) =>
          measure
            .accuracy_m
          > GPS_MAX_ACCURACY_M,
      )
    ) {
      setSubmitError(
        "Une des mesures GPS dépasse 3,0 m.",
      );

      return;
    }


    setSubmitting(
      true,
    );

    setSubmitError(
      null,
    );


    try {
      const token =
        await getAccessToken();


      if (!token) {
        router.replace(
          "/agent/login",
        );

        return;
      }


      const payload:
        AgentCompletePayload =
          {
            client_uuid:
              clientUuid,

            measures: [
              measures[0]!,
              measures[1]!,
              measures[2]!,
            ],

            photo_base64:
              photo,

            category:
              details
                .category
                .trim(),

            name:
              details
                .name
                .trim(),

            visibility:
              "private",

            access_point_note:
              details
                .accessPointNote
                .trim()
                || null,

            owner_name:
              null,

            owner_phone:
              null,

            consent:
              true,
          };


      const response =
        await completeAgentTask(
          pendingInstallationId,
          token,
          payload,
        );


      if (
        response.status
        !== "installed"
      ) {
        throw new Error(
          "Réponse de pose inattendue.",
        );
      }


      clearClientUuid(
        pendingInstallationId,
      );

      stopGpsWatch();

      setCompleted(
        true,
      );
    } catch (error) {
      if (
        error instanceof
          AgentApiError
        && (
          error.statusCode
            === 401
          || error.statusCode
            === 403
        )
      ) {
        router.replace(
          "/agent/login",
        );

        return;
      }


      setSubmitError(
        error instanceof Error
          ? error.message
          : "Impossible d’enregistrer la pose.",
      );
    } finally {
      setSubmitting(
        false,
      );
    }
  }


  if (loading) {
    return (
      <div
        className="
          mx-auto
          flex
          min-h-[60dvh]
          max-w-xl
          items-center
          justify-center
          px-4
        "
      >
        <Loader2
          className="
            h-8
            w-8
            animate-spin
            text-slate-500
          "
        />
      </div>
    );
  }


  if (
    loadError
    || !task
  ) {
    return (
      <div
        className="
          mx-auto
          max-w-xl
          px-4
          py-10
        "
      >
        <div
          className="
            rounded-2xl
            border
            border-amber-200
            bg-amber-50
            p-5
          "
        >
          <h1
            className="
              font-semibold
              text-amber-950
            "
          >
            Intervention indisponible
          </h1>

          <p
            className="
              mt-2
              text-sm
              text-amber-800
            "
          >
            {loadError
              ?? "Cette tâche n’est plus disponible."}
          </p>

          <button
            type="button"
            onClick={() =>
              router.push(
                "/agent/tasks",
              )
            }
            className="
              mt-5
              inline-flex
              h-11
              items-center
              justify-center
              rounded-xl
              bg-slate-950
              px-4
              text-sm
              font-semibold
              text-white
            "
          >
            Retour aux tâches
          </button>
        </div>
      </div>
    );
  }


  if (completed) {
    return (
      <div
        className="
          mx-auto
          flex
          min-h-[70dvh]
          max-w-xl
          flex-col
          items-center
          justify-center
          px-4
          text-center
        "
      >
        <div
          className="
            flex
            h-24
            w-24
            items-center
            justify-center
            rounded-full
            bg-emerald-100
          "
        >
          <CheckCircle2
            className="
              h-12
              w-12
              text-emerald-600
            "
          />
        </div>

        <h1
          className="
            mt-6
            text-2xl
            font-bold
            text-slate-950
          "
        >
          Pose enregistrée
        </h1>

        <p
          className="
            mt-2
            max-w-md
            text-sm
            leading-6
            text-slate-600
          "
        >
          La balise{" "}
          <strong>
            {formatAgentV1AddressNumber(task.beacon.public_number)}
          </strong>{" "}
          a été enregistrée. L’adresse reste privée
          et non vérifiée jusqu?au contrôle qualité.
        </p>

        <button
          type="button"
          onClick={() =>
            router.replace(
              "/agent/tasks",
            )
          }
          className="
            mt-7
            inline-flex
            h-12
            items-center
            justify-center
            rounded-xl
            bg-slate-950
            px-6
            font-semibold
            text-white
          "
        >
          Retour aux tâches
        </button>
      </div>
    );
  }


  const avgLat =
    measures.length
      ? mean(
          measures.map(
            (
              measure,
            ) =>
              measure.lat,
          ),
        )
      : null;

  const avgLng =
    measures.length
      ? mean(
          measures.map(
            (
              measure,
            ) =>
              measure.lng,
          ),
        )
      : null;

  const avgAccuracy =
    measures.length
      ? mean(
          measures.map(
            (
              measure,
            ) =>
              measure
                .accuracy_m,
          ),
        )
      : null;


  return (
    <div
      className="
        mx-auto
        w-full
        max-w-2xl
        px-4
        pb-28
        pt-5
      "
    >
      <div
        className="
          mb-5
          flex
          items-center
          gap-3
        "
      >
        <button
          type="button"
          aria-label="Retour aux tâches"
          onClick={() =>
            router.push(
              "/agent/tasks",
            )
          }
          className="
            flex
            h-10
            w-10
            shrink-0
            items-center
            justify-center
            rounded-xl
            border
            border-slate-200
            bg-white
          "
        >
          <ArrowLeft
            className="
              h-4
              w-4
            "
          />
        </button>

        <div
          className="
            min-w-0
          "
        >
          <p
            className="
              text-xs
              font-semibold
              uppercase
              tracking-[0.12em]
              text-slate-500
            "
          >
            Installation terrain
          </p>

          <h1
            className="
              truncate
              text-lg
              font-bold
              text-slate-950
            "
          >
            {formatAgentV1AddressNumber(task.beacon.public_number)}
          </h1>
        </div>
      </div>


      <StepIndicator
        step={step}
      />


      <div className="mt-5">
        {step === 1 ? (
          <AgentInstallStepBeacon
            expectedDisplay={
              formatAgentV1AddressNumber(
                task.beacon.public_number,
              )
            }
            confirmed={
              beaconConfirmed
            }
            value={
              beaconInput
            }
            onValueChange={(
              value,
            ) => {
              setBeaconInput(
                formatAgentV1ConfirmationInput(
                  value,
                  task.beacon.public_number,
                ),
              );

              setBeaconConfirmed(
                false,
              );
            }}
            onVerify={(
              value,
            ) =>
              confirmBeacon(
                value,
              )
            }
          />
        ) : null}


        {step === 2 ? (
          <AgentInstallStepGps
            currentAccuracy={
              currentAccuracy
            }
            maxAccuracyM={
              GPS_MAX_ACCURACY_M
            }
            measureCount={
              GPS_MEASURE_COUNT
            }
            measures={
              measures
            }
            watching={
              gpsWatching
            }
            capturing={
              gpsCapturing
            }
            message={
              gpsMessage
            }
            captureDisabled={
              gpsCapturing
              || currentAccuracy === null
              || currentAccuracy > GPS_MAX_ACCURACY_M
            }
            onStartWatch={
              startGpsWatch
            }
            onStopWatch={
              stopGpsWatch
            }
            onCapture={() => {
              void captureGps();
            }}
          />
        ) : null}


        {step === 3 ? (
          <div
            className="
              space-y-5
            "
          >
            <div
              className="
                text-center
              "
            >
              <Camera
                className="
                  mx-auto
                  h-10
                  w-10
                  text-sky-600
                "
              />

              <h2
                className="
                  mt-3
                  text-xl
                  font-bold
                  text-slate-950
                "
              >
                Photo de la pose
              </h2>

              <p
                className="
                  mt-1
                  text-sm
                  text-slate-600
                "
              >
                Photographiez la balise installée et son environnement immédiat.
              </p>
            </div>

            <input
              ref={
                photoInputRef
              }
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(
                event,
              ) => {
                void onPhotoFile(
                  event
                    .target
                    .files?.[0],
                );

                event
                  .currentTarget
                  .value = "";
              }}
            />

            {photo ? (
              <div
                className="
                  overflow-hidden
                  rounded-2xl
                  border
                  border-emerald-200
                "
              >
                <img
                  src={photo}
                  alt="Aperçu de la pose"
                  className="
                    h-72
                    w-full
                    object-cover
                  "
                />

                <div
                  className="
                    bg-emerald-50
                    px-4
                    py-3
                    text-sm
                    font-semibold
                    text-emerald-700
                  "
                >
                  JPEG prêt à{" "}
                  {Math.ceil(
                    dataUrlByteLength(
                      photo,
                    )
                    / 1024,
                  )} KiB
                </div>
              </div>
            ) : (
              <div
                className="
                  rounded-2xl
                  border-2
                  border-dashed
                  border-slate-200
                  bg-slate-50
                  py-14
                  text-center
                  text-sm
                  text-slate-500
                "
              >
                Aucune photo
              </div>
            )}

            <button
              type="button"
              disabled={
                photoBusy
              }
              onClick={() =>
                photoInputRef
                  .current
                  ?.click()
              }
              className="
                flex
                h-12
                w-full
                items-center
                justify-center
                rounded-xl
                bg-sky-600
                font-semibold
                text-white
                disabled:opacity-50
              "
            >
              {photoBusy ? (
                <>
                  <Loader2
                    className="
                      mr-2
                      h-4
                      w-4
                      animate-spin
                    "
                  />
                  Compression?
                </>
              ) : (
                <>
                  <Camera
                    className="
                      mr-2
                      h-4
                      w-4
                    "
                  />
                  {photo
                    ? "Reprendre la photo"
                    : "Prendre la photo"}
                </>
              )}
            </button>
          </div>
        ) : null}


        {step === 4 ? (
          <div
            className="
              space-y-5
            "
          >
            <div>
              <h2
                className="
                  text-xl
                  font-bold
                  text-slate-950
                "
              >
                Détails de l’adresse
              </h2>

              <p
                className="
                  mt-1
                  text-sm
                  text-slate-600
                "
              >
                Ces informations seront associées à l&apos;adresse préallouée.
              </p>
            </div>

            <div>
              <label
                htmlFor="agent-category"
                className="
                  text-sm
                  font-semibold
                  text-slate-700
                "
              >
                Catégorie
              </label>

              <select
                id="agent-category"
                value={
                  details.category
                }
                onChange={(
                  event,
                ) =>
                  setDetails(
                    (
                      previous,
                    ) => ({
                      ...previous,

                      category:
                        event
                          .target
                          .value,
                    }),
                  )
                }
                className="
                  mt-2
                  h-12
                  w-full
                  rounded-xl
                  border
                  border-slate-300
                  bg-white
                  px-4
                "
              >
                {CATEGORIES.map(
                  (
                    [
                      value,
                      label,
                    ],
                  ) => (
                    <option
                      key={value}
                      value={value}
                    >
                      {label}
                    </option>
                  ),
                )}
              </select>
            </div>

            <div>
              <label
                htmlFor="agent-place-name"
                className="
                  text-sm
                  font-semibold
                  text-slate-700
                "
              >
                Nom du lieu *
              </label>

              <input
                id="agent-place-name"
                value={
                  details.name
                }
                onChange={(
                  event,
                ) =>
                  setDetails(
                    (
                      previous,
                    ) => ({
                      ...previous,

                      name:
                        event
                          .target
                          .value,
                    }),
                  )
                }
                placeholder="Ex. Maison Barry"
                className="
                  mt-2
                  h-12
                  w-full
                  rounded-xl
                  border
                  border-slate-300
                  px-4
                "
              />
            </div>

            <div>
              <label
                htmlFor="agent-access-note"
                className="
                  text-sm
                  font-semibold
                  text-slate-700
                "
              >
                Point d’accès
                {task
                  .installation_requirements
                  .access_point_note_required
                  ? " *"
                  : " ? optionnel"}
              </label>

              <textarea
                id="agent-access-note"
                rows={3}
                value={
                  details
                    .accessPointNote
                }
                onChange={(
                  event,
                ) =>
                  setDetails(
                    (
                      previous,
                    ) => ({
                      ...previous,

                      accessPointNote:
                        event
                          .target
                          .value,
                    }),
                  )
                }
                placeholder="Ex. Portail bleu à droite du bâtiment"
                className="
                  mt-2
                  w-full
                  rounded-xl
                  border
                  border-slate-300
                  p-3
                "
              />
            </div>

            <div
              className="
                rounded-xl
                border
                border-slate-200
                bg-slate-50
                p-4
              "
            >
              <div
                className="
                  text-sm
                  font-semibold
                  text-slate-800
                "
              >
                Visibilité
              </div>

              <div
                className="
                  mt-1
                  text-sm
                  text-slate-600
                "
              >
                Privée pendant la pose et le contrôle qualité.
              </div>
            </div>

            <label
              className="
                flex
                cursor-pointer
                items-start
                gap-3
                rounded-xl
                border
                border-slate-200
                p-4
              "
            >
              <input
                type="checkbox"
                checked={
                  details.consent
                }
                onChange={(
                  event,
                ) =>
                  setDetails(
                    (
                      previous,
                    ) => ({
                      ...previous,

                      consent:
                        event
                          .target
                          .checked,
                    }),
                  )
                }
                className="
                  mt-1
                  h-4
                  w-4
                "
              />

              <div>
                <div
                  className="
                    flex
                    items-center
                    gap-2
                    text-sm
                    font-semibold
                    text-slate-900
                  "
                >
                  <ShieldCheck
                    className="
                      h-4
                      w-4
                      text-emerald-600
                    "
                  />

                  Consentement obtenu *
                </div>

                <p
                  className="
                    mt-1
                    text-xs
                    leading-5
                    text-slate-600
                  "
                >
                  Le responsable du lieu consent à l&apos;enregistrement de cette adresse.
                </p>
              </div>
            </label>
          </div>
        ) : null}


        {step === 5 ? (
          <div
            className="
              space-y-5
            "
          >
            <div>
              <h2
                className="
                  text-xl
                  font-bold
                  text-slate-950
                "
              >
                Résumé de la pose
              </h2>

              <p
                className="
                  mt-1
                  text-sm
                  text-slate-600
                "
              >
                Vérifiez les données avant l&apos;enregistrement.
              </p>
            </div>

            <div
              className="
                divide-y
                divide-slate-100
                overflow-hidden
                rounded-xl
                border
                border-slate-200
              "
            >
              <div
                className="
                  flex
                  justify-between
                  gap-4
                  p-4
                  text-sm
                "
              >
                <span
                  className="
                    text-slate-500
                  "
                >
                  Balise
                </span>

                <strong
                  className="
                    font-mono
                  "
                >
                  {formatAgentV1AddressNumber(task.beacon.public_number)}
                </strong>
              </div>

              <div
                className="
                  flex
                  justify-between
                  gap-4
                  p-4
                  text-sm
                "
              >
                <span
                  className="
                    text-slate-500
                  "
                >
                  Mesures GPS
                </span>

                <strong>
                  {measures.length}/3
                </strong>
              </div>

              <div
                className="
                  flex
                  justify-between
                  gap-4
                  p-4
                  text-sm
                "
              >
                <span
                  className="
                    text-slate-500
                  "
                >
                  Position moyenne
                </span>

                <strong
                  className="
                    text-right
                    font-mono
                    text-xs
                  "
                >
                  {avgLat?.toFixed(
                    7,
                  )}
                  <br />
                  {avgLng?.toFixed(
                    7,
                  )}
                </strong>
              </div>

              <div
                className="
                  flex
                  justify-between
                  gap-4
                  p-4
                  text-sm
                "
              >
                <span
                  className="
                    text-slate-500
                  "
                >
                  Précision moyenne
                </span>

                <strong>
                  ?
                  {avgAccuracy?.toFixed(
                    2,
                  )} m
                </strong>
              </div>

              <div
                className="
                  flex
                  justify-between
                  gap-4
                  p-4
                  text-sm
                "
              >
                <span
                  className="
                    text-slate-500
                  "
                >
                  Photo
                </span>

                <strong>
                  JPEG ?{" "}
                  {photo
                    ? Math.ceil(
                        dataUrlByteLength(
                          photo,
                        )
                        / 1024,
                      )
                    : 0} KiB
                </strong>
              </div>

              <div
                className="
                  flex
                  justify-between
                  gap-4
                  p-4
                  text-sm
                "
              >
                <span
                  className="
                    text-slate-500
                  "
                >
                  Catégorie
                </span>

                <strong>
                  {details.category}
                </strong>
              </div>

              <div
                className="
                  flex
                  justify-between
                  gap-4
                  p-4
                  text-sm
                "
              >
                <span
                  className="
                    text-slate-500
                  "
                >
                  Nom
                </span>

                <strong
                  className="
                    text-right
                  "
                >
                  {details.name}
                </strong>
              </div>

              <div
                className="
                  flex
                  justify-between
                  gap-4
                  p-4
                  text-sm
                "
              >
                <span
                  className="
                    text-slate-500
                  "
                >
                  Visibilité
                </span>

                <strong>
                  Privée
                </strong>
              </div>
            </div>

            {submitError ? (
              <div
                className="
                  rounded-xl
                  border
                  border-rose-200
                  bg-rose-50
                  p-3
                  text-sm
                  text-rose-700
                "
              >
                {submitError}
              </div>
            ) : null}

            <button
              type="button"
              disabled={
                submitting
              }
              onClick={() =>
                void submit()
              }
              className="
                flex
                h-14
                w-full
                items-center
                justify-center
                rounded-xl
                bg-emerald-600
                text-base
                font-bold
                text-white
                disabled:opacity-50
              "
            >
              {submitting ? (
                <>
                  <Loader2
                    className="
                      mr-2
                      h-5
                      w-5
                      animate-spin
                    "
                  />

                  Enregistrement…
                </>
              ) : (
                <>
                  <CheckCircle2
                    className="
                      mr-2
                      h-5
                      w-5
                    "
                  />

                  Enregistrer la pose
                </>
              )}
            </button>
          </div>
        ) : null}
      </div>


      <div className="mt-6 pb-3">
        <div
          className="
            mx-auto
            flex
            max-w-2xl
            gap-3
            rounded-[22px]
            border
            border-slate-200/80
            bg-white/90
            p-2
            shadow-[0_10px_30px_rgba(15,23,42,0.06)]
            backdrop-blur
          "
        >
          {step > 1 ? (
            <button
              type="button"
              onClick={
                previousStep
              }
              disabled={
                submitting
              }
              className="
                flex
                h-12
                flex-1
                items-center
                justify-center
                rounded-2xl
                border
                border-slate-200
                bg-white
                font-bold
                text-slate-700
                shadow-sm
                transition
                hover:bg-slate-50
              "
            >
              <ArrowLeft
                className="
                  mr-2
                  h-4
                  w-4
                "
              />

              Précédent
            </button>
          ) : null}

          {step < 5 ? (
            <button
              type="button"
              disabled={
                !canAdvance()
              }
              onClick={
                nextStep
              }
              className="
                flex
                h-12
                flex-1
                items-center
                justify-center
                rounded-2xl
                bg-gradient-to-r
                from-indigo-600
                to-blue-600
                font-bold
                text-white
                shadow-md
                shadow-blue-500/15
                transition
                hover:from-indigo-700
                hover:to-blue-700
                disabled:cursor-not-allowed
                disabled:shadow-none
                disabled:opacity-35
              "
            >
              Continuer

              <ArrowRight
                className="
                  ml-2
                  h-4
                  w-4
                "
              />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
