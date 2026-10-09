import { describe, expect, it } from "vitest";
import { checkoutSchema } from "@/lib/validation/checkout";

const valid = {
  firstName: "Amira",
  lastName: "Benali",
  phone: "0550123456",
  wilayaId: "wilaya-16",
  communeId: "commune-1",
  address: "Rue Didouche Mourad, Alger",
  deliveryMethod: "HOME",
  acceptTerms: true,
  idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
} as const;

describe("checkoutSchema", () => {
  it("accepts a complete valid checkout", () => {
    const result = checkoutSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phone).toBe("0550123456");
      expect(result.data.deliveryMethod).toBe("HOME");
    }
  });

  it("normalizes international phone formats", () => {
    const result = checkoutSchema.safeParse({ ...valid, phone: "+213 550 12 34 56" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.phone).toBe("0550123456");
  });

  it("rejects invalid phones, missing fields and unaccepted terms", () => {
    expect(checkoutSchema.safeParse({ ...valid, phone: "0212345678" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...valid, firstName: "A" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...valid, wilayaId: "" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...valid, address: "abc" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...valid, acceptTerms: false }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...valid, deliveryMethod: "DRONE" }).success).toBe(false);
  });

  it("rejects unknown communes implicitly through required fields", () => {
    const result = checkoutSchema.safeParse({ ...valid, communeId: "" });
    expect(result.success).toBe(false);
  });

  it("treats the string 'false' as false for boolean checkboxes", () => {
    expect(checkoutSchema.safeParse({ ...valid, acceptTerms: "false" }).success).toBe(
      false,
    );
    const accepted = checkoutSchema.safeParse({ ...valid, acceptTerms: "true" });
    expect(accepted.success).toBe(true);
  });

  it("treats an empty-string email as absent", () => {
    const result = checkoutSchema.safeParse({ ...valid, email: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBeUndefined();
  });
});
