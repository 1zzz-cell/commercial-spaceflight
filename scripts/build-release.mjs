import { build } from 'vite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { BASE_TITLE, ROUTE_META } from '../src/components/routeMeta.js';

const configuredUrl = process.env.SITE_URL?.trim();
const origin = configuredUrl ? new URL(configuredUrl) : null;
if (origin && (!['https:', 'http:'].includes(origin.protocol) || origin.pathname !== '/'
  || origin.search || origin.hash || origin.username || origin.password)) {
  throw new Error('SITE_URL 必须是站点根地址，例如 https://space.your-domain.cn');
}

const escape = (value) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;')
  .replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const dist = resolve('dist');

await build();
const template = await readFile(resolve(dist, 'index.html'), 'utf8');
const pages = { ...ROUTE_META, '/home-v2': ROUTE_META['/'], '/404': { title: `页面未找到 · ${BASE_TITLE}` } };
const hidden = new Set(['/404', '/home-v1', '/home-v2']);

for (const [path, meta] of Object.entries(pages)) {
  const description = meta.description || ROUTE_META['/'].description;
  const content = template
    .replace(/<title>.*?<\/title>/, () => `<title>${escape(meta.title)}</title>`)
    .replace(/(<meta (?:name="description"|property="og:description") content=")[^"]*/, (_, tag) => tag + escape(description))
    .replace(/(<meta property="og:title" content=")[^"]*/, (_, tag) => tag + escape(meta.title))
    .replace('<!-- deployment-meta -->', hidden.has(path) ? '<meta name="robots" content="noindex" />'
      : origin ? `<link rel="canonical" href="${escape(new URL(path, origin).href)}" />` : '');
  const directory = path === '/404' ? dist : resolve(dist, `.${path}`);
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, path === '/404' ? '404.html' : 'index.html'), content);
}

if (origin) {
  const locations = Object.keys(ROUTE_META).filter((path) => !hidden.has(path))
    .map((path) => `  <url><loc>${escape(new URL(path, origin).href)}</loc></url>`).join('\n');
  await writeFile(resolve(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${locations}\n</urlset>\n`);
  await writeFile(resolve(dist, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${new URL('/sitemap.xml', origin).href}\n`);
}
