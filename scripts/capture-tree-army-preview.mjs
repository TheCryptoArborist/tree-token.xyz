// Capture real play with public controls; no simulation overrides or staged entities.
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const { chromium } = await import(pathToFileURL(process.env.TREE_ARMY_BROWSER_MODULE).href);
const browser = await chromium.launch({headless:true});
const base = process.env.TREE_ARMY_TEST_BASE || 'http://127.0.0.1:8765';
await fs.mkdir('.netlify', {recursive:true});
try {
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  await page.goto(base + '/play/tree-army/test/');
  await page.waitForFunction(() => document.getElementById('asset-status').hidden);
  await page.locator('#next').click();
  await page.locator('#skip').click();
  await page.locator('[data-unit="oak"]').click();
  await page.keyboard.down('d');
  await page.waitForTimeout(1650);
  await page.keyboard.up('d');
  await page.locator('[data-unit="sprout"]').click();
  await page.waitForTimeout(6500);
  await page.evaluate(() => {
    const stream = document.getElementById('battle').captureStream(30);
    const recorder = new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:6000000});
    const parts=[];
    window.previewRecording = new Promise(resolve => {
      recorder.ondataavailable = e => parts.push(e.data);
      recorder.onstop = async () => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(new Blob(parts,{type:'video/webm'}));
        stream.getTracks().forEach(track=>track.stop());
      };
    });
    recorder.start();
    setTimeout(()=>recorder.stop(),10200);
  });
  await page.locator('[data-unit="archer"]').click();
  await page.waitForTimeout(1800);
  await page.locator('[data-unit="sprout"]').click();
  await page.waitForTimeout(2400);
  await page.locator('#blast').click();
  await page.locator('#battle').screenshot({path:'play/tree-army/preview-gameplay.jpg',type:'jpeg',quality:90});
  const video = await page.evaluate(() => window.previewRecording);
  await fs.writeFile('.netlify/tree-army-capture.webm',Buffer.from(video,'base64'));
  const result = spawnSync('ffmpeg',['-y','-i','.netlify/tree-army-capture.webm','-t','10','-vf','fps=30,scale=1100:470','-c:v','libx264','-crf','23','-pix_fmt','yuv420p','-movflags','+faststart','-an','play/tree-army/preview-gameplay.mp4'],{stdio:'pipe'});
  assert.equal(result.status,0,result.stderr.toString());
  const webm=spawnSync('ffmpeg',['-y','-i','.netlify/tree-army-capture.webm','-t','10','-vf','fps=30,scale=1100:470','-c:v','libvpx-vp9','-crf','34','-b:v','0','-an','play/tree-army/preview-gameplay.webm'],{stdio:'pipe'});
  assert.equal(webm.status,0,webm.stderr.toString());
  console.log('Captured ten seconds of actual gameplay; still captured during the same run.');
} finally { await browser.close(); }
