import assert from "node:assert/strict";
import test from "node:test";
import { demoDataKey, demoFetch, getDemoAgency, selectDemoAgency } from "../src/lib/demo-agencies.ts";

test("demo selection scopes storage and every API request without losing request options", async () => {
  const values = new Map<string, string>();
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    sessionStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) },
  } });
  const previousFetch = globalThis.fetch;
  try {
    assert.equal(getDemoAgency(), "demo");
    assert.equal(demoDataKey("contacts"), "brukiz-demo-data:contacts");
    selectDemoAgency("demo-norte");
    const northKey = demoDataKey("contacts");
    assert.equal(getDemoAgency(), "demo-norte");
    selectDemoAgency("demo-sur");
    assert.notEqual(demoDataKey("contacts"), northKey);
    assert.throws(() => selectDemoAgency("other-tenant"));
    globalThis.fetch = async (_input, init) => {
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("X-Demo-Agency"), "demo-sur");
      assert.equal(headers.get("Content-Type"), "application/json");
      assert.equal(init?.method, "POST");
      assert.equal(init?.body, '{"name":"Ficticio"}');
      return Response.json({ ok: true });
    };
    await demoFetch("https://example.test/v1/contacts", { method: "POST", headers: { "Content-Type": "application/json" }, body: '{"name":"Ficticio"}' });
    values.set("brukiz-demo-agency", "invalid");
    assert.equal(getDemoAgency(), "demo");
  } finally {
    globalThis.fetch = previousFetch;
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
