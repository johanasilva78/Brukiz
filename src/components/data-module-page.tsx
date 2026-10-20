"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, CircleHelp, FileText, Plus, Search, Trash2, X } from "lucide-react";
import { ModuleDefinition, ModuleField, modules, userFields } from "@/lib/ams-modules";
import { demoDataKey as localKey, demoFetch, getDemoAgency } from "@/lib/demo-agencies";

type DataRecord = Record<string, unknown> & {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  archived?: boolean;
};

type ReportSummary = {
  counts: Record<string, number>;
  generatedAt: string;
};

type ReferenceOption = { id: string; label: string };

const sampleContacts: DataRecord[] = [
  { id: "demo-contact-1", name: "María Fernanda López", email: "maria.lopez@email.com", phone: "+504 9988-1204", type: "cliente", status: "activo", company: "Particular" },
  { id: "demo-contact-2", name: "Carlos Eduardo Mejía", email: "carlos.mejia@email.com", phone: "+504 9876-2210", type: "prospecto", status: "seguimiento", company: "Particular" },
  { id: "demo-contact-3", name: "Inversiones del Valle", email: "contacto@inversionesvalle.com", phone: "+504 2234-8812", type: "cliente", status: "activo", company: "Empresa" },
  { id: "demo-contact-4", name: "Ana Lucía Rivera", email: "ana.rivera@email.com", phone: "+504 9901-4077", type: "asegurado", status: "activo", company: "Particular" },
];

const apiBaseUrl = process.env.NEXT_PUBLIC_BRUKIZ_API_URL?.replace(/\/+$/, "");

function defaultRecords(resource: string): DataRecord[] {
  return resource === "contacts" && getDemoAgency() === "demo" ? sampleContacts : [];
}

function displayValue(value: unknown) {
  if (value === undefined || value === null || value === "") return "—";
  return String(value).replaceAll("_", " ");
}

function fieldValue(field: ModuleField, value: unknown) {
  if (field.kind === "select" && field.options) {
    return field.options.find((option) => option.value === value)?.label ?? displayValue(value);
  }
  return displayValue(value);
}

function recordTitle(record: DataRecord) {
  return String(record.name ?? record.title ?? record.policyNumber ?? record.claimNumber ?? record.id);
}

