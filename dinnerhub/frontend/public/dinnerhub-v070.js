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

const localIsoDate = (offset = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDate = (value, options = {}) => new Intl.DateTimeFormat(undefined, {
  weekday: 'short', day: 'numeric', month: 'short', ...options
}).format(new Date(`${value}T12:00:00`));

const state = {
  meals: [],
  plan: [],
  ratings: {},
  builderDays: 7,
  repeatWarningDays: 14,
  search: '',
  favouritesOnly: false,
  minimumRating: 0,
  observer: null,
  applying: false,
  saving: false
};

const loadData = async () => {
  const [meals, plan, ratings] = await Promise.all([
    api('meals'),
    api(`meal-plan?start=${localIsoDate()}&days=14`),
    api('meals/ratings/summary')
  ]);
  state.meals = meals;
  state.plan = plan;
  state.ratings = ratings;
};

const averageFor = (mealId) => state.ratings[String(mealId)]?.average ?? state.ratings[mealId]?.average ?? null;
const planMap = () => new Map(state.plan.map((entry) => [entry.meal_date, entry]));

const filteredMeals = () => {
  const term = state.search.trim().toLowerCase();
  return [...state.meals]
    .filter((meal) => !state.favouritesOnly || meal.favourite)
    .filter((meal) => state.minimumRating <= 0 || (averageFor(meal.id) ?? -1) >= state.minimumRating)
    .filter((meal) => !term || [meal.name, meal.category, meal.cuisine, ...(meal.ingredients || []).map((item) => item.name)]
      .some((value) => String(value || '').toLowerCase().includes(term)))
    .sort((a, b) => Number(Boolean(b.favourite)) - Number(Boolean(a.favourite)) || (averageFor(b.id) ?? -1) - (averageFor(a.id) ?? -1) || a.name.localeCompare(b.name));
};

const recentUsage = (mealId, beforeDate) => {
  const before = new Date(`${beforeDate}T12:00:00`);
  return state.plan
    .filter((entry) => entry.meal_id === mealId && entry.meal_date < beforeDate)
    .filter((entry) => {
      const used = new Date(`${entry.meal_date}T12:00:00`);
      return (before - used) / 86400000 <= state.repeatWarningDays;
    })
    .sort((a, b) => b.meal_date.localeCompare(a.meal_date))[0] || null;
};

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const assignMeal = async (date, meal) => {
  if (state.saving) return;
  state.saving = true;
  try {
    await api(`meal-plan/${date}`, {
      method: 'PUT',
      body: JSON.stringify({ meal_id: meal.id, entry_type: 'meal', servings: meal.servings })
    });
    await loadData();
    renderPlanner();
  } finally {
    state.saving = false;
  }
};

const clearDate = async (date) => {
  if (state.saving) return;
  state.saving = true;
  try {
    const response = await fetch(`api/meal-plan/${date}`, { method: 'DELETE' });
    if (!response.ok && response.status !== 404) throw new Error('Meal could not be removed');
    await loadData();
    renderPlanner();
  } finally {
    state.saving = false;
  }
};

const findPlannerAnchor = () => [...document.querySelectorAll('main section, main div')]
  .find((element) => element.querySelector?.('h2')?.textContent?.includes('Upcoming meal plan'));

const shoppingButton = () => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'dh70-shopping';
  button.textContent = 'Build shopping list';
  button.onclick = async () => {
    try {
      await api('shopping/generate', { method: 'POST', body: JSON.stringify({ days: state.builderDays }) });
      window.alert(`Shopping list rebuilt from the next ${state.builderDays} days.`);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Shopping list could not be built');
    }
  };
  return button;
};

