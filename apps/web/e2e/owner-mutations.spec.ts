import {
  expect,
  test,
  type Page,
} from "@playwright/test";


const appOrigin =
  "http://127.0.0.1:3100";

const supabaseOrigin =
  "https://adresse-gn-e2e.invalid";

const djangoOrigin =
  "http://127.0.0.1:3999";

const userId =
  "33333333-3333-4333-8333-333333333333";

const email =
  "owner.mutations@example.test";

const accessToken =
  "owner-mutations-access-token";


type Beacon = {
  address_id: string;
  beacon_id: string | null;
  public_number: string;
  name: string | null;
  category: string;
  visibility: string;
  verification_level: string;
  status: string;
  access_point_note: string | null;
  establishment_id: string | null;
  searches_30d: Array<{
    day: string;
    count: number;
  }>;
};


type Favorite = {
  id: string;
  alias: string | null;
  created_at: string | null;
  public_number: string;
  name: string | null;
  category: string | null;
};


function corsHeaders() {
  return {
    "access-control-allow-origin":
      appOrigin,

    "access-control-allow-headers":
      [
        "authorization",
        "apikey",
        "content-type",
        "x-client-info",
      ].join(", "),

    "access-control-allow-methods":
      "GET, POST, PATCH, DELETE, OPTIONS",

    "access-control-allow-credentials":
      "true",

    "content-type":
      "application/json",
  };
}


function authUser() {
  return {
    id:
      userId,

    aud:
      "authenticated",

    role:
      "authenticated",

    email,

    email_confirmed_at:
      "2026-01-01T00:00:00.000Z",

    phone:
      "",

    confirmed_at:
      "2026-01-01T00:00:00.000Z",

    last_sign_in_at:
      "2026-01-01T00:00:00.000Z",

    app_metadata: {
      provider:
        "email",

      providers: [
        "email",
      ],
    },

    user_metadata:
      {},

    identities:
      [],

    created_at:
      "2026-01-01T00:00:00.000Z",

    updated_at:
      "2026-01-01T00:00:00.000Z",

    is_anonymous:
      false,
  };
}


async function mockSupabase(
  page: Page,
) {
  await page.route(
    `${supabaseOrigin}/**`,
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
          "POST" &&
        url.pathname ===
          "/auth/v1/token" &&
        url.searchParams.get(
          "grant_type",
        ) === "password"
      ) {
        await route.fulfill({
          status: 200,
          headers:
            corsHeaders(),

          body: JSON.stringify({
            access_token:
              accessToken,

            token_type:
              "bearer",

            expires_in:
              3600,

            expires_at:
              4_102_444_800,

            refresh_token:
              "owner-mutations-refresh-token",

            user:
              authUser(),
          }),
        });

        return;
      }


      if (
        request.method() ===
          "GET" &&
        url.pathname ===
          "/auth/v1/user"
      ) {
        await route.fulfill({
          status: 200,
          headers:
            corsHeaders(),

          body:
            JSON.stringify(
              authUser(),
            ),
        });

        return;
      }


      if (
        request.method() ===
          "POST" &&
        url.pathname ===
          "/auth/v1/logout"
      ) {
        await route.fulfill({
          status: 204,
          headers:
            corsHeaders(),
        });

        return;
      }


      await route.fulfill({
        status: 404,
        headers:
          corsHeaders(),

        body: JSON.stringify({
          message:
            "Supabase E2E route not mocked",
        }),
      });
    },
  );
}


type DjangoState = {
  beacon:
    Beacon;

  favorites:
    Favorite[];

  beaconPatchBodies:
    Array<{
      name:
        string | null;

      category:
        string;

      visibility:
        "public" | "private";

      access_point_note:
        string | null;
    }>;

  favoritePostBodies:
    Array<{
      number:
        string;

      alias:
        string | null;
    }>;

  favoritePatchBodies:
    Array<{
      alias:
        string | null;
    }>;

  deletedFavoriteIds:
    string[];

  mutationAuthHeaders:
    string[];
};


