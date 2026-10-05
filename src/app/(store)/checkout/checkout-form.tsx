"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
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

const CHECKOUT_DRAFT_KEY = "nur.checkout.draft.v1";
const CHECKOUT_IDEMPOTENCY_KEY = "nur.checkout.idempotency.v1";
const checkoutDraftSchema = z.object({
  wilayaId: z.string().max(64),
  communeId: z.string().max(64),
  deliveryMethod: z.enum(["HOME", "STOPDESK", "EXPRESS", "STANDARD"]),
  couponInput: z.string().max(40),
});

function newCheckoutKey(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

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
  const idempotencyKey = useRef<string | null>(null);

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
  const [couponPending, setCouponPending] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);

  const [website, setWebsite] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [duplicateOrder, setDuplicateOrder] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingRegion, setLoadingRegion] = useState(false);
  const [regionError, setRegionError] = useState<string | null>(null);
  const [regionRetryToken, setRegionRetryToken] = useState(0);

  useEffect(() => {
    try {
      const rawDraft = window.sessionStorage.getItem(CHECKOUT_DRAFT_KEY);
      if (rawDraft) {
        const parsedDraft = checkoutDraftSchema.safeParse(JSON.parse(rawDraft));
        if (parsedDraft.success) {
          const draft = parsedDraft.data;
          setWilayaId(draft.wilayaId);
          setCommuneId(draft.communeId);
          setDeliveryMethod(draft.deliveryMethod);
          setCouponInput(draft.couponInput);
          setCouponMessage(
            draft.couponInput
              ? "Code promo enregistré — appliquez-le à nouveau pour vérifier sa disponibilité."
              : null,
          );
          setDraftRestored(true);
        } else {
          window.sessionStorage.removeItem(CHECKOUT_DRAFT_KEY);
        }
      }
      const savedKey = window.sessionStorage.getItem(CHECKOUT_IDEMPOTENCY_KEY);
      const key = savedKey && /^[A-Za-z0-9-]{8,100}$/.test(savedKey) ? savedKey : newCheckoutKey();
      idempotencyKey.current = key;
      window.sessionStorage.setItem(CHECKOUT_IDEMPOTENCY_KEY, key);
    } catch {
      idempotencyKey.current = newCheckoutKey();
    }
    setDraftLoaded(true);
  }, []);

  useEffect(() => {
    if (!draftLoaded) return;
    const draft = {
      wilayaId,
      communeId,
      deliveryMethod,
      couponInput,
    };
    try {
      if (Object.values(draft).some((value) => value.trim().length > 0)) {
        window.sessionStorage.setItem(CHECKOUT_DRAFT_KEY, JSON.stringify(draft));
      } else {
        window.sessionStorage.removeItem(CHECKOUT_DRAFT_KEY);
      }
    } catch {
      // Storage may be disabled; checkout remains functional without draft recovery.
    }
  }, [draftLoaded, wilayaId, communeId, deliveryMethod, couponInput]);

  useEffect(() => {
    if (!wilayaId) {
      setCommunes([]);
      setDeliveryOptions([]);
      setRegionError(null);
      return;
    }
    let cancelled = false;
    setLoadingRegion(true);
    setRegionError(null);
    Promise.all([getCommunesAction(wilayaId), getDeliveryOptionsAction(wilayaId)])
      .then(([communeList, options]) => {
        if (cancelled) return;
        setCommunes(communeList);
        setDeliveryOptions(options);
        setCommuneId((current) =>
          communeList.some((commune) => commune.id === current) ? current : "",
        );
        if (communeList.length === 0 || options.length === 0) {
          setRegionError(
            "Les options de livraison ne sont pas disponibles dans cette wilaya. Choisissez-en une autre ou contactez-nous.",
          );
        }
        if (options.length > 0 && !options.some((option) => option.method === deliveryMethod)) {
          setDeliveryMethod(options[0]?.method ?? defaultDeliveryMethod);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setCommunes([]);
        setDeliveryOptions([]);
        setRegionError(
          "Impossible de charger les options de livraison. Réessayez ou choisissez une autre wilaya.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoadingRegion(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wilayaId, regionRetryToken]);

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

  function clearSavedDraft() {
    setFirstName("");
    setLastName("");
    setPhone("");
    setEmail("");
    setWilayaId("");
    setCommuneId("");
    setAddress("");
    setDeliveryMethod(defaultDeliveryMethod);
    setNotes("");
    setCouponInput("");
    setCoupon(null);
    setCouponMessage(null);
    setPassword("");
    setCreateAccount(false);
    setAcceptTerms(false);
    setAllowDuplicate(false);
    setWebsite("");
    setDraftRestored(false);
    try {
      window.sessionStorage.removeItem(CHECKOUT_DRAFT_KEY);
    } catch {
      // Storage may be disabled; clearing the in-memory form still works.
    }
  }

  async function applyCoupon() {
    setCouponMessage(null);
    setCouponPending(true);
    try {
      const result = await previewCouponAction(couponInput);
      if (result.ok) {
        setCoupon({ code: result.code, discount: result.discount });
        setCouponMessage(
          `Code ${result.code} appliqué — vous économisez ${formatDA(result.discount)}.`,
        );
      } else {
        setCoupon(null);
        setCouponMessage(result.error);
      }
    } catch {
      setCoupon(null);
      setCouponMessage("Impossible de vérifier ce code. Veuillez réessayer.");
    } finally {
      setCouponPending(false);
    }
  }

  async function doSubmit(forceDuplicate = false) {
    setSubmitting(true);
    setFormError(null);
    setFields({});

    const requestKey = idempotencyKey.current ?? newCheckoutKey();
    idempotencyKey.current = requestKey;
    try {
      window.sessionStorage.setItem(CHECKOUT_IDEMPOTENCY_KEY, requestKey);
    } catch {
      // The request key is still valid in-memory when session storage is unavailable.
    }
    let result: Awaited<ReturnType<typeof submitOrderAction>>;
    try {
      result = await submitOrderAction({
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
        idempotencyKey: requestKey,
        website,
      });
    } catch {
      setSubmitting(false);
      setFormError(
        "La réponse n’a pas pu être confirmée. Vos informations restent enregistrées dans cet onglet ; réessayez pour vérifier la commande sans risque de doublon.",
      );
      return;
    }

    if (result.ok) {
      try {
        window.sessionStorage.removeItem(CHECKOUT_DRAFT_KEY);
        window.sessionStorage.removeItem(CHECKOUT_IDEMPOTENCY_KEY);
      } catch {
        // Successful order navigation must not depend on browser storage access.
      }
      pixelEvent("Purchase", { value: result.total, currency: "DZD" });
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
    <div className="checkout-form-layout grid gap-10 lg:grid-cols-[1fr_400px]">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void doSubmit();
        }}
        noValidate
        className="checkout-form relative space-y-8"
      >
        <Honeypot value={website} onChange={setWebsite} />
        {draftRestored && (
          <div
            className="flex flex-wrap items-center justify-between gap-3 border hairline bg-white px-4 py-3 text-sm"
            role="status"
          >
            <span>
              Vos choix de livraison et votre code promo ont été restaurés dans cet onglet. Vos
              coordonnées et votre adresse ne sont jamais enregistrées.
            </span>
            <Button type="button" variant="outline" size="sm" onClick={clearSavedDraft}>
              Effacer les choix enregistrés
            </Button>
          </div>
        )}
        {formError && (
          <p
            className="border border-[#9e342e]/30 bg-[#9e342e]/5 px-4 py-3 text-sm text-[#9e342e]"
            role="alert"
          >
            {formError}
          </p>
        )}
        {duplicateOrder && (
          <div className="border border-gold/50 bg-gold/10 px-4 py-3 text-sm" role="alert">
            <p className="font-medium">
              Nous avons déjà reçu une commande similaire avec ce numéro.
            </p>
            <p className="mt-1 text-ink-soft">
              La commande {duplicateOrder} vient d’être passée. Continuez uniquement si vous
              souhaitez vraiment commander deux fois.
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
              Oui, passer une nouvelle commande
            </Button>
          </div>
        )}

        <section aria-labelledby="contact-heading">
          <h2 id="contact-heading" className="mb-4 font-display text-2xl">
            1 · Vos coordonnées
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Prénom" required error={fields.firstName}>
              <Input
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                invalid={Boolean(fields.firstName)}
                autoComplete="given-name"
                required
              />
            </Field>
            <Field label="Nom" required error={fields.lastName}>
              <Input
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                invalid={Boolean(fields.lastName)}
                autoComplete="family-name"
                required
              />
            </Field>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field
              label="Numéro de téléphone"
              required
              error={fields.phone}
              hint="0550 12 34 56 — nous vous appellerons pour confirmer"
            >
              <Input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                invalid={Boolean(fields.phone)}
                autoComplete="tel"
                inputMode="tel"
                placeholder="05 / 06 / 07 …"
                required
              />
            </Field>
            <Field label="E-mail (facultatif)" error={fields.email}>
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                invalid={Boolean(fields.email)}
                autoComplete="email"
              />
            </Field>
          </div>
        </section>

        <section aria-labelledby="delivery-heading" aria-busy={loadingRegion}>
          <h2 id="delivery-heading" className="mb-4 font-display text-2xl">
            2 · Livraison
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Wilaya" required error={fields.wilayaId}>
              <Select
                value={wilayaId}
                onChange={(event) => setWilayaId(event.target.value)}
                required
              >
                <option value="">Choisissez votre wilaya…</option>
                {wilayas.map((wilaya) => (
                  <option key={wilaya.id} value={wilaya.id}>
                    {String(wilaya.code).padStart(2, "0")} — {wilaya.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Commune" required error={fields.communeId}>
              <Select
                value={communeId}
                onChange={(event) => setCommuneId(event.target.value)}
                required
                disabled={!wilayaId || loadingRegion}
              >
                <option value="">
                  {loadingRegion
                    ? "Chargement…"
                    : wilayaId
                      ? "Choisissez votre commune…"
                      : "Choisissez d’abord une wilaya"}
                </option>
                {communes.map((commune) => (
                  <option key={commune.id} value={commune.id}>
                    {commune.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {regionError && (
            <div
              className="mt-3 flex flex-wrap items-center gap-3 text-sm text-[#9e342e]"
              role="alert"
            >
              <span>{regionError}</span>
              {wilayaId && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={loadingRegion}
                  onClick={() => setRegionRetryToken((value) => value + 1)}
                >
                  {loadingRegion ? "Chargement…" : "Réessayer"}
                </Button>
              )}
            </div>
          )}
          <div className="mt-4">
            <Field
              label="Adresse complète"
              required
              error={fields.address}
              hint="Rue, repère, immeuble…"
            >
              <Textarea
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                required
                rows={2}
              />
            </Field>
          </div>

          {deliveryOptions.length > 0 && (
            <fieldset className="mt-5">
              <legend className="field-label">Mode de livraison</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {deliveryOptions.map((option) => (
                  <label
                    key={option.method}
                    className={`checkout-option flex cursor-pointer items-center justify-between gap-3 border px-4 py-3 text-sm transition-colors ${
                      deliveryMethod === option.method
                        ? "checkout-option-selected border-ink bg-white"
                        : "hairline bg-white/60"
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
                        <span className="block font-medium">
                          {DELIVERY_METHOD_LABELS[option.method]}
                        </span>
                        <span className="block text-xs text-ink-muted">
                          {option.etaMinDays}–{option.etaMaxDays} jours
                        </span>
                      </span>
                    </span>
                    <span className="font-medium">
                      {freeDelivery ? "Offerte" : formatDA(option.price)}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div className="mt-4">
            <Field label="Instructions (facultatif)">
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={2}
                placeholder="Une précision à nous communiquer ?"
              />
            </Field>
          </div>
        </section>

        <section aria-labelledby="account-heading">
          <h2 id="account-heading" className="mb-4 font-display text-2xl">
            3 · Dernière étape
          </h2>
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={createAccount}
              onChange={(event) => setCreateAccount(event.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#1c1a17]"
            />
            <span>
              Créer un compte pour commander plus rapidement la prochaine fois
              <span className="block text-xs text-ink-muted">
                Une adresse e-mail et un mot de passe sont nécessaires.
              </span>
            </span>
          </label>
          {createAccount && (
            <div className="mt-3">
              <Field
                label="Mot de passe"
                required
                error={fields.password}
                hint="10 caractères minimum, majuscule, minuscule et chiffre"
              >
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                />
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
              J’accepte les{" "}
              <Link href="/pages/terms" target="_blank" className="underline underline-offset-2">
                conditions générales
              </Link>{" "}
              et la{" "}
              <Link href="/pages/returns" target="_blank" className="underline underline-offset-2">
                politique de retour
              </Link>
              .
            </span>
          </label>
          {fields.acceptTerms && (
            <p className="mt-1.5 text-sm text-[#9e342e]" role="alert">
              {fields.acceptTerms}
            </p>
          )}
        </section>

        <Button
          type="submit"
          disabled={submitting || loadingRegion || !selectedRate || !communeId}
          variant="gold"
          size="lg"
          className="w-full"
        >
          {submitting
            ? "Validation de votre commande…"
            : `Confirmer la commande · ${formatDA(total)}`}
        </Button>
        <p className="text-center text-xs text-ink-muted">
          Paiement à la livraison — vous réglerez {formatDA(total)} à la réception de votre
          commande.
        </p>
      </form>

      <aside
        className="lg:sticky lg:top-32 lg:self-start"
        aria-label="Récapitulatif de la commande"
      >
        <div className="checkout-summary border hairline bg-white p-6">
          <h2 className="text-xs font-medium uppercase tracking-[0.2em]">
            Récapitulatif de la commande
          </h2>
          <ul className="mt-4 space-y-4">
            {initialCart.items.map((item) => (
              <li key={item.id} className="flex gap-3">
                <div className="relative h-16 w-14 shrink-0 overflow-hidden bg-cream">
                  {item.imageUrl && (
                    <Image
                      src={item.imageUrl}
                      alt={item.productName}
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  )}
                  <span className="absolute right-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-[0.625rem] text-ivory">
                    {item.quantity}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium leading-tight">{item.productName}</p>
                  {item.variantLabel && (
                    <p className="text-xs text-ink-muted">{item.variantLabel}</p>
                  )}
                </div>
                <p className="text-sm font-medium">{formatDA(item.lineTotal)}</p>
              </li>
            ))}
          </ul>

          <div className="mt-5 border-t hairline pt-4">
            <label htmlFor="coupon" className="field-label">
              Code promotionnel
            </label>
            <div className="flex gap-2">
              <Input
                id="coupon"
                value={couponInput}
                onChange={(event) => setCouponInput(event.target.value)}
                placeholder="WELCOME10"
                className="uppercase"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={couponPending}
                onClick={() => void applyCoupon()}
              >
                {couponPending ? "Vérification…" : "Appliquer"}
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
              <dt className="text-ink-soft">Sous-total</dt>
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
                <dt>Remise{coupon ? ` (${coupon.code})` : ""}</dt>
                <dd>−{formatDA(discount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-ink-soft">Livraison</dt>
              <dd>{selectedRate ? (freeDelivery ? "Offerte" : formatDA(shipping)) : "—"}</dd>
            </div>
            <div className="flex justify-between border-t hairline pt-2 text-base font-medium">
              <dt>Total à payer</dt>
              <dd>{formatDA(total)}</dd>
            </div>
          </dl>
          {remainingForFree > 0 && (
            <p className="mt-3 text-xs text-ink-muted">
              Ajoutez {formatDA(remainingForFree)} à votre panier pour bénéficier de la livraison
              offerte.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
