import "server-only";
import { prisma } from "@/lib/prisma";
import { BRAND_CONFIG } from "@/config/brand";
import { formatDA } from "@/lib/money";
import { formatPhoneDisplay } from "@/lib/phone";
import type { NotificationChannel } from "@prisma/client";

const PROVIDER_TIMEOUT_MS = 8_000;

/**
 * Notifications are provider-agnostic. Configure a provider through environment
 * variables; if none is configured the event is recorded and logged (console)
 * so order flows never break and admins can see what would have been sent.
 *
 *   EMAIL_PROVIDER=resend|console
 *   SMS_PROVIDER=twilio|console
 *   WHATSAPP_PROVIDER=meta|console
 */

export type NotificationMessage = {
  to: string;
  subject: string;
  body: string;
  html?: string;
  idempotencyKey?: string;
};

export interface NotificationProvider {
  readonly channel: NotificationChannel;
  readonly name: string;
  send(message: NotificationMessage): Promise<void>;
}

type OrderEmailData = {
  orderNumber: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  wilayaName?: string;
  communeName?: string;
  address?: string;
  deliveryMethod?: string;
  subtotal?: number;
  discount?: number;
  promotionDiscount?: number;
  shipping?: number;
  total: number;
  items?: Array<{
    productName: string;
    variantLabel: string | null;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
  }>;
  trackingUrl?: string;
  status?: string;
  trackingNote?: string;
};

async function consoleSend(channel: NotificationChannel) {
  console.info(`[notify:${channel.toLowerCase()}] console provider selected`);
}

function providerSignal(): AbortSignal {
  return AbortSignal.timeout(PROVIDER_TIMEOUT_MS);
}

const emailProvider: NotificationProvider = {
  channel: "EMAIL",
  name: process.env.EMAIL_PROVIDER ?? "console",
  async send(message) {
    const provider = process.env.EMAIL_PROVIDER;
    if (provider === "resend" && process.env.EMAIL_API_KEY) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.EMAIL_API_KEY}`,
          "Content-Type": "application/json",
          ...(message.idempotencyKey ? { "Idempotency-Key": message.idempotencyKey } : {}),
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM ?? `${BRAND_CONFIG.name} <no-reply@example.com>`,
          to: [message.to],
          subject: message.subject,
          text: message.body,
          ...(message.html ? { html: message.html } : {}),
        }),
        signal: providerSignal(),
      });
      if (!response.ok) {
        throw new Error(`Email provider failed with ${response.status}`);
      }
      return;
    }
    await consoleSend("EMAIL");
  },
};

const smsProvider: NotificationProvider = {
  channel: "SMS",
  name: process.env.SMS_PROVIDER ?? "console",
  async send(message) {
    const provider = process.env.SMS_PROVIDER;
    const sid = process.env.SMS_ACCOUNT_SID;
    const token = process.env.SMS_API_KEY;
    if (provider === "twilio" && sid && token && process.env.SMS_FROM) {
      const body = new URLSearchParams({
        To: message.to,
        From: process.env.SMS_FROM,
        Body: message.body,
      });
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
            ...(message.idempotencyKey ? { "X-Idempotency-Key": message.idempotencyKey } : {}),
          },
          body,
          signal: providerSignal(),
        },
      );
      if (!response.ok) throw new Error(`SMS provider failed with ${response.status}`);
      return;
    }
    await consoleSend("SMS");
  },
};

const whatsappProvider: NotificationProvider = {
  channel: "WHATSAPP",
  name: process.env.WHATSAPP_PROVIDER ?? "console",
  async send(message) {
    const provider = process.env.WHATSAPP_PROVIDER;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const token = process.env.WHATSAPP_API_KEY;
    if (provider === "meta" && phoneNumberId && token) {
      const response = await fetch(
        `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            ...(message.idempotencyKey ? { "X-Idempotency-Key": message.idempotencyKey } : {}),
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: message.to.replace(/^0/, "213"),
            ...(process.env.WHATSAPP_TEMPLATE_NAME
              ? {
                  type: "template",
                  template: {
                    name: process.env.WHATSAPP_TEMPLATE_NAME,
                    language: { code: process.env.WHATSAPP_TEMPLATE_LANGUAGE ?? "fr" },
                    components: [
                      {
                        type: "body",
                        parameters: [{ type: "text", text: message.body }],
                      },
                    ],
                  },
                }
              : { type: "text", text: { body: message.body } }),
          }),
          signal: providerSignal(),
        },
      );
      if (!response.ok) throw new Error(`WhatsApp provider failed with ${response.status}`);
      return;
    }
    await consoleSend("WHATSAPP");
  },
};

