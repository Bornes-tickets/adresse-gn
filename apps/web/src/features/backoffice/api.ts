const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8000"
).replace(/\/$/, "");


export type BackofficeIdentity = {
  user_id: string;
  role:
    | "support"
    | "sales"
    | "ops"
    | "supervisor"
    | "admin"
    | "super_admin";
  full_name: string | null;
};


export type BackofficeMeResponse = {
  authenticated: true;
  user: BackofficeIdentity;
};


export type ClaimStatus =
  | "pending"
  | "approved"
  | "rejected";


export type BackofficeClaim = {
  id: string;
  status: ClaimStatus;
  evidence: string | null;
  reason: string | null;
  proof_url: string | null;
  decision_note: string | null;
  created_at: string;
  decided_at: string | null;
  decided_by: string | null;
  beacon_id: string;
  beacon_number: string;
  requester_id: string;
  requester_name: string | null;
  requester_phone: string | null;
  requester_email: string | null;
  unclaimed_owner: {
    id: string;
    name: string | null;
    phone: string | null;
  } | null;
};


export type BackofficeClaimsResponse = {
  items: BackofficeClaim[];
  counts: Record<ClaimStatus, number>;
};


export class BackofficeApiError extends Error {
  statusCode: number;

  constructor(
    message: string,
    statusCode: number,
  ) {
    super(message);
    this.name = "BackofficeApiError";
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
      message?: string;
      detail?: string;
    };

    return (
      payload.message ??
      payload.detail ??
      "Une erreur est survenue."
    );
  } catch {
    return "Une erreur est survenue.";
  }
}


async function authenticatedFetch<T>(
  url: string,
  accessToken: string,
  init?: RequestInit,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(
      url,
      {
        ...init,

        headers: {
          Accept: "application/json",
          Authorization:
            `Bearer ${accessToken}`,
          ...(init?.headers ?? {}),
        },

        cache: "no-store",
      },
    );
  } catch {
    throw new BackofficeApiError(
      "Impossible de joindre le service Adresse GN.",
      0,
    );
  }

  if (!response.ok) {
    throw new BackofficeApiError(
      await getErrorMessage(response),
      response.status,
    );
  }

  try {
    return (
      await response.json()
    ) as T;
  } catch {
    throw new BackofficeApiError(
      "Réponse Django invalide.",
      response.status,
    );
  }
}


export function getBackofficeMe(
  accessToken: string,
  signal?: AbortSignal,
) {
  return authenticatedFetch<BackofficeMeResponse>(
    `${API_BASE_URL}/api/v1/backoffice/me/`,
    accessToken,
    {
      method: "GET",
      signal,
    },
  );
}


export function listBackofficeClaims(
  accessToken: string,
  statusFilter: ClaimStatus | null,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams();

  if (statusFilter) {
    params.set(
      "status",
      statusFilter,
    );
  }

  const query =
    params.size > 0
      ? `?${params.toString()}`
      : "";

  return authenticatedFetch<BackofficeClaimsResponse>(
    `${API_BASE_URL}/api/v1/backoffice/claims/${query}`,
    accessToken,
    {
      method: "GET",
      signal,
    },
  );
}


export function decideBackofficeClaim(
  accessToken: string,
  claimId: string,
  input: {
    decision:
      | "approved"
      | "rejected";
    note: string | null;
  },
) {
  return authenticatedFetch<{
    ok: true;
    status: "decided";
    claim_id: string;
    decision:
      | "approved"
      | "rejected";
    message: string;
  }>(
    `${API_BASE_URL}/api/v1/backoffice/claims/${encodeURIComponent(claimId)}/decision/`,
    accessToken,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify(input),
    },
  );
}

export type BackofficeAccountStatus =
  | "active"
  | "deactivated";

export type BackofficeAccount = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: "user";
  account_status: BackofficeAccountStatus;
  deactivated_at: string | null;
  email_masked: string | null;
};

export type BackofficeAccountsResponse = {
  items: BackofficeAccount[];
  counts: Record<BackofficeAccountStatus, number>;
  status_filter:
    | BackofficeAccountStatus
    | "all";
  query: string | null;
};

