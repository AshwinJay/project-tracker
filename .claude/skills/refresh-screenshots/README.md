# Skill: refresh-screenshots

Recaptures `docs/screenshots/overview.png`, `timeline.png`, and `burndown.png`
from the live app using headless Chromium (Playwright).

Run this after any commit that visually changes the UI — new views, layout
shifts, colour changes, etc. — so the README stays accurate.

## When to use

- UI layout or theme changes land on main
- A new tab or view is added (add a screenshot block here too)
- README images look stale compared to the running app

## What it does

1. Opens `src/index.html` via `file://` in a 1400×900 headless browser
2. Screenshots the default Hill Chart view → `docs/screenshots/overview.png`
3. Clicks Timeline → `docs/screenshots/timeline.png`
4. Clicks Burndown → `docs/screenshots/burndown.png`
5. Prints paths of saved files

## Environment

```bash
export REPO=$(git rev-parse --show-toplevel)
export PATH="$HOME/Library/Application Support/Zed/node/node-v24.11.0-darwin-x64/bin:$PATH"
export PLAYWRIGHT_BROWSERS_PATH="$HOME/Library/Caches/ms-playwright"
```

## Script

```bash
REPO=$(git rev-parse --show-toplevel)
PATH="$HOME/Library/Application Support/Zed/node/node-v24.11.0-darwin-x64/bin:$PATH" \
PLAYWRIGHT_BROWSERS_PATH="$HOME/Library/Caches/ms-playwright" \
node - <<'EOF'
const { chromium } = require(require('path').join(process.env.REPO || '.', 'node_modules/playwright-core'));
const REPO = process.env.REPO || require('path').resolve('.');
const OUT  = REPO + '/docs/screenshots';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page    = await browser.newPage();
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('file://' + REPO + '/src/index.html');
  await page.waitForSelector('button', { timeout: 10000 });
  await page.waitForTimeout(800);

  await page.screenshot({ path: OUT + '/overview.png' });
  console.log('Saved: docs/screenshots/overview.png');

  for (const tab of await page.$$('button')) {
    if ((await tab.textContent()).includes('Timeline')) { await tab.click(); break; }
  }
  await page.waitForTimeout(600);
  await page.screenshot({ path: OUT + '/timeline.png' });
  console.log('Saved: docs/screenshots/timeline.png');

  for (const tab of await page.$$('button')) {
    if ((await tab.textContent()).includes('Burndown')) { await tab.click(); break; }
  }
  await page.waitForTimeout(600);
  await page.screenshot({ path: OUT + '/burndown.png' });
  console.log('Saved: docs/screenshots/burndown.png');

  await browser.close();
})();
EOF
```

## After running

Stage and commit the updated PNGs alongside whatever UI change triggered the refresh:

```bash
git add docs/screenshots/
git commit -m "docs: refresh screenshots"
```

If you added a new view, also add a new `![View](docs/screenshots/view.png)` block to README.md.
