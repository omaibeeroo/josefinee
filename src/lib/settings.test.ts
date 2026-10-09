import { describe, expect, it } from "vitest";
import { isAnnouncementVisible, mergeSection } from "@/lib/settings";

describe("isAnnouncementVisible", () => {
  const base = { text: "Promo", href: "/shop", isActive: true, startsAt: null, endsAt: null };
  const now = new Date("2026-10-09T12:00:00Z");

  it("shows an active unbounded announcement", () => {
    expect(isAnnouncementVisible(base, now)).toBe(true);
  });

  it("hides inactive announcements", () => {
    expect(isAnnouncementVisible({ ...base, isActive: false }, now)).toBe(false);
  });

  it("respects the scheduling window", () => {
    expect(
      isAnnouncementVisible({ ...base, startsAt: "2026-10-10T00:00:00Z" }, now),
    ).toBe(false);
    expect(isAnnouncementVisible({ ...base, endsAt: "2026-10-01T00:00:00Z" }, now)).toBe(
      false,
    );
    expect(
      isAnnouncementVisible(
        { ...base, startsAt: "2026-10-01T00:00:00Z", endsAt: "2026-10-31T00:00:00Z" },
        now,
      ),
    ).toBe(true);
  });
});

describe("mergeSection display clamps", () => {
  it("clamps carousel counts, category count and page size into bounds", () => {
    const home = mergeSection("homepage", {
      display: { featuredCount: 99, bestSellersCount: 0, newInCount: 8, categoryCount: -3 },
    });
    expect(home.display).toEqual({
      featuredCount: 24,
      bestSellersCount: 2,
      newInCount: 8,
      categoryCount: 2,
    });
    const commerce = mergeSection("commerce", { catalogPageSize: 500 });
    expect(commerce.catalogPageSize).toBe(48);
  });

  it("normalizes announcement dates and drops inverted windows", () => {
    const home = mergeSection("homepage", {
      announcement: { startsAt: "not-a-date", endsAt: "" },
    });
    expect(home.announcement.startsAt).toBeNull();
    expect(home.announcement.endsAt).toBeNull();
  });
});
