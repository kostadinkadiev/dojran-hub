const newsContainer = document.querySelector('#news-list');
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
      return;
    }

    newsContainer.innerHTML = items.map((item) => {
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
    }).join('');
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
