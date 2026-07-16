import { useEffect, useState } from 'react';
import {
  Activity,
  Archive,
  CheckCircle2,
  Clock3,
  Database,
  EyeOff,
  FileCheck2,
  Flag,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldAlert,
  Trash2,
  Wand2
} from 'lucide-react';
import { API_BASE } from '../config/runtime.js';

const RETENTION_CONFIRMATION = 'DELETE_OLD_OPERATIONAL_DATA';
const defaultSettings = {
  retention_enabled: false,
  analytics_retention_days: 90,
  operational_retention_days: 180
};

export default function AdminPanelV9() {
  const [report, setReport] = useState(null);
  const [prompts, setPrompts] = useState([]);
  const [filter, setFilter] = useState('all');
  const [settings, setSettings] = useState(defaultSettings);
  const [preview, setPreview] = useState(null);
  const [drill, setDrill] = useState(null);
  const [message, setMessage] = useState('');
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (getToken()) loadOperations(false);
  }, [filter]);

  function getToken() {
    return localStorage.getItem('promptstan-admin-token') || '';
  }

  function authHeaders(json = false) {
    const token = getToken();
    return {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(json ? { 'content-type': 'application/json' } : {})
    };
  }

  async function request(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, { cache: 'no-store', ...options });
    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { throw new Error(`Invalid API response (${response.status})`); }
    if (!response.ok) throw new Error(data.error || `Operation failed (${response.status})`);
    return data;
  }

  async function loadOperations(showMessage = true) {
    if (!getToken()) {
      if (showMessage) setMessage('Save ADMIN_TOKEN above first.');
      return;
    }
    setWorking(true);
    if (showMessage) setMessage('Refreshing product operations...');
    try {
      const [statusData, moderationData] = await Promise.all([
        request('/api/admin/operations/status', { headers: authHeaders() }),
        request(`/api/admin/operations/moderation?status=${encodeURIComponent(filter)}&limit=50`, { headers: authHeaders() })
      ]);
      setReport(statusData);
      setPrompts(moderationData.prompts || []);
      setSettings({ ...defaultSettings, ...(statusData.retention || {}) });
      if (showMessage) setMessage('Operations report updated ✅');
    } catch (error) {
      setMessage(error.message || 'Could not load operations report.');
    } finally {
      setWorking(false);
    }
  }

  async function moderate(prompt, status) {
    setWorking(true);
    setMessage(`Changing ${prompt.slug} to ${status}...`);
    try {
      await request(`/api/admin/operations/prompts/${prompt.id}`, {
        method: 'PATCH',
        headers: authHeaders(true),
        body: JSON.stringify({ status, reason: `Changed from Phase 9 operations panel` })
      });
      setMessage(`Prompt is now ${status} ✅`);
      await loadOperations(false);
    } catch (error) {
      setMessage(error.message || 'Moderation failed.');
      setWorking(false);
    }
  }

  async function saveRetention() {
    setWorking(true);
    setMessage('Saving retention policy...');
    try {
      const data = await request('/api/admin/operations/retention', {
        method: 'PUT',
        headers: authHeaders(true),
        body: JSON.stringify(settings)
      });
      setSettings(data.settings || settings);
      setMessage('Retention policy saved ✅');
      await loadOperations(false);
    } catch (error) {
      setMessage(error.message || 'Retention policy failed.');
      setWorking(false);
    }
  }

  async function previewRetention() {
    setWorking(true);
    setMessage('Calculating a safe cleanup preview...');
    try {
      const data = await request('/api/admin/operations/retention/preview', {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify(settings)
      });
      setPreview(data);
      setMessage(`Dry run complete: ${data.total_deletable || 0} old operational row(s) can be removed.`);
    } catch (error) {
      setMessage(error.message || 'Retention preview failed.');
    } finally {
      setWorking(false);
    }
  }

  async function runRetention() {
    if (!window.confirm('Delete only the old analytics and operational logs shown in the dry run? Prompt content and images stay protected.')) return;
    setWorking(true);
    setMessage('Cleaning old operational data...');
    try {
      const data = await request('/api/admin/operations/retention/run', {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({ confirm: RETENTION_CONFIRMATION, settings, source: 'admin' })
      });
      setMessage(`Cleanup complete ✅ ${data.total_deleted || 0} row(s) removed; prompt content was untouched.`);
      setPreview(null);
      await loadOperations(false);
    } catch (error) {
      setMessage(error.message || 'Retention cleanup failed.');
      setWorking(false);
    }
  }

  async function runRestoreDrill(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setWorking(true);
    setMessage('Validating backup without changing production data...');
    setDrill(null);
    try {
      const backup = JSON.parse(await file.text());
      const data = await request('/api/admin/operations/restore-drill', {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify(backup)
      });
      setDrill(data);
      setMessage(`Restore drill passed ✅ ${data.validation?.counts?.prompts || 0} prompt(s) validated; no changes applied.`);
    } catch (error) {
      setDrill({ ok: false, error: error.message });
      setMessage(error.message || 'Restore drill failed.');
    } finally {
      setWorking(false);
      event.target.value = '';
    }
  }

  async function recoverImages() {
    setWorking(true);
    setMessage('Recovering stale jobs and retrying one failed image...');
    try {
      const recovered = await request('/api/admin/operations/images/recover-stale', {
        method: 'POST',
        headers: authHeaders()
      });
      const batch = await request('/api/admin/images/batch', {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({ limit: 1 })
      });
      setMessage(`Image repair finished: ${recovered.recovered || 0} stale recovered, ${batch.succeeded || 0} retry succeeded, ${batch.failed || 0} failed.`);
      await loadOperations(false);
    } catch (error) {
      setMessage(error.message || 'Image recovery failed.');
      setWorking(false);
    }
  }

  const promptStats = report?.prompts || {};
  const automation = report?.automation || {};
  const deletable = preview?.deletable || {};

  return <section className="adminCard operationsCard" dir="rtl">
    <div className="operationsHeader">
      <div>
        <span className="operationsBadge"><Activity size={16} /> Phase 9 · Product Operations</span>
        <div className="adminCardTitle"><ShieldAlert size={23} /><h2>Moderation, Recovery &amp; Reliability</h2></div>
        <p>پرۆمپتەکان بەبێ سڕینەوە بشارەوە یان archive بکە، backup تاقی بکەرەوە و داتای کۆنی operational بە policy پاک بکەرەوە.</p>
      </div>
      <div className={report?.overall === 'healthy' ? 'operationsState healthy' : 'operationsState attention'}>
        {report?.overall === 'healthy' ? <CheckCircle2 size={25} /> : <ShieldAlert size={25} />}
        <strong>{report?.overall || 'not checked'}</strong>
        <span>{report?.version || 'product-operations-v1'}</span>
      </div>
    </div>

    <div className="operationsActions">
      <button type="button" onClick={() => loadOperations(true)} disabled={working}><RefreshCw size={17} /> Refresh report</button>
      <button type="button" onClick={recoverImages} disabled={working}><Wand2 size={17} /> Repair next image</button>
    </div>
    {message && <div className="adminMessage operationsMessage">{message}</div>}

    <div className="operationsStats">
      <OperationStat icon={<Database />} label="Published" value={promptStats.published} detail={`${promptStats.total || 0} total prompts`} />
      <OperationStat icon={<Flag />} label="Flagged" value={promptStats.flagged} detail={`${promptStats.hidden || 0} hidden · ${promptStats.archived || 0} archived`} />
      <OperationStat icon={<Wand2 />} label="Image failures" value={promptStats.image_failed} detail={`${promptStats.image_stale || 0} stale · ${promptStats.image_missing || 0} missing`} />
      <OperationStat icon={<Clock3 />} label="Unhealthy runs" value={automation.unhealthy_24h} detail={`${automation.unhealthy_7d || 0} in 7 days`} />
    </div>

    {report?.warnings?.length > 0 && <div className="operationsWarnings">{report.warnings.map((warning) => <span key={warning}><ShieldAlert size={15} /> {warning}</span>)}</div>}

    <div className="operationsGrid">
      <section className="operationsPanel moderationPanel">
        <div className="operationsPanelTitle"><Flag size={20} /><div><h3>Moderation queue</h3><span>Soft controls—no prompt content is deleted</span></div></div>
        <div className="moderationFilters">{['all', 'flagged', 'hidden', 'archived', 'published'].map((status) => <button type="button" key={status} className={filter === status ? 'active' : ''} onClick={() => setFilter(status)}>{status}</button>)}</div>
        <div className="moderationList">{prompts.length ? prompts.slice(0, 20).map((prompt) => <article key={prompt.id}>
          <div><strong>{prompt.title_ku || prompt.title_en || prompt.slug}</strong><small>{prompt.slug} · {prompt.moderation_status || 'published'}</small></div>
          <div className="moderationActions">
            <button title="Publish" onClick={() => moderate(prompt, 'published')} disabled={working}><CheckCircle2 size={15} /></button>
            <button title="Hide" onClick={() => moderate(prompt, 'hidden')} disabled={working}><EyeOff size={15} /></button>
            <button title="Flag" onClick={() => moderate(prompt, 'flagged')} disabled={working}><Flag size={15} /></button>
            <button title="Archive" onClick={() => moderate(prompt, 'archived')} disabled={working}><Archive size={15} /></button>
          </div>
        </article>) : <p>No prompts in this moderation view.</p>}</div>
      </section>

      <section className="operationsPanel retentionPanel">
        <div className="operationsPanelTitle"><Trash2 size={20} /><div><h3>Retention policy</h3><span>Only analytics and operational logs</span></div></div>
        <label className="operationsToggle"><input type="checkbox" checked={Boolean(settings.retention_enabled)} onChange={(event) => setSettings({ ...settings, retention_enabled: event.target.checked })} /> Run safe cleanup automatically once per day</label>
        <div className="retentionFields">
          <label>Analytics days<input type="number" min="30" max="730" value={settings.analytics_retention_days} onChange={(event) => setSettings({ ...settings, analytics_retention_days: Number(event.target.value) })} /></label>
          <label>Operations days<input type="number" min="30" max="730" value={settings.operational_retention_days} onChange={(event) => setSettings({ ...settings, operational_retention_days: Number(event.target.value) })} /></label>
        </div>
        <div className="retentionActions">
          <button onClick={saveRetention} disabled={working}><Save size={16} /> Save policy</button>
          <button onClick={previewRetention} disabled={working}><FileCheck2 size={16} /> Dry run</button>
          <button className="retentionDelete" onClick={runRetention} disabled={working || !preview}><Trash2 size={16} /> Clean previewed data</button>
        </div>
        {preview && <div className="retentionPreview"><strong>{preview.total_deletable || 0} deletable rows</strong><span>Analytics {deletable.prompt_events || 0}</span><span>Content logs {deletable.content_scale_events || 0}</span><span>Automation {deletable.automation_runs || 0}</span><span>Operations {deletable.operation_events || 0}</span><small>Prompts, categories, tags and settings stay protected.</small></div>}
      </section>

      <section className="operationsPanel restorePanel">
        <div className="operationsPanelTitle"><RotateCcw size={20} /><div><h3>Restore drill</h3><span>Validate a downloaded backup without writing data</span></div></div>
        <label className="restoreUpload"><FileCheck2 size={24} /><strong>Select PromptStan backup JSON</strong><span>Checks schema, references, duplicates and SHA-256 integrity.</span><input type="file" accept="application/json,.json" onChange={runRestoreDrill} disabled={working || !getToken()} /></label>
        {drill && <div className={drill.ok ? 'drillResult success' : 'drillResult failed'}><strong>{drill.ok ? 'Restore-ready ✅' : 'Drill failed'}</strong><span>{drill.ok ? `${drill.validation?.counts?.prompts || 0} prompts · 0 production changes` : drill.error || drill.validation?.errors?.join(', ')}</span></div>}
      </section>

      <section className="operationsPanel eventPanel">
        <div className="operationsPanelTitle"><Activity size={20} /><div><h3>Operations history</h3><span>Recent protected Admin actions</span></div></div>
        <div className="operationsHistory">{report?.operations?.recent?.length ? report.operations.recent.slice(0, 12).map((event) => <article key={event.id}><strong>{event.action}</strong><span>{event.status}</span><small>{formatTime(event.created_at)}</small></article>) : <p>No operations recorded yet.</p>}</div>
      </section>
    </div>
  </section>;
}

function OperationStat({ icon, label, value, detail }) {
  return <div>{icon}<span>{label}</span><strong>{value ?? '—'}</strong><small>{detail}</small></div>;
}

function formatTime(value) {
  if (!value) return '—';
  const date = new Date(String(value).replace(' ', 'T') + (String(value).includes('Z') ? '' : 'Z'));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}
