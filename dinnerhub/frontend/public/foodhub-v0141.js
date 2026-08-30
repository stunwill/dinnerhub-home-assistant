const fh141ReplaceVisibleBranding = (root = document) => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const parent = node.parentElement;
    if (!parent || parent.closest('script, style, code, pre')) continue;
    if (node.nodeValue?.includes('DinnerHub')) {
      node.nodeValue = node.nodeValue.replaceAll('DinnerHub', 'FoodHub');
    }
  }

  root.querySelectorAll?.('[aria-label], [alt], [title]').forEach((element) => {
    for (const attribute of ['aria-label', 'alt', 'title']) {
      const value = element.getAttribute(attribute);
      if (value?.includes('DinnerHub')) element.setAttribute(attribute, value.replaceAll('DinnerHub', 'FoodHub'));
    }
  });
};

let fh141BrandingScheduled = false;
const fh141ScheduleBranding = () => {
  if (fh141BrandingScheduled) return;
  fh141BrandingScheduled = true;
  requestAnimationFrame(() => {
    fh141BrandingScheduled = false;
    fh141ReplaceVisibleBranding(document);
  });
};

fh141ReplaceVisibleBranding(document);
new MutationObserver(fh141ScheduleBranding).observe(document.body, {
  childList: true,
  subtree: true,
  characterData: true,
});
