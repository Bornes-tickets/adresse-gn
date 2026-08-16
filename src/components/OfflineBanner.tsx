// src/components/OfflineBanner.tsx
import { useEffect } from "react";
import { WifiOff, Wifi, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Bandeau flottant "hors ligne" + notification "reconnecté, sync en cours".
 * À placer au niveau du layout racine.
 */
export function OfflineBanner() {
  const { online, wasOffline, acknowledgeReconnect } = useOnlineStatus();
  const qc = useQueryClient();

  useEffect(() => {
    if (online && wasOffline) {
      toast.success("Connexion rétablie — synchronisation…", {
        icon: <RefreshCw className="h-4 w-4 animate-spin" />,
      });
      // Force le refetch de toutes les queries actives
      qc.invalidateQueries();
      acknowledgeReconnect();
    }
  }, [online, wasOffline, acknowledgeReconnect, qc]);

  if (online) return null;

  return (
    <div
      className="fixed left-0 right-0 z-[60] bg-gradient-to-r from-slate-800 to-slate-900 text-white text-sm font-medium shadow-lg"
      style={{
        top: "env(safe-area-inset-top, 0px)",
        paddingTop: "8px",
        paddingBottom: "8px",
      }}
    >
      <div className="flex items-center justify-center gap-2 px-4">
        <WifiOff className="h-4 w-4 animate-pulse" />
        <span>Mode hors ligne — vos données seront synchronisées à la reconnexion</span>
      </div>
    </div>
  );
}

