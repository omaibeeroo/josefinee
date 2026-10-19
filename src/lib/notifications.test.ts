import { describe, expect, it } from "vitest";
import { resolveEnabledChannels } from "@/lib/notifications";

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
