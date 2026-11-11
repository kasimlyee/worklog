import 'server-only';
import MarkdownIt from 'markdown-it';

/*
 * BR-33: raw HTML is shown as text (html: false escapes it).
 * BR-34: links are http(s) or mailto only, open in a new tab without the referrer.
 * Images are disabled: the CSP blocks third-party images anyway, and they leak reads.
 */
const md = new MarkdownIt({ html: false, linkify: true, typographer: false, breaks: false });
md.disable(['image']);

const allowedLink = /^(https?:\/\/|mailto:)/i;
md.validateLink = (url: string): boolean => allowedLink.test(url.trim());

md.renderer.rules['link_open'] = (tokens, index, options, _env, self) => {
  const token = tokens[index];
  token?.attrSet('target', '_blank');
  token?.attrSet('rel', 'noopener noreferrer');
  return self.renderToken(tokens, index, options);
};

// Notes sit under the page's h1 and a section h2, so their headings start at h3 (WCAG 1.3.1).
const headingShift = 2;
for (const rule of ['heading_open', 'heading_close'] as const) {
  md.renderer.rules[rule] = (tokens, index, options, _env, self) => {
    const token = tokens[index];
    if (token !== undefined) {
      const level = Math.min(6, Number(token.tag.slice(1)) + headingShift);
      token.tag = `h${String(level)}`;
    }
    return self.renderToken(tokens, index, options);
  };
}

/** Safe HTML for a note. The only HTML the UI ever renders unescaped (docs/02 §11). */
export function renderMarkdown(source: string): string {
  return md.render(source);
}
