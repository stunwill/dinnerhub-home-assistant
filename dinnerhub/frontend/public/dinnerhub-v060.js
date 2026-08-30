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

const formatDate = (value) => new Intl.DateTimeFormat(undefined, {
  weekday: 'short', day: 'numeric', month: 'short'
}).format(new Date(`${value}T12:00:00`));

const state = {
  meals: [],
  plan: [],
  ratings: {},
  builderDays: 7,
  minimumRating: 0,
  observer: null,
  applying: false
};

const logoMarkup = (compact = false) => `
  <div class="dh-brand ${compact ? 'dh-brand-compact' : ''}" aria-label="FoodHub by Stu">
    <span class="dh-emblem" aria-hidden="true">
      <span class="dh-fork">⌑</span><span class="dh-knife">▮</span>
    </span>
    <span class="dh-wordmark-wrap">
      <strong class="dh-wordmark">FoodHub</strong>
      <span class="dh-by-stu">by Stu</span>
    </span>
  </div>
`;

const installBrand = () => {
  const root = document.getElementById('root');
  if (!root) return;
  const appHeader = root.querySelector('header');
  if (appHeader && !appHeader.querySelector('.dh-brand')) {
    const firstHeading = appHeader.querySelector('h1');
    if (firstHeading) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = logoMarkup(false);
      firstHeading.replaceWith(wrapper.firstElementChild);
    }
  }
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

const findMealForCard = (card) => {
  const title = card.querySelector('h3')?.textContent?.replace(/^★\s*/, '').trim();
  return state.meals.find((meal) => meal.name === title) || null;
};

const decorateRecipeCards = () => {
  const cards = document.querySelectorAll('.meal-card');
  for (const card of cards) {
    const meal = findMealForCard(card);
    if (!meal) continue;
    const average = averageFor(meal.id);
    let badge = card.querySelector('.dh-rating-badge');
    if (!badge) {
      badge = document.createElement('button');
      badge.type = 'button';
      badge.className = 'dh-rating-badge';
      badge.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        openRatingModal(meal);
      };
      card.appendChild(badge);
    }
    badge.textContent = average == null ? '☆ Rate' : `★ ${average.toFixed(1)}`;
    badge.title = average == null ? 'Add household scores' : `Household average ${average.toFixed(1)} out of 10`;
    card.classList.toggle('dh-rating-hidden', state.minimumRating > 0 && (average == null || average < state.minimumRating));
  }
};

const openRatingModal = async (meal) => {
  const existing = await api(`meals/${meal.id}/ratings`);
  document.querySelector('.dh-rating-backdrop')?.remove();
  const backdrop = document.createElement('div');
  backdrop.className = 'dh-rating-backdrop';
  const members = ['Stu', 'Kristy', 'Sienna'];
  backdrop.innerHTML = `
    <section class="dh-rating-modal" role="dialog" aria-modal="true">
      <div class="dh-modal-heading">
        <div><span>HOUSEHOLD SCORE</span><h2>${meal.name}</h2></div>
        <button type="button" class="dh-close" aria-label="Close">×</button>
      </div>
      <p>Each person can score this meal from 0 to 10. FoodHub calculates the average from the scores entered.</p>
      <div class="dh-rating-grid">
        ${members.map((member) => {
          const value = existing.ratings[member];
          return `<label><span>${member}</span><input type="number" min="0" max="10" step="0.5" data-member="${member}" value="${value ?? ''}" placeholder="Not rated"></label>`;
        }).join('')}
      </div>
      <div class="dh-rating-average">Average: <strong>${existing.average == null ? 'Not rated' : `${existing.average.toFixed(1)} / 10`}</strong></div>
      <div class="dh-modal-error" hidden></div>
      <div class="dh-modal-actions"><button type="button" class="dh-cancel">Cancel</button><button type="button" class="dh-save">Save scores</button></div>
    </section>
  `;
  const close = () => backdrop.remove();
  backdrop.querySelector('.dh-close').onclick = close;
  backdrop.querySelector('.dh-cancel').onclick = close;
  backdrop.onclick = (event) => { if (event.target === backdrop) close(); };
  backdrop.querySelector('.dh-save').onclick = async () => {
    const errorBox = backdrop.querySelector('.dh-modal-error');
    try {
      for (const input of backdrop.querySelectorAll('input[data-member]')) {
        const value = input.value.trim();
        await api(`meals/${meal.id}/ratings`, {
          method: 'PUT',
          body: JSON.stringify({ member_name: input.dataset.member, score: value === '' ? null : Number(value) })
        });
      }
      const updated = await api(`meals/${meal.id}/ratings`);
      state.ratings[String(meal.id)] = updated;
      close();
      decorateRecipeCards();
      renderRatingFilter();
    } catch (error) {
      errorBox.hidden = false;
      errorBox.textContent = error instanceof Error ? error.message : 'Scores could not be saved';
    }
  };
  document.body.appendChild(backdrop);
};

