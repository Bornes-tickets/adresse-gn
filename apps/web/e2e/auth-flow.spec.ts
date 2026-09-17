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
  "11111111-1111-4111-8111-111111111111";

const email =
  "owner.e2e@example.test";

const accessToken =
  "e2e-access-token";


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
      "GET, POST, OPTIONS",

    "access-control-allow-credentials":
      "true",

    "content-type":
      "application/json",
  };
}


type SupabaseMode =
  | "success"
  | "invalid_credentials";


async function mockSupabase(
  page: Page,
  mode: SupabaseMode,
) {
  const state = {
    tokenCalls: 0,
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


        if (
          mode ===
          "invalid_credentials"
        ) {
          await route.fulfill({
            status: 400,
            headers:
              corsHeaders(),
            body: JSON.stringify({
              code:
                "invalid_credentials",
              msg:
                "Invalid login credentials",
            }),
          });

          return;
        }


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
              "e2e-refresh-token",
            user: {
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
            },
          }),
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


type DjangoMode =
  | "success"
  | "forbidden";


async function mockDjango(
  page: Page,
  mode: DjangoMode,
) {
  const state = {
    meCalls: 0,
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


      if (
        request.method() ===
          "GET" &&
        url.pathname ===
          "/api/v1/auth/me/"
      ) {
        state.meCalls += 1;

        state.authorization.push(
          request.headers()
            .authorization
          ?? "",
        );


        if (
          mode ===
          "forbidden"
        ) {
          await route.fulfill({
            status: 403,
            headers:
              corsHeaders(),
            body: JSON.stringify({
              detail:
                "Session refusée par Django.",
            }),
          });

          return;
        }


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


      await route.fulfill({
        status: 404,
        headers:
          corsHeaders(),
        body: JSON.stringify({
          detail:
            "Django E2E route not mocked.",
        }),
      });
    },
  );


  return state;
}


async function submitLogin(
  page: Page,
) {
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
}


test(
  "connexion réussie seulement après validation Supabase et Django",
  async ({ page }) => {
    const supabase =
      await mockSupabase(
        page,
        "success",
      );

    const django =
      await mockDjango(
        page,
        "success",
      );


    await page.goto(
      "/login?returnTo=/",
    );

    await submitLogin(
      page,
    );


    await expect(
      page,
    ).toHaveURL(
      `${appOrigin}/`,
    );


    expect(
      supabase.tokenCalls,
    ).toBe(1);

    expect(
      django.meCalls,
    ).toBe(1);

    expect(
      django.authorization,
    ).toEqual([
      `Bearer ${accessToken}`,
    ]);
  },
);


test(
  "identifiants Supabase invalides : Django n'est pas appelé",
  async ({ page }) => {
    const supabase =
      await mockSupabase(
        page,
        "invalid_credentials",
      );

    const django =
      await mockDjango(
        page,
        "success",
      );


    await page.goto(
      "/login",
    );

    await submitLogin(
      page,
    );


    await expect(
      page.getByText(
        "Connexion impossible",
      ),
    ).toBeVisible();


    await expect(
      page,
    ).toHaveURL(
      `${appOrigin}/login`,
    );


    expect(
      supabase.tokenCalls,
    ).toBe(1);

    expect(
      django.meCalls,
    ).toBe(0);
  },
);


test(
  "session Supabase refusée par Django : la connexion reste bloquée",
  async ({ page }) => {
    const supabase =
      await mockSupabase(
        page,
        "success",
      );

    const django =
      await mockDjango(
        page,
        "forbidden",
      );


    await page.goto(
      "/login",
    );

    await submitLogin(
      page,
    );


    await expect(
      page.getByText(
        "Connexion impossible",
      ),
    ).toBeVisible();


    await expect(
      page,
    ).toHaveURL(
      `${appOrigin}/login`,
    );


    expect(
      supabase.tokenCalls,
    ).toBe(1);

    expect(
      django.meCalls,
    ).toBe(1);

    expect(
      django.authorization,
    ).toEqual([
      `Bearer ${accessToken}`,
    ]);
  },
);
