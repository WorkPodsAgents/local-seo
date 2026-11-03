# Command line and CI

The bridge package doubles as a command-line tool. Its `audit-website` command checks a
business's website against the name, address and phone on its Google Business Profile, in Node,
with no browser and no extension. Use it from a terminal, or in CI to fail a build when a deploy
drops the phone number from the location page or breaks its LocalBusiness schema.

You need Node 22 or later. Until `@workpods/local-seo` is published on npm, build it from a clone
and use `node bridge/dist/cli.js` in place of `npx @workpods/local-seo`
([how](agents-and-skills.md#before-the-npm-release)).

## Check a website

```bash
npx -y @workpods/local-seo audit-website https://example.com/ \
  --name "Nyack Plumbing Co" --phone "+1 845-555-0100" --address "250 W Nyack Rd, West Nyack, NY"
```

Give the facts as they appear on the Business Profile. `--name` is required; a fact you leave out
is not compared. The command fetches the page (without running its JavaScript, as a crawler
does) and runs checks L30 to L35:

- the page shows the same name, address and phone as the profile;
- it has LocalBusiness schema, and the schema has the address, telephone, geo and opening hours;
- the phone number is a click-to-call link;
- it embeds a Google map.

The hours check (L34) needs the profile's hours, which only the extension reads, so the command
line reports it as untested.

It prints a readable report. Add `--json` for the full result as JSON, for a script or a
dashboard.

## Fail a build

| Exit code | Meaning                                                                      |
| --------- | ---------------------------------------------------------------------------- |
| `0`       | No high-severity check fails or partly fails                                 |
| `1`       | At least one does: the site's name, address or phone differ from the profile |
| `2`       | The command was wrong (an unknown command, a missing URL or a missing name)  |

A GitHub Actions job that checks the location pages after each deploy to staging:

```yaml
name: Local SEO
on:
  deployment_status:
jobs:
  nap:
    if: github.event.deployment_status.state == 'success'
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        include:
          - path: /locations/west-nyack
            name: Nyack Plumbing Co
            phone: '+1 845-555-0100'
            address: 250 W Nyack Rd, West Nyack, NY
    steps:
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: >
          npx -y @workpods/local-seo audit-website
          "${{ github.event.deployment_status.environment_url }}${{ matrix.path }}"
          --name "${{ matrix.name }}" --phone "${{ matrix.phone }}"
          --address "${{ matrix.address }}"
```

Add one `include` entry per location page, with the facts from that location's profile.

## Other commands

```bash
npx -y @workpods/local-seo --version   # print the version
npx -y @workpods/local-seo mcp         # start the MCP server (your agent does this for you)
npx -y @workpods/local-seo pair        # print the code that pairs the extension with this bridge
```
