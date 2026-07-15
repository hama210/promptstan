# PromptStan Roadmap

## Completed

1. **Brand and product foundation** — Kurdish-first identity, multilingual UI and prompt-library concept.
2. **Architecture and data** — React app, Cloudflare Worker API, D1 schema, categories, tags and counters.
3. **Admin and publishing** — protected dashboard, prompt management, R2 uploads and daily publishing.
4. **AI Before/After automation** — image generation/editing, R2 storage and public image verification.
5. **Launch and growth** — share pages, tracked sharing, SEO, attribution and privacy-friendly analytics.
6. **Content scale** — prompt rotation, duplicate prevention, scoring, scheduling and automation controls.
7. **Advanced growth loops** — conversion funnels, campaign comparisons, demand gaps and recommendations.
8A. **Stabilization and single-source architecture**
   - ✅ D1 is the only live prompt source; bundled prompts are offline fallback only
   - ✅ Public category UI and collection shortcuts removed
   - ✅ Exact prompt slugs embedded in the rendered UI
   - ✅ Admin dashboard flattened into independent panels
   - ✅ Worker entry points consolidated and Admin comparisons hardened
   - ✅ Bootstrap, restore and exports protected with Admin bearer authentication
   - ✅ Additive D1 migration chain and consolidated reference schema
   - ✅ Reproducible installs, pinned dependencies and automated stabilization checks
   - ✅ Worker observability, public API cache policy and deployment health marker
   - ✅ Protected content/configuration backup export

## Current

8B. **Accounts and monetization**
   - ⏳ Decide whether accounts solve a validated retention problem
   - ⏳ Optional sign-in and synced favorites
   - ⏳ Premium collections and entitlement model
   - ⏳ Sponsored-placement policy and reporting

## Next

9. **Product operations** — moderation, retention controls, restore drills and reliability reporting.

## Decisions required before Phase 8B

1. **Account scope:** favorites-only identity or a full creator profile.
2. **Authentication:** email magic links, social login or both.
3. **Monetization:** subscription, one-time packs, sponsorships or a staged mix.
4. **Premium boundary:** which outcomes are paid without weakening the free library.
5. **Payments and legal:** supported markets, processor, refund policy and tax/privacy requirements.

The recommended order is to validate account demand first, add optional sign-in and synced favorites second, then test one monetization model with a small cohort before building broader premium features.
