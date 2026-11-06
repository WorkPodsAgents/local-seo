# @workpods/local-seo

Local MCP server and CLI that pairs with the Local SEO browser extension to audit Google Business
Profiles and check Google Maps rankings.

## Install the extension

[Install Local SEO from the Chrome Web Store](https://chromewebstore.google.com/detail/local-seo-by-workpods/bljbmngieccnjdnlahdhgklcagfcphak).

Profile, review, post, and Maps ranking tools need the extension. The website check can also run
in Node without it.

## Quick start

Requires Node.js 22 or later. Print the installed package version:

```bash
npx -y @workpods/local-seo --version
```

Check a website against a business's name, address, and phone:

```bash
npx -y @workpods/local-seo audit-website https://example.com/ \
  --name "Example Business" --phone "+1 415-555-0100" --address "123 Example St"
```

The command prints a Markdown report and exits with code 1 if a high-severity check fails or
partly fails. Facts you leave out are not compared. Running `npx -y @workpods/local-seo` without
a subcommand prints usage and exits with code 2.

## Use from an AI agent

For Claude Code:

```bash
claude mcp add local-seo -- npx -y @workpods/local-seo mcp
```

For Cursor (`~/.cursor/mcp.json`) or Claude Desktop (`claude_desktop_config.json`), add this to
the client's MCP settings:

```json
{
  "mcpServers": {
    "local-seo": {
      "command": "npx",
      "args": ["-y", "@workpods/local-seo", "mcp"]
    }
  }
}
```

Pair the extension with this computer's bridge:

```bash
npx -y @workpods/local-seo pair
```

Enter the code in the extension's **Settings → Agent connection**, and enable **Connect to the
local bridge when it runs**. Keep Chrome open while the agent works. The client starts the local
server over stdio. Keep the pairing code private.

See [agent setup](https://github.com/WorkPodsAgents/local-seo/blob/main/docs/agents-and-skills.md)
for Codex, skills, and Firefox origin configuration.

## What it can do

- **Profiles:** audit a Google Business Profile and report findings and suggested fixes.
- **Reviews and posts:** read reviews and posts, then summarize review trends and posting
  activity. Browser reads can be incomplete; the result reports those limits.
- **Local competitors:** read Maps search results and compare businesses and categories.
- **Rankings:** check a business's position from one point or across a grid of locations.
- **Website checks:** compare the site's name, address, and phone with the profile, and inspect
  LocalBusiness schema, a click-to-call link, and an embedded map.
- **AI answers:** collect answers about local businesses from supported assistants through the
  extension, using browser tabs or an optional provider.
- **Categories and history:** suggest categories and compare saved profile snapshots to show
  what changed. The tools read profiles; they do not publish changes to Google.

No WorkPods account is required. Optional providers use your own accounts and may charge for
usage. Keys stay in the extension; the MCP server returns results and does not receive those keys.

## Links

[Local SEO by WorkPods](https://workpods.ai/tools/local-seo) ·
[Source code](https://github.com/WorkPodsAgents/local-seo) ·
[Privacy policy](https://github.com/WorkPodsAgents/local-seo/blob/main/PRIVACY.md) ·
[CLI documentation](https://github.com/WorkPodsAgents/local-seo/blob/main/docs/command-line.md) ·
[Apache-2.0 license](https://github.com/WorkPodsAgents/local-seo/blob/main/LICENSE)

Built by [WorkPods](https://workpods.ai). Written by Shefali Munjal. See LICENSE and NOTICE for
licensing and attribution. Not affiliated with or endorsed by Google.
