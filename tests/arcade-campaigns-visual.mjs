import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
const modulePath = process.env.ARCADE_PLAYWRIGHT_MODULE;
const output = process.env.ARCADE_LAYOUT_OUTPUT;
assert.ok(modulePath && output, 'Visual test needs browser module and output directory.');
const { chromium } = await import(modulePath);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [390, 1200]) {
    const page = await browser.newPage({ viewport: { width, height: 850 }, deviceScaleFactor: 1 });
    try {
      await page.goto('http://127.0.0.1:8765/play/#campaigns', { waitUntil: 'domcontentloaded' });
      await page.locator('.arcade-campaign-spotlight').waitFor();
      await page.waitForFunction(() => [...document.querySelectorAll('.arcade-campaign-spotlight-art,.arcade-campaign-next img')].every(img => img.complete && img.naturalWidth > 0));
      const result = await page.evaluate(() => {
        const panel = document.getElementById('growth-campaigns-panel');
        const [spot,next,rotation,pilot] = ['.arcade-campaign-spotlight','.arcade-campaign-next','.arcade-campaign-rotation','.arcade-campaign-technical'].map(s => panel?.querySelector(s));
        return {
          view: document.getElementById('arcade-daily-growth')?.dataset.arcadeView,
          panelVisible: panel && !panel.hidden,
          order: !!(spot && next && rotation && pilot && (spot.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING) && (next.compareDocumentPosition(rotation) & Node.DOCUMENT_POSITION_FOLLOWING) && (rotation.compareDocumentPosition(pilot) & Node.DOCUMENT_POSITION_FOLLOWING)),
          count: rotation?.querySelectorAll('ol > li').length,
          collapsed: !rotation?.open && !pilot?.open,
          overflow: document.documentElement.scrollWidth - window.innerWidth,
          spotlightHeight: spot?.getBoundingClientRect().height,
          eventLink: !!spot?.querySelector('a[href="#events"]'),
          noPrizeLabel: !!pilot?.textContent.includes('NO PRIZES'),
        };
      });
      assert.equal(result.view, 'campaigns'); assert.equal(result.panelVisible, true); assert.equal(result.order, true);
      assert.equal(result.count, 6); assert.equal(result.collapsed, true);
      assert.ok(result.overflow <= 1, 'Page overflow at ' + width + 'px: ' + result.overflow);
      assert.equal(result.eventLink, true); assert.equal(result.noPrizeLabel, true);
      if (width === 1200) assert.ok(result.spotlightHeight < 450, 'Desktop feature should not be excessively tall: ' + result.spotlightHeight);
      await page.screenshot({ path: join(output, 'campaigns-' + width + '.png'), fullPage: true });
      await page.locator('.arcade-campaign-rotation > summary').click();
      assert.equal(await page.locator('.arcade-campaign-rotation').evaluate(n => n.open), true);
      await page.screenshot({ path: join(output, 'campaigns-expanded-' + width + '.png'), fullPage: true });
      console.log(width + 'px: hierarchy, six game links, disclosures and width verified');
    } finally { await page.close(); }
  }
} finally { await browser.close(); }
