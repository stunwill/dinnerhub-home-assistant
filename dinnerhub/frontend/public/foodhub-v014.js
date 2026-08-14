const fh14Api = async (path, options = {}) => {
  const response = await fetch(`api/${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.detail === 'string' ? body.detail : 'Request failed');
  return body;
};

const fh14Esc = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

const fh14Brand = () => {
  document.title = 'FoodHub by Stu';
  document.querySelectorAll('h1').forEach((heading) => {
    if ((heading.textContent || '').trim() === 'DinnerHub') heading.textContent = 'FoodHub';
  });
  document.querySelectorAll('nav[aria-label="DinnerHub navigation"]').forEach((nav) => {
    nav.setAttribute('aria-label', 'FoodHub navigation');
  });
  document.querySelectorAll('.dh-inline-logo').forEach((logo) => {
    const title = logo.querySelector('title');
    const desc = logo.querySelector('desc');
    if (title) title.textContent = 'FoodHub by Stu';
    if (desc) desc.textContent = 'FoodHub wordmark with a green fork and knife emblem.';
    logo.querySelectorAll('text').forEach((text) => {
      if ((text.textContent || '').trim() === 'DinnerHub') text.textContent = 'FoodHub';
    });
  });
};

const fh14Metric = (key, label, unit, value) => `
  <label>${label}
    <div class="fh14-input-unit"><input type="number" min="0" step="any" name="${key}" value="${value ?? ''}" placeholder="Not entered"><span>${unit}</span></div>
  </label>`;

const fh14RenderSummary = (panel, payload) => {
  const nutrition = payload?.nutrition || {};
  const values = nutrition.values || {};
  const summary = panel.querySelector('.fh14-summary');
  if (!summary) return;
  if (!nutrition.available) {
    summary.innerHTML = '<p class="muted">Nutrition has not been entered for this recipe yet. Missing values remain unknown, not zero.</p>';
    return;
  }
  const chips = [
    ['Calories', values.calories_kcal, 'kcal'],
    ['Protein', values.protein_g, 'g'],
    ['Carbs', values.carbohydrate_g, 'g'],
    ['Fat', values.fat_g, 'g'],
    ['Sugar', values.sugar_g, 'g'],
    ['Fibre', values.fibre_g, 'g'],
  ].filter(([, value]) => value !== null && value !== undefined);
  summary.innerHTML = `
    <div class="fh14-nutrition-chips">${chips.map(([label, value, unit]) => `<span><strong>${fh14Esc(value)}</strong> ${fh14Esc(unit)}<small>${fh14Esc(label)}</small></span>`).join('')}</div>
    <small>Per serving · ${fh14Esc(nutrition.completeness || 'partial')} · ${nutrition.authoritative ? 'authoritative' : 'reference'}${nutrition.source ? ` · ${fh14Esc(nutrition.source)}` : ''}</small>`;
};

const fh14InstallNutrition = async () => {
  const modal = document.querySelector('.recipe-detail-modal');
  if (!modal || modal.querySelector('.fh14-nutrition')) return;
  const title = modal.querySelector('.modal-heading h2')?.textContent?.trim();
  if (!title) return;

  const panel = document.createElement('section');
  panel.className = 'recipe-section fh14-nutrition';
  panel.innerHTML = `
    <div class="fh14-heading"><div><h3>Nutrition</h3><small>Per serving, used by HealthHub when available.</small></div><button type="button" class="secondary fh14-edit">Edit nutrition</button></div>
    <div class="fh14-summary"><p class="muted">Loading nutrition…</p></div>
    <form class="fh14-form" hidden>
      <div class="fh14-grid"></div>
      <div class="fh14-source-row">
        <label>Source<select name="source"><option value="manual">Manual</option><option value="label">Nutrition label</option><option value="ai">AI estimate</option><option value="calculated">Calculated</option><option value="imported">Imported</option></select></label>
        <label class="fh14-check"><input type="checkbox" name="authoritative"> Treat as authoritative nutrition</label>
      </div>
      <p class="fh14-help">Only mark nutrition authoritative when you trust the source. HealthHub will receive missing nutrients as null rather than zero.</p>
      <div class="fh14-actions"><button type="button" class="secondary fh14-cancel">Cancel</button><button type="submit" class="primary">Save nutrition</button></div>
      <div class="fh14-status"></div>
    </form>`;

  const actions = modal.querySelector('.modal-actions');
  if (actions) actions.insertAdjacentElement('beforebegin', panel);
  else modal.appendChild(panel);

  let meal;
  try {
    const meals = await fh14Api('meals');
    meal = meals.find((item) => item.name === title);
    if (!meal) throw new Error('Recipe could not be resolved.');
    panel.dataset.mealId = String(meal.id);
    const payload = await fh14Api(`v1/recipes/${meal.id}/nutrition`);
    panel._fh14Payload = payload;
    fh14RenderSummary(panel, payload);
  } catch (error) {
    panel.querySelector('.fh14-summary').innerHTML = `<p class="muted">${fh14Esc(error.message)}</p>`;
    return;
  }

  const openEditor = () => {
    const values = panel._fh14Payload?.nutrition?.values || {};
    const nutrition = panel._fh14Payload?.nutrition || {};
    panel.querySelector('.fh14-grid').innerHTML = [
      fh14Metric('calories_kcal', 'Calories', 'kcal', values.calories_kcal),
      fh14Metric('protein_g', 'Protein', 'g', values.protein_g),
      fh14Metric('carbohydrate_g', 'Carbohydrate', 'g', values.carbohydrate_g),
      fh14Metric('fat_g', 'Fat', 'g', values.fat_g),
      fh14Metric('saturated_fat_g', 'Saturated fat', 'g', values.saturated_fat_g),
      fh14Metric('sugar_g', 'Sugar', 'g', values.sugar_g),
      fh14Metric('fibre_g', 'Fibre', 'g', values.fibre_g),
      fh14Metric('sodium_mg', 'Sodium', 'mg', values.sodium_mg),
    ].join('');
    panel.querySelector('[name="source"]').value = nutrition.source || 'manual';
    panel.querySelector('[name="authoritative"]').checked = Boolean(nutrition.authoritative);
    panel.querySelector('.fh14-form').hidden = false;
    panel.querySelector('.fh14-edit').hidden = true;
  };

  panel.querySelector('.fh14-edit').onclick = openEditor;
  panel.querySelector('.fh14-cancel').onclick = () => {
    panel.querySelector('.fh14-form').hidden = true;
    panel.querySelector('.fh14-edit').hidden = false;
  };
  panel.querySelector('.fh14-form').onsubmit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {};
    ['calories_kcal', 'protein_g', 'carbohydrate_g', 'fat_g', 'saturated_fat_g', 'sugar_g', 'fibre_g', 'sodium_mg'].forEach((key) => {
      const raw = String(form.get(key) || '').trim();
      payload[key] = raw === '' ? null : Number(raw);
    });
    payload.source = String(form.get('source') || 'manual');
    payload.authoritative = Boolean(form.get('authoritative'));
    const status = panel.querySelector('.fh14-status');
    try {
      status.textContent = 'Saving…';
      const result = await fh14Api(`v1/recipes/${meal.id}/nutrition`, { method: 'PUT', body: JSON.stringify(payload) });
      panel._fh14Payload = result;
      fh14RenderSummary(panel, result);
      panel.querySelector('.fh14-form').hidden = true;
      panel.querySelector('.fh14-edit').hidden = false;
      status.textContent = 'Nutrition saved.';
    } catch (error) {
      status.textContent = error.message;
    }
  };
};

let fh14Queued = false;
const fh14Install = () => {
  if (fh14Queued) return;
  fh14Queued = true;
  requestAnimationFrame(async () => {
    try {
      fh14Brand();
      await fh14InstallNutrition();
    } finally {
      fh14Queued = false;
    }
  });
};

fh14Install();
new MutationObserver(fh14Install).observe(document.body, { childList: true, subtree: true });