const providers = [emailProvider, smsProvider, whatsappProvider];

function templates(data: OrderEmailData) {
  const greeting = `Bonjour ${data.firstName},`;
  const signature = `\n\n${BRAND_CONFIG.name}\n${BRAND_CONFIG.supportEmail}`;
  const itemLines = (data.items ?? [])
    .map(
      (item) =>
        `- ${item.productName}${item.variantLabel ? ` (${item.variantLabel})` : ""} × ${item.quantity} : ${formatDA(item.lineTotal)}`,
    )
    .join("\n");
  const orderDetails = [
    `Commande : ${data.orderNumber}`,
    "",
    "Articles :",
    itemLines || "- Aucun article",
    "",
    `Sous-total : ${formatDA(data.subtotal ?? data.total)}`,
    ...(data.promotionDiscount && data.promotionDiscount > 0
      ? [`Promotion : −${formatDA(data.promotionDiscount)}`]
      : []),
    ...(data.discount && data.discount > 0 ? [`Réduction : −${formatDA(data.discount)}`] : []),
    `Livraison (${data.deliveryMethod ?? "à domicile"}) : ${formatDA(data.shipping ?? 0)}`,
    `Total à payer à la livraison : ${formatDA(data.total)}`,
    "",
    "Livraison :",
    `${data.firstName} ${data.lastName ?? ""}`.trim(),
    data.phone ? formatPhoneDisplay(data.phone) : "",
    [data.address, data.communeName, data.wilayaName].filter(Boolean).join(", "),
  ].join("\n");
  const escapeHtml = (value: string): string =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const htmlItems = (data.items ?? [])
    .map(
      (item) => `<tr>
        <td style="padding:14px 0;border-bottom:1px solid #e8e1d8;color:#3e3934;font-size:14px;line-height:1.45"><strong>${escapeHtml(item.productName)}</strong>${item.variantLabel ? `<br><span style="color:#81786f;font-size:12px">${escapeHtml(item.variantLabel)}</span>` : ""}</td>
        <td style="padding:14px 0;border-bottom:1px solid #e8e1d8;color:#81786f;text-align:center;font-size:14px">× ${item.quantity}</td>
        <td style="padding:14px 0;border-bottom:1px solid #e8e1d8;color:#3e3934;text-align:right;font-size:14px;white-space:nowrap">${escapeHtml(formatDA(item.lineTotal))}</td>
      </tr>`,
    )
    .join("");
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#f5f1eb;color:#3e3934;font-family:Arial,Helvetica,sans-serif"><div style="max-width:620px;margin:0 auto;padding:28px 18px"><div style="background:#fff;padding:36px 28px"><div style="border-bottom:1px solid #e8e1d8;padding-bottom:24px"><span style="font-family:Georgia,serif;font-size:27px;letter-spacing:.08em;color:#b08d57">${escapeHtml(BRAND_CONFIG.name)}</span><span style="float:right;color:#81786f;font-size:12px;letter-spacing:.12em;text-transform:uppercase;padding-top:8px">Commande #${escapeHtml(data.orderNumber)}</span></div><h1 style="margin:34px 0 10px;font-family:Georgia,serif;font-size:31px;line-height:1.15;font-weight:500;color:#3e3934">Merci pour votre commande !</h1><p style="margin:0;color:#81786f;font-size:16px;line-height:1.65">Bonjour ${escapeHtml(data.firstName)},<br>Nous préparons votre commande avec soin. Nous vous contacterons pour confirmer avant l'expédition.</p>${data.trackingUrl ? `<p style="margin:26px 0 34px"><a href="${escapeHtml(data.trackingUrl)}" style="display:inline-block;background:#b08d57;color:#fff;text-decoration:none;padding:15px 24px;font-size:14px;font-weight:bold">Afficher votre commande</a></p>` : ""}<h2 style="margin:0 0 16px;font-size:18px;color:#3e3934">Résumé de la commande</h2><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tbody>${htmlItems}</tbody></table><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:16px;font-size:14px"><tbody><tr><td style="padding:5px 0;color:#81786f">Sous-total</td><td style="padding:5px 0;text-align:right">${escapeHtml(formatDA(data.subtotal ?? data.total))}</td></tr>${data.promotionDiscount && data.promotionDiscount > 0 ? `<tr><td style="padding:5px 0;color:#81786f">Promotion</td><td style="padding:5px 0;text-align:right">−${escapeHtml(formatDA(data.promotionDiscount))}</td></tr>` : ""}${data.discount && data.discount > 0 ? `<tr><td style="padding:5px 0;color:#81786f">Réduction</td><td style="padding:5px 0;text-align:right">−${escapeHtml(formatDA(data.discount))}</td></tr>` : ""}<tr><td style="padding:5px 0;color:#81786f">Expédition</td><td style="padding:5px 0;text-align:right">${escapeHtml(formatDA(data.shipping ?? 0))}</td></tr><tr><td style="border-top:1px solid #3e3934;padding:18px 0 5px;font-size:17px;font-weight:bold">Total</td><td style="border-top:1px solid #3e3934;padding:18px 0 5px;text-align:right;font-size:19px;font-weight:bold">${escapeHtml(formatDA(data.total))}</td></tr><tr><td style="padding:5px 0;color:#81786f">Montant payé aujourd'hui</td><td style="padding:5px 0;text-align:right;color:#81786f">0 DA</td></tr></tbody></table><h2 style="margin:38px 0 16px;font-size:18px;color:#3e3934">Informations client</h2><div style="color:#81786f;font-size:14px;line-height:1.7"><strong style="color:#3e3934">Adresse d'expédition</strong><br>${escapeHtml(`${data.firstName} ${data.lastName ?? ""}`.trim())}<br>${escapeHtml(data.address ?? "")}<br>${escapeHtml(`${data.communeName ?? ""}, ${data.wilayaName ?? ""}`)}<br>Algérie<p style="margin:22px 0 0"><strong style="color:#3e3934">Paiement</strong><br>Paiement à la livraison</p><p style="margin:22px 0 0"><strong style="color:#3e3934">Mode d'expédition</strong><br>${escapeHtml(data.deliveryMethod ?? "Livraison à domicile")}</p></div><div style="border-top:1px solid #e8e1d8;margin-top:34px;padding-top:22px;color:#81786f;font-size:13px;line-height:1.6">Si vous avez des questions, répondez à cet e-mail${BRAND_CONFIG.supportEmail ? ` ou contactez-nous à l'adresse <a href="mailto:${escapeHtml(BRAND_CONFIG.supportEmail)}" style="color:#b08d57">${escapeHtml(BRAND_CONFIG.supportEmail)}</a>` : ""}.<br><br>${escapeHtml(BRAND_CONFIG.name)}</div></div></div></body></html>`;
  return {
    received: {
      subject: `Commande ${data.orderNumber} reçue — ${BRAND_CONFIG.name}`,
      body: `${greeting}\n\nNous avons bien reçu votre commande.\n\n${orderDetails}\n\nNous vous contacterons pour confirmer avant l'expédition.${signature}`,
      html,
    },
    status: {
      subject: `Mise à jour de votre commande ${data.orderNumber}`,
      body: `${greeting}\n\nVotre commande ${data.orderNumber} est maintenant : ${
        data.status ?? ""
      }.${data.trackingNote ? `\n${data.trackingNote}` : ""}${signature}`,
    },
  };
}

