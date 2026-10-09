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
import { useLocale } from "@/lib/i18n/provider";

export function SecurityManager({ twoFactorEnabled }: { twoFactorEnabled: boolean }) {
  const { t } = useLocale();
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
      message: result.ok ? t.adminSecurity.enabledNow : result.error,
    });
    if (result.ok) {
      setQr(null);
      window.location.reload();
    }
  }

  async function disable() {
    if (!window.confirm(t.adminSecurity.disableConfirm)) return;
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
        <h2 className="font-display text-2xl">{t.adminSecurity.mfaTitle}</h2>
        <p className="mt-2 text-sm text-ink-soft">
          {t.adminSecurity.status}:{" "}
          <span className="font-medium">
            {twoFactorEnabled ? t.adminStaff.on : t.adminStaff.off}
          </span>
        </p>
        {twoFactorEnabled ? (
          <div className="mt-4 space-y-3">
            <Field label={t.adminSecurity.currentPassword}>
              <Input
                type="password"
                value={mfaPassword}
                onChange={(event) => setMfaPassword(event.target.value)}
              />
            </Field>
            <Field label={t.adminSecurity.authenticatorCode}>
              <Input
                inputMode="numeric"
                maxLength={6}
                value={disableToken}
                onChange={(event) => setDisableToken(event.target.value)}
              />
            </Field>
            <Button variant="outline" size="sm" onClick={() => void disable()}>
              {t.adminSecurity.disable2fa}
            </Button>
          </div>
        ) : qr ? (
          <form onSubmit={confirm} className="mt-4 space-y-3">
            <p className="text-sm text-ink-soft">{t.adminSecurity.scanHow}</p>
            <Image src={qr} alt={t.adminSecurity.qrAlt} width={220} height={220} unoptimized />
            {manualKey && (
              <p className="break-all font-mono text-xs text-ink-muted">
                {t.adminSecurity.manualKey} {manualKey}
              </p>
            )}
            <Field label={t.adminSecurity.code6} required>
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
              {pending ? t.adminSecurity.verifying : t.adminSecurity.verifyEnable}
            </Button>
          </form>
        ) : (
          <div className="mt-4 space-y-3">
            <Field label={t.adminSecurity.currentPassword}>
              <Input
                type="password"
                value={mfaPassword}
                onChange={(event) => setMfaPassword(event.target.value)}
              />
            </Field>
            <Button size="sm" disabled={pending} onClick={() => void start()}>
              {pending ? "…" : t.adminSecurity.setup2fa}
            </Button>
          </div>
        )}
      </div>

      <form onSubmit={changePassword} className="space-y-4 border hairline bg-white p-5">
        <h2 className="font-display text-2xl">{t.adminSecurity.changePassword}</h2>
        <Field label={t.adminSecurity.currentPassword}>
          <Input
            type="password"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
            autoComplete="current-password"
            required
          />
        </Field>
        <Field label={t.adminSecurity.newPassword} hint={t.adminSecurity.passwordHint}>
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
          {t.adminSecurity.updatePassword}
        </Button>
      </form>
    </div>
  );
}
