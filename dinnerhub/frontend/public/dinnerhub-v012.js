const dh12Api = async (path, options = {}) => {
  const response = await fetch(`api/${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.detail === 'string' ? body.detail : 'Request failed');
  return response.status === 204 ? null : body;
};

const dh12Esc = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

const dh12Categories = (value) => String(value || '').split(',').map((item) => item.trim()).filter(Boolean);

const dh12ToDraft = async (meal) => {
  let steps = [];
  try { steps = await dh12Api(`meals/${meal.id}/steps`); } catch (_) { steps = []; }
  return {
    name: meal.name,
    description: meal.description || null,
    categories: dh12Categories(meal.category),
    cuisine: meal.cuisine || null,
    prep_minutes: Number(meal.prep_minutes || 0),
    cook_minutes: Number(meal.cook_minutes || 0),
    servings: Number(meal.servings || 4),
    difficulty: meal.difficulty || 'easy',
    ingredients: (meal.ingredients || []).map((item) => ({
      name: item.name,
      quantity: item.quantity ?? null,
      unit: item.unit || null,
      shopping_category: item.shopping_category || 'Other',
      notes: item.notes || null,
      optional: Boolean(item.optional)
    })),
    steps: (steps.length ? steps : (meal.instructions || []).map((instruction) => ({ instruction }))).map((step) => ({
      instruction: step.instruction,
      ingredient_names: Array.isArray(step.ingredient_names) ? step.ingredient_names : [],
      timer_minutes: step.timer_minutes ?? null,
      note: step.note || null
    })),
    warnings: []
  };
};

const dh12Amount = (item) => {
  const amount = [item.quantity ?? '', item.unit ?? ''].filter((value) => value !== '').join(' ').trim();
  return `${amount ? `${amount} ` : ''}${item.name}`.trim();
};

const dh12DraftCard = (draft, title, tone = '') => {
  const ingredients = (draft.ingredients || []).map((item) => `<li>${dh12Esc(dh12Amount(item))}</li>`).join('');
  const steps = (draft.steps || []).map((step, index) => `<li><strong>${index + 1}.</strong> ${dh12Esc(step.instruction)}</li>`).join('');
  const categories = (draft.categories || []).join(' · ');
  return `<section class="dh12-draft-card ${tone}">
    <div class="dh12-draft-label">${dh12Esc(title)}</div>
    <h3>${dh12Esc(draft.name)}</h3>
    <div class="dh12-meta"><span>${Number(draft.prep_minutes || 0)}m prep</span><span>${Number(draft.cook_minutes || 0)}m cook</span><span>${dh12Esc(draft.servings || 4)} serves</span></div>
    ${draft.description ? `<p>${dh12Esc(draft.description)}</p>` : ''}
    <div class="dh12-tags">${categories ? `<span>${dh12Esc(categories)}</span>` : ''}${draft.cuisine ? `<span>${dh12Esc(draft.cuisine)}</span>` : ''}<span>${dh12Esc(draft.difficulty || 'easy')}</span></div>
    <details open><summary>Ingredients (${(draft.ingredients || []).length})</summary><ul>${ingredients}</ul></details>
    <details><summary>Method (${(draft.steps || []).length} steps)</summary><ol>${steps}</ol></details>
  </section>`;
};

const dh12IngredientMap = (draft) => new Map((draft.ingredients || []).map((item) => [String(item.name).toLowerCase(), item]));
const dh12Number = (value) => value === null || value === undefined ? null : Number(value);

const dh12Changes = (original, revised) => {
  const changes = [];
  if (original.name !== revised.name) changes.push(`Renamed to ${revised.name}`);
  if ((original.description || '') !== (revised.description || '')) changes.push('Description changed');
  if (Number(original.servings) !== Number(revised.servings)) changes.push(`Servings ${original.servings} → ${revised.servings}`);
  if (Number(original.prep_minutes) !== Number(revised.prep_minutes)) changes.push(`Prep ${original.prep_minutes}m → ${revised.prep_minutes}m`);
  if (Number(original.cook_minutes) !== Number(revised.cook_minutes)) changes.push(`Cook ${original.cook_minutes}m → ${revised.cook_minutes}m`);
  if ((original.cuisine || '') !== (revised.cuisine || '')) changes.push(`Cuisine ${original.cuisine || 'none'} → ${revised.cuisine || 'none'}`);
  if ((original.difficulty || '') !== (revised.difficulty || '')) changes.push(`Difficulty ${original.difficulty} → ${revised.difficulty}`);
  if (JSON.stringify(original.categories || []) !== JSON.stringify(revised.categories || [])) changes.push('Categories changed');

  const before = dh12IngredientMap(original);
  const after = dh12IngredientMap(revised);
  const added = [...after.keys()].filter((name) => !before.has(name));
  const removed = [...before.keys()].filter((name) => !after.has(name));
  if (added.length) changes.push(`Added ${added.map((name) => after.get(name).name).join(', ')}`);
  if (removed.length) changes.push(`Removed ${removed.map((name) => before.get(name).name).join(', ')}`);
  let quantityChanges = 0;
  for (const [name, item] of after.entries()) {
    if (!before.has(name)) continue;
    const old = before.get(name);
    if (dh12Number(old.quantity) !== dh12Number(item.quantity) || (old.unit || '') !== (item.unit || '')) quantityChanges += 1;
  }
  if (quantityChanges) changes.push(`${quantityChanges} ingredient ${quantityChanges === 1 ? 'amount' : 'amounts'} changed`);
  const originalSteps = (original.steps || []).map((step) => step.instruction);
  const revisedSteps = (revised.steps || []).map((step) => step.instruction);
  if (JSON.stringify(originalSteps) !== JSON.stringify(revisedSteps)) changes.push('Cooking method changed');
  return changes.length ? changes : ['No material changes detected'];
};

const dh12MealPayload = (meal, draft, nameOverride = null, variation = false) => ({
  name: nameOverride || draft.name,
  description: draft.description || null,
  main_protein: null,
  category: (draft.categories || []).length ? draft.categories.join(', ') : null,
  cuisine: draft.cuisine || null,
  prep_minutes: Number(draft.prep_minutes || 0),
  cook_minutes: Number(draft.cook_minutes || 0),
  servings: Number(draft.servings || 4),
  difficulty: draft.difficulty || 'easy',
  instructions: (draft.steps || []).map((step) => step.instruction),
  dietary_tags: meal.dietary_tags || [],
  allergens: meal.allergens || [],
  substitutions: meal.substitutions || [],
  notes: variation ? `AI variation of ${meal.name}` : (meal.notes || null),
  image_url: meal.image_url || null,
  source_url: meal.source_url || null,
  favourite: variation ? false : Boolean(meal.favourite),
  household_rating: variation ? null : (meal.household_rating ?? null),
  ingredients: draft.ingredients || [],
  active: true
});

const dh12Close = () => document.querySelector('.dh12-backdrop')?.remove();

const dh12SetBusy = (modal, busy, message = '') => {
  modal.classList.toggle('busy', busy);
  modal.querySelectorAll('button, textarea, input').forEach((element) => { element.disabled = busy; });
  const status = modal.querySelector('.dh12-status');
  if (status && message) status.textContent = message;
};

const dh12Render = (modal) => {
  const original = modal._dh12Original;
  const current = modal._dh12Current;
  const comparison = modal.querySelector('.dh12-comparison');
  if (!original || !current || !comparison) return;
  comparison.innerHTML = `${dh12DraftCard(original, 'CURRENT RECIPE', 'original')}${dh12DraftCard(current, 'AI VERSION', 'revised')}`;
  const changes = dh12Changes(original, current);
  modal.querySelector('.dh12-change-list').innerHTML = changes.map((change) => `<span>${dh12Esc(change)}</span>`).join('');
  modal.querySelector('.dh12-save-actions').hidden = false;
};

const dh12AddConversation = (modal, role, text) => {
  const list = modal.querySelector('.dh12-conversation');
  const row = document.createElement('div');
  row.className = `dh12-message ${role}`;
  row.innerHTML = `<strong>${role === 'user' ? 'You' : 'DinnerHub AI'}</strong><span>${dh12Esc(text)}</span>`;
  list.appendChild(row);
  list.scrollTop = list.scrollHeight;
};

const dh12ImproveModal = async (meal) => {
  dh12Close();
  const original = await dh12ToDraft(meal);
  const backdrop = document.createElement('div');
  backdrop.className = 'dh12-backdrop';
  backdrop.innerHTML = `<section class="dh12-modal" role="dialog" aria-modal="true">
    <div class="dh12-heading"><div><span>AI RECIPE ASSISTANT</span><h2>Improve ${dh12Esc(meal.name)}</h2><p>Ask for a change, compare it with the current recipe, then choose whether to update this recipe or save a new variation.</p></div><button type="button" class="dh12-close" aria-label="Close">×</button></div>
    <div class="dh12-quick">
      <button type="button" data-prompt="Make this recipe quicker to prepare and cook without losing its character">Make it quicker</button>
      <button type="button" data-prompt="Make this recipe healthier while keeping it satisfying and family friendly">Make it healthier</button>
      <button type="button" data-prompt="Make this recipe cheaper using practical supermarket ingredients">Make it cheaper</button>
      <button type="button" data-prompt="Make this recipe more kid friendly without making it bland">Kid friendly</button>
      <button type="button" data-prompt="Reduce the number of ingredients while preserving the main flavour">Fewer ingredients</button>
      <button type="button" data-prompt="Increase the flavour and seasoning while keeping the recipe balanced">More flavour</button>
    </div>
    <div class="dh12-chatbar"><textarea rows="2" class="dh12-prompt" placeholder="e.g. Replace the cream with something lighter and make it serve 6"></textarea><button type="button" class="primary dh12-send">Ask AI</button></div>
    <div class="dh12-status">The current recipe will not change until you explicitly save an AI version.</div>
    <div class="dh12-conversation"></div>
    <div class="dh12-change-summary"><strong>What changed</strong><div class="dh12-change-list"><span>No AI changes yet</span></div></div>
    <div class="dh12-comparison">${dh12DraftCard(original, 'CURRENT RECIPE', 'original')}<section class="dh12-awaiting"><strong>AI VERSION</strong><p>Ask DinnerHub AI to improve the recipe and the revised version will appear here.</p></section></div>
    <div class="dh12-save-actions" hidden><button type="button" class="dh12-revert">Reset AI changes</button><div><button type="button" class="dh12-variation">Save as new variation</button><button type="button" class="primary dh12-update">Update this recipe</button></div></div>
  </section>`;
  document.body.appendChild(backdrop);
  backdrop._dh12Original = original;
  backdrop._dh12Current = original;
  backdrop._dh12Meal = meal;

  backdrop.querySelector('.dh12-close').onclick = dh12Close;
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) dh12Close(); });
  backdrop.querySelectorAll('[data-prompt]').forEach((button) => {
    button.onclick = () => { backdrop.querySelector('.dh12-prompt').value = button.dataset.prompt || ''; backdrop.querySelector('.dh12-prompt').focus(); };
  });

  const refine = async () => {
    const prompt = backdrop.querySelector('.dh12-prompt').value.trim();
    if (!prompt) return;
    try {
      dh12SetBusy(backdrop, true, 'DinnerHub AI is revising the recipe…');
      dh12AddConversation(backdrop, 'user', prompt);
      const result = await dh12Api('ai/recipe/refine', { method: 'POST', body: JSON.stringify({ prompt, draft: backdrop._dh12Current }) });
      backdrop._dh12Current = result.draft;
      backdrop.querySelector('.dh12-prompt').value = '';
      dh12Render(backdrop);
      dh12AddConversation(backdrop, 'assistant', `Updated ${result.draft.name}. Review the comparison below or ask for another change.`);
      backdrop.querySelector('.dh12-status').textContent = 'AI version ready. Nothing has been saved yet.';
      backdrop.querySelector('.dh12-status').classList.remove('error');
    } catch (error) {
      backdrop.querySelector('.dh12-status').textContent = error.message;
      backdrop.querySelector('.dh12-status').classList.add('error');
    } finally { dh12SetBusy(backdrop, false); }
  };

  backdrop.querySelector('.dh12-send').onclick = refine;
  backdrop.querySelector('.dh12-prompt').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void refine(); }
  });
  backdrop.querySelector('.dh12-revert').onclick = () => {
    backdrop._dh12Current = backdrop._dh12Original;
    backdrop.querySelector('.dh12-conversation').innerHTML = '';
    backdrop.querySelector('.dh12-change-list').innerHTML = '<span>No AI changes yet</span>';
    backdrop.querySelector('.dh12-comparison').innerHTML = `${dh12DraftCard(original, 'CURRENT RECIPE', 'original')}<section class="dh12-awaiting"><strong>AI VERSION</strong><p>Ask DinnerHub AI to improve the recipe and the revised version will appear here.</p></section>`;
    backdrop.querySelector('.dh12-save-actions').hidden = true;
    backdrop.querySelector('.dh12-status').textContent = 'AI changes reset. The saved recipe was never modified.';
  };

  backdrop.querySelector('.dh12-update').onclick = async () => {
    try {
      dh12SetBusy(backdrop, true, 'Updating recipe…');
      const current = backdrop._dh12Current;
      await dh12Api(`meals/${meal.id}`, { method: 'PUT', body: JSON.stringify(dh12MealPayload(meal, current)) });
      if (current.steps?.length) await dh12Api(`meals/${meal.id}/steps`, { method: 'PUT', body: JSON.stringify(current.steps) });
      backdrop.querySelector('.dh12-status').textContent = `${current.name} has been updated. Household scores and meal-plan history remain attached to this recipe.`;
      window.setTimeout(() => window.location.reload(), 1100);
    } catch (error) {
      backdrop.querySelector('.dh12-status').textContent = error.message;
      backdrop.querySelector('.dh12-status').classList.add('error');
      dh12SetBusy(backdrop, false);
    }
  };

  backdrop.querySelector('.dh12-variation').onclick = async () => {
    const current = backdrop._dh12Current;
    const suggested = current.name === meal.name ? `${meal.name} - Variation` : current.name;
    const name = window.prompt('Name for the new recipe variation', suggested)?.trim();
    if (!name) return;
    try {
      dh12SetBusy(backdrop, true, 'Creating new recipe variation…');
      const created = await dh12Api('meals', { method: 'POST', body: JSON.stringify(dh12MealPayload(meal, current, name, true)) });
      if (current.steps?.length) await dh12Api(`meals/${created.id}/steps`, { method: 'PUT', body: JSON.stringify(current.steps) });
      backdrop.querySelector('.dh12-status').textContent = `${created.name} has been created as a separate recipe. The original was not changed.`;
      window.setTimeout(() => window.location.reload(), 1100);
    } catch (error) {
      backdrop.querySelector('.dh12-status').textContent = error.message;
      backdrop.querySelector('.dh12-status').classList.add('error');
      dh12SetBusy(backdrop, false);
    }
  };
};

const dh12FindMeal = async (name) => {
  const meals = await dh12Api('meals');
  return (meals || []).find((meal) => String(meal.name).trim().toLowerCase() === String(name).trim().toLowerCase()) || null;
};

const dh12InstallRecipeAction = () => {
  const modal = document.querySelector('.recipe-detail-modal');
  if (!modal || modal.querySelector('.dh12-improve-button')) return;
  const actions = modal.querySelector('.modal-actions.split-actions');
  const title = modal.querySelector('.modal-heading h2')?.textContent?.trim();
  if (!actions || !title) return;
  const primary = actions.querySelector(':scope > button.primary');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'secondary dh12-improve-button';
  button.innerHTML = '<span aria-hidden="true">✦</span> Improve with AI';
  button.onclick = async () => {
    button.disabled = true;
    const old = button.innerHTML;
    button.textContent = 'Opening AI…';
    try {
      const meal = await dh12FindMeal(title);
      if (!meal) throw new Error('DinnerHub could not identify this recipe.');
      await dh12ImproveModal(meal);
    } catch (error) {
      window.alert(error.message);
    } finally { button.disabled = false; button.innerHTML = old; }
  };
  if (primary) actions.insertBefore(button, primary); else actions.appendChild(button);
};

let dh12Applying = false;
const dh12Install = () => {
  if (dh12Applying) return;
  dh12Applying = true;
  try { dh12InstallRecipeAction(); } finally { dh12Applying = false; }
};
const dh12Observer = new MutationObserver(() => requestAnimationFrame(dh12Install));
dh12Install();
dh12Observer.observe(document.body, { childList: true, subtree: true });
