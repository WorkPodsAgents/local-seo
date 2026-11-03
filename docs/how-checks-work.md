# How the checks work

A profile audit runs 39 checks, L1 to L39. Each has a stable id, a group, a severity, the reason
it matters and how to fix it. The full list is in the
[checks reference](../plugin/skills/gbp-audit/references/checks.md), which is generated from
`packages/core/src/registry/local-checks.json`, the same file the extension and the skills use.

## Eight groups

| Group              | Checks     | What it looks at                                                                                                                                    |
| ------------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Profile basics** | L1 to L6   | Phone, website, hours, claimed, not permanently closed, an address or service area                                                                  |
| **Categories**     | L7 to L10  | A primary category, secondary categories, whether the primary fits the search, the categories rivals share                                          |
| **Content**        | L11 to L16 | The description (written, long enough, naming the service and place), attributes, services and products                                             |
| **Photos**         | L17, L18   | Enough photos, and customers adding photos to reviews                                                                                               |
| **Reviews**        | L19 to L25 | Rating, count, count against competitors, recent reviews, reply rate, reply speed, unanswered negatives                                             |
| **Posts**          | L26 to L29 | Posted recently, a steady cadence, posts with a link, posts with a photo or video                                                                   |
| **Website**        | L30 to L35 | Name, address and phone match the profile, LocalBusiness schema and its completeness, click-to-call, hours, map                                     |
| **Trust**          | L36 to L39 | No keyword stuffing in the name, a hidden address for service-area businesses, not temporarily closed, no duplicate-looking listings at the address |

## Four statuses

| Status       | Meaning                                                                                                  |
| ------------ | -------------------------------------------------------------------------------------------------------- |
| **Pass**     | The profile does what the check asks.                                                                    |
| **Fail**     | It doesn't. The finding says what was found.                                                             |
| **Partial**  | Part of it holds: some recent reviews are answered, or the website shows the name but a different phone. |
| **Untested** | There was nothing to judge, or it could not be read. The finding says which, and why.                    |

Untested is never a failure, and a value Local SEO could not read is never treated as zero. A
profile whose photo count Maps did not show is "photo count unknown", not "no photos". The
common reasons:

- **Google's limited view.** Signed out of Google, Maps shows about five reviews, no posts and no
  owner's description, and leaves out the claim prompt. The checks that need them are untested
  with that reason. Sign in to Google in the browser and audit again.
- **A part not read.** The website was not allowed yet, no search was given for the competitor
  checks, or Maps would not sort the reviews by Newest, so the recency checks (L22, L24, L25) are
  not judged from a "Most relevant" sample.
- **The browser sees only the newest post.** The posting checks (L26 to L29) need every post,
  which only DataForSEO reads. In an audit they are untested; **All posts** on the Reviews tab,
  or `read_posts` with source `dataforseo` from an agent, reads them.
- **Maps in another language.** Fields Maps writes only as text (the photo count, the hours, the
  claim prompt) are matched in English. See
  [Getting started](getting-started.md#google-in-another-language).

## Severity

Every fail and partial carries the check's severity. Fix them in this order.

| Severity   | What it usually means                                                                                 |
| ---------- | ----------------------------------------------------------------------------------------------------- |
| **High**   | Costs calls or rankings directly: no phone, an unclaimed profile, a rating under 4.0, a stuffed name. |
| **Medium** | A real gap against competitors: few reviews, no recent posts, no LocalBusiness schema.                |
| **Low**    | Worth doing when you are in the profile anyway: products, posts with links, an embedded map.          |

There are 12 high, 15 medium and 12 low checks.

## Reading the numbers

**The score strip** shows each group as passed over judged, such as **3 of 4**. The bar under it
is green for passed, red for failing and striped for untested, so a group that could hardly be
judged looks unfinished.

**The score** on the checklist is out of 100, weighted by severity: a high check counts 3, a medium
2 and a low 1, a pass earns its full weight, a partial half and a fail nothing. Untested checks are
left out, and the line above the score says how many there were. A score of 90 from 12 judged
checks says less than a score of 75 from 35.

## What runs where

| Where                                | What it reads                                                                                                                     | Cost                                                |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Your browser, Google Maps            | The profile, reviews (100 from the panel, up to 500 for an agent), the newest post, Maps results, Teleport, geo-grids up to 5 x 5 | Free                                                |
| Your browser, the business's website | The website checks (L30 to L35), once you allow the site                                                                          | Free                                                |
| DataForSEO, with your key            | Every review and every post with exact dates, geo-grids up to 13 x 13, category search volumes                                    | Paid, see [Keys and spending](keys-and-spending.md) |
| The command line, with no browser    | The website checks against the name, address and phone you give it                                                                | Free                                                |

The browser reads what Google Maps shows you at the time. Google changes its pages often; when a
reader stops finding something it reports the field as unknown, and the fix is an update of the
extension.