const renderRatingFilter = () => {
  const filterPanel = document.querySelector('.planner-filter-panel');
  if (!filterPanel) return;
  let block = filterPanel.querySelector('.dh-rating-filter');
  if (!block) {
    block = document.createElement('div');
    block.className = 'dh-rating-filter';
    filterPanel.appendChild(block);
  }
  block.innerHTML = `
    <label>Minimum household score
      <select>
        <option value="0">Any score</option>
        <option value="5">5+</option>
        <option value="6">6+</option>
        <option value="7">7+</option>
        <option value="8">8+</option>
        <option value="9">9+</option>
      </select>
    </label>
  `;
  const select = block.querySelector('select');
  select.value = String(state.minimumRating);
  select.onchange = () => {
    state.minimumRating = Number(select.value);
    decorateRecipeCards();
  };
};

const planByDate = () => new Map(state.plan.map((entry) => [entry.meal_date, entry]));

const assignMeal = async (meal, date) => {
  await api('meal-plan', {
    method: 'POST',
    body: JSON.stringify({
      meal_date: date,
      meal_id: meal.id,
      entry_type: 'meal',
      custom_title: null,
      status: 'planned',
      servings: meal.servings,
      selected_by_id: 'web',
      selected_by_name: 'FoodHub',
      locked: false,
      notes: null
    })
  });
  await loadData();
  renderPlanBuilder();
};

