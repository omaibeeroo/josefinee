# Brand protection — Hanadi Store

> Practical playbook, not legal advice. For filings and disputes, work with
> an Algerian IP professional. Code measures in this file are implemented;
> administrative ones are checklists for the owner.

## What the law covers (and what it does not)

- **Copyright (automatic, Berne Convention; ONDA in Algeria):** your photos,
  copy, logo artwork, banner designs. Protects against *copying your assets*,
  not against someone making a store with a similar *vibe*.
- **Trademark (INAPI, must file):** the name "Hanadi Store" + logo as commercial
  identifiers. This is the only tool that stops a confusingly similar shop.
- **Style/layout/UX patterns:** not protectable. Do not spend energy here.

## 1. INAPI trademark filing checklist

- [ ] Decide the exact mark: word mark `Hanadi Store` (+ logo as a second filing if budget allows — logo and word are separate applications).
- [ ] List the goods/services (Nice classes; fashion retail + jewelry typically span classes 14, 25, 35 — confirm with counsel).
- [ ] Run an availability search at INAPI (Alger, or via inapi.org) for identical/similar marks in those classes.
- [ ] File with: applicant ID (NIF/NIS for a business, or personal ID), mark specimen, class list, fees.
- [ ] Docket the renewal date (10 years, renewable) somewhere you will actually see it.
- [ ] After grant: keep one page of evidence per year (screenshots, invoices, ads) — non-use can kill a mark.

## 2. Photo watermark (implemented in this repo)

- `PRODUCT_WATERMARK_PATH` in `.env` → absolute path of a PNG with transparency
  (white wordmark, ~600px wide, baked 60–80% opacity, with its own padding).
- Every product upload is then stamped bottom-right at 18% of photo width.
- Unset = original byte-identical pipeline. Set-but-unreadable = upload fails
  closed (`STORAGE_MISCONFIGURED`) so you never ship unmarked photos by mistake.
- Each upload writes `watermarked: true/false` into the audit log
  (`PRODUCT_IMAGE_UPLOADED`) — your evidence trail.
- Keep camera RAWs + export originals offline; a watermark proves little without
  the source files behind it.

## 3. Hotlink protection (do at the bucket, not in code)

- On Cloudflare R2 / S3-compatible storage: restrict reads to your domains
  (hotlink/referrer policy) or move product images to signed URLs.
- Why: stops clones embedding *your* image URLs (and billing you for it).
- Verify after enabling: an `<img>` with your URL on an unrelated domain must break.

## 4. Terms clause — paste into Admin → Content (terms page)

> **FR :** « L’ensemble des contenus de Hanadi Store — photographies,
> visuels, logo, textes et éléments graphiques — est protégé par le droit
> d’auteur. Toute reproduction, extraction automatisée (scraping),
> réutilisation commerciale ou imitation de nature à créer une confusion avec
> la marque Hanadi Store est interdite sans autorisation écrite préalable et
> pourra faire l’objet de poursuites. »
>
> **EN:** "All Hanadi Store content — photographs, visuals, logo, copy and
> graphic elements — is protected by copyright. Any reproduction, automated
> extraction (scraping), commercial reuse, or imitation likely to cause
> confusion with the Hanadi Store trademark is prohibited without prior
> written consent and may be prosecuted."

The storefront footer now carries the short form in FR/EN/AR
(`footer.rights` dictionary key).

## 5. Takedown template (host / registrar / platform abuse form)

```
Subject: Copyright/trademark infringement — [infringing URL]

I am the owner of Hanadi Store ([your store URL]).
The page at [infringing URL] reproduces my protected content:
- [ ] product photographs (originals held, watermarked copies attached)
- [ ] logo / brand name (INAPI trademark no. [___] / application dated [___])
- [ ] site copy (original texts attached with publication dates)

Evidence: [attach screenshots with dates, original RAW/export files,
audit-log excerpts showing first publication].

I request removal of the infringing content. I declare under penalty of
perjury that I am authorized to act for the rights holder.
Name / capacity / contact / date / signature.
```

## 6. Monitoring routine (quarterly, 30 minutes)

- [ ] Reverse-image-search 3–5 hero product photos.
- [ ] Search marketplaces/socials for the brand name + near-misspellings.
- [ ] Confirm watermark PNG still resolves and new uploads carry `watermarked: true`.
- [ ] Log everything below — a dated log turns complaints into cases.

## 7. Incident log

| Date | Infringing URL | What was copied | Evidence kept | Action taken | Outcome |
| ---- | -------------- | --------------- | ------------- | ------------ | ------- |
|      |                |                 |               |              |         |
