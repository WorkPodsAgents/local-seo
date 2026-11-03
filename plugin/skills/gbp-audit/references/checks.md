# Local SEO checks

Generated from `packages/core/src/registry/local-checks.json` by
`plugin/scripts/checks-reference.mjs`; edit the registry, not this file. Severity is what
the audit reports on a fail or partial.

## Profile basics

- **L1 Phone number listed** (high). A profile without a phone number loses calls from the Maps panel, the most common action local searchers take.
  Fix: Add the main local phone number in the profile's contact section; use a local number, not a call centre.
- **L2 Website linked** (high). Without a website link the profile cannot send visitors on, and Google has no site to confirm the business against.
  Fix: Link the website page for this location (a location page for multi-location brands, otherwise the home page).
- **L3 Opening hours listed** (high). Missing hours make Google show no open/closed state and push searchers who filter by 'Open now' elsewhere.
  Fix: Add regular opening hours for every day, and special hours for holidays.
- **L4 Profile claimed** (high). An unclaimed profile can be edited by anyone and the owner cannot reply to reviews or post updates.
  Fix: Claim and verify the profile with 'Own this business?' in Maps, from an account the business controls.
- **L5 Not permanently closed** (high). A profile marked permanently closed drops out of local results.
  Fix: If the business still trades here, reopen the profile; if it moved, update the address instead of closing.
- **L6 Address or service area shown** (medium). Google needs an address or a service area to know where the business competes.
  Fix: Add the street address for a storefront, or the service areas for a business that visits customers.

## Categories

- **L7 Primary category set** (high). The primary category is the strongest relevance signal a profile has; without one the profile ranks for little.
  Fix: Pick the most specific primary category that describes the core business, as the top competitors do.
- **L8 Secondary categories used** (medium). Secondary categories let the profile rank for the other services it sells; Google allows up to nine.
  Fix: Add the secondary categories that match services actually offered; never add ones that do not apply.
- **L9 Primary category fits the target search** (high). When the primary category does not share words with the search the business wants, it rarely ranks for it.
  Fix: Choose a primary category that matches the main search; move the current one to a secondary slot if it still applies.
- **L10 Uses the categories top competitors share** (medium). A category most of the top competitors use and this profile lacks is a likely relevance gap.
  Fix: Review the categories competitors share and add those that describe this business truthfully.

## Content

- **L11 Description written** (medium). The description is the one place the owner explains the business in their own words.
  Fix: Write a description of what the business does, for whom and where, with no links or promotions.
- **L12 Description length** (low). Google allows 750 characters; under about 250 says too little to show relevance.
  Fix: Expand the description to between 250 and 750 characters, leading with the core services.
- **L13 Description names the service and the place** (low). A description that names the main service and the city confirms relevance for local searches.
  Fix: Mention the main service and the city or area served in the first sentence of the description.
- **L14 Attributes filled** (low). Attributes (accessibility, payments, amenities) feed filters and answers; few means missed matches.
  Fix: Fill every attribute that applies in the profile's 'More' section.
- **L15 Services listed** (medium). Listed services help the profile match service searches and appear in the profile's services tab.
  Fix: List each service sold, with a short description, using the words customers search with.
- **L16 Products listed** (low). Products show as a carousel on the profile; they are optional for service-only businesses.
  Fix: Add the main products or service packages with a photo, a name and a price range.

## Photos

- **L17 Enough photos** (medium). Profiles with few photos look abandoned and get fewer clicks and direction requests.
  Fix: Add real photos of the exterior, interior, team and work; keep adding a few each month.
- **L18 Customers add photos to reviews** (low). Reviews with photos are more trusted; almost none suggests customers are not asked for them.
  Fix: When asking for reviews, invite customers to add a photo of the result.

## Reviews

- **L19 Rating** (high). Searchers filter and choose by stars; under 4.0 loses clicks to better-rated neighbours.
  Fix: Fix the causes the negative reviews name, then ask every satisfied customer for a review.
