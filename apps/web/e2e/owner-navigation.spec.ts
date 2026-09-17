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
  "22222222-2222-4222-8222-222222222222";

const email =
  "owner.navigation@example.test";

const accessToken =
  "owner-navigation-access-token";


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
  const state = {
    tokenCalls: 0,
    userCalls: 0,
    logoutCalls: 0,
  };


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
        state.tokenCalls += 1;

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
              "owner-navigation-refresh-token",

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
        state.userCalls += 1;

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
        state.logoutCalls += 1;

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


  return state;
}


async function mockDjango(
  page: Page,
) {
  const state = {
    calls:
      [] as string[],

    authorization:
      [] as string[],
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


      state.calls.push(
        `${request.method()} ${url.pathname}`,
      );

      state.authorization.push(
        request.headers()
          .authorization
        ?? "",
      );


      if (
        request.method() ===
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
        request.method() ===
          "GET" &&
        url.pathname ===
          "/api/v1/owner/dashboard/"
      ) {
        await route.fulfill({
          status: 200,
          headers:
            corsHeaders(),

          body: JSON.stringify({
            beaconCount:
              2,

            searches30d:
              14,

            routes30d:
              5,

            activities:
              [],
          }),
        });

        return;
      }


      if (
        request.method() ===
          "GET" &&
        url.pathname ===
          "/api/v1/owner/beacons/"
      ) {
        await route.fulfill({
          status: 200,
          headers:
            corsHeaders(),
          body:
            JSON.stringify({
              items: [],
            }),
        });

        return;
      }


      if (
        request.method() ===
          "GET" &&
        url.pathname ===
          "/api/v1/owner/favorites/"
      ) {
        await route.fulfill({
          status: 200,
          headers:
            corsHeaders(),
          body:
            JSON.stringify({
              items: [],
            }),
        });

        return;
      }


      if (
        request.method() ===
          "GET" &&
        url.pathname ===
          "/api/v1/owner/orders/"
      ) {
        await route.fulfill({
          status: 200,
          headers:
            corsHeaders(),
          body:
            JSON.stringify({
              items: [],
            }),
        });

        return;
      }


      if (
        request.method() ===
          "GET" &&
        url.pathname ===
          "/api/v1/owner/reports/"
      ) {
        await route.fulfill({
          status: 200,
          headers:
            corsHeaders(),
          body:
            JSON.stringify({
              items: [],
            }),
        });

        return;
      }


      if (
        request.method() ===
          "GET" &&
        url.pathname ===
          "/api/v1/owner/claims/"
      ) {
        await route.fulfill({
          status: 200,
          headers:
            corsHeaders(),
          body:
            JSON.stringify({
              items: [],
            }),
        });

        return;
      }


      if (
        request.method() ===
          "GET" &&
        url.pathname ===
          "/api/v1/owner/profile/"
      ) {
        await route.fulfill({
          status: 200,
          headers:
            corsHeaders(),

          body: JSON.stringify({
            id:
              userId,

            full_name:
              "Propriétaire E2E",

            phone:
              "+224600000000",

            role:
              "user",

            created_at:
              "2026-01-01T00:00:00.000Z",
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
            `Django E2E route non simulée: ${url.pathname}`,
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
  "session propriétaire et navigation entre les six écrans privés",
  async ({ page }) => {
    const supabase =
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
      "/mon-compte",
    );

    await expect(
      page.getByRole(
        "heading",
        {
          name:
            "Tableau de bord",
          exact:
            true,
        },
      ),
    ).toBeVisible();

    await expect(
      page.getByText(
        email,
        {
          exact:
            true,
        },
      ),
    ).toBeVisible();

    await expect(
      page.getByText(
        "2",
        {
          exact:
            true,
        },
      ).first(),
    ).toBeVisible();


    const routes = [
      {
        link:
          "Mes balises",

        url:
          "/mon-compte/beacons",

        heading:
          "Mes balises",
      },

      {
        link:
          "Mes favoris",

        url:
          "/mon-compte/favorites",

        heading:
          "Mes favoris",
      },

      {
        link:
          "Commandes",

        url:
          "/mon-compte/commandes",

        heading:
          "Mes commandes",
      },

      {
        link:
          "Signalements",

        url:
          "/mon-compte/signalements",

        heading:
          "Mes signalements",
      },

      {
        link:
          "Paramètres",

        url:
          "/mon-compte/settings",

        heading:
          "Paramètres",
      },
    ] as const;


    for (
      const item
      of routes
    ) {
      const link =
        page.locator(
          `aside a[href="${item.url}"]`,
        );

      await expect(
        link,
      ).toBeVisible();

      await expect(
        link,
      ).toHaveAttribute(
        "href",
        item.url,
      );

      await link.click();

      await expect(
        page,
      ).toHaveURL(
        `${appOrigin}${item.url}`,
        {
          timeout:
            15_000,
        },
      );

      await expect(
        page.getByRole(
          "heading",
          {
            name:
              item.heading,
            exact:
              true,
          },
        ),
      ).toBeVisible({
        timeout:
          15_000,
      });
    }


    const expectedApiCalls = [
      "GET /api/v1/auth/me/",
      "GET /api/v1/owner/dashboard/",
      "GET /api/v1/owner/beacons/",
      "GET /api/v1/owner/favorites/",
      "GET /api/v1/owner/orders/",
      "GET /api/v1/owner/reports/",
      "GET /api/v1/owner/claims/",
      "GET /api/v1/owner/profile/",
    ];


    for (
      const expected
      of expectedApiCalls
    ) {
      expect(
        django.calls,
      ).toContain(
        expected,
      );
    }


    expect(
      django.authorization,
    ).not.toContain(
      "",
    );

    expect(
      django.authorization.every(
        (value) =>
          value ===
          `Bearer ${accessToken}`,
      ),
    ).toBeTruthy();

    expect(
      supabase.tokenCalls,
    ).toBe(1);
  },
);


test(
  "déconnexion propriétaire efface la session et revient à l'accueil",
  async ({ page }) => {
    const supabase =
      await mockSupabase(
        page,
      );

    await mockDjango(
      page,
    );


    await loginOwner(
      page,
    );

    await page.goto(
      "/mon-compte",
    );

    await expect(
      page.getByRole(
        "heading",
        {
          name:
            "Tableau de bord",
          exact:
            true,
        },
      ),
    ).toBeVisible();


    await page.getByRole(
      "button",
      {
        name:
          "Déconnexion",
      },
    ).click();


    await expect(
      page,
    ).toHaveURL(
      `${appOrigin}/`,
    );

    expect(
      supabase.logoutCalls,
    ).toBe(1);
  },
);
