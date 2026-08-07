import { ExternalLink, MapPin, Navigation } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { logRoute } from "@/lib/search.functions";

interface DirectionsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  number: string;
  lat: number;
  lng: number;
}

const PROVIDERS = [
  {
    id: "google_maps",
    label: "Google Maps",
    url: (lat: number, lng: number) =>
      `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
  },
  {
    id: "waze",
    label: "Waze",
    url: (lat: number, lng: number) => `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`,
  },
  {
    id: "apple_maps",
    label: "Apple Plans",
    url: (lat: number, lng: number) => `https://maps.apple.com/?daddr=${lat},${lng}`,
  },
];

export function DirectionsSheet({
  open,
  onOpenChange,
  number,
  lat,
  lng,
}: DirectionsSheetProps) {
  const { t } = useTranslation();
  const lancer = (providerId: string, url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
    void logRoute({ data: { number, provider: providerId } }).catch(() => {
      /* la journalisation ne doit jamais bloquer l'itinéraire */
    });
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Navigation className="size-5 text-accent" />
            {t("directions.chooseApp")}
          </SheetTitle>
          <SheetDescription>
            {t("directions.opensTowards")} <span className="font-mono">{number}</span>.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-2 px-4 pb-6">
          {PROVIDERS.map((provider) => (
            <Button
              key={provider.id}
              variant="outline"
              size="lg"
              className="justify-between"
              onClick={() => lancer(provider.id, provider.url(lat, lng))}
            >
              <span className="flex items-center gap-2">
                <MapPin className="size-4 text-primary" />
                {provider.label}
              </span>
              <ExternalLink className="size-4 text-muted-foreground" />
            </Button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
