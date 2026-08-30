import { chromium } from 'playwright';

const baseUrl = process.env.FOODHUB_TEST_URL || 'http://127.0.0.1:4173';
const widths = [320, 360, 375, 390, 393, 414, 430];

const assertLayoutFits = async (page, label) => {
  await page.waitForTimeout(250);
  const result = await page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    const offenders = [];
    for (const element of document.body.querySelectorAll('*')) {
      const style = getComputedStyle(element);
      if (style.position === 'fixed' && style.display === 'none') continue;
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      if (rect.left < -1 || rect.right > viewport + 1) {
        offenders.push({
          tag: element.tagName.toLowerCase(),
          id: element.id,
          className: typeof element.className === 'string' ? element.className : '',
          left: Math.round(rect.left * 10) / 10,
          right: Math.round(rect.right * 10) / 10,
          width: Math.round(rect.width * 10) / 10,
        });
      }
      if (offenders.length >= 12) break;
    }
    return {
      viewport,
      htmlScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      scrollX: window.scrollX,
      offenders,
    };
  });

  const tooWide = result.htmlScrollWidth > result.viewport + 1 || result.bodyScrollWidth > result.viewport + 1;
  if (tooWide || result.scrollX !== 0 || result.offenders.length) {
    throw new Error(`${label} overflow: ${JSON.stringify(result, null, 2)}`);
  }
};

const clickIfVisible = async (page, text) => {
  const button = page.getByRole('button', { name: text, exact: true }).first();
  if (await button.count() && await button.isVisible()) {
    await button.evaluate((element) => element.click());
    await page.waitForTimeout(250);
    return true;
  }
  return false;
};

const clickLocatorIfPresent = async (locator) => {
  if (await locator.count() && await locator.isVisible()) {
    await locator.evaluate((element) => element.click());
    await locator.page().waitForTimeout(250);
    return true;
  }
  return false;
};

const browser = await chromium.launch({ headless: true });
try {
  for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await assertLayoutFits(page, `${width}px Home`);

    if (await clickIfVisible(page, 'Add recipe')) {
      await assertLayoutFits(page, `${width}px Add Recipe`);
      const close = page.locator('.recipe-form-modal .icon-button').first();
      await clickLocatorIfPresent(close);
      await assertLayoutFits(page, `${width}px Home after Add Recipe`);
    }

    if (await clickIfVisible(page, 'Meal plan')) {
      await assertLayoutFits(page, `${width}px Meal Plan`);
      const guided = page.locator('.dh-plan-builder').first();
      if (await guided.count() && await guided.isVisible()) {
        const rect = await guided.boundingBox();
        const shell = await page.locator('.app-shell').boundingBox();
        if (rect && shell && rect.width < shell.width * 0.9) {
          throw new Error(`${width}px Guided Planning collapsed to ${rect.width}px inside ${shell.width}px shell`);
        }
        await assertLayoutFits(page, `${width}px Guided Planning`);
      }
    }

    if (await clickIfVisible(page, 'Meals')) {
      await assertLayoutFits(page, `${width}px Meals`);
      const discovery = page.locator('.planner-filter-panel').first();
      if (await discovery.count() && await discovery.isVisible()) {
        const rect = await discovery.boundingBox();
        const shell = await page.locator('.app-shell').boundingBox();
        if (rect && shell && rect.width < shell.width * 0.9) {
          throw new Error(`${width}px Recipe Discovery collapsed to ${rect.width}px inside ${shell.width}px shell`);
        }
        await assertLayoutFits(page, `${width}px Recipe Discovery`);
      }
    }

    await page.close();
  }
  console.log(`FoodHub mobile browser layout passed at ${widths.join(', ')}px.`);
} finally {
  await browser.close();
}
