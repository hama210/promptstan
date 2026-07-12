import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  BarChart3,
  Bot,
  BrainCircuit,
  Clock3,
  Copy,
  Eye,
  Heart,
  Lightbulb,
  MousePointerClick,
  RefreshCw,
  Search,
  Share2,
  Sparkles,
  Target
} from 'lucide-react';
import AdminPanelV7 from './AdminPanelV7.jsx';

const API_BASE = window.location.hostname.includes('workers.dev')
  ? window.location.origin
  : 'https://promptstan-api.hhhh46529.workers.dev';

const PERIODS = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' }
];

export default function AdminPanelV8() {
  const [period, setPeriod] = useState(30);
  const [report, setReport] = useState(null);
  const [message, setMessage] = useState('');
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (getToken()) loadReport(false);
  }, [period]);

  const maxFunnelValue = useMemo(
    () => Math.max(1, ...(report?.funnel || []).map((stage) => Number(stage.value || 0))),
    [report]
  );

  function getToken() {
    return localStorage.getItem('promptstan-admin-token') || '';
  }

  function authHeaders() {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function loadReport(showMessage = true) {
    if (!getToken()) {
      setMessage('Save ADMIN_TOKEN below first.');
      return;
    }

    setWorking(true);
    if (showMessage) setMessage(`Loading ${period}-day conversion intelligence...`);
    try {
      const response = await fetch(`${API_BASE}/api/admin/growth-intelligence?days=${period}`, {
        headers: authHeaders(),
        cache: 'no-store'
      });
      const text = await response.text();
      let data = {};
      try { data = text ? JSON.parse(text) : {}; } catch { throw new Error(`Invalid API response (${response.status})`); }
      if (!response.ok) throw new Error(data.error || 'Growth intelligence failed');
      setReport(data);
      if (showMessage) setMessage('Growth intelligence updated ✅');
    } catch (error) {
      setMessage(error.message || 'Growth intelligence connection failed.');
    } finally {
      setWorking(false);
    }
  }

  const totals = report?.totals || {};
  const preference = report?.preference || {};

  return <>
    <section className="adminCard intelligenceCard" style={{ margin: '20px auto 0', maxWidth: 1180 }} dir="rtl">
      <div className="intelligenceHeader">
        <div>
          <span className="intelligenceBadge"><BrainCircuit size={16} /> Phase 7 · Growth Intelligence</span>
          <div className="adminCardTitle"><BarChart3 size={23} /><h2>Conversion Reports &amp; Recommendations</h2></div>
          <p>لە referral ـەوە تا بینینی پرۆمپت، کۆپی، دڵخواز و share هەموو funnel ـەکە ببینە. PromptStan زانیاری کەسی یان IP تۆمار ناکات.</p>
        </div>
        <div className={preference.active ? 'intelligenceState active' : 'intelligenceState'}>
          <Bot size={23} />
          <strong>{preference.active ? 'Recommendations ON' : 'Collecting data'}</strong>
          <span>{preference.confidence || 'waiting'} confidence</span>
        </div>
      </div>

      <div className="intelligenceToolbar">
        <div className="periodTabs">{PERIODS.map((item) => <button type="button" key={item.value} className={period === item.value ? 'active' : ''} onClick={() => setPeriod(item.value)}>{item.label}</button>)}</div>
        <button type="button" className="intelligenceRefresh" onClick={() => loadReport(true)} disabled={working}><RefreshCw size={17} /> {working ? 'Loading...' : 'Refresh report'}</button>
      </div>

      <div className="adminGrid intelligenceStats">
        <MetricCard icon={<MousePointerClick size={25} />} label="Referral visits" value={totals.referrals} detail={`${totals.landing_rate || 0}% reached a prompt`} />
        <MetricCard icon={<Eye size={25} />} label="Prompt views" value={totals.views} detail={`${totals.copy_rate || 0}% copied`} />
        <MetricCard icon={<Copy size={25} />} label="Prompt copies" value={totals.copies} detail="Strongest intent signal" />
        <MetricCard icon={<Heart size={25} />} label="Favorites" value={totals.favorites} detail={`${totals.favorite_rate || 0}% of views`} />
        <MetricCard icon={<Share2 size={25} />} label="Shares" value={totals.shares} detail="Outbound growth actions" />
        <MetricCard icon={<Target size={25} />} label="Conversion rate" value={`${totals.conversion_rate || 0}%`} detail="Copies + favorites per view" />
      </div>

      <div className="intelligenceGrid">
        <section className="intelligencePanel funnelPanel">
          <div className="intelligencePanelTitle"><Target size={20} /><div><h3>Conversion funnel</h3><span>Where visitors continue or drop</span></div></div>
          <div className="funnelRows">{(report?.funnel || []).map((stage) => <div className="funnelRow" key={stage.stage}>
            <div><strong>{stage.label}</strong><span>{stage.value}</span></div>
            <div className="funnelTrack"><span style={{ width: `${Math.max(3, (Number(stage.value || 0) / maxFunnelValue) * 100)}%` }} /></div>
            <b>{stage.rate || 0}%</b>
          </div>)}</div>
        </section>

        <section className="intelligencePanel preferencePanel">
          <div className="intelligencePanelTitle"><Bot size={20} /><div><h3>Bot content signals</h3><span>{preference.signal_count || 0} real demand and engagement signals</span></div></div>
          <div className="preferenceSummary"><strong>{preference.confidence || 'collecting-data'}</strong><span>recommendation confidence</span></div>
          <div className="preferenceTokens">{preference.tokens?.length ? preference.tokens.slice(0, 10).map((item) => <span key={item.token}>#{item.token}<small>{formatCompact(item.weight)}</small></span>) : <p>Searches and conversions will appear here after visitors use the site.</p>}</div>
          {preference.categories?.length > 0 && <div className="preferredCategories">{preference.categories.slice(0, 4).map((item) => <div key={item.category}><strong>{item.category}</strong><span>{formatCompact(item.weight)} signal weight</span></div>)}</div>}
        </section>
      </div>

      <section className="intelligencePanel recommendationsPanel">
        <div className="intelligencePanelTitle"><Lightbulb size={20} /><div><h3>Recommended next actions</h3><span>Generated from conversions, campaigns, searches and timing</span></div></div>
        <div className="recommendationGrid">{report?.recommendations?.length ? report.recommendations.map((item, index) => <article className={`recommendationCard ${item.priority || 'low'}`} key={`${item.type}-${index}`}>
          <span>{recommendationIcon(item.type)}</span>
          <div><strong>{item.title}</strong><p>{item.detail}</p><small>{item.action}</small></div>
        </article>) : <EmptyRow text="No recommendations loaded yet." />}</div>
      </section>

      <div className="intelligenceGrid campaignAndPrompts">
        <section className="intelligencePanel campaignPanel">
          <div className="intelligencePanelTitle"><ArrowUpRight size={20} /><div><h3>Campaign comparison</h3><span>Traffic versus real conversions</span></div></div>
          <div className="intelligenceTableWrap"><table className="intelligenceTable"><thead><tr><th>Campaign</th><th>Source</th><th>Visits</th><th>Views</th><th>Copies</th><th>Conv.</th></tr></thead><tbody>{report?.campaigns?.length ? report.campaigns.slice(0, 12).map((item) => <tr key={`${item.source}-${item.campaign}`}><td><strong>{item.campaign}</strong></td><td>{item.source}</td><td>{item.referrals}</td><td>{item.views}</td><td>{item.copies}</td><td><span className="ratePill">{item.conversion_rate}%</span></td></tr>) : <tr><td colSpan="6">No campaign conversions recorded yet.</td></tr>}</tbody></table></div>
        </section>

        <section className="intelligencePanel topPromptsPanel">
          <div className="intelligencePanelTitle"><Sparkles size={20} /><div><h3>Best-performing prompts</h3><span>Weighted by views, copies, favorites and shares</span></div></div>
          <ol className="rankedList">{report?.prompts?.length ? report.prompts.slice(0, 10).map((item, index) => <li key={item.slug}><b>{index + 1}</b><div><strong>{item.title}</strong><span>{item.category_name} · {item.views} views · {item.copies} copies</span></div><small>{item.score}</small></li>) : <EmptyRow text="Prompt performance will appear after funnel events are collected." />}</ol>
        </section>
      </div>

      <div className="intelligenceGrid gapsAndTime">
        <section className="intelligencePanel gapsPanel">
          <div className="intelligencePanelTitle"><Search size={20} /><div><h3>Search content gaps</h3><span>Popular searches with too few results</span></div></div>
          <ol className="rankedList gapList">{report?.content_gaps?.length ? report.content_gaps.slice(0, 10).map((item, index) => <li key={item.query}><b>{index + 1}</b><div><strong>{item.query}</strong><span>{item.searches} searches · {item.average_results} average results</span></div><small>{item.gap_score}</small></li>) : <EmptyRow text="No search gaps detected yet." />}</ol>
        </section>

        <section className="intelligencePanel hoursPanel">
          <div className="intelligencePanelTitle"><Clock3 size={20} /><div><h3>Strong conversion hours</h3><span>Converted to your saved local time zone</span></div></div>
          <div className="hourBars">{report?.best_hours?.length ? report.best_hours.map((item) => <div key={item.hour}><strong>{formatHour(item.hour)}</strong><div><span style={{ width: `${Math.max(8, item.conversions / Math.max(1, report.best_hours[0].conversions) * 100)}%` }} /></div><small>{item.conversions}</small></div>) : <EmptyRow text="More copy, favorite and share events are needed." />}</div>
        </section>
      </div>

      {message && <div className="adminMessage intelligenceMessage">{message}</div>}
    </section>

    <AdminPanelV7 />
  </>;
}

function MetricCard({ icon, label, value, detail }) {
  return <div className="adminCard statCard intelligenceMetric">{icon}<span>{label}</span><strong>{value ?? '—'}</strong><small>{detail}</small></div>;
}

function EmptyRow({ text }) {
  return <div className="intelligenceEmpty">{text}</div>;
}

function recommendationIcon(type) {
  if (type === 'content-gap') return '🔎';
  if (type === 'campaign-winner') return '📈';
  if (type === 'campaign-fix') return '🛠️';
  if (type === 'timing') return '⏰';
  if (type === 'category') return '📂';
  if (type === 'content-winner') return '🏆';
  return '💡';
}

function formatCompact(value) {
  const number = Number(value || 0);
  if (number >= 1000) return `${Math.round(number / 100) / 10}K`;
  return `${Math.round(number * 10) / 10}`;
}

function formatHour(hour) {
  const normalized = Number(hour || 0) % 24;
  const suffix = normalized >= 12 ? 'PM' : 'AM';
  const twelve = normalized % 12 || 12;
  return `${String(twelve).padStart(2, '0')}:00 ${suffix}`;
}
