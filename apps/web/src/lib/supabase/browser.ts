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


const SUPABASE_SESSION_TIMEOUT_MS =
  5000;


export async function getAccessToken():
  Promise<string | null> {
  let timer:
    number | null =
      null;

  try {
    const sessionPromise =
      supabase.auth
        .getSession();

    const timeoutPromise =
      new Promise<never>(
        (
          _resolve,
          reject,
        ) => {
          timer =
            window.setTimeout(
              () => {
                reject(
                  new Error(
                    "SUPABASE_SESSION_TIMEOUT",
                  ),
                );
              },
              SUPABASE_SESSION_TIMEOUT_MS,
            );
        },
      );

    const {
      data,
      error,
    } =
      await Promise.race([
        sessionPromise,
        timeoutPromise,
      ]);

    if (error) {
      return null;
    }

    return (
      data.session
        ?.access_token ??
      null
    );
  } catch {
    /*
     * Fail closed:
     * a stalled Supabase session must not leave
     * protected screens loading forever.
     */
    return null;
  } finally {
    if (timer !== null) {
      window.clearTimeout(
        timer,
      );
    }
  }
}


export type {
  Session,
  User,
};
