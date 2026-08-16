// src/components/PushToggle.tsx
import { useState } from "react";
import { Bell, BellOff, BellRing, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { pushTest } from "@/lib/push.functions";
import { cn } from "@/lib/utils";

export function PushToggle({ compact = false }: { compact?: boolean }) {
  const { status, enable, disable } = usePushNotifications();
  const testFn = useServerFn(pushTest);
  const [busy, setBusy] = useState(false);

  if (status === "unsupported") {
    return compact ? null : (
      <div className="flex items-center gap-2 text-xs text-slate-500 rounded-lg bg-slate-50 p-3 border border-slate-200">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        Notifications non supportées sur ce navigateur.
      </div>
    );
  }

  if (status === "no-vapid") {
    return compact ? null : (
      <div className="flex items-center gap-2 text-xs text-amber-700 rounded-lg bg-amber-50 p-3 border border-amber-200">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        VAPID_PUBLIC_KEY manquante — configurez la variable d'environnement.
      </div>
    );
  }

  if (status === "loading") {
    return (
      <Button variant="outline" size={compact ? "sm" : "default"} disabled>
        <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
        Chargement…
      </Button>
    );
  }

  if (status === "denied") {
    return (
      <div className="flex items-center gap-2 text-xs text-rose-700 rounded-lg bg-rose-50 p-3 border border-rose-200">
        <BellOff className="h-4 w-4 shrink-0" />
        Notifications bloquées. Autorisez-les dans les réglages de votre navigateur.
      </div>
    );
  }

  const activated = status === "granted-subscribed";

  const handleClick = async () => {
    setBusy(true);
    try {
      if (activated) {
        await disable();
        toast.success("Notifications désactivées.");
      } else {
        const r = await enable();
        if (r === "granted-subscribed") toast.success("Notifications activées 🔔");
        else if (r === "denied") toast.error("Vous avez refusé les notifications.");
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleTest = async () => {
    try {
      await testFn();
      toast.success("Notification test envoyée — vérifiez votre écran.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (compact) {
    return (
      <Button size="sm" variant={activated ? "default" : "outline"}
        className={cn(activated && "bg-orange-600 hover:bg-orange-700 text-white")}
        onClick={handleClick} disabled={busy}>
        {activated ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
      </Button>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className={cn(
          "h-11 w-11 rounded-xl flex items-center justify-center shrink-0",
          activated ? "bg-gradient-to-br from-orange-500 to-rose-600 text-white shadow" : "bg-slate-100 text-slate-500",
        )}>
          {activated ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">
            Notifications {activated ? "activées" : "désactivées"}
          </div>
          <div className="text-xs text-slate-600 mt-0.5">
            {activated
              ? "Vous recevez les alertes (nouvelles affectations, validations, litiges…) même quand l'app est fermée."
              : "Recevez les alertes importantes en temps réel."}
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          className={cn("flex-1", activated
            ? "bg-slate-100 hover:bg-slate-200 text-slate-900"
            : "bg-gradient-to-r from-orange-500 to-rose-600 hover:from-orange-600 hover:to-rose-700 text-white shadow-md")}
          onClick={handleClick}
          disabled={busy}
        >
          {busy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : activated ? <BellOff className="h-4 w-4 mr-1.5" /> : <Bell className="h-4 w-4 mr-1.5" />}
          {activated ? "Désactiver" : "Activer"}
        </Button>
        {activated && (
          <Button size="sm" variant="outline" onClick={handleTest}>
            <BellRing className="h-4 w-4 mr-1.5" />Test
          </Button>
        )}
      </div>
    </div>
  );
}

