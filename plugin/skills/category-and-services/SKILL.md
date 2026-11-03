---
name: category-and-services
description: Choose a Google Business Profile's primary and secondary categories and draft its services list from what the top-ranking competitors use, and write the recommendation to ./local-seo/. Use when asked which GBP category to pick, why a business does not rank for a service it offers, or to fill in services.
---

# Categories and services

The primary category is the strongest relevance signal a profile has. Pick it from what Maps
rewards for the searches the business wants, then cover every real service with secondary
categories and the services list.

**Connections.** The Chrome extension, connected. Category counts are read from Maps for free;
search volumes per category are a paid DataForSEO call from the user's key (one keyword task,
about $0.012 plus $0.00012 per category). Without the extension, stop and ask the user to
connect it.

Save under `./local-seo/category-and-services/<business-slug>/<yyyy-mm-dd>/`.

## Steps

1. **What the business does.** Resolve it with `local-seo:find_business`, then ask the user
   to list what they actually sell and which work they want more of. A category or service
   they do not offer is never a recommendation.
2. **Current state.** Call `local-seo:audit_profile` with `include` empty (the profile alone is
   enough) and note the categories and services it lists.
3. **What competitors use.** Call `local-seo:category_ideas` with the business and, in turn,
   each of the user's two or three main searches as `query`. Save `categories-<search>.json`.
   Ask before setting `searchVolumes` true; it costs money.
4. **Primary.** Recommend the primary category most top results share for the main search,
   if it fits the business. If the business's current primary is already right, say so.
   Changing a primary category can move rankings for weeks; say that too.
5. **Secondary and services.** Add the categories competitors use that match a real service,
   most used first. Draft a services list: one entry per service the user named, in the words
   customers search with, each with a one-sentence description under 300 characters.
6. **Report.** Write `report.md`: the recommended primary with the share of competitors using
   it, the secondary categories to add and to remove, the services list, and why each. The
   owner changes these in the Business Profile; you never change them.

## Missing data

A competitor whose categories could not be read is left out of `share`; say how many were
read (`competitorsRead`). `volumes` null means search volumes were not asked for or no key is
set, never that nobody searches.
