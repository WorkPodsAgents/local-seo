# Local SEO

A free, open-source Chrome and Firefox extension that audits Google Business Profiles and shows where a
business ranks in Google Maps. Your coding agent can drive it too.

Local SEO reads what Google Maps shows in your own browser: a business's categories (including
the secondary ones Maps hides), profile, reviews and posts, and where it ranks for a search from
any point on the map. It runs 39 checks and says what to fix first. A local MCP server and a
skills plugin let Claude Code, Codex and other agents run the same audits. Paid data, such as
large geo-grids and full review history, uses your own DataForSEO key, kept encrypted in the
extension. It needs no account and has no telemetry.

<img src="store/images/1-audit.png" width="49%" alt="Audit any Business Profile in one click"> <img src="store/images/3-rankings.png" width="49%" alt="See where you rank from any street">
<img src="store/images/4-reviews.png" width="49%" alt="Reviews, read the way an owner should"> <img src="store/images/5-agents.png" width="49%" alt="Your coding agent can run the whole audit">

## Install

Until it is on the Chrome Web Store, install a release build:

1. Download `local-seo-<version>-chrome.zip` from Releases and unzip it into a folder you will
   keep.
2. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and choose the
   folder.
3. Pin Local SEO and click its icon to open the side panel.

To build it yourself (Node 22 or later): `npm install`, then `npm run release:zip`; the zip is in
`release/`. [Getting started](docs/getting-started.md) has the details.

## Firefox

Firefox desktop 140 or later is supported. Build the package with
`npm run zip:firefox -w extension`. Firefox uses its sidebar and background event page, and stores
private settings and vault records in extension-origin IndexedDB. Its built-in data-consent
prompt covers the data optional provider features can transmit. Core audits require no paid keys.

The local bridge requires the exact Firefox installation origin shown in Settings. See
[Firefox bridge setup](docs/agents-and-skills.md#firefox).

## Docs

- [Getting started](docs/getting-started.md): install, the first audit, Google's limited view,
  and Google in another language
- [Using the extension](docs/using-the-extension.md): every tab of the side panel
- [How the checks work](docs/how-checks-work.md), and the
  [list of checks](plugin/skills/gbp-audit/references/checks.md)
- [Keys and spending](docs/keys-and-spending.md): DataForSEO, Cloro and model keys, caps and prices
- [Agents and skills](docs/agents-and-skills.md): the MCP bridge, pairing, and the nine skills
- [Command line and CI](docs/command-line.md): `audit-website` for terminals and pipelines
- [Privacy and permissions](docs/privacy-and-permissions.md), and the
  [privacy policy](PRIVACY.md)

## Develop

```bash
npm install
npm run check                  # format, typecheck, tests, skill lint and build
npm run e2e -w extension       # every panel tab in demo mode, in headless Chromium
```

Load `extension/.output/chrome-mv3` unpacked to try a build. [AGENTS.md](AGENTS.md) has the rules
for contributors and agents. `store/` holds the Chrome Web Store listing and its images.

Local SEO is independent and not affiliated with Google. Google Maps and Google Business Profile
are trademarks of Google LLC.

## License

Apache-2.0; see [LICENSE](LICENSE) and [NOTICE](NOTICE). Built by [WorkPods](https://workpods.ai).
