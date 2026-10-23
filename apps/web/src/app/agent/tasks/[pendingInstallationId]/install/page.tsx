import type {
  Metadata,
} from "next";

import {
  AgentInstallPage,
} from "@/features/agent/components/agent-install-page";


export const metadata: Metadata = {
  title:
    "Pose terrain | Adresse GN",
};


export default function Page() {
  return (
    <AgentInstallPage />
  );
}
