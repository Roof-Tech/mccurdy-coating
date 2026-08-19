# McCurdy Coatings audit implementation — 2026-08-19

- **Item 5 — Review CTA:** done: Google, Yelp, and BBB destinations, visible rating subtitles, and copyable suggested review text.
- **Item 6 — Property-aware incentives:** done: property/utility fields, applicable-program filtering, commercial exclusions, and BayREN program matching.
- **Item 7 — Incentive verification:** done: verification/expiry fields, computed stale status, customer verified dates, and admin stale alert.
- **Item 8 — 179 / 179D:** done: 2026 distinction, values, cutoff, IRS links, and CPA disclaimer in current incentive output.
- **Item 9 — PG&E / BayREN claims:** done: replaced guaranteed dollar claims with current-program messaging and verified date treatment.
- **Item 10 — Brand / white label:** done: title, admin naming, attribution removal, and unified legal footer.
- **Item 11 — Customer navigation:** done: four collapsible proposal groups, after-job gating, friendly timeline empty state, and mobile-safe headings.
- **Item 12 — Two-way messaging:** done: message table, customer/admin threads, polling, email notifications, rate limit, and unread indicators.
- **Item 13 — Measurement-grade data:** done: verified sq ft/source/notes fields, admin entry/upload controls, and measured-display badges.
- **Item 14 — AI review gate:** done: field confidence, editable review values, photo links, model/date metadata, and approval persistence.
- **Item 15 — Financing / invoices:** done: term/APR calculator, payment previews, finance intake/admin queue, invoice list, and payment-interest stub.
- **Item 16 — Performance:** done: lazy page chunks, vendor chunks, image lazy/async decoding, and immutable asset cache headers.
- **Item 17 — Accessibility:** done: 12px floor sweep, global focus visible style, skip link, and labeled new icon actions.
- **Item 18 — Idempotency / validation:** done: non-mutating referral GET, explicit init, idempotent warranty handling, signature/review validation, and public Zod validation.
- **Item 19 — Email escaping:** done: HTML escape helper applied to owner/customer-controlled notification content and new message/finance mailers.
- **Item 20 — Health / observability:** done: health/readiness responses plus structured global error logging.
- **Item 21 — Lifecycle automation:** done: stored preferences, preference portal/unsubscribe, seasonal and renewal queueing, review/reminder support, and storm outreach action.
- **Items 22–26 — 2026 incentive refresh:** done: residential-only 25C behavior, 179D values/cutoff, 2025 Energy Code copy, PG&E/BayREN current-program wording, and BayREN Business/BAMBE matching.
- **Item 29 — Field photo capture:** done: mobile camera/batch workflow, caption/category/tags/voice-note stub, optional AI run, and timeline/lightbox flow.
- **Item 30 — Portal payments / scheduling:** done: appointment Upcoming card and ICS download, invoices, and Pay Online interest flow.
- **Item 31 — Smart scheduling:** done: admin calendar/weather/capacity stub and schema backing for crew availability/checklists.

## Validation
- `npm run check` passed.
- `npm run build` passed.
- No commit or push was performed.
