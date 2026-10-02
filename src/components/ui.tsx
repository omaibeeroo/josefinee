"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatDA } from "@/lib/money";
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
        "btn",
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
  return (
    <div>
      <label className="field-label" htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      <div data-field={id}>{children}</div>
      {error ? (
        <p className="mt-1.5 text-sm text-[#9e342e]" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-sm text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean };

export function Input({ invalid, className, ...props }: InputProps) {
  return (
    <input
      className={cn("field", invalid && "border-[#9e342e]", className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn("field min-h-28 py-3", props.className)} {...props} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn("field", props.className)} {...props} />;
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
        tone === "sale" && "bg-sale text-white",
        tone === "gold" && "bg-gold text-white",
        tone === "green" && "bg-success text-white",
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
  return (
    <div
      className={cn(
        "inline-flex items-center border hairline bg-white",
        small ? "h-9" : "h-[2.875rem]",
      )}
    >
      <button
        type="button"
        aria-label="Decrease quantity"
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
        aria-label="Increase quantity"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        className="flex h-full w-10 items-center justify-center disabled:opacity-30"
      >
        <Plus size={14} />
      </button>
    </div>
  );
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
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  const headingId = labelledBy ?? `modal-${title.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby={headingId}>
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink/50" />
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto bg-ivory p-6 shadow-card animate-slide-up sm:p-8">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={headingId} className="font-display text-2xl">
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="p-1">
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
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  labelledBy?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  const headingId = labelledBy ?? `drawer-${title.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-labelledby={headingId}>
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink/50 animate-fade-in" />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-ivory shadow-drawer animate-slide-in-right">
        <div className="flex items-center justify-between border-b hairline px-5 py-4">
          <h2 id={headingId} className="text-xs font-medium uppercase tracking-[0.2em]">
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1">
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
}: {
  items: Array<{ title: string; content: ReactNode; defaultOpen?: boolean }>;
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
              className="flex w-full items-center justify-between gap-4 py-4 text-left"
            >
              <span className="text-sm font-medium uppercase tracking-[0.1em]">{item.title}</span>
              <ChevronDown size={16} className={cn("transition-transform", isOpen && "rotate-180")} />
            </button>
            {isOpen && <div className="pb-5">{item.content}</div>}
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------- Stars */

export function Stars({ value, count }: { value: number; count?: number }) {
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Rated ${value} out of 5`}>
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

/* ----------------------------------------------------------- Section head */

export function SectionHeading({
  eyebrow,
  title,
  action,
  align = "center",
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
  align?: "center" | "left";
}) {
  return (
    <div className={cn("mb-8 md:mb-12", align === "center" ? "text-center" : "text-left")}>
      {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
      <h2 className="font-display text-3xl font-medium tracking-tight md:text-4xl">{title}</h2>
      {action && <div className="mt-5">{action}</div>}
    </div>
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
        "transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform",
        visible ? "translate-y-0 opacity-100" : "translate-y-7 opacity-0",
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
