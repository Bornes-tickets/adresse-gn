import { Link, createFileRoute } from "@tanstack/react-router";
import { Compass, HeartHandshake, ShieldCheck, Users } from "lucide-react";

import { Reveal } from "@/components/Reveal";
import { Button } from "@/components/ui/button";

const VALEURS = [
  {
    icone: ShieldCheck,
    titre: "Fiabilité",
    texte:
      "Chaque position est relevée sur place par un agent agréé, puis contrôlée avant publication.",
  },
  {
    icone: HeartHandshake,
    titre: "Respect de la vie privée",
    texte:
      "Une adresse résidentielle reste privée par défaut : elle n'est visible que par ceux à qui vous donnez le numéro.",
  },
  {
    icone: Compass,
    titre: "Utilité immédiate",
    texte:
      "Pas de théorie : un numéro, une carte, un itinéraire qui s'ouvre dans l'application de navigation.",
  },
  {
    icone: Users,
    titre: "Ancrage local",
    texte:
      "Le réseau d'agents installateurs est recruté et formé dans les quartiers qu'il couvre.",
  },
];

const EQUIPE = [
  { role: "Direction générale", note: "Poste présenté prochainement" },
  { role: "Opérations terrain", note: "Poste présenté prochainement" },
  { role: "Technologie et données", note: "Poste présenté prochainement" },
];

export const Route = createFileRoute("/a-propos")({
  head: () => ({
    meta: [
      { title: "À propos — ADRESSE GN" },
      {
        name: "description",
        content:
          "Adresse GN construit le système d'adressage guinéen : un numéro unique par lieu, une position GPS vérifiée par un agent et un itinéraire fiable pour tous.",
      },
      { property: "og:title", content: "À propos — ADRESSE GN" },
      {
        property: "og:description",
        content:
          "Notre mission : donner à chaque lieu de Guinée une adresse simple à partager et fiable à suivre.",
      },
      { property: "og:url", content: "https://place-id-finder.lovable.app/a-propos" },
      {
        property: "og:image",
        content: "https://place-id-finder.lovable.app/og-cover.jpg",
      },
      {
        name: "twitter:image",
        content: "https://place-id-finder.lovable.app/og-cover.jpg",
      },
    ],
    links: [
      { rel: "canonical", href: "https://place-id-finder.lovable.app/a-propos" },
    ],
  }),
  component: APropos,
});

function APropos() {
  return (
    <div>
      <section className="bg-linear-to-br from-primary to-[oklch(0.32_0.07_262)] px-4 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-primary-foreground">
            Donner une adresse à chaque lieu de Guinée
          </h1>
          <p className="mt-5 text-lg text-primary-foreground/85">
            Adresse GN attribue à chaque bâtiment, commerce ou parcelle un numéro
            unique matérialisé par une balise physique. Ce numéro suffit à
            retrouver la position exacte du lieu et à s'y rendre.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl space-y-6 px-4 py-16">
        <Reveal>
          <h2 className="text-2xl font-bold text-foreground">Notre mission</h2>
          <p className="mt-4 text-muted-foreground">
            En Guinée, expliquer où l'on habite prend souvent plusieurs minutes,
            un appel téléphonique et quelques repères approximatifs. Cette
            friction coûte du temps aux familles, des courses perdues aux
            livreurs et du chiffre d'affaires aux commerces. Notre mission est de
            remplacer cette explication par un numéro que l'on peut écrire,
            dicter ou envoyer en une seconde.
          </p>
        </Reveal>

        <Reveal>
          <h2 className="mt-10 text-2xl font-bold text-foreground">Notre vision</h2>
          <p className="mt-4 text-muted-foreground">
            Nous construisons une couche d'adressage nationale ouverte aux
            services publics comme aux entreprises privées : secours, logistique,
            commerce en ligne, transport, distribution d'eau et d'électricité.
            Chaque adresse vérifiée aujourd'hui rend ces services plus rapides
            demain.
          </p>
        </Reveal>
      </section>

      <section
        className="relative bg-primary bg-cover bg-center px-4 py-24"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=1600&q=80')",
        }}
      >
        <div className="absolute inset-0 bg-primary/85" aria-hidden="true" />
        <Reveal className="relative mx-auto max-w-3xl text-center">
          <h2 className="font-mono text-sm uppercase tracking-[0.2em] text-primary-foreground/70">
            Pourquoi
          </h2>
          <blockquote className="mt-6 text-2xl font-semibold leading-snug text-primary-foreground sm:text-3xl">
            « Une adresse n'est pas un détail administratif. C'est la condition
            pour être livré, secouru, visité — et donc pour exister dans
            l'économie. »
          </blockquote>
        </Reveal>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16">
        <Reveal>
          <h2 className="text-2xl font-bold text-foreground">Nos valeurs</h2>
        </Reveal>
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {VALEURS.map((valeur, index) => (
            <Reveal key={valeur.titre} delay={index * 80}>
              <div className="h-full rounded-xl border border-border bg-card p-6 transition-transform duration-200 hover:scale-[1.02]">
                <span className="inline-flex size-11 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <valeur.icone className="size-5" />
                </span>
                <h3 className="mt-4 text-base font-semibold text-foreground">
                  {valeur.titre}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">{valeur.texte}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-16">
        <Reveal>
          <h2 className="text-2xl font-bold text-foreground">L'équipe</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Adresse GN réunit des profils opérations, terrain et technologie. Les
            présentations nominatives seront publiées ici.
          </p>
        </Reveal>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {EQUIPE.map((membre, index) => (
            <Reveal key={membre.role} delay={index * 80}>
              <div className="rounded-xl border border-border bg-card p-6">
                <div
                  className="size-12 rounded-full bg-muted"
                  aria-hidden="true"
                />
                <h3 className="mt-4 text-sm font-semibold text-foreground">
                  {membre.role}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">{membre.note}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-20">
        <Reveal>
          <div className="rounded-2xl border border-border bg-card px-6 py-10 text-center">
            <h2 className="text-2xl font-bold text-foreground">
              Prêt à obtenir votre numéro ?
            </h2>
            <Button asChild size="lg" className="mt-6">
              <Link to="/tarifs">Voir les offres</Link>
            </Button>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
