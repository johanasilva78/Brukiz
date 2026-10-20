"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Bot, Check, LoaderCircle, Send, ShieldAlert, Sparkles } from "lucide-react";
import { assistantHistory, readAssistantResponse, type AssistantAction as ProposedAction, type AssistantResponse } from "@/lib/assistant";
import { demoFetch } from "@/lib/demo-agencies";

type AssistantAction = ProposedAction & {
  status: "pending" | "saved";
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  action?: AssistantAction;
  records?: AssistantResponse["records"];
};

const apiBaseUrl = process.env.NEXT_PUBLIC_BRUKIZ_API_URL?.replace(/\/+$/, "");
const labels: Record<string, string> = {
  contacts: "Contactos",
  insurers: "Aseguradoras",
  products: "Productos",
  opportunities: "Oportunidades",
  quotes: "Cotizaciones",
  policies: "Pólizas",
  renewals: "Renovaciones",
  claims: "Siniestros",
  tasks: "Tareas",
  documents: "Documentos",
  agencies: "Agencias",
  users: "Usuarios",
};

function displayField(value: unknown) {
  if (typeof value === "string") return value.replaceAll("_", " ");
  if (typeof value === "number") return String(value);
  return "";
}

export function AiAssistant({ onToast }: { onToast: (message: string) => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([{
    role: "assistant",
    content: "Hola, soy el asistente de Brukiz. Puedo consultar registros, preparar cambios y resumir la actividad de tu agencia. ¿Qué necesitas?",
  }]);
  const [mode, setMode] = useState<"confirm" | "auto">("confirm");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const threadEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    threadEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    if (!apiBaseUrl) {
      setError("El asistente necesita que NEXT_PUBLIC_BRUKIZ_API_URL esté configurada.");
      return;
    }
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setDraft("");
    setBusy(true);
    setError("");
    try {
      const response = await demoFetch(`${apiBaseUrl}/v1/assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          messages: assistantHistory(nextMessages),
        }),
      });
      const result = await readAssistantResponse(response);
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: result.reply,
        ...(result.action ? { action: { ...result.action, status: "pending" } } : {}),
        ...(result.records ? { records: result.records } : {}),
      };
      setMessages((current) => [...current, assistantMessage]);
      if (result.saved) onToast("Acción ejecutada y guardada en DynamoDB.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo contactar al asistente.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmAction(messageIndex: number) {
    if (!apiBaseUrl || busy) return;
    const action = messages[messageIndex]?.action;
    if (!action || action.status !== "pending") return;
    setBusy(true);
    setError("");
    try {
      const url = `${apiBaseUrl}/v1/${action.resource}${action.kind === "update" && action.id ? `/${encodeURIComponent(action.id)}` : ""}`;
      const response = await demoFetch(url, {
        method: action.kind === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action.data),
      });
      const result = await response.json() as { message?: string; name?: string; title?: string };
      if (!response.ok) throw new Error(result.message ?? `La API respondió ${response.status}.`);
      const name = result.name ?? result.title ?? "el registro";
      setMessages((current) => current.map((message, index) => index === messageIndex
        ? { ...message, content: `${action.kind === "create" ? "Creé" : "Actualicé"} ${name} en ${labels[action.resource] ?? action.resource}.`, action: { ...action, status: "saved" } }
        : message));
      onToast("Cambios guardados en DynamoDB.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar la acción.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="ai-assistant-page">
      <header className="ai-heading">
        <div>
          <span className="eyebrow">INTELIGENCIA ARTIFICIAL</span>
          <h1>Asistente de Brukiz</h1>
          <p>Consulta y gestiona los registros de tu agencia usando lenguaje natural.</p>
        </div>
        <div className="ai-model-badge"><Sparkles size={15} /> Amazon Bedrock · Nova Micro</div>
      </header>

      <div className="ai-safety-notice"><ShieldAlert size={17} /><span>Demo pública: usa únicamente datos ficticios. No envíes información personal, pólizas reales, credenciales ni secretos.</span></div>

      <section className="panel ai-chat-panel" aria-label="Conversación con el asistente">
        <div className="ai-chat-header">
          <div className="ai-avatar"><Bot size={20} /></div>
          <div><strong>Asistente IA</strong><span>Herramientas limitadas a los módulos de Brukiz</span></div>
          <span className="ai-online"><i /> Listo</span>
        </div>
        <div className="ai-mode">
          <span>Acciones de escritura</span>
          <div role="group" aria-label="Modo de ejecución">
            <button type="button" className={mode === "confirm" ? "selected" : ""} onClick={() => setMode("confirm")}>Pedir confirmación</button>
            <button type="button" className={mode === "auto" ? "selected" : ""} onClick={() => setMode("auto")}>Ejecutar lo solicitado</button>
          </div>
        </div>

        <div className="ai-messages" aria-live="polite">
          {messages.map((message, index) => (
            <article className={`ai-message ${message.role}`} key={`${index}-${message.content.slice(0, 20)}`}>
              <div className="ai-message-avatar">{message.role === "assistant" ? <Sparkles size={15} /> : "AM"}</div>
              <div className="ai-message-body">
                <p>{message.content}</p>
                {message.records && message.records.length > 0 && (
                  <ul className="ai-record-list">{message.records.map((record) => <li key={record.id}><span>{record.name}</span><small>{record.status ?? "Activo"}</small></li>)}</ul>
                )}
                {message.action && (
                  <div className="ai-action-card">
                    <strong>{message.action.kind === "create" ? "Nuevo registro" : "Cambios propuestos"} · {labels[message.action.resource] ?? message.action.resource}</strong>
                    <dl>{Object.entries(message.action.data).map(([key, value]) => (
                      <div key={key}><dt>{key}</dt><dd>{displayField(value) || "—"}</dd></div>
                    ))}</dl>
                    {message.action.status === "pending"
                      ? <button type="button" className="primary-button" onClick={() => void confirmAction(index)} disabled={busy}><Check size={15} /> Confirmar y guardar</button>
                      : <span className="ai-saved"><Check size={14} /> Guardado</span>}
                  </div>
                )}
              </div>
            </article>
          ))}
          {busy && <div className="ai-thinking"><LoaderCircle size={16} /> Procesando solicitud…</div>}
          <div ref={threadEnd} />
        </div>

        {error && <p className="form-error ai-error" role="alert">{error}</p>}
        <form className="ai-composer" onSubmit={submit}>
          <textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={2} maxLength={1000} placeholder="Ej. Prepara una oportunidad para el contacto..." aria-label="Mensaje para el asistente" disabled={busy} />
          <div><span>Máximo 1000 caracteres · Verifica los datos antes de guardar</span><button className="primary-button" type="submit" disabled={busy || !draft.trim()}><Send size={15} /> Enviar</button></div>
        </form>
      </section>
    </section>
  );
}
