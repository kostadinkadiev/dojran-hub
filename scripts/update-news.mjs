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

const normalize = (text = '') => text.replace(/\s+/g, ' ').trim();

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
      return {
        title,
        url: link,
        date: pubDate ? new Date(pubDate).toISOString() : null,
        source: source.name
      };
    })
    .filter((item) => item.title && item.url);
};

const parseTimeMk = async (source) => {
  const html = await fetchText(source.url);
  const $ = load(html);
  const items = [];
  $('a[href^="http"]').each((_, el) => {
    const href = $(el).attr('href');
    const title = normalize($(el).text());
    if (!title) return;
    if (!/dojran|дојран/i.test(title)) return;
    items.push({
      title,
      url: href,
      date: null,
      source: source.name
    });
  });
  return uniqBy(items, (item) => item.url).slice(0, 20);
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

  const cleaned = uniqBy(all, (item) => item.url)
    .sort((a, b) => {
      const ad = a.date ? new Date(a.date).getTime() : 0;
      const bd = b.date ? new Date(b.date).getTime() : 0;
      return bd - ad;
    })
    .slice(0, 50);

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(
    outPath,
    JSON.stringify({
      lastUpdated: new Date().toISOString(),
      items: cleaned
    }, null, 2)
  );
};

await collect();
console.log('News updated.');
