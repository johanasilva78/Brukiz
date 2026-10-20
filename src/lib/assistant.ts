export type AssistantAction = {
  kind: "create" | "update";
  resource: string;
  id?: string;
  data: Record<string, unknown>;
};

export type AssistantResponse = {
  reply: string;
  action?: AssistantAction;
  records?: { id: string; name: string; status?: string }[];
  saved?: boolean;
};

const resources = new Set([
  "contacts", "insurers", "products", "opportunities", "quotes", "policies",
  "renewals", "claims", "tasks", "documents", "agencies", "users",
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function assistantHistory(messages: { role: "user" | "assistant"; content: string }[]) {
  const recent = messages.slice(-6);
  // Nova requires the conversation to begin with a user, including after truncation.
  const firstUser = recent.findIndex((message) => message.role === "user");
  return firstUser < 0 ? [] : recent.slice(firstUser).map(({ role, content }) => ({ role, content }));
}

export async function readAssistantResponse(response: Response): Promise<AssistantResponse> {
  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new Error(`La API devolvió una respuesta no válida (HTTP ${response.status}). Inténtalo de nuevo.`);
  }
  if (!response.ok) {
    throw new Error(isObject(result) && typeof result.message === "string"
      ? result.message : `La API respondió ${response.status}. Inténtalo de nuevo.`);
  }

  const invalid = () => new Error("El asistente devolvió una respuesta incompleta o no válida. Inténtalo de nuevo.");
  if (!isObject(result) || typeof result.reply !== "string" || !result.reply.trim()) throw invalid();
  if (result.saved !== undefined && typeof result.saved !== "boolean") throw invalid();

  if (result.records !== undefined && (!Array.isArray(result.records) || !result.records.every((record: unknown) =>
    isObject(record) && typeof record.id === "string" && typeof record.name === "string"
      && (record.status == null || typeof record.status === "string")
  ))) throw invalid();

  if (result.action !== undefined) {
    const action = result.action;
    if (!isObject(action) || (action.kind !== "create" && action.kind !== "update")
      || typeof action.resource !== "string" || !resources.has(action.resource)
      || !isObject(action.data)
      || (action.kind === "update" && (typeof action.id !== "string" || !action.id.trim()))) throw invalid();
  }
  return result as AssistantResponse;
}
