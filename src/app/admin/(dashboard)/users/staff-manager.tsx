"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createUserAction, resetUserPasswordAction, setUserStatusAction } from "@/server/actions/admin-auth";
import { ROLES } from "@/lib/auth/permissions";
import { Button, Field, Input, Select } from "@/components/ui";

export type StaffRow = {
  id: string;
  email: string;
  name: string;
  status: "ACTIVE" | "DISABLED" | "LOCKED";
  role: { name: string; label: string };
  twoFactorEnabled: boolean;
  lastLoginAt: Date | null;
  mustChangePassword: boolean;
  createdAt: Date;
};

export function StaffManager({ users }: { users: StaffRow[] }) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", roleName: "ORDER_MANAGER", password: "" });
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function create(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await createUserAction({ ...form, roleName: form.roleName as StaffRow["role"]["name"] as never });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setShowCreate(false);
    setForm({ email: "", name: "", roleName: "ORDER_MANAGER", password: "" });
    router.refresh();
  }

  async function reset() {
    if (!resetFor) return;
    setPending(true);
    const result = await resetUserPasswordAction(resetFor, newPassword);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setResetFor(null);
    setNewPassword("");
    router.refresh();
  }

  async function toggleStatus(user: StaffRow) {
    const next = user.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    const result = await setUserStatusAction(user.id, next);
    if (!result.ok) setError(result.error);
    else router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
          New staff account
        </Button>
      </div>
      {error && (
        <p className="mb-3 border border-[#9e342e]/30 bg-red-50 px-4 py-2 text-sm text-[#9e342e]" role="alert">
          {error}
        </p>
      )}
      {showCreate && (
        <form onSubmit={create} className="mb-4 grid gap-3 border hairline bg-white p-5 sm:grid-cols-2">
          <Field label="Name" required>
            <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          </Field>
          <Field label="Email" required>
            <Input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
          </Field>
          <Field label="Role">
            <Select value={form.roleName} onChange={(event) => setForm({ ...form, roleName: event.target.value })}>
              {ROLES.map((role) => (
                <option key={role.name} value={role.name}>
                  {role.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Temporary password" hint="10+ chars, mixed case, number. They must change it on first login.">
            <Input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required autoComplete="new-password" />
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending} size="sm">
              {pending ? "Creating…" : "Create account"}
            </Button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto border hairline bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b hairline text-xs uppercase tracking-[0.1em] text-ink-muted">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">2FA</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-4 py-3 font-medium">
                  {user.name}
                  <span className="block text-xs font-normal text-ink-muted">{user.email}</span>
                </td>
                <td className="px-4 py-3 text-xs">{user.role.label}</td>
                <td className="px-4 py-3 text-xs">{user.twoFactorEnabled ? "On" : "Off"}</td>
                <td className="px-4 py-3 text-xs uppercase tracking-[0.1em]">{user.status}</td>
                <td className="px-4 py-3 text-right text-xs">
                  <button type="button" onClick={() => setResetFor(user.id)} className="underline underline-offset-2">
                    Reset password
                  </button>
                  <button type="button" onClick={() => void toggleStatus(user)} className="ml-3 underline underline-offset-2">
                    {user.status === "ACTIVE" ? "Disable" : "Enable"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {resetFor && (
        <div className="mt-4 flex max-w-md items-end gap-2 border hairline bg-white p-4">
          <div className="flex-1">
            <Field label="New temporary password">
              <Input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" />
            </Field>
          </div>
          <Button size="sm" disabled={pending} onClick={() => void reset()}>
            Apply
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setResetFor(null)}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
