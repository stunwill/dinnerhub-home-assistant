const dh09Api = async (path, options = {}) => {
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

let dh09Meals = [];
let dh09Applying = false;
const dh09RenderedKey = new WeakMap();

const dh09LoadMeals = async () => {
  dh09Meals = await dh09Api('meals');
};

const dh09MealByName = (name) => dh09Meals.find((meal) => meal.name === name.trim());

const dh09DetailServings = (modal, meal) => {
  const text = modal.querySelector('.serving-control strong')?.textContent || '';
  const match = text.match(/[\d.]+/);
  return match ? Number(match[0]) : meal.servings;
};

const dh09RenderCookingSteps = async (modal) => {
  const mealName = modal.querySelector('.modal-heading h2')?.textContent?.trim();
  if (!mealName) return;
  const meal = dh09MealByName(mealName);
  if (!meal) return;
  const servings = dh09DetailServings(modal, meal);
  const key = `${meal.id}:${servings}`;
  if (dh09RenderedKey.get(modal) === key) return;

  const methodHeading = Array.from(modal.querySelectorAll('.recipe-section h3'))
    .find((heading) => heading.textContent?.trim() === 'Method');
  const section = methodHeading?.closest('.recipe-section');
  const list = section?.querySelector('.instruction-list');
  if (!section || !list) return;

  const steps = await dh09Api(`meals/${meal.id}/steps?servings=${encodeURIComponent(servings)}`);
  if (!steps.length) return;
  list.replaceChildren(...steps.map((step) => {
    const item = document.createElement('li');
    item.className = 'dh09-cooking-step';
    item.dataset.stepNumber = String(step.position);
    const text = document.createElement('span');
    text.className = 'dh09-step-text';
    text.textContent = step.rendered_instruction || step.instruction;
    item.appendChild(text);
    if (step.ingredient_names?.length || step.timer_minutes) {
      const meta = document.createElement('div');
      meta.className = 'dh09-step-meta';
      for (const ingredient of step.ingredient_names || []) {
        const chip = document.createElement('span');
        chip.textContent = ingredient;
        meta.appendChild(chip);
      }
      if (step.timer_minutes) {
        const timer = document.createElement('span');
        timer.className = 'timer';
        timer.textContent = `⏱ ${step.timer_minutes} min`;
        meta.appendChild(timer);
      }
      item.appendChild(meta);
    }
    return item;
  }));

  let note = section.querySelector('.dh09-structured-note');
  if (!note) {
    note = document.createElement('small');
    note.className = 'dh09-structured-note';
    note.textContent = 'Structured steps explicitly link ingredients to each instruction, so quantities remain accurate when servings change.';
    list.insertAdjacentElement('afterend', note);
  }
  dh09RenderedKey.set(modal, key);
};

const dh09StepRow = (step, ingredients) => {
  const row = document.createElement('article');
  row.className = 'dh09-editor-row';
  row.innerHTML = `
    <div class="dh09-editor-row-heading">
      <strong>Step</strong>
      <div><button type="button" data-up aria-label="Move up">↑</button><button type="button" data-down aria-label="Move down">↓</button><button type="button" data-remove aria-label="Remove step">×</button></div>
    </div>
    <textarea class="dh09-instruction" rows="3" placeholder="Describe this cooking step"></textarea>
    <div class="dh09-ingredient-links"></div>
    <label class="dh09-timer">Timer <input type="number" min="1" max="1440" placeholder="minutes"></label>
  `;
  row.querySelector('.dh09-instruction').value = step?.instruction || '';
  row.querySelector('.dh09-timer input').value = step?.timer_minutes || '';
  const links = row.querySelector('.dh09-ingredient-links');
  for (const ingredient of ingredients) {
    const label = document.createElement('label');
    label.className = 'dh09-ingredient-chip';
    const checked = step?.ingredient_names?.some((name) => name.toLowerCase() === ingredient.name.toLowerCase());
    label.innerHTML = `<input type="checkbox" ${checked ? 'checked' : ''}><span></span>`;
    label.querySelector('span').textContent = ingredient.name;
    links.appendChild(label);
  }
  row.querySelector('[data-remove]').onclick = () => row.remove();
  row.querySelector('[data-up]').onclick = () => row.previousElementSibling?.before(row);
  row.querySelector('[data-down]').onclick = () => row.nextElementSibling?.after(row);
  return row;
};

const dh09OpenStepEditor = async (meal) => {
  const [steps, refreshedMeal] = await Promise.all([
    dh09Api(`meals/${meal.id}/steps`),
    dh09Api(`meals/${meal.id}`)
  ]);
  document.querySelector('.dh09-editor-backdrop')?.remove();
  const backdrop = document.createElement('div');
  backdrop.className = 'dh09-editor-backdrop';
  backdrop.innerHTML = `
    <section class="dh09-editor-modal" role="dialog" aria-modal="true">
      <div class="dh09-editor-title"><div><span>STRUCTURED COOKING STEPS</span><h2></h2></div><button type="button" data-close>×</button></div>
      <p>Link the ingredients used in each step. DinnerHub will insert the correct scaled amount into the cooking instructions.</p>
      <div class="dh09-editor-list"></div>
      <button type="button" class="dh09-add-step">+ Add step</button>
      <div class="dh09-editor-error" hidden></div>
      <div class="dh09-editor-actions"><button type="button" data-cancel>Cancel</button><button type="button" class="primary" data-save>Save structured steps</button></div>
    </section>
  `;
  backdrop.querySelector('h2').textContent = meal.name;
  const list = backdrop.querySelector('.dh09-editor-list');
  const ingredients = refreshedMeal.ingredients || [];
  const seed = steps.length ? steps : (refreshedMeal.instructions || []).map((instruction) => ({ instruction, ingredient_names: [] }));
  seed.forEach((step) => list.appendChild(dh09StepRow(step, ingredients)));
  if (!seed.length) list.appendChild(dh09StepRow(null, ingredients));
  backdrop.querySelector('.dh09-add-step').onclick = () => list.appendChild(dh09StepRow(null, ingredients));
  const close = () => backdrop.remove();
  backdrop.querySelector('[data-close]').onclick = close;
  backdrop.querySelector('[data-cancel]').onclick = close;
  backdrop.onclick = (event) => { if (event.target === backdrop) close(); };
  backdrop.querySelector('[data-save]').onclick = async () => {
    const error = backdrop.querySelector('.dh09-editor-error');
    const payload = Array.from(list.querySelectorAll('.dh09-editor-row')).map((row) => ({
      instruction: row.querySelector('.dh09-instruction').value.trim(),
      ingredient_names: Array.from(row.querySelectorAll('.dh09-ingredient-chip input:checked')).map((input) => input.nextElementSibling.textContent.trim()),
      timer_minutes: row.querySelector('.dh09-timer input').value ? Number(row.querySelector('.dh09-timer input').value) : null,
      note: null
    })).filter((step) => step.instruction);
    try {
      await dh09Api(`meals/${meal.id}/steps`, { method: 'PUT', body: JSON.stringify(payload) });
      close();
      window.alert('Structured cooking steps saved');
    } catch (caught) {
      error.hidden = false;
      error.textContent = caught instanceof Error ? caught.message : 'Steps could not be saved';
    }
  };
  document.body.appendChild(backdrop);
};

const dh09EnhanceRecipeForm = (form) => {
  if (form.querySelector('.dh09-structure-button')) return;
  const title = form.querySelector('.modal-heading h2')?.textContent?.trim();
  const method = Array.from(form.querySelectorAll('label')).find((label) => label.childNodes[0]?.textContent?.trim() === 'Method');
  if (!method) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'secondary dh09-structure-button';
  button.textContent = 'Structure cooking steps';
  if (title === 'Add a meal') {
    button.disabled = true;
    button.title = 'Save the recipe first, then edit it to link ingredients to cooking steps.';
  } else {
    button.onclick = async () => {
      await dh09LoadMeals();
      const name = form.querySelector('input[name="name"]')?.value?.trim();
      const meal = dh09MealByName(name || '');
      if (meal) await dh09OpenStepEditor(meal);
    };
  }
  method.insertAdjacentElement('afterend', button);
  if (button.disabled) {
    const hint = document.createElement('small');
    hint.className = 'dh09-structure-hint';
    hint.textContent = 'Save the new recipe first, then edit it to link ingredients to individual steps.';
    button.insertAdjacentElement('afterend', hint);
  }
};

const dh09Enhance = async () => {
  if (dh09Applying) return;
  dh09Applying = true;
  try {
    if (!dh09Meals.length) await dh09LoadMeals();
    for (const modal of document.querySelectorAll('.recipe-detail-modal')) {
      void dh09RenderCookingSteps(modal);
    }
    for (const form of document.querySelectorAll('.recipe-form-modal')) {
      dh09EnhanceRecipeForm(form);
    }
  } finally {
    dh09Applying = false;
  }
};

const dh09Observer = new MutationObserver(() => window.requestAnimationFrame(() => void dh09Enhance()));
void dh09Enhance();
dh09Observer.observe(document.body, { childList: true, subtree: true, characterData: true });
