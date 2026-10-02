import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { Prisma, PrismaClient } from "@prisma/client";
import { generateToken } from "@/lib/auth/tokens";
import { CART_COOKIE } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { computeAvailable } from "@/server/inventory";

const CART_TTL_DAYS = 60;

export type CartLine = {
  id: string;
  variantId: string;
  productId: string;
  productSlug: string;
  productName: string;
  variantLabel: string | null;
  imageUrl: string | null;
  unitPrice: number;
  compareAtPrice: number | null;
  quantity: number;
  lineTotal: number;
  available: number;
  optionValueIds: string[];
};

export type CartSummary = {
  cartId: string | null;
  items: CartLine[];
  subtotal: number;
  count: number;
};

const cartItemInclude = Prisma.validator<Prisma.CartItemInclude>()({
  variant: {
    include: {
      inventory: true,
      optionValues: true,
      product: {
        select: {
          id: true,
          slug: true,
          name: true,
          price: true,
          compareAtPrice: true,
          status: true,
          images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1 },
        },
      },
    },
  },
});

type CartItemWithRelations = Prisma.CartItemGetPayload<{ include: typeof cartItemInclude }>;

function mapLine(item: CartItemWithRelations): CartLine {
  const variant = item.variant;
  const product = variant.product;
  const unitPrice = variant.price ?? product.price;
  const image = variant.imageUrl ?? product.images[0]?.url ?? null;
  return {
    id: item.id,
    variantId: variant.id,
    productId: product.id,
    productSlug: product.slug,
    productName: product.name,
    variantLabel: variant.optionLabel,
    imageUrl: image,
    unitPrice,
    compareAtPrice: variant.compareAtPrice ?? product.compareAtPrice,
    quantity: item.quantity,
    lineTotal: unitPrice * item.quantity,
    available: computeAvailable(variant.inventory?.stock ?? 0, variant.inventory?.reserved ?? 0),
    optionValueIds: variant.optionValues.map((entry) => entry.optionValueId),
  };
}

async function readCartToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(CART_COOKIE)?.value ?? null;
}

/** Read-only summary for rendering — never sets cookies. */
export async function getCartSummary(): Promise<CartSummary> {
  const token = await readCartToken();
  if (!token) return { cartId: null, items: [], subtotal: 0, count: 0 };

  try {
    const cart = await prisma.cart.findUnique({
      where: { token },
      include: { items: { include: cartItemInclude, orderBy: { createdAt: "asc" } } },
    });
    if (!cart || cart.status !== "ACTIVE") {
      return { cartId: null, items: [], subtotal: 0, count: 0 };
    }

    const items = cart.items
      .filter((item) => item.variant.product.status === "ACTIVE")
      .map(mapLine);
    const subtotal = items.reduce((sum, line) => sum + line.lineTotal, 0);
    const count = items.reduce((sum, line) => sum + line.quantity, 0);

    return { cartId: cart.id, items, subtotal, count };
  } catch (error) {
    console.error("[cart] summary failed", error);
    return { cartId: null, items: [], subtotal: 0, count: 0 };
  }
}

export async function getCartCount(): Promise<number> {
  const summary = await getCartSummary();
  return summary.count;
}

async function getOrCreateCart(): Promise<{ id: string; token: string }> {
  const store = await cookies();
  const token = store.get(CART_COOKIE)?.value;

  if (token) {
    const existing = await prisma.cart.findUnique({ where: { token } });
    if (existing && existing.status === "ACTIVE") {
      return { id: existing.id, token: existing.token };
    }
  }

  const newToken = generateToken();
  const cart = await prisma.cart.create({
    data: {
      token: newToken,
      expiresAt: new Date(Date.now() + CART_TTL_DAYS * 86_400_000),
    },
  });

  store.set(CART_COOKIE, newToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CART_TTL_DAYS * 86_400,
  });

  return { id: cart.id, token: newToken };
}

