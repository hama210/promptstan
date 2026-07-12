import { useEffect, useMemo, useState } from 'react';
import { Copy, Eye, Flame, Globe2, Heart, Home, Layers, Link2, Search, Share2, Sparkles, Star, Wand2, X, Zap } from 'lucide-react';
import { categories as staticCategories, promptItems as staticPrompts, tags as staticTags } from './data/site.js';
import { getPromptBySlug, loadLibraryData, normalizePrompt, searchLibrary, trackPromptAction } from './services/liveApiLibrary.js';

const languages = [
  { code: 'KU', label: 'کوردی', flag: '☀️' },
  { code: 'EN', label: 'English', flag: '🇬🇧' },
  { code: 'AR', label: 'العربية', flag: '🇸🇦' }
];

const collections = [
  { label: 'TikTok Viral', query: 'viral' },
  { label: 'Wedding', query: 'wedding' },
  { label: 'Luxury', query: 'luxury' },
  { label: 'Instagram', query: 'instagram' }
];

const ui = {
  KU: {
    free: 'کتێبخانەی فری پرۆمپتی AI',
    hero: 'پرۆمپتی تەواو بۆ دەستکاری کەس',
    desc: 'پرۆمپتی ئامادە بۆ یەک کەس، دوو کەس، کۆمەڵە کەس، جل و بەرگی کوردی، سووت، و ستایلی فیلم.',
    searchPlaceholder: 'چی دەتەوێت بکەیت؟ وەک: دوو کەس، Kurdish clothes، movie style',
    search: 'گەڕان',
    today: 'پرۆمپتی ئەمڕۆ',
    todayDesc: 'پرۆمپتێکی پڕۆفیشناڵ بۆ دەستکاری وێنەی کەس بە شێوەی ڕاستەقینە، جوان و ئامادە بۆ سۆشیال میدیا.',
    copy: 'کۆپی',
    copyPrompt: 'کۆپی پرۆمپت',
    preview: 'پێشبینین',
    share: 'هاوبەشکردن',
    linkCopied: 'لینکی پرۆمپتەکە کۆپی کرا',
    categories: 'پۆلەکان',
    openCategories: 'کردنەوەی پۆلەکان',
    closeCategories: 'داخستنی پۆلەکان',
    trending: 'ترێند لەم هەفتەیە',
    popular: 'پرۆمپتە بەناوبانگەکان',
    results: 'ئەنجامی گەڕان',
    prompt: 'پرۆمپت',
    favorites: 'دڵخوازەکانم',
    selected: 'هەڵبژێردراو',
    emptyTitle: 'هێشتا هیچ پرۆمپتێکت دڵخواز نەکردووە',
    emptyDesc: 'لەسەر دڵی هەر کارتەک کلیک بکە بۆ پاراستنی لە دڵخوازەکانت.',
    noResults: 'هیچ پرۆمپتێک بۆ ئەم گەڕانە نەدۆزرایەوە.',
    collections: 'کۆمەڵەکان',
    related: 'پرۆمپتی پەیوەندیدار',
    home: 'ماڵەوە',
    modalDesc: 'ئەم پرۆمپتە ئامادەیە بۆ کۆپی کردن و بەکارهێنان لە ChatGPT Images، Gemini، Flux، Midjourney و هەر ئامرازی AI ـیەکی وێنە.',
    addFav: 'زیادکردن بۆ دڵخوازەکان',
    inFav: 'لە دڵخوازەکاندا هەیە',
    copied: 'کۆپی کرا',
    promptCount: 'پرۆمپت',
    before: 'پێش',
    after: 'دوای'
  },
  EN: {
    free: 'Free AI Prompt Library',
    hero: 'Person Edit Prompts in One Place',
    desc: 'Ready-to-use prompts for one person, two people, groups, Kurdish clothes, suits, movie style, and realistic photo edits.',
    searchPlaceholder: 'What do you want? Try: two people, Kurdish clothes, movie style',
    search: 'Search',
    today: 'Prompt of the Day',
    todayDesc: 'A professional prompt for realistic person edits that look clean, cinematic, and social-media-ready.',
    copy: 'Copy',
    copyPrompt: 'Copy Prompt',
    preview: 'Preview',
    share: 'Share',
    linkCopied: 'Prompt link copied',
    categories: 'Categories',
    openCategories: 'Open categories',
    closeCategories: 'Close categories',
    trending: 'Trending this week',
    popular: 'Popular prompts',
    results: 'Search results',
    prompt: 'Prompt',
    favorites: 'My Favorites',
    selected: 'saved',
    emptyTitle: 'No favorites yet',
    emptyDesc: 'Tap the heart on any card to save it here.',
    noResults: 'No prompts matched this search.',
    collections: 'Collections',
    related: 'Related prompts',
    home: 'Home',
    modalDesc: 'This prompt is ready to copy and use with ChatGPT Images, Gemini, Flux, Midjourney, and other AI image tools.',
    addFav: 'Add to Favorites',
    inFav: 'Saved in Favorites',
    copied: 'copied',
    promptCount: 'prompts',
    before: 'Before',
    after: 'After'
  },
  AR: {
    free: 'مكتبة موجهات AI مجانية',
    hero: 'موجهات تعديل الأشخاص في مكان واحد',
    desc: 'موجهات جاهزة لشخص واحد، شخصين، مجموعة أشخاص، ملابس كردية، بدلة، أسلوب أفلام، وتعديلات واقعية.',
    searchPlaceholder: 'ماذا تريد؟ جرّب: شخصين، ملابس كردية، أسلوب فيلم',
    search: 'بحث',
    today: 'موجه اليوم',
    todayDesc: 'موجه احترافي لتعديل صور الأشخاص بشكل واقعي وسينمائي وجاهز للسوشيال ميديا.',
    copy: 'نسخ',
    copyPrompt: 'نسخ الموجه',
    preview: 'معاينة',
    share: 'مشاركة',
    linkCopied: 'تم نسخ رابط الموجه',
    categories: 'الأقسام',
    openCategories: 'فتح الأقسام',
    closeCategories: 'إغلاق الأقسام',
    trending: 'الرائج هذا الأسبوع',
    popular: 'الموجهات الشائعة',
    results: 'نتائج البحث',
    prompt: 'الموجه',
    favorites: 'المفضلة',
    selected: 'محفوظ',
    emptyTitle: 'لا توجد مفضلات بعد',
    emptyDesc: 'اضغط على القلب في أي بطاقة لحفظه هنا.',
    noResults: 'لم يتم العثور على موجهات مطابقة.',
    collections: 'المجموعات',
    related: 'موجهات مشابهة',
    home: 'الرئيسية',
    modalDesc: 'هذا الموجه جاهز للنسخ والاستخدام مع ChatGPT Images و Gemini و Flux و Midjourney وأدوات صور AI الأخرى.',
    addFav: 'إضافة للمفضلة',
    inFav: 'موجود في المفضلة',
    copied: 'تم النسخ',
    promptCount: 'موجهات',
    before: 'قبل',
    after: 'بعد'
  }
};

