(() => {
  const API = 'api';
  const mealTypes = ['breakfast', 'lunch', 'dinner'];
  let weekStart = startOfWeek(new Date());
  let plannerRows = [];
  let recipeCache = [];
  let cooking = null;
  let cookingTimer = null;

  function startOfWeek(value) {
    const d = new Date(value);
    d.setHours(12, 0, 0, 0);
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    return d;
  }

  function isoDate(value) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function addDays(value, amount) {
    const d = new Date(value);
    d.setDate(d.getDate() + amount);
    return d;
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }

  async function request(path, options = {}) {
    const response = await fetch(`${API}/${path}`, {
      ...options,
      headers: {'Content-Type': 'application/json', ...(options.headers || {})}
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({detail: 'Request failed'}));
      throw new Error(typeof body.detail === 'string' ? body.detail : 'Request failed');
    }
    return response.status === 204 ? null : response.json();
  }

  function ensureNav() {
    const nav = document.querySelector('.tabs');
    if (!nav || nav.querySelector('[data-fh-planner]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.fhPlanner = 'true';
    button.textContent = 'Meal planner';
    button.addEventListener('click', openPlanner);
    nav.appendChild(button);
  }

  function modalShell(title, body, extraClass = '') {
    const wrapper = document.createElement('div');
    wrapper.className = 'fh-v015-backdrop';
    wrapper.innerHTML = `<section class="fh-v015-modal ${extraClass}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <header class="fh-v015-modal-header"><div><span class="eyebrow">FoodHub</span><h2>${esc(title)}</h2></div><button class="fh-v015-close" aria-label="Close">×</button></header>
      ${body}
    </section>`;
    wrapper.querySelector('.fh-v015-close').addEventListener('click', () => wrapper.remove());
    wrapper.addEventListener('mousedown', (event) => { if (event.target === wrapper) wrapper.remove(); });
    document.body.appendChild(wrapper);
    return wrapper;
  }

  async function openPlanner() {
    const root = modalShell('Meal Planner', `<div class="fh-v015-week-nav">
      <button data-prev class="secondary">Previous week</button>
      <button data-today class="secondary">This week</button>
      <strong data-label></strong>
      <button data-next class="secondary">Next week</button>
    </div><div data-planner class="fh-v015-planner"><p>Loading meal plan…</p></div>`, 'fh-v015-planner-modal');
    root.querySelector('[data-prev]').addEventListener('click', () => { weekStart = addDays(weekStart, -7); void renderPlanner(root); });
    root.querySelector('[data-next]').addEventListener('click', () => { weekStart = addDays(weekStart, 7); void renderPlanner(root); });
    root.querySelector('[data-today]').addEventListener('click', () => { weekStart = startOfWeek(new Date()); void renderPlanner(root); });
    await renderPlanner(root);
  }

  async function renderPlanner(root) {
    const start = isoDate(weekStart);
    const end = addDays(weekStart, 6);
    root.querySelector('[data-label]').textContent = `${weekStart.toLocaleDateString(undefined,{day:'numeric',month:'short'})} – ${end.toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'})}`;
    const container = root.querySelector('[data-planner]');
    container.innerHTML = '<p>Loading meal plan…</p>';
    try {
      [plannerRows, recipeCache] = await Promise.all([
        request(`meal-planner?start=${start}&days=7`),
        recipeCache.length ? Promise.resolve(recipeCache) : request('meals')
      ]);
      const today = isoDate(new Date());
      container.innerHTML = Array.from({length:7}, (_, index) => {
        const d = addDays(weekStart, index);
        const key = isoDate(d);
        const rows = plannerRows.filter((item) => item.meal_date === key);
        const slots = mealTypes.map((type) => {
          const item = rows.find((row) => row.meal_type === type);
          return item ? plannedCard(item) : `<button class="fh-v015-empty-slot" data-add-date="${key}" data-add-type="${type}"><span>${type}</span><strong>+ Add meal</strong></button>`;
        }).join('');
        return `<article class="fh-v015-day ${key === today ? 'is-today' : ''}"><header><span>${d.toLocaleDateString(undefined,{weekday:'short'}).toUpperCase()}</span><strong>${d.toLocaleDateString(undefined,{day:'numeric',month:'short'})}</strong></header>${slots}</article>`;
      }).join('');
      container.querySelectorAll('[data-add-date]').forEach((button) => button.addEventListener('click', () => openAddMeal(root, button.dataset.addDate, button.dataset.addType)));
      container.querySelectorAll('[data-edit-id]').forEach((button) => button.addEventListener('click', () => openEditMeal(root, Number(button.dataset.editId))));
      container.querySelectorAll('[data-view-recipe]').forEach((button) => button.addEventListener('click', () => openExistingRecipe(Number(button.dataset.viewRecipe))));
      container.querySelectorAll('[data-cook-recipe]').forEach((button) => button.addEventListener('click', () => startCooking(Number(button.dataset.cookRecipe), Number(button.dataset.servings || 0) || undefined, Number(button.dataset.planId || 0) || undefined)));
    } catch (error) {
      container.innerHTML = `<p class="fh-v015-error">${esc(error.message)}</p>`;
    }
  }

  function plannedCard(item) {
    return `<section class="fh-v015-slot"><span>${esc(item.meal_type)}</span><strong>${esc(item.title)}</strong>${item.servings ? `<small>${esc(item.servings)} servings</small>` : ''}
      <div class="fh-v015-actions">
        ${item.recipe ? `<button class="secondary" data-view-recipe="${item.recipe.id}">View recipe</button><button class="primary" data-cook-recipe="${item.recipe.id}" data-servings="${item.servings || item.recipe.servings}" data-plan-id="${item.id}">Start Cooking</button>` : ''}
        <button class="secondary" data-edit-id="${item.id}">Edit</button>
      </div></section>`;
  }

  function openAddMeal(plannerRoot, mealDate, mealType) {
    openMealEditor(plannerRoot, {meal_date: mealDate, meal_type: mealType});
  }

  function openEditMeal(plannerRoot, id) {
    const item = plannerRows.find((row) => row.id === id);
    if (item) openMealEditor(plannerRoot, item);
  }

  function openMealEditor(plannerRoot, item) {
    const editing = Boolean(item.id);
    const recipes = recipeCache.map((meal) => `<option value="${meal.id}" ${item.meal_id === meal.id ? 'selected' : ''}>${esc(meal.name)}</option>`).join('');
    const body = `<form class="fh-v015-form">
      <label>Date<input name="meal_date" type="date" required value="${esc(item.meal_date)}"></label>
      <label>Meal type<select name="meal_type"><option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner">Dinner</option></select></label>
      <label>Recipe<select name="meal_id"><option value="">Custom meal</option>${recipes}</select></label>
      <label>Custom meal<input name="custom_title" maxlength="180" value="${esc(item.custom_title || (item.recipe ? '' : item.title || ''))}" placeholder="Takeaway, leftovers, etc."></label>
      <label>Servings<input name="servings" type="number" min="1" step="1" value="${esc(item.servings || '')}"></label>
      <label>Notes<textarea name="notes" rows="3">${esc(item.notes || '')}</textarea></label>
      <div class="fh-v015-form-actions">${editing ? '<button type="button" class="danger" data-delete>Remove</button><button type="button" class="secondary" data-duplicate>Duplicate</button>' : ''}<button type="submit" class="primary">Save</button></div>
    </form>`;
    const root = modalShell(editing ? 'Edit planned meal' : 'Add meal', body);
    root.querySelector('[name=meal_type]').value = item.meal_type;
    const form = root.querySelector('form');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      const payload = {
        meal_date: data.meal_date,
        meal_type: data.meal_type,
        meal_id: data.meal_id ? Number(data.meal_id) : null,
        custom_title: data.meal_id ? null : String(data.custom_title || '').trim() || null,
        servings: data.servings ? Number(data.servings) : null,
        notes: String(data.notes || '').trim() || null
      };
      try {
        await request(editing ? `meal-planner/${item.id}` : 'meal-planner', {method: editing ? 'PATCH' : 'POST', body: JSON.stringify(payload)});
        root.remove();
        await renderPlanner(plannerRoot);
      } catch (error) { alert(error.message); }
    });
    root.querySelector('[data-delete]')?.addEventListener('click', async () => {
      if (!confirm('Remove this planned meal?')) return;
      await request(`meal-planner/${item.id}`, {method:'DELETE'});
      root.remove();
      await renderPlanner(plannerRoot);
    });
    root.querySelector('[data-duplicate]')?.addEventListener('click', async () => {
      const target = prompt('Duplicate to date (YYYY-MM-DD)', item.meal_date);
      if (!target) return;
      try {
        await request(`meal-planner/${item.id}/duplicate`, {method:'POST', body: JSON.stringify({meal_date: target, meal_type: item.meal_type})});
        root.remove();
        await renderPlanner(plannerRoot);
      } catch (error) { alert(error.message); }
    });
  }

  function openExistingRecipe(mealId) {
    const meal = recipeCache.find((item) => item.id === mealId);
    if (!meal) return;
    const cards = Array.from(document.querySelectorAll('.meal-card'));
    const card = cards.find((node) => node.textContent.includes(meal.name));
    const button = card?.querySelector('.secondary');
    if (button) button.click();
  }

  function enhanceRecipeDetail() {
    document.querySelectorAll('.recipe-detail-modal').forEach((modal) => {
      if (modal.querySelector('[data-fh-cooking]')) return;
      const heading = modal.querySelector('h2');
      const meal = recipeCache.find((item) => item.name === heading?.textContent?.trim());
      if (!meal) return;
      const actions = modal.querySelector('.modal-actions');
      if (!actions) return;
      const controls = document.createElement('div');
      controls.className = 'fh-v015-recipe-actions';
      controls.innerHTML = `<button type="button" class="secondary" data-fh-plan>Add to Meal Plan</button>${meal.instructions?.length ? '<button type="button" class="primary" data-fh-cooking>Start Cooking</button>' : ''}`;
      actions.parentNode.insertBefore(controls, actions);
      controls.querySelector('[data-fh-plan]').addEventListener('click', () => {
        const date = prompt('Plan for date (YYYY-MM-DD)', isoDate(new Date()));
        if (!date) return;
        const type = prompt('Meal type: breakfast, lunch or dinner', 'dinner');
        if (!mealTypes.includes(type)) return;
        request('meal-planner', {method:'POST', body: JSON.stringify({meal_date:date, meal_type:type, meal_id:meal.id, servings:meal.servings})})
          .then(() => alert('Added to Meal Planner')).catch((error) => alert(error.message));
      });
      controls.querySelector('[data-fh-cooking]')?.addEventListener('click', () => {
        const serves = Number(modal.querySelector('.serving-control strong')?.textContent?.match(/[\d.]+/)?.[0]) || meal.servings;
        startCooking(meal.id, serves);
      });
    });
  }

  async function startCooking(mealId, servings, plannedId) {
    const meal = recipeCache.find((item) => item.id === mealId) || await request(`meals/${mealId}`);
    const targetServings = servings || meal.servings;
    const steps = await request(`meals/${mealId}/steps?servings=${encodeURIComponent(targetServings)}`);
    if (!steps.length) { alert('This recipe has no cooking instructions yet.'); return; }
    const key = `foodhub:cooking:${mealId}`;
    const saved = JSON.parse(sessionStorage.getItem(key) || 'null');
    cooking = {meal, steps, index: Math.min(saved?.index || 0, steps.length - 1), servings: targetServings, plannedId, key, timer: saved?.timer || null};
    renderCooking();
  }

  function renderCooking() {
    document.querySelector('.fh-v015-cooking')?.remove();
    if (!cooking) return;
    const step = cooking.steps[cooking.index];
    const root = document.createElement('div');
    root.className = 'fh-v015-cooking';
    root.innerHTML = `<main class="fh-v015-cook-shell">
      <header><div><span class="eyebrow">Cooking Mode</span><h1>${esc(cooking.meal.name)}</h1><p>${cooking.servings} servings</p></div><button data-exit class="secondary">Exit</button></header>
      <div class="fh-v015-progress"><span style="width:${((cooking.index + 1) / cooking.steps.length) * 100}%"></span></div>
      <section class="fh-v015-step"><span>Step ${cooking.index + 1} of ${cooking.steps.length}</span><h2>${esc(step.rendered_instruction || step.instruction)}</h2>${step.note ? `<p>${esc(step.note)}</p>` : ''}
      ${step.ingredient_names?.length ? `<details open><summary>Ingredients for this step</summary><ul>${step.ingredient_names.map((name) => `<li>${esc(name)}</li>`).join('')}</ul></details>` : `<details><summary>Ingredients</summary><ul>${cooking.meal.ingredients.map((ing) => { const qty = ing.quantity == null ? '' : Number((ing.quantity * cooking.servings / cooking.meal.servings).toFixed(2)); return `<li><span>${esc(ing.name)}</span><strong>${esc(qty)} ${esc(ing.unit || '')}</strong></li>`; }).join('')}</ul></details>`}
      ${step.timer_minutes ? `<div class="fh-v015-timer"><strong data-timer-display>${step.timer_minutes}:00</strong><button class="primary" data-timer>${cooking.timer ? 'Resume timer' : `Start ${step.timer_minutes}:00 timer`}</button><button class="secondary" data-timer-reset>Reset</button></div>` : ''}
      </section>
      <footer><button data-prev class="secondary" ${cooking.index === 0 ? 'disabled' : ''}>Previous</button><button data-next class="primary">${cooking.index === cooking.steps.length - 1 ? 'Meal complete' : 'Next'}</button></footer>
    </main>`;
    document.body.appendChild(root);
    root.querySelector('[data-exit]').addEventListener('click', () => root.remove());
    root.querySelector('[data-prev]').addEventListener('click', () => moveCooking(-1));
    root.querySelector('[data-next]').addEventListener('click', () => {
      if (cooking.index === cooking.steps.length - 1) finishCooking(root);
      else moveCooking(1);
    });
    root.querySelector('[data-timer]')?.addEventListener('click', () => runTimer(root, step.timer_minutes));
    root.querySelector('[data-timer-reset]')?.addEventListener('click', () => resetTimer(root, step.timer_minutes));
    persistCooking();
  }

  function moveCooking(delta) {
    cooking.index = Math.max(0, Math.min(cooking.steps.length - 1, cooking.index + delta));
    clearInterval(cookingTimer);
    cookingTimer = null;
    renderCooking();
  }

  function persistCooking() {
    if (cooking) sessionStorage.setItem(cooking.key, JSON.stringify({index:cooking.index, timer:cooking.timer}));
  }

  function runTimer(root, minutes) {
    if (!cooking.timer || cooking.timer <= 0) cooking.timer = minutes * 60;
    clearInterval(cookingTimer);
    const display = root.querySelector('[data-timer-display]');
    const render = () => { const m = Math.floor(cooking.timer / 60); const s = cooking.timer % 60; display.textContent = `${m}:${String(s).padStart(2,'0')}`; persistCooking(); };
    render();
    cookingTimer = setInterval(() => {
      cooking.timer -= 1;
      render();
      if (cooking.timer <= 0) { clearInterval(cookingTimer); cookingTimer = null; display.textContent = 'Done'; }
    }, 1000);
  }

  function resetTimer(root, minutes) {
    clearInterval(cookingTimer); cookingTimer = null; cooking.timer = null;
    root.querySelector('[data-timer-display]').textContent = `${minutes}:00`;
    persistCooking();
  }

  function finishCooking(root) {
    sessionStorage.removeItem(cooking.key);
    clearInterval(cookingTimer);
    root.querySelector('.fh-v015-step').innerHTML = `<span>Complete</span><h2>Meal complete</h2><p>${esc(cooking.meal.name)} is ready.</p>`;
    root.querySelector('footer').innerHTML = '<button class="primary" data-done>Finish Cooking</button>';
    root.querySelector('[data-done]').addEventListener('click', () => { root.remove(); cooking = null; });
  }

  async function init() {
    ensureNav();
    try { recipeCache = await request('meals'); } catch (_) {}
    new MutationObserver(() => { ensureNav(); enhanceRecipeDetail(); }).observe(document.documentElement, {childList:true, subtree:true});
    enhanceRecipeDetail();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else void init();
})();
