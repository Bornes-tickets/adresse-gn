"use client";

import {
  Copy,
  Download,
  MessageCircle,
  QrCode,
  Share2,
  X,
} from "lucide-react";

import * as DialogPrimitive from "@radix-ui/react-dialog";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  QRCodeCanvas,
} from "qrcode.react";

import {
  toast,
} from "sonner";

import {
  Button,
} from "@/components/ui/button";


interface ShareSheetProps {
  open: boolean;

  onOpenChange: (
    open: boolean,
  ) => void;

  number: string;

  name?: string | null;
}


export function ShareSheet({
  open,
  onOpenChange,
  number,
  name,
}: ShareSheetProps) {
  const qrRef =
    useRef<HTMLDivElement>(
      null,
    );

  const [
    origin,
    setOrigin,
  ] =
    useState("");


  useEffect(() => {
    setOrigin(
      window.location.origin,
    );
  }, []);


  const lien =
    origin
      ? `${origin}/a/${encodeURIComponent(number)}`
      : "";


  const message =
    name
      ? `${name} — Adresse GN ${number}\n${lien}`
      : `Adresse GN ${number}\n${lien}`;


  async function copier() {
    if (!lien) {
      toast.error(
        "Le lien n'est pas encore disponible.",
      );

      return;
    }

    try {
      await navigator.clipboard
        .writeText(lien);

      toast.success(
        "Lien copié.",
      );
    } catch {
      toast.error(
        "Impossible de copier le lien.",
      );
    }
  }


  function telechargerQr() {
    const canvas =
      qrRef.current
        ?.querySelector(
          "canvas",
        );

    if (!canvas) {
      toast.error(
        "QR code indisponible.",
      );

      return;
    }

    const link =
      document.createElement(
        "a",
      );

    link.download =
      `${number}.png`;

    link.href =
      canvas.toDataURL(
        "image/png",
      );

    link.click();

    toast.success(
      "QR code téléchargé.",
    );
  }


  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={
        onOpenChange
      }
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="
            fixed
            inset-0
            z-[1000]
            bg-black/60
          "
        />

        <DialogPrimitive.Content
          className="
            fixed
            inset-x-0
            bottom-0
            z-[1001]
            mx-auto
            max-h-[85dvh]
            w-full
            overflow-y-auto
            rounded-t-2xl
            border
            border-border
            bg-background
            p-6
            shadow-2xl
            outline-none
            sm:max-w-2xl
          "
        >
          <div className="pr-10">
            <DialogPrimitive.Title
              className="
                flex
                items-center
                gap-2
                text-lg
                font-semibold
                text-foreground
              "
            >
              <Share2 className="size-5 text-accent" />
              Partager cette adresse
            </DialogPrimitive.Title>

            <DialogPrimitive.Description
              className="
                mt-1
                font-mono
                text-sm
                text-muted-foreground
              "
            >
              {number}
            </DialogPrimitive.Description>
          </div>

          <DialogPrimitive.Close
            className="
              absolute
              right-4
              top-4
              inline-flex
              size-9
              items-center
              justify-center
              rounded-lg
              text-muted-foreground
              transition-colors
              hover:bg-muted
              hover:text-foreground
              focus:outline-none
              focus:ring-2
              focus:ring-ring
            "
            aria-label="Fermer"
          >
            <X className="size-4" />
          </DialogPrimitive.Close>

          <div className="mt-6 flex flex-col gap-2">
            <Button
              asChild
              variant="outline"
              size="lg"
              className="justify-start"
            >
              <a
                href={`https://wa.me/?text=${encodeURIComponent(message)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="size-4 text-accent" />
                WhatsApp
              </a>
            </Button>

            <Button
              asChild
              variant="outline"
              size="lg"
              className="justify-start"
            >
              <a
                href={`sms:?body=${encodeURIComponent(message)}`}
              >
                <MessageCircle className="size-4 text-primary" />
                SMS
              </a>
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="justify-start"
              onClick={
                copier
              }
            >
              <Copy className="size-4" />
              Copier le lien
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="justify-start"
              onClick={
                telechargerQr
              }
            >
              <Download className="size-4" />
              Télécharger le QR code
            </Button>

            <div
              className="
                mt-2
                flex
                flex-col
                items-center
                gap-2
                rounded-lg
                border
                border-border
                bg-card
                p-4
              "
            >
              <div
                ref={qrRef}
                aria-hidden
              >
                {lien && (
                  <QRCodeCanvas
                    value={lien}
                    size={160}
                    level="M"
                    marginSize={2}
                  />
                )}
              </div>

              <p
                className="
                  flex
                  items-center
                  gap-1
                  text-xs
                  text-muted-foreground
                "
              >
                <QrCode className="size-3" />
                Scanner pour ouvrir l'adresse
              </p>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
