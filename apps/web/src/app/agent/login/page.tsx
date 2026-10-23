import type {
  Metadata,
} from "next";

import {
  AgentLoginPage,
} from "@/features/agent/components/agent-login-page";


export const metadata: Metadata = {
  title:
    "Connexion agent — Adresse GN",

  description:
    "Espace terrain des agents installateurs Adresse GN.",

  robots: {
    index: false,
    follow: false,
  },
};


export default function Page() {
  return (
    <AgentLoginPage />
  );
}
