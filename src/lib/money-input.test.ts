import { describe, expect, it } from "vitest";

import {
  countDigitsBefore,
  formatMoneyInput,
  offsetAfterDigits,
  parseRupeesToPaise,
} from "./money";

describe("live money input formatting", () => {
  it("groups Indian-style as digits are typed", () => {
    const typed = ["1", "12", "125", "1250", "12500", "125000", "1250000"];
    expect(typed.map(formatMoneyInput)).toEqual([
      "1",
      "12",
      "125",
      "1,250",
      "12,500",
      "1,25,000",
      "12,50,000",
    ]);
  });

  it("keeps a decimal point mid-typing so the caret does not jump", () => {
    expect(formatMoneyInput("10000.")).toBe("10,000.");
    expect(formatMoneyInput("10000.5")).toBe("10,000.5");
    expect(formatMoneyInput("10000.50")).toBe("10,000.50");
  });

  it("ignores stray characters and a second decimal point", () => {
    expect(formatMoneyInput("₹1,25,000")).toBe("1,25,000");
    expect(formatMoneyInput("12a3b4")).toBe("1,234");
    expect(formatMoneyInput("100.5.7")).toBe("100.57");
  });

  it("caps the fraction at two places", () => {
    expect(formatMoneyInput("99.999")).toBe("99.99");
  });

  it("strips leading zeros but allows a bare 0.", () => {
    expect(formatMoneyInput("007")).toBe("7");
    expect(formatMoneyInput("0.5")).toBe("0.5");
    expect(formatMoneyInput("")).toBe("");
  });

  it("always produces something the parser accepts", () => {
    for (const raw of ["125000", "1,25,000", "0.5", "99.99", "12,50,000.05"]) {
      const formatted = formatMoneyInput(raw);
      expect(() => parseRupeesToPaise(formatted)).not.toThrow();
    }
    expect(parseRupeesToPaise(formatMoneyInput("125000"))).toBe(12_500_000n);
  });

  it("anchors the caret to digits, not to separators", () => {
    // "12,500" with the caret after "12," is 2 digits in.
    expect(countDigitsBefore("12,500", 3)).toBe(2);
    // Reinsert after the 2nd digit of the regrouped "1,25,000" -> index 3.
    expect(offsetAfterDigits("1,25,000", 2)).toBe(3);
    expect(offsetAfterDigits("1,25,000", 0)).toBe(0);
    expect(offsetAfterDigits("1,25,000", 99)).toBe(8);
  });
});
