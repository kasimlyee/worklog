import { describe, expect, it } from 'vitest';
import { definedRuleIds, ruleIdsInTestNames } from './check-rule-coverage.ts';

describe('definedRuleIds', () => {
  const spec = '- **BR-01** dates\n- **R-02** same model\n| **NF-01** | fast |\nmentions BR-99 without bold';

  it('collects bold BR and R ids and skips NF ids by default', () => {
    expect([...definedRuleIds(spec, false)]).toEqual(['BR-01', 'R-02']);
  });

  it('includes NF ids when asked', () => {
    expect([...definedRuleIds(spec, true)]).toEqual(['BR-01', 'R-02', 'NF-01']);
  });
});

describe('ruleIdsInTestNames', () => {
  it('finds ids in describe, it and test names', () => {
    const source = [
      "describe('BR-13: overdue', () => {",
      '  it("R-06: PR groups come first", () => {});',
      '  test.skip(`BR-04 and BR-03 together`, () => {});',
      '});',
    ].join('\n');

    expect([...ruleIdsInTestNames(source)].sort()).toEqual(['BR-03', 'BR-04', 'BR-13', 'R-06']);
  });

  it('ignores ids that appear only in comments or code', () => {
    const source = "// BR-01 is handled elsewhere\nconst rule = 'BR-02';\nit('formats dates', () => {});";

    expect(ruleIdsInTestNames(source).size).toBe(0);
  });

  it('does not read R-xx out of a BR-xx id', () => {
    expect([...ruleIdsInTestNames("it('BR-10: plan item fields', () => {})")]).toEqual(['BR-10']);
  });
});
