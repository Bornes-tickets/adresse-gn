import { cn } from "@/lib/utils";

/**
 * Marque Adresse GN : pastille dégradée + mot-symbole.
 * `tone` adapte la couleur du texte au fond (clair ou sombre).
 */
export function Logo({
  className,
  tone = "dark",
  withTagline = false,
}: {
  className?: string;
  tone?: "dark" | "light";
  withTagline?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <svg
        viewBox="0 0 40 40"
        width="36"
        height="36"
        aria-hidden="true"
        className="shrink-0"
      >
        <defs>
          <linearGradient id="agn-logo" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#1E3660" />
            <stop offset="55%" stopColor="#2E4A7B" />
            <stop offset="100%" stopColor="#0EA5A4" />
          </linearGradient>
        </defs>
        <rect width="40" height="40" rx="9" fill="url(#agn-logo)" />
        <path
          d="M20 10c-3.6 0-6.5 2.9-6.5 6.5 0 4.6 6.5 13.5 6.5 13.5s6.5-8.9 6.5-13.5C26.5 12.9 23.6 10 20 10Z"
          fill="#fff"
          fillOpacity="0.95"
        />
        <circle cx="20" cy="16.5" r="2.6" fill="#1E3660" />
      </svg>
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "text-display text-[1.0625rem] font-extrabold",
            tone === "light" ? "text-white" : "text-primary",
          )}
        >
          ADRESSE GN
        </span>
        {withTagline && (
          <span
            className={cn(
              "mt-1 text-[0.6875rem] font-medium",
              tone === "light" ? "text-white/65" : "text-muted-foreground",
            )}
          >
            Un lieu · Un numéro · Un itinéraire
          </span>
        )}
      </span>
    </span>
  );
}
