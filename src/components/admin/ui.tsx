import Link from "next/link";
import type { ReactNode } from "react";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@prisma/client";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="admin-surface mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-medium">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-soft">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  href?: string;
}) {
  const content = (
    <div className="admin-card border hairline bg-white p-5">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-ink-muted">{label}</p>
      <p className="mt-2 font-display text-3xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
  return href ? (
    <Link href={href} className="block transition-shadow hover:shadow-card">
      {content}
    </Link>
  ) : (
    content
  );
}

const STATUS_TONES: Record<string, string> = {
  amber: "bg-amber-100 text-amber-900",
  blue: "bg-blue-100 text-blue-900",
  indigo: "bg-indigo-100 text-indigo-900",
  violet: "bg-violet-100 text-violet-900",
  green: "bg-emerald-100 text-emerald-900",
  red: "bg-red-100 text-red-900",
  orange: "bg-orange-100 text-orange-900",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const meta = ORDER_STATUS_LABELS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.08em]",
        STATUS_TONES[meta.tone] ?? "bg-stone-200 text-stone-800",
      )}
    >
      {meta.label}
    </span>
  );
}

export function RiskBadge({ level }: { level: "LOW" | "MEDIUM" | "HIGH" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.08em]",
        level === "HIGH" && "bg-red-100 text-red-900",
        level === "MEDIUM" && "bg-amber-100 text-amber-900",
        level === "LOW" && "bg-emerald-100 text-emerald-900",
      )}
    >
      {level}
    </span>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("admin-card border hairline bg-white p-5", className)}>{children}</div>;
}

export function LineChart({ data }: { data: Array<{ date: string; value: number }> }) {
  const width = 640;
  const height = 180;
  const padding = 24;
  const max = Math.max(1, ...data.map((point) => point.value));
  const stepX = data.length > 1 ? (width - padding * 2) / (data.length - 1) : 0;

  const points = data.map((point, index) => {
    const x = padding + index * stepX;
    const y = height - padding - (point.value / max) * (height - padding * 2);
    return `${x},${y}`;
  });

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[480px]" role="img" aria-label="Trend chart">
        <polyline
          points={points.join(" ")}
          fill="none"
          stroke="#b08d57"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {data.map((point, index) => {
          const x = padding + index * stepX;
          const y = height - padding - (point.value / max) * (height - padding * 2);
          return <circle key={point.date} cx={x} cy={y} r="3" fill="#1c1a17" />;
        })}
      </svg>
      {data.length > 0 && (
        <p className="mt-1 text-xs text-ink-muted">
          {data[0]?.date} → {data[data.length - 1]?.date}
        </p>
      )}
    </div>
  );
}

export function BarList({
  items,
}: {
  items: Array<{ label: string; value: number; display: string }>;
}) {
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item.label}>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate">{item.label}</span>
            <span className="shrink-0 font-medium tabular-nums">{item.display}</span>
          </div>
          <div className="mt-1 h-1.5 bg-cream">
            <div className="h-full bg-gold" style={{ width: `${(item.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
