import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

import { Button } from "@/components/ui/button";

interface PromptEvent extends Event {
  prompt: () => Promise<void>;
}

/** Bannière discrète « Installer l'app » (Android/Chrome : beforeinstallprompt). */
export function InstallBanner() {
  const [prompt, setPrompt] = useState<PromptEvent | null>(null);
  const [masque, setMasque] = useState(false);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as PromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!prompt || masque) return null;

  return (
    <div className="flex items-center gap-3 border-b border-border bg-accent/10 px-4 py-2 text-sm">
      <Download className="size-4 shrink-0 text-accent-foreground/80" />
      <p className="flex-1 text-muted-foreground">
        Installez l'app pour un accès rapide hors navigateur.
      </p>
      <Button
        size="sm"
        variant="secondary"
        onClick={async () => {
          await prompt.prompt();
          setPrompt(null);
        }}
      >
        Installer
      </Button>
      <button
        type="button"
        aria-label="Masquer"
        onClick={() => setMasque(true)}
        className="text-muted-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
