import assert from 'node:assert/strict';
import {
  AUTOMATION_VERSION,
  DEFAULT_AUTOMATION_SETTINGS,
  getLocalScheduleParts,
  getNextScheduledPosting,
  normalizeAutomationSettings,
  shouldRunImageBatch,
  shouldRunPosting
} from '../worker/automation.js';

assert.equal(AUTOMATION_VERSION, 'dynamic-schedule-v1');

const iraqSettings = normalizeAutomationSettings({
  posting_enabled: true,
  posting_hour_local: 9,
  posting_days: [0, 1, 2, 3, 4, 5, 6],
  timezone_offset_minutes: 180,
  image_batch_enabled: true,
  image_batch_hour_local: 3,
  image_batch_size: 3
});

const utcSix = new Date('2026-07-12T06:00:00.000Z');
const local = getLocalScheduleParts(iraqSettings, utcSix);
assert.equal(local.hour, 9, '06:00 UTC must become 09:00 in Iraq/Kurdistan');
assert.equal(local.date, '2026-07-12');
assert.equal(shouldRunPosting(iraqSettings, utcSix), true, 'Posting should run at the configured local hour');
assert.equal(shouldRunPosting(iraqSettings, new Date('2026-07-12T05:00:00.000Z')), false, 'Posting must not run an hour early');

const batchTime = new Date('2026-07-12T00:00:00.000Z');
assert.equal(shouldRunImageBatch(iraqSettings, batchTime), true, '00:00 UTC must match the 03:00 Iraq image batch');

const weekdaysOnly = normalizeAutomationSettings({
  ...iraqSettings,
  posting_days: [1, 2, 3, 4, 5]
});
assert.equal(shouldRunPosting(weekdaysOnly, utcSix), false, 'Sunday should be skipped when only weekdays are selected');

const clamped = normalizeAutomationSettings({
  posting_hour_local: 99,
  timezone_offset_minutes: 9999,
  image_batch_size: 20,
  posting_days: '6,6,2,bad'
});
assert.equal(clamped.posting_hour_local, 23);
assert.equal(clamped.timezone_offset_minutes, 840);
assert.equal(clamped.image_batch_size, 3);
assert.deepEqual(clamped.posting_days, [2, 6]);

const next = getNextScheduledPosting({
  ...DEFAULT_AUTOMATION_SETTINGS,
  posting_hour_local: 10,
  timezone_offset_minutes: 180,
  posting_days: [0]
}, new Date('2026-07-12T05:00:00.000Z'));
assert.ok(next, 'A next scheduled posting should be calculated');
assert.equal(next.local_date, '2026-07-12');
assert.equal(next.local_hour, 10);

console.log(JSON.stringify({
  ok: true,
  version: AUTOMATION_VERSION,
  iraq_local_time: local,
  next_posting: next,
  clamped_settings: clamped
}, null, 2));
