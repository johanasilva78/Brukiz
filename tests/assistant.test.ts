import assert from "node:assert/strict";
import test from "node:test";
import { assistantHistory, readAssistantResponse } from "../src/lib/assistant.ts";

test("the greeting and a truncated assistant turn never start the API history", () => {
  const messages = [
    { role: "assistant" as const, content: "Hola" },
    { role: "user" as const, content: "Lista contactos" },
  ];
  assert.deepEqual(assistantHistory(messages), [messages[1]]);
  const long = [...messages, ...messages, ...messages, ...messages];
  assert.equal(assistantHistory(long)[0].role, "user");
  assert.ok(assistantHistory(long).length <= 6);
});

test("valid replies, records, and proposed actions can be rendered", async () => {
  for (const payload of [
    { reply: "Hola" },
    { reply: "Contactos", records: [{ id: "1", name: "Contacto", status: null }] },
    { reply: "Listo", saved: true },
    { reply: "Preparado", action: { kind: "create", resource: "contacts", data: { name: "Demo" } } },
    { reply: "Preparado", action: { kind: "update", resource: "tasks", id: "1", data: { title: "Demo" } } },
  ]) {
    assert.deepEqual(await readAssistantResponse(Response.json(payload)), payload);
  }
});

test("malformed success responses are rejected before they enter chat state", async () => {
  for (const payload of [
    null, [], {}, { message: "Error" }, { reply: null }, { reply: {} }, { reply: " " },
    { reply: "Hola", records: {} }, { reply: "Hola", records: [null] },
    { reply: "Hola", records: [{ id: "1", name: {} }] },
    { reply: "Hola", action: { kind: "create", resource: "contacts", data: null } },
    { reply: "Hola", action: { kind: "update", resource: "contacts", data: {} } },
    { reply: "Hola", action: { kind: "create", resource: "unknown", data: {} } },
  ]) {
    await assert.rejects(readAssistantResponse(Response.json(payload)), /incompleta o no válida/);
  }
});

test("API failures and non-JSON responses become readable chat errors", async () => {
  await assert.rejects(readAssistantResponse(Response.json({ message: "Bedrock no disponible" }, { status: 503 })), /Bedrock no disponible/);
  await assert.rejects(readAssistantResponse(Response.json(null, { status: 502 })), /502/);
  await assert.rejects(readAssistantResponse(new Response("<html>Error</html>", { status: 504 })), /504/);
});