const renderPlanBuilder = () => {
  const planView = [...document.querySelectorAll('main section, main div')].find((element) => element.querySelector?.('h2')?.textContent?.includes('Upcoming meal plan'));
  if (!planView) return;
  let builder = document.querySelector('.dh-plan-builder');
  if (!builder) {
    builder = document.createElement('section');
    builder.className = 'dh-plan-builder';
    planView.insertAdjacentElement('beforebegin', builder);
  }
  const assignments = planByDate();
  const days = Array.from({ length: state.builderDays }, (_, index) => localIsoDate(index));
  const suggested = [...state.meals]
    .sort((a, b) => Number(Boolean(b.favourite)) - Number(Boolean(a.favourite)) || (averageFor(b.id) ?? -1) - (averageFor(a.id) ?? -1) || a.name.localeCompare(b.name))
    .slice(0, 18);

  builder.innerHTML = `
    <div class="dh-builder-heading">
      <div><span>GUIDED PLANNING</span><h2>Create your menu plan</h2><p>Pick a planning length, then add recipes into upcoming days.</p></div>
      <div class="dh-builder-lengths">${[3, 5, 7, 10, 14].map((count) => `<button type="button" data-days="${count}" class="${state.builderDays === count ? 'active' : ''}">${count} days</button>`).join('')}</div>
    </div>
    <div class="dh-day-slots">
      ${days.map((date) => {
        const entry = assignments.get(date);
        const meal = entry?.meal;
        return `<article class="dh-day-slot ${meal ? 'filled' : ''}" data-date="${date}">
          <div class="dh-day-image" ${meal?.image_url ? `style="background-image:url('${meal.image_url.replaceAll("'", "%27")}')"` : ''}></div>
          <span>${formatDate(date)}</span>
          <strong>${meal?.name || 'Choose a meal'}</strong>
          <button type="button" class="dh-slot-action">${meal ? 'Change' : '+ Add'}</button>
        </article>`;
      }).join('')}
    </div>
    <div class="dh-suggested-heading"><div><span>SUGGESTED RECIPES</span><h3>Choose from your recipes</h3></div><small>Favourites and highly rated meals are shown first.</small></div>
    <div class="dh-suggested-grid">
      ${suggested.map((meal) => `<article class="dh-suggested-card" data-meal-id="${meal.id}">
        <div class="dh-suggested-image" ${meal.image_url ? `style="background-image:url('${meal.image_url.replaceAll("'", "%27")}')"` : ''}><button type="button" class="dh-add-suggested">+</button></div>
        <strong>${meal.name}</strong>
        <span>${meal.favourite ? '♥ Favourite' : ''}${averageFor(meal.id) != null ? `${meal.favourite ? ' · ' : ''}★ ${averageFor(meal.id).toFixed(1)}` : ''}</span>
      </article>`).join('')}
    </div>
  `;

  builder.querySelectorAll('[data-days]').forEach((button) => {
    button.onclick = () => { state.builderDays = Number(button.dataset.days); renderPlanBuilder(); };
  });

  const chooseDateForMeal = (meal) => {
    const emptyDate = days.find((date) => !assignments.get(date)?.meal);
    const date = emptyDate || days[0];
    void assignMeal(meal, date);
  };

  builder.querySelectorAll('.dh-add-suggested').forEach((button) => {
    button.onclick = () => {
      const mealId = Number(button.closest('[data-meal-id]').dataset.mealId);
      const meal = state.meals.find((item) => item.id === mealId);
      if (meal) chooseDateForMeal(meal);
    };
  });

  builder.querySelectorAll('.dh-slot-action').forEach((button) => {
    button.onclick = () => {
      const date = button.closest('[data-date]').dataset.date;
      openMealPicker(date);
    };
  });
};

const openMealPicker = (date) => {
  document.querySelector('.dh-picker-backdrop')?.remove();
  const backdrop = document.createElement('div');
  backdrop.className = 'dh-picker-backdrop';
  backdrop.innerHTML = `
    <section class="dh-picker-modal">
      <div class="dh-modal-heading"><div><span>${formatDate(date)}</span><h2>Select a meal</h2></div><button type="button" class="dh-close">×</button></div>
      <input class="dh-picker-search" placeholder="Search recipes">
      <div class="dh-picker-list"></div>
    </section>
  `;
  const list = backdrop.querySelector('.dh-picker-list');
  const render = (term = '') => {
    list.innerHTML = state.meals.filter((meal) => meal.name.toLowerCase().includes(term.toLowerCase())).map((meal) => `<button type="button" data-meal="${meal.id}"><span>${meal.name}</span><small>${averageFor(meal.id) == null ? 'Not rated' : `★ ${averageFor(meal.id).toFixed(1)}`}</small></button>`).join('');
    list.querySelectorAll('[data-meal]').forEach((button) => {
      button.onclick = async () => {
        const meal = state.meals.find((item) => item.id === Number(button.dataset.meal));
        if (meal) {
          await assignMeal(meal, date);
          backdrop.remove();
        }
      };
    });
  };
  render();
  backdrop.querySelector('.dh-picker-search').oninput = (event) => render(event.target.value);
  backdrop.querySelector('.dh-close').onclick = () => backdrop.remove();
  backdrop.onclick = (event) => { if (event.target === backdrop) backdrop.remove(); };
  document.body.appendChild(backdrop);
};

const enhance = () => {
  if (state.applying) return;
  state.applying = true;
  try {
    installBrand();
    decorateRecipeCards();
    renderRatingFilter();
    renderPlanBuilder();
  } finally {
    state.applying = false;
  }
};

const start = async () => {
  try {
    await loadData();
    enhance();
    state.observer = new MutationObserver(() => window.requestAnimationFrame(enhance));
    state.observer.observe(document.getElementById('root'), { childList: true, subtree: true });
  } catch (error) {
    console.error('FoodHub v0.6 enhancements failed to start', error);
  }
};

void start();
