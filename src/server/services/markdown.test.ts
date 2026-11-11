import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown.ts';

describe('renderMarkdown', () => {
  it('renders ordinary Markdown', () => {
    expect(renderMarkdown('# Title\n\n- **one**\n- `two`')).toBe(
      '<h1>Title</h1>\n<ul>\n<li><strong>one</strong></li>\n<li><code>two</code></li>\n</ul>\n',
    );
  });

  it('BR-33: shows raw HTML as text — script tags', () => {
    const html = renderMarkdown('<script>alert(1)</script>');

    expect(html).not.toContain('<script');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('BR-33: shows raw HTML as text — attributes and inline tags', () => {
    const html = renderMarkdown('Hello <img src=x onerror="alert(1)"> and <a href="javascript:alert(1)">x</a>');

    expect(html).not.toMatch(/<img|<a /);
    expect(html).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  });

  it.each(['javascript:alert(1)', 'JAVASCRIPT:alert(1)', ' javascript:alert(1)', 'vbscript:x', 'data:text/html,<b>x</b>', 'file:///etc/passwd'])(
    'BR-34: does not link %s',
    (url) => {
      expect(renderMarkdown(`[click](${url})`)).not.toContain('<a');
    },
  );

  it('BR-34: links open in a new tab without the referrer', () => {
    expect(renderMarkdown('[docs](https://example.com/a?b=1)')).toBe(
      '<p><a href="https://example.com/a?b=1" target="_blank" rel="noopener noreferrer">docs</a></p>\n',
    );
  });

  it('BR-34: bare URLs are linked the same way', () => {
    expect(renderMarkdown('see https://example.com')).toContain('rel="noopener noreferrer"');
  });

  it('does not render images', () => {
    expect(renderMarkdown('![tracker](https://evil.example/pixel.png)')).not.toContain('<img');
  });

  it('escapes quotes in link text and titles', () => {
    expect(renderMarkdown('[a"b](https://x.example "t\\"i")')).not.toMatch(/title="t"i"/);
  });
});
