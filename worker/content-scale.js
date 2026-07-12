const DUPLICATE_THRESHOLD = 0.84;
const BOT_MIN_QUALITY = 70;
const MAX_SCAN_PROMPTS = 180;

const SUBJECTS = [
  {
    key: 'one-person',
    title_en: 'One Person',
    title_ku: 'یەک کەس',
    title_ar: 'شخص واحد',
    prompt: 'one person in a natural confident pose',
    identity: 'preserve the person’s exact facial identity and natural proportions',
    tags: ['OnePerson', 'Portrait']
  },
  {
    key: 'two-people',
    title_en: 'Two People',
    title_ku: 'دوو کەس',
    title_ar: 'شخصان',
    prompt: 'two people standing naturally together with believable body positions',
    identity: 'preserve both people’s exact facial identities, heights, and natural proportions',
    tags: ['TwoPeople', 'PersonEdit']
  },
  {
    key: 'couple-two-photos',
    title_en: 'Couple From Two Photos',
    title_ku: 'دوو کەس لە دوو وێنەوە',
    title_ar: 'شخصان من صورتين',
    prompt: 'a couple combined from two separate source photos into one coherent scene',
    identity: 'preserve both original faces and match pose, scale, lighting, and shadows realistically',
    tags: ['TwoPhotos', 'Couple']
  },
  {
    key: 'three-friends',
    title_en: 'Three Friends',
    title_ku: 'سێ هاوڕێ',
    title_ar: 'ثلاثة أصدقاء',
    prompt: 'three friends together in a relaxed and balanced group composition',
    identity: 'preserve every person’s face and keep hands, spacing, and body proportions natural',
    tags: ['Friends', 'GroupPhoto']
  },
  {
    key: 'family-group',
    title_en: 'Family Group',
    title_ku: 'گروپی خێزان',
    title_ar: 'مجموعة عائلية',
    prompt: 'a family group arranged in a warm, natural, and emotionally connected composition',
    identity: 'preserve every family member’s identity, age, and realistic body proportions',
    tags: ['Family', 'GroupPhoto']
  }
];

const STYLES = [
  {
    key: 'kurdish-traditional',
    title_en: 'Kurdish Traditional Style',
    title_ku: 'بە جل و بەرگی کوردی',
    title_ar: 'بملابس كردية تقليدية',
    category: 'kurdish-style',
    prompt: 'authentic traditional Kurdish clothing, detailed fabric, accurate accessories, dignified styling',
    light: 'warm cinematic mountain light',
    tags: ['Kurdish', 'TraditionalClothes']
  },
  {
    key: 'professional-suit',
    title_en: 'Professional Suit Style',
    title_ku: 'بە سووتی پڕۆفیشناڵ',
    title_ar: 'ببدلة احترافية',
    category: 'outfit',
    prompt: 'premium tailored suits, realistic fabric folds, elegant professional styling',
    light: 'soft executive portrait lighting',
    tags: ['Suit', 'Business']
  },
  {
    key: 'cinematic-movie',
    title_en: 'Cinematic Movie Style',
    title_ku: 'بە ستایلی فیلم',
    title_ar: 'بأسلوب سينمائي',
    category: 'movies',
    prompt: 'dramatic movie-scene styling, refined film color grading, expressive but natural mood',
    light: 'cinematic key light with controlled contrast',
    tags: ['MovieStyle', 'Cinematic']
  },
  {
    key: 'elegant-wedding',
    title_en: 'Elegant Wedding Style',
    title_ku: 'بە ستایلی ئاهەنگی هاوسەرگیری',
    title_ar: 'بأسلوب زفاف أنيق',
    category: 'couples',
    prompt: 'elegant wedding clothing, tasteful celebration details, refined formal styling',
    light: 'soft romantic wedding light',
    tags: ['Wedding', 'Elegant']
  },
  {
    key: 'luxury-fashion',
    title_en: 'Luxury Fashion Style',
    title_ku: 'بە ستایلی فاشنی لوکس',
    title_ar: 'بأسلوب أزياء فاخر',
    category: 'outfit',
    prompt: 'luxury fashion styling, premium materials, editorial wardrobe, sophisticated details',
    light: 'high-end fashion photography lighting',
    tags: ['Luxury', 'Fashion']
  },
  {
    key: 'rain-drama',
    title_en: 'Rain Drama Style',
    title_ku: 'بە ستایلی درامای باران',
    title_ar: 'بأسلوب درامي ممطر',
    category: 'movies',
    prompt: 'subtle rain, believable wet clothes and hair, emotional cinematic atmosphere, reflective surfaces',
    light: 'moody rain lighting with realistic reflections',
    tags: ['Rain', 'Drama']
  },
  {
    key: 'golden-hour',
    title_en: 'Golden Hour Style',
    title_ku: 'بە ڕووناکی کاتی زێڕین',
    title_ar: 'بإضاءة الساعة الذهبية',
    category: 'person-edit',
    prompt: 'natural contemporary clothing, warm skin tones, relaxed lifestyle photography styling',
    light: 'soft golden-hour sunlight with gentle rim light',
    tags: ['GoldenHour', 'Natural']
  },
  {
    key: 'neon-night',
    title_en: 'Neon Night Style',
    title_ku: 'بە ستایلی شەوی نیۆن',
    title_ar: 'بأسلوب ليلي نيون',
    category: 'movies',
    prompt: 'modern night styling, tasteful neon accents, realistic wet-ground reflections, cinematic urban mood',
    light: 'balanced neon lighting that keeps faces clear and skin tones natural',
    tags: ['Neon', 'Night']
  }
];

