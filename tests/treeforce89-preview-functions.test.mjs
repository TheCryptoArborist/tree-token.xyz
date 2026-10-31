import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

const names=['tree-challenge','tree-session','tree-logout','tree-run','tree-continue-offer','tree-continue'];
const toml=readFileSync(new URL('../netlify.toml',import.meta.url),'utf8');

test('Netlify deploy previews use an isolated function directory',()=>{
 assert.match(toml,/\[context\.deploy-preview\.functions\]\s*directory = "netlify\/preview-functions"/);
 assert.match(toml,/\[functions\]\s*directory = "netlify\/functions"/);
});
for(const name of names){
 test(name+' preview handler fails closed and cannot forward wallet credentials',()=>{
  const path=new URL('../netlify/preview-functions/'+name+'.ts',import.meta.url);
  assert.equal(existsSync(path),true);
  const source=readFileSync(path,'utf8');
  assert.match(source,/status:503/);
  assert.match(source,/authorized:false/);
  assert.match(source,/enabled:false/);
  assert.doesNotMatch(source,/fetch\s*\(|signPersonalMessage|signAndExecute|DATABASE_URL|NETLIFY_DATABASE_URL|\.netlify\.app\/\.netlify\/functions/);
  assert.equal(existsSync(new URL('../netlify/functions/'+name+'.ts',import.meta.url)),false);
 });
}
