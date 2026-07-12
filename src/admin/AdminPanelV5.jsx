import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Copy, DatabaseBackup, Link2, MousePointerClick, RefreshCw, Search, Share2, ShieldCheck, Wand2 } from 'lucide-react';
import AdminPanelV4 from './AdminPanelV4.jsx';

const API_BASE = window.location.hostname.includes('workers.dev') ? window.location.origin : 'https://promptstan-api.hhhh46529.workers.dev';
const PUBLIC_SITE = 'https://promptstan.pages.dev';

export default function AdminPanelV5() {
  const [message, setMessage] = useState('');
  const [working, setWorking] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [campaignSource, setCampaignSource] = useState('whatsapp');
  const [campaignName, setCampaignName] = useState('prompt-share');
  const [campaignSlug, setCampaignSlug] = useState('');

  useEffect(() => {
    if (getToken()) loadAnalytics();
  }, []);

  const campaignLink = useMemo(() => {
    const source = cleanToken(campaignSource) || 'custom';
    const campaign = cleanToken(campaignName) || 'campaign';
    const slug = cleanToken(campaignSlug);
    const url = new URL(slug ? `/prompt/${encodeURIComponent(slug)}` : '/', PUBLIC_SITE);
    url.searchParams.set('ref', source);
    url.searchParams.set('utm_source', source);
    url.searchParams.set('utm_medium', socialSource(source) ? 'social' : 'referral');
    url.searchParams.set('utm_campaign', campaign);
    if (slug) url.searchParams.set('utm_content', slug);
    return url.toString();
  }, [campaignSource, campaignName, campaignSlug]);

  function getToken() {
    return localStorage.getItem('promptstan-admin-token') || '';
  }

  function getAuthHeaders() {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function readJson(response) {
    const text = await response.text();
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`API returned an invalid response (${response.status}).`);
    }
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
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || 'Analytics failed');
      setAnalytics(data);
      if (showStatus) setMessage('Growth analytics updated.');
    } catch (error) {
      if (showStatus) setMessage(error.message || 'Analytics connection failed.');
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
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || 'System check failed');
      const status = data.status || {};
      const provider = status.image_provider === 'openai' ? 'OpenAI' : status.image_provider === 'workers-ai' ? 'Workers AI' : 'Missing';
      setMessage(`D1 ${status.database ? '✅' : '❌'} · R2 ${status.r2 ? '✅' : '❌'} · Images: ${provider} ${status.image_provider ? '✅' : '❌'} · Analytics ${status.growth_phase ? '✅' : '❌'} · Campaigns ✅ · Admin token ${status.admin_token ? '✅' : '❌'}`);
      await loadAnalytics();
    } catch (error) {
      setMessage(error.message || 'System connection failed.');
    } finally {
      setWorking(false);
    }
  }

  async function restoreLibrary() {
    if (!getToken()) {
      setMessage('Save ADMIN_TOKEN in the panel first.');
      return;
    }

    setWorking(true);
    setMessage('Restoring every known PromptStan prompt into D1...');
    try {
      const response = await fetch(`${API_BASE}/api/admin/library/restore`, {
        method: 'POST',
        headers: getAuthHeaders(),
        cache: 'no-store'
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || 'Library restoration failed');

      setMessage(`Library restored ✅ ${data.inserted || 0} added, ${data.existing || 0} already existed, ${data.total_prompts || 0} total prompts. Reloading...`);
      window.setTimeout(() => window.location.reload(), 1200);
    } catch (error) {
      setMessage(error.message || 'Library restoration failed.');
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
      const prompts = await readJson(response);
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
      setMessage(error.message || 'Image repair failed.');
    } finally {
      setWorking(false);
    }
  }

  async function copyCampaignLink() {
    try {
      await navigator.clipboard.writeText(campaignLink);
      setMessage('Campaign link copied ✅');
    } catch {
      setMessage('Could not copy automatically. Press and hold the link below to copy it.');
    }
  }

  const totals = analytics?.totals || {};

  return <>
    <section className="adminCard" style={{ margin: '20px auto 0', maxWidth: 1180 }} dir="rtl">
      <div className="adminCardTitle"><ShieldCheck size={22} /><h2>Cloudflare &amp; Library Repair</h2></div>
      <p>پشکنینی D1، R2 و Workers AI بکە، هەموو پرۆمپتە ناسراوەکان بگەڕێنەرەوە، یان وێنەکانی Before/After دووبارە دروست بکەرەوە.</p>
      <div className="adminTokenRow adminRepairActions">
        <button type="button" onClick={checkSystem} disabled={working}><ShieldCheck size={17} /> Check system</button>
        <button type="button" onClick={restoreLibrary} disabled={working}><DatabaseBackup size={17} /> Restore all prompts</button>
        <button type="button" onClick={retryMissingImages} disabled={working}><Wand2 size={17} /> Retry missing images</button>
        <button type="button" onClick={() => loadAnalytics(true)} disabled={working}><BarChart3 size={17} /> Refresh analytics</button>
        {working && <span><RefreshCw size={16} /> Working...</span>}
      </div>
      {message && <div className="adminMessage" style={{ marginTop: 12 }}>{message}</div>}
    </section>

    <section className="adminCard growthAnalytics" style={{ margin: '16px auto 0', maxWidth: 1180 }} dir="rtl">
      <div className="adminCardTitle"><BarChart3 size={22} /><h2>Growth &amp; Referral Analytics</h2></div>
      <p>Share، گەڕان، سەرچاوەی هاتنی بەکارهێنەر و ناوی campaign پیشان دەدات. IP یان زانیاری کەسی تۆمار ناکرێت.</p>

      <div className="adminGrid analyticsStats campaignStats">
        <div className="adminCard statCard"><Share2 size={26} /><span>Total shares</span><strong>{analytics ? totals.shares ?? 0 : '—'}</strong><small>{analytics ? `${totals.shares_7d ?? 0} last 7 days` : 'Refresh after saving ADMIN_TOKEN'}</small></div>
        <div className="adminCard statCard"><Search size={26} /><span>Total searches</span><strong>{analytics ? totals.searches ?? 0 : '—'}</strong><small>{analytics ? `${totals.searches_7d ?? 0} last 7 days` : 'Refresh after saving ADMIN_TOKEN'}</small></div>
        <div className="adminCard statCard"><MousePointerClick size={26} /><span>Referral visits</span><strong>{analytics ? totals.referrals ?? 0 : '—'}</strong><small>{analytics ? `${totals.referrals_7d ?? 0} last 7 days` : 'Tracked link arrivals'}</small></div>
      </div>

      <div className="analyticsLists campaignAnalyticsLists">
        <AnalyticsList icon={<Share2 size={18} />} title="Top shared prompts" items={analytics?.top_shares} empty={analytics ? 'No shares recorded yet.' : 'Analytics not loaded yet.'} label={(item) => item.title || item.slug || 'Unknown prompt'} value={(item) => item.shares} />
        <AnalyticsList icon={<Search size={18} />} title="Top searches" items={analytics?.top_searches} empty={analytics ? 'No searches recorded yet.' : 'Analytics not loaded yet.'} label={(item) => item.query} value={(item) => item.searches} />
        <AnalyticsList icon={<MousePointerClick size={18} />} title="Top traffic sources" items={analytics?.top_sources} empty={analytics ? 'No referral visits recorded yet.' : 'Analytics not loaded yet.'} label={(item) => item.source} value={(item) => item.referrals} />
        <AnalyticsList icon={<Link2 size={18} />} title="Top campaigns" items={analytics?.top_campaigns} empty={analytics ? 'No campaigns recorded yet.' : 'Analytics not loaded yet.'} label={(item) => item.campaign} value={(item) => item.referrals} />
      </div>
    </section>

    <section className="adminCard campaignBuilder" style={{ margin: '16px auto 0', maxWidth: 1180 }} dir="rtl">
      <div className="adminCardTitle"><Link2 size={22} /><h2>Campaign Link Builder</h2></div>
      <p>لینکێکی تایبەت بۆ WhatsApp، Telegram، Facebook، TikTok یان هەر campaign ـێک دروست بکە و دواتر ئەنجامەکانی لە سەرەوە ببینە.</p>
      <div className="campaignBuilderGrid">
        <label>Traffic source
          <select value={campaignSource} onChange={(event) => setCampaignSource(event.target.value)}>
            <option value="whatsapp">WhatsApp</option>
            <option value="telegram">Telegram</option>
            <option value="facebook">Facebook</option>
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok</option>
            <option value="x">X / Twitter</option>
            <option value="copy">Copied link</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <label>Campaign name
          <input value={campaignName} onChange={(event) => setCampaignName(event.target.value)} placeholder="summer-prompts" />
        </label>
        <label className="wide">Prompt slug (optional)
          <input value={campaignSlug} onChange={(event) => setCampaignSlug(event.target.value)} placeholder="prompt-1 or starter-solo-cinematic-portrait" />
        </label>
      </div>
      <div className="campaignLinkOutput"><code>{campaignLink}</code><button type="button" onClick={copyCampaignLink}><Copy size={17} /> Copy campaign link</button></div>
    </section>

    <AdminPanelV4 />
  </>;
}

function AnalyticsList({ icon, title, items, empty, label, value }) {
  const rows = Array.isArray(items) ? items : [];
  return <div>
    <h3>{icon} {title}</h3>
    <ol>{rows.length ? rows.map((item, index) => <li key={`${label(item)}-${index}`}><span>{label(item)}</span><strong>{value(item)}</strong></li>) : <li><span>{empty}</span></li>}</ol>
  </div>;
}

function cleanToken(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function socialSource(source) {
  return ['whatsapp', 'telegram', 'facebook', 'instagram', 'tiktok', 'x'].includes(source);
}