const DEFAULT_TITLE = 'پڕۆمپتستان | Promptstan';
const DEFAULT_DESCRIPTION = 'پڕۆمپتستان - کتێبخانەی فری پرۆمپتی AI بۆ دەستکاریکردنی وێنە.';
const initialStaticPrompts = staticPrompts.map((prompt, index) => normalizePrompt(prompt, index, 'static'));

function VisualPreview({ item, t, type = 'card' }) {
  const className = type === 'modal' ? 'modalVisual' : type === 'feature' ? 'featureImage premiumScene' : 'promptImage';

  if (item?.hasBeforeAfter) {
    return <div className={`${className} beforeAfterVisual`}>
      <div className="beforeAfterPane"><img src={item.beforeImage} alt={`${item.title} before`} loading="lazy" /><span>{t.before}</span></div>
      <div className="beforeAfterPane"><img src={item.afterImage} alt={`${item.title} after`} loading="lazy" /><span>{t.after}</span></div>
      <strong className="beforeAfterTitle">{item.imageTitle}</strong>
      <span className="promptBadge beforeAfterBadge">{item.badge}</span>
    </div>;
  }

  if (item?.previewImage) {
    return <div className={`${className} hasPreview`}>
      <img className={type === 'modal' ? 'modalPreviewImage' : type === 'feature' ? 'featurePreviewImage' : 'promptImagePreview'} src={item.previewImage} alt={item.title} loading="lazy" />
      <span className="promptBadge">{item.badge}</span>
      <strong>{item.imageTitle}</strong>
    </div>;
  }

  return <div className={`${className} ${item?.gradient || 'purple'}`}>
    {type === 'feature' && <><div className="orbit one" /><div className="orbit two" /><div className="glassPreview"><span>{t.before}</span><span>{t.after}</span></div></>}
    <span className="promptBadge">{item?.badge || 'نوێ'}</span>
    <strong>{item?.imageTitle || 'Person Edit'}</strong>
  </div>;
}

