import { useState } from 'react';
import { RefreshCw, ShieldCheck, Wand2 } from 'lucide-react';
import AdminPanelV4 from './AdminPanelV4.jsx';

const API_BASE = window.location.hostname.includes('workers.dev') ? window.location.origin : 'https://promptstan-api.hhhh46529.workers.dev';

export default function AdminPanelV5() {
  const [message, setMessage] = useState('');
  const [working, setWorking] = useState(false);

  function getToken() {
    return localStorage.getItem('promptstan-admin-token') || '';
  }

  function getAuthHeaders() {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
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
      setMessage(`D1 ${status.database ? '✅' : '❌'} · R2 ${status.r2 ? '✅' : '❌'} · OpenAI ${status.openai ? '✅' : '❌'} · Admin token ${status.admin_token ? '✅' : '❌'}`);
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

  return <>
    <section className="adminCard" style={{ margin: '20px auto 0', maxWidth: 1180 }} dir="rtl">
      <div className="adminCardTitle"><ShieldCheck size={22} /><h2>Cloudflare &amp; Image Repair</h2></div>
      <p>پشکنینی D1، R2 و OpenAI بکە، یان وێنەکانی Before/After ـی نەبوو یان شکستخواردوو دووبارە دروست بکەرەوە.</p>
      <div className="adminTokenRow">
        <button type="button" onClick={checkSystem} disabled={working}><ShieldCheck size={17} /> Check system</button>
        <button type="button" onClick={retryMissingImages} disabled={working}><Wand2 size={17} /> Retry missing images</button>
        {working && <span><RefreshCw size={16} /> Working...</span>}
      </div>
      {message && <div className="adminMessage" style={{ marginTop: 12 }}>{message}</div>}
    </section>
    <AdminPanelV4 />
  </>;
}