type DispatchOptions = {
  orderId: string;
  phone: string;
  email?: string | null;
  template: string;
  subject: string;
  body: string;
  html?: string;
  channels?: NotificationChannel[];
  idempotencyKey?: string;
};

export type NotificationDispatchResult = {
  sent: NotificationChannel[];
  failed: NotificationChannel[];
};

async function dispatch(options: DispatchOptions): Promise<NotificationDispatchResult> {
  const enabled: NotificationChannel[] = options.channels ?? ["EMAIL"];
  const result: NotificationDispatchResult = { sent: [], failed: [] };
  for (const provider of providers) {
    if (!enabled.includes(provider.channel)) continue;
    const recipient =
      provider.channel === "EMAIL" ? (options.email ?? "") : options.phone.replace(/^0/, "+213");
    if (!recipient) continue;

    const alreadySent = await prisma.notification.findFirst({
      where: {
        orderId: options.orderId,
        channel: provider.channel,
        template: options.template,
        status: "SENT",
      },
      select: { id: true },
    });
    if (alreadySent) {
      result.sent.push(provider.channel);
      continue;
    }

    try {
      await provider.send({
        to: recipient,
        subject: options.subject,
        body: options.body,
        html: options.html,
        idempotencyKey: options.idempotencyKey
          ? `${options.idempotencyKey}:${provider.channel.toLowerCase()}`
          : undefined,
      });
      await prisma.notification.create({
        data: {
          orderId: options.orderId,
          channel: provider.channel,
          template: options.template,
          recipient,
          status: "SENT",
          provider: provider.name,
          sentAt: new Date(),
        },
      });
      result.sent.push(provider.channel);
    } catch (error) {
      result.failed.push(provider.channel);
      // Notification failures must never roll back an order.
      await prisma.notification
        .create({
          data: {
            orderId: options.orderId,
            channel: provider.channel,
            template: options.template,
            recipient,
            status: "FAILED",
            provider: provider.name,
            error: error instanceof Error ? error.message.slice(0, 500) : "unknown error",
          },
        })
        .catch(() => undefined);
      console.error(
        "[notify] delivery failed",
        options.template,
        provider.channel,
        error instanceof Error ? error.name : "unknown",
      );
    }
  }
  return result;
}

