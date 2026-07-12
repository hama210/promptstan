import assert from 'node:assert/strict';
import {
  GROWTH_INTELLIGENCE_VERSION,
  buildGrowthPreference,
  buildRecommendationCards,
  normalizeTotals,
  rankCampaignRows,
  rankCategoryRows,
  rankContentGaps,
  rankLocalHours,
  rankPromptRows
} from '../worker/growth-intelligence.js';

assert.equal(GROWTH_INTELLIGENCE_VERSION, 'conversion-intelligence-v1');

const totals = normalizeTotals({
  referrals: 100,
  views: 70,
  copies: 14,
  favorites: 7,
  shares: 5,
  total_events: 196
});
assert.equal(totals.landing_rate, 70);
assert.equal(totals.copy_rate, 20);
assert.equal(totals.favorite_rate, 10);
assert.equal(totals.conversion_rate, 30);
assert.equal(totals.conversions, 21);

const campaigns = rankCampaignRows([
  { source: 'whatsapp', medium: 'social', campaign: 'summer', referrals: 50, views: 40, copies: 10, favorites: 4, shares: 3 },
  { source: 'tiktok', medium: 'social', campaign: 'viral', referrals: 80, views: 20, copies: 1, favorites: 0, shares: 2 },
  { source: 'telegram', medium: 'social', campaign: 'kurdish', referrals: 20, views: 18, copies: 6, favorites: 3, shares: 4 }
]);
assert.equal(campaigns[0].campaign, 'summer', 'Highest weighted campaign should rank first');
assert.equal(campaigns.find((item) => item.campaign === 'kurdish').conversion_rate, 50);

const prompts = rankPromptRows([
  { slug: 'kurdish-couple', title: 'Kurdish Couple', category: 'kurdish-style', category_name: 'Kurdish Style', rotation_key: 'two-people-kurdish-traditional-erbil-citadel', referrals: 20, views: 30, copies: 12, favorites: 5, shares: 7 },
  { slug: 'suit-portrait', title: 'Suit Portrait', category: 'outfit', category_name: 'Outfit', rotation_key: 'one-person-professional-suit-premium-studio', referrals: 30, views: 40, copies: 3, favorites: 1, shares: 2 }
]);
assert.equal(prompts[0].slug, 'kurdish-couple');
assert.ok(prompts[0].score > prompts[1].score);

const categories = rankCategoryRows([
  { category: 'kurdish-style', category_name: 'Kurdish Style', views: 60, copies: 18, favorites: 8, shares: 10 },
  { category: 'outfit', category_name: 'Outfit', views: 80, copies: 5, favorites: 2, shares: 3 }
]);
assert.equal(categories[0].category, 'kurdish-style');

const gaps = rankContentGaps([
  { query: 'kurdish wedding couple', searches: 12, average_results: 1, max_results: 2 },
  { query: 'movie style', searches: 10, average_results: 8, max_results: 12 },
  { query: 'rain portrait', searches: 5, average_results: 0, max_results: 0 }
]);
assert.equal(gaps[0].query, 'kurdish wedding couple');
assert.ok(gaps[0].gap_score > gaps[1].gap_score);

const preference = buildGrowthPreference({ prompts, categories, contentGaps: gaps });
assert.equal(preference.active, true);
assert.ok(preference.tokens.some((item) => item.token === 'kurdish'));
assert.equal(preference.categories[0].category, 'kurdish-style');

const bestHours = rankLocalHours([
  { event_type: 'copy', created_at: '2026-07-12 15:00:00' },
  { event_type: 'favorite', created_at: '2026-07-12 15:15:00' },
  { event_type: 'share', created_at: '2026-07-12 15:30:00' },
  { event_type: 'copy', created_at: '2026-07-12 08:00:00' }
], 180);
assert.equal(bestHours[0].hour, 18, '15:00 UTC should become 18:00 Iraq time');
assert.equal(bestHours[0].conversions, 3);

const recommendations = buildRecommendationCards({
  totals,
  campaigns,
  prompts,
  categories,
  contentGaps: gaps,
  bestHours,
  preference
});
assert.ok(recommendations.some((item) => item.type === 'content-winner'));
assert.ok(recommendations.some((item) => item.type === 'content-gap'));
assert.ok(recommendations.some((item) => item.type === 'campaign-winner'));
assert.ok(recommendations.some((item) => item.type === 'timing'));

console.log(JSON.stringify({
  ok: true,
  version: GROWTH_INTELLIGENCE_VERSION,
  totals,
  top_campaign: campaigns[0],
  top_prompt: prompts[0],
  top_gap: gaps[0],
  preference,
  best_hour: bestHours[0],
  recommendation_types: recommendations.map((item) => item.type)
}, null, 2));
