# Reader fixtures

Saved Google Maps pages the reader tests run on. Nothing here was fetched by the project: each
page was opened by hand in a signed-out Chromium and saved with the extension's development
capture (`dev:captureFixture`) on 2026-11-02 (US Pacific; the files say 2026-11-03 in UTC).

Signed out, Maps shows its **limited view**: about five reviews on the Reviews tab and three on
the Overview, no Updates (posts) tab, no claim prompt and no owner's description. The tests
assert that limited view; pages saved while signed in will need fixtures of their own.

- `maps/results-dentist-austin.html`: results for "dentist austin tx".
- `maps/results-plumber-austin.html`: results for "plumber austin tx".
- `maps/place-dentist-austin.html`: South Austin Dentist, Overview, opened from those results.
- `maps/place-plumber-austin.html`: Plumb Masters, Inc., Overview (a service-area business).
- `maps/place-dentist-manchester-uk.html`: City Centre Dental & Implant Clinic, Overview, with
  one post.
- `maps/about-dentist-austin.html`: South Austin Dentist, About tab (attributes); its results
  list holds two sponsored places.
- `maps/reviews-dentist-austin.html`: South Austin Dentist, Reviews tab.
- `maps/preview-place-dentist-austin.json`: the place data Maps fetched
  (`/maps/preview/place`) when South Austin Dentist was opened from the results, saved from the
  browser's network log in the same signed-out session: the request address (`source`) and the
  response body exactly as sent, `)]}'` prefix included.

Each file starts with the address it was saved from (`<!-- source: … -->`) and the capture time;
the tests read the address from there.

## How the pages were trimmed

The raw captures were 0.5 to 1 MB each. To keep them small and free of tracking data:

- removed scripts (Maps' inline page data included: the readers do not use it), styles, SVG,
  links, meta tags, iframes and canvases, and emptied every image `src`;
- removed the logging and tracking attributes (`jslog`, `ved`, `vet`, `jstrack`, `jsdata` and
  similar) and inline styles, except that a background image is kept as an empty
  `background-image: url("")`, since a post's media shows that way;
- removed the `g_ep`, `entry`, `rwg_token`, `ved`, `ei`, `gclid` and `sig` parameters from links,
  replaced ad click links with `/aclk?removed`, and dropped the opaque `!15s…` search token from
  the page addresses;
- kept every role, `aria-*` and `data-*` hook, `jsaction`, class names and all visible text.
  Business details, reviewer names and review texts are public on Google Maps and are kept.

The `<!-- prettier-ignore -->` before `<html>` keeps the formatter from reflowing the page, which
would change its text.

The place data keeps its arrays and every value at its index. Only session tokens were replaced
with `removed`: the event id, the `ved` tokens (`0ahUKEw…`, `2ahUKEw…`) and the link signatures
(`AOvVaw…`). The request address ends where the saved log cut it.
