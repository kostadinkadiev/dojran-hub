const newsContainer = document.querySelector('#news-list');
// removed featured section
const updatedEl = document.querySelector('#news-updated');
const sourcesList = document.querySelector('#sources-list');

const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
};

const loadNews = async () => {
  try {
    const res = await fetch('./data/news.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('Неуспешно вчитување на новости.');
    const data = await res.json();
    updatedEl.textContent = `Updated: ${fmtDate(data.lastUpdated)}`;

    const items = data.items || [];
    if (!items.length) {
      newsContainer.innerHTML = '<p class="muted">No news at the moment.</p>';
      return;
    }

    const renderCard = (item) => {
      const date = item.date ? `<span class="date">${fmtDate(item.date)}</span>` : '';
      const summary = item.summary ? `<p class="summary">${item.summary}</p>` : '';
      return `
        <article class="card">
          <a href="${item.url}" target="_blank" rel="noopener noreferrer">
            <h3>${item.title}</h3>
          </a>
          <div class="meta">
            <span>${item.source}</span>
            ${date}
          </div>
          ${summary}
        </article>
      `;
    };

    newsContainer.innerHTML = items.map(renderCard).join('');
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
        <h4>News sources</h4>
        <ul>${render(data.news)}</ul>
      </div>
      <div>
        <h4>Other sources</h4>
        <ul>${render(data.other)}</ul>
      </div>
    `;
  } catch (err) {
    sourcesList.innerHTML = '<p class="muted">Failed to load sources.</p>';
  }
};

loadNews();
loadSources();
