import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isValidJuryToken,
  passwordsMatch,
  signJuryToken,
  timingSafeEqualString,
} from "./auth";

describe("auth", () => {
  it("accepts the matching password", () => {
    process.env.JURY_PASSWORD = "secret-jury";
    assert.equal(passwordsMatch("secret-jury"), true);
    assert.equal(passwordsMatch("wrong"), false);
  });

  it("validates the signed cookie token", async () => {
    process.env.JURY_PASSWORD = "secret-jury";
    process.env.JURY_COOKIE_SECRET = "cookie-secret";
    const token = await signJuryToken("secret-jury");
    assert.equal(await isValidJuryToken(token), true);
    assert.equal(await isValidJuryToken("deadbeef"), false);
    assert.equal(await isValidJuryToken(null), false);
  });

  it("compares strings in constant-ish time", () => {
    assert.equal(timingSafeEqualString("abc", "abc"), true);
    assert.equal(timingSafeEqualString("abc", "abd"), false);
    assert.equal(timingSafeEqualString("ab", "abc"), false);
  });
});
