import { useEffect, useState } from 'react';
import { BarChart3, RefreshCw, Search, Share2, ShieldCheck, Wand2 } from 'lucide-react';
import AdminPanelV4 from './AdminPanelV4.jsx';

const API_BASE = window.location.hostname.includes('workers.dev') ? window.location.origin : 'https://promptstan-api.hhhh46529.workers.dev';

export default function AdminPanelV5() {
  const [message, setMessage] = useState('');
  const [working, setWorking] = useState(false);
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    if (getToken()) loadAnalytics();
  }, []);

  function getToken() {
    return localStorage.getItem('promptstan-admin-token') || '';
  }

  function getAuthHeaders() {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function loadAnalytics(showStatus = false) {
    if (!getToken()) {
      if (showStatus) setMessage('Save ADMIN_TOKEN in the panel first.');
      return;
    }

    if (showStatus) {
      setWorking(true);
      setMessage('Loading growth analytics...');
    }

    try {
      const response = await fetch(`${API_BASE}/api/admin/analytics`, {
        headers: getAuthHeaders(),
        cache: 'no-store'
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Analytics failed');
      setAnalytics(data);
      if (showStatus) setMessage('Growth analytics updated.');
    } catch (error) {
      if (showStatus) setMessage(error.message);
    } finally {
      if (showStatus) setWorking(false);
    }
  }

  async function checkSystem() {
    if (!getToken()) {
      setMessage('Save ADMIN_TOKEN in the panel first.');
      return;
    }

    setWorking(true);
    setMessage('Checking Cloudflare bindings...');
    try {
      const response = await fetch(`${API_BASE}/api/admin/system`, { headers: getAuthHeaders(), cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'System check failed');
      const status = data.status || {};
      const provider = status.image_provider === 'openai' ? 'OpenAI' : status.image_provider === 'workers-ai' ? 'Workers AI' : 'Missing';
      setMessage(`D1 ${status.database ? '✅' : '❌'} · R2 ${status.r2 ? '✅' : '❌'} · Images: ${provider} ${status.image_provider ? '✅' : '❌'} · Analytics ${status.growth_phase ? '✅' : '❌'} · Admin token ${status.admin_token ? '✅' : '❌'}`);
      await loadAnalytics();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setWorking(false);
    }
  }

  async function retryMissingImages() {
    if (!getToken()) {
      setMessage('Save ADMIN_TOKEN in the panel first.');
      return;
    }

    setWorking(true);
    setMessage('Finding prompts with missing or failed images...');
    try {
      const response = await fetch(`${API_BASE}/api/prompts`, { cache: 'no-store' });
      const prompts = await response.json();
      if (!response.ok || !Array.isArray(prompts)) throw new Error(prompts.error || 'Could not load prompts');

      const targets = prompts.filter((prompt) => !prompt.before_image_url || !prompt.after_image_url || prompt.image_status === 'failed');
      if (!targets.length) {
        setMessage('All prompts already have Before/After images.');
        return;
      }

      let started = 0;
      let failed = 0;
      for (const prompt of targets) {
        const retryResponse = await fetch(`${API_BASE}/api/admin/prompts/${prompt.id}/images/retry`, {
          method: 'POST',
          headers: getAuthHeaders()
        });
        if (retryResponse.ok) started += 1;
        else failed += 1;
      }

      setMessage(`Image generation started for ${started} prompt(s)${failed ? `; ${failed} failed to start` : ''}. Refresh after generation finishes.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setWorking(false);
    }
  }

  const totals = analytics?.totals || {};

  return <>
    <section className="adminCard" style={{ margin: '20px auto 0', maxWidth: 1180 }} dir="rtl">
      <div className="adminCardTitle"><ShieldCheck size={22} /><h2>Cloudflare &amp; Image Repair</h2></div>
      <p>پشکنینی D1، R2 و Workers AI بکە، یان وێنەکانی Before/After ـی نەبوو یان شکستخواردوو دووبارە دروست بکەرەوە.</p>
      <div className="adminTokenRow">
        <button type="button" onClick={checkSystem} disabled={working}><ShieldCheck size={17} /> Check system</button>
        <button type="button" onClick={retryMissingImages} disabled={working}><Wand2 size={17} /> Retry missing images</button>
        <button type="button" onClick={() => loadAnalytics(true)} disabled={working}><BarChart3 size={17} /> Refresh analytics</button>
        {working && <span><RefreshCw size={16} /> Working...</span>}
      </div>
      {message && <div className="adminMessage" style={{ marginTop: 12 }}>{message}</div>}
    </section>

    <section className="adminCard growthAnalytics" style={{ margin: '16px auto 0', maxWidth: 1180 }} dir="rtl">
      <div className="adminCardTitle"><BarChart3 size={22} /><h2>Growth Analytics</h2></div>
      <p>ئەم ئامارانە تەنها Share، گەڕان، ناوی پرۆمپت و کاتی ڕووداوەکە تۆمار دەکەن؛ IP یان زانیاری کەسی تۆمار ناکرێت.</p>

      <div className="adminGrid analyticsStats">
        <div className="adminCard statCard"><Share2 size={26} /><span>Total shares</span><strong>{totals.shares ?? 0}</strong><small>{totals.shares_7d ?? 0} last 7 days</small></div>
        <div className="adminCard statCard"><Search size={26} /><span>Total searches</span><strong>{totals.searches ?? 0}</strong><small>{totals.searches_7d ?? 0} last 7 days</small></div>
      </div>

      <div className="analyticsLists">
        <div>
          <h3><Share2 size={18} /> Top shared prompts</h3>
          <ol>{(analytics?.top_shares || []).length ? analytics.top_shares.map((item) => <li key={item.slug || item.title}><span>{item.title || item.slug || 'Unknown prompt'}</span><strong>{item.shares}</strong></li>) : <li><span>No shares recorded yet.</span></li>}</ol>
        </div>
        <div>
          <h3><Search size={18} /> Top searches</h3>
          <ol>{(analytics?.top_searches || []).length ? analytics.top_searches.map((item) => <li key={item.query}><span>{item.query}</span><strong>{item.searches}</strong></li>) : <li><span>No searches recorded yet.</span></li>}</ol>
        </div>
      </div>
    </section>

    <AdminPanelV4 />
  </>;
}
