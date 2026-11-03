---
name: multi-location-audit
description: Run the same Google Business Profile checks across every location of a brand, find the problems shared by many locations and the outliers, and write a location-by-location table and a brand-level fix list to ./local-seo/. Use when asked to audit several GBP listings, a franchise, a chain or all stores of a brand.
---

# Multi-location audit

A brand's location problems usually come from one cause: a template description, a wrong
category set at onboarding, a website with one page for all stores. Find those first, then the
locations that fall behind the rest.

**Connections.** The Chrome extension, connected; each audit reads Maps in the browser and
takes a minute or two, so 20 locations take a while. Without the extension, stop and ask the
user to connect it.

Save under `./local-seo/multi-location-audit/<brand-slug>/<yyyy-mm-dd>/`.

## Steps

1. **Locations.** Ask for the list: Maps links, store locator URLs, or a spreadsheet. If the
   user has only the brand name, call `local-seo:find_business` with the brand and each city
   they name, and confirm the list with them before auditing. Save `locations.json` with each
   location's `placeId` or `cid`.
2. **One search.** Ask for the search every location should win, such as "tyre fitting".
3. **Audit each.** Call `local-seo:audit_profile` per location with that `keyword` and the
   default `include`. Save `audits/<location-slug>.json`. If one fails, record why and carry
   on; never drop it silently.
4. **Websites.** If locations link to location pages, the audits cover them. If all link to the
   home page, that is one brand-level finding, not one per store.
5. **Shared problems.** Count each failing check across locations. A check failing at most
   locations is a brand fix: find the shared cause (same description text, same categories,
   same landing page) and fix it once.
6. **Outliers.** Rank locations by score and by review count and rating. A location far below
   the brand median gets its own short section; offer `gbp-audit` for it.
7. **Report.** Write `report.md` (brand fixes, then outliers, then the per-location table) and
   `locations.csv` with one row per location: name, score, judged checks, rating, reviews,
   and each check's status.

## Missing data

Compare scores only between locations with a similar number of `judged` checks; a score from
12 checks and one from 35 are not the same measure. Say which locations could not be read.
