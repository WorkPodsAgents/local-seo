---
name: rank-diagnosis
description: Map where a business ranks in Google Maps across its area with a geo-grid, then explain the pattern by distance, category relevance and prominence, and write the diagnosis to ./local-seo/. Use when a business says it ranks well at the office and nowhere else, has dropped in Maps, or wants a local rank map.
---

# Rank diagnosis

A Maps rank depends on where the searcher stands. One rank check proves little; a grid shows
the shape, and the shape points to the cause.

**Connections.** The Chrome extension, connected. The browser source is free and reads up to a
5x5 grid; larger grids need the user's DataForSEO key in the extension and cost money. Without
the extension, stop and ask the user to connect it.

Save under `./local-seo/rank-diagnosis/<business-slug>/<yyyy-mm-dd>/`.

## Steps

1. **Setup.** Resolve the business with `local-seo:find_business`. Ask for one to three
   searches and how far customers travel. Pick `spacingKm` so the grid covers that radius:
   a dense city might be 0.5 km, a rural trade 3 to 5 km.
2. **Cost first.** For a grid above 5x5, call `local-seo:geo_grid` with `source` dataforseo
   and `estimateOnly` true, show the user `estimatedCostUsd` for all searches together, and
   run it only after a yes. The extension's spend cap still applies; an over-cap error means
   stop and tell the user.
3. **Grid.** Call `local-seo:geo_grid` per search, centred on the business. Save
   `grid-<search>.json`.
4. **Spot checks.** Where the pattern is odd (a strong rank far away, a hole close by), call
   `local-seo:rank_at` at that point and save what ranks there instead.
5. **Read the shape.**
   - Strong in the middle and fading evenly: distance-bound. More prominence (reviews, links,
     mentions) widens the circle; a closer competitor is not beatable on distance.
   - Weak even at the centre: relevance. Check the primary category with
     `local-seo:category_ideas` and the profile with `local-seo:audit_profile`.
   - Strong for one search and weak for a close variant: category or services gap for that
     variant.
   - A sudden drop everywhere: check `local-seo:profile_history` for a name, category or
     address change, or a suspension.
6. **Report.** Write `report.md`: the grids as text tables (rank or "-" for not found within
   depth, "?" for unknown), the summary figures, the likely cause with its evidence, and what
   to change. Never claim a cause the data cannot show; say "likely" and why.

## Missing data

A cell `not_found` was read to `depth` and the business was not there: it is not rank 0 or
rank 21. A cell `unknown` was not read; leave it out of averages and say how many there were.
A grid is one moment; suggest rerunning the same grid in four to six weeks after changes.
