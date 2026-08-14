const DH13_DRAFT_KEY = 'dinnerhub:add-recipe-draft:v1';
let dh13SaveTimer = null;
let dh13PendingSuccessfulSave = false;

const dh13SetVisualViewport = () => {
  const height = window.visualViewport?.height || window.innerHeight;
  document.documentElement.style.setProperty('--dh-visual-height', `${Math.round(height)}px`);
};

const dh13IsAddRecipeForm = (form) => {
  if (!form?.matches?.('.recipe-form-modal')) return false;
  const heading = form.querySelector('.modal-heading h2')?.textContent || '';
  return /add a meal|add recipe/i.test(heading);
};

const dh13SetNativeValue = (element, value) => {
  const proto = element instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : element instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(element, value);
  else element.value = value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
};

const dh13CaptureDraft = (form) => {
  if (!dh13IsAddRecipeForm(form)) return;
  const fields = {};
  form.querySelectorAll('[name]').forEach((element) => {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)) return;
    if (element instanceof HTMLInputElement && (element.type === 'file' || element.type === 'submit' || element.type === 'button')) return;
    if (element instanceof HTMLInputElement && (element.type === 'checkbox' || element.type === 'radio')) fields[element.name] = element.checked;
    else fields[element.name] = element.value;
  });

  const ingredients = Array.from(form.querySelectorAll('.ingredient-row')).map((row) => {
    const inputs = row.querySelectorAll('input');
    return {
      name: inputs[0]?.value || '',
      quantity: inputs[1]?.value || '',
      unit: inputs[2]?.value || ''
    };
  }).filter((item) => item.name || item.quantity || item.unit);

  const categories = Array.from(form.querySelectorAll('.token-field .token'))
    .map((token) => (token.textContent || '').replace('×', '').trim())
    .filter(Boolean);

  const hasContent = Object.values(fields).some((value) => String(value || '').trim()) || ingredients.length || categories.length;
  if (!hasContent) return;

  localStorage.setItem(DH13_DRAFT_KEY, JSON.stringify({ savedAt: Date.now(), fields, ingredients, categories }));
  const indicator = form.querySelector('.dh13-draft-saved');
  if (indicator) indicator.textContent = 'Draft saved';
};

const dh13ScheduleDraftSave = (form) => {
  window.clearTimeout(dh13SaveTimer);
  const indicator = form.querySelector('.dh13-draft-saved');
  if (indicator) indicator.textContent = 'Saving draft…';
  dh13SaveTimer = window.setTimeout(() => dh13CaptureDraft(form), 350);
};

const dh13RestoreDraft = async (form, draft) => {
  Object.entries(draft.fields || {}).forEach(([name, value]) => {
    const element = form.querySelector(`[name="${CSS.escape(name)}"]`);
    if (!element) return;
    if (element instanceof HTMLInputElement && (element.type === 'checkbox' || element.type === 'radio')) {
      element.checked = Boolean(value);
      element.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
      dh13SetNativeValue(element, String(value ?? ''));
    }
  });

  const categoryInput = form.querySelector('.token-list input');
  if (categoryInput instanceof HTMLInputElement) {
    for (const category of draft.categories || []) {
      dh13SetNativeValue(categoryInput, category);
      categoryInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }

  const addIngredient = Array.from(form.querySelectorAll('button')).find((button) => /add ingredient/i.test(button.textContent || ''));
  while (form.querySelectorAll('.ingredient-row').length < (draft.ingredients || []).length && addIngredient) {
    addIngredient.click();
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  Array.from(form.querySelectorAll('.ingredient-row')).forEach((row, index) => {
    const saved = draft.ingredients?.[index];
    if (!saved) return;
    const inputs = row.querySelectorAll('input');
    if (inputs[0]) dh13SetNativeValue(inputs[0], saved.name || '');
    if (inputs[1]) dh13SetNativeValue(inputs[1], saved.quantity || '');
    if (inputs[2]) dh13SetNativeValue(inputs[2], saved.unit || '');
  });

  dh13ScheduleDraftSave(form);
};

const dh13InstallDraftRecovery = (form) => {
  if (!dh13IsAddRecipeForm(form) || form.dataset.dh13DraftInstalled === 'true') return;
  form.dataset.dh13DraftInstalled = 'true';

  form.addEventListener('input', () => dh13ScheduleDraftSave(form));
  form.addEventListener('change', () => dh13ScheduleDraftSave(form));
  form.addEventListener('submit', () => { dh13PendingSuccessfulSave = true; });

  const saved = localStorage.getItem(DH13_DRAFT_KEY);
  let draft = null;
  try { draft = saved ? JSON.parse(saved) : null; } catch { draft = null; }

  const heading = form.querySelector('.modal-heading');
  if (draft && heading) {
    const banner = document.createElement('div');
    banner.className = 'dh13-draft-banner';
    const when = new Date(draft.savedAt || Date.now()).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
    banner.innerHTML = `<div><strong>Unfinished recipe found</strong><span>Saved ${when}. Meal image files must be selected again.</span></div><div><button type="button" class="secondary dh13-restore">Restore</button><button type="button" class="dh13-discard">Discard</button></div>`;
    heading.insertAdjacentElement('afterend', banner);
    banner.querySelector('.dh13-restore').onclick = async () => {
      await dh13RestoreDraft(form, draft);
      banner.remove();
    };
    banner.querySelector('.dh13-discard').onclick = () => {
      localStorage.removeItem(DH13_DRAFT_KEY);
      banner.remove();
    };
  }

  const actions = form.querySelector('.modal-actions');
  if (actions && !actions.querySelector('.dh13-draft-saved')) {
    const status = document.createElement('span');
    status.className = 'dh13-draft-saved';
    status.textContent = 'Draft protection on';
    actions.prepend(status);
  }
};

const dh13RecoverPageState = () => {
  const form = document.querySelector('.recipe-form-modal');
  const hasModal = Boolean(document.querySelector('.modal-backdrop'));
  document.documentElement.classList.toggle('dh13-modal-open', hasModal);
  if (form) dh13InstallDraftRecovery(form);

  if (!hasModal) {
    ['overflow', 'position', 'height', 'touchAction'].forEach((property) => {
      if (document.body.style[property]) document.body.style[property] = '';
    });
    if (dh13PendingSuccessfulSave) {
      localStorage.removeItem(DH13_DRAFT_KEY);
      dh13PendingSuccessfulSave = false;
    }
  }
};

const dh13EnsureFocusedFieldVisible = (target) => {
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) return;
  if (!target.closest('.recipe-form-modal')) return;
  window.setTimeout(() => {
    const viewportHeight = window.visualViewport?.height || window.innerHeight;
    const rect = target.getBoundingClientRect();
    if (rect.top < 88 || rect.bottom > viewportHeight - 110) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }
  }, 220);
};

const dh13Install = () => {
  dh13SetVisualViewport();
  dh13RecoverPageState();
};

dh13Install();
window.addEventListener('resize', dh13SetVisualViewport, { passive: true });
window.addEventListener('orientationchange', () => window.setTimeout(dh13SetVisualViewport, 150), { passive: true });
window.visualViewport?.addEventListener('resize', dh13SetVisualViewport, { passive: true });
window.visualViewport?.addEventListener('scroll', dh13SetVisualViewport, { passive: true });
document.addEventListener('focusin', (event) => dh13EnsureFocusedFieldVisible(event.target));

const dh13Observer = new MutationObserver(() => requestAnimationFrame(dh13Install));
dh13Observer.observe(document.body, { childList: true, subtree: true });

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) window.setTimeout(dh13Install, 50);
});
