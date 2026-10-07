import { redirect } from "next/navigation";
import { getCustomerSession } from "@/lib/auth/session";
import { logoutAction } from "@/server/actions/engagement";
import { getDictionary } from "@/lib/i18n/server";
import { AccountTabs } from "./account-tabs";

export const dynamic = "force-dynamic";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await getCustomerSession();
  if (!session) redirect("/login?next=/account");
  const t = await getDictionary();

  return (
    <div className="container-luxe py-10 md:py-14">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">{t.account.eyebrow}</p>
          <h1 className="font-display text-4xl font-medium">
            {t.account.hello.replace("{name}", session.customer.firstName)}
          </h1>
        </div>
        <form action={logoutAction}>
          <button type="submit" className="text-xs uppercase tracking-[0.16em] underline underline-offset-4">
            {t.account.signOut}
          </button>
        </form>
      </div>
      <AccountTabs />
      <div className="mt-8">{children}</div>
    </div>
  );
}
