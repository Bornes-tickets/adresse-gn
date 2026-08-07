import { Check, Globe } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useLangue } from "@/hooks/useLangue";
import { cn } from "@/lib/utils";

/** Sélecteur de langue FR / العربية / EN. */
export function LanguageSwitcher({
  className,
  tone = "default",
}: {
  className?: string;
  tone?: "default" | "light";
}) {
  const { t } = useTranslation();
  const { langue, changerLangue, langues } = useLangue();
  const courante = langues.find((l) => l.code === langue) ?? langues[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "h-11 gap-1.5 px-2.5 text-sm font-medium",
            tone === "light" ? "text-white hover:bg-white/10" : "text-muted-foreground",
            className,
          )}
          aria-label={t("language.label")}
        >
          <Globe className="size-4" />
          <span>{courante.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          {t("language.label")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {langues.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onSelect={() => changerLangue(l.code)}
            className="flex items-center justify-between gap-2"
            dir={l.dir}
          >
            <span>{l.nom}</span>
            {l.code === langue && <Check className="size-4 text-accent" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
