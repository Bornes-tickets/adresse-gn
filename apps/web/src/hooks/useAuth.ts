"use client";

import {
  useEffect,
  useState,
} from "react";

import type {
  Session,
  User,
} from "@supabase/supabase-js";

import {
  supabase,
} from "@/lib/supabase/browser";


export function useAuth() {
  const [
    session,
    setSession,
  ] =
    useState<Session | null>(
      null,
    );

  const [
    user,
    setUser,
  ] =
    useState<User | null>(
      null,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);


  useEffect(() => {
    let mounted = true;

    const {
      data: subscription,
    } =
      supabase.auth
        .onAuthStateChange(
          (
            _event,
            nextSession,
          ) => {
            if (!mounted) {
              return;
            }

            setSession(
              nextSession,
            );

            setUser(
              nextSession
                ?.user ??
                null,
            );

            setLoading(false);
          },
        );


    supabase.auth
      .getSession()
      .then(
        ({
          data,
        }) => {
          if (!mounted) {
            return;
          }

          setSession(
            data.session,
          );

          setUser(
            data.session
              ?.user ??
              null,
          );

          setLoading(false);
        },
      )
      .catch(() => {
        if (!mounted) {
          return;
        }

        setSession(null);
        setUser(null);
        setLoading(false);
      });


    return () => {
      mounted = false;

      subscription
        .subscription
        .unsubscribe();
    };
  }, []);


  return {
    session,
    user,
    loading,
    isAuthenticated:
      Boolean(user),
  };
}
