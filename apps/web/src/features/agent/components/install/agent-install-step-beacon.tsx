"use client";

import {
  CheckCircle2,
  Keyboard,
  QrCode,
  Radio,
  Sparkles,
  XCircle,
} from "lucide-react";

import {
  useMemo,
  useState,
} from "react";

import {
  QrScanner,
} from "@/components/QrScanner";

import {
  Button,
} from "@/components/ui/button";

import {
  Card,
  CardContent,
} from "@/components/ui/card";

import {
  Input,
} from "@/components/ui/input";

import {
  Label,
} from "@/components/ui/label";

import {
  extractAddressNumberFromQr,
} from "@/features/home/address-input";


export function AgentInstallStepBeacon({
  expectedDisplay,
  confirmed,
  value,
  onValueChange,
  onVerify,
}: {
  expectedDisplay: string;
  confirmed: boolean;
  value: string;

  onValueChange:
    (
      value: string,
    ) => void;

  onVerify:
    (
      value: string,
    ) => boolean;
}) {
  const [
    erreur,
    setErreur,
  ] = useState<
    string | null
  >(
    null,
  );

  const [
    scanner,
    setScanner,
  ] = useState(
    false,
  );


  const shortInput =
    useMemo(
      () => {
        const parts =
          expectedDisplay
            .toUpperCase()
            .split("-");

        if (
          parts.length
          === 3
        ) {
          return (
            parts[1]
            + parts[2]
          );
        }

        return "NNNNNNNNC";
      },
      [
        expectedDisplay,
      ],
    );


  function verifier(
    raw: string,
    viaQr: boolean,
  ) {
    const candidate =
      viaQr
        ? (
            extractAddressNumberFromQr(
              raw,
            )
            ?? raw
          )
        : raw;

    const ok =
      onVerify(
        candidate,
      );

    if (ok) {
      setErreur(
        null,
      );

      return true;
    }

    setErreur(
      viaQr
        ? "Le QR scanné ne correspond pas à la balise assignée."
        : "Le numéro saisi ne correspond pas à la balise assignée.",
    );

    return false;
  }


  return (
    <div className="space-y-4">

      <Card
        className="
          overflow-hidden
          rounded-[28px]
          border-0
          bg-transparent
          shadow-[0_18px_50px_rgba(37,99,235,0.16)]
        "
      >
        <div
          className="
            relative
            overflow-hidden
            bg-gradient-to-br
            from-indigo-600
            via-blue-600
            to-cyan-500
            px-5
            py-7
            sm:px-7
            sm:py-8
            text-white
          "
        >
          <div
            className="
              absolute
              inset-0
              bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_60%)]
            "
          />

          <div className="relative text-center">

            <div
              className="
                mb-3
                inline-flex
                h-14
                w-14
                items-center
                justify-center
                rounded-2xl
                bg-white/20
                shadow-lg
                backdrop-blur
              "
            >
              <Radio className="h-7 w-7" />
            </div>

            <div
              className="
                mb-1
                text-xs
                font-semibold
                uppercase
                tracking-widest
                text-white/80
              "
            >
              Balise à installer
            </div>

            <div
              className="
                font-mono
                text-2xl
                font-bold
                tracking-tight
                sm:text-3xl
              "
            >
              {expectedDisplay}
            </div>

            {confirmed ? (
              <div
                className="
                  mt-3
                  inline-flex
                  items-center
                  gap-1.5
                  rounded-full
                  border
                  border-emerald-300/40
                  bg-emerald-500/30
                  px-3
                  py-1
                  text-xs
                  font-semibold
                  backdrop-blur
                "
              >
                <CheckCircle2 className="h-3.5 w-3.5" />

                Balise confirmée
              </div>
            ) : null}

          </div>
        </div>
      </Card>


      <Card
        className="
          rounded-[24px]
          border-slate-200/80
          bg-white
          shadow-[0_12px_35px_rgba(15,23,42,0.06)]
        "
      >
        <CardContent className="space-y-5 p-5">

          <Button
            type="button"
            size="lg"
            className="
              h-14
              w-full
              rounded-2xl
              bg-gradient-to-r
              from-indigo-600
              via-blue-600
              to-blue-500
              text-sm
              font-bold
              text-white
              shadow-lg
              shadow-blue-500/15
              transition
              hover:-translate-y-0.5
              hover:shadow-xl
            "
            onClick={() => {
              setErreur(
                null,
              );

              setScanner(
                true,
              );
            }}
          >
            <QrCode className="mr-2 h-6 w-6" />

            Scanner le QR de la plaque
          </Button>


          <div className="relative">
            <div
              className="
                absolute
                inset-0
                flex
                items-center
              "
            >
              <div className="w-full border-t border-slate-200" />
            </div>

            <div
              className="
                relative
                flex
                justify-center
                text-xs
              "
            >
              <span
                className="
                  bg-white
                  px-3
                  font-semibold
                  uppercase
                  tracking-widest
                  text-slate-400
                "
              >
                Ou
              </span>
            </div>
          </div>


          <div className="space-y-2">
            <Label
              htmlFor="agent-beacon-confirm"
              className="
                flex
                items-center
                gap-1.5
                text-xs
                font-semibold
                uppercase
                tracking-wider
                text-slate-600
              "
            >
              <Keyboard className="h-3.5 w-3.5" />

              Saisir le numéro à la main
            </Label>

            <Input
              id="agent-beacon-confirm"
              value={value}
              placeholder={shortInput}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="
                h-14
                rounded-2xl
                border-slate-200
                bg-slate-50/70
                text-center
                font-mono
                text-base
                font-semibold
                tracking-[0.08em]
                text-slate-950
                shadow-inner
                focus-visible:border-indigo-400
                focus-visible:ring-indigo-100
              "
              onChange={(
                event,
              ) => {
                setErreur(
                  null,
                );

                onValueChange(
                  event.target.value,
                );
              }}
            />

            <Button
              type="button"
              variant="outline"
              size="lg"
              className="
                h-12
                w-full
                rounded-2xl
                border-slate-200
                bg-white
                font-bold
                text-slate-900
                shadow-sm
                transition
                hover:border-indigo-200
                hover:bg-indigo-50/40
              "
              disabled={
                value
                  .trim()
                  .length
                === 0
              }
              onClick={() => {
                verifier(
                  value,
                  false,
                );
              }}
            >
              Vérifier le numéro
            </Button>
          </div>


          {erreur ? (
            <div
              className="
                flex
                items-start
                gap-2
                rounded-xl
                border
                border-rose-200
                bg-rose-50
                p-3
                text-sm
                text-rose-800
              "
            >
              <XCircle
                className="
                  mt-0.5
                  h-4
                  w-4
                  shrink-0
                "
              />

              <span>
                {erreur}
              </span>
            </div>
          ) : null}

        </CardContent>
      </Card>


      <div
        className="
          flex
          items-start
          gap-2
          rounded-[20px]
          border
          border-indigo-100
          bg-gradient-to-r
          from-indigo-50
          via-blue-50/80
          to-cyan-50/70
          px-4
          py-3.5
          text-xs
          leading-5
          text-slate-600
        "
      >
        <Sparkles
          className="
            mt-0.5
            h-4
            w-4
            shrink-0
            text-indigo-500
          "
        />

        <span>
          Utilisez le scanner QR pour plus de rapidité
          et éviter les erreurs de frappe.
          Vous pouvez également saisir{" "}
          <strong className="font-mono">
            {shortInput}
          </strong>.
        </span>
      </div>


      <QrScanner
        open={scanner}
        onClose={() =>
          setScanner(
            false,
          )
        }
        onDetected={(
          valueDetected,
        ) => {
          if (
            verifier(
              valueDetected,
              true,
            )
          ) {
            setScanner(
              false,
            );
          }
        }}
        title="Scanner le QR de la plaque"
      />

    </div>
  );
}
