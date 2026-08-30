const fh142ViewportWidth = () => {
  const candidates = [
    window.visualViewport?.width,
    document.documentElement.clientWidth,
    window.innerWidth,
  ].filter((value) => Number.isFinite(value) && value > 0);
  return candidates.length ? Math.min(...candidates) : window.innerWidth;
};

const fh142ApplyViewportConstraint = () => {
  const width = fh142ViewportWidth();
  const root = document.documentElement;
  root.style.setProperty('--fh-usable-width', `${Math.ceil(width)}px`);

  const coarsePointer = window.matchMedia?.('(hover: none) and (pointer: coarse)').matches ?? false;
  const mobileWidth = width <= 760;
  const overflowing = root.scrollWidth > width + 2;
  const shouldConstrain = mobileWidth || (coarsePointer && width <= 900) || (coarsePointer && overflowing);

  root.classList.toggle('fh-mobile-constrained', shouldConstrain);

  if (shouldConstrain && window.scrollX !== 0) {
    window.scrollTo({ left: 0, top: window.scrollY, behavior: 'instant' });
  }
};

let fh142Scheduled = false;
const fh142ScheduleViewportConstraint = () => {
  if (fh142Scheduled) return;
  fh142Scheduled = true;
  requestAnimationFrame(() => {
    fh142Scheduled = false;
    fh142ApplyViewportConstraint();
  });
};

fh142ApplyViewportConstraint();
window.addEventListener('resize', fh142ScheduleViewportConstraint, { passive: true });
window.addEventListener('orientationchange', fh142ScheduleViewportConstraint, { passive: true });
window.visualViewport?.addEventListener('resize', fh142ScheduleViewportConstraint, { passive: true });
window.visualViewport?.addEventListener('scroll', fh142ScheduleViewportConstraint, { passive: true });

new MutationObserver(fh142ScheduleViewportConstraint).observe(document.body, {
  childList: true,
  subtree: true,
});

if ('ResizeObserver' in window) {
  new ResizeObserver(fh142ScheduleViewportConstraint).observe(document.getElementById('root'));
}
