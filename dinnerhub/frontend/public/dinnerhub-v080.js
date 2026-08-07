const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const explicitQuantityBefore = (text, index) => {
  const before = text.slice(Math.max(0, index - 36), index).toLowerCase();
  return /(?:\d+(?:[.,]\d+)?|[¼½¾⅓⅔]|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:g|kg|mg|ml|l|tsp|tbsp|teaspoons?|tablespoons?|cups?|cloves?|slices?|pieces?|cans?|packets?)?\s*$/.test(before);
};

const ingredientRows = (modal) => Array.from(modal.querySelectorAll('.ingredient-list li'))
  .map((row) => ({
    name: row.querySelector('span')?.textContent?.trim() || '',
    quantity: row.querySelector('strong')?.textContent?.trim() || ''
  }))
  .filter((item) => item.name)
  .sort((a, b) => b.name.length - a.name.length);

const enrichInstruction = (instruction, ingredients) => {
  let output = instruction;
  for (const ingredient of ingredients) {
    if (!ingredient.quantity) continue;
    const pattern = new RegExp(`\\b${escapeRegex(ingredient.name)}\\b`, 'i');
    const match = pattern.exec(output);
    if (!match || explicitQuantityBefore(output, match.index)) continue;
    output = `${output.slice(0, match.index)}${ingredient.quantity} ${match[0]}${output.slice(match.index + match[0].length)}`;
  }
  return output;
};

const installCookingView = (modal) => {
  const methodHeading = Array.from(modal.querySelectorAll('.recipe-section h3')).find((heading) => heading.textContent?.trim() === 'Method');
  const methodSection = methodHeading?.closest('.recipe-section');
  const list = methodSection?.querySelector('.instruction-list');
  if (!methodSection || !list) return;

  methodSection.classList.add('dh-cooking-view');

  if (!methodSection.querySelector('.dh-cooking-note')) {
    const note = document.createElement('div');
    note.className = 'dh-cooking-note';
    note.innerHTML = '<strong>Cooking view</strong><span>Ingredient amounts are included in each step automatically and scale with the selected servings.</span>';
    methodHeading.insertAdjacentElement('afterend', note);
  }

  const ingredients = ingredientRows(modal);
  Array.from(list.querySelectorAll('li')).forEach((step, index) => {
    if (!step.dataset.dhRawInstruction) {
      step.dataset.dhRawInstruction = step.textContent?.trim() || '';
    }
    const raw = step.dataset.dhRawInstruction;
    const enriched = enrichInstruction(raw, ingredients);
    if (step.textContent !== enriched) step.textContent = enriched;
    step.dataset.stepNumber = String(index + 1);
    step.classList.toggle('dh-step-has-quantity', enriched !== raw);
  });

  if (!methodSection.querySelector('.dh-cooking-legend')) {
    const legend = document.createElement('small');
    legend.className = 'dh-cooking-legend';
    legend.textContent = 'Amounts are sourced from the recipe ingredient list. If an ingredient is not named in a step, DinnerHub leaves that step unchanged.';
    list.insertAdjacentElement('afterend', legend);
  }
};

let applying = false;
const enhance = () => {
  if (applying) return;
  applying = true;
  try {
    document.querySelectorAll('.recipe-detail-modal').forEach(installCookingView);
  } finally {
    applying = false;
  }
};

const observer = new MutationObserver(() => window.requestAnimationFrame(enhance));
const start = () => {
  enhance();
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
};

start();
