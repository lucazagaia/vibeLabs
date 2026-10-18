import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_ORCHESTRATOR_MODEL,
  DEFAULT_WORKER_MODEL,
  getChatModel,
  modelIdFor,
  NO_STREAM_TAG,
} from "./model.ts";

describe("model roles", () => {
  it("defaults to Nemotron Super VL and Lightning", () => {
    const previous = {
      orchestrator: process.env.NEBIUS_ORCHESTRATOR_MODEL,
      worker: process.env.NEBIUS_WORKER_MODEL,
      legacy: process.env.NEBIUS_MODEL,
    };
    delete process.env.NEBIUS_ORCHESTRATOR_MODEL;
    delete process.env.NEBIUS_WORKER_MODEL;
    delete process.env.NEBIUS_MODEL;
    try {
      assert.equal(modelIdFor("orchestrator"), DEFAULT_ORCHESTRATOR_MODEL);
      assert.equal(modelIdFor("worker"), DEFAULT_WORKER_MODEL);
    } finally {
      restore("NEBIUS_ORCHESTRATOR_MODEL", previous.orchestrator);
      restore("NEBIUS_WORKER_MODEL", previous.worker);
      restore("NEBIUS_MODEL", previous.legacy);
    }
  });

  it("lets NEBIUS_MODEL override only the orchestrator", () => {
    const previous = {
      orchestrator: process.env.NEBIUS_ORCHESTRATOR_MODEL,
      legacy: process.env.NEBIUS_MODEL,
    };
    delete process.env.NEBIUS_ORCHESTRATOR_MODEL;
    process.env.NEBIUS_MODEL = "legacy/orchestrator";
    try {
      assert.equal(modelIdFor("orchestrator"), "legacy/orchestrator");
      assert.equal(modelIdFor("worker"), DEFAULT_WORKER_MODEL);
    } finally {
      restore("NEBIUS_ORCHESTRATOR_MODEL", previous.orchestrator);
      restore("NEBIUS_MODEL", previous.legacy);
    }
  });

  it("never streams internal JSON output to the chat", () => {
    const previous = process.env.NEBIUS_API_KEY;
    process.env.NEBIUS_API_KEY = "test-key";
    try {
      for (const role of ["orchestrator", "worker"] as const) {
        const model = getChatModel(role);
        assert.equal(model.disableStreaming, true);
        assert.ok(model.tags?.includes(NO_STREAM_TAG));
      }
    } finally {
      restore("NEBIUS_API_KEY", previous);
    }
  });
});

function restore(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
