import { useEffect, useMemo, useState } from 'react';
import { BarChart3, CalendarClock, Edit3, ImagePlus, KeyRound, Plus, RefreshCw, Search, ShieldCheck, Sparkles, Trash2, X } from 'lucide-react';

const API_BASE = window.location.hostname.includes('workers.dev') ? window.location.origin : 'https://promptstan-api.hhhh46529.workers.dev';
const emptyPrompt = { title_ku: '', title_en: '', title_ar: '', description_ku: '', prompt_text: '', preview_image_url: '', category_slug: 'person-edit', tags: 'person,edit', difficulty: 'easy', rating: 4.8, is_featured: false, is_trending: true };
const pageSize = 10;

export default function AdminPanelV4() {
  const [token, setToken] = useState(() => localStorage.getItem('promptstan-admin-token') || '');
  const [savedToken, setSavedToken] = useState(() => localStorage.getItem('promptstan-admin-token') || '');
  const [dashboard, setDashboard] = useState(null);
  const [prompts, setPrompts] = useState([]);
  const [form, setForm] = useState(emptyPrompt);
  const [editingId, setEditingId] = useState(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState('');
  const [apiStatus, setApiStatus] = useState('Checking API connection...');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const authHeaders = savedToken ? { Authorization: `Bearer ${savedToken}` } : {};

  useEffect(() => { checkApiConnection(); loadPrompts(); if (savedToken) loadDashboard(); }, [savedToken]);
  useEffect(() => setPage(1), [query]);

  const filteredPrompts = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return prompts;
    return prompts.filter((p) => `${p.title_ku || ''} ${p.title_en || ''} ${p.title_ar || ''} ${p.category_name || ''} ${p.prompt_text || ''}`.toLowerCase().includes(term));
  }, [prompts, query]);
  const pageCount = Math.max(1, Math.ceil(filteredPrompts.length / pageSize));
  const shownPrompts = filteredPrompts.slice((page - 1) * pageSize, page * pageSize);

  function saveToken() { localStorage.setItem('promptstan-admin-token', token); setSavedToken(token); setMessage('Admin token saved.'); }

  async function checkApiConnection() {
    try {
      const res = await fetch(`${API_BASE}/api/health`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'API health check failed');
      setApiStatus(`✅ Connected to ${data.service || 'Promptstan API'}`);
    } catch (error) {
      setApiStatus(`❌ API not connected: ${error.message}`);
    }
  }

  async function loadPrompts() {
    try {
      const res = await fetch(`${API_BASE}/api/prompts`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load prompts');
      setPrompts(Array.isArray(data) ? data : []);
    } catch (error) {
      setMessage(`Public API connection failed: ${error.message}`);
      setPrompts([]);
    }
  }

  async function loadDashboard() {
    setLoading(true); setMessage('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/dashboard`, { headers: authHeaders, cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Dashboard failed');
      setDashboard(data); await loadPrompts(); await checkApiConnection();
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

  async function uploadImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!savedToken) { setMessage('Save ADMIN_TOKEN first.'); return; }
    setUploading(true); setMessage('');
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch(`${API_BASE}/api/admin/upload`, { method: 'POST', headers: authHeaders, body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      const fullUrl = `${API_BASE}${data.url}`;
      setForm((current) => ({ ...current, preview_image_url: fullUrl }));
      setMessage('Image uploaded. Now press Publish Prompt to save it.');
    } catch (error) { setMessage(error.message); } finally { setUploading(false); event.target.value = ''; }
  }

  function startEdit(prompt) {
    setEditingId(prompt.id);
    setForm({ title_ku: prompt.title_ku || '', title_en: prompt.title_en || '', title_ar: prompt.title_ar || '', description_ku: prompt.description_ku || '', prompt_text: prompt.prompt_text || '', preview_image_url: prompt.preview_image_url || '', category_slug: prompt.category_slug || 'person-edit', tags: '', difficulty: prompt.difficulty || 'easy', rating: prompt.rating || 4.8, is_featured: Boolean(prompt.is_featured), is_trending: Boolean(prompt.is_trending) });
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
      setMessage(editingId ? 'Prompt updated. Refresh the public site to see it.' : `Prompt created: ${data.slug}. Refresh the public site to see it.`); resetForm(); await loadDashboard();
    } catch (error) { setMessage(error.message); } finally { setLoading(false); }
  }

  async function removePrompt(prompt) {
    if (!window.confirm(`Remove this prompt? ${prompt.title_ku || prompt.title_en}`)) return;
    setLoading(true); setMessage('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/prompts/${prompt.id}`, { method: 'DELETE', headers: authHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Remove prompt failed');
      setMessage('Prompt removed.'); await loadDashboard();
    } catch (error) { setMessage(error.message); } finally { setLoading(false); }
  }

  return <main className="adminShell" dir="rtl">
    <header className="adminHero"><div><span className="adminBadge"><ShieldCheck size={18} /> Promptstan Admin</span><h1>بەڕێوەبردنی پڕۆمپتستان</h1><p>پرۆمپت زیاد بکە، وێنە زیاد بکە، دەستکاری بکە، و ئاماری ماڵپەڕ ببینە.</p></div><a className="adminHome" href="/">گەڕانەوە بۆ ماڵەوە</a></header>
    <section className="adminCard tokenCard"><div className="adminCardTitle"><KeyRound size={22} /><h2>Admin Token</h2></div><p>ADMIN_TOKEN ـەکەت لێرە دابنێ بۆ بەڕێوەبردن.</p><p><strong>API:</strong> {API_BASE}</p><p>{apiStatus}</p><div className="adminTokenRow"><input value={token} onChange={(e) => setToken(e.target.value)} placeholder="ADMIN_TOKEN" type="password" /><button onClick={saveToken}>Save</button><button onClick={() => { checkApiConnection(); loadPrompts(); }} type="button">Check API</button></div></section>
    {message && <div className="adminMessage">{message}</div>}
    <section className="adminGrid"><div className="adminCard statCard"><BarChart3 size={28} /><span>Prompts</span><strong>{dashboard?.prompts?.count ?? prompts.length ?? '-'}</strong></div><div className="adminCard statCard"><Sparkles size={28} /><span>Views</span><strong>{dashboard?.prompts?.views ?? '-'}</strong></div><div className="adminCard statCard"><RefreshCw size={28} /><span>Copies</span><strong>{dashboard?.prompts?.copies ?? '-'}</strong></div><div className="adminCard statCard"><span>Categories</span><strong>{dashboard?.categories?.count ?? '-'}</strong></div></section>
    <section className="adminCard dailyCard"><div><div className="adminCardTitle"><CalendarClock size={22} /><h2>Daily Prompt Bot</h2></div><p>بۆت ڕۆژانە پرۆمپت بڵاو دەکات. دەتوانیت ئێستا بە دەستی هەمان کار بکەیت.</p></div><button onClick={publishDailyNow} disabled={!savedToken || loading}>Publish today now</button></section>
    <section className="adminCard"><div className="adminCardTitle"><Plus size={22} /><h2>{editingId ? 'دەستکاریکردنی پرۆمپت' : 'زیادکردنی پرۆمپت'}</h2>{editingId && <button className="cancelEdit" onClick={resetForm}><X size={16} /> Cancel</button>}</div><form className="promptForm" onSubmit={savePrompt}><label>ناونیشانی کوردی<input value={form.title_ku} onChange={(e) => setForm({ ...form, title_ku: e.target.value })} required /></label><label>English title<input value={form.title_en} onChange={(e) => setForm({ ...form, title_en: e.target.value })} /></label><label>Arabic title<input value={form.title_ar} onChange={(e) => setForm({ ...form, title_ar: e.target.value })} /></label><label>Category<select value={form.category_slug} onChange={(e) => setForm({ ...form, category_slug: e.target.value })}><option value="person-edit">Person Edit</option><option value="kurdish-style">Kurdish Style</option><option value="couples">Couples</option><option value="movies">Movie Style</option><option value="outfit">Outfit Style</option></select></label><label className="wide">Description<textarea value={form.description_ku} onChange={(e) => setForm({ ...form, description_ku: e.target.value })} rows="2" /></label><label className="wide">Prompt text<textarea value={form.prompt_text} onChange={(e) => setForm({ ...form, prompt_text: e.target.value })} rows="5" required /></label><label>Tags comma separated<input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></label><label>Rating<input value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })} type="number" step="0.1" /></label><label className="wide imageUploadBox"><span><ImagePlus size={18} /> Preview image</span><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={uploadImage} disabled={!savedToken || uploading} /><input value={form.preview_image_url} onChange={(e) => setForm({ ...form, preview_image_url: e.target.value })} placeholder="Image URL will appear here" />{form.preview_image_url && <img src={form.preview_image_url} alt="Preview" />}</label><label className="checkLabel"><input checked={form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} type="checkbox" /> Featured</label><label className="checkLabel"><input checked={form.is_trending} onChange={(e) => setForm({ ...form, is_trending: e.target.checked })} type="checkbox" /> Trending</label><button className="submitPrompt" disabled={!savedToken || loading || uploading}>{uploading ? 'Uploading...' : loading ? 'Working...' : editingId ? 'Update Prompt' : 'Publish Prompt'}</button></form></section>
    <section className="adminCard"><div className="adminCardTitle"><Search size={22} /><h2>پرۆمپتە بڵاوکراوەکان</h2></div><div className="adminSearch"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search prompts..." /><span>{filteredPrompts.length} results</span></div><div className="adminPromptList">{shownPrompts.length === 0 ? <p>هیچ پرۆمپتێک نەدۆزرایەوە.</p> : shownPrompts.map((prompt) => <article key={prompt.id} className="adminPromptItem">{prompt.preview_image_url && <img className="adminListThumb" src={prompt.preview_image_url} alt="" />}<div><strong>{prompt.title_ku || prompt.title_en}</strong><small>{prompt.category_name} • 👁 {prompt.views || 0} • 📋 {prompt.copies || 0}</small></div><span>{prompt.is_trending ? '🔥 Trending' : 'Prompt'}</span><div className="adminPromptActions"><button onClick={() => startEdit(prompt)} disabled={!savedToken || loading}><Edit3 size={16} /> Edit</button><button className="dangerButton" onClick={() => removePrompt(prompt)} disabled={!savedToken || loading}><Trash2 size={16} /> Remove</button></div></article>)}</div><div className="pagination"><button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button><strong>{page} / {pageCount}</strong><button disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>Next</button></div></section>
  </main>;
}
