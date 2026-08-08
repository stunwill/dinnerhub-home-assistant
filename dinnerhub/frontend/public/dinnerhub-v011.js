const dh11Api = async (path, options = {}) => {
  const response = await fetch(`api/${path}`, {
    ...options,
    headers: options.body instanceof FormData
      ? (options.headers || {})
      : { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.detail === 'string' ? body.detail : 'Request failed');
  return body;
};

const dh11Esc = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

const dh11LogoMarkup = () => `
  <svg class="dh-logo-image dh-inline-logo" viewBox="0 0 1500 460" role="img" aria-labelledby="dh11-logo-title dh11-logo-desc">
    <title id="dh11-logo-title">DinnerHub by Stu</title>
    <desc id="dh11-logo-desc">DinnerHub wordmark with a green fork and knife emblem.</desc>
    <defs>
      <linearGradient id="dh11-emblem" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#0a5b36"></stop><stop offset="1" stop-color="#16864c"></stop>
      </linearGradient>
      <linearGradient id="dh11-word" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#052f25"></stop><stop offset="1" stop-color="#014532"></stop>
      </linearGradient>
    </defs>
    <rect x="18" y="46" width="322" height="322" rx="92" fill="url(#dh11-emblem)"></rect>
    <g fill="#fff">
      <rect x="112" y="119" width="17" height="108" rx="8"></rect><rect x="137" y="119" width="17" height="108" rx="8"></rect>
      <rect x="162" y="119" width="17" height="108" rx="8"></rect><rect x="187" y="119" width="17" height="108" rx="8"></rect>
      <path d="M112 203c0 43 19 61 45 61s47-18 47-61h-18c0 28-9 40-29 40s-27-12-27-40z"></path>
      <rect x="148" y="242" width="23" height="83" rx="11"></rect>
      <path d="M246 123c-22 19-39 58-39 97 0 31 9 48 27 53v52c0 10 7 16 15 16 9 0 16-6 16-16V123c0-8-10-8-19 0z"></path>
    </g>
    <text x="405" y="255" font-family="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="198" font-weight="900" letter-spacing="-10" fill="url(#dh11-word)">DinnerHub</text>
    <text x="1075" y="356" font-family="Brush Script MT, Segoe Script, Snell Roundhand, cursive" font-size="112" font-style="italic" fill="#117343" transform="rotate(-3 1075 356)">by Stu</text>
  </svg>`;

const dh11FixLogo = () => {
  document.querySelectorAll('.dh-brand').forEach((brand) => {
    const current = brand.querySelector('.dh-inline-logo');
    if (current) return;
    brand.innerHTML = dh11LogoMarkup();
  });
};

const dh11IngredientLine = (item) => {
  const amount = [item.quantity ?? '', item.unit ?? ''].filter((value) => value !== '').join(' ').trim();
  return `<li>${amount ? `<strong>${dh11Esc(amount)}</strong> ` : ''}${dh11Esc(item.name)}${item.notes ? ` <small>(${dh11Esc(item.notes)})</small>` : ''}</li>`;
};

const dh11RenderDraft = (panel, draft) => {
  const preview = panel.querySelector('.dh11-preview');
  if (!preview) return;
  const ingredients = (draft.ingredients || []).map(dh11IngredientLine).join('');
  const steps = (draft.steps || []).map((step, index) => `
    <li><strong>${index + 1}.</strong> ${dh11Esc(step.instruction)}${step.timer_minutes ? ` <span class="dh11-timer">${Number(step.timer_minutes)} min</span>` : ''}</li>`).join('');
  const categories = Array.isArray(draft.categories) ? draft.categories.join(' · ') : '';
  const warnings = draft.warnings?.length
    ? `<div class="dh11-warning"><strong>AI notes</strong><ul>${draft.warnings.map((item) => `<li>${dh11Esc(item)}</li>`).join('')}</ul></div>`
    : '';

  preview.innerHTML = `
    <div class="dh11-recipe-heading">
      <div><span class="dh11-kicker">AI RECIPE DRAFT</span><h3>${dh11Esc(draft.name)}</h3></div>
      <div class="dh11-meta"><span>${Number(draft.prep_minutes || 0)}m prep</span><span>${Number(draft.cook_minutes || 0)}m cook</span><span>${dh11Esc(draft.servings || 4)} serves</span></div>
    </div>
    ${draft.description ? `<p class="dh11-description">${dh11Esc(draft.description)}</p>` : ''}
    <div class="dh11-tags">${categories ? `<span>${dh11Esc(categories)}</span>` : ''}${draft.cuisine ? `<span>${dh11Esc(draft.cuisine)}</span>` : ''}<span>${dh11Esc(draft.difficulty || 'easy')}</span></div>
    ${warnings}
    <div class="dh11-recipe-grid">
      <section><h4>Ingredients</h4><ul>${ingredients || '<li>No ingredients returned.</li>'}</ul></section>
      <section><h4>Method</h4><ol>${steps || '<li>No method returned.</li>'}</ol></section>
    </div>`;
};

const dh11SetBusy = (panel, busy, message = '') => {
  panel.classList.toggle('dh11-busy', busy);
  panel.querySelectorAll('button').forEach((button) => { button.disabled = busy; });
  const status = panel.querySelector('.dh11-status');
  if (status && message) status.textContent = message;
};

const dh11AddMessage = (panel, role, text) => {
  const conversation = panel.querySelector('.dh11-conversation');
  if (!conversation) return;
  const row = document.createElement('div');
  row.className = `dh11-message dh11-${role}`;
  row.innerHTML = `<strong>${role === 'user' ? 'You' : 'DinnerHub AI'}</strong><span>${dh11Esc(text)}</span>`;
  conversation.appendChild(row);
  conversation.scrollTop = conversation.scrollHeight;
};

const dh11CreateRecipe = async (panel) => {
  const draft = panel._dh11Draft;
  if (!draft) throw new Error('Generate a recipe first.');
  const payload = {
    name: draft.name,
    description: draft.description || null,
    main_protein: null,
    category: Array.isArray(draft.categories) && draft.categories.length ? draft.categories.join(', ') : null,
    cuisine: draft.cuisine || null,
    prep_minutes: Number(draft.prep_minutes || 0),
    cook_minutes: Number(draft.cook_minutes || 0),
    servings: Number(draft.servings || 4),
    difficulty: draft.difficulty || 'easy',
    instructions: (draft.steps || []).map((step) => step.instruction),
    dietary_tags: [],
    allergens: [],
    substitutions: [],
    notes: 'Created with DinnerHub AI',
    image_url: null,
    source_url: null,
    favourite: false,
    household_rating: null,
    ingredients: draft.ingredients || [],
    active: true
  };
  const created = await dh11Api('meals', { method: 'POST', body: JSON.stringify(payload) });
  if (draft.steps?.length) {
    await dh11Api(`meals/${created.id}/steps`, { method: 'PUT', body: JSON.stringify(draft.steps) });
  }
  return created;
};

const dh11InstallAiBuilder = () => {
  const form = document.querySelector('.recipe-form-modal');
  if (!form || form.querySelector('.dh11-ai-builder')) return;
  const heading = form.querySelector('.modal-heading h2');
  if (!heading || !/add a meal/i.test(heading.textContent || '')) return;

  const panel = document.createElement('section');
  panel.className = 'dh11-ai-builder';
  panel.innerHTML = `
    <button type="button" class="dh11-ai-toggle" aria-expanded="false">
      <span class="dh11-ai-icon">✦</span>
      <span><strong>Create recipe with AI</strong><small>Describe what you want, preview the recipe, then keep chatting to adjust it.</small></span>
      <span class="dh11-chevron">⌄</span>
    </button>
    <div class="dh11-ai-content" hidden>
      <label class="dh11-prompt-label"><span>What would you like to make?</span>
        <textarea class="dh11-prompt" rows="3" placeholder="I want a recipe for banana bread"></textarea>
      </label>
      <div class="dh11-suggestions" aria-label="Recipe prompt suggestions">
        <button type="button" data-prompt="I want a classic moist banana bread recipe">Banana bread</button>
        <button type="button" data-prompt="I want an easy family chicken curry with rice">Chicken curry</button>
        <button type="button" data-prompt="I want a quick weeknight pasta bake">Pasta bake</button>
        <button type="button" data-prompt="I want a healthy chicken taco bowl">Taco bowl</button>
      </div>
      <div class="dh11-primary-actions"><button type="button" class="primary dh11-generate">Generate recipe</button></div>
      <div class="dh11-status">Your configured OpenAI model will create a draft. Nothing is saved automatically.</div>
      <div class="dh11-conversation"></div>
      <div class="dh11-preview"></div>
      <div class="dh11-refine" hidden>
        <label><span>Ask DinnerHub AI to change the recipe</span>
          <textarea class="dh11-refine-prompt" rows="2" placeholder="Make it less sweet, use 3 bananas and scale it to 8 serves"></textarea>
        </label>
        <div class="dh11-refine-actions">
          <button type="button" class="dh11-send">Apply adjustment</button>
          <button type="button" class="dh11-reset">Start over</button>
          <button type="button" class="primary dh11-create">Create this recipe</button>
        </div>
      </div>
    </div>`;

  form.querySelector('.modal-heading').insertAdjacentElement('afterend', panel);

  const toggle = panel.querySelector('.dh11-ai-toggle');
  const content = panel.querySelector('.dh11-ai-content');
  toggle.onclick = () => {
    const open = content.hidden;
    content.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    panel.classList.toggle('open', open);
    if (open) panel.querySelector('.dh11-prompt')?.focus();
  };

  panel.querySelectorAll('[data-prompt]').forEach((button) => {
    button.onclick = () => {
      panel.querySelector('.dh11-prompt').value = button.dataset.prompt || '';
      panel.querySelector('.dh11-prompt').focus();
    };
  });

  panel.querySelector('.dh11-generate').onclick = async () => {
    const prompt = panel.querySelector('.dh11-prompt').value.trim();
    if (!prompt) {
      panel.querySelector('.dh11-status').textContent = 'Describe the recipe you want first.';
      return;
    }
    try {
      dh11SetBusy(panel, true, 'Creating recipe draft…');
      dh11AddMessage(panel, 'user', prompt);
      const result = await dh11Api('ai/recipe/generate', { method: 'POST', body: JSON.stringify({ prompt }) });
      panel._dh11Draft = result.draft;
      dh11RenderDraft(panel, result.draft);
      dh11AddMessage(panel, 'assistant', `I created ${result.draft.name}. You can ask me to change ingredients, quantities, servings, flavour, difficulty or method.`);
      panel.querySelector('.dh11-refine').hidden = false;
      panel.querySelector('.dh11-status').textContent = 'Review the draft below, or ask for an adjustment.';
    } catch (error) {
      panel.querySelector('.dh11-status').textContent = error.message;
      panel.querySelector('.dh11-status').classList.add('error');
    } finally {
      dh11SetBusy(panel, false);
    }
  };

  const refine = async () => {
    const prompt = panel.querySelector('.dh11-refine-prompt').value.trim();
    if (!prompt || !panel._dh11Draft) return;
    try {
      dh11SetBusy(panel, true, 'Applying your adjustment…');
      dh11AddMessage(panel, 'user', prompt);
      const result = await dh11Api('ai/recipe/refine', {
        method: 'POST',
        body: JSON.stringify({ prompt, draft: panel._dh11Draft })
      });
      panel._dh11Draft = result.draft;
      panel.querySelector('.dh11-refine-prompt').value = '';
      dh11RenderDraft(panel, result.draft);
      dh11AddMessage(panel, 'assistant', `Updated. ${result.draft.name} now reflects that change.`);
      panel.querySelector('.dh11-status').textContent = 'Updated. Keep refining, or create the recipe when you are happy with it.';
      panel.querySelector('.dh11-status').classList.remove('error');
    } catch (error) {
      panel.querySelector('.dh11-status').textContent = error.message;
      panel.querySelector('.dh11-status').classList.add('error');
    } finally {
      dh11SetBusy(panel, false);
    }
  };

  panel.querySelector('.dh11-send').onclick = refine;
  panel.querySelector('.dh11-refine-prompt').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void refine();
    }
  });

  panel.querySelector('.dh11-reset').onclick = () => {
    panel._dh11Draft = null;
    panel.querySelector('.dh11-prompt').value = '';
    panel.querySelector('.dh11-refine-prompt').value = '';
    panel.querySelector('.dh11-preview').innerHTML = '';
    panel.querySelector('.dh11-conversation').innerHTML = '';
    panel.querySelector('.dh11-refine').hidden = true;
    panel.querySelector('.dh11-status').textContent = 'Start with a new recipe idea.';
    panel.querySelector('.dh11-prompt').focus();
  };

  panel.querySelector('.dh11-create').onclick = async () => {
    try {
      dh11SetBusy(panel, true, 'Creating recipe in DinnerHub…');
      const created = await dh11CreateRecipe(panel);
      panel.querySelector('.dh11-status').textContent = `${created.name} has been added to DinnerHub.`;
      window.setTimeout(() => window.location.reload(), 900);
    } catch (error) {
      panel.querySelector('.dh11-status').textContent = error.message;
      panel.querySelector('.dh11-status').classList.add('error');
      dh11SetBusy(panel, false);
    }
  };
};

let dh11Applying = false;
const dh11Install = () => {
  if (dh11Applying) return;
  dh11Applying = true;
  try {
    dh11FixLogo();
    dh11InstallAiBuilder();
  } finally {
    dh11Applying = false;
  }
};

const dh11Observer = new MutationObserver(() => requestAnimationFrame(dh11Install));
dh11Install();
dh11Observer.observe(document.body, { childList: true, subtree: true });
