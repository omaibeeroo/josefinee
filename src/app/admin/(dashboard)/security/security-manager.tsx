"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import {
  adminChangePasswordAction,
  confirm2faSetupAction,
  disable2faAction,
  start2faSetupAction,
} from "@/server/actions/admin-auth";
import { Button, Field, Input } from "@/components/ui";

export function SecurityManager({ twoFactorEnabled }: { twoFactorEnabled: boolean }) {
  const [qr, setQr] = useState<string | null>(null);
  const [manualKey, setManualKey] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [state, setState] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [mfaPassword, setMfaPassword] = useState("");
  const [disableToken, setDisableToken] = useState("");

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [passwordState, setPasswordState] = useState<{ ok: boolean; message: string } | null>(null);

  async function start() {
    setPending(true);
    const result = await start2faSetupAction({ currentPassword: mfaPassword });
    setPending(false);
    if (result.ok) {
      setQr(result.qr);
      setManualKey(result.secret);
    }
  }

  async function confirm(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    const result = await confirm2faSetupAction(token);
    setPending(false);
    setState({
      ok: result.ok,
      message: result.ok ? "Two-factor authentication is now on." : result.error,
    });
    if (result.ok) {
      setQr(null);
      window.location.reload();
    }
  }

  async function disable() {
    if (!window.confirm("Turn off two-factor authentication? This weakens your account security."))
      return;
    const result = await disable2faAction({ currentPassword: mfaPassword, token: disableToken });
    if (!result.ok) {
      setState({ ok: false, message: result.error });
      return;
    }
    window.location.reload();
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    const result = await adminChangePasswordAction({ current, next });
    setPasswordState({ ok: result.ok, message: result.ok ? result.message : result.error });
    if (result.ok) {
      setCurrent("");
      setNext("");
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="border hairline bg-white p-5">
        <h2 className="font-display text-2xl">Two-factor authentication</h2>
        <p className="mt-2 text-sm text-ink-soft">
          Status: <span className="font-medium">{twoFactorEnabled ? "Enabled" : "Disabled"}</span>
        </p>
        {twoFactorEnabled ? (
          <div className="mt-4 space-y-3">
            <Field label="Current password">
              <Input
                type="password"
                value={mfaPassword}
                onChange={(event) => setMfaPassword(event.target.value)}
              />
            </Field>
            <Field label="Current authenticator code">
              <Input
                inputMode="numeric"
                maxLength={6}
                value={disableToken}
                onChange={(event) => setDisableToken(event.target.value)}
              />
            </Field>
            <Button variant="outline" size="sm" onClick={() => void disable()}>
              Disable 2FA
            </Button>
          </div>
        ) : qr ? (
          <form onSubmit={confirm} className="mt-4 space-y-3">
            <p className="text-sm text-ink-soft">
              Scan this code with your authenticator app (Google Authenticator, 1Password, …), then
              enter the 6-digit code.
            </p>
            <Image src={qr} alt="Authenticator QR code" width={220} height={220} />
            {manualKey && (
              <p className="break-all font-mono text-xs text-ink-muted">Manual key: {manualKey}</p>
            )}
            <Field label="6-digit code" required>
              <Input
                value={token}
                onChange={(event) => setToken(event.target.value)}
                inputMode="numeric"
                maxLength={6}
                required
              />
            </Field>
            {state && (
              <p className={`text-sm ${state.ok ? "text-ink-soft" : "text-sale"}`} role="status">
                {state.message}
              </p>
            )}
            <Button type="submit" disabled={pending} size="sm">
              {pending ? "Verifying…" : "Verify & enable"}
            </Button>
          </form>
        ) : (
          <div className="mt-4 space-y-3">
            <Field label="Current password">
              <Input
                type="password"
                value={mfaPassword}
                onChange={(event) => setMfaPassword(event.target.value)}
              />
            </Field>
            <Button size="sm" disabled={pending} onClick={() => void start()}>
              {pending ? "…" : "Set up 2FA"}
            </Button>
          </div>
        )}
      </div>

      <form onSubmit={changePassword} className="space-y-4 border hairline bg-white p-5">
        <h2 className="font-display text-2xl">Change password</h2>
        <Field label="Current password">
          <Input
            type="password"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
            autoComplete="current-password"
            required
          />
        </Field>
        <Field label="New password" hint="10+ characters, upper & lower case, a number">
          <Input
            type="password"
            value={next}
            onChange={(event) => setNext(event.target.value)}
            autoComplete="new-password"
            required
          />
        </Field>
        {passwordState && (
          <p
            className={`text-sm ${passwordState.ok ? "text-ink-soft" : "text-sale"}`}
            role="status"
          >
            {passwordState.message}
          </p>
        )}
        <Button type="submit" size="sm">
          Update password
        </Button>
      </form>
    </div>
  );
}
