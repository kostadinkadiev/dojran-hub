import { load } from 'cheerio';
import { XMLParser } from 'fast-xml-parser';
import fs from 'fs/promises';
import path from 'path';

const ROOT = path.resolve(process.cwd());
const SOURCES_PATH = path.join(ROOT, 'scripts', 'sources.json');
const outPath = path.join(ROOT, 'site', 'data', 'news.json');

const sources = JSON.parse(await fs.readFile(SOURCES_PATH, 'utf-8'));

const uniqBy = (items, keyFn) => {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const slug = (text = '') => normalize(text)
  .toLowerCase()
  .replace(/[^a-z0-9\u0400-\u04FF]+/g, ' ')
  .trim();

const stopwords = new Set([
  'the','and','for','with','from','that','this','are','was','were','has','have','had','not','its','but','about','into','over','after','before','more','less','new','old',
  'на','во','за','со','од','тоа','овој','ова','тие','има','нема','и','но','кај','над','под','после','пред','повеќе','нов','стара','стар','се'
]);

const tokens = (text = '') => slug(text)
  .split(' ')
  .filter(Boolean)
  .filter((t) => !stopwords.has(t));

const similarity = (a, b) => {
  const setA = new Set(tokens(a));
  const setB = new Set(tokens(b));
  if (!setA.size || !setB.size) return 0;
  let inter = 0;
  for (const t of setA) if (setB.has(t)) inter++;
  const union = setA.size + setB.size - inter;
  return inter / union;
};

const normalize = (text = '') => text.replace(/\s+/g, ' ').trim();
const stripHtml = (html = '') => normalize(html.replace(/<[^>]*>/g, ' '));
const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const fetchText = async (url) => {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'dojran-hub-bot/0.1 (+https://github.com/kostadinkadiev/dojran-hub)'
    }
  });
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${url}`);
  return res.text();
};

const parseRss = async (source) => {
  const xml = await fetchText(source.url);
  const parser = new XMLParser({ ignoreAttributes: false });
  const data = parser.parse(xml);

  const channel = data?.rss?.channel ?? data?.feed;
  const items = channel?.item || channel?.entry || [];

  const list = Array.isArray(items) ? items : [items];
  return list
    .map((item) => {
      const title = normalize(item.title?.['#text'] ?? item.title);
      const link = item.link?.['@_href'] ?? item.link;
      const pubDate = item.pubDate ?? item.updated ?? item.published;
      const summary = stripHtml(item.description ?? item.summary ?? item['content:encoded'] ?? '');
      return {
        title,
        url: link,
        date: pubDate ? new Date(pubDate).toISOString() : null,
        summary,
        source: source.name
      };
    })
    .filter((item) => item.title && item.url);
};

const parseTimeMk = async (source) => {
  const html = await fetchText(source.url);
  const $ = load(html);
  const links = [];
  $('a[href^="http"]').each((_, el) => {
    const href = $(el).attr('href');
    const title = normalize($(el).text());
    if (!title) return;
    if (!/dojran|дојран/i.test(title)) return;
    links.push({ title, url: href });
  });

  const unique = uniqBy(links, (item) => item.url).slice(0, 12);
  const results = [];

  for (const item of unique) {
    try {
      const pageHtml = await fetchText(item.url);
      const $$ = load(pageHtml);
      const summary = normalize(
        $$('meta[name="description"]').attr('content') ||
        $$('meta[property="og:description"]').attr('content') ||
        ''
      );
      const dateVal =
        $$('meta[property="article:published_time"]').attr('content') ||
        $$('meta[name="date"]').attr('content') ||
        $$('time[datetime]').attr('datetime');
      const date = parseDate(dateVal);

      if (!date) continue;

      results.push({
        title: item.title,
        url: item.url,
        date: date.toISOString(),
        summary,
        source: source.name
      });
    } catch {
      continue;
    }
  }

  return results;
};

const parseHtml = async (source) => {
  if (source.id === 'time-mk') return parseTimeMk(source);
  return [];
};

const collect = async () => {
  const all = [];
  for (const source of sources.news) {
    try {
      const items = source.type === 'rss'
        ? await parseRss(source)
        : await parseHtml(source);
      all.push(...items);
    } catch (err) {
      all.push({
        title: `Грешка при вчитување: ${source.name}`,
        url: source.url,
        date: null,
        source: source.name,
        error: err.message
      });
    }
  }

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const cleaned = uniqBy(all, (item) => item.url)
    .filter((item) => item.date)
    .filter((item) => new Date(item.date) >= weekAgo)
    .map((item) => ({
      ...item,
      summary: item.summary ? item.summary.split('. ').slice(0, 2).join('. ') + (item.summary.includes('.') ? '.' : '') : ''
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const topicRules = [
    { key: 'birds', re: /птиц|галеб|корморан|лиски/i },
    { key: 'pump', re: /пумп|колектор/i }
  ];

  const deduped = [];
  for (const item of cleaned) {
    const match = deduped.find((existing) => {
      const titleSim = similarity(existing.title, item.title);
      const summarySim = existing.summary && item.summary ? similarity(existing.summary, item.summary) : 0;
      return titleSim >= 0.6 || summarySim >= 0.6;
    });
    if (match) continue;

    const topic = topicRules.find((rule) => rule.re.test(item.title) || rule.re.test(item.summary || ''));
    if (topic) {
      const hasTopic = deduped.find((existing) => {
        const sameTopic = topic.re.test(existing.title) || topic.re.test(existing.summary || '');
        if (!sameTopic) return false;
        const dateGap = Math.abs(new Date(existing.date).getTime() - new Date(item.date).getTime());
        return dateGap <= 3 * 24 * 60 * 60 * 1000;
      });
      if (hasTopic) continue;
    }

    deduped.push(item);
  }

  const finalItems = deduped.slice(0, 50);

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(
    outPath,
    JSON.stringify({
      lastUpdated: new Date().toISOString(),
      items: finalItems
    }, null, 2)
  );
};

await collect();
console.log('News updated.');
