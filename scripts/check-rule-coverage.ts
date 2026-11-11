/**
 * Fails when a business rule in docs/01-product-spec.md has no test naming it.
 *
 *   node scripts/check-rule-coverage.ts            # BR-xx and R-xx (Phase 1 exit)
 *   node scripts/check-rule-coverage.ts --with-nf  # also NF-xx (Phase 4 exit)
 *
 * A rule counts as covered when its ID appears in the name of a describe/it/test
 * block in any test file (docs/03-engineering-standards.md §2.2).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const specPath = join(root, 'docs', '01-product-spec.md');
const testRoots = ['src', 'tests', 'scripts'] as const;
const testFilePattern = /\.(test|int\.test|ui\.test)\.tsx?$|\.spec\.ts$/;

// Rule IDs are defined in bold: **BR-13**, **R-02**, **NF-01**.
const definitionPattern = /\*\*((?:BR|R|NF)-\d{2})\*\*/g;
// Test names: describe('…'), it.each(...)('…'), test.skip("…") etc. First string argument only.
const testNamePattern = /\b(?:describe|it|test)(?:\.\w+)*(?:\([^)]*\))?\(\s*(['"`])((?:(?!\1).)*)\1/g;
const idPattern = /\b(?:BR|R|NF)-\d{2}\b/g;

export function definedRuleIds(spec: string, includeNonFunctional: boolean): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const match of spec.matchAll(definitionPattern)) {
    const id = match[1];
    if (id !== undefined && (includeNonFunctional || !id.startsWith('NF-'))) {
      ids.add(id);
    }
  }
  return ids;
}

export function ruleIdsInTestNames(source: string): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const nameMatch of source.matchAll(testNamePattern)) {
    const name = nameMatch[2] ?? '';
    for (const idMatch of name.matchAll(idPattern)) {
      ids.add(idMatch[0]);
    }
  }
  return ids;
}

function testFiles(): readonly string[] {
  return testRoots.flatMap((dir) => {
    const absolute = join(root, dir);
    try {
      return readdirSync(absolute, { recursive: true, encoding: 'utf8' })
        .filter((file) => testFilePattern.test(file) && !file.includes('node_modules'))
        .map((file) => join(absolute, file));
    } catch {
      return []; // folder does not exist yet
    }
  });
}

function main(): void {
  const includeNonFunctional = process.argv.includes('--with-nf');
  const defined = definedRuleIds(readFileSync(specPath, 'utf8'), includeNonFunctional);

  const covered = new Set<string>();
  for (const file of testFiles()) {
    for (const id of ruleIdsInTestNames(readFileSync(file, 'utf8'))) {
      covered.add(id);
    }
  }

  const missing = [...defined].filter((id) => !covered.has(id)).sort();
  const unknown = [...covered].filter((id) => !defined.has(id) && (includeNonFunctional || !id.startsWith('NF-'))).sort();

  console.log(`Rules defined: ${String(defined.size)} · covered: ${String(defined.size - missing.length)}`);
  if (unknown.length > 0) {
    console.log(`Tests reference IDs not in the spec: ${unknown.join(', ')}`);
  }
  if (missing.length > 0) {
    console.log(`Missing tests for: ${missing.join(', ')}`);
    process.exitCode = 1;
  }
  if (unknown.length > 0) {
    process.exitCode = 1;
  }
}

if (import.meta.main) {
  main();
}