export async function sendOrderReceived(data: {
  orderId: string;
  phone: string;
  email?: string | null;
  orderNumber: string;
  firstName: string;
  lastName: string;
  wilayaName: string;
  communeName: string;
  address: string;
  deliveryMethod: string;
  subtotal: number;
  discount: number;
  promotionDiscount: number;
  shipping: number;
  total: number;
  items: NonNullable<OrderEmailData["items"]>;
  trackingUrl?: string;
  idempotencyKey?: string;
}): Promise<NotificationDispatchResult> {
  const tpl = templates(data);
  return dispatch({
    orderId: data.orderId,
    phone: data.phone,
    email: data.email,
    template: "ORDER_RECEIVED",
    subject: tpl.received.subject,
    body: tpl.received.body,
    html: tpl.received.html,
    channels: ["EMAIL", "WHATSAPP"],
    idempotencyKey: data.idempotencyKey,
  });
}

export async function sendOrderStatusUpdate(data: {
  orderId: string;
  phone: string;
  email?: string | null;
  orderNumber: string;
  firstName: string;
  total: number;
  status: string;
  note?: string;
  idempotencyKey?: string;
}): Promise<void> {
  const tpl = templates({
    orderNumber: data.orderNumber,
    firstName: data.firstName,
    total: data.total,
    status: data.status,
  });
  await dispatch({
    orderId: data.orderId,
    phone: data.phone,
    email: data.email,
    template: "ORDER_STATUS_UPDATE",
    subject: tpl.status.subject,
    body: tpl.status.body,
    channels: ["EMAIL", "SMS", "WHATSAPP"],
    idempotencyKey: data.idempotencyKey,
  });
}

export async function sendShippingNotification(data: {
  orderId: string;
  phone: string;
  email?: string | null;
  orderNumber: string;
  firstName: string;
  total: number;
  idempotencyKey?: string;
}): Promise<void> {
  const greeting = `Bonjour ${data.firstName},`;
  await dispatch({
    orderId: data.orderId,
    phone: data.phone,
    email: data.email,
    template: "ORDER_SHIPPED",
    subject: `Votre commande ${data.orderNumber} est en route`,
    body: `${greeting}\n\nBonne nouvelle : votre commande ${data.orderNumber} vient d'être expédiée. Vous serez contacté(e) par téléphone au ${formatPhoneDisplay(
      data.phone,
    )} avant la livraison.`,
    channels: ["EMAIL", "SMS", "WHATSAPP"],
    idempotencyKey: data.idempotencyKey,
  });
}
