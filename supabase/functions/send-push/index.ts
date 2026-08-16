// supabase/functions/send-push/index.ts
// Envoie des Web Push notifications VAPID à une liste d'utilisateurs.
// Déploiement : supabase functions deploy send-push
// Secrets requis : VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (ex: mailto:contact@adresse.gn)
//                  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import webpush from "https://esm.sh/web-push@3.6.7";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:contact@adresse.gn";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

interface Payload {
  userIds: string[];
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const payload = (await req.json()) as Payload;
    if (!payload.userIds?.length || !payload.title || !payload.body) {
      return new Response(JSON.stringify({ error: "userIds, title et body requis" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const { data: subs, error } = await admin
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth")
      .in("user_id", payload.userIds);
    if (error) throw new Error(error.message);
    if (!subs?.length) {
      return new Response(JSON.stringify({ envoyees: 0, echecs: 0, note: "aucun abonné" }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const notif = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url ?? "/",
      tag: payload.tag,
      icon: payload.icon,
    });

    let envoyees = 0;
    let echecs = 0;
    const eventsToInsert: any[] = [];
    const endpointsToDelete: string[] = [];

    await Promise.all(subs.map(async (s: any) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          notif,
          { TTL: 60 * 60 * 24 },
        );
        envoyees += 1;
        eventsToInsert.push({
          subscription_id: s.id, user_id: s.user_id,
          title: payload.title, body: payload.body, url: payload.url ?? null,
          tag: payload.tag ?? null, status: "sent",
        });
      } catch (e: any) {
        echecs += 1;
        const statusCode = e?.statusCode;
        const expired = statusCode === 404 || statusCode === 410;
        eventsToInsert.push({
          subscription_id: s.id, user_id: s.user_id,
          title: payload.title, body: payload.body, url: payload.url ?? null,
          tag: payload.tag ?? null,
          status: expired ? "expired" : "failed",
          error: String(e?.body ?? e?.message ?? e),
        });
        if (expired) endpointsToDelete.push(s.endpoint);
      }
    }));

    if (eventsToInsert.length) {
      await admin.from("push_events").insert(eventsToInsert);
    }
    if (endpointsToDelete.length) {
      await admin.from("push_subscriptions").delete().in("endpoint", endpointsToDelete);
    }

    return new Response(JSON.stringify({ envoyees, echecs, nettoyes: endpointsToDelete.length }), {
      status: 200, headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
