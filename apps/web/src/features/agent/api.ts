const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8000"
).replace(/\/$/, "");


export type AgentIdentity = {
  user_id: string;
  role: "agent";
  full_name: string | null;
  badge_number: string | null;
  zone_id: string | null;
  active: true;
};


export type AgentSessionTokens = {
  access_token: string;
  refresh_token: string;
  expires_in: number | null;
  token_type: string;
};


export type AgentLoginResponse = {
  authenticated: true;
  session: AgentSessionTokens;
};


export type AgentMeResponse = {
  authenticated: true;
  agent: AgentIdentity;
};


export type AgentTask = {
  pending_installation_id: string;
  status:
    | "assigned"
    | "planned";
  scheduled_at: string | null;
  created_at: string | null;
  can_start_installation: boolean;

  order: {
    id: string;
    reference: string;
    client_type: string | null;
    customer_name: string | null;
    customer_phone: string | null;
  };

  plan: {
    code: string;
    name: string;
    features:
      | Record<string, unknown>
      | unknown[];
    fulfillment_kind: string;
    installation_required: boolean;
  };

  installation_requirements: {
    version: 1;
    fulfillment_kind: "physical_installation";
    capabilities: string[];
    gps_measure_count: 3;
    gps_max_accuracy_m: 3.0;
    photo_required: boolean;
    consent_required: boolean;
    category_required: boolean;
    visibility_required: boolean;
    commercial_place_name_required: boolean;
    owner_name_required: boolean;
    owner_phone_required: boolean;
    access_point_note_required: boolean;
  };

  beacon: {
    id: string;
    public_number: string;
  };

  site: {
    id: string | null;
    place_type: string | null;
    place_name: string | null;
    commune_id: string | null;
    district_id: string | null;
    sector_id: string | null;
    address_line: string | null;
    access_point_note: string | null;
  };
};


export type AgentTasksResponse = {
  items: AgentTask[];
  count: number;
};


export type AgentHistoryItem = {
  installation_id: string;
  installed_at: string | null;
  validated_at: string | null;

  gps: {
    lat: number | null;
    lng: number | null;
    accuracy_m: number | null;
  };

  photo_url: string | null;

  beacon: {
    id: string;
    public_number: string;
  };

  address: {
    id: string | null;
    name: string | null;
    category: string | null;
    visibility: string | null;
    verification_level: string | null;
    access_point_note: string | null;
  };

  site: {
    id: string | null;
    place_name: string | null;
    address_line: string | null;
  };

  order: {
    id: string | null;
    reference: string | null;
  };
};

export type AgentHistoryResponse = {
  items: AgentHistoryItem[];
  count: number;
};

export class AgentApiError extends Error {
  statusCode: number;

  constructor(
    message: string,
    statusCode: number,
  ) {
    super(message);
    this.name = "AgentApiError";
    this.statusCode = statusCode;
  }
}


async function getErrorMessage(
  response: Response,
): Promise<string> {
  try {
    const payload = (
      await response.json()
    ) as {
      detail?: string;
      message?: string;
    };

    return (
      payload.detail ??
      payload.message ??
      "Une erreur est survenue."
    );
  } catch {
    return "Une erreur est survenue.";
  }
}


async function requestJson<T>(
  url: string,
  init: RequestInit,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(
      url,
      {
        ...init,
        cache: "no-store",
      },
    );
  } catch (error) {
    if (
      error instanceof DOMException &&
      error.name === "AbortError"
    ) {
      throw error;
    }

    throw new AgentApiError(
      "Impossible de joindre le service Adresse GN.",
      0,
    );
  }

  if (!response.ok) {
    throw new AgentApiError(
      await getErrorMessage(
        response,
      ),
      response.status,
    );
  }

  try {
    return (
      await response.json()
    ) as T;
  } catch {
    throw new AgentApiError(
      "Réponse Django invalide.",
      response.status,
    );
  }
}


export function loginAgentBadge(
  badgeNumber: string,
  password: string,
  signal?: AbortSignal,
) {
  return requestJson<AgentLoginResponse>(
    `${API_BASE_URL}/api/v1/agent/login/`,
    {
      method: "POST",
      signal,
      headers: {
        Accept:
          "application/json",
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        badge_number:
          badgeNumber.trim(),
        password,
      }),
    },
  );
}


async function authenticatedGet<T>(
  path: string,
  accessToken: string,
  signal?: AbortSignal,
) {
  return requestJson<T>(
    `${API_BASE_URL}${path}`,
    {
      method: "GET",
      signal,
      headers: {
        Accept:
          "application/json",
        Authorization:
          `Bearer ${accessToken}`,
      },
    },
  );
}


export function getAgentMe(
  accessToken: string,
  signal?: AbortSignal,
) {
  return authenticatedGet<AgentMeResponse>(
    "/api/v1/agent/me/",
    accessToken,
    signal,
  );
}


export function listAgentTasks(
  accessToken: string,
  signal?: AbortSignal,
) {
  return authenticatedGet<AgentTasksResponse>(
    "/api/v1/agent/tasks/",
    accessToken,
    signal,
  );
}
export function listAgentHistory(
  accessToken: string,
  signal?: AbortSignal,
) {
  return authenticatedGet<AgentHistoryResponse>(
    "/api/v1/agent/history/",
    accessToken,
    signal,
  );
}

export type AgentCompleteMeasure = {
  lat: number;
  lng: number;
  accuracy_m: number;
  taken_at: string;
};


export type AgentCompletePayload = {
  client_uuid: string;

  measures: [
    AgentCompleteMeasure,
    AgentCompleteMeasure,
    AgentCompleteMeasure,
  ];

  photo_base64: string;

  category: string;
  name: string;

  visibility: "private";

  access_point_note: string | null;

  owner_name: string | null;
  owner_phone: string | null;

  consent: true;
};


export type AgentCompleteResponse = {
  ok: true;

  status: "installed";

  idempotent: boolean;

  pending_installation_id: string;
  order_id: string;
  order_site_id: string;
  installation_id: string;
  beacon_id: string;
  public_number: string;
  address_id: string;
  owner_id: string;

  audit_id?: string;

  gps?: {
    measure_count: 3;
    lat: number;
    lng: number;
    accuracy_m: number;
  };
};


export function completeAgentTask(
  pendingInstallationId: string,
  accessToken: string,
  payload: AgentCompletePayload,
  signal?: AbortSignal,
) {
  return requestJson<AgentCompleteResponse>(
    `${API_BASE_URL}/api/v1/agent/tasks/${encodeURIComponent(
      pendingInstallationId,
    )}/complete/`,
    {
      method: "POST",
      signal,

      headers: {
        Accept:
          "application/json",

        "Content-Type":
          "application/json",

        Authorization:
          `Bearer ${accessToken}`,
      },

      body:
        JSON.stringify(
          payload,
        ),
    },
  );
}
