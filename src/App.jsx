import { useMemo, useState } from 'react';
import { Copy, Eye, Flame, Globe2, Heart, Search, Sparkles, Star, Wand2, X, Zap } from 'lucide-react';
import { categories, promptItems, tags } from './data/site.js';

export default function App() {
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState('');
  const [activePrompt, setActivePrompt] = useState(null);

  const filteredPrompts = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return promptItems;
    return promptItems.filter((item) => {
      const searchable = `${item.title} ${item.category} ${item.text} ${item.tags.join(' ')}`.toLowerCase();
      return searchable.includes(term);
    });
  }, [query]);

  function copyText(text, title) {
    navigator.clipboard.writeText(text);
    setCopied(title);
    window.setTimeout(() => setCopied(''), 1800);
  }

  return (
    <main className="app" dir="rtl">
      {copied && <div className="toast">✅ {copied} کۆپی کرا</div>}

      {activePrompt && (
        <div className="modalOverlay" onClick={() => setActivePrompt(null)}>
          <section className="promptModal" onClick={(event) => event.stopPropagation()}>
            <button className="modalClose" onClick={() => setActivePrompt(null)}><X size={20} /></button>
            <div className={`modalVisual ${activePrompt.gradient}`}>
              <span>{activePrompt.badge}</span>
              <strong>{activePrompt.imageTitle}</strong>
            </div>
            <div className="modalContent">
              <div className="promptMeta modalMeta">
                <span>{activePrompt.category}</span>
                <span>⭐ {activePrompt.rating}</span>
                <span>👁 {activePrompt.views}</span>
                <span>📋 {activePrompt.copies}</span>
              </div>
              <h2>{activePrompt.title}</h2>
              <p className="modalDescription">ئەم پرۆمپتە ئامادەیە بۆ کۆپی کردن و بەکارهێنان لە ChatGPT Images، Gemini، Flux، Midjourney و هەر ئامرازی AI ـیەکی وێنە.</p>
              <div className="promptBox">
                <div className="promptBoxHeader">
                  <strong>پرۆمپت</strong>
                  <button onClick={() => copyText(activePrompt.text, activePrompt.title)}><Copy size={16} /> کۆپی</button>
                </div>
                <p>{activePrompt.text}</p>
              </div>
              <div className="tagList">
                {activePrompt.tags.map((tag) => <span key={tag}>#{tag}</span>)}
              </div>
              <div className="modelGrid">
                <span>ChatGPT Images</span>
                <span>Gemini</span>
                <span>Flux</span>
                <span>Midjourney</span>
              </div>
            </div>
          </section>
        </div>
      )}

      <nav className="navbar">
        <div className="brand">
          <div className="logoMark"><Wand2 size={22} /></div>
          <div>
            <strong>پڕۆمپتستان</strong>
            <span>Promptstan</span>
          </div>
        </div>

        <div className="navActions">
          <button className="ghost"><Globe2 size={18} /> KU</button>
          <button className="primarySmall">دەستپێک</button>
        </div>
      </nav>

      <section className="hero">
        <div className="heroBadge"><Sparkles size={18} /> کتێبخانەی فری پرۆمپتی AI</div>
        <h1>شوێنی هەموو پرۆمپتەکانی AI</h1>
        <p>پرۆمپتی ئامادە بۆ دەستکاریکردنی وێنە، پۆرترێت، باکگراوند، بەرهەم و ستایلی سینەمایی.</p>

        <div className="searchBox">
          <Search size={22} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="چی دەتەوێت دروست بکەیت؟" />
          <button><Search size={18} /> گەڕان</button>
        </div>

        <div className="tags">
          {tags.map((tag) => <button key={tag} onClick={() => setQuery(tag.replace('#', ''))}>{tag}</button>)}
        </div>
      </section>

      <section className="feature">
        <div className="featureImage premiumScene">
          <div className="orbit one" />
          <div className="orbit two" />
          <div className="glassPreview">
            <span>Before</span>
            <span>After</span>
          </div>
          <b>Prompt of the Day</b>
        </div>
        <div className="featureText">
          <div className="sectionLabel"><Star size={18} /> پرۆمپتی ئەمڕۆ</div>
          <h2>پۆرترێتی سینەمایی بە ڕۆشنایی زێڕین</h2>
          <p>یەک پرۆمپتی پڕۆفیشناڵ بۆ دروستکردنی وێنەی سینەمایی، ڕوون، جوان و ئامادە بۆ سۆشیال میدیا.</p>
          <div className="featureStats">
            <span><Eye size={16} /> 42K بینین</span>
            <span><Heart size={16} /> 8K لایک</span>
            <span><Zap size={16} /> 12K کۆپی</span>
          </div>
          <div className="featureActions">
            <button className="primary" onClick={() => copyText(promptItems[0].text, promptItems[0].title)}>📋 کۆپی پرۆمپت</button>
            <button className="previewButton" onClick={() => setActivePrompt(promptItems[0])}><Eye size={18} /> پێشبینین</button>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="sectionTitle">
          <h2>📂 پۆلەکان</h2>
          <a>هەمووی ببینە</a>
        </div>
        <div className="categoryGrid">
          {categories.map((category) => (
            <button className="categoryCard" key={category.slug} onClick={() => setQuery(category.name)}>
              <span>{category.icon}</span>
              <strong>{category.name}</strong>
              <small>{category.count} پرۆمپت</small>
            </button>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="sectionTitle">
          <h2><Flame size={24} /> {query ? 'ئەنجامی گەڕان' : 'پرۆمپتە بەناوبانگەکان'}</h2>
          <a>{filteredPrompts.length} پرۆمپت</a>
        </div>

        <div className="promptGrid">
          {filteredPrompts.map((item) => (
            <article className="promptCard" key={item.id}>
              <div className={`promptImage ${item.gradient}`}>
                <span>{item.badge}</span>
                <strong>{item.imageTitle}</strong>
              </div>
              <div className="promptMeta">
                <span>{item.category}</span>
                <span>⭐ {item.rating}</span>
                <span>👁 {item.views}</span>
                <span>📋 {item.copies}</span>
              </div>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
              <div className="cardActions">
                <button onClick={() => copyText(item.text, item.title)} className="copyButton">
                  <Copy size={18} /> کۆپی
                </button>
                <button className="previewButton" onClick={() => setActivePrompt(item)}><Eye size={18} /> پێشبینین</button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="collections">
        <h2>💎 کۆمەڵەکان</h2>
        <div className="collectionRow">
          <button>TikTok Viral</button>
          <button>Wedding</button>
          <button>Luxury</button>
          <button>Instagram</button>
        </div>
      </section>

      <footer>
        <strong>پڕۆمپتستان</strong>
        <p>هەموو پرۆمپتێک، لە شوێنێک.</p>
      </footer>
    </main>
  );
}
