import { redirect } from "next/navigation";
import { getCustomerSession } from "@/lib/auth/session";
import { logoutAction } from "@/server/actions/engagement";
import { AccountTabs } from "./account-tabs";

export const dynamic = "force-dynamic";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await getCustomerSession();
  if (!session) redirect("/login?next=/account");

  return (
    <div className="container-luxe py-10 md:py-14">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">My account</p>
          <h1 className="font-display text-4xl font-medium">
            Hello, {session.customer.firstName}
          </h1>
        </div>
        <form action={logoutAction}>
          <button type="submit" className="text-xs uppercase tracking-[0.16em] underline underline-offset-4">
            Sign out
          </button>
        </form>
      </div>
      <AccountTabs />
      <div className="mt-8">{children}</div>
    </div>
  );
}