const SCENES = [
  {
    key: 'erbil-citadel',
    title_en: 'Erbil Citadel',
    title_ku: 'قەڵای هەولێر',
    title_ar: 'قلعة أربيل',
    prompt: 'near the historic Erbil Citadel with authentic stone textures and a clean background',
    tags: ['Erbil', 'Citadel']
  },
  {
    key: 'mountain-valley',
    title_en: 'Kurdistan Mountain Valley',
    title_ku: 'دۆڵێکی شاخاوی کوردستان',
    title_ar: 'وادي جبلي في كردستان',
    prompt: 'in a Kurdistan mountain valley with layered scenery, natural depth, and believable atmosphere',
    tags: ['Kurdistan', 'Mountain']
  },
  {
    key: 'premium-studio',
    title_en: 'Premium Studio',
    title_ku: 'ستۆدیۆی پڕیمیۆم',
    title_ar: 'استوديو فاخر',
    prompt: 'inside a premium photography studio with a minimal textured backdrop and controlled composition',
    tags: ['Studio', 'Portrait']
  },
  {
    key: 'modern-city',
    title_en: 'Modern City Street',
    title_ku: 'شەقامی شارێکی مۆدێرن',
    title_ar: 'شارع مدينة حديثة',
    prompt: 'on a modern city street with realistic architecture, clean perspective, and subtle background activity',
    tags: ['City', 'Street']
  },
  {
    key: 'elegant-hall',
    title_en: 'Elegant Indoor Hall',
    title_ku: 'هۆڵێکی ناوخۆی جوان',
    title_ar: 'قاعة داخلية أنيقة',
    prompt: 'inside an elegant hall with refined interior details, natural depth, and uncluttered composition',
    tags: ['Indoor', 'Elegant']
  },
  {
    key: 'green-garden',
    title_en: 'Natural Green Garden',
    title_ku: 'باخچەیەکی سەوزی سروشتی',
    title_ar: 'حديقة خضراء طبيعية',
    prompt: 'in a natural green garden with soft foliage, realistic depth, and gentle environmental detail',
    tags: ['Garden', 'Nature']
  }
];

export const CONTENT_SCALE_VERSION = 'content-safety-v1';
export const ROTATION_COUNT = SUBJECTS.length * STYLES.length * SCENES.length;