const renderPlanner = () => {
  const anchor = findPlannerAnchor();
  if (!anchor) return;
  let shell = document.querySelector('.dh70-planner');
  if (!shell) {
    shell = document.createElement('section');
    shell.className = 'dh70-planner';
    anchor.insertAdjacentElement('beforebegin', shell);
  }

  const assignments = planMap();
  const days = Array.from({ length: state.builderDays }, (_, offset) => localIsoDate(offset));
  const meals = filteredMeals();

  shell.innerHTML = `
    <div class="dh70-heading">
      <div>
        <span class="dh70-eyebrow">PLAN BUILDER</span>
        <h2>Build the week in one place</h2>
        <p>Choose a planning window, fill open days, then generate the shopping list from the same plan.</p>
      </div>
      <div class="dh70-heading-actions">
        <div class="dh70-lengths">${[3,5,7,10,14].map((count) => `<button type="button" data-days="${count}" class="${state.builderDays === count ? 'active' : ''}">${count} days</button>`).join('')}</div>
      </div>
    </div>

    <div class="dh70-days">
      ${days.map((date, index) => {
        const entry = assignments.get(date);
        const meal = entry?.meal;
        const repeat = meal ? recentUsage(meal.id, date) : null;
        return `<article class="dh70-day ${meal ? 'filled' : 'open'}" data-date="${date}">
          <div class="dh70-day-image" ${meal?.image_url ? `style="background-image:url('${escapeHtml(meal.image_url)}')"` : ''}>
            <span class="dh70-day-label">${index === 0 ? 'Today' : formatDate(date, { weekday: 'short' }).split(',')[0]}</span>
            ${meal ? `<button type="button" class="dh70-clear" aria-label="Clear ${escapeHtml(meal.name)}">×</button>` : ''}
          </div>
          <div class="dh70-day-body">
            <small>${escapeHtml(formatDate(date))}</small>
            <strong>${escapeHtml(meal?.name || 'Open dinner')}</strong>
            ${repeat ? `<span class="dh70-repeat">Repeated from ${escapeHtml(formatDate(repeat.meal_date))}</span>` : `<span class="dh70-meta">${meal ? `${meal.total_minutes || (meal.prep_minutes + meal.cook_minutes)} min · ${escapeHtml(meal.category || 'Dinner')}` : 'No meal selected yet'}</span>`}
            <button type="button" class="dh70-choose">${meal ? 'Change meal' : '+ Choose meal'}</button>
          </div>
        </article>`;
      }).join('')}
    </div>

    <div class="dh70-discovery-heading">
      <div><span class="dh70-eyebrow">RECIPE DISCOVERY</span><h3>Choose meals faster</h3></div>
      <div class="dh70-filters">
        <input class="dh70-search" value="${escapeHtml(state.search)}" placeholder="Search recipes, ingredients or categories">
        <button type="button" class="dh70-favourites ${state.favouritesOnly ? 'active' : ''}">♥ Favourites</button>
        <select class="dh70-score">
          ${[0,5,6,7,8,9].map((score) => `<option value="${score}" ${state.minimumRating === score ? 'selected' : ''}>${score ? `${score}+ score` : 'Any score'}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="dh70-recipes">
      ${meals.slice(0, 24).map((meal) => `<article class="dh70-recipe" data-meal-id="${meal.id}">
        <div class="dh70-recipe-image" ${meal.image_url ? `style="background-image:url('${escapeHtml(meal.image_url)}')"` : ''}>
          <button type="button" class="dh70-quick-add" title="Add to next open day">+</button>
          ${meal.favourite ? '<span class="dh70-heart">♥</span>' : ''}
        </div>
        <div class="dh70-recipe-body">
          <strong>${escapeHtml(meal.name)}</strong>
          <span>${escapeHtml(meal.category || meal.cuisine || 'Dinner')}</span>
          <small>${averageFor(meal.id) == null ? 'Not rated' : `★ ${averageFor(meal.id).toFixed(1)} / 10`} · ${meal.total_minutes || (meal.prep_minutes + meal.cook_minutes)} min</small>
        </div>
      </article>`).join('') || '<p class="dh70-empty">No recipes match these filters.</p>'}
    </div>
  `;

  shell.querySelector('.dh70-heading-actions').appendChild(shoppingButton());

  shell.querySelectorAll('[data-days]').forEach((button) => {
    button.onclick = () => {
      state.builderDays = Number(button.dataset.days);
      renderPlanner();
    };
  });

  shell.querySelector('.dh70-search').oninput = (event) => {
    state.search = event.target.value;
    renderPlanner();
    const next = document.querySelector('.dh70-search');
    next?.focus();
    next?.setSelectionRange(state.search.length, state.search.length);
  };
  shell.querySelector('.dh70-favourites').onclick = () => {
    state.favouritesOnly = !state.favouritesOnly;
    renderPlanner();
  };
  shell.querySelector('.dh70-score').onchange = (event) => {
    state.minimumRating = Number(event.target.value);
    renderPlanner();
  };

  shell.querySelectorAll('.dh70-choose').forEach((button) => {
    button.onclick = () => openPicker(button.closest('[data-date]').dataset.date);
  });
  shell.querySelectorAll('.dh70-clear').forEach((button) => {
    button.onclick = (event) => {
      event.stopPropagation();
      void clearDate(button.closest('[data-date]').dataset.date);
    };
  });
  shell.querySelectorAll('.dh70-quick-add').forEach((button) => {
    button.onclick = () => {
      const mealId = Number(button.closest('[data-meal-id]').dataset.mealId);
      const meal = state.meals.find((item) => item.id === mealId);
      const openDate = days.find((date) => !assignments.get(date)?.meal);
      if (!meal) return;
      if (openDate) void assignMeal(openDate, meal);
      else openPicker(days[0], meal.id);
    };
  });
};

const openPicker = (date, preferredMealId = null) => {
  document.querySelector('.dh70-picker-backdrop')?.remove();
  const backdrop = document.createElement('div');
  backdrop.className = 'dh70-picker-backdrop';
  backdrop.innerHTML = `
    <section class="dh70-picker" role="dialog" aria-modal="true">
      <div class="dh70-picker-heading"><div><span>${escapeHtml(formatDate(date))}</span><h2>Select a meal</h2></div><button type="button" class="dh70-picker-close">×</button></div>
      <input class="dh70-picker-search" placeholder="Search recipes">
      <div class="dh70-picker-list"></div>
    </section>`;
  const list = backdrop.querySelector('.dh70-picker-list');
  const render = (term = '') => {
    const needle = term.toLowerCase();
    const options = [...state.meals]
      .filter((meal) => [meal.name, meal.category, meal.cuisine, ...(meal.ingredients || []).map((item) => item.name)].some((value) => String(value || '').toLowerCase().includes(needle)))
      .sort((a, b) => Number(b.id === preferredMealId) - Number(a.id === preferredMealId) || Number(Boolean(b.favourite)) - Number(Boolean(a.favourite)) || (averageFor(b.id) ?? -1) - (averageFor(a.id) ?? -1));
    list.innerHTML = options.map((meal) => {
      const repeat = recentUsage(meal.id, date);
      return `<button type="button" data-meal="${meal.id}">
        <span><strong>${escapeHtml(meal.name)}</strong><small>${escapeHtml(meal.category || 'Dinner')}</small></span>
        <span>${repeat ? `<em>Last used ${escapeHtml(formatDate(repeat.meal_date))}</em>` : ''}${averageFor(meal.id) == null ? '' : `<b>★ ${averageFor(meal.id).toFixed(1)}</b>`}</span>
      </button>`;
    }).join('');
    list.querySelectorAll('[data-meal]').forEach((button) => {
      button.onclick = async () => {
        const meal = state.meals.find((item) => item.id === Number(button.dataset.meal));
        if (!meal) return;
        await assignMeal(date, meal);
        backdrop.remove();
      };
    });
  };
  render();
  backdrop.querySelector('.dh70-picker-search').oninput = (event) => render(event.target.value);
  backdrop.querySelector('.dh70-picker-close').onclick = () => backdrop.remove();
  backdrop.onclick = (event) => { if (event.target === backdrop) backdrop.remove(); };
  document.body.appendChild(backdrop);
};

const enhance = () => {
  if (state.applying) return;
  state.applying = true;
  try { renderPlanner(); } finally { state.applying = false; }
};

const start = async () => {
  try {
    await loadData();
    enhance();
    state.observer = new MutationObserver(() => window.requestAnimationFrame(enhance));
    const root = document.getElementById('root');
    if (root) state.observer.observe(root, { childList: true, subtree: true });
  } catch (error) {
    console.error('DinnerHub v0.7 enhancements failed to start', error);
  }
};

void start();
