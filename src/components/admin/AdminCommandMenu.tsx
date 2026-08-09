import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { MapPin, QrCode, Search, User } from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { adminGlobalSearch } from "@/lib/admin.functions";
import { ACCENT_CLASSES, SECTIONS_ADMIN } from "@/lib/admin-nav";

/** Palette de commandes ⌘K / Ctrl+K du back-office. */
export function AdminCommandMenu() {
  const [ouvert, setOuvert] = useState(false);
  const [terme, setTerme] = useState("");
  const navigate = useNavigate();
  const chercher = useServerFn(adminGlobalSearch);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOuvert((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const requete = terme.trim();
  const { data } = useQuery({
    queryKey: ["admin", "search", requete],
    queryFn: () => chercher({ data: { terme: requete } }),
    enabled: ouvert && requete.length >= 2,
    staleTime: 15_000,
  });

  const aller = (to: string, search?: Record<string, string>) => {
    setOuvert(false);
    setTerme("");
    navigate({ to, search } as never);
  };

  const sections = useMemo(() => SECTIONS_ADMIN, []);

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOuvert(true)}
        className="h-9 justify-start gap-2 text-muted-foreground sm:w-64"
      >
        <Search className="size-4" />
        <span className="hidden sm:inline">Rechercher…</span>
        <kbd className="ml-auto hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium sm:inline">
          ⌘K
        </kbd>
      </Button>

      <CommandDialog open={ouvert} onOpenChange={setOuvert}>
        <CommandInput
          placeholder="Balise, adresse, utilisateur ou section…"
          value={terme}
          onValueChange={setTerme}
        />
        <CommandList>
          <CommandEmpty>Aucun résultat.</CommandEmpty>

          <CommandGroup heading="Navigation">
            {sections.map((s) => {
              const Icone = s.icon;
              return (
                <CommandItem
                  key={s.to}
                  value={`${s.label} ${s.groupe}`}
                  onSelect={() => aller(s.to)}
                >
                  <Icone className={`size-4 ${ACCENT_CLASSES[s.accent].texte}`} />
                  <span>{s.label}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{s.groupe}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>

          {data && data.balises.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Balises">
                {data.balises.map((b) => (
                  <CommandItem
                    key={b.id}
                    value={b.numero}
                    onSelect={() => aller("/admin/beacons", { q: b.numero })}
                  >
                    <QrCode className="size-4 text-admin-blue" />
                    <span className="font-mono">{b.numero}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{b.statut}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {data && data.adresses.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Adresses">
                {data.adresses.map((a) => (
                  <CommandItem
                    key={a.id}
                    value={`${a.nom ?? ""} ${a.numero ?? ""}`}
                    onSelect={() => aller("/admin/addresses", { q: a.numero ?? a.nom ?? "" })}
                  >
                    <MapPin className="size-4 text-admin-cyan" />
                    <span>{a.nom ?? "Adresse"}</span>
                    <span className="ml-auto font-mono text-xs text-muted-foreground">
                      {a.numero ?? "—"}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {data && data.utilisateurs.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Utilisateurs">
                {data.utilisateurs.map((u) => (
                  <CommandItem
                    key={u.id}
                    value={`${u.nom ?? ""} ${u.telephone ?? ""}`}
                    onSelect={() => aller("/admin/users", { q: u.nom ?? u.telephone ?? "" })}
                  >
                    <User className="size-4 text-admin-violet" />
                    <span>{u.nom ?? "Utilisateur"}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{u.role}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
