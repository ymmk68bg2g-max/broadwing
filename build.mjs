import { cp, readFile, writeFile } from 'node:fs/promises';

const source = new URL('./public/', import.meta.url);
const output = new URL('./dist/', import.meta.url);
const { VERCEL_ENV, VERCEL_URL, VERCEL_BRANCH_URL, VERCEL_PROJECT_PRODUCTION_URL } = process.env;
const deploymentHost = VERCEL_URL || VERCEL_BRANCH_URL;
const host = VERCEL_ENV === 'production'
  ? VERCEL_PROJECT_PRODUCTION_URL || deploymentHost
  : deploymentHost || VERCEL_PROJECT_PRODUCTION_URL;

await cp(source, output, { recursive: true });
if (host) {
  const index = new URL('index.html', output);
  const html = await readFile(index, 'utf8');
  const metadata = /(<meta\s+property="og:(?:url|image)"\s+content=")([^"]+)(")/gi;
  const origin = new URL(`https://${host}`).origin;
  const published = html.replace(metadata, (_, prefix, path, quote) =>
    prefix + new URL(path, origin).href + quote
  );
  await writeFile(index, published);
}
