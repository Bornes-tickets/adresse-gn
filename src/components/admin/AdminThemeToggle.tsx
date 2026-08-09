import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";

const CLE = "agn-admin-theme";

/** Bascule clair / sombre pour le back-office (persistée en localStorage). */
export function AdminThemeToggle() {
  const [sombre, setSombre] = useState(false);

  useEffect(() => {
    const prefere = localStorage.getItem(CLE) === "dark";
    setSombre(prefere);
    document.documentElement.classList.toggle("dark", prefere);
    return () => document.documentElement.classList.remove("dark");
  }, []);

  const basculer = () => {
    const suivant = !sombre;
    setSombre(suivant);
    localStorage.setItem(CLE, suivant ? "dark" : "light");
    document.documentElement.classList.toggle("dark", suivant);
  };

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={basculer}
      aria-label={sombre ? "Passer en mode clair" : "Passer en mode sombre"}
      className="h-9 w-9"
    >
      {sombre ? <Moon className="size-4" /> : <Sun className="size-4" />}
    </Button>
  );
}