async function mockDjango(
  page: Page,
) {
  const state:
    DjangoState = {
      beacon: {
        address_id:
          "address-e2e-1",

        beacon_id:
          "beacon-e2e-1",

        public_number:
          "GN-CKY-123456",

        name:
          "Maison E2E",

        category:
          "habitation",

        visibility:
          "public",

        verification_level:
          "verified",

        status:
          "active",

        access_point_note:
          "Portail bleu",

        establishment_id:
          null,

        searches_30d: [
          {
            day:
              "2026-09-01",

            count:
              2,
          },
        ],
      },

      favorites: [
        {
          id:
            "favorite-e2e-1",

          alias:
            "Maison",

          created_at:
            "2026-09-01T10:00:00.000Z",

          public_number:
            "GN-CKY-123456",

          name:
            "Maison E2E",

          category:
            "habitation",
        },
      ],

      beaconPatchBodies:
        [],

      favoritePostBodies:
        [],

      favoritePatchBodies:
        [],

      deletedFavoriteIds:
        [],

      mutationAuthHeaders:
        [],
    };


  await page.route(
    `${djangoOrigin}/**`,
    async (route) => {
      const request =
        route.request();

      const url =
        new URL(
          request.url(),
        );

      const method =
        request.method();

      const auth =
        request.headers()
          .authorization
        ?? "";


      if (
        method ===
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
        method ===
          "GET" &&
        url.pathname ===
          "/api/v1/auth/me/"
      ) {
        await route.fulfill({
          status: 200,
          headers:
            corsHeaders(),

          body: JSON.stringify({
            authenticated:
              true,

            user: {
              id:
                userId,

              email,

              role:
                "user",
            },
          }),
        });

        return;
      }


      if (
        method ===
          "GET" &&
        url.pathname ===
          "/api/v1/owner/beacons/"
      ) {
        await route.fulfill({
          status: 200,
          headers:
            corsHeaders(),

          body: JSON.stringify({
            items: [
              state.beacon,
            ],
          }),
        });

        return;
      }


      if (
        method ===
          "PATCH" &&
        url.pathname ===
          "/api/v1/owner/beacons/address-e2e-1/"
      ) {
        const body =
          request.postDataJSON() as {
            name:
              string | null;

            category:
              string;

            visibility:
              "public" | "private";

            access_point_note:
              string | null;
          };

        state.beaconPatchBodies.push(
          body,
        );

        state.mutationAuthHeaders.push(
          auth,
        );

        state.beacon = {
          ...state.beacon,
          ...body,
        };

        await route.fulfill({
          status: 200,
          headers:
            corsHeaders(),

          body: JSON.stringify({
            ok:
              true,

            status:
              "updated",

            message:
              "Balise mise à jour.",
          }),
        });

        return;
      }


      if (
        method ===
          "GET" &&
        url.pathname ===
          "/api/v1/owner/favorites/"
      ) {
        await route.fulfill({
          status: 200,
          headers:
            corsHeaders(),

          body: JSON.stringify({
            items:
              state.favorites,
          }),
        });

        return;
      }


      if (
        method ===
          "POST" &&
        url.pathname ===
          "/api/v1/owner/favorites/"
      ) {
        const body =
          request.postDataJSON() as {
            number:
              string;

            alias:
              string | null;
          };

        state.favoritePostBodies.push(
          body,
        );

        state.mutationAuthHeaders.push(
          auth,
        );

        state.favorites = [
          ...state.favorites,
          {
            id:
              "favorite-e2e-2",

            alias:
              body.alias,

            created_at:
              "2026-09-17T12:00:00.000Z",

            public_number:
              body.number,

            name:
              "Bureau E2E",

            category:
              "entreprise",
          },
        ];

        await route.fulfill({
          status: 200,
          headers:
            corsHeaders(),

          body: JSON.stringify({
            ok:
              true,

            status:
              "created",

            favorite_id:
              "favorite-e2e-2",

            created_at:
              "2026-09-17T12:00:00.000Z",

            message:
              "Favori enregistré.",
          }),
        });

        return;
      }


      if (
        method ===
          "PATCH" &&
        url.pathname ===
          "/api/v1/owner/favorites/favorite-e2e-2/"
      ) {
        const body =
          request.postDataJSON() as {
            alias:
              string | null;
          };

        state.favoritePatchBodies.push(
          body,
        );

        state.mutationAuthHeaders.push(
          auth,
        );

        state.favorites =
          state.favorites.map(
            (favorite) =>
              favorite.id ===
                "favorite-e2e-2"
                ? {
                    ...favorite,
                    alias:
                      body.alias,
                  }
                : favorite,
          );

        await route.fulfill({
          status: 200,
          headers:
            corsHeaders(),

          body: JSON.stringify({
            ok:
              true,

            status:
              "updated",

            message:
              "Alias mis à jour.",
          }),
        });

        return;
      }


      if (
        method ===
          "DELETE" &&
        url.pathname ===
          "/api/v1/owner/favorites/favorite-e2e-2/"
      ) {
        state.deletedFavoriteIds.push(
          "favorite-e2e-2",
        );

        state.mutationAuthHeaders.push(
          auth,
        );

        state.favorites =
          state.favorites.filter(
            (favorite) =>
              favorite.id !==
              "favorite-e2e-2",
          );

        await route.fulfill({
          status: 200,
          headers:
            corsHeaders(),

          body: JSON.stringify({
            ok:
              true,

            status:
              "deleted",

            message:
              "Favori retiré.",
          }),
        });

        return;
      }


      await route.fulfill({
        status: 404,
        headers:
          corsHeaders(),

        body: JSON.stringify({
          detail:
            `Django E2E route non simulée: ${method} ${url.pathname}`,
        }),
      });
    },
  );


  return state;
}


