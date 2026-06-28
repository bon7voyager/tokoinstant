import type { EmailProvider, DispatchResult } from "../types";

/**
 * SMTP via Nodemailer. Nodemailer is an OPTIONAL dependency — it is imported
 * dynamically (computed specifier) so the project builds/runs without it.
 * Install it only if you actually use SMTP: `npm i nodemailer`.
 */
export class SmtpProvider implements EmailProvider {
  name = "smtp";

  async send(args: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<DispatchResult> {
    const from = process.env.RESEND_FROM ?? process.env.EMAIL_FROM;
    if (!from) return { ok: false, provider: "smtp", error: "missing EMAIL_FROM" };

    try {
      const moduleName = "nodemailer";
      const mod = (await import(/* webpackIgnore: true */ moduleName)) as {
        default: {
          createTransport: (opts: unknown) => {
            sendMail: (m: unknown) => Promise<{ messageId: string }>;
          };
        };
      };
      const transport = mod.default.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_SECURE === "true",
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      const info = await transport.sendMail({
        from,
        to: args.to,
        subject: args.subject,
        html: args.html,
        text: args.text,
      });
      return { ok: true, provider: "smtp", providerRef: info.messageId };
    } catch (e) {
      return {
        ok: false,
        provider: "smtp",
        error:
          e instanceof Error
            ? e.message.includes("Cannot find module")
              ? "nodemailer not installed (run: npm i nodemailer)"
              : e.message
            : "smtp_failed",
      };
    }
  }
}
