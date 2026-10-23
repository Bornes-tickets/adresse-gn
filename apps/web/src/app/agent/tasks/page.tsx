import type {
  Metadata,
} from "next";

import {
  AgentTasksPage,
} from "@/features/agent/components/agent-tasks-page";


export const metadata: Metadata = {
  title:
    "Mes tâches — Espace agent",

  description:
    "Tâches d'installation affectées à l'agent Adresse GN connecté.",

  robots: {
    index: false,
    follow: false,
  },
};


export default function Page() {
  return (
    <AgentTasksPage />
  );
}
