# Keys and spending

Everything on the free side of Local SEO works with no keys: audits, Local scan, Teleport, geo-grids
up to 5 x 5, up to 100 reviews from Maps, the website check and AI answers in Assist mode. Add a
key when you want more than the browser can read. You pay the provider directly, from your own
account; Local SEO and WorkPods take nothing and see nothing.

| Provider                        | What it unlocks                                                                          | Where to get a key                                               |
| ------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **DataForSEO**                  | Every review and post with exact dates, geo-grids up to 13 x 13, category search volumes | [dataforseo.com](https://dataforseo.com): API login and password |
| **Cloro**                       | AI answers from ChatGPT, Gemini and Google AI Mode without opening tabs                  | [cloro.dev](https://cloro.dev): API key                          |
| **Anthropic, OpenAI or Gemini** | AI writers: descriptions, services lists, posts and review replies. Any one is enough    | The provider's console                                           |

## 1. Set up the vault

Keys live in an encrypted vault on your device. Open **Settings** and, under **Key vault**, choose
a passphrase of at least 8 characters, then click **Set up the vault**.

- Your passphrase never leaves the extension, and there is no way to recover it. If you forget it,
  use **Wipe data** and add your keys again.
- You unlock the vault once per browser session. It locks again when Chrome closes.
- **Remember on this device** skips the passphrase on this computer. It protects your keys from
  someone who copies your browser files, but not from malware running on the computer. Leave it off
  on a shared machine.

## 2. Add your keys

Under **Provider keys**, paste each key and click **Save**. A saved key is never shown again, even
to you; to change it, save a new one over it. The connection chips in the header turn on as keys
are added.

## 3. Set a monthly cap

Under **Monthly spend caps**, set a limit in US dollars for DataForSEO and for Cloro. A paid action
is refused until its provider has a cap, so you always decide the most you can spend. The card
shows what you have spent this month. Caps reset at the start of each month.

Model keys for AI writers have no cap in the panel. A draft costs a fraction of a cent; set a
spending limit in the provider's console if you want one.

## What each paid action costs

DataForSEO list prices, checked on 2 November 2026 (in
`packages/core/src/providers/dataforseo-local/prices.ts`). Reviews and posts use DataForSEO's
priority queue, which costs twice the standard price and answers in seconds instead of up to 45
minutes; the prices below are the priority prices.

| Action                  | Where                                              | Price                                          | Example                             |
| ----------------------- | -------------------------------------------------- | ---------------------------------------------- | ----------------------------------- |
| Read reviews            | Reviews tab, `read_reviews` with `dataforseo`      | $0.0015 per 10 reviews                         | 500 reviews: $0.075                 |
| Read all posts          | Reviews tab, **All posts**; `read_posts`           | $0.003 per read, plus $0.0015 per 10 posts     | 30 posts: $0.0075                   |
| Geo grid                | Rankings tab; `geo_grid` with `dataforseo`         | $0.002 per point (one Maps search, top 20)     | 7 x 7: $0.098; 13 x 13: $0.338      |
| Category search volumes | `category_ideas` with `searchVolumes` (agents)     | $0.012 per request, plus $0.00012 per category | 20 categories: $0.0144              |
| AI answers, Cloro       | AI answers tab; `local_ai_visibility` with `cloro` | ChatGPT 7 credits, Gemini 6, AI Mode 6         | All three: 19 credits, about $0.038 |

Cloro bills in credits, and what a credit costs depends on your plan. Local SEO counts a credit as
$0.002 against your cap; check that against your Cloro plan.

These are estimates for the cap. What a call cost is what the provider reports, and that is what
the spend counter adds up.

## How paid actions work

- Every paid button shows its estimated cost before you click it.
- An action that would take you over the cap is refused, and the panel tells you why and links to
  the setting to change.
- DataForSEO answers are kept on your device. Asking the same question again within the reuse
  window costs nothing. Change the window under **Preferences**, **Reuse paid answers for
  (days)**; it is 7 days by default. AI answers are never reused: each run is a new sample.
- Agents calling paid tools through the bridge spend from the same caps and the same cache. An
  agent can ask `geo_grid` and `local_ai_visibility` for the price alone first (`estimateOnly`).

If a provider rejects a call, the panel says why in plain words: your credentials were not
accepted, or the balance can't pay for it.

## Wipe data

**Wipe data** in Settings deletes the vault, your keys, caps, saved results, cached answers and
the agent pairing from this browser. Use it before you hand the computer on, or if you forget your
passphrase.