export async function ensureContentScaleSchema(env) {
  const alterations = [
    'ALTER TABLE prompts ADD COLUMN content_fingerprint TEXT',
    "ALTER TABLE prompts ADD COLUMN content_origin TEXT DEFAULT 'manual'",
    'ALTER TABLE prompts ADD COLUMN quality_score INTEGER DEFAULT 0',
    'ALTER TABLE prompts ADD COLUMN rotation_key TEXT'
  ];

  for (const statement of alterations) {
    try { await env.DB.prepare(statement).run(); } catch {}
  }

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS content_scale_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      prompt_id INTEGER,
      candidate_slug TEXT,
      duplicate_of_id INTEGER,
      similarity REAL DEFAULT 0,
      quality_score INTEGER DEFAULT 0,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  try {
    await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_prompts_content_fingerprint ON prompts (content_fingerprint)').run();
    await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_prompts_rotation_key ON prompts (rotation_key)').run();
    await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_content_scale_events_type_created ON content_scale_events (event_type, created_at)').run();
  } catch {}
}

export async function analyzePromptCandidate(env, candidate, options = {}) {
  await ensureContentScaleSchema(env);
  const existing = await loadExistingPrompts(env, options.excludeId);
  return analyzeAgainstExisting(candidate, existing);
}

export async function preparePromptMetadata(env, candidate, options = {}) {
  const analysis = await analyzePromptCandidate(env, candidate, options);
  return {
    ...analysis,
    content_origin: cleanToken(options.origin || candidate.content_origin || 'manual') || 'manual',
    rotation_key: cleanToken(candidate.rotation_key || '') || null
  };
}

export async function getNextRotationCandidate(env, now = new Date()) {
  await ensureContentScaleSchema(env);
  const existing = await loadExistingPrompts(env);
  const dayNumber = Math.floor(now.getTime() / 86400000);

  for (let offset = 0; offset < ROTATION_COUNT; offset += 1) {
    const rotationIndex = (dayNumber + offset) % ROTATION_COUNT;
    const candidate = buildRotationCandidate(rotationIndex);
    const analysis = await analyzeAgainstExisting(candidate, existing);

    if (!analysis.duplicate && analysis.quality.score >= BOT_MIN_QUALITY) {
      return { ...candidate, analysis, rotation_index: rotationIndex, searched: offset + 1 };
    }
  }

  return null;
}

export async function getContentScaleStatus(env) {
  await ensureContentScaleSchema(env);
  const [originCounts, eventCounts, next] = await Promise.all([
    env.DB.prepare(`
      SELECT COALESCE(content_origin, 'legacy') AS origin, COUNT(*) AS count
      FROM prompts
      GROUP BY COALESCE(content_origin, 'legacy')
      ORDER BY count DESC
    `).all(),
    env.DB.prepare(`
      SELECT event_type, COUNT(*) AS count
      FROM content_scale_events
      GROUP BY event_type
    `).all(),
    getNextRotationCandidate(env)
  ]);

  const events = Object.fromEntries((eventCounts.results || []).map((row) => [row.event_type, Number(row.count || 0)]));

  return {
    ok: true,
    version: CONTENT_SCALE_VERSION,
    duplicate_threshold: DUPLICATE_THRESHOLD,
    bot_min_quality: BOT_MIN_QUALITY,
    rotation_count: ROTATION_COUNT,
    origins: originCounts.results || [],
    duplicates_blocked: events.duplicate_blocked || 0,
    bot_prompts_published: events.bot_published || 0,
    next_candidate: next ? publicCandidate(next) : null
  };
}

