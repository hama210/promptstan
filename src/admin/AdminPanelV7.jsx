import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, CheckCircle2, Clock3, Images, Play, RefreshCw, Save, TimerReset } from 'lucide-react';
import AdminPanelV6 from './AdminPanelV6.jsx';

const API_BASE = window.location.hostname.includes('workers.dev')
  ? window.location.origin
  : 'https://promptstan-api.hhhh46529.workers.dev';

const DEFAULT_SETTINGS = {
  posting_enabled: true,
  posting_hour_local: 9,
  posting_days: [0, 1, 2, 3, 4, 5, 6],
  timezone_offset_minutes: 180,
  image_batch_enabled: false,
  image_batch_hour_local: 3,
  image_batch_size: 1
};

const DAYS = [
  { value: 0, label: 'Sun', ku: 'یەکشەممە' },
  { value: 1, label: 'Mon', ku: 'دووشەممە' },
  { value: 2, label: 'Tue', ku: 'سێشەممە' },
  { value: 3, label: 'Wed', ku: 'چوارشەممە' },
  { value: 4, label: 'Thu', ku: 'پێنجشەممە' },
  { value: 5, label: 'Fri', ku: 'هەینی' },
  { value: 6, label: 'Sat', ku: 'شەممە' }
];

const TIMEZONE_OPTIONS = [
  -720, -660, -600, -540, -480, -420, -360, -300, -240, -180, -120, -60,
  0, 60, 120, 180, 210, 240, 270, 300, 330, 345, 360, 390, 420, 480, 540, 570, 600, 660, 720, 780, 840
];

