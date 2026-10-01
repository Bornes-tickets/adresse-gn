import {
  expect,
  test,
  type Page,
} from "@playwright/test";


const djangoOrigin =
  "http://127.0.0.1:3999";


const PUBLIC_NUMBER =
  "BFA01-100000000";

const PRIVATE_NUMBER =
  "BFA02-100000001";

const LEGACY_NUMBER =
  "GN-CKY-582741";


function corsHeaders() {
  return {
    "access-control-allow-origin":
      "http://127.0.0.1:3100",

    "access-control-allow-headers":
      "content-type, authorization",

    "access-control-allow-methods":
      "GET, POST, OPTIONS",

    "content-type":
      "application/json",
  };
}


async function mockAddressApi(
  page: Page,
) {
  await page.route(
    `${djangoOrigin}/**`,
    async (route) => {
      const request =
        route.request();

      const url =
        new URL(
          request.url(),
        );


      if (
        request.method() ===
        "OPTIONS"
      ) {
        await route.fulfill({
          status: 204,
          headers:
            corsHeaders(),
        });

        return;
      }


      if (
        request.method() ===
          "GET" &&
        url.pathname ===
          `/api/v1/addresses/${PUBLIC_NUMBER}/`
      ) {
        await route.fulfill({
          status: 200,
          headers:
            corsHeaders(),

          body:
            JSON.stringify({
              status:
                "found",

              beacon_id:
                "11111111-1111-1111-1111-111111111111",

              result: {
                public_number:
                  PUBLIC_NUMBER,

                name:
                  "Adresse publique E2E",

                category:
                  "other",

                visibility:
                  "public",

                verification_level:
                  "verified",

                access_point_note:
                  null,

                lat:
                  9.5,

                lng:
                  -13.7,

                business_name:
                  null,

                phone:
                  null,

                opening_hours:
                  null,

                description:
                  null,

                cover_url:
                  null,
              },
            }),
        });

        return;
      }


      if (
        request.method() ===
          "GET" &&
        url.pathname ===
          `/api/v1/addresses/${PRIVATE_NUMBER}/`
      ) {
        await route.fulfill({
          status: 404,
          headers:
            corsHeaders(),

          body:
            JSON.stringify({
              status:
                "not_found",

              beacon_id:
                null,

              result:
                null,

              message:
                "Adresse introuvable.",
            }),
        });

        return;
      }


      if (
        request.method() ===
          "GET" &&
        url.pathname ===
          `/api/v1/addresses/${LEGACY_NUMBER}/`
      ) {
        await route.fulfill({
          status: 400,
          headers:
            corsHeaders(),

          body:
            JSON.stringify({
              status:
                "invalid",

              beacon_id:
                null,

              result:
                null,

              message:
                "Numéro Adresse GN invalide.",
            }),
        });

        return;
      }


      await route.fulfill({
        status: 404,
        headers:
          corsHeaders(),

        body:
          JSON.stringify({
            detail:
              `Route E2E non simulée: ${request.method()} ${url.pathname}`,
          }),
      });
    },
  );
}


test.describe(
  "Adresse GN V1 — fiche publique",
  () => {

    test.beforeEach(
      async ({ page }) => {
        await mockAddressApi(
          page,
        );
      },
    );


    test(
      "affiche une adresse V1 publique",
      async ({ page }) => {
        const response =
          await page.goto(
            `/a/${PUBLIC_NUMBER}`,
          );

        expect(
          response?.ok(),
        ).toBeTruthy();


        await expect(
          page.getByText(
            PUBLIC_NUMBER,
            {
              exact: true,
            },
          ).first(),
        ).toBeVisible();


        await expect(
          page.getByRole(
            "heading",
            {
              name:
                "Adresse publique E2E",

              exact:
                true,
            },
          ),
        ).toBeVisible();


        await expect(
          page.getByText(
            "Vérifiée",
            {
              exact: true,
            },
          ),
        ).toBeVisible();
      },
    );


    test(
      "ne révèle pas une adresse privée",
      async ({ page }) => {
        const response =
          await page.goto(
            `/a/${PRIVATE_NUMBER}`,
          );

        expect(
          response?.ok(),
        ).toBeTruthy();


        await expect(
          page.getByText(
            PRIVATE_NUMBER,
            {
              exact: true,
            },
          ),
        ).toBeVisible();


        await expect(
          page.getByText(
            "Adresse introuvable.",
            {
              exact: true,
            },
          ),
        ).toBeVisible();


        await expect(
          page.getByText(
            "Adresse privée E2E",
            {
              exact: true,
            },
          ),
        ).toHaveCount(0);
      },
    );


    test(
      "rejette un ancien numéro legacy",
      async ({ page }) => {
        const response =
          await page.goto(
            `/a/${LEGACY_NUMBER}`,
          );

        expect(
          response?.ok(),
        ).toBeTruthy();


        await expect(
          page.getByText(
            LEGACY_NUMBER,
            {
              exact: true,
            },
          ),
        ).toBeVisible();


        await expect(
          page.getByText(
            "Numéro Adresse GN invalide.",
            {
              exact: true,
            },
          ),
        ).toBeVisible();


        await expect(
          page.getByText(
            "Adresse publique E2E",
            {
              exact: true,
            },
          ),
        ).toHaveCount(0);
      },
    );


    test(
      "expose un lien V1 visible depuis la homepage",
      async ({ page }) => {
        await page.goto("/");


        const visibleExample =
          page.locator(
            'a[href="/a/CKY04-582741369"]:visible',
          ).first();


        await expect(
          visibleExample,
        ).toBeVisible();


        await expect(
          visibleExample,
        ).toContainText(
          "CKY04-582741369",
        );
      },
    );
  },
);