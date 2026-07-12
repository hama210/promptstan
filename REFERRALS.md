# PromptStan referral and campaign tracking

PromptStan now supports privacy-friendly campaign attribution.

## Tracked link fields

- `utm_source` — WhatsApp, Telegram, Facebook, TikTok, Instagram, X, copy or custom source
- `utm_medium` — social, copy, native-share or referral
- `utm_campaign` — campaign name
- `utm_content` — prompt slug
- `ref` — short source alias

## Privacy

The system records the campaign fields, prompt slug, optional referrer hostname and timestamp. It does not record IP addresses, personal accounts, device fingerprints or conversation data.

## Admin

The Admin dashboard shows referral totals, top sources and top campaigns. The Campaign Link Builder creates tagged homepage or prompt links for external posts.
