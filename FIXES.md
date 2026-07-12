# Admin library restoration fix

- Fixed Safari/CORS preflight failures for protected admin endpoints.
- Added an idempotent D1 restore for all 24 built-in PromptStan prompts.
- Preserves existing manually posted and bot-created D1 prompts.
- Added **Restore all prompts** to the admin repair controls.
- Improved mobile layout and analytics loading messages.
- Deployment bootstrap now restores missing known prompts instead of stopping after one starter record.
