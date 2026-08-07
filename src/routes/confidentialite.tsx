import { createFileRoute } from "@tanstack/react-router";

const SOMMAIRE = [
  { id: "responsable", titre: "1. Responsable du traitement" },
  { id: "donnees", titre: "2. Données que nous collectons" },
  { id: "finalites", titre: "3. Pourquoi nous les utilisons" },
  { id: "visibilite", titre: "4. Adresses privées et adresses publiques" },
  { id: "partage", titre: "5. Partage avec des tiers" },
  { id: "conservation", titre: "6. Durée de conservation" },
  { id: "droits", titre: "7. Vos droits" },
  { id: "securite", titre: "8. Sécurité" },
  { id: "contact", titre: "9. Nous contacter" },
];

export const Route = createFileRoute("/confidentialite")({
  head: () => ({
    meta: [
      { title: "Confidentialité — ADRESSE GN" },
      {
        name: "description",
        content:
          "Comment Adresse GN collecte, protège et utilise les données liées aux adresses, aux balises et aux comptes, conformément aux lois guinéennes L/2016/037 et L/2016/035.",
      },
      { property: "og:title", content: "Confidentialité — ADRESSE GN" },
      {
        property: "og:description",
        content:
          "Politique de confidentialité d'Adresse GN : données collectées, visibilité des adresses, conservation et exercice de vos droits.",
      },
      {
        property: "og:url",
        content: "https://place-id-finder.lovable.app/confidentialite",
      },
    ],
    links: [
      {
        rel: "canonical",
        href: "https://place-id-finder.lovable.app/confidentialite",
      },
    ],
  }),
  component: Confidentialite,
});

function Confidentialite() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold text-foreground">
        Politique de confidentialité
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Dernière mise à jour : janvier 2026
      </p>

      <nav
        aria-label="Sommaire"
        className="mt-8 rounded-xl border border-border bg-card p-5"
      >
        <h2 className="text-sm font-semibold text-foreground">Sommaire</h2>
        <ol className="mt-3 space-y-1 text-sm text-muted-foreground">
          {SOMMAIRE.map((item) => (
            <li key={item.id}>
              <a href={`#${item.id}`} className="hover:text-primary">
                {item.titre}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-10 space-y-10 text-muted-foreground">
        <section id="responsable">
          <h2 className="text-xl font-semibold text-foreground">
            1. Responsable du traitement
          </h2>
          <p className="mt-3">
            Adresse GN, société établie à Conakry (République de Guinée),
            détermine et met en œuvre les traitements décrits dans cette page.
            Ces traitements respectent la loi L/2016/037 relative à la
            cybersécurité et à la protection des données à caractère personnel,
            ainsi que la loi L/2016/035 portant sur les transactions
            électroniques.
          </p>
        </section>

        <section id="donnees">
          <h2 className="text-xl font-semibold text-foreground">
            2. Données que nous collectons
          </h2>
          <h3 className="mt-4 font-medium text-foreground">
            2.1 Données de compte
          </h3>
          <p className="mt-2">
            Adresse e-mail, numéro de téléphone, nom déclaré et rôle
            (particulier, professionnel, agent, administrateur).
          </p>
          <h3 className="mt-4 font-medium text-foreground">
            2.2 Données d'adresse et de balise
          </h3>
          <p className="mt-2">
            Numéro de balise, coordonnées GPS relevées lors de l'installation,
            précision du relevé, quartier et commune, photo de la balise posée,
            libellé du lieu et catégorie éventuelle.
          </p>
          <h3 className="mt-4 font-medium text-foreground">
            2.3 Données d'usage
          </h3>
          <p className="mt-2">
            Recherches effectuées, itinéraires lancés, signalements déposés, et
            journaux techniques nécessaires à la sécurité du service.
          </p>
          <h3 className="mt-4 font-medium text-foreground">
            2.4 Données de paiement
          </h3>
          <p className="mt-2">
            Références de commande, montants et statut du règlement. Nous ne
            conservons aucune donnée bancaire complète.
          </p>
        </section>

        <section id="finalites">
          <h2 className="text-xl font-semibold text-foreground">
            3. Pourquoi nous les utilisons
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>Créer et maintenir votre adresse numérique.</li>
            <li>
              Permettre la recherche d'une adresse par son numéro et la
              génération d'un itinéraire.
            </li>
            <li>Planifier et contrôler la pose des balises par nos agents.</li>
            <li>Traiter vos commandes, paiements et factures.</li>
            <li>Prévenir la fraude et les usages abusifs du service.</li>
          </ul>
        </section>

        <section id="visibilite">
          <h2 className="text-xl font-semibold text-foreground">
            4. Adresses privées et adresses publiques
          </h2>
          <p className="mt-3">
            Une adresse résidentielle est privée par défaut : son propriétaire
            n'apparaît nulle part publiquement, et seule la personne qui connaît
            le numéro de balise peut afficher la position.
          </p>
          <p className="mt-3">
            Une fiche d'établissement (commerce, hôtel, service) est publique
            lorsque son responsable la publie : nom, catégorie, horaires, photos
            et position deviennent alors consultables sans compte.
          </p>
        </section>

        <section id="partage">
          <h2 className="text-xl font-semibold text-foreground">
            5. Partage avec des tiers
          </h2>
          <p className="mt-3">
            Nous ne vendons aucune donnée. Nous partageons le strict nécessaire
            avec nos prestataires d'hébergement, de messagerie et de paiement
            mobile, ainsi qu'avec les autorités compétentes sur réquisition
            légale. Les partenaires accédant à notre interface de
            programmation (API) reçoivent uniquement des adresses publiques.
          </p>
        </section>

        <section id="conservation">
          <h2 className="text-xl font-semibold text-foreground">
            6. Durée de conservation
          </h2>
          <p className="mt-3">
            Les données d'adresse sont conservées tant que la balise est active.
            Les données de compte sont conservées jusqu'à la suppression du
            compte. Les pièces comptables et journaux de sécurité sont conservés
            selon les durées légales applicables en Guinée.
          </p>
        </section>

        <section id="droits">
          <h2 className="text-xl font-semibold text-foreground">
            7. Vos droits
          </h2>
          <p className="mt-3">
            Vous disposez d'un droit d'accès, de rectification, d'opposition, de
            limitation et de suppression de vos données, ainsi que du droit de
            retirer votre consentement. Vous pouvez également demander la
            correction d'une position GPS ou signaler une balise déplacée depuis
            votre espace client.
          </p>
        </section>

        <section id="securite">
          <h2 className="text-xl font-semibold text-foreground">
            8. Sécurité
          </h2>
          <p className="mt-3">
            Les accès sont authentifiés et cloisonnés par rôle, les échanges sont
            chiffrés en transit, les photos et justificatifs sont stockés dans
            des espaces privés, et toute action sensible est journalisée.
          </p>
        </section>

        <section id="contact">
          <h2 className="text-xl font-semibold text-foreground">
            9. Nous contacter
          </h2>
          <p className="mt-3">
            Pour toute question ou demande relative à vos données, écrivez à{" "}
            <a
              href="mailto:confidentialite@adresse.gn"
              className="text-primary hover:underline"
            >
              confidentialite@adresse.gn
            </a>
            . Nous répondons dans un délai de trente jours.
          </p>
        </section>
      </div>
    </div>
  );
}
