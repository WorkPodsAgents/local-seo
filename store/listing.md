# Chrome Web Store listing

Paste each field into the item's **Store listing** tab. The images are in `store/images/`; run
`npm run build:e2e -w extension && node store/src/render.mjs` to make them again.

## Name

Local SEO by WorkPods

(21 characters. The manifest's `name` must match.)

## Summary (short description)

Audit Google Business Profiles, reviews and Maps rankings in your browser. Free and open source, and your AI agent can run it too.

(130 of 132 characters. It is the manifest's `description` field in the store; the manifest's own
description is shorter and is shown in `chrome://extensions`.)

## Description

Local SEO audits a business's Google Business Profile and shows where it ranks in Google Maps,
from a side panel in your own browser. It is free and open source, and it needs no account.

Open a business in Google Maps and click Audit. In a minute you see what to fix first:

- 39 checks across the profile basics, categories, description and attributes, photos, reviews,
  posts, the business's website and trust signals, each with a pass, fail or "not tested" and the
  reason
- the business's secondary categories, which Google Maps does not show on the profile
- the place ID, CID, Knowledge Graph ID and a ready-made review link, each one click to copy
- what changed on the profile since you last looked
- AI-written drafts of a description, a services list, posts and review replies, from your own
  Anthropic, OpenAI or Gemini key (optional)

Beyond the one profile:

- Local scan reads a Maps search and lists every business in it with its category, rating,
  reviews and distance, and can label the result cards on the map with their categories.
- Rankings shows where a business ranks for a search from any point you choose, and runs a
  geo-grid of searches around it (up to 5 x 5 free in the browser, up to 13 x 13 with DataForSEO).
- Reviews shows the monthly trend, the star mix, reply rate and speed, unanswered negative reviews
  and the words reviewers keep using.
- Website compares the business's own site with its profile: name, address and phone,
  LocalBusiness schema, a click-to-call link, opening hours and an embedded map.
- AI answers asks ChatGPT, Gemini, Perplexity and Google AI Mode the question a local buyer asks
  and shows which businesses each one names.

What it reads: Local SEO reads the Google Maps pages you open, the way you see them. When you
check a business's website, it fetches that site's pages once you allow it. Signed out of Google,
Maps shows a limited view with only a few reviews and no posts; the panel says when that happened
and what it hid. Local SEO reads Google Maps in English for now, and offers to reopen a page in
English when it isn't.

Free or with your own keys: core audits work for free in your browser. Some things go
further with a key of your own: DataForSEO for full review and post history and large geo-grids,
Cloro to ask the AI assistants without you watching, and a model key for the drafts. You pay those
providers directly; each paid action shows its estimated cost first, and a monthly cap you set
stops spending at that amount. Keys are kept in an encrypted vault on your device.

For AI agents: a local MCP server (`npx @workpods/local-seo mcp`) and a skills plugin let Claude
Code, Codex, Cursor and other agents run the same audits through your browser and write the
reports into your project. The agent gets results, never your keys.

Privacy: there is no WorkPods server, no account and no analytics. Your results and keys stay on
your device. Data leaves it only when you use a feature that needs a provider, and then only to
that provider, with your own key.

Local SEO is an independent tool made by WorkPods (https://workpods.ai). It is not affiliated with, endorsed by or
sponsored by Google. Google Maps and Google Business Profile are trademarks of Google LLC, named
here only to describe what the extension works with.

Source code, docs and issues: https://github.com/workpodsai-agents/local-seo

## Category

**Tools** (under Productivity). Most people who will use it are business owners, agencies and
marketers auditing local listings, which is what Tools covers. **Developer Tools** fits the MCP
bridge but would hide the extension from the people it is mostly for. The owner makes the final
choice.

## Language

English (United States).

## Images

| Field                           | File                                   |
| ------------------------------- | -------------------------------------- |
| Store icon (128 x 128)          | `extension/public/icon-128.png`        |
| Screenshot 1 (1280 x 800)       | `store/images/1-audit.png`             |
| Screenshot 2                    | `store/images/2-categories.png`        |
| Screenshot 3                    | `store/images/3-rankings.png`          |
| Screenshot 4                    | `store/images/4-reviews.png`           |
| Screenshot 5                    | `store/images/5-agents.png`            |
| Small promo tile (440 x 280)    | `store/images/promo-small-440x280.png` |
| Marquee promo tile (1400 x 560) | Optional; not made                     |

The screenshots show the panel in demo mode. Every business in them is invented: the names,
addresses, phones, websites, ids and reviews are made up, and only the numbers come from Google
Maps pages saved for the tests.

## Other fields

| Field              | Value                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------- |
| Official URL       | `https://workpods.ai` (once the domain is verified in Search Console for this publisher) |
| Homepage URL       | The GitHub repository, once published                                                    |
| Support URL        | The repository's Issues page, once published                                             |
| Privacy policy URL | `PRIVACY.md` in the repository, once published                                           |
| Mature content     | No                                                                                       |
| Visibility         | Public                                                                                   |
| Regions            | All regions                                                                              |
| Pricing            | Free                                                                                     |