export default function AdminPanelV7() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [queue, setQueue] = useState(null);
  const [history, setHistory] = useState([]);
  const [nextPosting, setNextPosting] = useState(null);
  const [message, setMessage] = useState('');
  const [working, setWorking] = useState('');

  useEffect(() => {
    if (getToken()) loadAutomation(false);
  }, []);

  const selectedDaysLabel = useMemo(() => {
    if (settings.posting_days.length === 7) return 'Every day';
    return DAYS.filter((day) => settings.posting_days.includes(day.value)).map((day) => day.label).join(', ') || 'No days';
  }, [settings.posting_days]);

  function getToken() {
    return localStorage.getItem('promptstan-admin-token') || '';
  }

  function authHeaders(extra = {}) {
    const token = getToken();
    return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
  }

  async function readJson(response) {
    const text = await response.text();
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`API returned an invalid response (${response.status}).`);
    }
  }

  async function loadAutomation(showMessage = true) {
    if (!getToken()) {
      setMessage('Save ADMIN_TOKEN below first.');
      return;
    }

    setWorking('load');
    if (showMessage) setMessage('Loading schedule and image queue...');
    try {
      const [settingsResponse, queueResponse, historyResponse] = await Promise.all([
        fetch(`${API_BASE}/api/admin/automation/settings`, { headers: authHeaders(), cache: 'no-store' }),
        fetch(`${API_BASE}/api/admin/images/queue`, { headers: authHeaders(), cache: 'no-store' }),
        fetch(`${API_BASE}/api/admin/automation/history?limit=12`, { headers: authHeaders(), cache: 'no-store' })
      ]);

      const settingsData = await readJson(settingsResponse);
      const queueData = await readJson(queueResponse);
      const historyData = await readJson(historyResponse);
      if (!settingsResponse.ok) throw new Error(settingsData.error || 'Could not load schedule');
      if (!queueResponse.ok) throw new Error(queueData.error || 'Could not load image queue');
      if (!historyResponse.ok) throw new Error(historyData.error || 'Could not load automation history');

      setSettings(settingsData.settings || DEFAULT_SETTINGS);
      setNextPosting(settingsData.next_posting || null);
      setQueue(queueData.queue || null);
      setHistory(historyData.history || []);
      if (showMessage) setMessage('Automation controls updated ✅');
    } catch (error) {
      setMessage(error.message || 'Automation connection failed.');
    } finally {
      setWorking('');
    }
  }

  async function saveSchedule() {
    if (!getToken()) {
      setMessage('Save ADMIN_TOKEN below first.');
      return;
    }

    setWorking('save');
    setMessage('Saving the new schedule...');
    try {
      const response = await fetch(`${API_BASE}/api/admin/automation/settings`, {
        method: 'PUT',
        headers: authHeaders({ 'content-type': 'application/json' }),
        body: JSON.stringify(settings)
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || 'Could not save schedule');
      setSettings(data.settings || settings);
      setNextPosting(data.next_posting || null);
      setMessage('Schedule saved ✅ Cloudflare will apply it on the next hourly check.');
    } catch (error) {
      setMessage(error.message || 'Schedule save failed.');
    } finally {
      setWorking('');
    }
  }

  async function runImageBatch() {
    if (!getToken()) {
      setMessage('Save ADMIN_TOKEN below first.');
      return;
    }

    setWorking('batch');
    setMessage(`Generating up to ${settings.image_batch_size} missing Before/After set(s)...`);
    try {
      const response = await fetch(`${API_BASE}/api/admin/images/batch`, {
        method: 'POST',
        headers: authHeaders({ 'content-type': 'application/json' }),
        body: JSON.stringify({ limit: settings.image_batch_size })
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || 'Image batch failed');

      if (data.empty) setMessage('The image queue is empty ✅');
      else setMessage(`Image batch complete: ${data.succeeded} succeeded, ${data.failed} failed.`);
      await loadAutomation(false);
    } catch (error) {
      setMessage(error.message || 'Image batch failed.');
    } finally {
      setWorking('');
    }
  }

  function toggleDay(day) {
    setSettings((current) => {
      const exists = current.posting_days.includes(day);
      const posting_days = exists
        ? current.posting_days.filter((value) => value !== day)
        : [...current.posting_days, day].sort();
      return { ...current, posting_days };
    });
  }

  return <>
    <section className="adminCard automationCard" style={{ margin: '20px auto 0', maxWidth: 1180 }} dir="rtl">
      <div className="automationHeader">
        <div>
          <span className="automationBadge"><CalendarClock size={16} /> Phase 6 · Automation</span>
          <div className="adminCardTitle"><Clock3 size={23} /><h2>Bot Schedule &amp; Image Batches</h2></div>
          <p>کاتی بڵاوکردنەوەی بۆت، ڕۆژەکان و ناوچەی کات هەڵبژێرە. وێنەکانی Before/After بە batch ـی بچووک دروست دەکرێن بۆ ئەوەی timeout و تێچووی لەناکاو ڕوونەدات.</p>
        </div>
        <div className={settings.posting_enabled ? 'automationState active' : 'automationState'}><CheckCircle2 size={23} /><strong>{settings.posting_enabled ? 'Schedule ON' : 'Schedule OFF'}</strong><span>Hourly Cloudflare check</span></div>
      </div>

      <div className="automationGrid">
        <div className="automationSection">
          <div className="automationSectionTitle"><CalendarClock size={19} /><div><strong>Prompt posting schedule</strong><span>{selectedDaysLabel}</span></div></div>
          <label className="automationToggle"><input type="checkbox" checked={settings.posting_enabled} onChange={(event) => setSettings({ ...settings, posting_enabled: event.target.checked })} /><span>Enable automatic prompt posting</span></label>

          <div className="automationFields">
            <label>Local posting hour
              <select value={settings.posting_hour_local} onChange={(event) => setSettings({ ...settings, posting_hour_local: Number(event.target.value) })}>
                {Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{formatHour(hour)}</option>)}
              </select>
            </label>
            <label>Time-zone offset
              <select value={settings.timezone_offset_minutes} onChange={(event) => setSettings({ ...settings, timezone_offset_minutes: Number(event.target.value) })}>
                {TIMEZONE_OPTIONS.map((minutes) => <option key={minutes} value={minutes}>{formatOffset(minutes)}{minutes === 180 ? ' · Iraq/Kurdistan' : ''}</option>)}
              </select>
            </label>
          </div>

          <div className="automationDays">{DAYS.map((day) => <button type="button" key={day.value} className={settings.posting_days.includes(day.value) ? 'active' : ''} onClick={() => toggleDay(day.value)}><strong>{day.label}</strong><span>{day.ku}</span></button>)}</div>

          <div className="nextSchedule"><TimerReset size={18} /><div><span>Next scheduled posting</span><strong>{formatNextPosting(nextPosting, settings)}</strong></div></div>
        </div>

        <div className="automationSection">
          <div className="automationSectionTitle"><Images size={19} /><div><strong>Managed Before/After batches</strong><span>Maximum 3 prompts per run</span></div></div>
          <label className="automationToggle"><input type="checkbox" checked={settings.image_batch_enabled} onChange={(event) => setSettings({ ...settings, image_batch_enabled: event.target.checked })} /><span>Run one automatic image batch daily</span></label>

          <div className="automationFields">
            <label>Automatic batch hour
              <select value={settings.image_batch_hour_local} onChange={(event) => setSettings({ ...settings, image_batch_hour_local: Number(event.target.value) })}>
                {Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{formatHour(hour)}</option>)}
              </select>
            </label>
            <label>Prompts per batch
              <select value={settings.image_batch_size} onChange={(event) => setSettings({ ...settings, image_batch_size: Number(event.target.value) })}>
                <option value="1">1 prompt</option>
                <option value="2">2 prompts</option>
                <option value="3">3 prompts</option>
              </select>
            </label>
          </div>

          <div className="imageQueueStats">
            <div><span>Missing</span><strong>{queue?.missing ?? '—'}</strong></div>
            <div><span>Failed</span><strong>{queue?.failed ?? '—'}</strong></div>
            <div><span>Generating</span><strong>{queue?.generating ?? '—'}</strong></div>
            <div><span>Ready</span><strong>{queue?.ready ?? '—'}</strong></div>
          </div>

          <div className="imageQueuePreview"><span>Next in queue</span>{queue?.next?.length ? queue.next.slice(0, 3).map((item) => <div key={item.id}><strong>{item.title_ku || item.title_en || item.slug}</strong><small>{item.image_status || 'pending'}</small></div>) : <p>No queued prompts loaded.</p>}</div>
        </div>
      </div>

      <div className="automationActions">
        <button type="button" onClick={() => loadAutomation(true)} disabled={Boolean(working)}><RefreshCw size={17} /> {working === 'load' ? 'Loading...' : 'Refresh'}</button>
        <button type="button" onClick={runImageBatch} disabled={Boolean(working)}><Play size={17} /> {working === 'batch' ? 'Generating...' : 'Run image batch now'}</button>
        <button type="button" className="automationSave" onClick={saveSchedule} disabled={Boolean(working) || !settings.posting_days.length}><Save size={17} /> {working === 'save' ? 'Saving...' : 'Save schedule'}</button>
      </div>

      {message && <div className="adminMessage automationMessage">{message}</div>}

      {history.length > 0 && <div className="automationHistory"><h3>Recent automation runs</h3><div>{history.slice(0, 8).map((run) => <article key={run.id}><span className={`runStatus ${run.status}`}>{run.status}</span><strong>{run.run_type}</strong><small>{run.local_date || 'manual'} · {run.source}</small><b>{run.succeeded}/{run.processed}</b></article>)}</div></div>}
    </section>

    <AdminPanelV6 />
  </>;
}

function formatHour(hour) {
  const normalized = Number(hour) % 24;
  const suffix = normalized >= 12 ? 'PM' : 'AM';
  const twelve = normalized % 12 || 12;
  return `${String(twelve).padStart(2, '0')}:00 ${suffix}`;
}

function formatOffset(minutes) {
  const sign = minutes >= 0 ? '+' : '-';
  const absolute = Math.abs(minutes);
  const hours = Math.floor(absolute / 60);
  const mins = absolute % 60;
  return `UTC${sign}${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function formatNextPosting(nextPosting, settings) {
  if (!settings.posting_enabled) return 'Automatic posting is disabled';
  if (!settings.posting_days.length) return 'Select at least one day';
  if (!nextPosting?.utc) return `${formatHour(settings.posting_hour_local)} · ${formatOffset(settings.timezone_offset_minutes)}`;
  const date = new Date(nextPosting.utc);
  if (Number.isNaN(date.getTime())) return `${nextPosting.local_date} at ${formatHour(nextPosting.local_hour)}`;
  return `${nextPosting.local_date} at ${formatHour(nextPosting.local_hour)} (${formatOffset(nextPosting.timezone_offset_minutes)})`;
}