- **L20 Enough reviews** (medium). A handful of reviews is weak proof for searchers and a weak prominence signal for Google.
  Fix: Ask for a review after each completed job, with a direct review link.
- **L21 Review count against competitors** (medium). Far fewer reviews than the competitors' median is one of the clearest prominence gaps in local results.
  Fix: Set a monthly review target that closes the gap to the competitors' median within a year.
- **L22 Recent reviews** (medium). Review velocity matters: no new reviews in three months reads as a business in decline.
  Fix: Make asking for a review part of every job, so new reviews arrive every month.
- **L23 Owner replies to reviews** (medium). Replying to reviews shows searchers the owner cares, and Google says it is a good practice.
  Fix: Reply to every review, positive and negative, ideally within a few days.
- **L24 Owner replies quickly** (low). A reply weeks later helps little; a quick reply can turn an unhappy reviewer around.
  Fix: Check new reviews weekly and reply within a few days.
- **L25 No unanswered negative reviews** (high). A recent one- or two-star review with no reply is the first thing a careful searcher reads.
  Fix: Reply to each negative review calmly and specifically, and offer to resolve it offline.

## Posts

- **L26 Posted recently** (medium). Posts older than a month show an inactive profile; regular posts keep offers and news in front of searchers.
  Fix: Publish an update, offer or event post at least weekly.
- **L27 Posting cadence** (low). A steady rhythm of posts beats bursts followed by silence.
  Fix: Plan a month of posts ahead and publish on a fixed day each week.
- **L28 Posts link somewhere** (low). A post without a call-to-action button gives the reader nothing to do next.
  Fix: Add a button (Book, Order, Learn more, Call) that links to the matching page.
- **L29 Posts carry a photo or video** (low). Text-only posts are easy to scroll past.
  Fix: Attach a real photo or short video to every post.

## Website

- **L30 Website matches name, address and phone** (high). A website that shows a different name, address or phone weakens Google's trust in the profile's details.
  Fix: Show the exact profile name, address and phone on the linked page, in text and in schema.
- **L31 LocalBusiness schema present** (medium). LocalBusiness structured data states the business's details in a form search engines and agents read reliably.
  Fix: Add LocalBusiness JSON-LD (or the most specific subtype) to the linked page.
- **L32 LocalBusiness schema complete** (low). Schema without address, telephone, geo or opening hours leaves out the facts local search needs.
  Fix: Add name, address, telephone, geo and openingHoursSpecification to the LocalBusiness schema.
- **L33 Click-to-call link** (low). Mobile visitors expect to tap the number; a number that is only text costs calls.
  Fix: Wrap the phone number in a tel: link.
- **L34 Website hours match the profile** (medium). Different hours on the website and the profile confuse customers and Google.
  Fix: Make the hours on the website and its schema the same as the profile's.
- **L35 Embedded map** (low). An embedded Google map on the location page helps visitors find the business and ties the page to the place.
  Fix: Embed the Google map of this business on the contact or location page.

## Trust

- **L36 Name free of keyword stuffing** (high). Adding cities or services to the business name breaks Google's guidelines and risks suspension; competitors can report it.
  Fix: Use the real-world business name as on signage and documents; put services and places in categories and the description.
- **L37 Service-area business hides its street address** (medium). A business that serves customers at their location but shows a street address where it does not receive them risks suspension.
  Fix: If customers are not served at the address, hide it and keep only the service areas.
- **L38 Not temporarily closed** (high). A profile marked temporarily closed ranks lower and tells searchers to go elsewhere.
  Fix: Remove the temporary closure as soon as the business reopens.
- **L39 No duplicate-looking profiles at the same address** (medium). Two profiles with similar names at one address look like duplicates; Google may merge or suspend them.
  Fix: Check each same-address profile; request removal of true duplicates through Google support.
