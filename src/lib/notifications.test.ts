import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
  notificationFindUnique: vi.fn(),
}));

vi.mock("@/lib/settings", () => ({ getSettings: mocks.getSettings }));
vi.mock("@/lib/prisma", () => ({
  prisma: { notification: { findUnique: mocks.notificationFindUnique } },
}));

import {
  resolveEnabledChannels,
  sendDevelopmentConsoleFallback,
  sendOrderReceived,
  sendOrderStatusUpdate,
} from "@/lib/notifications";

describe("resolveEnabledChannels", () => {
  const allOn = {
    orderEmailEnabled: true,
    orderSmsEnabled: true,
    orderWhatsappEnabled: true,
  };

  it("keeps requested channels that are enabled", () => {
    expect(resolveEnabledChannels(["EMAIL", "WHATSAPP"], allOn)).toEqual(["EMAIL", "WHATSAPP"]);
  });

  it("preserves the requested order while dropping disabled channels", () => {
    expect(
      resolveEnabledChannels(["EMAIL", "SMS", "WHATSAPP"], { ...allOn, orderSmsEnabled: false }),
    ).toEqual(["EMAIL", "WHATSAPP"]);
  });

  it("returns an empty list when every requested channel is disabled", () => {
    expect(resolveEnabledChannels(["EMAIL"], { ...allOn, orderEmailEnabled: false })).toEqual([]);
  });

  it("does not invent channels the template never requested", () => {
    expect(resolveEnabledChannels([], allOn)).toEqual([]);
  });
});

describe("notification provider fallback", () => {
  it("rejects unconfigured production sends instead of falling back to console", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      await expect(sendDevelopmentConsoleFallback("EMAIL")).rejects.toThrow(
        "EMAIL notification provider is not configured",
      );
      expect(consoleInfo).not.toHaveBeenCalled();
    } finally {
      consoleInfo.mockRestore();
      vi.unstubAllEnvs();
    }
  });
});

describe("notification dispatch recipients", () => {
  beforeEach(() => {
    mocks.getSettings.mockReset().mockResolvedValue({
      notifications: {
        orderEmailEnabled: true,
        orderSmsEnabled: true,
        orderWhatsappEnabled: true,
      },
    });
    mocks.notificationFindUnique.mockReset();
  });

  it("reports enabled email with no email address as a failure", async () => {
    mocks.getSettings.mockResolvedValueOnce({
      notifications: {
        orderEmailEnabled: true,
        orderSmsEnabled: false,
        orderWhatsappEnabled: false,
      },
    });
    const result = await sendOrderReceived({
      orderId: "order-1",
      phone: "0550123456",
      email: null,
      orderNumber: "HS-2026-000001",
      firstName: "Amina",
      lastName: "Benali",
      wilayaName: "Alger",
      communeName: "Bab El Oued",
      address: "Rue 1",
      deliveryMethod: "HOME",
      subtotal: 2500,
      discount: 0,
      promotionDiscount: 0,
      shipping: 0,
      total: 2500,
      items: [],
    });

    expect(result).toEqual({
      sent: [],
      failed: ["EMAIL"],
      uncertain: [],
      disabled: ["WHATSAPP"],
      skipped: false,
    });
    expect(mocks.notificationFindUnique).not.toHaveBeenCalled();
  });

  it("reports enabled phone channels as failures when the phone is invalid or absent", async () => {
    mocks.getSettings.mockResolvedValueOnce({
      notifications: {
        orderEmailEnabled: false,
        orderSmsEnabled: true,
        orderWhatsappEnabled: true,
      },
    });
    const result = await sendOrderStatusUpdate({
      orderId: "order-2",
      phone: "",
      email: "customer@example.com",
      orderNumber: "HS-2026-000002",
      firstName: "Amina",
      total: 2500,
      status: "CONFIRMED",
      statusKey: "CONFIRMED",
    });

    expect(result.failed).toEqual(["SMS", "WHATSAPP"]);
    expect(result.sent).toEqual([]);
    expect(result.uncertain).toEqual([]);
    expect(result.disabled).toEqual(["EMAIL"]);
    expect(result.skipped).toBe(false);
    expect(mocks.notificationFindUnique).not.toHaveBeenCalled();
  });
});
