import { useEffect, useState } from 'react';
import { BarChart3, CalendarClock, Edit3, KeyRound, Plus, RefreshCw, ShieldCheck, Sparkles, Trash2, X } from 'lucide-react';

const API_BASE = 'https://promptstan-api.hhhh46529.workers.dev';
const emptyPrompt = { title_ku: '', title_en: '', title_ar: '', description_ku: '', prompt_text: '', category_slug: 'kurdish-style', tags: 'kurdish,prompt', difficulty: 'easy', rating: 4.8, is_featured: false, is_trending: true };

export default function AdminPanelV2() {
  const [token, setToken] = useState(() => localStorage.getItem('promptstan-admin-token') || '');
  const [savedToken, setSavedToken] = useState(() => localStorage.getItem('promptstan-admin-token') || '');
  const [dashboard, setDashboard] = useState(null);
  const [prompts, setPrompts] = useState([]);
  const [form, setForm] = useState(emptyPrompt);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const authHeaders = savedToken ? { Authorization: `Bearer ${savedToken}` } : {};

  useEffect(() => { loadPrompts(); if (savedToken) loadDashboard(); }, [savedToken]);

  function saveToken() { localStorage.setItem('promptstan-admin-token', token); setSavedToken(token); setMessage('Admin token saved.'); }

  async function loadPrompts() {
    try { const res = await fetch(`${API_BASE}/api/prompts`); const data = await res.json(); setPrompts(Array.isArray(data) ? data : []); } catch {}
  }

  async function loadDashboard() {
    setLoading(true); setMessage('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/dashboard`, { headers: authHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Dashboard failed');
      setDashboard(data); await loadPrompts();
    } catch (error) { setMessage(error.message); } finally { setLoading(false); }
  }

  async function publishDailyNow() {
    setLoading(true); setMessage('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/daily/run`, { method: 'POST', headers: authHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Daily post failed');
      setMessage(data.skipped ? 'Daily prompt already published today.' : `Daily prompt published: ${data.slug}`);
      await loadDashboard();
    } catch (error) { setMessage(error.message); } finally { setLoading(false); }
  }

  function startEdit(prompt) {
    setEditingId(prompt.id);
    setForm({ title_ku: prompt.title_ku || '', title_en: prompt.title_en || '', title_ar: prompt.title_ar || '', description_ku: prompt.description_ku || '', prompt_text: prompt.prompt_text || '', category_slug: prompt.category_slug || 'kurdish-style', tags: '', difficulty: prompt.difficulty || 'easy', rating: prompt.rating || 4.8, is_featured: Boolean(prompt.is_featured), is_trending: Boolean(prompt.is_trending) });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetForm() { setEditingId(null); setForm(emptyPrompt); }

  async function savePrompt(event) {
    event.preventDefault(); setLoading(true); setMessage('');
    try {
      const payload = { ...form, tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean), rating: Number(form.rating), is_featured: Boolean(form.is_featured), is_trending: Boolean(form.is_trending) };
      const res = await fetch(editingId ? `${API_BASE}/api/admin/prompts/${editingId}` : `${API_BASE}/api/admin/prompts`, { method: editingId ? 'PUT' : 'POST', headers: { ...authHeaders, 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save prompt failed');
      setMessage(editingId ? 'Prompt updated.' : `Prompt created: ${data.slug}`); resetForm(); await loadDashboard();
    } catch (error) { setMessage(error.message); } finally { setLoading(false); }
  }

  async function removePrompt(prompt) {
    const ok = window.confirm(`Remove this prompt? ${prompt.title_ku || prompt.title_en}`);
    if (!ok) return;
    setLoading(true); setMessage('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/prompts/${prompt.id}`, { method: 'DELETE', headers: authHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Remove prompt failed');
      setMessage('Prompt removed.'); await loadDashboard();
    } catch (error) { setMessage(error.message); } finally { setLoading(false); }
  }

  return <main className="adminShell" dir="rtl">
    <header className="adminHero"><div><span className="adminBadge"><ShieldCheck size={18} /> Promptstan Admin</span><h1>بەڕێوەبردنی پڕۆمپتستان</h1><p>پرۆمپت زیاد بکە، دەستکاری بکە، بسڕەوە، و ئاماری ماڵپەڕ ببینە.</p></div><a className="adminHome" href="/">گەڕانەوە بۆ ماڵەوە</a></header>
    <section className="adminCard tokenCard"><div className="adminCardTitle"><KeyRound size={22} /><h2>Admin Token</h2></div><p>ئەو secret ـەی لە Cloudflare بە ناوی <b>ADMIN_TOKEN</b> داتناوە، لێرە دابنێ.</p><div className="adminTokenRow"><input value={token} onChange={(e) => setToken(e.target.value)} placeholder="ADMIN_TOKEN" type="password" /><button onClick={saveToken}>Save</button></div></section>
    {message && <div className="adminMessage">{message}</div>}
    <section className="adminGrid"><div className="adminCard statCard"><BarChart3 size={28} /><span>Prompts</span><strong>{dashboard?.prompts?.count ?? prompts.length ?? '-'}</strong></div><div className="adminCard statCard"><Sparkles size={28} /><span>Views</span><strong>{dashboard?.prompts?.views ?? '-'}</strong></div><div className="adminCard statCard"><RefreshCw size={28} /><span>Copies</span><strong>{dashboard?.prompts?.copies ?? '-'}</strong></div><div className="adminCard statCard"><span>Categories</span><strong>{dashboard?.categories?.count ?? '-'}</strong></div></section>
    <section className="adminCard dailyCard"><div><div className="adminCardTitle"><CalendarClock size={22} /><h2>Daily Prompt Bot</h2></div><p>بۆت ڕۆژانە پرۆمپت بڵاو دەکات. دەتوانیت ئێستا بە دەستی هەمان کار بکەیت.</p></div><button onClick={publishDailyNow} disabled={!savedToken || loading}>Publish today now</button></section>
    <section className="adminCard"><div className="adminCardTitle"><Plus size={22} /><h2>{editingId ? 'دەستکاریکردنی پرۆمپت' : 'زیادکردنی پرۆمپت'}</h2>{editingId && <button className="cancelEdit" onClick={resetForm}><X size={16} /> Cancel</button>}</div><form className="promptForm" onSubmit={savePrompt}><label>ناونیشانی کوردی<input value={form.title_ku} onChange={(e) => setForm({ ...form, title_ku: e.target.value })} required /></label><label>English title<input value={form.title_en} onChange={(e) => setForm({ ...form, title_en: e.target.value })} /></label><label>Arabic title<input value={form.title_ar} onChange={(e) => setForm({ ...form, title_ar: e.target.value })} /></label><label>Category<select value={form.category_slug} onChange={(e) => setForm({ ...form, category_slug: e.target.value })}><option value="kurdish-style">Kurdish Style</option><option value="islamic">Islamic</option><option value="couples">Couples</option><option value="cars">Cars</option><option value="movies">Movies</option><option value="characters">Characters</option></select></label><label className="wide">Description<textarea value={form.description_ku} onChange={(e) => setForm({ ...form, description_ku: e.target.value })} rows="2" /></label><label className="wide">Prompt text<textarea value={form.prompt_text} onChange={(e) => setForm({ ...form, prompt_text: e.target.value })} rows="5" required /></label><label>Tags comma separated<input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></label><label>Rating<input value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })} type="number" step="0.1" /></label><label className="checkLabel"><input checked={form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} type="checkbox" /> Featured</label><label className="checkLabel"><input checked={form.is_trending} onChange={(e) => setForm({ ...form, is_trending: e.target.checked })} type="checkbox" /> Trending</label><button className="submitPrompt" disabled={!savedToken || loading}>{loading ? 'Working...' : editingId ? 'Update Prompt' : 'Publish Prompt'}</button></form></section>
    <section className="adminCard"><div className="adminCardTitle"><BarChart3 size={22} /><h2>پرۆمپتە بڵاوکراوەکان</h2></div><div className="adminPromptList">{prompts.length === 0 ? <p>هێشتا هیچ پرۆمپتێک لە داتابەیسدا نییە.</p> : prompts.map((prompt) => <article key={prompt.id} className="adminPromptItem"><div><strong>{prompt.title_ku || prompt.title_en}</strong><small>{prompt.category_name} • 👁 {prompt.views || 0} • 📋 {prompt.copies || 0}</small></div><span>{prompt.is_trending ? '🔥 Trending' : 'Prompt'}</span><div className="adminPromptActions"><button onClick={() => startEdit(prompt)} disabled={!savedToken || loading}><Edit3 size={16} /> Edit</button><button className="dangerButton" onClick={() => removePrompt(prompt)} disabled={!savedToken || loading}><Trash2 size={16} /> Remove</button></div></article>)}</div></section>
  </main>;
}
