const dh13SetVisualViewport = () => {
  const height = window.visualViewport?.height || window.innerHeight;
  document.documentElement.style.setProperty('--dh-visual-height', `${Math.round(height)}px`);
};

const dh13RecoverPageState = () => {
  const hasModal = Boolean(document.querySelector('.modal-backdrop'));
  document.documentElement.classList.toggle('dh13-modal-open', hasModal);

  if (!hasModal) {
    // Defensive cleanup for stale inline scroll locks left behind by a closed
    // overlay or interrupted Home Assistant WebView navigation.
    ['overflow', 'position', 'height', 'touchAction'].forEach((property) => {
      if (document.body.style[property]) document.body.style[property] = '';
    });
  }
};

const dh13EnsureFocusedFieldVisible = (target) => {
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) return;
  if (!target.closest('.recipe-form-modal')) return;

  window.setTimeout(() => {
    const viewportHeight = window.visualViewport?.height || window.innerHeight;
    const rect = target.getBoundingClientRect();
    const topGuard = 88;
    const bottomGuard = 110;
    if (rect.top < topGuard || rect.bottom > viewportHeight - bottomGuard) {
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

const dh13Observer = new MutationObserver(() => {
  requestAnimationFrame(() => {
    dh13SetVisualViewport();
    dh13RecoverPageState();
  });
});

dh13Observer.observe(document.body, { childList: true, subtree: true });

// When the Home Assistant companion app backgrounds and foregrounds the page,
// refresh the visual viewport immediately so a previously-open keyboard cannot
// leave the modal sized to a stale viewport.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) window.setTimeout(dh13Install, 50);
});
