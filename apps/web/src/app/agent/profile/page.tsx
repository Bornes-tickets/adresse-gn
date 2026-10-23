import type { Metadata } from "next";
import { AgentProfilePage } from "@/features/agent/components/agent-profile-page";

export const metadata: Metadata = {
  title: "Profil — Espace agent",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <AgentProfilePage />;
}
