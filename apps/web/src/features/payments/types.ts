export type PaymentItem = {
  qty?: number;
  ref?: string;
  code?: string;
  label?: string;
  unit_price_gnf?: number;
  fulfillment_kind?: string;
};

export type PaymentRecord = {
  id: string;
  provider: string;
  status: string;
  external_ref: string | null;
  amount_gnf: number;
  paid_at: string | null;
  created_at: string;
};

export type InvoiceRecord = {
  number: string;
  pdf_url: string | null;
  status: string;
  issued_at: string | null;
};

export type PaymentOrder = {
  id: string;
  order_ref: string;
  offer_code: string;
  amount_gnf: number;
  status: string;
  items: PaymentItem[];
  payment_method: string | null;
  devis_demande: boolean;
  created_at: string;
  payment: PaymentRecord | null;
  invoice: InvoiceRecord | null;
};

export type PaymentMethod = {
  code: string;
  label: string;
  enabled: boolean;
  description: string;
};

export type PaymentMethodsResponse = {
  items: PaymentMethod[];
};

export type ManualPaymentAction = {
  type: "manual";
  instructions: string;
  whatsapp_number: string | null;
};

export type ManualPaymentResponse = {
  payment: PaymentRecord;
  created: boolean;
  action: ManualPaymentAction;
};
