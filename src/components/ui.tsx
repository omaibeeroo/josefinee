"use client";

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { cn } from "@/lib/utils";
import { formatDA } from "@/lib/money";
import { useLocale } from "@/lib/i18n/provider";
import { Star, StarHalf, Minus, Plus, X, ChevronDown } from "lucide-react";

/* ------------------------------------------------------------------ Buttons */

type ButtonProps = {
  children: ReactNode;
  variant?: "primary" | "gold" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  onClick?: () => void;
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "btn btn-interactive",
        variant === "primary" && "btn-primary",
        variant === "gold" && "btn-gold",
        variant === "outline" && "btn-outline",
        variant === "ghost" && "btn-ghost",
        size === "sm" && "min-h-10 px-4 text-[0.6875rem]",
        size === "lg" && "min-h-[3.25rem] px-10",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------- Fields */

type FieldControlContextValue = {
  id: string;
  describedBy?: string;
  invalid: boolean;
};

const FieldControlContext = createContext<FieldControlContextValue | null>(null);

function mergeDescriptionIds(...values: Array<string | undefined>): string | undefined {
  const ids = [...new Set(values.flatMap((value) => value?.split(/\s+/).filter(Boolean) ?? []))];
  return ids.length > 0 ? ids.join(" ") : undefined;
}

export function Field({
  label,
  error,
  hint,
  children,
  required,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  required?: boolean;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const context: FieldControlContextValue = {
    id,
    describedBy: mergeDescriptionIds(hintId, errorId),
    invalid: Boolean(error),
  };
  return (
    <div>
      <FieldControlContext.Provider value={context}>
        <label className="field-label" htmlFor={id}>
          {label}
          {required && <span aria-hidden="true"> *</span>}
        </label>
        <div data-field={id}>{children}</div>
        {hint && (
          <p id={hintId} className="mt-1.5 text-sm text-ink-muted">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} className="mt-1.5 text-sm text-[#9e342e]" role="alert">
            {error}
          </p>
        )}
      </FieldControlContext.Provider>
    </div>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean };

export function Input({
  invalid,
  className,
  id,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  ...props
}: InputProps) {
  const field = useContext(FieldControlContext);
  const isInvalid = invalid ?? field?.invalid;
  return (
    <input
      className={cn("field", isInvalid && "border-[#9e342e]", className)}
      id={id ?? field?.id}
      aria-invalid={ariaInvalid ?? (isInvalid ? true : undefined)}
      aria-describedby={mergeDescriptionIds(ariaDescribedBy, field?.describedBy)}
      {...props}
    />
  );
}

export function Textarea({
  id,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const field = useContext(FieldControlContext);
  return (
    <textarea
      className={cn("field min-h-28 py-3", props.className, field?.invalid && "border-[#9e342e]")}
      id={id ?? field?.id}
      aria-invalid={ariaInvalid ?? (field?.invalid ? true : undefined)}
      aria-describedby={mergeDescriptionIds(ariaDescribedBy, field?.describedBy)}
      {...props}
    />
  );
}

export function Select({
  id,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const field = useContext(FieldControlContext);
  return (
    <select
      className={cn("field", props.className, field?.invalid && "border-[#9e342e]")}
      id={id ?? field?.id}
      aria-invalid={ariaInvalid ?? (field?.invalid ? true : undefined)}
      aria-describedby={mergeDescriptionIds(ariaDescribedBy, field?.describedBy)}
      {...props}
    />
  );
}

/* -------------------------------------------------------------------- Badge */

export function Badge({
  children,
  tone = "ink",
  className,
}: {
  children: ReactNode;
  tone?: "ink" | "sale" | "gold" | "green" | "muted";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-1 text-[0.625rem] font-medium uppercase tracking-[0.14em]",
        tone === "ink" && "bg-ink text-ivory",
        tone === "sale" && "bg-sale text-[#fff]",
        tone === "gold" && "bg-gold-dark text-[#fff]",
        tone === "green" && "bg-success text-[#fff]",
        tone === "muted" && "bg-cream text-ink-soft",
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ---------------------------------------------------------- Quantity picker */

export function QuantitySelector({
  value,
  onChange,
  min = 1,
  max = 10,
  small,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  small?: boolean;
}) {
  const { t } = useLocale();
  return (
    <div
      className={cn(
        "inline-flex items-center border hairline bg-white",
        small ? "h-9" : "h-[2.875rem]",
      )}
    >
      <button
        type="button"
        aria-label={t.common.decreaseQuantity}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        className="flex h-full w-10 items-center justify-center disabled:opacity-30"
      >
        <Minus size={14} />
      </button>
      <span
        className={cn("w-8 text-center tabular-nums", small ? "text-sm" : "text-base")}
        aria-live="polite"
      >
        {value}
      </span>
      <button
        type="button"
        aria-label={t.common.increaseQuantity}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        className="flex h-full w-10 items-center justify-center disabled:opacity-30"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------ Focus trap */

export function useDialogFocus(
  active: boolean,
  containerRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  initialFocusRef?: RefObject<HTMLElement | null>,
) {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const dialogRoot = container.closest<HTMLElement>('[role="dialog"]') ?? container;
    const parent = dialogRoot.parentElement;
    const backgroundSiblings = parent
      ? Array.from(parent.children).filter(
          (element): element is HTMLElement =>
            element !== dialogRoot && element instanceof HTMLElement,
        )
      : [];
    const previousBackgroundState = backgroundSiblings.map((element) => ({
      element,
      inert: element.inert,
      ariaHidden: element.getAttribute("aria-hidden"),
    }));
    const selector =
      'a[href], button:not([disabled]), textarea, input:not([type="hidden"]), select, [tabindex]:not([tabindex="-1"])';
    const focusables = () =>
      Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
        (element) => element.offsetParent !== null,
      );
    document.body.style.overflow = "hidden";
    for (const element of backgroundSiblings) {
      element.inert = true;
      element.setAttribute("aria-hidden", "true");
    }
    const preferredFocus = initialFocusRef?.current;
    (preferredFocus && preferredFocus.offsetParent !== null
      ? preferredFocus
      : (focusables()[0] ?? container)
    ).focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (!container.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      for (const { element, inert, ariaHidden } of previousBackgroundState) {
        element.inert = inert;
        if (ariaHidden === null) element.removeAttribute("aria-hidden");
        else element.setAttribute("aria-hidden", ariaHidden);
      }
      previouslyFocused?.focus();
    };
  }, [active, containerRef, initialFocusRef]);
}

/* -------------------------------------------------------------------- Modal */

export function Modal({
  open,
  onClose,
  title,
  children,
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  labelledBy?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogFocus(open, panelRef, onClose);
  const { t } = useLocale();

  if (!open) return null;
  const headingId = labelledBy ?? `modal-${title.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
    >
      <button
        aria-label={t.common.close}
        onClick={onClose}
        className="absolute inset-0 bg-ink/50"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative max-h-[90vh] max-h-[90svh] w-full max-w-lg overflow-y-auto overscroll-contain bg-ivory p-6 shadow-card animate-slide-up sm:p-8"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={headingId} className="font-display text-2xl">
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label={t.common.close} className="p-1">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- Drawer */

export function Drawer({
  open,
  onClose,
  title,
  children,
  labelledBy,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  labelledBy?: string;
  className?: string;
}) {
  const panelRef = useRef<HTMLElement>(null);
  useDialogFocus(open, panelRef, onClose);
  const { t } = useLocale();

  if (!open) return null;
  const headingId = labelledBy ?? `drawer-${title.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div
      className="fixed inset-0 z-[60]"
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
    >
      <button
        aria-label={t.common.close}
        onClick={onClose}
        className="absolute inset-0 bg-ink/50 animate-fade-in"
      />
      <aside
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          "absolute right-0 top-0 flex h-full min-h-[100svh] w-full max-w-md flex-col overscroll-contain bg-ivory shadow-drawer animate-slide-in-right",
          className,
        )}
      >
        <div className="flex items-center justify-between border-b hairline px-5 py-4">
          <h2 id={headingId} className="text-xs font-medium uppercase tracking-[0.2em]">
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label={t.common.close} className="p-1">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </aside>
    </div>
  );
}

/* ---------------------------------------------------------------- Accordion */

export function Accordion({
  items,
  compact = false,
}: {
  items: Array<{ title: string; content: ReactNode; defaultOpen?: boolean }>;
  compact?: boolean;
}) {
  const [open, setOpen] = useState<number | null>(
    items.findIndex((item) => item.defaultOpen) === -1
      ? null
      : items.findIndex((item) => item.defaultOpen),
  );
  return (
    <div className="divide-y divide-line border-y hairline">
      {items.map((item, index) => {
        const isOpen = open === index;
        return (
          <div key={item.title}>
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : index)}
              className={cn(
                "flex w-full items-center justify-between gap-4 text-left",
                compact ? "py-2" : "py-3",
              )}
            >
              <span
                className={cn(
                  "font-medium uppercase tracking-[0.12em]",
                  compact ? "text-[0.65rem] leading-tight" : "text-xs",
                )}
              >
                {item.title}
              </span>
              <ChevronDown
                size={14}
                className={cn(
                  "shrink-0 text-ink-muted transition-transform",
                  isOpen && "rotate-180",
                )}
              />
            </button>
            {isOpen && (
              <div className={cn("motion-expand", compact ? "pb-3" : "pb-4")}>{item.content}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------- Stars */

export function Stars({ value, count }: { value: number; count?: number }) {
  const { t } = useLocale();
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  return (
    <span
      className="inline-flex items-center gap-0.5"
      aria-label={t.common.ratedOutOf5.replace("{value}", String(value))}
    >
      {Array.from({ length: 5 }).map((_, index) => {
        if (index < full) return <Star key={index} size={13} className="fill-gold text-gold" />;
        if (index === full && half)
          return <StarHalf key={index} size={13} className="fill-gold text-gold" />;
        return <Star key={index} size={13} className="text-line" />;
      })}
      {typeof count === "number" && (
        <span className="ml-1.5 text-xs text-ink-muted">({count})</span>
      )}
    </span>
  );
}

/* -------------------------------------------------------------------- Price */

export function Price({
  price,
  compareAt,
  large,
}: {
  price: number;
  compareAt?: number | null;
  large?: boolean;
}) {
  return (
    <p className={cn("flex items-baseline gap-2", large ? "text-2xl" : "text-[0.9375rem]")}>
      <span className={cn("font-medium", compareAt && compareAt > price && "text-sale")}>
        {formatDA(price)}
      </span>
      {compareAt && compareAt > price && (
        <span className="text-sm text-ink-muted line-through">{formatDA(compareAt)}</span>
      )}
    </p>
  );
}

/* ---------------------------------------------------------------- Honeypot */

export function Honeypot({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        left: "-9999px",
        top: "auto",
        width: 1,
        height: 1,
        overflow: "hidden",
      }}
    >
      <label>
        Website
        <input
          type="text"
          name="website"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          tabIndex={-1}
          autoComplete="off"
        />
      </label>
    </div>
  );
}

/* ----------------------------------------------------------------- Reveal */

export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -6% 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={cn(
        "motion-safe:transition-[opacity,transform] motion-safe:duration-1000 motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)]",
        visible
          ? "motion-safe:translate-y-0 motion-safe:opacity-100"
          : "motion-safe:translate-y-7 motion-safe:opacity-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------- Empty state */

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="font-display text-3xl">{title}</p>
      {message && <p className="mt-3 text-ink-soft">{message}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
