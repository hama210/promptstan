# Promptstan Worker API

This folder is the backend plan for Cloudflare Workers + D1 + R2.

## Planned endpoints

- `GET /api/prompts` - list prompts
- `GET /api/prompts/:slug` - single prompt
- `GET /api/categories` - list categories
- `GET /api/tags/trending` - trending tags
- `POST /api/prompts/:id/copy` - increase copy count
- `POST /api/prompts/:id/view` - increase view count

## Planned bindings

- `DB` - Cloudflare D1 database
- `PROMPT_IMAGES` - Cloudflare R2 bucket

The current React app still uses `src/data/site.js`. We will switch it to the API after the Worker is ready.
