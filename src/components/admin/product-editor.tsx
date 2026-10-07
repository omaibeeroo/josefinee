"use client";

import { useMemo, useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { saveProductAction } from "@/server/actions/admin-catalog";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { useLocale } from "@/lib/i18n/provider";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type EditorImage = { id?: string; url: string; storageKey?: string; alt?: string };
type EditorOptionValue = { value: string; hexColor?: string };
type EditorOption = { name: string; values: EditorOptionValue[] };
type EditorVariant = {
  id?: string;
  sku: string;
  barcode?: string;
  price: string;
  compareAtPrice: string;
  imageUrl?: string;
  selections: Array<{ option: string; value: string }>;
  stock: number;
  lowStockThreshold: number;
  isActive: boolean;
};

export type EditorState = {
  id?: string;
  name: string;
  slug: string;
  sku: string;
  barcode: string;
  shortDescription: string;
  description: string;
  price: number;
  compareAtPrice: string;
  costPrice: string;
  categoryId: string;
  tags: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  isFeatured: boolean;
  isBestseller: boolean;
  isNew: boolean;
  material: string;
  color: string;
  size: string;
  weight: string;
  dimensions: string;
  careInstructions: string;
  shippingInfo: string;
  seoTitle: string;
  seoDescription: string;
  seoImage: string;
  options: EditorOption[];
  variants: EditorVariant[];
  images: EditorImage[];
};

export const EMPTY_EDITOR: EditorState = {
  name: "",
  slug: "",
  sku: "",
  barcode: "",
  shortDescription: "",
  description: "",
  price: 0,
  compareAtPrice: "",
  costPrice: "",
  categoryId: "",
  tags: "",
  status: "DRAFT",
  isFeatured: false,
  isBestseller: false,
  isNew: false,
  material: "",
  color: "",
  size: "",
  weight: "",
  dimensions: "",
  careInstructions: "",
  shippingInfo: "",
  seoTitle: "",
  seoDescription: "",
  seoImage: "",
  options: [],
  variants: [
    { sku: "", price: "", compareAtPrice: "", selections: [], stock: 0, lowStockThreshold: 3, isActive: true },
  ],
  images: [],
};

function num(value: string, fallback = 0): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function ProductEditor({
  initial,
  categories,
}: {
  initial: EditorState;
  categories: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const { t } = useLocale();
  const [state, setState] = useState<EditorState>(initial);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  function set<K extends keyof EditorState>(key: K, value: EditorState[K]) {
    setState((previous) => ({ ...previous, [key]: value }));
  }

  const optionNames = useMemo(() => state.options.map((option) => option.name).filter(Boolean), [state.options]);

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded: EditorImage[] = [];
      for (const file of Array.from(files).slice(0, 20 - state.images.length)) {
        const form = new FormData();
        form.append("file", file);
        const response = await fetch("/api/admin/upload", { method: "POST", body: form });
        const payload = (await response.json()) as
          | { ok: true; url: string; storageKey: string; width: number; height: number }
          | { ok: false; error: string };
        if (!payload.ok) throw new Error(payload.error);
        uploaded.push({ url: payload.url, storageKey: payload.storageKey, alt: state.name });
      }
      setState((previous) => ({ ...previous, images: [...previous.images, ...uploaded] }));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function moveImage(index: number, direction: -1 | 1) {
    setState((previous) => {
      const images = [...previous.images];
      const target = index + direction;
      if (target < 0 || target >= images.length) return previous;
      const [moved] = images.splice(index, 1);
      if (moved) images.splice(target, 0, moved);
      return { ...previous, images };
    });
  }

  function addOption() {
    setState((previous) => ({ ...previous, options: [...previous.options, { name: "", values: [] }] }));
  }

  function addVariant() {
    setState((previous) => ({
      ...previous,
      variants: [
        ...previous.variants,
        {
          sku: "",
          price: "",
          compareAtPrice: "",
          selections: optionNames.map((option) => ({ option, value: "" })),
          stock: 0,
          lowStockThreshold: 3,
          isActive: true,
        },
      ],
    }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});

    const toInt = (value: string): number | null => (value.trim() === "" ? null : num(value));

    const result = await saveProductAction({
      id: state.id,
      name: state.name,
      slug: state.slug || undefined,
      sku: state.sku || undefined,
      barcode: state.barcode || undefined,
      shortDescription: state.shortDescription || undefined,
      description: state.description,
      price: state.price,
      compareAtPrice: toInt(state.compareAtPrice) ?? undefined,
      costPrice: toInt(state.costPrice) ?? undefined,
      categoryId: state.categoryId || undefined,
      tags: state.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      status: state.status,
      isFeatured: state.isFeatured,
      isBestseller: state.isBestseller,
      isNew: state.isNew,
      soldCount: 0,
      publishedAt: null,
      material: state.material || undefined,
      color: state.color || undefined,
      size: state.size || undefined,
      weight: state.weight.trim() === "" ? null : num(state.weight),
      dimensions: state.dimensions || undefined,
      careInstructions: state.careInstructions || undefined,
      shippingInfo: state.shippingInfo || undefined,
      seoTitle: state.seoTitle || undefined,
      seoDescription: state.seoDescription || undefined,
      seoImage: state.seoImage || undefined,
      options: state.options
        .filter((option) => option.name.trim())
        .map((option, index) => ({
          name: option.name.trim(),
          position: index,
          values: option.values
            .map((entry) => ({
              value: entry.value.trim(),
              hexColor: /^#[0-9a-fA-F]{6}$/.test(entry.hexColor ?? "") ? entry.hexColor : undefined,
            }))
            .filter((entry) => entry.value.length > 0)
            .map((entry, valueIndex) => ({ ...entry, position: valueIndex })),
        })),
      variants: state.variants.map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        barcode: variant.barcode || undefined,
        price: toInt(variant.price) ?? undefined,
        compareAtPrice: toInt(variant.compareAtPrice) ?? undefined,
        imageUrl: variant.imageUrl || undefined,
        selections: variant.selections.filter((selection) => selection.option && selection.value),
        stock: variant.stock,
        lowStockThreshold: variant.lowStockThreshold,
        isActive: variant.isActive,
      })),
      images: state.images.map((image, index) => ({
        id: image.id,
        url: image.url,
        storageKey: image.storageKey,
        alt: image.alt,
        sortOrder: index,
        isPrimary: index === 0,
      })),
    });

    setPending(false);
    if (!result.ok) {
      setError(result.error);
      if ("fields" in result && result.fields) setFieldErrors(result.fields as Record<string, string>);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    router.push("/admin/products");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-4 xl:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        {error && (
          <p className="border border-[#9e342e]/30 bg-red-50 px-4 py-3 text-sm text-[#9e342e]" role="alert">
            {error}
          </p>
        )}

        <section className="border hairline bg-white p-5" aria-label={t.adminEditor.basics}>
          <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.14em]">{t.adminEditor.basics}</h2>
          <div className="space-y-4">
            <Field label={t.adminEditor.productName} required error={fieldErrors.name}>
              <Input value={state.name} onChange={(event) => set("name", event.target.value)} required />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t.adminEditor.slugAuto} error={fieldErrors.slug}>
                <Input value={state.slug} onChange={(event) => set("slug", event.target.value)} placeholder="luna-pearl-necklace" />
              </Field>
              <Field label={t.adminEditor.sku}>
                <Input value={state.sku} onChange={(event) => set("sku", event.target.value)} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t.adminEditor.priceDa} required error={fieldErrors.price}>
                <Input type="number" min={0} value={state.price} onChange={(event) => set("price", num(event.target.value))} required />
              </Field>
              <Field label={t.adminEditor.compareAt}>
                <Input type="number" min={0} value={state.compareAtPrice} onChange={(event) => set("compareAtPrice", event.target.value)} placeholder="—" />
              </Field>
              <Field label={t.adminEditor.costInternal}>
                <Input type="number" min={0} value={state.costPrice} onChange={(event) => set("costPrice", event.target.value)} placeholder="—" />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t.adminEditor.category}>
                <Select value={state.categoryId} onChange={(event) => set("categoryId", event.target.value)}>
                  <option value="">{t.adminEditor.uncategorized}</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t.adminEditor.tags}>
                <Input value={state.tags} onChange={(event) => set("tags", event.target.value)} placeholder="gold, necklace" />
              </Field>
            </div>
            <Field label={t.adminEditor.shortDesc}>
              <Textarea value={state.shortDescription} onChange={(event) => set("shortDescription", event.target.value)} rows={2} maxLength={300} />
            </Field>
            <Field label={t.adminEditor.descHtml} hint="Only headings, lists, bold, links survive — scripts are stripped.">
              <Textarea value={state.description} onChange={(event) => set("description", event.target.value)} rows={8} />
            </Field>
          </div>
        </section>

        <section className="border hairline bg-white p-5" aria-label={t.adminEditor.images}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-medium uppercase tracking-[0.14em]">Images ({state.images.length}/20)</h2>
            <label className="btn btn-ghost min-h-10 cursor-pointer px-4 text-xs">
              {uploading ? "Uploading…" : "Upload"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                multiple
                className="hidden"
                disabled={uploading}
                onChange={(event) => void uploadFiles(event.target.files)}
              />
            </label>
          </div>
          {state.images.length === 0 ? (
            <p className="text-sm text-ink-muted">{t.adminEditor.noImages}</p>
          ) : (
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {state.images.map((image, index) => (
                <li key={image.url} className={cn("relative border hairline bg-cream", index === 0 && "ring-2 ring-gold")}>
                  <div className="relative aspect-square">
                    <Image src={image.url} alt={image.alt || state.name} fill sizes="160px" className="object-cover" />
                  </div>
                  <input
                    value={image.alt ?? ""}
                    onChange={(event) => {
                      const images = [...state.images];
                      images[index] = { ...images[index]!, alt: event.target.value };
                      set("images", images);
                    }}
                    placeholder={t.adminEditor.altText}
                    aria-label={`Alt text for image ${index + 1}`}
                    className="w-full border-t hairline bg-white px-2 py-1 text-xs"
                  />
                  <div className="flex items-center justify-between bg-white px-1 py-1">
                    <span className="px-1 text-[0.6875rem] uppercase tracking-[0.1em] text-ink-muted">
                      {index === 0 ? "Primary" : `#${index + 1}`}
                    </span>
                    <div className="flex">
                      <button type="button" aria-label={t.adminEditor.moveUp} disabled={index === 0} onClick={() => moveImage(index, -1)} className="p-1 disabled:opacity-30">
                        <ArrowUp size={14} />
                      </button>
                      <button type="button" aria-label={t.adminEditor.moveDown} disabled={index === state.images.length - 1} onClick={() => moveImage(index, 1)} className="p-1 disabled:opacity-30">
                        <ArrowDown size={14} />
                      </button>
                      <button
                        type="button"
                        aria-label={t.adminEditor.removeImage}
                        onClick={() => set("images", state.images.filter((_, i) => i !== index))}
                        className="p-1 text-[#9e342e]"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="border hairline bg-white p-5" aria-label={t.adminEditor.options}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-medium uppercase tracking-[0.14em]">{t.adminEditor.options}</h2>
            <button type="button" onClick={addOption} className="btn btn-ghost min-h-10 px-4 text-xs">
              <Plus size={14} /> {t.adminEditor.addOption}
            </button>
          </div>
          {state.options.length === 0 && (
            <p className="text-sm text-ink-muted">{t.adminEditor.noOptions}</p>
          )}
          <div className="space-y-4">
            {state.options.map((option, optionIndex) => (
              <div key={optionIndex} className="border hairline p-3">
                <div className="grid gap-2 sm:grid-cols-[200px_1fr_auto]">
                  <Input
                    value={option.name}
                    onChange={(event) => {
                      const options = [...state.options];
                      const previousName = options[optionIndex]?.name ?? "";
                      options[optionIndex] = { ...options[optionIndex]!, name: event.target.value };
                      setState((prev) => ({
                        ...prev,
                        options,
                        variants: prev.variants.map((variant) => ({
                          ...variant,
                          selections: variant.selections.map((selection) =>
                            selection.option === previousName
                              ? { ...selection, option: event.target.value }
                              : selection,
                          ),
                        })),
                      }));
                    }}
                    placeholder={t.adminEditor.optionName}
                    aria-label={t.adminEditor.optionName}
                  />
                  <p className="self-center text-xs text-ink-muted">
                    {t.adminEditor.valuesHint}
                  </p>
                  <button
                    type="button"
                    aria-label={t.adminEditor.removeOption}
                    onClick={() => set("options", state.options.filter((_, i) => i !== optionIndex))}
                    className="p-2 text-[#9e342e]"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <ul className="mt-2 space-y-2">
                  {option.values.map((entry, valueIndex) => (
                    <li key={valueIndex} className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
                      <Input
                        value={entry.value}
                        onChange={(event) => {
                          const options = [...state.options];
                          const values = [...(options[optionIndex]?.values ?? [])];
                          const previousValue = values[valueIndex]?.value ?? "";
                          values[valueIndex] = { ...values[valueIndex]!, value: event.target.value };
                          options[optionIndex] = { ...options[optionIndex]!, values };
                          const nextName = options[optionIndex]?.name ?? "";
                          setState((prev) => ({
                            ...prev,
                            options,
                            variants: prev.variants.map((variant) => ({
                              ...variant,
                              selections: variant.selections.map((selection) =>
                                selection.option === nextName && selection.value === previousValue
                                  ? { ...selection, value: event.target.value }
                                  : selection,
                              ),
                            })),
                          }));
                        }}
                        placeholder={t.adminEditor.valueEg}
                        aria-label={`${t.adminEditor.optionValue} ${valueIndex + 1}`}
                      />
                      <input
                        type="color"
                        value={/^#[0-9a-fA-F]{6}$/.test(entry.hexColor ?? "") ? entry.hexColor : "#b08d57"}
                        onChange={(event) => {
                          const options = [...state.options];
                          const values = [...(options[optionIndex]?.values ?? [])];
                          values[valueIndex] = { ...values[valueIndex]!, hexColor: event.target.value };
                          options[optionIndex] = { ...options[optionIndex]!, values };
                          set("options", options);
                        }}
                        aria-label={`${t.adminEditor.swatch} ${entry.value || `${valueIndex + 1}`}`}
                        title={t.adminEditor.swatch}
                        className="h-10 w-12 cursor-pointer border hairline bg-white p-1"
                      />
                      <button
                        type="button"
                        aria-label={t.adminEditor.removeValue}
                        onClick={() => {
                          const options = [...state.options];
                          options[optionIndex] = {
                            ...options[optionIndex]!,
                            values: (options[optionIndex]?.values ?? []).filter((_, i) => i !== valueIndex),
                          };
                          set("options", options);
                        }}
                        className="p-2 text-[#9e342e]"
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => {
                    const options = [...state.options];
                    options[optionIndex] = {
                      ...options[optionIndex]!,
                      values: [...(options[optionIndex]?.values ?? []), { value: "" }],
                    };
                    set("options", options);
                  }}
                  className="mt-2 text-xs uppercase tracking-[0.12em] underline underline-offset-2"
                >
                  + Add value
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="border hairline bg-white p-5" aria-label="Variants">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-medium uppercase tracking-[0.14em]">{t.adminEditor.variantsStock}</h2>
            <button type="button" onClick={addVariant} className="btn btn-ghost min-h-10 px-4 text-xs">
              <Plus size={14} /> {t.adminEditor.addVariant}
            </button>
          </div>
          <div className="space-y-3">
            {state.variants.map((variant, variantIndex) => (
              <div key={variantIndex} className="grid gap-2 border hairline p-3 lg:grid-cols-6">
                <div className="lg:col-span-2">
                  <label className="field-label">SKU *</label>
                  <Input
                    value={variant.sku}
                    onChange={(event) => {
                      const variants = [...state.variants];
                      variants[variantIndex] = { ...variants[variantIndex]!, sku: event.target.value };
                      set("variants", variants);
                    }}
                    required
                  />
                </div>
                <div>
                  <label className="field-label">{t.adminEditor.priceOverride}</label>
                  <Input
                    type="number"
                    min={0}
                    value={variant.price}
                    placeholder={t.adminEditor.inherit}
                    onChange={(event) => {
                      const variants = [...state.variants];
                      variants[variantIndex] = { ...variants[variantIndex]!, price: event.target.value };
                      set("variants", variants);
                    }}
                  />
                </div>
                <div>
                  <label className="field-label">{t.adminEditor.stock}</label>
                  <Input
                    type="number"
                    min={0}
                    value={variant.stock}
                    onChange={(event) => {
                      const variants = [...state.variants];
                      variants[variantIndex] = { ...variants[variantIndex]!, stock: num(event.target.value) };
                      set("variants", variants);
                    }}
                  />
                </div>
                <div>
                  <label className="field-label">{t.adminEditor.lowStockAt}</label>
                  <Input
                    type="number"
                    min={0}
                    value={variant.lowStockThreshold}
                    onChange={(event) => {
                      const variants = [...state.variants];
                      variants[variantIndex] = { ...variants[variantIndex]!, lowStockThreshold: num(event.target.value) };
                      set("variants", variants);
                    }}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <label className="flex items-center gap-2 pb-3 text-sm">
                    <input
                      type="checkbox"
                      checked={variant.isActive}
                      onChange={(event) => {
                        const variants = [...state.variants];
                        variants[variantIndex] = { ...variants[variantIndex]!, isActive: event.target.checked };
                        set("variants", variants);
                      }}
                      className="h-4 w-4 accent-[#1c1a17]"
                    />
                    Active
                  </label>
                  <button
                    type="button"
                    aria-label={t.adminEditor.removeVariant}
                    onClick={() => set("variants", state.variants.filter((_, i) => i !== variantIndex))}
                    className="mb-2.5 p-1 text-[#9e342e]"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                {optionNames.length > 0 && (
                  <div className="grid gap-2 sm:grid-cols-2 lg:col-span-6">
                    {optionNames.map((optionName) => {
                      const option = state.options.find((entry) => entry.name === optionName);
                      const current = variant.selections.find((selection) => selection.option === optionName)?.value ?? "";
                      return (
                        <div key={optionName}>
                          <label className="field-label">{optionName}</label>
                          <Select
                            value={current}
                            onChange={(event) => {
                              const variants = [...state.variants];
                              const selections = [...(variants[variantIndex]?.selections ?? [])];
                              const existing = selections.findIndex((selection) => selection.option === optionName);
                              const next = { option: optionName, value: event.target.value };
                              if (existing >= 0) selections[existing] = next;
                              else selections.push(next);
                              variants[variantIndex] = { ...variants[variantIndex]!, selections };
                              set("variants", variants);
                            }}
                          >
                            <option value="">—</option>
                            {(option?.values ?? []).map((entry, entryIndex) => (
                              <option key={`${entry.value}-${entryIndex}`} value={entry.value}>
                                {entry.value}
                              </option>
                            ))}
                          </Select>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="border hairline bg-white p-5" aria-label={t.adminEditor.attributes}>
          <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.14em]">{t.adminEditor.attributes}</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t.adminEditor.material}>
              <Input value={state.material} onChange={(event) => set("material", event.target.value)} />
            </Field>
            <Field label={t.adminEditor.color}>
              <Input value={state.color} onChange={(event) => set("color", event.target.value)} />
            </Field>
            <Field label={t.adminEditor.size}>
              <Input value={state.size} onChange={(event) => set("size", event.target.value)} />
            </Field>
            <Field label={t.adminEditor.weight}>
              <Input type="number" min={0} value={state.weight} onChange={(event) => set("weight", event.target.value)} />
            </Field>
            <Field label={t.adminEditor.dimensions}>
              <Input value={state.dimensions} onChange={(event) => set("dimensions", event.target.value)} />
            </Field>
            <Field label={t.adminEditor.barcode}>
              <Input value={state.barcode} onChange={(event) => set("barcode", event.target.value)} />
            </Field>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label={t.adminEditor.care}>
              <Textarea value={state.careInstructions} onChange={(event) => set("careInstructions", event.target.value)} rows={3} />
            </Field>
            <Field label={t.adminEditor.shippingInfo}>
              <Textarea value={state.shippingInfo} onChange={(event) => set("shippingInfo", event.target.value)} rows={3} />
            </Field>
          </div>
        </section>

        <section className="border hairline bg-white p-5" aria-label={t.adminEditor.seo}>
          <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.14em]">{t.adminEditor.seo}</h2>
          <div className="space-y-4">
            <Field label={t.adminEditor.seoTitle}>
              <Input value={state.seoTitle} onChange={(event) => set("seoTitle", event.target.value)} maxLength={160} />
            </Field>
            <Field label={t.adminEditor.seoDesc}>
              <Textarea value={state.seoDescription} onChange={(event) => set("seoDescription", event.target.value)} rows={2} maxLength={320} />
            </Field>
            <Field label={t.adminEditor.socialImage}>
              <Input value={state.seoImage} onChange={(event) => set("seoImage", event.target.value)} placeholder="https://…" />
            </Field>
          </div>
        </section>
      </div>

      <aside className="xl:sticky xl:top-20 xl:self-start">
        <div className="border hairline bg-white p-5">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.14em]">{t.adminEditor.publish}</h2>
          <Field label={t.adminEditor.status}>
            <Select value={state.status} onChange={(event) => set("status", event.target.value as EditorState["status"])}>
              <option value="DRAFT">{t.adminEditor.draft}</option>
              <option value="ACTIVE">{t.adminEditor.activeSt}</option>
              <option value="ARCHIVED">{t.adminEditor.archived}</option>
            </Select>
          </Field>
          <div className="mt-3 space-y-2 text-sm">
            {(
              [
                ["isFeatured", t.adminEditor.featuredHome],
                ["isBestseller", t.adminEditor.markBest],
                ["isNew", t.adminEditor.markNew],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={state[key]} onChange={(event) => set(key, event.target.checked)} className="h-4 w-4 accent-[#1c1a17]" />
                {label}
              </label>
            ))}
          </div>
          <Button type="submit" disabled={pending} className="mt-5 w-full">
            {pending ? t.adminEditor.saving : state.id ? t.adminEditor.saveChanges : t.adminEditor.createProduct}
          </Button>
        </div>
      </aside>
    </form>
  );
}
