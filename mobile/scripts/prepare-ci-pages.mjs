import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
// CI runs inside mobile/ in the public repository. Only generated app assets enter docs/.
const source = path.resolve('web-export');
const docs = path.resolve('../docs');
await fs.cp(source, docs, { recursive: true });
let html = await fs.readFile(path.join(docs, 'index.html'), 'utf8');
const entry = html.match(/_expo\/static\/js\/web\/entry-([a-f0-9]{32})\.js/);
if (!entry || !html.includes('/better/_expo/')) throw new Error('Missing /better/ production assets.');
const updater = await fs.readFile('scripts/web-updates.js', 'utf8');
const version = createHash('md5').update(entry[1] + updater).digest('hex');
html = html.replace('shrink-to-fit=no', 'shrink-to-fit=no, viewport-fit=cover').replace('</head>', `
<meta name="theme-color" content="#000000">
<meta name="better-build" content="${version}">
<script src="/better/better-updates.js?v=${version}" defer></script>
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="better.">
<link rel="apple-touch-icon" href="/better/apple-touch-icon.png">
<link rel="icon" href="/better/icon-192.png">
<link rel="manifest" href="/better/manifest.webmanifest">
</head>`);
await fs.writeFile(path.join(docs, 'index.html'), html);
await fs.writeFile(path.join(docs, 'version.json'), JSON.stringify({ version, entry: entry[0] }));
await fs.writeFile(path.join(docs, 'better-updates.js'), updater);
for (const match of html.matchAll(/(?:src|href)="(\/better\/[^"#?]+)"/g)) await fs.access(path.join(docs, match[1].slice('/better/'.length)));
console.log(`Prepared ${version}: ${entry[0]}`);