export async function scanExistingDuplicates(env) {
  await ensureContentScaleSchema(env);
  const result = await env.DB.prepare(`
    SELECT id, slug, title_ku, title_en, title_ar, prompt_text, content_fingerprint, published_at
    FROM prompts
    ORDER BY id DESC
    LIMIT ?
  `).bind(MAX_SCAN_PROMPTS).all();
  const prompts = result.results || [];
  const duplicates = [];

  for (let left = 0; left < prompts.length; left += 1) {
    for (let right = left + 1; right < prompts.length; right += 1) {
      const comparison = comparePromptContent(prompts[left], prompts[right]);
      if (comparison.similarity < DUPLICATE_THRESHOLD) continue;

      duplicates.push({
        prompt_id: prompts[left].id,
        prompt_slug: prompts[left].slug,
        prompt_title: displayTitle(prompts[left]),
        duplicate_id: prompts[right].id,
        duplicate_slug: prompts[right].slug,
        duplicate_title: displayTitle(prompts[right]),
        similarity: roundSimilarity(comparison.similarity),
        reason: comparison.reason
      });
    }
  }

  duplicates.sort((a, b) => b.similarity - a.similarity);
  await recordContentScaleEvent(env, 'library_scan', {
    details: JSON.stringify({ scanned: prompts.length, duplicate_pairs: duplicates.length })
  });

  return {
    ok: true,
    scanned: prompts.length,
    duplicate_pairs: duplicates.length,
    duplicates: duplicates.slice(0, 30)
  };
}

