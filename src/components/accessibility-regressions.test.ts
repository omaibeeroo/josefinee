import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { scrollBehaviorForMotion } from "@/components/reduced-motion";

const checkoutSource = readFileSync(
  new URL("./storefront/checkout/checkout-form.tsx", import.meta.url),
  "utf8",
);
const confirmationSource = readFileSync(
  new URL("../app/(store)/order/[orderNumber]/page.tsx", import.meta.url),
  "utf8",
);
const mobileNavSource = readFileSync(new URL("./storefront/chrome.tsx", import.meta.url), "utf8");
const productEditorSource = readFileSync(new URL("./admin/product-editor.tsx", import.meta.url), "utf8");
const adminShellSource = readFileSync(new URL("./admin/shell.tsx", import.meta.url), "utf8");
const uiSource = readFileSync(new URL("./ui.tsx", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

describe("accessibility and responsive regressions", () => {
  it("lets Arabic checkout and confirmation inherit the document direction", () => {
    expect(checkoutSource).not.toMatch(/<div dir="ltr" className="checkout-form-layout/);
    expect(confirmationSource).not.toMatch(/<div dir="ltr" className="order-confirmation-page/);
    expect(mobileNavSource).not.toMatch(/id="mobile-navigation-dialog"\s+dir="ltr"/);
  });

  it("associates every repeated product variant label with its control", () => {
    expect(productEditorSource).toContain("htmlFor={variantFieldId(variantIndex, \"sku\")}");
    expect(productEditorSource).toContain("id={variantFieldId(variantIndex, \"sku\")}");
    expect(productEditorSource).toContain("htmlFor={optionFieldId}");
    expect(productEditorSource).toContain("id={optionFieldId}");
  });

  it("makes validation errors focusable and binds the admin menu state", () => {
    expect(checkoutSource).toContain("ref={formErrorRef}");
    expect(checkoutSource).toContain("formErrorRef.current?.focus");
    expect(adminShellSource).toContain("aria-controls={menuPanelId}");
    expect(adminShellSource).toContain("aria-expanded={menuOpen}");
    expect(adminShellSource).toContain('id={menuPanelId}');
    expect(uiSource).toContain("previouslyFocused?.focus()");
  });

  it("disables modal, drawer, and accordion animation under reduced motion", () => {
    expect(cssSource).toMatch(/\.animate-slide-up,[\s\S]*\.motion-expand[\s\S]*animation: none !important/);
  });

  it("uses instant carousel scrolling when reduced motion is requested", () => {
    const originalWindow = globalThis.window;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { matchMedia: () => ({ matches: true }) },
    });
    expect(scrollBehaviorForMotion()).toBe("auto");
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { matchMedia: () => ({ matches: false }) },
    });
    expect(scrollBehaviorForMotion()).toBe("smooth");
    if (originalWindow === undefined) delete (globalThis as { window?: Window }).window;
    else globalThis.window = originalWindow;
  });
});
