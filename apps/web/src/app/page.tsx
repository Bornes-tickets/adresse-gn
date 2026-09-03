import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="overflow-x-hidden bg-white">
      <section className="relative overflow-hidden gradient-signature-soft">
        <div className="pointer-events-none absolute -right-32 -top-32 size-96 rounded-full bg-cyan-300/15 blur-[90px]" />
        <div className="pointer-events-none absolute -left-32 bottom-0 size-80 rounded-full bg-blue-950/15 blur-[90px]" />

        <div className="relative mx-auto flex min-h-[520px] w-full max-w-[1760px] items-center px-4 py-16 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-16">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-medium text-white/90 backdrop-blur-sm">
              <MapPin className="size-3.5" />
              Le système d’adressage nouvelle génération
            </div>

            <h1 className="text-balance text-[clamp(2.5rem,6vw,5.2rem)] font-extrabold leading-[0.98] tracking-[-0.045em] text-white">
              Votre adresse, enfin
              <span className="block text-cyan-100">
                facile à trouver.
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-balance text-base leading-7 text-white/80 sm:text-lg">
              Un numéro suffit pour trouver, partager et rejoindre un lieu
              facilement.
            </p>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="h-12 bg-white px-6 font-semibold text-primary hover:bg-white/90"
              >
                <Link href="/commander">
                  Créer mon Adresse GN
                  <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>

              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 border-white/25 bg-white/10 px-6 text-white hover:bg-white/15 hover:text-white"
              >
                <Link href="/#comment-ca-marche">
                  Comment ça marche
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section
        id="comment-ca-marche"
        className="mx-auto w-full max-w-[1760px] px-4 py-20 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-16"
      >
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
            Adresse GN
          </p>

          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
            Un numéro. Une destination.{" "}
            <span className="text-accent">Aucun détour.</span>
          </h2>

          <p className="mt-4 text-sm leading-6 text-slate-600 md:text-base">
            La migration de la page d’accueil complète va maintenant reprendre
            les fonctionnalités et sections de l’application Adresse GN
            existante.
          </p>
        </div>
      </section>
    </main>
  );
}