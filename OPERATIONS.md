# PromptStan Operations Runbook

## Daily check

1. Open `/admin` and save the Admin token locally if needed.
2. Open **Phase 9 · Product Operations**.
3. Refresh the report and review moderation, image failures, stale jobs and unhealthy automation runs.
4. If an image job is stale or failed, use **Repair next image** and refresh the report.

## Moderation

- **Published:** visible through the public API, prompt page, search and sitemap.
- **Hidden:** temporarily removed from every public surface.
- **Flagged:** removed publicly and placed first in the moderation queue.
- **Archived:** retained in D1 and backups but removed publicly.

The normal Admin prompt manager archives instead of permanently deleting. Re-publish an archived prompt from the Phase 9 moderation queue.

## Backup and restore drill

1. Use **Download backup** before migrations, bulk edits or retention changes.
2. Keep the JSON file private because it contains the full prompt library and operational configuration.
3. Upload the file to **Restore drill**.
4. Require `Restore-ready`, a valid SHA-256 integrity result and `0 production changes` before treating the backup as recovery-ready.

The restore drill validates structure, references, duplicate slugs, database conflicts and integrity without writing any content. The existing known-library restore remains available for controlled recovery of PromptStan's bundled seed library.

## Retention

- Retention is disabled by default.
- Analytics defaults to 90 days.
- Automation, content-scale and operations logs default to 180 days.
- A cleanup removes at most 1,000 rows per table per run.
- Prompts, categories, tags, relationships and settings are always protected.

Always run **Dry run** before manual cleanup. Automatic retention runs at most once per local day after it is explicitly enabled.

## Incident responses

### Prompt must disappear immediately

Set it to **Hidden** or **Flagged**. Confirm that `/api/prompts`, search, its prompt page and the sitemap no longer expose it.

### Accidental archive

Filter moderation by **Archived** and set the prompt back to **Published**. No content or image needs to be recreated.

### Failed or stuck image

Use **Repair next image**. This first marks jobs stuck for more than 15 minutes as retryable, then processes one failed or missing image to limit AI cost.

### Deployment problem

Check `/api/health` for both `product_operations: product-operations-v1` and `product_operations_schema: ready`, inspect the latest deployment workflow and review structured Worker logs for `admin_operation_failed`, `scheduled_retention_failed` or `retention_cleanup`.
