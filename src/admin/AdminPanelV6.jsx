import { useEffect, useState } from 'react';
import { Bot, CheckCircle2, Gauge, RefreshCw, ScanSearch, ShieldCheck, Sparkles } from 'lucide-react';
import AdminPanelV5 from './AdminPanelV5.jsx';

const API_BASE = window.location.hostname.includes('workers.dev')
  ? window.location.origin
  : 'https://promptstan-api.hhhh46529.workers.dev';

export default function AdminPanelV6() {
  const [status, setStatus] = useState(null);
  const [scan, setScan] = useState(null);
  const [message, setMessage] = useState('');
  const [working, setWorking] = useState('');

  useEffect(() => {
    if (getToken()) loadStatus(false);
  }, []);

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

  async function loadStatus(showMessage = true) {
    if (!getToken()) {
      setMessage('Save ADMIN_TOKEN below first.');
      return;
    }

    setWorking('status');
    if (showMessage) setMessage('Loading Phase 6 status...');
    try {
      const response = await fetch(`${API_BASE}/api/admin/content-scale/status`, {
        headers: authHeaders(),
        cache: 'no-store'
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || 'Could not load content scale status');
      setStatus(data);
      if (showMessage) setMessage('Phase 6 status updated ✅');
    } catch (error) {
      setMessage(error.message || 'Content scale connection failed.');
    } finally {
      setWorking('');
    }
  }

  async function scanDuplicates() {
    if (!getToken()) {
      setMessage('Save ADMIN_TOKEN below first.');
      return;
    }

    setWorking('scan');
    setMessage('Scanning the current prompt library for near-duplicates...');
    try {
      const response = await fetch(`${API_BASE}/api/admin/content-scale/scan`, {
        method: 'POST',
        headers: authHeaders(),
        cache: 'no-store'
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || 'Duplicate scan failed');
      setScan(data);
      setMessage(data.duplicate_pairs
        ? `Scan complete: ${data.duplicate_pairs} possible duplicate pair(s) found.`
        : `Scan complete: ${data.scanned} prompts checked and no near-duplicates found ✅`);
      await loadStatus(false);
    } catch (error) {
      setMessage(error.message || 'Duplicate scan failed.');
    } finally {
      setWorking('');
    }
  }

  async function publishNextSafePrompt() {
    if (!getToken()) {
      setMessage('Save ADMIN_TOKEN below first.');
      return;
    }

    setWorking('publish');
    setMessage('Checking uniqueness, scoring quality, and publishing the next safe prompt...');
    try {
      const response = await fetch(`${API_BASE}/api/admin/daily/run`, {
        method: 'POST',
        headers: authHeaders(),
        cache: 'no-store'
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || data.reason || 'Safe publish failed');

      if (data.skipped) {
        setMessage(data.reason || 'A daily prompt has already been published today.');
      } else {
        setMessage(`Published safely ✅ ${data.slug} · Quality ${data.quality_score}/100 · ${data.searched_candidates || 1} candidate(s) checked.`);
      }
      await loadStatus(false);
    } catch (error) {
      setMessage(error.message || 'Safe publishing failed.');
    } finally {
      setWorking('');
    }
  }

  const next = status?.next_candidate;

  return <>
    <section className="adminCard phase6Card" style={{ margin: '20px auto 0', maxWidth: 1180 }} dir="rtl">
      <div className="phase6Header">
        <div>
          <span className="phase6Badge"><Sparkles size={16} /> Phase 6 · Content Scale</span>
          <div className="adminCardTitle"><ShieldCheck size={23} /><h2>Duplicate Protection &amp; Smart Rotation</h2></div>
          <p>هەموو پرۆمپتی دەستی و بۆت پێش بڵاوکردنەوە پشکنین دەکرێت. پرۆمپتی دووبارە یان زۆر هاوشێوە ڕەت دەکرێتەوە و بۆت لە نێوان سەدان ترکیبی جیاوازدا دەسوڕێتەوە.</p>
        </div>
        <div className="phase6Protection"><CheckCircle2 size={24} /><strong>Protection ON</strong><span>{status?.version || 'content-safety-v1'}</span></div>
      </div>

      <div className="adminGrid phase6Stats">
        <div className="adminCard statCard"><ShieldCheck size={26} /><span>Duplicates blocked</span><strong>{status?.duplicates_blocked ?? '—'}</strong><small>Exact + near-duplicate checks</small></div>
        <div className="adminCard statCard"><Bot size={26} /><span>Bot prompts</span><strong>{status?.bot_prompts_published ?? '—'}</strong><small>Protected automatic posts</small></div>
        <div className="adminCard statCard"><RefreshCw size={26} /><span>Rotation combinations</span><strong>{status?.rotation_count ?? 240}</strong><small>Subject × style × scene</small></div>
        <div className="adminCard statCard"><Gauge size={26} /><span>Minimum bot quality</span><strong>{status?.bot_min_quality ?? 70}</strong><small>Out of 100</small></div>
      </div>

      <div className="phase6Candidate">
        <div className="phase6CandidateTitle"><Bot size={21} /><div><span>Next unique bot candidate</span><strong>{next?.title_ku || next?.title_en || 'Save ADMIN_TOKEN and refresh to preview'}</strong></div></div>
        {next && <div className="phase6CandidateMeta"><span>Quality {next.quality_score}/100</span><span>{next.category}</span><span>{next.rotation_key}</span><span>{next.searched} checked</span></div>}
        {next?.tags?.length > 0 && <div className="phase6Tags">{next.tags.slice(0, 7).map((tag) => <span key={tag}>#{tag}</span>)}</div>}
      </div>

      <div className="phase6Actions">
        <button type="button" onClick={() => loadStatus(true)} disabled={Boolean(working)}><RefreshCw size={17} /> {working === 'status' ? 'Loading...' : 'Refresh preview'}</button>
        <button type="button" onClick={scanDuplicates} disabled={Boolean(working)}><ScanSearch size={17} /> {working === 'scan' ? 'Scanning...' : 'Scan current library'}</button>
        <button type="button" className="phase6Publish" onClick={publishNextSafePrompt} disabled={Boolean(working)}><Bot size={17} /> {working === 'publish' ? 'Publishing...' : 'Publish next safe prompt'}</button>
      </div>

      {message && <div className="adminMessage phase6Message">{message}</div>}

      {scan && <div className="phase6ScanResults">
        <div><strong>{scan.scanned}</strong><span>prompts scanned</span></div>
        <div><strong>{scan.duplicate_pairs}</strong><span>possible pairs</span></div>
        {scan.duplicates?.length > 0 && <ol>{scan.duplicates.slice(0, 10).map((item) => <li key={`${item.prompt_id}-${item.duplicate_id}`}><div><strong>{item.prompt_title}</strong><span>{item.duplicate_title}</span></div><b>{Math.round(item.similarity * 100)}%</b></li>)}</ol>}
      </div>}
    </section>

    <AdminPanelV5 />
  </>;
}
