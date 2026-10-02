import { getWishlistItems } from "@/server/actions/account";
import { WishlistList } from "./wishlist-list";

export default async function AccountWishlistPage() {
  const items = await getWishlistItems();
  return <WishlistList initial={items} />;
}
