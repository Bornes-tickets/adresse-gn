"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  ExternalLink,
  Pencil,
  Trash2,
  Truck,
} from "lucide-react";

import {
  QRCodeCanvas,
} from "qrcode.react";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";

import {
  toast,
} from "sonner";

import {
  Badge,
} from "@/components/ui/badge";

import {
  Button,
} from "@/components/ui/button";

import {
  Card,
  CardContent,
} from "@/components/ui/card";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  type OwnerBeacon,
  OwnerApiError,
  createOwnerMovingReport,
  listOwnerBeacons,
  suspendOwnerBeacon,
  updateOwnerBeacon,
} from "../api";


const CATEGORY_OPTIONS = [
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
    "Santé",
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


function categoryLabel(
  category: string,
) {
  return (
    CATEGORY_OPTIONS.find(
      ([value]) =>
        value === category,
    )?.[1]
    ?? category
  );
}


function SearchLineChart({
  beacon,
}: {
  beacon: OwnerBeacon;
}) {
  return (
    <div
      className="
        h-24 w-full
      "
    >
      <ResponsiveContainer
        width="100%"
        height="100%"
      >
        <LineChart
          data={
            beacon.searches_30d
          }
        >
          <XAxis
            dataKey="day"
            hide
          />

          <Tooltip
            labelFormatter={(
              value,
            ) =>
              new Date(
                String(value),
              ).toLocaleDateString(
                "fr-FR",
              )
            }
            formatter={(
              value,
            ) => [
              `${value} recherche(s)`,
              "",
            ]}
          />

          <Line
            type="monotone"
            dataKey="count"
            stroke="var(--primary)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}


export function OwnerBeaconsPage() {
  const [
    items,
    setItems,
  ] = useState<
    OwnerBeacon[]
  >([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    editing,
    setEditing,
  ] = useState<
    OwnerBeacon | null
  >(null);

  const [
    qr,
    setQr,
  ] = useState<
    OwnerBeacon | null
  >(null);

  const [
    suspending,
    setSuspending,
  ] = useState<
    OwnerBeacon | null
  >(null);

  const [
    moving,
    setMoving,
  ] = useState<
    OwnerBeacon | null
  >(null);


  const load =
    useCallback(
      async (
        signal?: AbortSignal,
      ) => {
        setLoading(
          true,
        );

        try {
          const token =
            await getAccessToken();

          if (!token) {
            window.location.href =
              "/login?returnTo=%2Fmon-compte%2Fbeacons";

            return;
          }

          const data =
            await listOwnerBeacons(
              token,
              signal,
            );

          if (
            !signal?.aborted
          ) {
            setItems(
              data,
            );
          }

        } catch (error) {
          if (
            signal?.aborted
          ) {
            return;
          }

          if (
            error instanceof
              OwnerApiError
            &&
            error.statusCode ===
              401
          ) {
            window.location.href =
              "/login?returnTo=%2Fmon-compte%2Fbeacons";

            return;
          }

          toast.error(
            error instanceof Error
              ? error.message
              : (
                  "Impossible de "
                  + "charger vos balises."
                ),
          );

        } finally {
          if (
            !signal?.aborted
          ) {
            setLoading(
              false,
            );
          }
        }
      },
      [],
    );


  useEffect(() => {
    const controller =
      new AbortController();

    void load(
      controller.signal,
    );

    return () => {
      controller.abort();
    };
  }, [load]);


  return (
    <div
      className="
        space-y-6
      "
    >
      <div>
        <h1
          className="
            text-2xl
            font-semibold
            text-foreground
          "
        >
          Mes balises
        </h1>

        <p
          className="
            text-sm
            text-muted-foreground
          "
        >
          Les adresses dont vous êtes propriétaire enregistré.
        </p>
      </div>

      {loading && (
        <div
          className="
            h-40 w-full
            animate-pulse
            rounded-xl
            bg-muted
          "
        />
      )}

      {!loading &&
        items.length === 0 && (
          <Card>
            <CardContent
              className="
                pt-6
                text-sm
                text-muted-foreground
              "
            >
              Vous ne possédez encore aucune balise. Depuis la fiche publique d&apos;une adresse, utilisez « Ceci est mon adresse ? » pour en réclamer la propriété.
            </CardContent>
          </Card>
        )}

      <div
        className="
          space-y-4
        "
      >
        {items.map(
          (beacon) => (
            <Card
              key={
                beacon.address_id
              }
            >
              <CardContent
                className="
                  space-y-4
                  pt-6
                "
              >
                <div
                  className="
                    flex flex-wrap
                    items-start
                    justify-between
                    gap-3
                  "
                >
                  <div
                    className="
                      space-y-1
                    "
                  >
                    <p
                      className="
                        font-mono
                        text-sm
                        text-primary
                      "
                    >
                      {
                        beacon
                          .public_number
                      }
                    </p>

                    <p
                      className="
                        font-medium
                        text-foreground
                      "
                    >
                      {
                        beacon.name
                        ?? "Sans nom"
                      }
                    </p>

                    <div
                      className="
                        flex flex-wrap
                        gap-2
                      "
                    >
                      <Badge
                        variant="secondary"
                      >
                        {categoryLabel(
                          beacon.category,
                        )}
                      </Badge>

                      <Badge
                        variant={
                          beacon
                            .visibility ===
                          "public"
                            ? "default"
                            : "outline"
                        }
                      >
                        {
                          beacon
                            .visibility ===
                          "public"
                            ? "Publique"
                            : "Privée"
                        }
                      </Badge>

                      {beacon.status !==
                        "active" && (
                        <Badge
                          variant="destructive"
                        >
                          Suspendue
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div
                    className="
                      flex flex-wrap
                      gap-2
                    "
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                    >
                      <a
                        href={
                          `/a/${beacon.public_number}`
                        }
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink
                          className="
                            size-4
                          "
                        />

                        Carte
                      </a>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setEditing(
                          beacon
                        )
                      }
                    >
                      <Pencil
                        className="
                          size-4
                        "
                      />

                      Modifier
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setQr(
                          beacon
                        )
                      }
                    >
                      QR
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setMoving(
                          beacon
                        )
                      }
                    >
                      <Truck
                        className="
                          size-4
                        "
                      />

                      Déménagement
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={
                        beacon.status ===
                        "suspended"
                      }
                      onClick={() =>
                        setSuspending(
                          beacon
                        )
                      }
                    >
                      <Trash2
                        className="
                          size-4
                          text-destructive
                        "
                      />
                    </Button>
                  </div>
                </div>

                <SearchLineChart
                  beacon={
                    beacon
                  }
                />

                <p
                  className="
                    text-xs
                    text-muted-foreground
                  "
                >
                  Recherches sur les 30 derniers jours
                </p>
              </CardContent>
            </Card>
          ),
        )}
      </div>

      <EditBeaconDialog
        beacon={editing}
        onClose={() =>
          setEditing(null)
        }
        onSaved={() =>
          load()
        }
      />

      <QrDialog
        beacon={qr}
        onClose={() =>
          setQr(null)
        }
      />

      <MovingDialog
        beacon={moving}
        onClose={() =>
          setMoving(null)
        }
      />

      <SuspendDialog
        beacon={suspending}
        onClose={() =>
          setSuspending(null)
        }
        onSaved={() =>
          load()
        }
      />
    </div>
  );
}


function EditBeaconDialog({
  beacon,
  onClose,
  onSaved,
}: {
  beacon: OwnerBeacon | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [
    name,
    setName,
  ] = useState("");

  const [
    category,
    setCategory,
  ] = useState(
    "habitation",
  );

  const [
    visibility,
    setVisibility,
  ] = useState<
    "public" | "private"
  >("public");

  const [
    note,
    setNote,
  ] = useState("");

  const [
    saving,
    setSaving,
  ] = useState(false);


  useEffect(() => {
    if (!beacon) {
      return;
    }

    setName(
      beacon.name ?? ""
    );

    setCategory(
      beacon.category
    );

    setVisibility(
      beacon.visibility ===
        "private"
        ? "private"
        : "public",
    );

    setNote(
      beacon
        .access_point_note
      ?? "",
    );
  }, [beacon]);


  async function save() {
    if (!beacon) {
      return;
    }

    setSaving(
      true,
    );

    try {
      const token =
        await getAccessToken();

      if (!token) {
        throw new Error(
          "Authentification requise."
        );
      }

      await updateOwnerBeacon(
        token,
        beacon.address_id,
        {
          name:
            name.trim()
            || null,

          category,

          visibility,

          access_point_note:
            note.trim()
            || null,
        },
      );

      toast.success(
        "Balise mise à jour.",
      );

      onClose();
      onSaved();

    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : (
              "Modification impossible."
            ),
      );

    } finally {
      setSaving(
        false,
      );
    }
  }


  return (
    <Dialog
      open={
        beacon !== null
      }
      onOpenChange={(
        open,
      ) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent
        className="
          max-h-[90dvh]
          w-[calc(100vw-2rem)]
          max-w-lg
          overflow-y-auto
          sm:w-full
        "
      >
        <DialogHeader>
          <DialogTitle>
            Modifier {
              beacon
                ?.public_number
            }
          </DialogTitle>
        </DialogHeader>

        <div
          className="
            space-y-4
          "
        >
          <div
            className="
              space-y-2
            "
          >
            <Label htmlFor="owner-name">
              Nom du lieu
            </Label>

            <Input
              id="owner-name"
              value={name}
              maxLength={120}
              onChange={(
                event,
              ) =>
                setName(
                  event
                    .target
                    .value,
                )
              }
            />
          </div>

          <div
            className="
              space-y-2
            "
          >
            <Label htmlFor="owner-category">
              Catégorie
            </Label>

            <select
              id="owner-category"
              value={category}
              onChange={(
                event,
              ) =>
                setCategory(
                  event
                    .target
                    .value,
                )
              }
              className="
                flex h-9 w-full
                rounded-md
                border
                border-input
                bg-transparent
                px-3 py-1
                text-sm
                shadow-xs
                outline-none
                focus-visible:
                border-ring
                focus-visible:
                ring-[3px]
                focus-visible:
                ring-ring/50
              "
            >
              {CATEGORY_OPTIONS.map(
                ([
                  value,
                  label,
                ]) => (
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

          <div
            className="
              space-y-2
            "
          >
            <Label htmlFor="owner-visibility">
              Visibilité
            </Label>

            <select
              id="owner-visibility"
              value={visibility}
              onChange={(
                event,
              ) =>
                setVisibility(
                  event
                    .target
                    .value ===
                    "private"
                      ? "private"
                      : "public",
                )
              }
              className="
                flex h-9 w-full
                rounded-md
                border
                border-input
                bg-transparent
                px-3 py-1
                text-sm
                shadow-xs
                outline-none
                focus-visible:
                border-ring
                focus-visible:
                ring-[3px]
                focus-visible:
                ring-ring/50
              "
            >
              <option value="public">
                Publique
              </option>

              <option value="private">
                Privée
              </option>
            </select>
          </div>

          <div
            className="
              space-y-2
            "
          >
            <Label htmlFor="owner-note">
              Indication d&apos;accès
            </Label>

            <Textarea
              id="owner-note"
              value={note}
              rows={3}
              maxLength={400}
              onChange={(
                event,
              ) =>
                setNote(
                  event
                    .target
                    .value,
                )
              }
            />
          </div>
        </div>

        <DialogFooter
          className="
            flex-col gap-2
            sm:flex-row
          "
        >
          <Button
            variant="outline"
            onClick={
              onClose
            }
            className="
              w-full sm:w-auto
            "
          >
            Annuler
          </Button>

          <Button
            onClick={
              save
            }
            disabled={
              saving
            }
            className="
              w-full sm:w-auto
            "
          >
            {
              saving
                ? "Enregistrement…"
                : "Enregistrer"
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function QrDialog({
  beacon,
  onClose,
}: {
  beacon: OwnerBeacon | null;
  onClose: () => void;
}) {
  const wrapper =
    useRef<HTMLDivElement>(
      null
    );


  function download() {
    const canvas =
      wrapper.current
        ?.querySelector(
          "canvas"
        );

    if (
      !canvas
      || !beacon
    ) {
      return;
    }

    const link =
      document.createElement(
        "a"
      );

    link.href =
      canvas.toDataURL(
        "image/png"
      );

    link.download =
      `${beacon.public_number}.png`;

    link.click();
  }


  const origin =
    typeof window !==
    "undefined"
      ? window.location.origin
      : "";


  return (
    <Dialog
      open={
        beacon !== null
      }
      onOpenChange={(
        open,
      ) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent
        className="
          max-h-[90dvh]
          w-[calc(100vw-2rem)]
          max-w-sm
          overflow-y-auto
          sm:w-full
        "
      >
        <DialogHeader>
          <DialogTitle>
            QR code · {
              beacon
                ?.public_number
            }
          </DialogTitle>
        </DialogHeader>

        <div
          ref={wrapper}
          className="
            flex
            justify-center
            py-4
          "
        >
          {beacon && (
            <QRCodeCanvas
              value={
                `${origin}/a/`
                + beacon
                  .public_number
              }
              size={220}
              includeMargin
            />
          )}
        </div>

        <DialogFooter
          className="
            flex-col gap-2
            sm:flex-row
          "
        >
          <Button
            onClick={
              download
            }
            className="
              w-full sm:w-auto
            "
          >
            Télécharger en PNG
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function MovingDialog({
  beacon,
  onClose,
}: {
  beacon: OwnerBeacon | null;
  onClose: () => void;
}) {
  const [
    details,
    setDetails,
  ] = useState("");

  const [
    sending,
    setSending,
  ] = useState(false);


  useEffect(() => {
    if (beacon) {
      setDetails("");
    }
  }, [beacon]);


  async function send() {
    if (!beacon) {
      return;
    }

    setSending(
      true,
    );

    try {
      const token =
        await getAccessToken();

      if (!token) {
        throw new Error(
          "Authentification requise."
        );
      }

      await createOwnerMovingReport(
        token,
        beacon.address_id,
        details.trim()
          || null,
      );

      toast.success(
        "Déménagement signalé : notre équipe vous contactera.",
      );

      setDetails("");
      onClose();

    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : (
              "Signalement impossible."
            ),
      );

    } finally {
      setSending(
        false,
      );
    }
  }


  return (
    <Dialog
      open={
        beacon !== null
      }
      onOpenChange={(
        open,
      ) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent
        className="
          max-h-[90dvh]
          w-[calc(100vw-2rem)]
          max-w-lg
          overflow-y-auto
          sm:w-full
        "
      >
        <DialogHeader>
          <DialogTitle>
            Signaler un déménagement
          </DialogTitle>
        </DialogHeader>

        <Textarea
          value={details}
          rows={4}
          maxLength={1000}
          placeholder="Nouvelle localisation, date prévue…"
          onChange={(
            event,
          ) =>
            setDetails(
              event
                .target
                .value,
            )
          }
        />

        <DialogFooter
          className="
            flex-col gap-2
            sm:flex-row
          "
        >
          <Button
            variant="outline"
            onClick={
              onClose
            }
            className="
              w-full sm:w-auto
            "
          >
            Annuler
          </Button>

          <Button
            onClick={
              send
            }
            disabled={
              sending
            }
            className="
              w-full sm:w-auto
            "
          >
            {
              sending
                ? "Envoi…"
                : "Envoyer"
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function SuspendDialog({
  beacon,
  onClose,
  onSaved,
}: {
  beacon: OwnerBeacon | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [
    saving,
    setSaving,
  ] = useState(false);


  async function suspend() {
    if (!beacon) {
      return;
    }

    setSaving(
      true,
    );

    try {
      const token =
        await getAccessToken();

      if (!token) {
        throw new Error(
          "Authentification requise."
        );
      }

      await suspendOwnerBeacon(
        token,
        beacon.address_id,
      );

      toast.success(
        "Balise suspendue.",
      );

      onClose();
      onSaved();

    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : (
              "Suspension impossible."
            ),
      );

    } finally {
      setSaving(
        false,
      );
    }
  }


  return (
    <Dialog
      open={
        beacon !== null
      }
      onOpenChange={(
        open,
      ) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent
        className="
          max-w-lg
        "
      >
        <DialogHeader>
          <DialogTitle>
            Suspendre cette adresse ?
          </DialogTitle>
        </DialogHeader>

        <p
          className="
            text-sm
            text-muted-foreground
          "
        >
          L&apos;adresse {
            beacon
              ?.public_number
          } ne sera plus visible publiquement. Les données et l&apos;historique sont conservés.
        </p>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={
              onClose
            }
            disabled={
              saving
            }
          >
            Annuler
          </Button>

          <Button
            onClick={
              suspend
            }
            disabled={
              saving
            }
          >
            {
              saving
                ? "Suspension…"
                : "Confirmer"
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}