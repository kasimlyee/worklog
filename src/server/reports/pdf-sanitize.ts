/*
 * pdf-lib's standard Helvetica encodes WinAnsi (Windows-1252) only and throws on anything
 * else. Every string goes through here first (docs/02 §9): accents are dropped where that
 * yields an encodable letter, anything else becomes the fallback character.
 */

export const pdfFallbackCharacter = '?';

// Windows-1252 characters outside Latin-1, at 0x80–0x9F.
const cp1252Extras = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');

function isEncodable(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || cp1252Extras.has(char);
}

function sanitizeChar(char: string): string {
  if (isEncodable(char)) {
    return char;
  }
  if (/\s/u.test(char)) {
    return ' ';
  }
  // ő → o, ł stays unknown: strip combining marks and keep the result only if encodable.
  const stripped = char.normalize('NFKD').replace(/\p{M}/gu, '');
  return stripped !== '' && Array.from(stripped).every(isEncodable) ? stripped : pdfFallbackCharacter;
}

/** Any Unicode string → text Helvetica can draw. Never throws. */
export function sanitizeForPdf(text: string): string {
  let out = '';
  for (const char of text) {
    out += sanitizeChar(char);
  }
  return out;
}
