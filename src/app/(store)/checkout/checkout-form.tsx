"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getCommunesAction,
  getDeliveryOptionsAction,
  submitOrderAction,
} from "@/server/actions/checkout";
import { previewCouponAction } from "@/server/actions/cart";
import { Button, Field, Honeypot, Input, Select, Textarea } from "@/components/ui";
import { formatDA } from "@/lib/money";
import { DELIVERY_METHOD_LABELS } from "@/lib/constants";
import { pixelEvent } from "@/components/pixels";
import type { CartLine } from "@/server/cart";
import type { CommuneOption, DeliveryOption, WilayaOption } from "@/server/delivery";

export function CheckoutForm({
  wilayas,
  initialCart,
  freeDeliveryThreshold,
  defaultDeliveryMethod,
  promotion,
}: {
  wilayas: WilayaOption[];
  initialCart: { items: CartLine[]; subtotal: number; count: number };
  freeDeliveryThreshold: number;
  defaultDeliveryMethod: string;
  promotion: { name: string; discount: number } | null;
}) {
  const router = useRouter();
  const idempotencyKey = useRef(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [wilayaId, setWilayaId] = useState("");
  const [communes, setCommunes] = useState<CommuneOption[]>([]);
  const [communeId, setCommuneId] = useState("");
  const [address, setAddress] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState(defaultDeliveryMethod);
  const [deliveryOptions, setDeliveryOptions] = useState<DeliveryOption[]>([]);
  const [notes, setNotes] = useState("");
  const [createAccount, setCreateAccount] = useState(false);
  const [password, setPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [allowDuplicate, setAllowDuplicate] = useState(false);

  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [couponMessage, setCouponMessage] = useState<string | null>(null);

  const [website, setWebsite] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [duplicateOrder, setDuplicateOrder] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingRegion, setLoadingRegion] = useState(false);

  useEffect(() => {
    if (!wilayaId) {
      setCommunes([]);
      setDeliveryOptions([]);
      return;
    }
    let cancelled = false;
    setLoadingRegion(true);
    Promise.all([getCommunesAction(wilayaId), getDeliveryOptionsAction(wilayaId)])
      .then(([communeList, options]) => {
        if (cancelled) return;
        setCommunes(communeList);
        setDeliveryOptions(options);
        setCommuneId("");
        if (options.length > 0 && !options.some((option) => option.method === deliveryMethod)) {
          setDeliveryMethod(options[0]?.method ?? defaultDeliveryMethod);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingRegion(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wilayaId]);

  const selectedRate = deliveryOptions.find((option) => option.method === deliveryMethod);
  const postPromoSubtotal = Math.max(0, initialCart.subtotal - (promotion?.discount ?? 0));
  const freeDelivery = freeDeliveryThreshold > 0 && postPromoSubtotal >= freeDeliveryThreshold;
  const shipping = selectedRate ? (freeDelivery ? 0 : selectedRate.price) : 0;
  const discount = coupon?.discount ?? 0;
  const total = Math.max(0, postPromoSubtotal - discount + shipping);

  const remainingForFree = useMemo(
    () => (freeDeliveryThreshold > 0 ? Math.max(0, freeDeliveryThreshold - postPromoSubtotal) : 0),
    [freeDeliveryThreshold, postPromoSubtotal],
  );

  async function applyCoupon() {
    setCouponMessage(null);
    const result = await previewCouponAction(couponInput);
    if (result.ok) {
      setCoupon({ code: result.code, discount: result.discount });
      setCouponMessage(`Code ${result.code} applied — you save ${formatDA(result.discount)}.`);
    } else {
      setCoupon(null);
      setCouponMessage(result.error);
    }
  }

  async function doSubmit(forceDuplicate = false) {
    setSubmitting(true);
    setFormError(null);
    setFields({});

    const result = await submitOrderAction({
      firstName,
      lastName,
      phone,
      email: email || undefined,
      wilayaId,
      communeId,
      address,
      deliveryMethod: deliveryMethod as "HOME" | "STOPDESK" | "EXPRESS" | "STANDARD",
      notes: notes || undefined,
      couponCode: coupon?.code,
      createAccount,
      password: createAccount ? password : undefined,
      acceptTerms,
      allowDuplicate: forceDuplicate || allowDuplicate,
      idempotencyKey: idempotencyKey.current,
      website,
    });

    if (result.ok) {
      pixelEvent("Purchase", { value: total / 100, currency: "DZD" });
      router.push(`/order/${result.orderNumber}?t=${encodeURIComponent(result.trackingToken)}`);
      return;
    }

    setSubmitting(false);
    if (result.code === "DUPLICATE_ORDER" && result.orderNumber) {
      setDuplicateOrder(result.orderNumber);
      return;
    }
    setFormError(result.error);
    if (result.fields) setFields(result.fields);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_400px]">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void doSubmit();
        }}
        noValidate
        className="relative space-y-8"
      >
        <Honeypot value={website} onChange={setWebsite} />
        {formError && (
          <p className="border border-[#9e342e]/30 bg-[#9e342e]/5 px-4 py-3 text-sm text-[#9e342e]" role="alert">
            {formError}
          </p>
        )}
        {duplicateOrder && (
          <div className="border border-gold/50 bg-gold/10 px-4 py-3 text-sm" role="alert">
            <p className="font-medium">We already received a similar order from this number.</p>
            <p className="mt-1 text-ink-soft">
              Order {duplicateOrder} was placed a moment ago. Only continue if you meant to order twice.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => {
                setAllowDuplicate(true);
                setDuplicateOrder(null);
                void doSubmit(true);
              }}
            >
              Yes, place it anyway
            </Button>
          </div>
        )}

        <section aria-labelledby="contact-heading">
          <h2 id="contact-heading" className="mb-4 font-display text-2xl">1 · Your details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" required error={fields.firstName}>
              <Input value={firstName} onChange={(event) => setFirstName(event.target.value)} invalid={Boolean(fields.firstName)} autoComplete="given-name" required />
            </Field>
            <Field label="Last name" required error={fields.lastName}>
              <Input value={lastName} onChange={(event) => setLastName(event.target.value)} invalid={Boolean(fields.lastName)} autoComplete="family-name" required />
            </Field>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Phone number" required error={fields.phone} hint="0550 12 34 56 — we call to confirm">
              <Input value={phone} onChange={(event) => setPhone(event.target.value)} invalid={Boolean(fields.phone)} autoComplete="tel" inputMode="tel" placeholder="05 / 06 / 07 …" required />
            </Field>
            <Field label="Email (optional)" error={fields.email}>
              <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} invalid={Boolean(fields.email)} autoComplete="email" />
            </Field>
          </div>
        </section>

        <section aria-labelledby="delivery-heading">
          <h2 id="delivery-heading" className="mb-4 font-display text-2xl">2 · Delivery</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Wilaya" required error={fields.wilayaId}>
              <Select value={wilayaId} onChange={(event) => setWilayaId(event.target.value)} required>
                <option value="">Select your wilaya…</option>
                {wilayas.map((wilaya) => (
                  <option key={wilaya.id} value={wilaya.id}>
                    {String(wilaya.code).padStart(2, "0")} — {wilaya.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Commune" required error={fields.communeId}>
              <Select value={communeId} onChange={(event) => setCommuneId(event.target.value)} required disabled={!wilayaId || loadingRegion}>
                <option value="">{loadingRegion ? "Loading…" : wilayaId ? "Select your commune…" : "Select a wilaya first"}</option>
                {communes.map((commune) => (
                  <option key={commune.id} value={commune.id}>
                    {commune.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Full address" required error={fields.address} hint="Street, landmark, building…">
              <Textarea value={address} onChange={(event) => setAddress(event.target.value)} required rows={2} />
            </Field>
          </div>

          {deliveryOptions.length > 0 && (
            <fieldset className="mt-5">
              <legend className="field-label">Delivery method</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {deliveryOptions.map((option) => (
                  <label
                    key={option.method}
                    className={`flex cursor-pointer items-center justify-between gap-3 border px-4 py-3 text-sm transition-colors ${
                      deliveryMethod === option.method ? "border-ink bg-white" : "hairline bg-white/60"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="deliveryMethod"
                        value={option.method}
                        checked={deliveryMethod === option.method}
                        onChange={() => setDeliveryMethod(option.method)}
                        className="h-4 w-4 accent-[#1c1a17]"
                      />
                      <span>
                        <span className="block font-medium">{DELIVERY_METHOD_LABELS[option.method]}</span>
                        <span className="block text-xs text-ink-muted">
                          {option.etaMinDays}–{option.etaMaxDays} days
                        </span>
                      </span>
                    </span>
                    <span className="font-medium">{freeDelivery ? "Free" : formatDA(option.price)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div className="mt-4">
            <Field label="Order notes (optional)">
              <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} placeholder="Anything we should know?" />
            </Field>
          </div>
        </section>

        <section aria-labelledby="account-heading">
          <h2 id="account-heading" className="mb-4 font-display text-2xl">3 · Almost done</h2>
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={createAccount}
              onChange={(event) => setCreateAccount(event.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#1c1a17]"
            />
            <span>
              Create an account for faster checkout next time
              <span className="block text-xs text-ink-muted">Requires an email address and a password.</span>
            </span>
          </label>
          {createAccount && (
            <div className="mt-3">
              <Field label="Password" required error={fields.password} hint="10+ characters, upper & lower case, a number">
                <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" />
              </Field>
            </div>
          )}
          <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(event) => setAcceptTerms(event.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#1c1a17]"
              required
            />
            <span>
              I accept the{" "}
              <Link href="/pages/terms" target="_blank" className="underline underline-offset-2">
                terms & conditions
              </Link>{" "}
              and the{" "}
              <Link href="/pages/returns" target="_blank" className="underline underline-offset-2">
                return policy
              </Link>
              .
            </span>
          </label>
          {fields.acceptTerms && (
            <p className="mt-1.5 text-sm text-[#9e342e]" role="alert">{fields.acceptTerms}</p>
          )}
        </section>

        <Button type="submit" disabled={submitting} variant="gold" size="lg" className="w-full">
          {submitting ? "Placing your order…" : `Confirm order · ${formatDA(total)}`}
        </Button>
        <p className="text-center text-xs text-ink-muted">
          Cash on delivery — you pay {formatDA(total)} when your order arrives.
        </p>
      </form>

      <aside className="lg:sticky lg:top-32 lg:self-start" aria-label="Order summary">
        <div className="border hairline bg-white p-6">
          <h2 className="text-xs font-medium uppercase tracking-[0.2em]">Order summary</h2>
          <ul className="mt-4 space-y-4">
            {initialCart.items.map((item) => (
              <li key={item.id} className="flex gap-3">
                <div className="relative h-16 w-14 shrink-0 overflow-hidden bg-cream">
                  {item.imageUrl && (
                    <Image src={item.imageUrl} alt={item.productName} fill sizes="56px" className="object-cover" />
                  )}
                  <span className="absolute right-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-[0.625rem] text-ivory">
                    {item.quantity}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium leading-tight">{item.productName}</p>
                  {item.variantLabel && <p className="text-xs text-ink-muted">{item.variantLabel}</p>}
                </div>
                <p className="text-sm font-medium">{formatDA(item.lineTotal)}</p>
              </li>
            ))}
          </ul>

          <div className="mt-5 border-t hairline pt-4">
            <label htmlFor="coupon" className="field-label">Promo code</label>
            <div className="flex gap-2">
              <Input id="coupon" value={couponInput} onChange={(event) => setCouponInput(event.target.value)} placeholder="WELCOME10" className="uppercase" />
              <Button type="button" variant="outline" size="sm" onClick={() => void applyCoupon()}>
                Apply
              </Button>
            </div>
            {couponMessage && (
              <p className={`mt-2 text-sm ${coupon ? "text-ink-soft" : "text-sale"}`} role="status">
                {couponMessage}
              </p>
            )}
          </div>

          <dl className="mt-4 space-y-1.5 border-t hairline pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-soft">Subtotal</dt>
              <dd>{formatDA(initialCart.subtotal)}</dd>
            </div>
            {promotion && promotion.discount > 0 && (
              <div className="flex justify-between text-success">
                <dt>Promotion ({promotion.name})</dt>
                <dd>−{formatDA(promotion.discount)}</dd>
              </div>
            )}
            {discount > 0 && (
              <div className="flex justify-between text-success">
                <dt>Discount{coupon ? ` (${coupon.code})` : ""}</dt>
                <dd>−{formatDA(discount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-ink-soft">Delivery</dt>
              <dd>{selectedRate ? (freeDelivery ? "Free" : formatDA(shipping)) : "—"}</dd>
            </div>
            <div className="flex justify-between border-t hairline pt-2 text-base font-medium">
              <dt>Total to pay</dt>
              <dd>{formatDA(total)}</dd>
            </div>
          </dl>
          {remainingForFree > 0 && (
            <p className="mt-3 text-xs text-ink-muted">
              Add {formatDA(remainingForFree)} more to unlock free delivery.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
