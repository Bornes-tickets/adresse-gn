export type SalesPaymentStatus =
  | "pending"
  | "success"
  | "failed"
  | "refunded";

export type SalesActionableState =
  | "pending_confirmation"
  | "db_pending_retry"
  | "storage_pending_retry"
  | "published";

export type SalesPaymentItem = {
  id: string;
  provider: string;
  status: SalesPaymentStatus | string;
  amount_gnf: number;
  external_ref: string | null;
  paid_at: string | null;
  payment_created_at: string;
  order_ref: string;
  offer_code: string;
  order_status: string;
  order_created_at: string;
  notes: string | null;
  client: string;
  client_phone: string | null;
  invoice_id: string | null;
  invoice_number: string | null;
  invoice_pdf_url: string | null;
  invoice_state: SalesActionableState | null;
};

export type SalesPaymentsResponse = {
  total: number;
  page: number;
  page_size: number;
  items: SalesPaymentItem[];
};

export type SalesInvoiceState =
  | "published"
  | "storage_pending_retry"
  | "db_pending_retry";

export type SalesInvoiceRecord = {
  id?: string;
  order_id?: string;
  order_ref?: string;
  customer_id?: string;
  number?: string;
  amount_gnf?: number;
  status?: string;
  paid_at?: string | null;
  issued_at?: string | null;
  pdf_url?: string | null;
  created?: boolean;
};

export type SalesInvoicePublication = {
  invoice_id?: string;
  number?: string;
  pdf_url?: string | null;
  storage_path?: string;
  published?: boolean;
  already_published?: boolean;
};

export type SalesConfirmResponse = {
  ok: true;
  payment_confirmed: true;
  order_id: string;
  confirmation: unknown;
  invoice_state: SalesInvoiceState;
  invoice: SalesInvoiceRecord | null;
  publication: SalesInvoicePublication | null;
  invoice_error: string | null;
};

export type SalesRejectResponse = {
  ok: true;
  payment_id: string;
  order_ref: string;
  notification_id: string | null;
  audit_id: string;
};
