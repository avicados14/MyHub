import { readdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

// Only shipped app files are cached. Private broker/API responses never enter this cache.
const files = ['index.html', 'manifest.webmanifest']
for (const directory of ['assets', 'icons']) {
  for (const file of await readdir(`dist/${directory}`)) files.push(`${directory}/${file}`)
}
files.sort()
const hash = createHash('sha256')
for (const file of files) hash.update(await readFile(`dist/${file}`))
const version = hash.digest('hex').slice(0, 20)
await writeFile(
  'dist/sw.js',
  `
const CACHE = 'myhub-shell-${version}';
const FILES = ${JSON.stringify(files)};
const URLS = FILES.map(file => new URL(file, self.registration.scope).href);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(URLS)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith('myhub-shell-') && key !== CACHE)
    .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  const index = new URL('index.html', scope).href;
  if (request.mode === 'navigate' && (url.pathname === scope.pathname || url.pathname === new URL(index).pathname)) {
    event.respondWith(fetch(request).catch(() => caches.open(CACHE).then(cache => cache.match(index))));
  } else if (URLS.includes(url.href)) {
    // Public build assets are invariant; preview servers can vary headers by Origin.
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(request, { ignoreVary: true })) || fetch(request)));
  }
});
`,
)
