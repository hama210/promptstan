import { useEffect, useMemo, useState } from 'react';
import { Copy, Eye, Flame, Globe2, Heart, Home, Layers, Search, Sparkles, Star, Wand2, X, Zap } from 'lucide-react';
import { categories as staticCategories, promptItems as staticPrompts, tags as staticTags } from './data/site.js';
import { loadLibraryData, searchLibrary, trackPromptAction } from './services/liveApiLibrary.js';

const languages = [
  { code: 'KU', label: 'کوردی', flag: '☀️' },
  { code: 'EN', label: 'English', flag: '🇬🇧' },
  { code: 'AR', label: 'العربية', flag: '🇸🇦' }
];

const ui = {
  KU: { free: 'کتێبخانەی فری پرۆمپتی AI', hero: 'شوێنی هەموو پرۆمپتەکانی AI', desc: 'پرۆمپتی ئامادە بۆ دەستکاریکردنی وێنە، پۆرترێت، باکگراوند، بەرهەم و ستایلی سینەمایی.', searchPlaceholder: 'چی دەتەوێت دروست بکەیت؟', search: 'گەڕان', today: 'پرۆمپتی ئەمڕۆ', todayTitle: 'پۆرترێتی سینەمایی بە ڕۆشنایی زێڕین', todayDesc: 'یەک پرۆمپتی پڕۆفیشناڵ بۆ دروستکردنی وێنەی سینەمایی، ڕوون، جوان و ئامادە بۆ سۆشیال میدیا.', copy: 'کۆپی', copyPrompt: 'کۆپی پرۆمپت', preview: 'پێشبینین', categories: 'پۆلەکان', openCategories: 'کردنەوەی پۆلەکان', closeCategories: 'داخستنی پۆلەکان', trending: 'ترێند لەم هەفتەیە', popular: 'پرۆمپتە بەناوبانگەکان', results: 'ئەنجامی گەڕان', prompt: 'پرۆمپت', favorites: 'دڵخوازەکانم', selected: 'هەڵبژێردراو', emptyTitle: 'هێشتا هیچ پرۆمپتێکت دڵخواز نەکردووە', emptyDesc: 'لەسەر دڵی هەر کارتەک کلیک بکە بۆ پاراستنی لە دڵخوازەکانت.', collections: 'کۆمەڵەکان', home: 'ماڵەوە', modalDesc: 'ئەم پرۆمپتە ئامادەیە بۆ کۆپی کردن و بەکارهێنان لە ChatGPT Images، Gemini، Flux، Midjourney و هەر ئامرازی AI ـیەکی وێنە.', addFav: 'زیادکردن بۆ دڵخوازەکان', inFav: 'لە دڵخوازەکاندا هەیە', copied: 'کۆپی کرا', promptCount: 'پرۆمپت' },
  EN: { free: 'Free AI Prompt Library', hero: 'Every AI Prompt in One Place', desc: 'Ready-to-use prompts for photo editing, portraits, backgrounds, products, and cinematic styles.', searchPlaceholder: 'What do you want to create?', search: 'Search', today: 'Prompt of the Day', todayTitle: 'Golden Hour Cinematic Portrait', todayDesc: 'A professional prompt for cinematic, clean, social-media-ready portraits.', copy: 'Copy', copyPrompt: 'Copy Prompt', preview: 'Preview', categories: 'Categories', openCategories: 'Open categories', closeCategories: 'Close categories', trending: 'Trending this week', popular: 'Popular prompts', results: 'Search results', prompt: 'Prompt', favorites: 'My Favorites', selected: 'saved', emptyTitle: 'No favorites yet', emptyDesc: 'Tap the heart on any card to save it here.', collections: 'Collections', home: 'Home', modalDesc: 'This prompt is ready to copy and use with ChatGPT Images, Gemini, Flux, Midjourney, and other AI image tools.', addFav: 'Add to Favorites', inFav: 'Saved in Favorites', copied: 'copied', promptCount: 'prompts' },
  AR: { free: 'مكتبة موجهات AI مجانية', hero: 'كل موجهات الذكاء الاصطناعي في مكان واحد', desc: 'موجهات جاهزة لتعديل الصور والبورتريه والخلفيات والمنتجات والأسلوب السينمائي.', searchPlaceholder: 'ماذا تريد أن تنشئ؟', search: 'بحث', today: 'موجه اليوم', todayTitle: 'بورتريه سينمائي بإضاءة ذهبية', todayDesc: 'موجه احترافي لصناعة صور سينمائية واضحة وجاهزة للسوشيال ميديا.', copy: 'نسخ', copyPrompt: 'نسخ الموجه', preview: 'معاينة', categories: 'الأقسام', openCategories: 'فتح الأقسام', closeCategories: 'إغلاق الأقسام', trending: 'الرائج هذا الأسبوع', popular: 'الموجهات الشائعة', results: 'نتائج البحث', prompt: 'الموجه', favorites: 'المفضلة', selected: 'محفوظ', emptyTitle: 'لا توجد مفضلات بعد', emptyDesc: 'اضغط على القلب في أي بطاقة لحفظها هنا.', collections: 'المجموعات', home: 'الرئيسية', modalDesc: 'هذا الموجه جاهز للنسخ والاستخدام مع ChatGPT Images و Gemini و Flux و Midjourney وأدوات صور AI الأخرى.', addFav: 'إضافة للمفضلة', inFav: 'موجود في المفضلة', copied: 'تم النسخ', promptCount: 'موجهات' }
};