async function loginOwner(
  page: Page,
) {
  await page.goto(
    "/login?returnTo=/",
  );

  await page.getByLabel(
    "Email",
  ).fill(
    email,
  );

  await page.getByLabel(
    "Mot de passe",
  ).fill(
    "E2e-Passw0rd!",
  );

  await page.getByRole(
    "button",
    {
      name:
        "Se connecter",
    },
  ).click();

  await expect(
    page,
  ).toHaveURL(
    `${appOrigin}/`,
  );
}


test(
  "modifie une balise propriétaire via Django simulé",
  async ({ page }) => {
    await mockSupabase(
      page,
    );

    const django =
      await mockDjango(
        page,
      );


    await loginOwner(
      page,
    );

    await page.goto(
      "/mon-compte/beacons",
    );


    await expect(
      page.getByRole(
        "heading",
        {
          name:
            "Mes balises",
          exact:
            true,
        },
      ),
    ).toBeVisible();


    await expect(
      page.getByText(
        "GN-CKY-123456",
        {
          exact:
            true,
        },
      ),
    ).toBeVisible();


    await page.getByRole(
      "button",
      {
        name:
          "Modifier",
        exact:
          true,
      },
    ).click();


    const dialog =
      page.getByRole(
        "dialog",
      );


    await expect(
      dialog.getByRole(
        "heading",
        {
          name:
            "Modifier GN-CKY-123456",
          exact:
            true,
        },
      ),
    ).toBeVisible();


    await dialog.getByLabel(
      "Nom du lieu",
    ).fill(
      "Bureau Kaloum E2E",
    );

    await dialog.getByLabel(
      "Catégorie",
    ).selectOption(
      "entreprise",
    );

    await dialog.getByLabel(
      "Visibilité",
    ).selectOption(
      "private",
    );

    await dialog.getByLabel(
      "Indication d'accès",
    ).fill(
      "Deuxième étage",
    );


    await dialog.getByRole(
      "button",
      {
        name:
          "Enregistrer",
        exact:
          true,
      },
    ).click();


    await expect(
      page.getByText(
        "Balise mise à jour.",
        {
          exact:
            true,
        },
      ),
    ).toBeVisible();


    await expect(
      page.getByText(
        "Bureau Kaloum E2E",
        {
          exact:
            true,
        },
      ),
    ).toBeVisible();


    await expect(
      page.getByText(
        "Entreprise",
        {
          exact:
            true,
        },
      ),
    ).toBeVisible();


    await expect(
      page.getByText(
        "Privée",
        {
          exact:
            true,
        },
      ),
    ).toBeVisible();


    expect(
      django.beaconPatchBodies,
    ).toEqual([
      {
        name:
          "Bureau Kaloum E2E",

        category:
          "entreprise",

        visibility:
          "private",

        access_point_note:
          "Deuxième étage",
      },
    ]);


    expect(
      django.mutationAuthHeaders,
    ).toEqual([
      `Bearer ${accessToken}`,
    ]);
  },
);