export type VerificationMethod =
  | "email"
  | "phone"
  | "document"
  | "in_person"
  | "other";

export function listBackofficeAccounts(
  accessToken: string,
  statusFilter:
    | BackofficeAccountStatus
    | "all",
  query: string,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams();

  params.set("status", statusFilter);

  if (query.trim()) {
    params.set("q", query.trim());
  }

  return authenticatedFetch<BackofficeAccountsResponse>(
    `${API_BASE_URL}/api/v1/backoffice/accounts/?${params.toString()}`,
    accessToken,
    {
      method: "GET",
      signal,
    },
  );
}

export function reactivateBackofficeAccount(
  accessToken: string,
  userId: string,
  input: {
    confirm: "REACTIVER";
    verification_method: VerificationMethod;
    verification_note: string;
  },
) {
  return authenticatedFetch<{
    ok: true;
    status: "reactivated";
    user_id: string;
    account_status: "active";
    deactivated_at: null;
    audit_id: string;
    verification_method: VerificationMethod;
    message: string;
  }>(
    `${API_BASE_URL}/api/v1/backoffice/accounts/${encodeURIComponent(userId)}/reactivate/`,
    accessToken,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );
}


export type AdminDashboardResponse = {
  balisesActives: number;
  balisesGenerees: number;
  installations7j: number;
  adressesPubliques: number;
  adressesPrivees: number;
  signalementsOuverts: number;
  agentsActifs: number;

  installationsParJour: Array<{
    jour: string;
    total: number;
  }>;

  parCategorie: Array<{
    categorie: string;
    total: number;
  }>;

  points: Array<{
    lat: number;
    lng: number;
    visibility: string;
    number: string | null;
  }>;

  tendances: {
    installations: {
      actuel: number;
      precedent: number;
    };
    adresses: {
      actuel: number;
      precedent: number;
    };
    commandes: {
      actuel: number;
      precedent: number;
    };
  };

  statutsBalises: Array<{
    statut: string;
    total: number;
  }>;

  topZones: Array<{
    nom: string;
    total: number;
  }>;

  activite: {
    installations: Array<{
      id: string;
      numero: string | null;
      date: string | null;
    }>;

    commandes: Array<{
      id: string;
      ref: string;
      montant: number;
      statut: string;
      date: string | null;
    }>;

    signalements: Array<{
      id: string;
      raison: string;
      statut: string;
      date: string | null;
    }>;
  };

  objectifs: Array<{
    cle: string;
    valeur: number;
    cible: number;
  }>;
};


export function getAdminDashboard(
  accessToken: string,
  signal?: AbortSignal,
) {
  return authenticatedFetch<AdminDashboardResponse>(
    `${API_BASE_URL}/api/v1/backoffice/dashboard/`,
    accessToken,
    {
      method: "GET",
      signal,
    },
  );
}

export type BackofficeBeaconStatus =
  | "generated"
  | "assigned"
  | "active"
  | "suspended"
  | "cancelled"
  | "replaced";


export type BackofficeBeaconListItem = {
  id: string;
  public_number: string;
  status: string;
  created_at: string | null;
  activated_at: string | null;
  lot_id: string | null;
  lot_code: string | null;
  category: string | null;
  assigned_agent_id: string | null;
  national_id: string | null;
  check_digit: string | null;
  commune_code_at_issue: string | null;
  numbering_version: string;
};


export type BackofficeBeaconListResponse = {
  items: BackofficeBeaconListItem[];
  total: number;
  page: number;
  page_size: number;
};


