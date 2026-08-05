const EDIT_BUTTON_CLASS = 'recipe-card-edit';
const MODAL_ERROR_CLASS = 'recipe-form-inline-error';

function buttonWithText(root, text) {
  return Array.from(root.querySelectorAll('button')).find(
    (button) => button.textContent?.trim() === text
  );
}

function openRecipeEditor(card) {
  const viewButton = buttonWithText(card, 'View recipe');
  if (!viewButton) return;

  viewButton.click();
  let attempts = 0;
  const openEditor = window.setInterval(() => {
    attempts += 1;
    const detailModal = document.querySelector('.recipe-detail-modal');
    const editButton = detailModal ? buttonWithText(detailModal, 'Edit recipe') : null;
    if (editButton) {
      window.clearInterval(openEditor);
      editButton.click();
    } else if (attempts >= 20) {
      window.clearInterval(openEditor);
    }
  }, 50);
}

function addRecipeCardEditButtons() {
  document.querySelectorAll('.meal-card').forEach((card) => {
    if (card.querySelector(`.${EDIT_BUTTON_CLASS}`)) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = `${EDIT_BUTTON_CLASS} icon-button`;
    button.setAttribute('aria-label', 'Edit recipe');
    button.setAttribute('title', 'Edit recipe');
    button.textContent = '✎';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      openRecipeEditor(card);
    });
    card.appendChild(button);
  });
}

function showRecipeFormError() {
  const form = document.querySelector('.recipe-form-modal');
  const globalError = document.querySelector('.app-shell > .notice.error');

  document.querySelectorAll(`.${MODAL_ERROR_CLASS}`).forEach((notice) => notice.remove());

  if (!form || !globalError) {
    document.querySelectorAll('[data-hidden-for-recipe-form="true"]').forEach((notice) => {
      notice.style.display = '';
      notice.removeAttribute('data-hidden-for-recipe-form');
    });
    return;
  }

  const message = Array.from(globalError.childNodes)
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent || '')
    .join('')
    .trim() || globalError.textContent?.replace('×', '').trim();

  if (!message) return;

  const notice = document.createElement('div');
  notice.className = `notice error ${MODAL_ERROR_CLASS}`;
  notice.setAttribute('role', 'alert');
  notice.textContent = message;

  const heading = form.querySelector('.modal-heading');
  heading?.insertAdjacentElement('afterend', notice);
  globalError.style.display = 'none';
  globalError.setAttribute('data-hidden-for-recipe-form', 'true');
}

function enhanceRecipes() {
  addRecipeCardEditButtons();
  showRecipeFormError();
}

const observer = new MutationObserver(enhanceRecipes);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('DOMContentLoaded', enhanceRecipes);
enhanceRecipes();
