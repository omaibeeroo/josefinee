import { describe, expect, it } from "vitest";
import { decideCustomerWrite, decideEmailWrite } from "@/server/orders";

describe("decideCustomerWrite (guest-checkout account protection)", () => {
  it("lets a new phone create a customer record", () => {
    expect(
      decideCustomerWrite({ authenticatedCustomerId: null, customer: null, createAccount: false }),
    ).toBe("create");
    expect(
      decideCustomerWrite({ authenticatedCustomerId: null, customer: null, createAccount: true }),
    ).toBe("create");
  });

  it("never overwrites stored PII for a guest repeat order", () => {
    expect(
      decideCustomerWrite({
        authenticatedCustomerId: null,
        customer: { id: "c1", passwordHash: null },
        createAccount: false,
      }),
    ).toBe("touch-only");
    expect(
      decideCustomerWrite({
        authenticatedCustomerId: null,
        customer: { id: "c1", passwordHash: "hash" },
        createAccount: false,
      }),
    ).toBe("touch-only");
  });

  it("rejects guest account claiming on an existing phone, with or without a password", () => {
    // Exploit attempt: attacker knows victim phone, passes createAccount + new
    // password. Must be rejected instead of assigning credentials.
    expect(
      decideCustomerWrite({
        authenticatedCustomerId: null,
        customer: { id: "victim", passwordHash: null },
        createAccount: true,
      }),
    ).toBe("reject-exists");
    expect(
      decideCustomerWrite({
        authenticatedCustomerId: null,
        customer: { id: "victim", passwordHash: "hash" },
        createAccount: true,
      }),
    ).toBe("reject-exists");
  });

  it("allows the authenticated owner to update their own record", () => {
    expect(
      decideCustomerWrite({
        authenticatedCustomerId: "c1",
        customer: { id: "c1", passwordHash: null },
        createAccount: false,
      }),
    ).toBe("update-owned");
    // First-time password set by the owner inside checkout.
    expect(
      decideCustomerWrite({
        authenticatedCustomerId: "c1",
        customer: { id: "c1", passwordHash: null },
        createAccount: true,
      }),
    ).toBe("update-owned");
  });

  it("rejects re-claiming credentials that already exist, even when authenticated", () => {
    expect(
      decideCustomerWrite({
        authenticatedCustomerId: "c1",
        customer: { id: "c1", passwordHash: "hash" },
        createAccount: true,
      }),
    ).toBe("reject-exists");
  });

  it("does not grant update rights from a mismatched session", () => {
    // A session for customer A checking out must not rewrite customer B's
    // record resolved by phone — treated as touch-only.
    expect(
      decideCustomerWrite({
        authenticatedCustomerId: "customer-a",
        customer: { id: "customer-b", passwordHash: null },
        createAccount: false,
      }),
    ).toBe("touch-only");
  });
});

describe("decideEmailWrite (unique-email collision policy)", () => {
  it("keeps a free email", () => {
    expect(decideEmailWrite({ createAccount: false, emailTaken: false })).toBe("keep");
    expect(decideEmailWrite({ createAccount: true, emailTaken: false })).toBe("keep");
  });

  it("strips a taken email from a guest record instead of failing the sale", () => {
    // The email may belong to an account created under a different phone;
    // the order still carries it, only the customer row drops it.
    expect(decideEmailWrite({ createAccount: false, emailTaken: true })).toBe("strip");
  });

  it("rejects a taken email when the checkout claims an account", () => {
    expect(decideEmailWrite({ createAccount: true, emailTaken: true })).toBe("reject");
  });
});
