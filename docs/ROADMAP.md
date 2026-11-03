# Roadmap

Work that waits on something outside the code. Each item is filed as a GitHub issue once the
repository is public.

## Local pack and Local Finder readers: need signed-in captures

Reading the local 3-pack and the Local Finder ("More places") on Google Search needs saved
pages to write and test the readers against, captured signed in to Google. Until then a Search
results page offers the same search in Google Maps, where Local scan and This business read
everything, and the category overlay works on Maps only. The development build's "Capture this
page as a fixture" button saves a Search page for this work.

## Signed-in checks of the review sort and posts

Signed out of Google, Maps answers the review Sort control with a sign-in wall and shows only
the newest post on the Overview. The Newest sort and a full posts read are written against what
Maps is known to show signed in, but no signed-in page has been saved to test them. Capture a
signed-in Reviews tab with its sort menu open, and an Updates tab, with the development build.

## Google country domains

The manifest covers `www.google.com/maps`. On a country domain such as `google.de/maps` the
reader asks the user to allow the site, but the panel has no control that asks Chrome for that
grant. Add one, or send the user to `www.google.com/maps`.

## English for agent reads

Readers rely on English labels in a few places, and a page in another language says so. The
scratch tab that agent tools use could open Maps with `hl=en` so agent reads are always complete;
check first that `hl` does not change which businesses Maps lists.

## Smaller follow-ups

- `category_ideas` shows no progress while it opens up to eight competitor profiles; that needs a
  progress message over the bridge.
- Paid search volumes in `category_ideas` assume the US market when no country is known; the tool
  could take a country.
- The Cloro credit price in `packages/core` is marked to verify against the user's plan.
