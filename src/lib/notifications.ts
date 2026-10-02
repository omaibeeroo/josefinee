import "server-only";
import { prisma } from "@/lib/prisma";
import { BRAND_CONFIG } from "@/config/brand";
import { formatDA } from "@/lib/money";
import { formatPhoneDisplay } from "@/lib/phone";
import type { NotificationChannel } from "@prisma/client";

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
};

export interface NotificationProvider {
  readonly channel: NotificationChannel;
  readonly name: string;
  send(message: NotificationMessage): Promise<void>;
}

type OrderEmailData = {
  orderNumber: string;
  firstName: string;
  total: number;
  status?: string;
  trackingNote?: string;
};

async function consoleSend(channel: NotificationChannel, message: NotificationMessage) {
  console.info(`[notify:${channel.toLowerCase()}] -> ${message.to} :: ${message.subject}`);
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
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM ?? `${BRAND_CONFIG.name} <no-reply@example.com>`,
          to: [message.to],
          subject: message.subject,
          text: message.body,
        }),
      });
      if (!response.ok) {
        throw new Error(`Email provider failed with ${response.status}`);
      }
      return;
    }
    await consoleSend("EMAIL", message);
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
          },
          body,
        },
      );
      if (!response.ok) throw new Error(`SMS provider failed with ${response.status}`);
      return;
    }
    await consoleSend("SMS", message);
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
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: message.to.replace(/^0/, "213"),
            type: "text",
            text: { body: message.body },
          }),
        },
      );
      if (!response.ok) throw new Error(`WhatsApp provider failed with ${response.status}`);
      return;
    }
    await consoleSend("WHATSAPP", message);
  },
};

const providers = [emailProvider, smsProvider, whatsappProvider];

function templates(data: OrderEmailData) {
  const greeting = `Bonjour ${data.firstName},`;
  const signature = `\n\n${BRAND_CONFIG.name}\n${BRAND_CONFIG.supportEmail}`;
  return {
    received: {
      subject: `Commande ${data.orderNumber} reçue — ${BRAND_CONFIG.name}`,
      body: `${greeting}\n\nNous avons bien reçu votre commande ${data.orderNumber} d'un total de ${formatDA(
        data.total,
      )}. Nous vous contacterons pour confirmer avant l'expédition.${signature}`,
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
  channels?: NotificationChannel[];
};

async function dispatch(options: DispatchOptions): Promise<void> {
  const enabled: NotificationChannel[] = options.channels ?? ["EMAIL"];
  for (const provider of providers) {
    if (!enabled.includes(provider.channel)) continue;
    const recipient =
      provider.channel === "EMAIL" ? (options.email ?? "") : options.phone.replace(/^0/, "+213");
    if (!recipient) continue;

    try {
      await provider.send({ to: recipient, subject: options.subject, body: options.body });
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
    } catch (error) {
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
      console.error("[notify] delivery failed", options.template, error);
    }
  }
}

export async function sendOrderReceived(data: {
  orderId: string;
  phone: string;
  email?: string | null;
  orderNumber: string;
  firstName: string;
  total: number;
}): Promise<void> {
  const tpl = templates({ orderNumber: data.orderNumber, firstName: data.firstName, total: data.total });
  await dispatch({
    orderId: data.orderId,
    phone: data.phone,
    email: data.email,
    template: "ORDER_RECEIVED",
    subject: tpl.received.subject,
    body: tpl.received.body,
    channels: ["EMAIL", "WHATSAPP"],
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
  });
}

export async function sendShippingNotification(data: {
  orderId: string;
  phone: string;
  email?: string | null;
  orderNumber: string;
  firstName: string;
  total: number;
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
  });
}
