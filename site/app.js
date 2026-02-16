const newsContainer = document.querySelector('#news-list');
const featuredContainer = document.querySelector('#news-featured');
const updatedEl = document.querySelector('#news-updated');
const sourcesList = document.querySelector('#sources-list');

const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('mk-MK', { year: 'numeric', month: 'short', day: 'numeric' });
};

const loadNews = async () => {
  try {
    const res = await fetch('./data/news.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('Неуспешно вчитување на новости.');
    const data = await res.json();
    updatedEl.textContent = `Освежено: ${fmtDate(data.lastUpdated)}`;

    const items = data.items || [];
    if (!items.length) {
      newsContainer.innerHTML = '<p class="muted">Нема новости во моментов.</p>';
      featuredContainer.innerHTML = '';
      return;
    }

    const score = (item) => {
      const title = item.title.toLowerCase();
      let s = 0;
      if (title.includes('дојран')) s += 3;
      if (title.includes('езеро')) s += 2;
      if (title.includes('тур')) s += 1;
      if (item.source.toLowerCase().includes('општина')) s += 2;
      return s;
    };

    const sorted = [...items].sort((a, b) => score(b) - score(a));
    const featured = sorted.slice(0, 6);
    const rest = items.filter((item) => !featured.some((f) => f.url === item.url));

    const renderCard = (item) => {
      const date = item.date ? `<span class="date">${fmtDate(item.date)}</span>` : '';
      return `
        <article class="card">
          <a href="${item.url}" target="_blank" rel="noopener noreferrer">
            <h3>${item.title}</h3>
          </a>
          <div class="meta">
            <span>${item.source}</span>
            ${date}
          </div>
        </article>
      `;
    };

    featuredContainer.innerHTML = featured.map(renderCard).join('') || '<p class="muted">Нема избрани вести.</p>';
    newsContainer.innerHTML = rest.map(renderCard).join('') || '<p class="muted">Нема други вести.</p>';
  } catch (err) {
    newsContainer.innerHTML = `<p class="muted">${err.message}</p>`;
  }
};

const loadSources = async () => {
  try {
    const res = await fetch('./data/sources.json');
    const data = await res.json();

    const render = (list) => list.map((item) => `
      <li>
        <a href="${item.url}" target="_blank" rel="noopener noreferrer">${item.name}</a>
      </li>
    `).join('');

    sourcesList.innerHTML = `
      <div>
        <h4>Извори за вести</h4>
        <ul>${render(data.news)}</ul>
      </div>
      <div>
        <h4>Други извори</h4>
        <ul>${render(data.other)}</ul>
      </div>
    `;
  } catch (err) {
    sourcesList.innerHTML = '<p class="muted">Неуспешно вчитување на извори.</p>';
  }
};

loadNews();
loadSources();
