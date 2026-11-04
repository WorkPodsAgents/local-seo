# @workpods/local-seo

Local MCP server and CLI for the Local SEO extension: Google Business Profile and Maps audits.

Built by [WorkPods](https://workpods.ai). Requires Node.js 22 or later.

```bash
npx -y @workpods/local-seo --version
npx -y @workpods/local-seo mcp
```

Pair the extension with this computer's bridge before enabling the agent connection:

```bash
npx -y @workpods/local-seo pair
```

Install the [Chrome extension](https://chromewebstore.google.com/detail/local-seo-by-workpods/bljbmngieccnjdnlahdhgklcagfcphak)
for browser-based checks. Optional provider integrations use your own keys, held by the extension.
The MCP bridge sends results to your agent and does not receive provider keys.

See [setup and Firefox instructions](https://github.com/WorkPodsAgents/local-seo/blob/main/docs/agents-and-skills.md),
[CLI documentation](https://github.com/WorkPodsAgents/local-seo/blob/main/docs/command-line.md), and [source code](https://github.com/WorkPodsAgents/local-seo).

Apache-2.0; see LICENSE and NOTICE. Written by Shefali Munjal.