export async function recordContentScaleEvent(env, eventType, data = {}) {
  await ensureContentScaleSchema(env);
  await env.DB.prepare(`
    INSERT INTO content_scale_events (
      event_type,
      prompt_id,
      candidate_slug,
      duplicate_of_id,
      similarity,
      quality_score,
      details
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    cleanToken(eventType) || 'unknown',
    positiveInteger(data.prompt_id),
    cleanText(data.candidate_slug, 180) || null,
    positiveInteger(data.duplicate_of_id),
    Number(data.similarity || 0),
    Number(data.quality_score || 0),
    cleanText(data.details, 1000) || null
  ).run();
}

export function buildRotationCandidate(index) {
  const normalizedIndex = ((Number(index) % ROTATION_COUNT) + ROTATION_COUNT) % ROTATION_COUNT;
  const subject = SUBJECTS[normalizedIndex % SUBJECTS.length];
  const style = STYLES[Math.floor(normalizedIndex / SUBJECTS.length) % STYLES.length];
  const scene = SCENES[Math.floor(normalizedIndex / (SUBJECTS.length * STYLES.length)) % SCENES.length];
  const rotationKey = `${subject.key}-${style.key}-${scene.key}`;

  return {
    slug: `scale-${rotationKey}`,
    rotation_key: rotationKey,
    category: style.category,
    title_ku: `${subject.title_ku} ${style.title_ku} لە ${scene.title_ku}`,
    title_en: `${style.title_en} ${subject.title_en} at ${scene.title_en}`,
    title_ar: `${subject.title_ar} ${style.title_ar} في ${scene.title_ar}`,
    description_ku: `پرۆمپتێکی جیاواز بۆ ${subject.title_ku} ${style.title_ku} لە ${scene.title_ku}، بە ناسنامەی ڕاستەقینە و کوالێتی بەرز.`,
    description_en: `A distinct person-edit prompt for ${subject.title_en.toLowerCase()} in ${style.title_en.toLowerCase()} at ${scene.title_en}, with realistic identity preservation.`,
    description_ar: `موجه مميز لتعديل ${subject.title_ar} ${style.title_ar} في ${scene.title_ar} مع الحفاظ الواقعي على الهوية.`,
    prompt_text: `Create a photorealistic edit of ${subject.prompt}, ${scene.prompt}. Apply ${style.prompt}. ${subject.identity}. Use ${style.light}, physically believable shadows, accurate skin texture, natural hands, balanced composition, realistic lens perspective, clear subject separation, and detailed professional photography quality. Keep the result tasteful, coherent, and free from artificial facial distortion or duplicated body parts.`,
    negative_prompt: 'blurry face, changed identity, extra fingers, duplicated limbs, distorted body, plastic skin, mismatched lighting, incorrect shadows, text, watermark, low resolution',
    difficulty: subject.key.includes('group') || subject.key.includes('three') ? 'medium' : 'easy',
    rating: 4.9,
    is_featured: normalizedIndex % 7 === 0 ? 1 : 0,
    is_trending: 1,
    tags: [...new Set(['PersonEdit', ...subject.tags, ...style.tags, ...scene.tags])],
    content_origin: 'bot'
  };
}

export function scorePromptQuality(candidate) {
  const prompt = cleanText(candidate?.prompt_text, 3000);
  const lower = prompt.toLowerCase();
  const title = displayTitle(candidate);
  const tags = Array.isArray(candidate?.tags) ? candidate.tags.filter(Boolean) : [];
  const signals = [];
  const issues = [];
  let score = 0;

  if (title.length >= 8 && title.length <= 180) { score += 10; signals.push('clear title'); }
  else issues.push('Title should be specific and readable.');

  if (prompt.length >= 180 && prompt.length <= 1400) { score += 20; signals.push('useful prompt length'); }
  else if (prompt.length >= 100) { score += 12; issues.push('Prompt could include more production detail.'); }
  else issues.push('Prompt text is too short.');

  addSignal(/one person|two people|couple|friends|family|group|portrait|person/, 8, 'clear subject');
  addSignal(/light|lighting|golden.hour|neon|shadow|contrast/, 8, 'lighting direction');
  addSignal(/composition|perspective|lens|framing|depth|background/, 8, 'composition detail');
  addSignal(/realistic|photorealistic|believable|natural/, 8, 'realism requirement');
  addSignal(/identity|face|facial|preserve/, 8, 'identity preservation');
  addSignal(/skin|fabric|texture|hands|proportions/, 7, 'anatomy and texture detail');
  addSignal(/high quality|professional|detailed|sharp|resolution/, 7, 'output quality');

  const multilingualTitles = [candidate?.title_ku, candidate?.title_en, candidate?.title_ar].filter((value) => cleanText(value, 200)).length;
  if (multilingualTitles >= 2) { score += 8; signals.push('multilingual title'); }
  else issues.push('Add another title language for discovery.');

  if (tags.length >= 3) { score += 8; signals.push('search tags'); }
  else if (tags.length) score += 4;
  else issues.push('Add at least three relevant tags.');

  if (/lorem ipsum|test prompt|example prompt|todo|asdf|random prompt/.test(lower)) {
    score -= 30;
    issues.push('Placeholder or test wording detected.');
  }

  if (repetitionRatio(tokenize(prompt)) > 0.48) {
    score -= 12;
    issues.push('Prompt repeats too many of the same words.');
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    passed: score >= BOT_MIN_QUALITY,
    signals,
    issues
  };

  function addSignal(pattern, points, label) {
    if (pattern.test(lower)) {
      score += points;
      signals.push(label);
    } else {
      issues.push(`Missing ${label}.`);
    }
  }
}

export function comparePromptContent(left, right) {
  const leftPrompt = normalizeComparable(left?.prompt_text);
  const rightPrompt = normalizeComparable(right?.prompt_text);
  const leftTitle = normalizeComparable(displayTitle(left));
  const rightTitle = normalizeComparable(displayTitle(right));

  if (leftPrompt && rightPrompt && leftPrompt === rightPrompt) {
    return { similarity: 1, reason: 'same prompt text' };
  }
  if (leftTitle && rightTitle && leftTitle === rightTitle) {
    return { similarity: 0.97, reason: 'same title' };
  }
  if (left?.slug && right?.slug && cleanToken(left.slug) === cleanToken(right.slug)) {
    return { similarity: 1, reason: 'same slug' };
  }

  const promptSimilarity = jaccard(tokenize(leftPrompt), tokenize(rightPrompt));
  const titleSimilarity = jaccard(tokenize(leftTitle), tokenize(rightTitle));
  const similarity = promptSimilarity * 0.78 + titleSimilarity * 0.22;

  return {
    similarity,
    reason: similarity >= DUPLICATE_THRESHOLD ? 'near-duplicate wording' : 'different content'
  };
}

async function analyzeAgainstExisting(candidate, existing) {
  const fingerprint = await fingerprintPrompt(candidate);
  const quality = scorePromptQuality(candidate);
  let best = null;

  for (const prompt of existing) {
    if (prompt.content_fingerprint && prompt.content_fingerprint === fingerprint) {
      best = { prompt, similarity: 1, reason: 'same fingerprint' };
      break;
    }

    const comparison = comparePromptContent(candidate, prompt);
    if (!best || comparison.similarity > best.similarity) {
      best = { prompt, ...comparison };
    }
  }

  const duplicate = Boolean(best && best.similarity >= DUPLICATE_THRESHOLD);
  return {
    duplicate,
    fingerprint,
    similarity: duplicate ? roundSimilarity(best.similarity) : roundSimilarity(best?.similarity || 0),
    reason: duplicate ? best.reason : null,
    duplicate_of: duplicate ? {
      id: best.prompt.id,
      slug: best.prompt.slug,
      title: displayTitle(best.prompt)
    } : null,
    quality
  };
}

async function loadExistingPrompts(env, excludeId = null) {
  const query = excludeId
    ? `SELECT id, slug, title_ku, title_en, title_ar, prompt_text, content_fingerprint FROM prompts WHERE id != ? ORDER BY id DESC LIMIT ?`
    : `SELECT id, slug, title_ku, title_en, title_ar, prompt_text, content_fingerprint FROM prompts ORDER BY id DESC LIMIT ?`;
  const statement = excludeId
    ? env.DB.prepare(query).bind(excludeId, MAX_SCAN_PROMPTS)
    : env.DB.prepare(query).bind(MAX_SCAN_PROMPTS);
  const result = await statement.all();
  return result.results || [];
}

async function fingerprintPrompt(candidate) {
  const material = [
    normalizeComparable(displayTitle(candidate)),
    normalizeComparable(candidate?.prompt_text),
    cleanToken(candidate?.category || candidate?.category_slug || '')
  ].join('|');
  const bytes = new TextEncoder().encode(material);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function publicCandidate(candidate) {
  return {
    slug: candidate.slug,
    rotation_key: candidate.rotation_key,
    category: candidate.category,
    title_ku: candidate.title_ku,
    title_en: candidate.title_en,
    title_ar: candidate.title_ar,
    quality_score: candidate.analysis?.quality?.score || scorePromptQuality(candidate).score,
    quality_issues: candidate.analysis?.quality?.issues || [],
    searched: candidate.searched || 1,
    tags: candidate.tags
  };
}

function displayTitle(value) {
  return cleanText(value?.title_en || value?.title_ku || value?.title_ar || value?.title || '', 240);
}

function normalizeComparable(value) {
  return cleanText(value, 4000)
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value) {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'with', 'to', 'for', 'from',
    'one', 'two', 'photo', 'image', 'edit', 'create', 'style', 'quality', 'high',
    'realistic', 'natural', 'person', 'people', 'into', 'keep', 'use'
  ]);
  return normalizeComparable(value)
    .split(' ')
    .filter((token) => token.length > 2 && !stopWords.has(token));
}

function jaccard(leftTokens, rightTokens) {
  const left = new Set(leftTokens);
  const right = new Set(rightTokens);
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

function repetitionRatio(tokens) {
  if (!tokens.length) return 0;
  return 1 - new Set(tokens).size / tokens.length;
}

function roundSimilarity(value) {
  return Math.round(Number(value || 0) * 1000) / 1000;
}

function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function cleanText(value, maximumLength = 500) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maximumLength);
}

function cleanToken(value) {
  return cleanText(value, 180)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
