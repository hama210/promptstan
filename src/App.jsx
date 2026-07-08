import { Copy, Flame, Globe2, Search, Sparkles, Star, Wand2 } from 'lucide-react';
import { categories, promptItems, tags } from './data/site.js';

function copyText(text) {
  navigator.clipboard.writeText(text);
}

export default function App() {
  return (
    <main className="app" dir="rtl">
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
          <input placeholder="چی دەتەوێت دروست بکەیت؟" />
          <button>گەڕان</button>
        </div>

        <div className="tags">
          {tags.map((tag) => <span key={tag}>{tag}</span>)}
        </div>
      </section>

      <section className="feature">
        <div className="featureImage">
          <span>Prompt of the Day</span>
        </div>
        <div className="featureText">
          <div className="sectionLabel"><Star size={18} /> پرۆمپتی ئەمڕۆ</div>
          <h2>پۆرترێتی سینەمایی بە ڕۆشنایی جوان</h2>
          <p>ئەم پرۆمپتە بۆ دروستکردنی وێنەی پڕۆفیشناڵ و جوان بە شێوازی سینەماییە.</p>
          <button className="primary">📋 کۆپی پرۆمپت</button>
        </div>
      </section>

      <section className="section">
        <div className="sectionTitle">
          <h2>📂 پۆلەکان</h2>
          <a>هەمووی ببینە</a>
        </div>
        <div className="categoryGrid">
          {categories.map((category) => (
            <button className="categoryCard" key={category.slug}>
              <span>{category.icon}</span>
              {category.name}
            </button>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="sectionTitle">
          <h2><Flame size={24} /> پرۆمپتە بەناوبانگەکان</h2>
          <a>زیاتر</a>
        </div>

        <div className="promptGrid">
          {promptItems.map((item) => (
            <article className="promptCard" key={item.id}>
              <div className={`promptImage ${item.gradient}`}>
                <span>{item.badge}</span>
              </div>
              <div className="promptMeta">
                <span>{item.category}</span>
                <span>👁 {item.views}</span>
                <span>📋 {item.copies}</span>
              </div>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
              <button onClick={() => copyText(item.text)} className="copyButton">
                <Copy size={18} /> کۆپی کردن
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="collections">
        <h2>💎 کۆمەڵەکان</h2>
        <div className="collectionRow">
          <span>TikTok Viral</span>
          <span>Wedding</span>
          <span>Luxury</span>
          <span>Instagram</span>
        </div>
      </section>

      <footer>
        <strong>پڕۆمپتستان</strong>
        <p>هەموو پرۆمپتێک، لە شوێنێک.</p>
      </footer>
    </main>
  );
}
