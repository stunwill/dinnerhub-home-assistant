const api = async (path, options = {}) => {
  const response = await fetch(`api/shopping${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(body.detail || 'Request failed');
  }
  return response.status === 204 ? null : response.json();
};

const styles = document.createElement('style');
styles.textContent = `
  .shopping-panel { display: none; }
  .shopping-panel.active { display: block; }
  .shopping-toolbar { display:flex; gap:10px; flex-wrap:wrap; align-items:center; justify-content:space-between; margin:32px 0 18px; }
  .shopping-actions { display:flex; gap:10px; flex-wrap:wrap; }
  .shopping-summary { color:var(--muted); font-weight:700; }
  .shopping-add { display:grid; grid-template-columns:minmax(180px,2fr) 100px 100px minmax(130px,1fr) auto; gap:10px; margin-bottom:18px; }
  .shopping-add input, .shopping-add select { width:100%; border:1px solid var(--line); border-radius:11px; padding:11px 12px; background:var(--card); color:inherit; }
  .shopping-groups { display:grid; gap:18px; }
  .shopping-group { background:var(--card); border:1px solid var(--line); border-radius:18px; overflow:hidden; }
  .shopping-group h3 { margin:0; padding:14px 18px; background:var(--accent); color:var(--green-dark); }
  .shopping-item { display:grid; grid-template-columns:auto minmax(180px,1fr) auto auto; gap:12px; align-items:center; padding:13px 16px; border-top:1px solid var(--line); }
  .shopping-item:first-of-type { border-top:0; }
  .shopping-item.checked .shopping-name { text-decoration:line-through; opacity:.55; }
  .shopping-item input[type=checkbox] { width:22px; height:22px; accent-color:var(--green); }
  .shopping-name strong { display:block; }
  .shopping-name small { color:var(--muted); }
  .shopping-qty { color:var(--green-dark); font-weight:800; white-space:nowrap; }
  .shopping-delete { border:0; background:transparent; color:#a33; font-size:1.15rem; }
  .shopping-empty { padding:54px 20px; text-align:center; border:1px dashed var(--line); border-radius:18px; color:var(--muted); }
  @media(max-width:760px) {
    .shopping-add { grid-template-columns:1fr 1fr; }
    .shopping-add .shopping-name-input, .shopping-add button { grid-column:1/-1; }
    .shopping-item { grid-template-columns:auto 1fr auto; }
    .shopping-delete { grid-column:3; }
  }
`;
document.head.appendChild(styles);

let shoppingPanel;
let originalMain;
let shoppingButton;
let generationDays = 7;

const quantityText = (item) => {
  if (item.quantity === null || item.quantity === undefined) return item.unit || '';
  const value = Number(item.quantity).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
  return `${value}${item.unit ? ` ${item.unit}` : ''}`;
};

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

async function renderShopping() {
  try {
    const [items, summary] = await Promise.all([api(''), api('/summary')]);
    const groups = items.reduce((result, item) => {
      const category = item.shopping_category || 'Other';
      (result[category] ||= []).push(item);
      return result;
    }, {});
    const groupHtml = Object.entries(groups).map(([category, categoryItems]) => `
      <section class="shopping-group">
        <h3>${escapeHtml(category)} (${categoryItems.length})</h3>
        ${categoryItems.map((item) => `
          <article class="shopping-item ${item.checked ? 'checked' : ''}" data-id="${item.id}">
            <input class="shopping-check" type="checkbox" ${item.checked ? 'checked' : ''} aria-label="Mark ${escapeHtml(item.name)} purchased">
            <div class="shopping-name">
              <strong>${escapeHtml(item.name)}</strong>
              <small>${item.source === 'manual' ? 'Manually added' : escapeHtml((item.meal_names || []).join(', '))}</small>
            </div>
            <span class="shopping-qty">${escapeHtml(quantityText(item))}</span>
            <button class="shopping-delete" type="button" aria-label="Remove ${escapeHtml(item.name)}">×</button>
          </article>
        `).join('')}
      </section>
    `).join('');

    shoppingPanel.innerHTML = `
      <section class="shopping-toolbar">
        <div>
          <span class="eyebrow">Persistent household list</span>
          <h2>Shopping list</h2>
          <div class="shopping-summary">${summary.unchecked} remaining, ${summary.checked} purchased, ${summary.manual} manual</div>
        </div>
        <div class="shopping-actions">
          <div class="segmented">
            <button type="button" data-days="7" class="${generationDays === 7 ? 'active' : ''}">7 days</button>
            <button type="button" data-days="14" class="${generationDays === 14 ? 'active' : ''}">14 days</button>
          </div>
          <button type="button" class="secondary" id="shopping-generate">Build from meal plan</button>
          <button type="button" class="secondary" id="shopping-clear-checked">Clear purchased</button>
        </div>
      </section>
      <form class="shopping-add" id="shopping-add-form">
        <input class="shopping-name-input" name="name" required maxlength="180" placeholder="Add milk, bread, cleaning products...">
        <input name="quantity" type="number" min="0" step="any" placeholder="Qty">
        <input name="unit" maxlength="40" placeholder="Unit">
        <select name="shopping_category">
          <option>Produce</option><option>Meat</option><option>Dairy</option><option>Bakery</option>
          <option>Pantry</option><option>Frozen</option><option>Household</option><option selected>Other</option>
        </select>
        <button class="primary" type="submit">Add item</button>
      </form>
      <div class="shopping-groups">${groupHtml || '<div class="shopping-empty"><h3>Your list is empty</h3><p>Build it from the meal plan or add an item manually.</p></div>'}</div>
    `;

    shoppingPanel.querySelectorAll('[data-days]').forEach((button) => button.addEventListener('click', () => {
      generationDays = Number(button.dataset.days);
      renderShopping();
    }));
    shoppingPanel.querySelector('#shopping-generate').addEventListener('click', async () => {
      await api(`/generate?days=${generationDays}&preserve_manual=true`, { method: 'POST' });
      renderShopping();
    });
    shoppingPanel.querySelector('#shopping-clear-checked').addEventListener('click', async () => {
      await api('/clear-checked', { method: 'POST' });
      renderShopping();
    });
    shoppingPanel.querySelector('#shopping-add-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      await api('', {
        method: 'POST',
        body: JSON.stringify({
          name: form.get('name'),
          quantity: form.get('quantity') ? Number(form.get('quantity')) : null,
          unit: form.get('unit') || null,
          shopping_category: form.get('shopping_category') || 'Other'
        })
      });
      renderShopping();
    });
    shoppingPanel.querySelectorAll('.shopping-item').forEach((row) => {
      const id = Number(row.dataset.id);
      row.querySelector('.shopping-check').addEventListener('change', async (event) => {
        await api(`/${id}`, { method: 'PATCH', body: JSON.stringify({ checked: event.target.checked }) });
        renderShopping();
      });
      row.querySelector('.shopping-delete').addEventListener('click', async () => {
        await api(`/${id}`, { method: 'DELETE' });
        renderShopping();
      });
    });
  } catch (error) {
    shoppingPanel.innerHTML = `<div class="notice error">${escapeHtml(error.message || 'Shopping list could not load')}</div>`;
  }
}

function activateShopping() {
  document.querySelectorAll('.tabs button').forEach((button) => button.classList.remove('active'));
  shoppingButton.classList.add('active');
  originalMain.style.display = 'none';
  shoppingPanel.classList.add('active');
  renderShopping();
}

function installShoppingTab() {
  const tabs = document.querySelector('.tabs');
  originalMain = document.querySelector('.app-shell > main');
  if (!tabs || !originalMain || document.querySelector('#dinnerhub-shopping-tab')) return false;
  shoppingButton = document.createElement('button');
  shoppingButton.id = 'dinnerhub-shopping-tab';
  shoppingButton.type = 'button';
  shoppingButton.textContent = 'Shopping';
  shoppingButton.addEventListener('click', activateShopping);
  tabs.appendChild(shoppingButton);

  shoppingPanel = document.createElement('main');
  shoppingPanel.className = 'shopping-panel';
  originalMain.insertAdjacentElement('afterend', shoppingPanel);

  tabs.querySelectorAll('button:not(#dinnerhub-shopping-tab)').forEach((button) => button.addEventListener('click', () => {
    shoppingPanel.classList.remove('active');
    originalMain.style.display = '';
    shoppingButton.classList.remove('active');
  }));
  return true;
}

if (!installShoppingTab()) {
  const observer = new MutationObserver(() => {
    if (installShoppingTab()) observer.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
