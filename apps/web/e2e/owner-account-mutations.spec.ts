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
  "55555555-5555-4555-8555-555555555555";

const email =
  "owner.account.mutations@example.test";

const accessToken =
  "owner-account-mutations-access-token";


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


type OwnerProfile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: string;
  created_at: string | null;
};


type DjangoState = {
  beacon: Beacon;
  profile: OwnerProfile;

  suspendCalls: string[];

  movingBodies: Array<{
    description: string | null;
  }>;

  profilePatchBodies: Array<{
    full_name: string | null;
    phone: string | null;
  }>;

  deactivateBodies: Array<{
    confirm: string;
  }>;

  mutationAuthHeaders: string[];
};


type SupabaseState = {
  logoutCalls: number;
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
  const state:
    SupabaseState = {
      logoutCalls:
        0,
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

      const method =
        request.method();


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
              "owner-account-mutations-refresh-token",

            user:
              authUser(),
          }),
        });

        return;
      }


      if (
        method ===
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
        method ===
          "POST" &&
        url.pathname ===
          "/auth/v1/logout"
      ) {
        state.logoutCalls +=
          1;

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
            `Supabase E2E route non simulée: ${method} ${url.pathname}`,
        }),
      });
    },
  );

  return state;
}


async function mockDjango(
  page: Page,
) {
  const state:
    DjangoState = {
      beacon: {
        address_id:
          "address-r5a-1",

        beacon_id:
          "beacon-r5a-1",

        public_number:
          "GN-CKY-555555",

        name:
          "Maison R5A",

        category:
          "habitation",

        visibility:
          "public",

        verification_level:
          "verified",

        status:
          "active",

        access_point_note:
          "Portail vert",

        establishment_id:
          null,

        searches_30d: [
          {
            day:
              "2026-09-01",

            count:
              3,
          },
        ],
      },

      profile: {
        id:
          userId,

        full_name:
          "Propriétaire R5A",

        phone:
          "+224 600 00 00 00",

        role:
          "user",

        created_at:
          "2026-01-01T00:00:00.000Z",
      },

      suspendCalls:
        [],

      movingBodies:
        [],

      profilePatchBodies:
        [],

      deactivateBodies:
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
          "POST" &&
        url.pathname ===
          "/api/v1/owner/beacons/address-r5a-1/suspend/"
      ) {
        state.suspendCalls.push(
          "address-r5a-1",
        );

        state.mutationAuthHeaders.push(
          auth,
        );

        state.beacon = {
          ...state.beacon,
          status:
            "suspended",
        };

        await route.fulfill({
          status: 200,
          headers:
            corsHeaders(),

          body: JSON.stringify({
            ok:
              true,

            status:
              "suspended",

            message:
              "Balise suspendue.",
          }),
        });

        return;
      }


      if (
        method ===
          "POST" &&
        url.pathname ===
          "/api/v1/owner/beacons/address-r5a-1/moving-report/"
      ) {
        const body =
          request.postDataJSON() as {
            description:
              string | null;
          };

        state.movingBodies.push(
          body,
        );

        state.mutationAuthHeaders.push(
          auth,
        );

        await route.fulfill({
          status: 200,
          headers:
            corsHeaders(),

          body: JSON.stringify({
            ok:
              true,

            status:
              "created",

            report_id:
              "moving-report-r5a-1",

            report_status:
              "open",

            message:
              "Déménagement enregistré.",
          }),
        });

        return;
      }


      if (
        method ===
          "GET" &&
        url.pathname ===
          "/api/v1/owner/profile/"
      ) {
        await route.fulfill({
          status: 200,
          headers:
            corsHeaders(),

          body:
            JSON.stringify(
              state.profile,
            ),
        });

        return;
      }


      if (
        method ===
          "PATCH" &&
        url.pathname ===
          "/api/v1/owner/profile/"
      ) {
        const body =
          request.postDataJSON() as {
            full_name:
              string | null;

            phone:
              string | null;
          };

        state.profilePatchBodies.push(
          body,
        );

        state.mutationAuthHeaders.push(
          auth,
        );

        state.profile = {
          ...state.profile,
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
              "Profil mis à jour.",

            profile:
              state.profile,
          }),
        });

        return;
      }


      if (
        method ===
          "POST" &&
        url.pathname ===
          "/api/v1/owner/account/deactivate/"
      ) {
        const body =
          request.postDataJSON() as {
            confirm:
              string;
          };

        state.deactivateBodies.push(
          body,
        );

        state.mutationAuthHeaders.push(
          auth,
        );

        await route.fulfill({
          status: 200,
          headers:
            corsHeaders(),

          body: JSON.stringify({
            ok:
              true,

            status:
              "deactivated",

            deactivated_at:
              "2026-09-17T23:30:00.000Z",

            audit_id:
              "audit-r5a-1",

            push_subscriptions_revoked:
              2,

            sessions_revoked:
              true,

            message:
              "Compte désactivé.",
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
  "suspend une balise propriétaire via Django simulé",
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

    const card =
      page.locator(
        "[data-slot='card']",
      ).filter({
        hasText:
          "GN-CKY-555555",
      });

    await expect(
      card,
    ).toBeVisible();

    await card.locator(
      "button",
    ).last().click();

    const dialog =
      page.getByRole(
        "dialog",
      );

    await expect(
      dialog.getByRole(
        "heading",
        {
          name:
            "Suspendre cette adresse ?",
        },
      ),
    ).toBeVisible();

    await dialog.getByRole(
      "button",
      {
        name:
          "Confirmer",
        exact:
          true,
      },
    ).click();

    await expect(
      page.getByText(
        "Balise suspendue.",
        {
          exact:
            true,
        },
      ),
    ).toBeVisible();

    await expect(
      card.getByText(
        "Suspendue",
        {
          exact:
            true,
        },
      ),
    ).toBeVisible();

    expect(
      django.suspendCalls,
    ).toEqual([
      "address-r5a-1",
    ]);

    expect(
      django.mutationAuthHeaders,
    ).toEqual([
      `Bearer ${accessToken}`,
    ]);
  },
);


test(
  "signale un déménagement via Django simulé",
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

    const card =
      page.locator(
        "[data-slot='card']",
      ).filter({
        hasText:
          "GN-CKY-555555",
      });

    await card.getByRole(
      "button",
      {
        name:
          "Déménagement",
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
            "Signaler un déménagement",
        },
      ),
    ).toBeVisible();

    await dialog.getByPlaceholder(
      "Nouvelle localisation, date prévue…",
    ).fill(
      "Déménagement prévu à Ratoma le 30 septembre.",
    );

    await dialog.getByRole(
      "button",
      {
        name:
          "Envoyer",
        exact:
          true,
      },
    ).click();

    await expect(
      page.getByText(
        "Déménagement signalé : notre équipe vous contactera.",
        {
          exact:
            true,
        },
      ),
    ).toBeVisible();

    expect(
      django.movingBodies,
    ).toEqual([
      {
        description:
          "Déménagement prévu à Ratoma le 30 septembre.",
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
  "modifie le profil propriétaire via Django simulé",
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
      "/mon-compte/settings",
    );

    await expect(
      page.getByRole(
        "heading",
        {
          name:
            "Paramètres",
          exact:
            true,
        },
      ),
    ).toBeVisible();

    const fullName =
      page.getByLabel(
        "Nom complet",
      );

    const phone =
      page.getByLabel(
        "Téléphone",
      );

    await expect(
      fullName,
    ).toHaveValue(
      "Propriétaire R5A",
    );

    await expect(
      phone,
    ).toHaveValue(
      "+224 600 00 00 00",
    );

    await fullName.fill(
      "Propriétaire R5A Modifié",
    );

    await phone.fill(
      "+224 622 11 22 33",
    );

    await page.getByRole(
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
        "Profil mis à jour.",
        {
          exact:
            true,
        },
      ),
    ).toBeVisible();

    await expect(
      fullName,
    ).toHaveValue(
      "Propriétaire R5A Modifié",
    );

    await expect(
      phone,
    ).toHaveValue(
      "+224 622 11 22 33",
    );

    expect(
      django.profilePatchBodies,
    ).toEqual([
      {
        full_name:
          "Propriétaire R5A Modifié",

        phone:
          "+224 622 11 22 33",
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
  "désactive le compte puis nettoie la session Supabase locale",
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
      "/mon-compte/settings",
    );

    await page.getByRole(
      "button",
      {
        name:
          "Désactiver mon compte",
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
            "Désactiver votre compte ?",
          exact:
            true,
        },
      ),
    ).toBeVisible();

    const confirmation =
      dialog.getByLabel(
        "Confirmation",
      );

    const deactivateButton =
      dialog.getByRole(
        "button",
        {
          name:
            "Confirmer la désactivation",
          exact:
            true,
        },
      );

    await expect(
      deactivateButton,
    ).toBeDisabled();

    await confirmation.fill(
      "DESACTIVER",
    );

    await expect(
      deactivateButton,
    ).toBeEnabled();

    await deactivateButton.click();

    await expect(
      page,
    ).toHaveURL(
      `${appOrigin}/?account=deactivated`,
    );

    expect(
      django.deactivateBodies,
    ).toEqual([
      {
        confirm:
          "DESACTIVER",
      },
    ]);

    expect(
      django.mutationAuthHeaders,
    ).toEqual([
      `Bearer ${accessToken}`,
    ]);

    expect(
      supabase.logoutCalls,
    ).toBe(
      1,
    );
  },
);
