export type Channel = "EMAIL" | "WHATSAPP";

export type TemplateKey =
  | "order_completed"
  | "topup_success"
  | "order_created"
  | "order_paid"
  | "order_refunded"
  | "order_warranty"
  | "membership_active"
  | "email_verify"
  | "account_created"
  | "password_reset"
  | "admin_new_order";

export interface SendNotificationInput {
  to: string; // raw email or phone; normalized internally for WA
  channel: Channel;
  template: TemplateKey;
  data: Record<string, unknown>;
  userId?: string | null;
  orderId?: string | null;
  /** plaintext secrets present in data, so they can be redacted in the stored body */
  secrets?: string[];
}

export interface DispatchResult {
  ok: boolean;
  provider: string | null; // "resend" | "smtp" | "fonnte" | null
  providerRef?: string | null;
  error?: string;
}

export interface EmailProvider {
  name: string;
  send(args: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<DispatchResult>;
}

export interface WhatsAppProvider {
  name: string;
  send(args: { to: string; message: string }): Promise<DispatchResult>;
}
