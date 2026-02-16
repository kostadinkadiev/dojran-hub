const include = async () => {
  const targets = document.querySelectorAll('[data-include="nav"]');
  if (!targets.length) return;
  const res = await fetch('/dojran-hub/nav.html');
  if (!res.ok) return;
  const html = await res.text();
  targets.forEach((el) => { el.innerHTML = html; });
};

include();
