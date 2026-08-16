// src/hooks/usePushNotifications.ts
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { pushSubscribe, pushUnsubscribe } from "@/lib/push.functions";

const VAPID_PUBLIC_KEY = import.meta.env["VITE_VAPID_PUBLIC_KEY"] as string | undefined;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export type PushStatus =
  | "unsupported"
  | "no-vapid"
  | "denied"
  | "granted-no-sub"
  | "granted-subscribed"
  | "default"
  | "loading";

export function usePushNotifications() {
  const subscribeFn = useServerFn(pushSubscribe);
  const unsubscribeFn = useServerFn(pushUnsubscribe);
  const [status, setStatus] = useState<PushStatus>("loading");

  const refresh = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setStatus("unsupported"); return;
    }
    if (!VAPID_PUBLIC_KEY) { setStatus("no-vapid"); return; }
    if (Notification.permission === "denied") { setStatus("denied"); return; }
    if (Notification.permission === "default") { setStatus("default"); return; }
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    setStatus(sub ? "granted-subscribed" : "granted-no-sub");
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const enable = useCallback(async (): Promise<PushStatus> => {
    if (status === "unsupported" || status === "no-vapid") return status;
    setStatus("loading");
    const perm = await Notification.requestPermission();
    if (perm !== "granted") { const s: PushStatus = perm === "denied" ? "denied" : "default"; setStatus(s); return s; }
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!),
      });
    }
    const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
    await subscribeFn({
      data: {
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        user_agent: navigator.userAgent,
      },
    });
    setStatus("granted-subscribed");
    return "granted-subscribed";
  }, [status, subscribeFn]);

  const disable = useCallback(async () => {
    if (typeof window === "undefined") return;
    setStatus("loading");
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await unsubscribeFn({ data: { endpoint: sub.endpoint } });
      await sub.unsubscribe();
    }
    setStatus(Notification.permission === "granted" ? "granted-no-sub" : "default");
  }, [unsubscribeFn]);

  return { status, enable, disable, refresh };
}