export type BackofficeBeaconDetailResponse = {
  beacon: {
    id: string;
    public_number: string;
    qr_token: string;
    status: string;
    lot_id: string | null;
    created_at: string | null;
    activated_at: string | null;
    assigned_agent_id: string | null;
    category: string | null;
    national_id: string | null;
    check_digit: string | null;
    commune_code_at_issue: string | null;
    numbering_version: string;

    lot: {
      id: string;
      code: string | null;
      supplier: string | null;
      status: string | null;
      category: string | null;
    } | null;
  };

  address: {
    id: string;
    name: string | null;
    category: string | null;
    visibility: string | null;
    verification_level: string | null;
    status: string | null;

    point: {
      lat: number;
      lng: number;
    } | null;
  } | null;

  installation: {
    id: string;
    gps_lat: number;
    gps_lng: number;
    accuracy_m: number | null;
    installed_at: string | null;
    validated_at: string | null;
    agent_id: string | null;
    uninstalled_at: string | null;
  } | null;
};


export function listBackofficeBeacons(
  accessToken: string,
  input: {
    page?: number;
    pageSize?: number;
    status?: string | null;
    lotId?: string | null;
    from?: string | null;
    to?: string | null;
    query?: string | null;
  },
  signal?: AbortSignal,
) {
  const params =
    new URLSearchParams();

  params.set(
    "page",
    String(input.page ?? 1),
  );

  params.set(
    "page_size",
    String(input.pageSize ?? 20),
  );

  if (input.status) {
    params.set(
      "statuses",
      input.status,
    );
  }

  if (input.lotId) {
    params.set(
      "lot_id",
      input.lotId,
    );
  }

  if (input.from) {
    params.set(
      "from",
      input.from,
    );
  }

  if (input.to) {
    params.set(
      "to",
      input.to,
    );
  }

  if (input.query?.trim()) {
    params.set(
      "q",
      input.query.trim(),
    );
  }

  return authenticatedFetch<BackofficeBeaconListResponse>(
    `${API_BASE_URL}/api/v1/backoffice/beacons/?${params.toString()}`,
    accessToken,
    {
      method: "GET",
      signal,
    },
  );
}


export function getBackofficeBeacon(
  accessToken: string,
  beaconId: string,
  signal?: AbortSignal,
) {
  return authenticatedFetch<BackofficeBeaconDetailResponse>(
    `${API_BASE_URL}/api/v1/backoffice/beacons/${encodeURIComponent(beaconId)}/`,
    accessToken,
    {
      method: "GET",
      signal,
    },
  );
}

export type BackofficeAddressListItem = {
  id: string;
  name: string | null;
  category: string;
  visibility: string;
  verification_level: string;
  status: string;
  created_at: string | null;
  updated_at: string | null;

  owner_id: string | null;

  beacon_id: string | null;
  beacon_number: string | null;
  beacon_status: string | null;
  beacon_numbering_version: string | null;

  commune_id: string | null;
  commune_name: string | null;

  district_id: string | null;
  district_name: string | null;

  sector_id: string | null;
  sector_name: string | null;
};


export type BackofficeAddressListResponse = {
  items: BackofficeAddressListItem[];
  total: number;
  page: number;
  page_size: number;
};


export type BackofficeAddressDetailResponse = {
  address: {
    id: string;
    name: string | null;
    category: string;
    visibility: string;
    verification_level: string;
    status: string;
    accuracy_m: number | null;
    access_point_note: string | null;
    created_at: string | null;
    updated_at: string | null;

    point: {
      lat: number;
      lng: number;
    } | null;
  };

  beacon: {
    id: string;
    public_number: string | null;
    status: string | null;
    category: string | null;
    numbering_version: string | null;
    national_id: string | null;
    check_digit: string | null;
    commune_code_at_issue: string | null;
  } | null;

  owner: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    role: string | null;
    account_status: string | null;
  } | null;

  territory: {
    commune: {
      id: string;
      name: string | null;
      code: string | null;
      stat_code: string | null;
      administrative_type: string | null;
    } | null;

    district: {
      id: string;
      name: string | null;
      kind: string | null;
      code: string | null;
    } | null;

    sector: {
      id: string;
      name: string | null;
      code: string | null;
    } | null;
  };

  journal: Array<{
    id: string;
    action: string;
    actor_id: string | null;
    created_at: string | null;
    before: unknown;
    after: unknown;
  }>;

  establishment: {
    id: string;
    business_name: string;
    phone: string | null;
    opening_hours: unknown;
    description: string | null;
    cover_url: string | null;
  } | null;
};


