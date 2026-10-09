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
    "Connectez-vous à votre compte Adresse GN avec votre mot de passe ou un code reçu par e-mail.",

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
