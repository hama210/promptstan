# PromptStan Phase 6 Automation

## Default schedule

- Time zone: UTC+03:00 (Iraq/Kurdistan)
- Prompt posting: enabled
- Posting time: 09:00 local time
- Posting days: every day
- Automatic image batches: disabled until enabled from Admin
- Manual or automatic batch size: 1–3 prompts

Cloudflare runs an hourly schedule check. The Worker converts the current UTC time to the saved local offset and acts only when the selected hour and day match. A D1 automation record prevents the same scheduled task from running twice on one local date.

## Admin controls

The **Bot Schedule & Image Batches** panel supports:

- enabling or disabling automatic prompt publishing
- choosing the local posting hour
- choosing active weekdays
- choosing the time-zone offset
- enabling one automatic Before/After batch per day
- choosing the image-batch hour and safe batch size
- viewing Missing, Failed, Generating, and Ready image counts
- running a small image batch manually
- reviewing recent automation runs

## Safety

- Duplicate and near-duplicate prompts are blocked before image generation.
- Automatic prompts must pass the quality threshold.
- Image batches are capped at three prompts per run.
- Existing image-job locking prevents simultaneous work on the same prompt.
- Failed image jobs are prioritized for retry, followed by the oldest missing images.
