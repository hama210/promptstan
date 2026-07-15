# PromptStan

PromptStan is a Kurdish-first AI prompt library for photo editing. The public React app is backed by a Cloudflare Worker and D1, with R2-hosted Before/After images and an Admin dashboard for publishing, automation, growth analytics and backups.

## Architecture

- **Public app:** React 19 + Vite, deployed at `https://promptstan.pages.dev`
- **API and share pages:** Cloudflare Worker at `https://promptstan-api.hhhh46529.workers.dev`
- **Live content:** Cloudflare D1 is the single source of truth
- **Offline behavior:** the bundled prompt library is used only when the API is unavailable
- **Images:** Cloudflare R2, with Workers AI generation/editing
- **Admin:** `/admin`, protected by `ADMIN_TOKEN`

Public categories are intentionally hidden. Category metadata remains internal for search, related prompts, automation and analytics.

## Local development

Requirements: Node.js 22 and npm.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

The app uses the production Worker by default. Set `VITE_API_BASE` or `VITE_PUBLIC_SITE_ORIGIN` in `.env.local` to override it.

## Validation

```bash
npm test
npm run build
npx wrangler deploy --dry-run
```

Or run the complete gate:

```bash
npm run check
```

The stabilization checks cover public category removal, exact prompt slugs, D1-only live data, the flattened Admin dashboard, authenticated operations, pinned dependencies and deployment configuration.

## Database migrations

Apply the complete migration chain locally:

```bash
npx wrangler d1 migrations apply promptstan-db --local
```

Apply pending migrations to production only from an authorized release environment:

```bash
npx wrangler d1 migrations apply promptstan-db --remote
```

Migrations are additive and live in `database/migrations`. `database/schema.sql` is the current consolidated reference schema.

## Deployment

Pull requests run the stabilization workflow. Merges to `master` run the Cloudflare deployment workflow, which validates the app, applies pending D1 migrations, deploys the Worker and Pages app, and verifies the health endpoint.

The Worker is configured with the current compatibility date, Node.js compatibility and Workers observability. Secrets such as `ADMIN_TOKEN` and API credentials must be stored as Cloudflare or GitHub secrets and must never be committed.

## Operations

- `GET /api/health` reports deployed capabilities, including `stabilization: single-source-v1`.
- `GET /api/admin/export` downloads a protected JSON backup of the content and automation configuration.
- `POST /api/admin/library/restore` restores protected Admin library data.
- `POST /api/bootstrap` is retained for controlled recovery and requires Admin bearer authentication.

Before a production migration or large content change, download an Admin backup and verify the latest deployment workflow completed successfully.
