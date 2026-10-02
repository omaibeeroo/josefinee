import { getCustomerAddresses } from "@/server/actions/account";
import { getActiveWilayas } from "@/server/delivery";
import { AddressesManager } from "./addresses-manager";

export default async function AccountAddressesPage() {
  const [addresses, wilayas] = await Promise.all([getCustomerAddresses(), getActiveWilayas()]);
  return <AddressesManager initial={addresses} wilayas={wilayas} />;
}
