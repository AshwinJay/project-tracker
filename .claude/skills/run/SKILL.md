---
description: Launch and drive the project-tracker app in a headless Chromium browser using Playwright
---

# Run skill: project-tracker

This is a static single-file app — no build step, no server needed.
Entry point: `src/index.html`, opened via `file://` URL.

## Environment

```bash
export REPO=$(git rev-parse --show-toplevel)
export PATH="$HOME/Library/Application Support/Zed/node/node-v24.11.0-darwin-x64/bin:$PATH"
export PLAYWRIGHT_BROWSERS_PATH="$HOME/Library/Caches/ms-playwright"
```

## Launch and screenshot

Use the inline Node + Playwright script below. It opens the app, waits for React
to render, then screenshots. Adapt the `page.click` / `page.screenshot` calls for
whatever tab or interaction you need to verify.

```bash
REPO=$(git rev-parse --show-toplevel)
PATH="$HOME/Library/Application Support/Zed/node/node-v24.11.0-darwin-x64/bin:$PATH" \
PLAYWRIGHT_BROWSERS_PATH="$HOME/Library/Caches/ms-playwright" \
node - <<EOF
const { chromium } = require('$REPO/node_modules/playwright-core');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });

  const fileUrl = 'file://$REPO/src/index.html';
  await page.goto(fileUrl);

  // Wait for React to mount (the tab bar is the first reliable landmark)
  await page.waitForSelector('button', { timeout: 10000 });
  await page.waitForTimeout(500);

  // Screenshot the default view (Hill Chart tab)
  await page.screenshot({ path: '/tmp/pt-hill.png' });
  console.log('Screenshot: /tmp/pt-hill.png');

  await browser.close();
})();
EOF
```

## Navigate to a specific tab

Replace the screenshot block above with tab clicks before screenshotting:

```js
// Click the Burndown tab
const tabs = await page.$$('button');
for (const tab of tabs) {
  const text = await tab.textContent();
  if (text && text.includes('Burndown')) { await tab.click(); break; }
}
await page.waitForTimeout(300);
await page.screenshot({ path: '/tmp/pt-burndown.png' });
console.log('Screenshot: /tmp/pt-burndown.png');
```

## Notes

- `playwright-core` is already in `node_modules` (installed as a dev dep for tests).
- `PLAYWRIGHT_BROWSERS_PATH` must point to the Playwright cache; without it
  the binary lookup fails even though Chromium is installed.
- The app reads from `localStorage`. A fresh headless session starts empty
  (default demo data is loaded from the JS constants in `index.html`).
- No server is needed — `file://` access works fine for this app.
