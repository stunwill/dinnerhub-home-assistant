import { chromium } from 'playwright';

const baseUrl = process.env.FOODHUB_TEST_URL || 'http://127.0.0.1:4173';
const widths = [320, 360, 375, 390, 393, 414, 430];

const dashboardPayload = {
  version: '0.14.3',
  today: null,
  tomorrow: null,
  upcoming: [],
  unplanned_days: 7,
  active_meals: 0,
};

const respondToApi = async (route) => {
  const url = new URL(route.request().url());
  const path = url.pathname.replace(/^\/api\/?/, '');

  if (path.startsWith('dashboard')) {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(dashboardPayload) });
    return;
  }
  if (path.startsWith('meals')) {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    return;
  }
  if (path.startsWith('meal-plan')) {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    return;
  }
  if (path.startsWith('settings')) {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        planning: { default_days: 7, repeat_warning_days: 14 },
        household: { default_servings: 4 },
        features: { shopping_list: true, meal_suggestions: true },
      }),
    });
    return;
  }
  if (path.startsWith('version')) {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ name: 'FoodHub', version: '0.14.3', slug: 'dinnerhub' }),
    });
    return;
  }

  await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
};

const assertLayoutFits = async (page, label) => {
  await page.waitForTimeout(200);
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

const clickVisibleButtonByText = async (page, text) => {
  const clicked = await page.evaluate((buttonText) => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const button = buttons.find((candidate) => {
      if ((candidate.textContent || '').trim() !== buttonText) return false;
      const style = getComputedStyle(candidate);
      const rect = candidate.getBoundingClientRect();
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        rect.width > 0 &&
        rect.height > 0
      );
    });
    if (!button) return false;
    button.click();
    return true;
  }, text);

  if (clicked) await page.waitForTimeout(150);
  return clicked;
};

const clickVisibleSelector = async (page, selector) => {
  const clicked = await page.evaluate((targetSelector) => {
    const element = document.querySelector(targetSelector);
    if (!element) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    if (style.display === 'none' || style.visibility === 'hidden' || !rect.width || !rect.height) return false;
    element.click();
    return true;
  }, selector);

  if (clicked) await page.waitForTimeout(150);
  return clicked;
};

const waitForVisibleSelector = async (page, selector, timeout = 5000) => {
  await page.waitForFunction(
    (targetSelector) => {
      const element = document.querySelector(targetSelector);
      if (!element) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    },
    selector,
    { timeout },
  );
};

const getWidthSnapshot = async (page, selector) =>
  page.evaluate((targetSelector) => {
    const target = document.querySelector(targetSelector);
    const shell = document.querySelector('.app-shell');
    if (!target || !shell) return null;

    const targetStyle = getComputedStyle(target);
    if (targetStyle.display === 'none' || targetStyle.visibility === 'hidden') return null;

    const targetRect = target.getBoundingClientRect();
    const shellRect = shell.getBoundingClientRect();
    if (!targetRect.width || !targetRect.height || !shellRect.width) return null;

    return {
      targetWidth: targetRect.width,
      shellWidth: shellRect.width,
    };
  }, selector);

const browser = await chromium.launch({ headless: true });
try {
  for (const width of widths) {
    console.log(`Testing FoodHub mobile layout at ${width}px`);
    const page = await browser.newPage({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });
    page.setDefaultTimeout(5000);
    page.setDefaultNavigationTimeout(10000);
    await page.route('**/api/**', respondToApi);

    try {
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await waitForVisibleSelector(page, '.app-shell');
      await assertLayoutFits(page, `${width}px Home`);

      if (await clickVisibleButtonByText(page, 'Add recipe')) {
        await waitForVisibleSelector(page, '.recipe-form-modal');
        await assertLayoutFits(page, `${width}px Add Recipe`);
        await clickVisibleSelector(page, '.recipe-form-modal .icon-button');
        await assertLayoutFits(page, `${width}px Home after Add Recipe`);
      }

      if (await clickVisibleButtonByText(page, 'Meal plan')) {
        await assertLayoutFits(page, `${width}px Meal Plan`);
        const guidedSnapshot = await getWidthSnapshot(page, '.dh-plan-builder');
        if (guidedSnapshot) {
          if (guidedSnapshot.targetWidth < guidedSnapshot.shellWidth * 0.9) {
            throw new Error(
              `${width}px Guided Planning collapsed to ${guidedSnapshot.targetWidth}px inside ${guidedSnapshot.shellWidth}px shell`,
            );
          }
          await assertLayoutFits(page, `${width}px Guided Planning`);
        }
      }

      if (await clickVisibleButtonByText(page, 'Meals')) {
        await assertLayoutFits(page, `${width}px Meals`);
        const discoverySnapshot = await getWidthSnapshot(page, '.planner-filter-panel');
        if (discoverySnapshot) {
          if (discoverySnapshot.targetWidth < discoverySnapshot.shellWidth * 0.9) {
            throw new Error(
              `${width}px Recipe Discovery collapsed to ${discoverySnapshot.targetWidth}px inside ${discoverySnapshot.shellWidth}px shell`,
            );
          }
          await assertLayoutFits(page, `${width}px Recipe Discovery`);
        }
      }

      console.log(`Passed FoodHub mobile layout at ${width}px`);
    } finally {
      await page.close();
    }
  }
  console.log(`FoodHub mobile browser layout passed at ${widths.join(', ')}px.`);
} finally {
  await browser.close();
}
