import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { domainLinks, sourceDomain } from "./links.ts";

describe("source links", () => {
  it("reduces a URL to its domain", () => {
    assert.equal(sourceDomain("https://www.reuters.com/business/x?y=1"), "reuters.com");
    assert.equal(sourceDomain("https://ir.knorr-bremse.com/report.pdf"), "ir.knorr-bremse.com");
    assert.equal(sourceDomain("not a url"), "not a url");
  });

  it("shows markdown and bare links as their domain", () => {
    assert.equal(
      domainLinks("Liquidity is 1.63 ([Valuation Measures](https://finance.yahoo.com/q/ks)). See https://www.reuters.com/a."),
      "Liquidity is 1.63 ([finance.yahoo.com](https://finance.yahoo.com/q/ks)). See [reuters.com](https://www.reuters.com/a).",
    );
  });

  it("leaves text without links alone", () => {
    assert.equal(domainLinks("No open red flags."), "No open red flags.");
  });
});
