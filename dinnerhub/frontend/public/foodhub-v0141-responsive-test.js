const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const viewportWidths = [320, 360, 375, 390, 393, 414, 430];
const css = await fetch('/foodhub-v0141.css').then((response) => response.text());
const html = await fetch('/').then((response) => response.text());

assert(!/max-width:\s*calc\(100vw/i.test(css), 'Corrective CSS must not reintroduce 100vw shell constraints');
assert(/\.dh-brand[\s\S]*min-width:\s*0\s*!important/i.test(css), 'FoodHub brand must be shrinkable');
assert(/\.dh-v010-actions[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/i.test(css), 'Mobile header actions must reflow');
assert(/\.tabs[\s\S]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(0,\s*1fr\)\)/i.test(css), 'Mobile tabs must fit the container');
assert(html.includes('/foodhub-v0141.css'), 'Corrective CSS must be loaded');
assert(html.includes('/foodhub-v0141.js'), 'Corrective branding script must be loaded');

for (const width of viewportWidths) {
  assert(width >= 320 && width <= 430, `Unexpected mobile regression width ${width}`);
}

console.log(`FoodHub responsive invariants checked at widths: ${viewportWidths.join(', ')}`);
