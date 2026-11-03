# AGENTS.md: Local SEO

Local SEO is an open-source browser extension, local MCP bridge and skills plugin for Google
Business Profile and Google Maps: it audits a business profile, its reviews and posts, and where it
ranks in Maps from any point. WorkPods builds it and gives it away. `CLAUDE.md` is a symlink to
this file.

```text
packages/core/       Pure TypeScript: the bridge protocol, and later the business model and checks.
extension/           The MV3 extension (WXT + React): side panel, service worker, content scripts.
bridge/              The local MCP server (`local-seo mcp`) agents start; talks to the extension.
plugin/              The skills plugin for Claude Code and Codex.
vendor/agent-ready/  Files copied from Agent Ready by scripts/sync-from-agent-ready.mjs.
scripts/             Repo tooling: the Agent Ready sync, the team build release and the icons.
```

## Rules

- **Standalone.** Nothing here calls a WorkPods server or needs a WorkPods account, and nothing
  sends telemetry. Data stays on the user's device; paid providers are reached with the user's own
  keys.
- **Read only.** The extension reads what Google Maps and Search show the user, and AI features
  write drafts the user copies. Writes through the Google Business Profile API are out of scope
  until the owner says otherwise.
- **Missing is not zero.** A value the page or provider did not give is `null` with a reason,
  never `0` or an empty string.
- **Shared code is vendored.** Code shared with Agent Ready lives in `vendor/agent-ready/`. Never
  edit `vendor/`; change Agent Ready, then run `npm run sync:agent-ready -- <agent-ready checkout>`.
- **Secrets.** API keys are decrypted only in the service worker, and never reach a page, a content
  script, the MCP bridge, a log or an export.
- **Least privilege.** Ask for a permission when a feature needs it, and only for the sites it
  needs. The manifest holds Google Maps (development builds add Search, for fixture capture);
  everything else is optional and asked per site.
- **Justify it or delete it.** Every file, dependency and line names the behaviour or invariant it
  serves.
- **Tests are behaviour-driven.** Given a saved page or a recorded provider response, when a reader
  or check runs, then this result. Providers and Google are never called live in tests.
- **Code shape.** Lines are at most 100 characters. A comment says why, never what.
- **Theme.** Colours, type and spacing come from the WorkPods tokens; no raw colour outside
  `vendor/`.

## Verification

```bash
npm run check    # format, typecheck, tests, skill lint and build
node scripts/sync-from-agent-ready.mjs --from <agent-ready checkout> --check
```

Publishing (a remote or public repository, the Chrome Web Store, npm) and any paid provider spend,
including recording fixtures, need the owner's explicit go.
