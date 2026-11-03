# Privacy and permissions

Local SEO has no account, no server of ours and no telemetry. It doesn't send your data, your
results or your usage to WorkPods or anyone else. This page says what it stores, what it sends
where, and why it asks for each permission. The code is open, so you can check every line. The
formal policy is [PRIVACY.md](../PRIVACY.md).

## What stays on your device

| What                                               | Where                                                                                    |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Your API keys                                      | An encrypted vault in the extension's local storage. Never synced to your Google account |
| The key that unlocks the vault                     | Chrome's session storage, in memory only and cleared when Chrome closes                  |
| The same key, with **Remember on this device**     | IndexedDB, as a key the browser won't export                                             |
| The last audit and a snapshot of each profile read | IndexedDB, to show what changed since your last visit                                    |
| Cached DataForSEO answers                          | IndexedDB, used for the reuse window (7 days by default)                                 |
| Pages of a long review read for an agent           | Session storage, cleared when Chrome closes                                              |
| Your caps, spend and preferences                   | The extension's local storage                                                            |

The vault encrypts each key with AES-GCM, under a key derived from your passphrase with PBKDF2
(600,000 iterations). Only the extension's service worker decrypts a key, and only to call that
provider. Content scripts can't read the extension's storage. A key never reaches a web page, the
MCP bridge, a log or an export.

**Wipe data** in Settings deletes all of it.

## What leaves your device, and when

| When you                                     | What is sent                                                                        | To                                              |
| -------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------- |
| Audit, scan or check rankings in the browser | Nothing new: Local SEO reads the Google Maps pages your browser loads, as you would | Google, from your browser, as when you use Maps |
| Check a business's website                   | An ordinary request for its page                                                    | That website, from your browser                 |
| Run a paid DataForSEO action                 | The business's ids or name, the search and map points, and your login               | DataForSEO                                      |
| Run AI answers with Cloro                    | The question, such as "What is the best dentist in Austin, TX?", and your key       | Cloro                                           |
| Run AI answers in Assist mode                | The question, when you press Enter                                                  | The assistant, in your own signed-in session    |
| Ask AI writers for a draft                   | Facts from the profile (name, categories, description, reviews) and your key        | Anthropic, OpenAI or Google (Gemini API)        |

Background reads (reviews, geo-grids, agents' tools) happen in a tab Local SEO opens and closes
itself, in your own browser, so Google sees them as your browsing. The free geo-grid pauses
between searches for that reason.

## The bridge

The MCP bridge runs on your computer. It listens on `127.0.0.1` port 47822, which other
computers can't reach, and accepts only the Local SEO extension's own origin, one connection at a
time. Web pages and other programs on the computer can also reach localhost, so the two sides
pair once with a code: on every connection each proves it holds the code (an HMAC-SHA256 of the
other's random challenge) before any tool runs. The code is kept in
`~/.config/local-seo/bridge-token`, readable only by you. The agent gets results, never keys.

The connection is off until you turn on **Agent connection** in Settings.

## Permissions

Local SEO asks for as little as it can up front, and asks for the rest when a feature needs it.

**At install:**

| Permission                      | Why                                                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `https://www.google.com/maps/*` | To read the Business Profiles, reviews, posts and results Google Maps shows you                         |
| `sidePanel`                     | To show the panel beside the page                                                                       |
| `activeTab`                     | To know the address of the tab you are on when you click the toolbar icon                               |
| `scripting`                     | To read the Maps page you audit, and the AI answer in an assistant's tab when you run AI answers        |
| `storage`                       | To keep the vault, settings, caps and preferences                                                       |
| `offscreen`                     | To parse a business's website with the browser's own HTML parser, out of sight                          |
| `alarms`                        | To close the background Maps tab after a minute idle, and to retry the bridge connection while it is on |

**When a feature needs them:**

| Permission             | Asked when                              | Why                                                                                                                             |
| ---------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `tabs`                 | You first open the panel                | Chrome hides the address of the page in front of you without it, and the panel follows your tabs to know which business is open |
| A business's website   | You first check that website            | To fetch its page. Asked one site at a time                                                                                     |
| `webRequest`           | With a website's access                 | To see each redirect hop of the extension's own requests. It only observes, and never blocks or changes a request               |
| An AI assistant's site | You first run AI answers in Assist mode | To fill in the question and read the answer in that assistant's tab                                                             |

Local SEO doesn't ask for your Google sign-in, your location, your history, your bookmarks or your
downloads, and it never writes to your Business Profile.