export function DataModulePage({ section, search, setSearch, onToast }: {
  section: string;
  search: string;
  setSearch: (value: string) => void;
  onToast: (message: string) => void;
}) {
  const definition = modules[section];
  const [adminResource, setAdminResource] = useState("agencies");
  const resource = section === "Administración" ? adminResource : definition?.resource ?? "contacts";
  const [records, setRecords] = useState<DataRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<DataRecord | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [report, setReport] = useState<ReportSummary | null>(null);

  const currentDefinition: ModuleDefinition | undefined = useMemo(
    () => section === "Administración" && resource === "users"
      ? { ...definition!, resource: "users", title: "Usuarios de demostración", fields: userFields }
      : definition,
    [definition, resource, section],
  );
  const fields = currentDefinition?.fields ?? [];

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (apiBaseUrl) {
        const response = await demoFetch(`${apiBaseUrl}/v1/${resource}`);
        const result = await response.json();
        if (!response.ok) throw new Error(result.message ?? `La API respondió ${response.status}.`);
        if (!Array.isArray(result)) throw new Error("La API devolvió una respuesta inesperada.");
        setRecords(result as DataRecord[]);
      } else {
        const stored = window.localStorage.getItem(localKey(resource));
        if (stored) {
          const parsed: unknown = JSON.parse(stored);
          if (!Array.isArray(parsed)) throw new Error("Los datos locales guardados no tienen un formato válido.");
          setRecords(parsed as DataRecord[]);
        } else {
          const initial = defaultRecords(resource);
          setRecords(initial);
          window.localStorage.setItem(localKey(resource), JSON.stringify(initial));
        }
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron cargar los registros.");
    } finally {
      setLoading(false);
    }
  }, [resource]);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (apiBaseUrl) {
        const response = await demoFetch(`${apiBaseUrl}/v1/reports`);
        const result = await response.json();
        if (!response.ok) throw new Error(result.message ?? `La API respondió ${response.status}.`);
        setReport(result as ReportSummary);
      } else {
        const counts: Record<string, number> = {};
        for (const module of Object.values(modules)) {
          const stored = window.localStorage.getItem(localKey(module.resource));
          const rows = stored ? JSON.parse(stored) as DataRecord[] : defaultRecords(module.resource);
          counts[module.resource] = rows.filter((row) => !row.archived).length;
        }
        const users = window.localStorage.getItem(localKey("users"));
        counts.users = users ? (JSON.parse(users) as DataRecord[]).filter((row) => !row.archived).length : 0;
        setReport({ counts, generatedAt: new Date().toISOString() });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo generar el reporte.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (section === "Reportes") void loadReport();
    else void loadRecords();
  }, [loadRecords, loadReport, section]);

  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    const activeRecords = records.filter((record) => !record.archived);
    if (!term) return activeRecords;
    return activeRecords.filter((record) =>
      fields.some((field) => String(record[field.name] ?? "").toLocaleLowerCase().includes(term)),
    );
  }, [fields, records, search]);

  async function persist(method: "POST" | "PATCH" | "DELETE", item?: DataRecord, payload?: Record<string, unknown>) {
    setSaving(true);
    setError("");
    try {
      if (apiBaseUrl) {
        const path = `${apiBaseUrl}/v1/${resource}${item ? `/${encodeURIComponent(item.id)}` : ""}`;
        const response = await demoFetch(path, {
          method,
          headers: { "Content-Type": "application/json" },
          ...(payload ? { body: JSON.stringify(payload) } : {}),
        });
        if (!response.ok) {
          const result = await response.json().catch(() => ({}));
          throw new Error(result.message ?? `La API respondió ${response.status}.`);
        }
        if (method !== "DELETE") {
          const saved = await response.json() as DataRecord;
          setRecords((current) => method === "POST"
            ? [saved, ...current]
            : current.map((record) => record.id === saved.id ? saved : record));
        } else if (item) {
          setRecords((current) => current.filter((record) => record.id !== item.id));
        }
      } else if (method === "POST" && payload) {
        const created: DataRecord = {
          ...payload,
          id: crypto.randomUUID(),
          ...(resource === "contacts" && !payload.status ? { status: "nuevo" } : {}),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        const next = [created, ...records];
        setRecords(next);
        window.localStorage.setItem(localKey(resource), JSON.stringify(next));
      } else if (method === "PATCH" && item && payload) {
        const next = records.map((record) => record.id === item.id
          ? { ...record, ...payload, updatedAt: new Date().toISOString() }
          : record);
        setRecords(next);
        window.localStorage.setItem(localKey(resource), JSON.stringify(next));
      } else if (method === "DELETE" && item) {
        const next = records.filter((record) => record.id !== item.id);
        setRecords(next);
        window.localStorage.setItem(localKey(resource), JSON.stringify(next));
      }
      setModalOpen(false);
      setEditing(null);
      onToast(apiBaseUrl ? "Cambios guardados en DynamoDB." : "Cambios guardados en este navegador.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar el registro.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(record: DataRecord) {
    if (!window.confirm(`¿Archivar "${recordTitle(record)}"?`)) return;
    await persist("DELETE", record);
  }

  if (section === "Reportes") {
    const labels: Record<string, string> = {
      contacts: "Contactos", insurers: "Aseguradoras", products: "Productos",
      opportunities: "Oportunidades", quotes: "Cotizaciones", policies: "Pólizas",
      renewals: "Renovaciones", claims: "Siniestros", tasks: "Tareas",
      documents: "Documentos", agencies: "Agencias", users: "Usuarios",
    };
    return (
      <>
        <div className="page-heading module-heading"><div><div className="eyebrow">ANÁLISIS</div><h1>Reportes</h1><p>Resumen de registros activos por módulo.</p></div><button className="secondary-button" onClick={() => void loadReport()}>Actualizar</button></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {loading ? <section className="panel module-placeholder"><p>Cargando resumen…</p></section> : (
          <section className="metrics-grid" aria-label="Resumen por módulo">
            {Object.entries(report?.counts ?? {}).map(([key, count]) => (
              <div className="metric-card" key={key}><div className="metric-top"><span>{labels[key] ?? key}</span><span className="metric-icon blue"><FileText size={18} /></span></div><strong className="metric-amount">{count}</strong><div className="metric-bottom"><span>Registros activos</span></div></div>
            ))}
          </section>
        )}
        <p className="dashboard-footnote"><CircleHelp size={14} /> Los indicadores son operativos básicos; no incluyen primas emitidas ni cálculos financieros.</p>
      </>
    );
  }

  if (!currentDefinition) return null;

  return (
    <>
      <div className="page-heading module-heading">
        <div><div className="eyebrow">{currentDefinition.eyebrow}</div><h1>{currentDefinition.title}</h1><p>{currentDefinition.description}</p></div>
        <div className="contact-actions">
          {section === "Administración" && <button className="filter-button" onClick={() => setAdminResource(resource === "users" ? "agencies" : "users")}>{resource === "users" ? "Usuarios" : "Agencia"}</button>}
          <button className="primary-button" onClick={() => { setEditing(null); setModalOpen(true); }}><Plus size={17} /> Nuevo registro</button>
        </div>
      </div>
      <section className="panel contacts-panel">
        <div className="contacts-toolbar">
          <div><h2>{resource === "users" ? "Usuarios de demostración" : `Registros de ${currentDefinition.title.toLowerCase()}`}</h2><p>{apiBaseUrl ? "Datos conectados a la API." : "Modo demostración local en este navegador."}</p></div>
          <label className="table-search"><Search size={16} /><input aria-label={`Buscar ${currentDefinition.title}`} placeholder="Buscar..." value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {loading ? <div className="empty-row">Cargando registros…</div> : (
          <div className="table-scroll"><table className="contacts-table"><thead><tr>
            {fields.slice(0, 4).map((field) => <th key={field.name}>{field.label.toLocaleUpperCase()}</th>)}
            <th>ESTADO</th><th>ACCIONES</th>
          </tr></thead><tbody>
            {visible.map((record) => <tr key={record.id}>
              {fields.slice(0, 4).map((field) => <td key={field.name}>{fieldValue(field, record[field.name])}</td>)}
              <td>{displayValue(record.status)}</td>
              <td><div className="contact-actions"><button className="secondary-button" onClick={() => { setEditing(record); setModalOpen(true); }}>Editar</button><button className="row-more" aria-label={`Archivar ${recordTitle(record)}`} onClick={() => void remove(record)}><Trash2 size={16} /></button></div></td>
            </tr>)}
            {visible.length === 0 && <tr><td colSpan={fields.slice(0, 4).length + 2} className="empty-row">{records.length ? "No hay resultados para esa búsqueda." : "Aún no hay registros. Usa “Nuevo registro” para comenzar."}</td></tr>}
          </tbody></table></div>
        )}
        <div className="table-footer"><span>Mostrando <strong>{visible.length}</strong> registros activos</span></div>
      </section>
      <p className="dashboard-footnote"><CircleHelp size={14} />{resource === "documents" ? "Este módulo guarda metadatos; la carga de archivos a S3 es una integración pendiente." : apiBaseUrl ? "Los cambios se guardan en DynamoDB a través de Lambda." : "Los cambios se guardan localmente hasta configurar NEXT_PUBLIC_BRUKIZ_API_URL."}</p>
      {modalOpen && <RecordModal definition={currentDefinition} record={editing} saving={saving} onClose={() => { setModalOpen(false); setEditing(null); }} onSave={(data) => void persist(editing ? "PATCH" : "POST", editing ?? undefined, data)} />}
    </>
  );
}

function RecordModal({ definition, record, saving, onClose, onSave }: {
  definition: ModuleDefinition;
  record: DataRecord | null;
  saving: boolean;
  onClose: () => void;
  onSave: (data: Record<string, unknown>) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(definition.fields.map((field) => [field.name, record?.[field.name] == null ? "" : String(record[field.name])])),
  );
  const [references, setReferences] = useState<Record<string, ReferenceOption[]>>({});
  const [referenceError, setReferenceError] = useState("");

  useEffect(() => {
    async function loadReferences() {
      const referenceFields = definition.fields.filter((field) => field.referenceResource);
      if (!referenceFields.length) return;
      try {
        const next: Record<string, ReferenceOption[]> = {};
        for (const resource of new Set(referenceFields.map((field) => field.referenceResource!))) {
          let rows: DataRecord[];
          if (apiBaseUrl) {
            const response = await demoFetch(`${apiBaseUrl}/v1/${resource}`);
            const result = await response.json();
            if (!response.ok) throw new Error(result.message ?? `No se pudieron cargar las opciones (${response.status}).`);
            if (!Array.isArray(result)) throw new Error(`La respuesta para ${resource} no es válida.`);
            rows = result as DataRecord[];
          } else {
            const stored = window.localStorage.getItem(localKey(resource));
            const parsed: unknown = stored ? JSON.parse(stored) : defaultRecords(resource);
            if (!Array.isArray(parsed)) throw new Error(`Los datos locales de ${resource} no tienen un formato válido.`);
            rows = parsed as DataRecord[];
          }
          next[resource] = rows
            .filter((row) => !row.archived)
            .map((row) => ({ id: row.id, label: `${recordTitle(row)} · ${row.id.slice(0, 8)}` }));
        }
        setReferences(next);
      } catch (cause) {
        setReferenceError(cause instanceof Error ? cause.message : "No se pudieron cargar los registros relacionados.");
      }
    }
    void loadReferences();
  }, [definition]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload: Record<string, unknown> = {};
    for (const field of definition.fields) {
      const value = values[field.name]?.trim() ?? "";
      if (!value) continue;
      payload[field.name] = field.kind === "number" ? Number(value) : value;
    }
    onSave(payload);
  }

  function renderField(field: ModuleField) {
    const common = {
      id: field.name,
      name: field.name,
      required: field.required,
      value: values[field.name] ?? "",
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
        setValues((current) => ({ ...current, [field.name]: event.target.value })),
    };
    if (field.kind === "select") {
      const options = field.referenceResource
        ? (references[field.referenceResource] ?? []).map((option) => ({ value: option.id, label: option.label }))
        : field.options ?? [];
      return <select {...common}><option value="">Seleccionar…</option>{options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select>;
    }
    if (field.kind === "textarea") return <textarea {...common} rows={3} />;
    return <input {...common} type={field.kind ?? "text"} min={field.kind === "number" ? 0 : undefined} step={field.kind === "number" ? "0.01" : undefined} />;
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <form className="contact-modal" onSubmit={submit}>
        <div className="modal-header"><div><span className="eyebrow">{definition.eyebrow}</span><h2>{record ? "Editar registro" : "Nuevo registro"}</h2><p>Completa la información y guarda los cambios.</p></div><button className="modal-close" type="button" aria-label="Cerrar" onClick={onClose}><X size={19} /></button></div>
        <div className="record-form-grid">{definition.fields.map((field) => <label key={field.name} htmlFor={field.name}>{field.label}{renderField(field)}</label>)}</div>
        {referenceError && <p className="form-error" role="alert">{referenceError}</p>}
        <div className="modal-notice"><FileText size={16} /><span>Usa registros de prueba. No ingreses datos personales reales en el entorno de demostración.</span></div>
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose} disabled={saving}>Cancelar</button><button type="submit" className="primary-button" disabled={saving}><Plus size={16} />{saving ? "Guardando…" : record ? "Guardar cambios" : "Crear registro"}</button></div>
      </form>
    </div>
  );
}
