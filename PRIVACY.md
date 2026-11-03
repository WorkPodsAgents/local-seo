# Privacy policy

Local SEO by WorkPods: the Chrome and Firefox extension, the local MCP bridge (`@workpods/local-seo`) and the
skills plugin.

Effective 3 November 2026.

## The short version

Local SEO runs on your computer. WorkPods runs no server for it, so we receive none of your data:
no account, no analytics, no crash reports, no usage counts. What the extension reads and the
results it produces stay on your device. Data leaves your device only when you use a feature that
needs another service, and then it goes straight from your browser to that service.

## What the extension reads

- **Google Maps pages** you open, and pages it opens in a background tab of your browser at your
  request: business profiles, reviews, posts and search results. It reads them as your browser
  shows them, and changes nothing.
- **The address of the tab in front of you**, to know which business is open. It is used on your
  device and not stored as a history.
- **A business's website**, when you run the website check and allow that site.
- **An AI assistant's answer** (ChatGPT, Gemini, Perplexity or Google AI Mode), when you run the
  AI answers check in Assist mode and allow that assistant. The extension fills in the question;
  you send it.

The extension does not read your location, your Google account details, your browsing history,
your bookmarks or your downloads, and it never writes to Google.

## What is stored, and where

Everything is stored in the extension's storage in your browser profile, on your device:

- audit results, scans and a snapshot of each profile you read, to show what changed later;
- settings, monthly spend caps and a record of paid spend;
- cached answers from DataForSEO, for the reuse window you set (7 days by default);
- the API keys you add, in a vault encrypted with AES-GCM under a key derived from your
  passphrase (PBKDF2, 600,000 iterations).

Nothing is synced to your Google account. **Wipe data** in the extension's Settings deletes all of
it, and removing the extension deletes it too.

## Firefox storage and consent

Firefox desktop 140 or later uses a sidebar and background event page. Its private settings,
encrypted vault and spend records use extension-origin IndexedDB, which page content scripts
cannot access. Unlock keys stay in session storage unless explicitly remembered on this device.
Firefox asks for data consent at installation for authentication information, website content and
search terms, covering optional external provider features. This does not add telemetry; transfers
occur only for the features described below.

## When data leaves your device

Only when you start a feature that needs it, and only to the service that feature uses:

| Feature                                           | What is sent                                                                 | To                                                      |
| ------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------- |
| Reading Google Maps                               | The page requests your browser makes, as when you use Maps yourself          | Google                                                  |
| Website check                                     | A request for the website's page                                             | That website                                            |
| Paid reviews, posts, geo-grids and search volumes | The business's ids or name, the search, map points and your DataForSEO login | DataForSEO                                              |
| AI answers with Cloro                             | The question and your Cloro key                                              | Cloro                                                   |
| AI answers in Assist mode                         | The question, when you press Enter in the assistant's tab                    | That assistant, in your own session                     |
| AI writers                                        | Facts from the profile being drafted for, and your key                       | Anthropic, OpenAI or Google (Gemini API), as you choose |

Paid services are reached only with your own account and key, and their own privacy policies
apply to what they receive. WorkPods is not a party to those requests.

## The MCP bridge

The bridge runs on your computer when your AI agent starts it. It talks to the extension over
`127.0.0.1`, which no other computer can reach, only after the two prove they share the pairing
code you set up. It passes tool results to your agent and never receives your API keys. What your
agent does with those results is governed by the agent's own terms. The pairing code is stored in
`~/.config/local-seo/bridge-token`, readable only by your user account.

## Sharing and sale

We do not sell, rent or share your data, because we never receive it. We do not use it for
advertising, for creditworthiness or lending decisions, or for anything outside the extension's
single purpose of auditing local business listings.

## Children

Local SEO is a tool for businesses and is not directed at children.

## Changes

If this policy changes, the new version is published in this file in the project's repository
with a new effective date, and the extension's release notes say so.

## Contact

Local SEO is made by WorkPods: https://workpods.ai. Questions about this policy can be raised
through the contact options there, or as an issue in the project's repository.

Local SEO is independent and is not affiliated with, endorsed by or sponsored by Google.
