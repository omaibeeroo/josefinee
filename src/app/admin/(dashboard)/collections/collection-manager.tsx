"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { deleteCollectionAction, saveCollectionAction } from "@/server/actions/admin-catalog";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";

export type CollectionRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  type: "MANUAL" | "NEW_IN" | "BEST_SELLERS" | "SALE";
  sortOrder: number;
  isActive: boolean;
  isFeatured: boolean;
  showInNav: boolean;
  productIds: string[];
  _count: { products: number };
};

export function CollectionManager({
  collections,
  products,
}: {
  collections: CollectionRow[];
  products: Array<{ id: string; name: string; slug: string }>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<(Partial<CollectionRow> & { id?: string; productIds?: string[] }) | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const visibleProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products.slice(0, 60);
    return products.filter((product) => product.name.toLowerCase().includes(term)).slice(0, 60);
  }, [products, search]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setPending(true);
    setError(null);
    const result = await saveCollectionAction({
      id: editing.id,
      name: editing.name ?? "",
      slug: editing.slug || undefined,
      description: editing.description ?? undefined,
      image: editing.image ?? undefined,
      type: editing.type ?? "MANUAL",
      sortOrder: editing.sortOrder ?? 0,
      isActive: editing.isActive ?? true,
      isFeatured: editing.isFeatured ?? false,
      showInNav: editing.showInNav ?? true,
      productIds: editing.productIds ?? [],
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEditing(null);
    router.refresh();
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this collection? Products themselves are kept.")) return;
    await deleteCollectionAction(id);
    router.refresh();
  }

  function toggleProduct(productId: string) {
    const current = editing?.productIds ?? [];
    const next = current.includes(productId)
      ? current.filter((id) => id !== productId)
      : [...current, productId];
    setEditing((previous) => (previous ? { ...previous, productIds: next } : previous));
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button
          size="sm"
          onClick={() =>
            setEditing({
              name: "",
              slug: "",
              description: "",
              image: "",
              type: "MANUAL",
              sortOrder: 0,
              isActive: true,
              isFeatured: false,
              showInNav: true,
              productIds: [],
            })
          }
        >
          New collection
        </Button>
      </div>
      {error && (
        <p className="mb-3 border border-[#9e342e]/30 bg-red-50 px-4 py-2 text-sm text-[#9e342e]" role="alert">
          {error}
        </p>
      )}

      <div className="overflow-x-auto border hairline bg-white">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead>
            <tr className="border-b hairline text-xs uppercase tracking-[0.1em] text-ink-muted">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Products</th>
              <th className="px-4 py-3">Nav</th>
              <th className="px-4 py-3">Active</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {collections.map((collection) => (
              <tr key={collection.id}>
                <td className="px-4 py-3 font-medium">
                  {collection.name}
                  <span className="block text-xs font-normal text-ink-muted">/{collection.slug}</span>
                </td>
                <td className="px-4 py-3 text-xs">{collection.type}</td>
                <td className="px-4 py-3 tabular-nums">{collection._count.products}</td>
                <td className="px-4 py-3">{collection.showInNav ? "Yes" : "No"}</td>
                <td className="px-4 py-3">{collection.isActive ? "Yes" : "No"}</td>
                <td className="px-4 py-3 text-right text-xs">
                  <button type="button" onClick={() => { setError(null); setEditing({ ...collection }); }} className="underline underline-offset-2">
                    Edit
                  </button>
                  <button type="button" onClick={() => void remove(collection.id)} className="ml-3 text-[#9e342e] underline underline-offset-2">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <form onSubmit={submit} className="mt-6 space-y-4 border hairline bg-white p-5">
          <h2 className="font-display text-2xl">{editing.id ? "Edit collection" : "New collection"}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" required>
              <Input value={editing.name ?? ""} onChange={(event) => setEditing({ ...editing, name: event.target.value })} required />
            </Field>
            <Field label="Slug (auto if empty)">
              <Input value={editing.slug ?? ""} onChange={(event) => setEditing({ ...editing, slug: event.target.value })} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Type" hint="Auto collections ignore manual product selection">
              <Select value={editing.type ?? "MANUAL"} onChange={(event) => setEditing({ ...editing, type: event.target.value as CollectionRow["type"] })}>
                <option value="MANUAL">Manual</option>
                <option value="NEW_IN">New in (auto)</option>
                <option value="BEST_SELLERS">Best sellers (auto)</option>
                <option value="SALE">Sale (auto)</option>
              </Select>
            </Field>
            <Field label="Sort order">
              <Input type="number" min={0} value={editing.sortOrder ?? 0} onChange={(event) => setEditing({ ...editing, sortOrder: Number(event.target.value) || 0 })} />
            </Field>
            <Field label="Image URL">
              <Input value={editing.image ?? ""} onChange={(event) => setEditing({ ...editing, image: event.target.value })} placeholder="https://…" />
            </Field>
          </div>
          <Field label="Description">
            <Textarea value={editing.description ?? ""} onChange={(event) => setEditing({ ...editing, description: event.target.value })} rows={2} />
          </Field>
          <div className="flex flex-wrap gap-4 text-sm">
            {(
              [
                ["isActive", "Active"],
                ["isFeatured", "Featured on homepage"],
                ["showInNav", "Show in navigation"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(editing[key])}
                  onChange={(event) => setEditing({ ...editing, [key]: event.target.checked })}
                  className="h-4 w-4 accent-[#1c1a17]"
                />
                {label}
              </label>
            ))}
          </div>

          {editing.type === "MANUAL" && (
            <div>
              <Field label={`Products (${(editing.productIds ?? []).length} selected)`}>
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products…" />
              </Field>
              <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto border hairline p-2">
                {visibleProducts.map((product) => (
                  <li key={product.id}>
                    <label className="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-sm hover:bg-cream">
                      <input
                        type="checkbox"
                        checked={(editing.productIds ?? []).includes(product.id)}
                        onChange={() => toggleProduct(product.id)}
                        className="h-4 w-4 accent-[#1c1a17]"
                      />
                      {product.name}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={pending} size="sm">
              {pending ? "Saving…" : "Save collection"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