export function listBackofficeAddresses(
  accessToken: string,
  input: {
    page?: number;
    pageSize?: number;
    visibility?: string | null;
    category?: string | null;
    verification?: string | null;
    communeId?: string | null;
    districtId?: string | null;
    sectorId?: string | null;
    status?: string | null;
    from?: string | null;
    to?: string | null;
    query?: string | null;
  },
  signal?: AbortSignal,
) {
  const params = new URLSearchParams();

  params.set(
    "page",
    String(input.page ?? 1),
  );

  params.set(
    "page_size",
    String(input.pageSize ?? 20),
  );

  if (input.visibility) {
    params.set(
      "visibility",
      input.visibility,
    );
  }

  if (input.category) {
    params.set(
      "category",
      input.category,
    );
  }

  if (input.verification) {
    params.set(
      "verification",
      input.verification,
    );
  }

  if (input.communeId) {
    params.set(
      "commune_id",
      input.communeId,
    );
  }

  if (input.districtId) {
    params.set(
      "district_id",
      input.districtId,
    );
  }

  if (input.sectorId) {
    params.set(
      "sector_id",
      input.sectorId,
    );
  }

  if (input.status) {
    params.set(
      "status",
      input.status,
    );
  }

  if (input.from) {
    params.set(
      "from",
      input.from,
    );
  }

  if (input.to) {
    params.set(
      "to",
      input.to,
    );
  }

  if (input.query?.trim()) {
    params.set(
      "q",
      input.query.trim(),
    );
  }

  return authenticatedFetch<BackofficeAddressListResponse>(
    `${API_BASE_URL}/api/v1/backoffice/addresses/?${params.toString()}`,
    accessToken,
    {
      method: "GET",
      signal,
    },
  );
}


export function getBackofficeAddress(
  accessToken: string,
  addressId: string,
  signal?: AbortSignal,
) {
  return authenticatedFetch<BackofficeAddressDetailResponse>(
    `${API_BASE_URL}/api/v1/backoffice/addresses/${encodeURIComponent(addressId)}/`,
    accessToken,
    {
      method: "GET",
      signal,
    },
  );
}

export type BackofficeSpace =
  | "supervisor"
  | "ops"
  | "sales"
  | "support";


export type BackofficeNavigationResponse = {
  space: BackofficeSpace;
  home: string;

  user: BackofficeIdentity;

  items: Array<{
    href: string;
    label: string;
  }>;
};


export type BackofficeRoleMetric = {
  key: string;
  label: string;
  value: number;
  format:
    | "number"
    | "gnf";
};


export type BackofficeRoleActivityItem = {
  id: string;
  primary: string;
  secondary: string | null;
  status: string | null;
  date: string | null;
  amount_gnf?: number;
};


export type BackofficeRoleDashboardResponse = {
  space: BackofficeSpace;
  title: string;
  subtitle: string;

  metrics: BackofficeRoleMetric[];

  activity:
    BackofficeRoleActivityItem[];
};


export function getBackofficeNavigation(
  accessToken: string,
  space: BackofficeSpace,
  signal?: AbortSignal,
) {
  const params =
    new URLSearchParams({
      space,
    });

  return authenticatedFetch<BackofficeNavigationResponse>(
    `${API_BASE_URL}/api/v1/backoffice/navigation/?${params.toString()}`,
    accessToken,
    {
      method: "GET",
      signal,
    },
  );
}


export function getBackofficeRoleDashboard(
  accessToken: string,
  space: BackofficeSpace,
  signal?: AbortSignal,
) {
  const params =
    new URLSearchParams({
      space,
    });

  return authenticatedFetch<BackofficeRoleDashboardResponse>(
    `${API_BASE_URL}/api/v1/backoffice/role-dashboard/?${params.toString()}`,
    accessToken,
    {
      method: "GET",
      signal,
    },
  );
}

export type BackofficeResourceColumn = {
  key: string;
  label: string;
};


export type BackofficeResourceResponse = {
  resource: string;
  columns:
    BackofficeResourceColumn[];
  items:
    Array<Record<string, unknown>>;
  total: number;
  page: number;
  page_size: number;
};