function upsertMeta(selector, attributes) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement('meta');
    document.head.appendChild(element);
  }
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
}

function upsertCanonical(url) {
  let element = document.head.querySelector('link[rel="canonical"]');
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', 'canonical');
    document.head.appendChild(element);
  }
  element.setAttribute('href', url);
}

function promptSearchText(item) {
  return `${item.title} ${item.imageTitle} ${item.category} ${item.description} ${item.text} ${(item.tags || []).join(' ')}`.toLowerCase();
}

function isFavoritePrompt(item, favoriteIds) {
  return favoriteIds.includes(item.key) || favoriteIds.includes(item.id) || favoriteIds.includes(String(item.id));
}

export default function App() {
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState('');
  const [activePrompt, setActivePrompt] = useState(null);
  const [language, setLanguage] = useState('KU');
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [library, setLibrary] = useState({
    categories: staticCategories,
    prompts: initialStaticPrompts,
    tags: staticTags,
    source: 'static',
    liveCount: 0,
    staticCount: initialStaticPrompts.length
  });
  const [remoteResults, setRemoteResults] = useState(null);
  const [favoriteIds, setFavoriteIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('promptstan-favorites') || '[]'); } catch { return []; }
  });

  const t = ui[language];
  const isLtr = language === 'EN';
  const promptItems = library.prompts;
  const categories = library.categories;
  const tags = library.tags;
  const featuredPrompt = promptItems[0] || initialStaticPrompts[0];

  useEffect(() => { loadLibraryData().then(setLibrary); }, []);

  useEffect(() => {
    localStorage.setItem('promptstan-favorites', JSON.stringify(favoriteIds));
    document.documentElement.lang = language.toLowerCase();
    document.documentElement.dir = isLtr ? 'ltr' : 'rtl';
  }, [favoriteIds, language, isLtr]);

  useEffect(() => {
    let active = true;
    if (!query.trim()) { setRemoteResults(null); return undefined; }

    const timer = window.setTimeout(async () => {
      const results = await searchLibrary(query);
      if (active) setRemoteResults(results);
    }, 300);

    return () => { active = false; window.clearTimeout(timer); };
  }, [query]);

  useEffect(() => {
    let cancelled = false;

    async function syncPromptRoute() {
      const match = window.location.pathname.match(/^\/prompt\/([^/]+)\/?$/);
      if (!match) {
        if (!cancelled) setActivePrompt(null);
        return;
      }

      const slug = decodeURIComponent(match[1]);
      const localPrompt = promptItems.find((item) => item.slug === slug);
      const prompt = localPrompt || await getPromptBySlug(slug);
      if (!cancelled && prompt) setActivePrompt(prompt);
    }

    syncPromptRoute();
    window.addEventListener('popstate', syncPromptRoute);
    return () => {
      cancelled = true;
      window.removeEventListener('popstate', syncPromptRoute);
    };
  }, [promptItems]);

  useEffect(() => {
    if (!activePrompt) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') closePrompt();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activePrompt]);

  useEffect(() => {
    const url = activePrompt ? `${window.location.origin}/prompt/${encodeURIComponent(activePrompt.slug)}` : window.location.origin;
    const title = activePrompt ? `${activePrompt.title} | Promptstan` : DEFAULT_TITLE;
    const description = activePrompt?.description || (activePrompt ? activePrompt.text.slice(0, 180) : DEFAULT_DESCRIPTION);
    const image = activePrompt?.afterImage || activePrompt?.previewImage || activePrompt?.beforeImage || `${window.location.origin}/favicon.svg`;

    document.title = title;
    upsertCanonical(url);
    upsertMeta('meta[name="description"]', { name: 'description', content: description });
    upsertMeta('meta[property="og:type"]', { property: 'og:type', content: activePrompt ? 'article' : 'website' });
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: title });
    upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description });
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: url });
    upsertMeta('meta[property="og:image"]', { property: 'og:image', content: image });
    upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title });
    upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description });
    upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: image });
  }, [activePrompt]);

  const filteredPrompts = useMemo(() => {
    const term = query.trim().toLowerCase().replace('#', '');
    if (!term) return promptItems;

    const localResults = promptItems.filter((item) => promptSearchText(item).includes(term));
    const merged = [...(remoteResults || []), ...localResults];
    const seen = new Set();
    return merged.filter((item) => {
      if (seen.has(item.slug)) return false;
      seen.add(item.slug);
      return true;
    });
  }, [query, promptItems, remoteResults]);

  const favoritePrompts = useMemo(
    () => promptItems.filter((item) => isFavoritePrompt(item, favoriteIds)),
    [favoriteIds, promptItems]
  );

  const relatedPrompts = useMemo(() => {
    if (!activePrompt) return [];
    const activeTags = new Set(activePrompt.tags || []);

    return promptItems
      .filter((item) => item.slug !== activePrompt.slug)
      .map((item) => {
        const sharedTags = (item.tags || []).filter((tag) => activeTags.has(tag)).length;
        const score = sharedTags * 3 + (item.category === activePrompt.category ? 2 : 0);
        return { item, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(({ item }) => item);
  }, [activePrompt, promptItems]);

  function showNotice(message) {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 1800);
  }

  async function copyText(text, title, trackId) {
    await navigator.clipboard.writeText(text);
    if (trackId) trackPromptAction(trackId, 'copy');
    showNotice(`${title} ${t.copied}`);
  }

  function openPrompt(item) {
    const path = `/prompt/${encodeURIComponent(item.slug)}`;
    if (window.location.pathname !== path) window.history.pushState({ promptstanPrompt: true }, '', path);
    setActivePrompt(item);
    trackPromptAction(item.trackId, 'view');
  }

  function closePrompt() {
    if (window.location.pathname.startsWith('/prompt/')) {
      if (window.history.state?.promptstanPrompt) window.history.back();
      else window.history.replaceState({}, '', '/');
    }
    setActivePrompt(null);
  }

  async function sharePrompt(item) {
    const url = `${window.location.origin}/prompt/${encodeURIComponent(item.slug)}`;
    const shareData = { title: item.title, text: item.description || item.text.slice(0, 120), url };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(url);
        showNotice(t.linkCopied);
      }
    } catch (error) {
      if (error?.name !== 'AbortError') {
        await navigator.clipboard.writeText(url);
        showNotice(t.linkCopied);
      }
    }
  }

  function toggleFavorite(item) {
    const token = item.key || String(item.id);
    setFavoriteIds((current) => {
      const aliases = new Set([token, item.id, String(item.id)]);
      const isFavorite = current.some((value) => aliases.has(value));
      if (isFavorite) return current.filter((value) => !aliases.has(value));
      return [...current, token];
    });
  }

  function scrollToSection(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }

  function chooseCategory(name) {
    setQuery(name);
    setCategoriesOpen(false);
    scrollToSection('prompts');
  }

  function chooseCollection(collection) {
    setQuery(collection.query);
    scrollToSection('prompts');
  }

  const PromptCard = ({ item }) => {
    const isFavorite = isFavoritePrompt(item, favoriteIds);

    return <article className="promptCard">
      <button className={isFavorite ? 'heartButton active' : 'heartButton'} onClick={() => toggleFavorite(item)} aria-label="favorite"><Heart size={18} fill={isFavorite ? 'currentColor' : 'none'} /></button>
      <VisualPreview item={item} t={t} />
      <div className="promptMeta"><span>{item.category}</span><span>⭐ {item.rating}</span><span>👁 {item.views}</span><span>📋 {item.copies}</span></div>
      <h3>{item.title}</h3>
      <p>{item.text}</p>
      <div className="tagList miniTags">{(item.tags || []).slice(0, 3).map((tag) => <button key={tag} onClick={() => setQuery(`#${tag}`)}>#{tag}</button>)}</div>
      <div className="cardActions">
        <button onClick={() => copyText(item.text, item.title, item.trackId)} className="copyButton"><Copy size={18} /> {t.copy}</button>
        <button className="previewButton" onClick={() => openPrompt(item)}><Eye size={18} /> {t.preview}</button>
        <button className="cardShareButton" onClick={() => sharePrompt(item)} aria-label={t.share}><Share2 size={18} /></button>
      </div>
    </article>;
  };

  const activeIsFavorite = activePrompt ? isFavoritePrompt(activePrompt, favoriteIds) : false;
  const sourceLabel = library.source === 'hybrid'
    ? `${library.liveCount} Live + ${library.staticCount} Library`
    : 'Built-in Library';

  return <main className={isLtr ? 'app ltr' : 'app'} dir={isLtr ? 'ltr' : 'rtl'}>
    {notice && <div className="toast">✅ {notice}</div>}

    {activePrompt && <div className="modalOverlay" onClick={closePrompt}>
      <section className="promptModal" onClick={(event) => event.stopPropagation()}>
        <button className="modalClose" onClick={closePrompt} aria-label="close"><X size={20} /></button>
        <VisualPreview item={activePrompt} t={t} type="modal" />
        <div className="modalContent">
          <div className="promptMeta modalMeta"><span>{activePrompt.category}</span><span>⭐ {activePrompt.rating}</span><span>👁 {activePrompt.views}</span><span>📋 {activePrompt.copies}</span></div>
          <h2>{activePrompt.title}</h2>
          <p className="modalDescription">{activePrompt.description || t.modalDesc}</p>
          <div className="promptBox"><div className="promptBoxHeader"><strong>{t.prompt}</strong><button onClick={() => copyText(activePrompt.text, activePrompt.title, activePrompt.trackId)}><Copy size={16} /> {t.copy}</button></div><p>{activePrompt.text}</p></div>
          <div className="tagList">{(activePrompt.tags || []).map((tag) => <button key={tag} onClick={() => setQuery(`#${tag}`)}>#{tag}</button>)}</div>
          <div className="modelGrid"><span>ChatGPT Images</span><span>Gemini</span><span>Flux</span><span>Midjourney</span></div>
          <div className="modalActionRow">
            <button className={activeIsFavorite ? 'favoriteWide active' : 'favoriteWide'} onClick={() => toggleFavorite(activePrompt)}><Heart size={18} fill={activeIsFavorite ? 'currentColor' : 'none'} /> {activeIsFavorite ? t.inFav : t.addFav}</button>
            <button className="shareWide" onClick={() => sharePrompt(activePrompt)}><Share2 size={18} /> {t.share}<Link2 size={15} /></button>
          </div>
          {relatedPrompts.length > 0 && <div className="relatedPrompts">
            <h3>{t.related}</h3>
            <div className="relatedPromptGrid">{relatedPrompts.map((item) => <button key={item.key} onClick={() => openPrompt(item)}><span>{item.badge}</span><strong>{item.title}</strong><small>{item.category}</small></button>)}</div>
          </div>}
        </div>
      </section>
    </div>}

    <nav className="navbar"><div className="brand"><div className="logoMark"><Wand2 size={22} /></div><div><strong>پڕۆمپتستان</strong><span>Promptstan • {sourceLabel}</span></div></div><div className="navActions"><div className="languageTabs">{languages.map((item) => <button key={item.code} className={language === item.code ? 'active' : ''} onClick={() => setLanguage(item.code)}>{item.flag} {item.code}</button>)}</div><button className="ghost" onClick={() => scrollToSection('favorites')}><Heart size={18} /> {favoritePrompts.length}</button></div></nav>

    <section className="hero" id="home"><div className="heroBadge"><Sparkles size={18} /> {t.free}</div><h1>{t.hero}</h1><p>{t.desc}</p><div className="searchBox" id="search"><Search size={22} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.searchPlaceholder} /><button onClick={() => scrollToSection('prompts')}><Search size={18} /> {t.search}</button></div><div className="tags">{tags.map((tag) => <button key={tag} onClick={() => setQuery(tag.replace('#', ''))}>{tag}</button>)}</div></section>

    <section className="feature"><VisualPreview item={featuredPrompt} t={t} type="feature" /><div className="featureText"><div className="sectionLabel"><Star size={18} /> {t.today}</div><h2>{featuredPrompt.title}</h2><p>{t.todayDesc}</p><div className="featureStats"><span><Eye size={16} /> {featuredPrompt.views}</span><span><Heart size={16} /> {favoritePrompts.length}</span><span><Zap size={16} /> {featuredPrompt.copies}</span></div><div className="featureActions"><button className="primary" onClick={() => copyText(featuredPrompt.text, featuredPrompt.title, featuredPrompt.trackId)}>📋 {t.copyPrompt}</button><button className="previewButton" onClick={() => openPrompt(featuredPrompt)}><Eye size={18} /> {t.preview}</button><button className="cardShareButton featureShare" onClick={() => sharePrompt(featuredPrompt)} aria-label={t.share}><Share2 size={18} /></button></div></div></section>

    <section className="section"><div className="sectionTitle"><h2><Flame size={24} /> {t.trending}</h2><a>{promptItems.slice(0, 3).length} {t.promptCount}</a></div><div className="miniRow">{promptItems.slice(0, 3).map((item) => <button key={item.key} className="miniTrend" onClick={() => openPrompt(item)}><span>{item.badge}</span><strong>{item.title}</strong><small>👁 {item.views} • 📋 {item.copies}</small></button>)}</div></section>

    <section className="collections"><h2>💎 {t.collections}</h2><div className="collectionRow">{collections.map((collection) => <button key={collection.query} className={query.toLowerCase() === collection.query ? 'active' : ''} onClick={() => chooseCollection(collection)}>{collection.label}</button>)}</div></section>

    <section className="section" id="prompts"><div className="sectionTitle"><h2><Flame size={24} /> {query ? t.results : t.popular}</h2><a>{filteredPrompts.length} {t.promptCount}</a></div>{filteredPrompts.length > 0 ? <div className="promptGrid">{filteredPrompts.map((item) => <PromptCard item={item} key={item.key} />)}</div> : <div className="emptyState"><Search size={34} /><h3>{t.noResults}</h3><button className="categoryToggle" onClick={() => setQuery('')}>{t.popular}</button></div>}</section>

    <section className="section" id="favorites"><div className="sectionTitle"><h2><Heart size={24} /> {t.favorites}</h2><a>{favoritePrompts.length} {t.selected}</a></div>{favoritePrompts.length === 0 ? <div className="emptyState"><Heart size={34} /><h3>{t.emptyTitle}</h3><p>{t.emptyDesc}</p></div> : <div className="miniRow">{favoritePrompts.map((item) => <button key={item.key} className="miniTrend" onClick={() => openPrompt(item)}><span>❤️ {t.favorites}</span><strong>{item.title}</strong><small>{item.category}</small></button>)}</div>}</section>

    <section className="section categoryDrawer" id="categories"><div className="sectionTitle"><h2>📂 {t.categories}</h2><button className="categoryToggle" onClick={() => setCategoriesOpen((open) => !open)}>{categoriesOpen ? t.closeCategories : t.openCategories}</button></div>{categoriesOpen && <div className="categoryPanel"><div className="categoryGrid">{categories.map((category) => <button className="categoryCard" key={category.slug} onClick={() => chooseCategory(category.name)}><span>{category.icon}</span><strong>{category.name}</strong><small>{category.count} {t.promptCount}</small></button>)}</div></div>}</section>
    <footer><strong>پڕۆمپتستان</strong><p>هەموو پرۆمپتێک، لە شوێنێک.</p></footer>
    <nav className="bottomNav"><button onClick={() => scrollToSection('home')}><Home size={20} /><span>{t.home}</span></button><button onClick={() => scrollToSection('search')}><Search size={20} /><span>{t.search}</span></button><button onClick={() => scrollToSection('favorites')}><Heart size={20} /><span>{favoritePrompts.length}</span></button><button onClick={() => scrollToSection('categories')}><Layers size={20} /><span>{t.categories}</span></button><button onClick={() => setLanguage(language === 'KU' ? 'EN' : language === 'EN' ? 'AR' : 'KU')}><Globe2 size={20} /><span>{language}</span></button></nav>
  </main>;
}
