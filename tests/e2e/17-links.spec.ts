import { expect, test } from './support/fixtures.ts';
import { seedEverything } from './support/rich-seed.ts';
import { fill, pageRoutes } from './support/routes.ts';

/* Every internal link on every page leads somewhere real: no 404s, no error pages. */

test('no broken internal links', async ({ signedIn: page, baseURL }) => {
  test.setTimeout(180_000);
  const ids = await seedEverything();
  const origin = baseURL ?? '';
  const pages = pageRoutes().filter((route) => route !== '/sign-in').map((route) => fill(route, ids));
  const links = new Map<string, string>(); // target → first page linking to it

  for (const path of pages) {
    await page.goto(path);
    const hrefs = await page.locator('a[href]').evaluateAll((anchors) => anchors.map((a) => a.getAttribute('href') ?? ''));
    for (const href of hrefs) {
      const url = new URL(href, `${origin}${path}`);
      const isInternal = url.origin === origin && !url.pathname.startsWith('/auth/') && href !== '#main' && !href.startsWith('#');
      if (isInternal && !links.has(url.pathname + url.search)) {
        links.set(url.pathname + url.search, path);
      }
    }
  }

  const broken: string[] = [];
  for (const [target, from] of links) {
    const response = await page.request.get(target, { maxRedirects: 0 });
    if (response.status() >= 400) {
      broken.push(`${String(response.status())} ${target} (linked from ${from})`);
    }
  }
  expect(links.size).toBeGreaterThan(30);
  expect(broken).toEqual([]);
});