export function listBackofficeResource(
  accessToken: string,
  resource: string,
  input: {
    page?: number;
    pageSize?: number;
    query?: string;
  },
  signal?: AbortSignal,
) {
  const params =
    new URLSearchParams();

  params.set(
    "page",
    String(
      input.page ?? 1,
    ),
  );

  params.set(
    "page_size",
    String(
      input.pageSize ?? 25,
    ),
  );

  if(input.query?.trim()){
    params.set(
      "q",
      input.query.trim(),
    );
  }

  return authenticatedFetch<BackofficeResourceResponse>(
    `${API_BASE_URL}/api/v1/backoffice/resources/${encodeURIComponent(resource)}/?${params.toString()}`,
    accessToken,
    {
      method: "GET",
      signal,
    },
  );
}
export type BackofficeActionField = {
  name: string;
  label: string;
  kind:
    | "text"
    | "textarea"
    | "json"
    | "number"
    | "date"
    | "datetime-local"
    | "select"
    | "boolean"
    | "password"
    | "file"
    | "hidden";
  required: boolean;
  options?: Array<{
    value: string;
    label: string;
  }>;
  default_from?: string;
  help?: string;
};


export type BackofficeActionDefinition = {
  key: string;
  label: string;
  scope:
    | "row"
    | "global";
  variant:
    | "default"
    | "danger";
  fields: BackofficeActionField[];
  confirm?: string;
  when?: Record<string, string[]>;
};


export type BackofficeActionCatalogResponse = {
  resource: string;
  role: string;
  actions: BackofficeActionDefinition[];
};


export function getBackofficeActionCatalog(
  accessToken: string,
  resource: string,
  signal?: AbortSignal,
) {
  return authenticatedFetch<BackofficeActionCatalogResponse>(
    `${API_BASE_URL}/api/v1/backoffice/actions/${encodeURIComponent(resource)}/`,
    accessToken,
    {
      method: "GET",
      signal,
    },
  );
}


export function executeBackofficeAction(
  accessToken: string,
  resource: string,
  action: string,
  input: {
    rowId?: string | null;
    data?: Record<string, unknown>;
  },
  signal?: AbortSignal,
) {
  return authenticatedFetch<Record<string, unknown>>(
    `${API_BASE_URL}/api/v1/backoffice/actions/${encodeURIComponent(resource)}/${encodeURIComponent(action)}/`,
    accessToken,
    {
      method: "POST",
      signal,
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        row_id:
          input.rowId ?? null,
        data:
          input.data ?? {},
      }),
    },
  );
}
export function executeBackofficeFileAction(
  accessToken: string,
  resource: string,
  action: string,
  input: {
    rowId?: string | null;
    data?: Record<string, unknown>;
  },
  signal?: AbortSignal,
) {
  const form =
    new FormData();

  if(input.rowId){
    form.append(
      "row_id",
      input.rowId,
    );
  }

  for(
    const [
      key,
      value,
    ] of Object.entries(
      input.data ?? {},
    )
  ){
    if(
      value === null
      || value === undefined
    ){
      continue;
    }

    if(value instanceof File){
      form.append(
        key,
        value,
      );
      continue;
    }

    form.append(
      key,
      typeof value === "boolean"
        ? (
            value
              ? "true"
              : "false"
          )
        : String(value),
    );
  }

  return fetch(
    `${API_BASE_URL}/api/v1/backoffice/actions/${encodeURIComponent(resource)}/${encodeURIComponent(action)}/`,
    {
      method: "POST",
      headers: {
        Authorization:
          `Bearer ${accessToken}`,
      },
      body: form,
      signal,
    },
  ).then(
    async (response) => {
      const payload =
        await response.json()
          .catch(
            () => ({}),
          ) as Record<string, unknown>;

      if(!response.ok){
        throw new Error(
          String(
            payload.message
            ?? payload.detail
            ?? "L’action n’a pas pu être exécutée.",
          ),
        );
      }

      return payload;
    },
  );
}
