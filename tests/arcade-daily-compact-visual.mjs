import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
const { chromium } = await import(process.env.ARCADE_PLAYWRIGHT_MODULE);
const output = process.env.ARCADE_LAYOUT_OUTPUT;
await mkdir(output, { recursive:true });
const browser=await chromium.launch({headless:true});
try {
  for (const width of [390, 1200]) {
    const page=await browser.newPage({viewport:{width,height:850},deviceScaleFactor:1});
    try {
      await page.goto('http://127.0.0.1:8765/play/#daily',{waitUntil:'domcontentloaded'});
      await page.locator('#growth-today-panel > .growth-strip').waitFor();
      // Explicit, synthetic *presentation fixture*; no wallet sign-in or
      // API reward operation is performed or represented as a real success.
      await page.evaluate(()=>{
        const p=document.getElementById('growth-today-panel');
        p.setAttribute('data-arcade-checkin-saved','');
        const status=document.getElementById('growth-status');
        status.className='growth-status is-info';
        status.textContent='Attendance and Passport progress refreshed. Saved-run tracking checks all four games separately.';
        const wallet=document.getElementById('growth-wallet-identity');
        wallet.hidden=false;
        wallet.textContent='Signed in · TEST wallet · 0x0000…0000';
        document.getElementById('growth-invitation-title').textContent='Daily check-in';
        const check=document.getElementById('growth-check-in-row');
        check.hidden=false;check.disabled=true;check.textContent='Checked in ✓';
        const auth=document.getElementById('growth-task-auth');
        auth.hidden=true;
        document.getElementById('growth-check-in-state').textContent='Today’s attendance is saved.';
        const quest=document.getElementById('growth-quest-details');
        quest.classList.add('is-complete');
        document.getElementById('growth-game-name').textContent='Garden Bot';
        document.getElementById('growth-quest-state').textContent='1 / 1 · Quest complete ✓';
      });
      await page.waitForFunction(()=>document.getElementById('growth-status')?.hasAttribute('data-arcade-routine-refresh'));
      const metrics=await page.evaluate(()=>{
        const p=document.getElementById('growth-today-panel'), r=sel=>p.querySelector(sel)?.getBoundingClientRect().height;
        return {strip:r(':scope > .growth-strip'),check:r('#growth-check-in-task'),quest:r('#growth-quest-details'),status:getComputedStyle(document.getElementById('growth-status')).display,
          overflow:document.documentElement.scrollWidth-innerWidth,checkVisible:!!document.getElementById('growth-check-in-row'),nextVisible:!!p.querySelector('.guided-card')};
      });
      assert.equal(metrics.status,'none');
      assert.ok(metrics.strip<=145,'Header should be compact at '+width+': '+metrics.strip);
      assert.ok(metrics.check<=145,'Saved attendance row should be compact at '+width+': '+metrics.check);
      assert.ok(metrics.quest<=145,'Quest summary should be compact at '+width+': '+metrics.quest);
      assert.ok(metrics.overflow<=1,'No horizontal overflow at '+width+': '+metrics.overflow);
      assert.ok(metrics.checkVisible && metrics.nextVisible);
      await page.locator('#growth-today-panel').screenshot({path:join(output,'daily-compact-synthetic-'+width+'.png')});
      // Error state must still be visible when saved attendance is known.
      await page.evaluate(()=>{
        const status=document.getElementById('growth-status');
        status.className='growth-status is-error';
        status.textContent='Connection lost. Retry to refresh.';
      });
      await page.waitForFunction(()=>!document.getElementById('growth-status').hasAttribute('data-arcade-routine-refresh'));
      assert.notEqual(await page.locator('#growth-status').evaluate(n=>getComputedStyle(n).display),'none');
      console.log('Daily synthetic layout '+width+'px passed:',metrics);
    }finally{await page.close();}
  }
}finally{await browser.close();}
