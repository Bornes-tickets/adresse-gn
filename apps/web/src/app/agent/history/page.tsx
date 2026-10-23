import type { Metadata } from "next";
import { AgentHistoryPage } from "@/features/agent/components/agent-history-page";

export const metadata: Metadata = {
  title: "Historique — Espace agent",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <AgentHistoryPage />;
}