test(
  "ajoute renomme puis supprime un favori via Django simulé",
  async ({ page }) => {
    await mockSupabase(
      page,
    );

    const django =
      await mockDjango(
        page,
      );


    await loginOwner(
      page,
    );

    await page.goto(
      "/mon-compte/favorites",
    );


    await expect(
      page.getByRole(
        "heading",
        {
          name:
            "Mes favoris",
          exact:
            true,
        },
      ),
    ).toBeVisible();


    await expect(
      page.getByText(
        "Maison",
        {
          exact:
            true,
        },
      ),
    ).toBeVisible();


    await page.getByPlaceholder(
      "GN-CKY-123456",
    ).fill(
      "654321",
    );

    await page.getByPlaceholder(
      "Alias (Maison, Bureau…)",
    ).fill(
      "Travail",
    );

    await page.getByRole(
      "button",
      {
        name:
          "Ajouter",
        exact:
          true,
      },
    ).click();


    await expect(
      page.getByText(
        "Favori enregistré.",
        {
          exact:
            true,
        },
      ),
    ).toBeVisible();


    await expect(
      page.getByText(
        "GN-CKY-654321",
        {
          exact:
            true,
        },
      ),
    ).toBeVisible();


    let article =
      page.locator(
        "article",
      ).filter({
        hasText:
          "GN-CKY-654321",
      });


    await expect(
      article,
    ).toContainText(
      "Travail",
    );


    await article.getByRole(
      "button",
      {
        name:
          "Renommer",
        exact:
          true,
      },
    ).click();


    const aliasInput =
      article.getByRole(
        "textbox",
      );


    await aliasInput.fill(
      "Bureau E2E",
    );


    await article.getByRole(
      "button",
      {
        name:
          "OK",
        exact:
          true,
      },
    ).click();


    await expect(
      page.getByText(
        "Alias mis à jour.",
        {
          exact:
            true,
        },
      ),
    ).toBeVisible();


    article =
      page.locator(
        "article",
      ).filter({
        hasText:
          "GN-CKY-654321",
      });


    await expect(
      article,
    ).toContainText(
      "Bureau E2E",
    );


    await article.locator(
      "button",
    ).last().click();


    await expect(
      page.getByText(
        "Favori retiré.",
        {
          exact:
            true,
        },
      ),
    ).toBeVisible();


    await expect(
      page.getByText(
        "GN-CKY-654321",
        {
          exact:
            true,
        },
      ),
    ).toHaveCount(
      0,
    );


    expect(
      django.favoritePostBodies,
    ).toEqual([
      {
        number:
          "GN-CKY-654321",

        alias:
          "Travail",
      },
    ]);


    expect(
      django.favoritePatchBodies,
    ).toEqual([
      {
        alias:
          "Bureau E2E",
      },
    ]);


    expect(
      django.deletedFavoriteIds,
    ).toEqual([
      "favorite-e2e-2",
    ]);


    expect(
      django.mutationAuthHeaders,
    ).toEqual([
      `Bearer ${accessToken}`,
      `Bearer ${accessToken}`,
      `Bearer ${accessToken}`,
    ]);
  },
);
