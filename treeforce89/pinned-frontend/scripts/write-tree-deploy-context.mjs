import {mkdirSync, writeFileSync} from 'node:fs';

// Server-only build metadata. Never copy environment values or DB URLs here.
const directory = new URL('../netlify/generated/', import.meta.url);
mkdirSync(directory, {recursive:true});
writeFileSync(new URL('tree-deploy-context.json', directory), JSON.stringify({
  context: process.env.CONTEXT || 'local',
  // Deploy Previews check out a pull-request ref; HEAD is the source branch.
  branch: process.env.HEAD || process.env.BRANCH || '',
  deployId: process.env.DEPLOY_ID || '',
}) + '\n');
