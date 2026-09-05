import type {
  Metadata,
} from "next";

import {
  LoginPage,
} from "@/features/auth/components/login-page";


export const metadata: Metadata = {
  title:
    "Connexion — Adresse GN",

  description:
    "Connectez-vous à votre compte Adresse GN avec votre email et votre mot de passe.",

  robots: {
    index: false,
    follow: true,
  },
};


type Props = {
  searchParams: Promise<{
    returnTo?:
      | string
      | string[];
  }>;
};


export default async function Page({
  searchParams,
}: Props) {
  const params =
    await searchParams;

  const rawReturnTo =
    params.returnTo;

  const returnTo =
    Array.isArray(
      rawReturnTo,
    )
      ? rawReturnTo[0]
      : rawReturnTo;

  return (
    <LoginPage
      returnTo={returnTo}
    />
  );
}
