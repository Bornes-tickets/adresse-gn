import { useRef, useState } from "react";
import { Copy, Download, MessageCircle, QrCode, Share2 } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface ShareSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  number: string;
  name?: string | null;
}

export function ShareSheet({ open, onOpenChange, number, name }: ShareSheetProps) {
  const qrRef = useRef<HTMLDivElement>(null);
  const [origin] = useState(() =>
    typeof window === "undefined" ? "" : window.location.origin,
  );

  const lien = `${origin}/a/${number}`;
  const message = name
    ? `${name} — Adresse GN ${number} : ${lien}`
    : `Adresse GN ${number} : ${lien}`;

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(lien);
      toast.success("Lien copié");
    } catch {
      toast.error("Impossible de copier le lien");
    }
  };

  const telechargerQr = () => {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) {
      toast.error("QR code indisponible");
      return;
    }
    const link = document.createElement("a");
    link.download = `${number}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    toast.success("QR code téléchargé");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Share2 className="size-5 text-accent" />
            Partager cette adresse
          </SheetTitle>
          <SheetDescription className="font-mono">{number}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-2 px-4 pb-6">
          <Button asChild variant="outline" size="lg" className="justify-start">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle className="size-4 text-accent" />
              WhatsApp
            </a>
          </Button>

          <Button asChild variant="outline" size="lg" className="justify-start">
            <a href={`sms:?body=${encodeURIComponent(message)}`}>
              <MessageCircle className="size-4 text-primary" />
              SMS
            </a>
          </Button>

          <Button variant="outline" size="lg" className="justify-start" onClick={copier}>
            <Copy className="size-4" />
            Copier le lien
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="justify-start"
            onClick={telechargerQr}
          >
            <Download className="size-4" />
            Télécharger le QR
          </Button>

          <div className="mt-2 flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-4">
            <div ref={qrRef} aria-hidden>
              <QRCodeCanvas value={lien} size={160} level="M" marginSize={2} />
            </div>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <QrCode className="size-3" />
              Scannez pour ouvrir cette adresse
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