export default function App() {
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState('');
  const [activePrompt, setActivePrompt] = useState(null);
  const [language, setLanguage] = useState('KU');
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [library, setLibrary] = useState({ categories: staticCategories, prompts: staticPrompts, tags: staticTags, source: 'static' });
  const [remoteResults, setRemoteResults] = useState(null);
  const [favoriteIds, setFavoriteIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('promptstan-favorites') || '[]'); } catch { return []; }
  });

  const t = ui[language];
  const isLtr = language === 'EN';
  const promptItems = library.prompts;
  const categories = library.categories;
  const tags = library.tags;

  useEffect(() => { loadLibraryData().then(setLibrary); }, []);
  useEffect(() => {
    localStorage.setItem('promptstan-favorites', JSON.stringify(favoriteIds));
    document.documentElement.lang = language.toLowerCase();
    document.documentElement.dir = isLtr ? 'ltr' : 'rtl';
  }, [favoriteIds, language, isLtr]);
  useEffect(() => {
    let active = true;
    if (!query.trim()) { setRemoteResults(null); return; }
    const timer = window.setTimeout(async () => {
      const results = await searchLibrary(query);
      if (active) setRemoteResults(results);
    }, 300);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query]);

  const filteredPrompts = useMemo(() => {
    if (remoteResults) return remoteResults;
    const term = query.trim().toLowerCase().replace('#', '');
    if (!term) return promptItems;
    return promptItems.filter((item) => `${item.title} ${item.category} ${item.text} ${(item.tags || []).join(' ')}`.toLowerCase().includes(term));
  }, [query, promptItems, remoteResults]);

  const favoritePrompts = useMemo(() => promptItems.filter((item) => favoriteIds.includes(item.id)), [favoriteIds, promptItems]);
  const featuredPrompt = promptItems[0] || staticPrompts[0];

  function copyText(text, title, id) { navigator.clipboard.writeText(text); if (id) trackPromptAction(id, 'copy'); setCopied(title); window.setTimeout(() => setCopied(''), 1800); }
  function openPrompt(item) { setActivePrompt(item); trackPromptAction(item.id, 'view'); }
  function toggleFavorite(id) { setFavoriteIds((cur) => cur.includes(id) ? cur.filter((item) => item !== id) : [...cur, id]); }
  function scrollToSection(id) { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); }
  function chooseCategory(name) { setQuery(name); setCategoriesOpen(false); scrollToSection('search'); }

  const PromptCard = ({ item }) => {
    const isFavorite = favoriteIds.includes(item.id);
    return <article className="promptCard"><button className={isFavorite ? 'heartButton active' : 'heartButton'} onClick={() => toggleFavorite(item.id)} aria-label="favorite"><Heart size={18} fill={isFavorite ? 'currentColor' : 'none'} /></button><div className={`promptImage ${item.gradient || 'purple'}`}><span className="promptBadge">{item.badge}</span><strong>{item.imageTitle}</strong></div><div className="promptMeta"><span>{item.category}</span><span>⭐ {item.rating}</span><span>👁 {item.views}</span><span>📋 {item.copies}</span></div><h3>{item.title}</h3><p>{item.text}</p><div className="tagList miniTags">{(item.tags || []).slice(0, 3).map((tag) => <button key={tag} onClick={() => setQuery(`#${tag}`)}>#{tag}</button>)}</div><div className="cardActions"><button onClick={() => copyText(item.text, item.title, item.id)} className="copyButton"><Copy size={18} /> {t.copy}</button><button className="previewButton" onClick={() => openPrompt(item)}><Eye size={18} /> {t.preview}</button></div></article>;
  };

  return <main className={isLtr ? 'app ltr' : 'app'} dir={isLtr ? 'ltr' : 'rtl'}>
    {copied && <div className="toast">✅ {copied} {t.copied}</div>}
    {activePrompt && <div className="modalOverlay" onClick={() => setActivePrompt(null)}><section className="promptModal" onClick={(event) => event.stopPropagation()}><button className="modalClose" onClick={() => setActivePrompt(null)}><X size={20} /></button><div className={`modalVisual ${activePrompt.gradient || 'purple'}`}><span>{activePrompt.badge}</span><strong>{activePrompt.imageTitle}</strong></div><div className="modalContent"><div className="promptMeta modalMeta"><span>{activePrompt.category}</span><span>⭐ {activePrompt.rating}</span><span>👁 {activePrompt.views}</span><span>📋 {activePrompt.copies}</span></div><h2>{activePrompt.title}</h2><p className="modalDescription">{t.modalDesc}</p><div className="promptBox"><div className="promptBoxHeader"><strong>{t.prompt}</strong><button onClick={() => copyText(activePrompt.text, activePrompt.title, activePrompt.id)}><Copy size={16} /> {t.copy}</button></div><p>{activePrompt.text}</p></div><div className="tagList">{(activePrompt.tags || []).map((tag) => <button key={tag} onClick={() => setQuery(`#${tag}`)}>#{tag}</button>)}</div><div className="modelGrid"><span>ChatGPT Images</span><span>Gemini</span><span>Flux</span><span>Midjourney</span></div><button className={favoriteIds.includes(activePrompt.id) ? 'favoriteWide active' : 'favoriteWide'} onClick={() => toggleFavorite(activePrompt.id)}><Heart size={18} fill={favoriteIds.includes(activePrompt.id) ? 'currentColor' : 'none'} /> {favoriteIds.includes(activePrompt.id) ? t.inFav : t.addFav}</button></div></section></div>}
    <nav className="navbar"><div className="brand"><div className="logoMark"><Wand2 size={22} /></div><div><strong>پڕۆمپتستان</strong><span>Promptstan • {library.source === 'api' ? 'Live D1' : 'Static'}</span></div></div><div className="navActions"><div className="languageTabs">{languages.map((item) => <button key={item.code} className={language === item.code ? 'active' : ''} onClick={() => setLanguage(item.code)}>{item.flag} {item.code}</button>)}</div><button className="ghost" onClick={() => scrollToSection('favorites')}><Heart size={18} /> {favoriteIds.length}</button></div></nav>
    <section className="hero" id="home"><div className="heroBadge"><Sparkles size={18} /> {t.free}</div><h1>{t.hero}</h1><p>{t.desc}</p><div className="searchBox" id="search"><Search size={22} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.searchPlaceholder} /><button><Search size={18} /> {t.search}</button></div><div className="tags">{tags.map((tag) => <button key={tag} onClick={() => setQuery(tag.replace('#', ''))}>{tag}</button>)}</div></section>
    <section className="feature"><div className="featureImage premiumScene"><div className="orbit one" /><div className="orbit two" /><div className="glassPreview"><span>Before</span><span>After</span></div><b>Prompt of the Day</b></div><div className="featureText"><div className="sectionLabel"><Star size={18} /> {t.today}</div><h2>{featuredPrompt.title}</h2><p>{t.todayDesc}</p><div className="featureStats"><span><Eye size={16} /> {featuredPrompt.views}</span><span><Heart size={16} /> {favoriteIds.length}</span><span><Zap size={16} /> {featuredPrompt.copies}</span></div><div className="featureActions"><button className="primary" onClick={() => copyText(featuredPrompt.text, featuredPrompt.title, featuredPrompt.id)}>📋 {t.copyPrompt}</button><button className="previewButton" onClick={() => openPrompt(featuredPrompt)}><Eye size={18} /> {t.preview}</button></div></div></section>
    <section className="section"><div className="sectionTitle"><h2><Flame size={24} /> {t.trending}</h2><a>{promptItems.slice(0, 3).length} {t.promptCount}</a></div><div className="miniRow">{promptItems.slice(0, 3).map((item) => <button key={item.id} className="miniTrend" onClick={() => openPrompt(item)}><span>{item.badge}</span><strong>{item.title}</strong><small>👁 {item.views} • 📋 {item.copies}</small></button>)}</div></section>
    <section className="section"><div className="sectionTitle"><h2><Flame size={24} /> {query ? t.results : t.popular}</h2><a>{filteredPrompts.length} {t.promptCount}</a></div><div className="promptGrid">{filteredPrompts.map((item) => <PromptCard item={item} key={item.id} />)}</div></section>
    <section className="section" id="favorites"><div className="sectionTitle"><h2><Heart size={24} /> {t.favorites}</h2><a>{favoriteIds.length} {t.selected}</a></div>{favoritePrompts.length === 0 ? <div className="emptyState"><Heart size={34} /><h3>{t.emptyTitle}</h3><p>{t.emptyDesc}</p></div> : <div className="miniRow">{favoritePrompts.map((item) => <button key={item.id} className="miniTrend" onClick={() => openPrompt(item)}><span>❤️ {t.favorites}</span><strong>{item.title}</strong><small>{item.category}</small></button>)}</div>}</section>
    <section className="collections"><h2>💎 {t.collections}</h2><div className="collectionRow"><button>TikTok Viral</button><button>Wedding</button><button>Luxury</button><button>Instagram</button></div></section>
    <section className="section categoryDrawer" id="categories"><div className="sectionTitle"><h2>📂 {t.categories}</h2><button className="categoryToggle" onClick={() => setCategoriesOpen((open) => !open)}>{categoriesOpen ? t.closeCategories : t.openCategories}</button></div>{categoriesOpen && <div className="categoryPanel"><div className="categoryGrid">{categories.map((category) => <button className="categoryCard" key={category.slug} onClick={() => chooseCategory(category.name)}><span>{category.icon}</span><strong>{category.name}</strong><small>{category.count} {t.promptCount}</small></button>)}</div></div>}</section>
    <footer><strong>پڕۆمپتستان</strong><p>هەموو پرۆمپتێک، لە شوێنێک.</p></footer>
    <nav className="bottomNav"><button onClick={() => scrollToSection('home')}><Home size={20} /><span>{t.home}</span></button><button onClick={() => scrollToSection('search')}><Search size={20} /><span>{t.search}</span></button><button onClick={() => scrollToSection('favorites')}><Heart size={20} /><span>{favoriteIds.length}</span></button><button onClick={() => scrollToSection('categories')}><Layers size={20} /><span>{t.categories}</span></button><button onClick={() => setLanguage(language === 'KU' ? 'EN' : language === 'EN' ? 'AR' : 'KU')}><Globe2 size={20} /><span>{language}</span></button></nav>
  </main>;
}
