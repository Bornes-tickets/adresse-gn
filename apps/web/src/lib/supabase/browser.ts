"use client";

import type {
  Session,
  User,
} from "@supabase/supabase-js";

import {
  createClient,
} from "./client";


export const supabase =
  createClient();


export async function getAccessToken():
  Promise<string | null> {
  const {
    data,
    error,
  } =
    await supabase.auth.getSession();

  if (error) {
    return null;
  }

  return (
    data.session
      ?.access_token ??
    null
  );
}


export type {
  Session,
  User,
};
