import {
  expect,
  test,
} from "@playwright/test";


test.describe(
  "Pages publiques",
  () => {
    test(
      "la page d'accueil se charge",
      async ({ page }) => {
        const response =
          await page.goto("/");

        expect(
          response?.ok(),
        ).toBeTruthy();

        await expect(
          page,
        ).toHaveTitle(
          /ADRESSE GN/i,
        );
      },
    );


    test(
      "la page de connexion affiche le formulaire",
      async ({ page }) => {
        await page.goto(
          "/login",
        );

        await expect(
          page.getByRole(
            "heading",
            {
              name:
                "Bon retour",
            },
          ),
        ).toBeVisible();

        await expect(
          page.getByLabel(
            "Email",
          ),
        ).toBeVisible();

        await expect(
          page.getByLabel(
            "Mot de passe",
          ),
        ).toBeVisible();

        await expect(
          page.getByRole(
            "button",
            {
              name:
                "Se connecter",
            },
          ),
        ).toBeVisible();
      },
    );
  },
);


const protectedOwnerRoutes = [
  "/mon-compte",
  "/mon-compte/beacons",
  "/mon-compte/favorites",
  "/mon-compte/commandes",
  "/mon-compte/signalements",
  "/mon-compte/settings",
] as const;


for (
  const route
  of protectedOwnerRoutes
) {
  test(
    `redirige un visiteur non connecté depuis ${route}`,
    async ({ page }) => {
      await page.goto(route);

      const expectedReturnTo =
        encodeURIComponent(
          route,
        );

      await expect(
        page,
      ).toHaveURL(
        new RegExp(
          `/login\\?returnTo=${expectedReturnTo}$`,
        ),
      );
    },
  );
}