export async function addToCart(
  variantId: string,
  quantity = 1,
): Promise<{ added: number; count: number }> {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
    throw new AppError("INVALID_QUANTITY", "Please choose a valid quantity.");
  }

  const variant = await prisma.productVariant.findFirst({
    where: { id: variantId, isActive: true },
    include: { product: { select: { status: true } }, inventory: true },
  });

  if (!variant || variant.product.status !== "ACTIVE") {
    throw new AppError("PRODUCT_UNAVAILABLE", "This item is no longer available.", 404);
  }

  const available = computeAvailable(
    variant.inventory?.stock ?? 0,
    variant.inventory?.reserved ?? 0,
  );
  if (available <= 0) {
    throw new AppError("OUT_OF_STOCK", "Sorry, this item is out of stock.", 409);
  }

  const cart = await getOrCreateCart();

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.cartItem.findUnique({
      where: { cartId_variantId: { cartId: cart.id, variantId } },
    });

    const desired = Math.min(available, (existing?.quantity ?? 0) + quantity);

    if (existing) {
      await tx.cartItem.update({ where: { id: existing.id }, data: { quantity: desired } });
      return desired - existing.quantity;
    }
    await tx.cartItem.create({ data: { cartId: cart.id, variantId, quantity: desired } });
    return desired;
  });

  const summary = await getCartSummary();
  return { added: result, count: summary.count };
}

export async function setCartItemQuantity(itemId: string, quantity: number): Promise<void> {
  const token = await readCartToken();
  if (!token) throw new AppError("CART_NOT_FOUND", "Your bag is empty.", 404);

  const cart = await prisma.cart.findUnique({ where: { token } });
  if (!cart) throw new AppError("CART_NOT_FOUND", "Your bag is empty.", 404);

  const item = await prisma.cartItem.findFirst({
    where: { id: itemId, cartId: cart.id },
    include: { variant: { include: { inventory: true } } },
  });
  if (!item) throw new AppError("CART_ITEM_NOT_FOUND", "This item is no longer in your bag.", 404);

  if (quantity <= 0) {
    await prisma.cartItem.delete({ where: { id: item.id } });
    return;
  }

  const available = computeAvailable(
    item.variant.inventory?.stock ?? 0,
    item.variant.inventory?.reserved ?? 0,
  );
  if (available <= 0) {
    await prisma.cartItem.delete({ where: { id: item.id } });
    throw new AppError("OUT_OF_STOCK", "This item is out of stock and was removed.", 409);
  }

  const capped = Math.min(quantity, available, 20);
  await prisma.cartItem.update({ where: { id: item.id }, data: { quantity: capped } });
}

export async function removeCartItem(itemId: string): Promise<void> {
  const token = await readCartToken();
  if (!token) return;
  const cart = await prisma.cart.findUnique({ where: { token } });
  if (!cart) return;
  await prisma.cartItem.deleteMany({ where: { id: itemId, cartId: cart.id } });
}

export async function clearCart(): Promise<void> {
  const token = await readCartToken();
  if (!token) return;
  const cart = await prisma.cart.findUnique({ where: { token } });
  if (!cart) return;
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
}

/** Links an anonymous cart to a customer after login/registration. */
export async function attachCartToCustomer(customerId: string): Promise<void> {
  const token = await readCartToken();
  if (!token) return;
  await prisma.cart.updateMany({
    where: { token, customerId: null },
    data: { customerId },
  });
}

/** Full cart lines for the checkout transaction (fresh prices from the DB). */
export async function getCartForCheckout(
  db: PrismaClient | Prisma.TransactionClient = prisma,
): Promise<{
  cartId: string;
  lines: CartLine[];
  subtotal: number;
}> {
  const token = await readCartToken();
  if (!token) throw new AppError("CART_EMPTY", "Your bag is empty.", 400);

  const cart = await db.cart.findUnique({
    where: { token, status: "ACTIVE" },
    include: { items: { include: cartItemInclude } },
  });

  if (!cart || cart.items.length === 0) {
    throw new AppError("CART_EMPTY", "Your bag is empty.", 400);
  }

  const lines = cart.items.map(mapLine);
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  return { cartId: cart.id, lines, subtotal };
}

export async function getCartCustomerId(
  db: PrismaClient | Prisma.TransactionClient = prisma,
): Promise<string | null> {
  const token = await readCartToken();
  if (!token) return null;
  const cart = await db.cart.findUnique({
    where: { token },
    select: { customerId: true },
  });
  return cart?.customerId ?? null;
}
