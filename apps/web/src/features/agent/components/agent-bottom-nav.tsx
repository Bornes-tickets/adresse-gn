"use client";

import { useRouter } from "next/navigation";

type ActiveTab = "tasks" | "history" | "profile";

const tabs: Array<{
  key: ActiveTab;
  label: string;
  href: string;
}> = [
  { key: "tasks", label: "Tâches", href: "/agent/tasks" },
  { key: "history", label: "Historique", href: "/agent/history" },
  { key: "profile", label: "Profil", href: "/agent/profile" },
];

export function AgentBottomNav({
  active,
}: {
  active: ActiveTab;
}) {
  const router = useRouter();

  return (
    <nav
      aria-label="Navigation de l’espace agent"
      className="
        fixed inset-x-0 bottom-0 z-50
        border-t border-slate-200
        bg-white/95
        shadow-[0_-8px_30px_rgba(15,23,42,0.06)]
        backdrop-blur
      "
      style={{
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="grid h-20 w-full grid-cols-3">
        {tabs.map((tab) => {
          const selected = tab.key === active;

          return (
            <button
              key={tab.key}
              type="button"
              aria-current={selected ? "page" : undefined}
              onClick={() => {
                if (!selected) {
                  router.push(tab.href);
                }
              }}
              className={
                selected
                  ? "relative flex flex-col items-center justify-center gap-1 text-[11px] font-semibold text-orange-600"
                  : "relative flex flex-fol items-center justify-center gap-1 text-[11px] font-medium text-slate-400 transition hover:text-slate-700"
              }
            >
              {selected ? (
                <span
                  className="
                    absolute top-0 h-1 w-10
                    rounded-b-full
                    bg-gradient-to-r
                    from-orange-500 to-rose-500
                  "
                />
              ) : null}

              <span
                className={
                  selected
                    ? "flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-rose-500 text-white shadow-sm"
                    : "flex h-9 w-9 items-center justify-center rounded-full"
                }
              >
                {tab.key === "tasks" ? "☷" : null}
                {tab.key === "history" ? "◷" : null}
                {tab.key === "profile" ? "♙" : null}
              </span>

              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
