# Data usage (privacy practices form)

Answers for the **Privacy practices** tab, **Data usage** section. The form asks what user data
the extension collects, where "collect" means it leaves the user's device or is handled by the
developer. Local SEO has no server: WorkPods receives nothing. Data leaves the device only when
the user runs a feature that needs a third-party provider, goes straight to that provider, and is
sent with the user's own account and key.

## What to tick

| Category                     | Tick? | Why                                                                                                                                                                                                                                           |
| ---------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Personally identifiable info | No    | The extension does not ask for or read the user's name, email, address or ID. The business details it reads (name, address, phone) are a business's public listing, not the user's.                                                           |
| Health information           | No    |                                                                                                                                                                                                                                               |
| Financial and payment info   | No    | Spend caps and the spend ledger are numbers the user sets and costs providers report; no card or account data.                                                                                                                                |
| Authentication information   | Yes   | The user may enter API keys (DataForSEO login and password, Cloro, Anthropic, OpenAI or Gemini). They are kept encrypted on the device and sent only to the provider each key belongs to, when the user runs a feature that uses it.          |
| Personal communications      | No    |                                                                                                                                                                                                                                               |
| Location                     | No    | The extension never reads the user's location. Rankings use a point or place name the user types, which describes where a search is seen from, not where the user is.                                                                         |
| Web history                  | No    | The panel reads the address of the current tab on the device to know which business is open. Addresses are not stored as a history and never leave the device.                                                                                |
| User activity                | No    | No clicks, keystrokes or usage are recorded or sent. There is no analytics or telemetry.                                                                                                                                                      |
| Website content              | Yes   | The extension reads the content of Google Maps pages the user opens (business profiles, reviews, posts, search results), the business website the user checks, and the AI assistant answers the user asks for. See below for where each goes. |

## Where the data goes

| Data                                                           | Stays on the device | Sent to                                                                                                | When                                                                   |
| -------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Google Maps page content                                       | Yes                 | Nowhere                                                                                                | Read locally                                                           |
| Audit results, profile snapshots, saved scans                  | Yes (IndexedDB)     | Nowhere, unless the user exports a file or their own agent asks through the local bridge               |                                                                        |
| A business's website                                           | Yes                 | The request goes to that website, from the user's browser                                              | The user runs the website check                                        |
| Business identifiers, a search term, map points                | No                  | DataForSEO, with the user's DataForSEO login                                                           | The user runs a paid action (reviews, posts, geo-grid, search volumes) |
| A local-buyer question ("best dentist in Austin, TX")          | No                  | Cloro, with the user's key; or the assistant's own site in the user's tab, when the user presses Enter | The user runs the AI answers check                                     |
| Facts from the audited profile (name, categories, description) | No                  | Anthropic, OpenAI or Google (Gemini API), with the user's key                                          | The user asks for a draft                                              |
| API keys                                                       | Yes, encrypted      | Only the provider the key belongs to                                                                   | With each call to that provider                                        |

The local MCP bridge runs on the user's computer and talks to the extension over
`127.0.0.1:47822`, after both sides prove they hold the pairing code. It receives tool results,
never keys.

## Certifications

Tick all three:

- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

The transfers above are the approved use case "to provide or improve the single purpose": each
is made at the user's request, to the provider the user chose, with the user's own account.

## Privacy policy

`PRIVACY.md` at the repository root. The store needs it as a public URL; once the repository is
published, use the file's GitHub address.
