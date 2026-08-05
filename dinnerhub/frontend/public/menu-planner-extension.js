const state = {
  meals: [],
  settings: null,
  activeFilters: [],
  observer: null,
  applying: false
};

const api = async (path, options = {}) => {
  const response = await fetch(`api/${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(typeof body.detail === 'string' ? body.detail : 'Request failed');
  }
  return response.status === 204 ? undefined : response.json();
};

const mealPayload = (meal, favourite) => ({
  name: meal.name,
  description: meal.description,
  main_protein: null,
  category: meal.category,
  cuisine: meal.cuisine,
  prep_minutes: meal.prep_minutes,
  cook_minutes: meal.cook_minutes,
  servings: meal.servings,
  difficulty: meal.difficulty,
  instructions: meal.instructions || [],
  dietary_tags: meal.dietary_tags || [],
  allergens: meal.allergens || [],
  substitutions: meal.substitutions || [],
  notes: meal.notes,
  image_url: meal.image_url,
  source_url: meal.source_url,
  favourite,
  household_rating: meal.household_rating,
  ingredients: meal.ingredients || [],
  active: meal.active !== false
});

const cleanMealName = (value) => value.replace(/^★\s*/, '').trim();

const refreshData = async () => {
  const [meals, settings] = await Promise.all([
    api('meals'),
    api('filter-settings')
  ]);
  state.meals = meals;
  state.settings = settings;
};

const findMealForCard = (card) => {
  const heading = card.querySelector('h3');
  if (!heading) return null;
  const name = cleanMealName(heading.textContent || '');
  return state.meals.find((meal) => meal.name === name) || null;
};

const matchesFilter = (meal, filterId) => {
  if (filterId === 'favourites') return Boolean(meal.favourite);
  const filter = state.settings?.filters?.find((item, index) => `${index}:${item.kind}:${item.value}` === filterId);
  if (!filter) return true;
  const needle = filter.value.toLowerCase();
  if (filter.kind === 'ingredient') {
    return (meal.ingredients || []).some((item) => item.name.toLowerCase().includes(needle));
  }
  if (filter.kind === 'category') {
    return (meal.category || '').toLowerCase().includes(needle);
  }
  return (meal.cuisine || '').toLowerCase().includes(needle);
};

const applyCardState = () => {
  if (state.applying || !state.settings) return;
  const grid = document.querySelector('.meal-grid');
  if (!grid) return;
  state.applying = true;
  try {
    const cards = Array.from(grid.querySelectorAll('.meal-card'));
    const records = cards.map((card) => ({ card, meal: findMealForCard(card) })).filter((item) => item.meal);

    for (const { card, meal } of records) {
      card.dataset.mealId = String(meal.id);
      card.classList.toggle('is-favourite', Boolean(meal.favourite));
      const visible = state.activeFilters.every((filterId) => matchesFilter(meal, filterId));
      card.classList.toggle('planner-filter-hidden', !visible);

      let heart = card.querySelector('.planner-heart-button');
      if (!heart) {
        heart = document.createElement('button');
        heart.type = 'button';
        heart.className = 'planner-heart-button';
        card.appendChild(heart);
      }
      heart.textContent = meal.favourite ? '♥' : '♡';
      heart.setAttribute('aria-label', meal.favourite ? `Remove ${meal.name} from favourites` : `Add ${meal.name} to favourites`);
      heart.title = meal.favourite ? 'Remove from favourites' : 'Add to favourites';
      heart.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();
        heart.disabled = true;
        try {
          const updated = await api(`meals/${meal.id}`, {
            method: 'PUT',
            body: JSON.stringify(mealPayload(meal, !meal.favourite))
          });
          const index = state.meals.findIndex((item) => item.id === meal.id);
          if (index >= 0) state.meals[index] = updated;
          enhance();
        } catch (error) {
          window.alert(error instanceof Error ? error.message : 'Favourite could not be updated');
        } finally {
          heart.disabled = false;
        }
      };
    }

    if (state.settings.favourites_first) {
      const sorted = [...records].sort(
        (a, b) => Number(Boolean(b.meal.favourite)) - Number(Boolean(a.meal.favourite)) || a.meal.name.localeCompare(b.meal.name)
      );
      const currentOrder = records.map(({ card }) => card.dataset.mealId).join(',');
      const sortedOrder = sorted.map(({ card }) => card.dataset.mealId).join(',');
      if (currentOrder !== sortedOrder) {
        sorted.forEach(({ card }) => grid.appendChild(card));
      }
    }
  } finally {
    state.applying = false;
  }
};

const toggleFilter = (filterId) => {
  const maximum = state.settings?.maximum_active_filters || 2;
  if (state.activeFilters.includes(filterId)) {
    state.activeFilters = state.activeFilters.filter((item) => item !== filterId);
  } else if (state.activeFilters.length < maximum) {
    state.activeFilters = [...state.activeFilters, filterId];
  } else {
    state.activeFilters = [...state.activeFilters.slice(1), filterId];
  }
  enhance();
};

const createFilterButton = (label, filterId, extraClass = '') => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `planner-filter-chip ${extraClass}`.trim();
  button.textContent = label;
  button.classList.toggle('active', state.activeFilters.includes(filterId));
  button.onclick = () => toggleFilter(filterId);
  return button;
};

const renderFilterBar = () => {
  const grid = document.querySelector('.meal-grid');
  const search = document.querySelector('.search');
  if (!grid || !search || !state.settings) return;

  let panel = document.querySelector('.planner-filter-panel');
  if (!panel) {
    panel = document.createElement('section');
    panel.className = 'planner-filter-panel';
    search.insertAdjacentElement('afterend', panel);
  }
  panel.replaceChildren();

  const heading = document.createElement('div');
  heading.className = 'planner-filter-heading';
  heading.innerHTML = `<div><span>QUICK FILTERS</span><strong>Find a meal</strong><small>Select up to ${state.settings.maximum_active_filters || 2} filters</small></div>`;
  const configure = document.createElement('button');
  configure.type = 'button';
  configure.className = 'planner-configure-button';
  configure.textContent = 'Configure filters';
  configure.onclick = openConfiguration;
  heading.appendChild(configure);
  panel.appendChild(heading);

  const chips = document.createElement('div');
  chips.className = 'planner-filter-chips';
  const allButton = createFilterButton('All recipes', 'all', 'all-filter');
  allButton.onclick = () => {
    state.activeFilters = [];
    enhance();
  };
  allButton.classList.toggle('active', state.activeFilters.length === 0);
  chips.appendChild(allButton);

  if (state.settings.show_favourites_filter) {
    chips.appendChild(createFilterButton('♥ Favourites', 'favourites', 'favourites-filter'));
  }
  state.settings.filters
    .filter((item) => item.enabled)
    .forEach((item, index) => chips.appendChild(createFilterButton(item.label, `${index}:${item.kind}:${item.value}`)));
  panel.appendChild(chips);
};

const escapeAttribute = (value) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');

const filterRow = (filter = { label: '', kind: 'ingredient', value: '', enabled: true }) => {
  const row = document.createElement('div');
  row.className = 'planner-config-row';
  row.innerHTML = `
    <input class="filter-enabled" type="checkbox" ${filter.enabled ? 'checked' : ''} aria-label="Enabled">
    <input class="filter-label" value="${escapeAttribute(filter.label)}" placeholder="Button label" maxlength="40">
    <select class="filter-kind">
      <option value="ingredient" ${filter.kind === 'ingredient' ? 'selected' : ''}>Ingredient</option>
      <option value="category" ${filter.kind === 'category' ? 'selected' : ''}>Category</option>
      <option value="cuisine" ${filter.kind === 'cuisine' ? 'selected' : ''}>Cuisine</option>
    </select>
    <input class="filter-value" value="${escapeAttribute(filter.value)}" placeholder="Match value" maxlength="80">
    <button type="button" class="filter-remove" aria-label="Remove filter">×</button>
  `;
  row.querySelector('.filter-remove').onclick = () => row.remove();
  return row;
};

const closeConfiguration = () => document.querySelector('.planner-config-backdrop')?.remove();

const openConfiguration = () => {
  if (!state.settings) return;
  closeConfiguration();
  const backdrop = document.createElement('div');
  backdrop.className = 'planner-config-backdrop';
  backdrop.innerHTML = `
    <section class="planner-config-modal" role="dialog" aria-modal="true" aria-labelledby="planner-config-title">
      <div class="planner-config-titlebar">
        <div><span>DINNERHUB CONFIGURATION</span><h2 id="planner-config-title">Recipe filters</h2></div>
        <button type="button" class="planner-config-close" aria-label="Close">×</button>
      </div>
      <p>Choose which shortcuts appear above the recipe library. Filters can match an ingredient, category or cuisine.</p>
      <div class="planner-config-options">
        <label><input type="checkbox" class="config-favourites-first" ${state.settings.favourites_first ? 'checked' : ''}> Show favourite recipes first</label>
        <label><input type="checkbox" class="config-show-favourites" ${state.settings.show_favourites_filter ? 'checked' : ''}> Show the Favourites filter</label>
        <label>Maximum selected filters <input type="number" class="config-filter-limit" min="1" max="5" value="${state.settings.maximum_active_filters || 2}"></label>
      </div>
      <div class="planner-config-column-headings"><span></span><span>Label</span><span>Match type</span><span>Match value</span><span></span></div>
      <div class="planner-config-rows"></div>
      <button type="button" class="planner-add-filter">+ Add filter option</button>
      <div class="planner-config-error" hidden></div>
      <div class="planner-config-actions">
        <button type="button" class="planner-config-cancel">Cancel</button>
        <button type="button" class="planner-config-save">Save configuration</button>
      </div>
    </section>
  `;
  const rows = backdrop.querySelector('.planner-config-rows');
  state.settings.filters.forEach((item) => rows.appendChild(filterRow(item)));
  backdrop.querySelector('.planner-add-filter').onclick = () => rows.appendChild(filterRow());
  backdrop.querySelector('.planner-config-close').onclick = closeConfiguration;
  backdrop.querySelector('.planner-config-cancel').onclick = closeConfiguration;
  backdrop.onclick = (event) => { if (event.target === backdrop) closeConfiguration(); };
  backdrop.querySelector('.planner-config-save').onclick = async () => {
    const errorBox = backdrop.querySelector('.planner-config-error');
    const filters = Array.from(rows.querySelectorAll('.planner-config-row')).map((row) => ({
      enabled: row.querySelector('.filter-enabled').checked,
      label: row.querySelector('.filter-label').value.trim(),
      kind: row.querySelector('.filter-kind').value,
      value: row.querySelector('.filter-value').value.trim()
    })).filter((item) => item.label && item.value);
    const payload = {
      favourites_first: backdrop.querySelector('.config-favourites-first').checked,
      show_favourites_filter: backdrop.querySelector('.config-show-favourites').checked,
      maximum_active_filters: Number(backdrop.querySelector('.config-filter-limit').value || 2),
      filters
    };
    try {
      state.settings = await api('filter-settings', { method: 'PUT', body: JSON.stringify(payload) });
      state.activeFilters = [];
      closeConfiguration();
      enhance();
    } catch (error) {
      errorBox.hidden = false;
      errorBox.textContent = error instanceof Error ? error.message : 'Configuration could not be saved';
    }
  };
  document.body.appendChild(backdrop);
};

const observeRoot = () => {
  const root = document.getElementById('root');
  if (state.observer && root) {
    state.observer.observe(root, { childList: true, subtree: true });
  }
};

const enhance = () => {
  state.observer?.disconnect();
  renderFilterBar();
  applyCardState();
  window.queueMicrotask(observeRoot);
};

const start = async () => {
  try {
    await refreshData();
    state.observer = new MutationObserver(() => window.requestAnimationFrame(enhance));
    enhance();
  } catch (error) {
    console.error('DinnerHub menu planner enhancements failed to start', error);
  }
};

void start();
