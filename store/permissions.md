# Permission justifications

For the **Privacy practices** tab. The Chrome Web Store asks for one justification per permission
in the uploaded manifest, and one for host permissions. These match the production manifest of
version 1.0.0 (`npm run build -w extension`, then `extension/.output/chrome-mv3/manifest.json`):

```json
"permissions": ["sidePanel", "activeTab", "storage", "scripting", "offscreen", "alarms"],
"optional_permissions": ["webRequest", "tabs"],
"host_permissions": ["https://www.google.com/maps/*"],
"optional_host_permissions": ["<all_urls>"]
```

Optional permissions are not granted at install. The extension asks for each one from the side
panel, when the user starts the feature that needs it.

## sidePanel

The extension's whole interface is a side panel that stays open beside the Google Maps page the
user is auditing. Clicking the toolbar icon opens it.

## activeTab

When the user clicks the toolbar icon, the panel needs the address of the tab in front of them
to know which business or website to check. activeTab gives that for the clicked tab only,
without asking for the broader tabs permission.

## storage

Keeps the user's settings, monthly spend caps, the spend ledger and the encrypted key vault on the
device, and the unlocked vault key in session storage, which is in memory only and cleared when
the browser closes. Nothing is synced.

## scripting

Injects the extension's own reader script into a Google Maps tab when the user (or the user's
agent) asks for an audit, so it can read the profile, reviews, posts and search results shown
there. It also injects a script into an AI assistant's tab (ChatGPT, Gemini, Perplexity or Google
AI Mode) when the user runs the AI answers check, to fill in the question and read the answer
after the user presses Enter. Scripts are injected only into sites the user allowed, and only
when a feature is run. All injected code is packaged with the extension.

## offscreen

The website check parses the HTML of the business's website with the browser's DOM parser, which
a service worker does not have. An offscreen document with the DOM_PARSER reason does that work
out of sight.

## alarms

Two timers that must survive the service worker being stopped: one closes the background Maps tab
the extension reads in after a minute without use, and one retries the connection to the local
agent bridge while the user has that connection turned on.

## webRequest (optional)

Asked together with access to a business's website, when the user first checks it. It observes the
redirect hops of the extension's own requests to that site (for example http to https, or a
missing www), which the website check reports. It only observes; it never blocks or changes a
request, and it watches nothing else.

## tabs (optional)

Asked once from the panel, with an explanation, the first time it opens. Chrome hides the address
of the tab in front of the user without it, and the panel follows the user's tabs so that it
always works on the business that is open. The address is read on the device and never sent
anywhere.

## Host permission: https://www.google.com/maps/*

The extension's core feature reads Google Business Profiles and search results on Google Maps
pages. A small script runs on Maps pages from page start to keep the place data Maps fetches for
the open place (its secondary categories, for example), and the reader script is injected when the
user runs an audit. It reads what the page shows the user and changes nothing.

## Optional host permission: <all_urls>

Never granted at install. The extension asks for one site at a time, from a button the user
pressed, for two features:

- the business's own website, for the website check (name, address and phone against the
  profile, schema, click-to-call link and map);
- an AI assistant the user chooses to check (chatgpt.com, gemini.google.com, perplexity.ai or
  google.com for AI Mode).

A business's website is different for every business, and the user picks which assistants to
check, so neither can be listed in the manifest ahead of time. For AI Mode Chrome grants
`https://www.google.com/*`, since a host permission cannot be narrowed to one query.

## Remote code

No. See `remote-code.md`.
