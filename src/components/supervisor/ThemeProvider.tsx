import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supervisorPreferences, supervisorSavePreferences } from "@/lib/supervisor.functions";

export const ACCENTS = [
  { key: "indigo",  label: "Indigo",  from: "from-indigo-500",  to: "to-violet-600",  hex: "#6366f1" },
  { key: "violet",  label: "Violet",  from: "from-violet-500",  to: "to-fuchsia-600", hex: "#8b5cf6" },
  { key: "emerald", label: "Émeraude", from: "from-emerald-500", to: "to-teal-600",   hex: "#10b981" },
  { key: "sky",     label: "Ciel",    from: "from-sky-500",     to: "to-blue-600",    hex: "#0ea5e9" },
  { key: "rose",    label: "Rose",    from: "from-rose-500",    to: "to-pink-600",    hex: "#f43f5e" },
  { key: "amber",   label: "Ambre",   from: "from-amber-500",   to: "to-orange-600",  hex: "#f59e0b" },
] as const;

export type AccentKey = typeof ACCENTS[number]["key"];

type ThemeCtx = {
  dark: boolean;
  setDark: (v: boolean) => void;
  accent: AccentKey;
  setAccent: (a: AccentKey) => void;
  accentInfo: typeof ACCENTS[number];
};

const Ctx = createContext<ThemeCtx | null>(null);

export function useTheme() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTheme must be used inside ThemeProvider");
  return v;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const loadFn = useServerFn(supervisorPreferences);
  const saveFn = useServerFn(supervisorSavePreferences);

  const [dark, setDarkState] = useState(false);
  const [accent, setAccentState] = useState<AccentKey>("indigo");

  const { data: prefs } = useQuery({
    queryKey: ["supervisor-preferences"],
    queryFn: () => loadFn(),
    staleTime: 5 * 60 * 1000,
  });

  const save = useMutation({
    mutationFn: (patch: Record<string, unknown>) => saveFn({ data: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["supervisor-preferences"] }),
  });

  // Init : localStorage d'abord (feedback instant), puis DB
  useEffect(() => {
    const savedTheme = localStorage.getItem("sv-theme");
    const savedAccent = localStorage.getItem("sv-accent") as AccentKey | null;
    const isDark = savedTheme ? savedTheme === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDarkState(isDark);
    document.documentElement.classList.toggle("dark", isDark);
    if (savedAccent && ACCENTS.find((a) => a.key === savedAccent)) setAccentState(savedAccent);
  }, []);

  // Sync depuis la DB si présent
  useEffect(() => {
    if (!prefs) return;
    if (prefs['theme'] === "dark" || prefs['theme'] === "light") {
      const isDark = prefs['theme'] === "dark";
      setDarkState(isDark);
      document.documentElement.classList.toggle("dark", isDark);
      localStorage.setItem("sv-theme", isDark ? "dark" : "light");
    }
    if (prefs['accent'] && ACCENTS.find((a) => a.key === prefs['accent'])) {
      setAccentState(prefs['accent'] as AccentKey);
      localStorage.setItem("sv-accent", prefs['accent'] as string);
    }
  }, [prefs]);

  // Applique la variable CSS d'accent
  useEffect(() => {
    const info = ACCENTS.find((a) => a.key === accent) ?? ACCENTS[0];
    document.documentElement.style.setProperty("--sv-accent", info.hex);
  }, [accent]);

  const setDark = (v: boolean) => {
    setDarkState(v);
    document.documentElement.classList.toggle("dark", v);
    localStorage.setItem("sv-theme", v ? "dark" : "light");
    save.mutate({ theme: v ? "dark" : "light" });
  };

  const setAccent = (a: AccentKey) => {
    setAccentState(a);
    localStorage.setItem("sv-accent", a);
    save.mutate({ accent: a });
  };

  const accentInfo = ACCENTS.find((a) => a.key === accent) ?? ACCENTS[0];

  return (
    <Ctx.Provider value={{ dark, setDark, accent, setAccent, accentInfo }}>
      {children}
    </Ctx.Provider>
  );
}

/** Sélecteur visuel de couleur d'accent (pastilles). */
export function AccentPicker({ dark }: { dark: boolean }) {
  const { accent, setAccent } = useTheme();
  return (
    <div className="flex items-center gap-1.5">
      {ACCENTS.map((a) => {
        const isSel = accent === a.key;
        return (
          <button
            key={a.key}
            onClick={() => setAccent(a.key)}
            title={a.label}
            className="relative h-6 w-6 rounded-full transition-all hover:scale-125"
            style={{ backgroundColor: a.hex }}
          >
            {isSel && (
              <span
                className={`absolute inset-0 rounded-full ring-2 ring-offset-2 ${dark ? "ring-offset-slate-900" : "ring-offset-white"}`}
                style={{ boxShadow: `0 0 0 2px ${a.hex}` }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
