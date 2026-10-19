export type FieldKind = "text" | "email" | "tel" | "number" | "date" | "select" | "textarea";

export type ModuleField = {
  name: string;
  label: string;
  kind?: FieldKind;
  required?: boolean;
  options?: { value: string; label: string }[];
  referenceResource?: string;
};

export type ModuleDefinition = {
  resource: string;
  eyebrow: string;
  title: string;
  description: string;
  fields: ModuleField[];
};

const choices = (values: string[]) => values.map((value) => ({
  value,
  label: value.replaceAll("_", " ").replace(/^\w/, (letter) => letter.toUpperCase()),
}));

export const modules: Record<string, ModuleDefinition> = {
  Contactos: {
    resource: "contacts",
    eyebrow: "RELACIONES Y CRM",
    title: "Contactos",
    description: "Administra clientes, prospectos y las relaciones de tu agencia.",
    fields: [
      { name: "name", label: "Nombre", required: true },
      { name: "email", label: "Correo", kind: "email" },
      { name: "phone", label: "Teléfono", kind: "tel" },
      { name: "type", label: "Tipo", kind: "select", required: true, options: choices(["prospecto", "cliente", "asegurado", "beneficiario", "representante"]) },
      { name: "company", label: "Empresa / organización" },
      { name: "status", label: "Estado", kind: "select", options: choices(["activo", "seguimiento", "nuevo", "inactivo"]) },
    ],
  },
  Aseguradoras: {
    resource: "insurers",
    eyebrow: "CATÁLOGOS",
    title: "Aseguradoras",
    description: "Administra compañías aseguradoras y sus canales de atención.",
    fields: [
      { name: "name", label: "Nombre", required: true },
      { name: "email", label: "Correo", kind: "email" },
      { name: "phone", label: "Teléfono", kind: "tel" },
      { name: "website", label: "Sitio web" },
      { name: "status", label: "Estado", kind: "select", options: choices(["activo", "inactivo"]) },
      { name: "notes", label: "Notas", kind: "textarea" },
    ],
  },
  Productos: {
    resource: "products",
    eyebrow: "CATÁLOGOS",
    title: "Productos de seguros",
    description: "Mantén el catálogo de productos y su aseguradora.",
    fields: [
      { name: "name", label: "Producto", required: true },
      { name: "category", label: "Categoría", required: true },
      { name: "insurerId", label: "Aseguradora", kind: "select", referenceResource: "insurers" },
      { name: "description", label: "Descripción", kind: "textarea" },
      { name: "status", label: "Estado", kind: "select", options: choices(["activo", "inactivo"]) },
    ],
  },
  Oportunidades: {
    resource: "opportunities",
    eyebrow: "GESTIÓN COMERCIAL",
    title: "Oportunidades",
    description: "Da seguimiento a oportunidades desde el contacto inicial hasta el cierre.",
    fields: [
      { name: "name", label: "Oportunidad", required: true },
      { name: "contactId", label: "Contacto", kind: "select", required: true, referenceResource: "contacts" },
      { name: "productId", label: "Producto", kind: "select", referenceResource: "products" },
      { name: "insurerId", label: "Aseguradora", kind: "select", referenceResource: "insurers" },
      { name: "premium", label: "Prima estimada", kind: "number" },
      { name: "stage", label: "Etapa", kind: "select", required: true, options: choices(["nuevo", "contactado", "cotizando", "negociacion", "ganada", "perdida"]) },
      { name: "expectedCloseDate", label: "Cierre esperado", kind: "date" },
      { name: "notes", label: "Notas", kind: "textarea" },
    ],
  },
  Cotizaciones: {
    resource: "quotes",
    eyebrow: "COTIZACIONES",
    title: "Solicitudes y propuestas",
    description: "Registra y compara propuestas recibidas de las aseguradoras.",
    fields: [
      { name: "opportunityId", label: "Oportunidad", kind: "select", required: true, referenceResource: "opportunities" },
      { name: "insurerId", label: "Aseguradora", kind: "select", required: true, referenceResource: "insurers" },
      { name: "productId", label: "Producto", kind: "select", referenceResource: "products" },
      { name: "premium", label: "Prima cotizada", kind: "number", required: true },
      { name: "currency", label: "Moneda", kind: "select", options: choices(["HNL", "USD"]) },
      { name: "status", label: "Estado", kind: "select", required: true, options: choices(["solicitada", "recibida", "presentada", "aceptada", "rechazada", "vencida"]) },
      { name: "validUntil", label: "Válida hasta", kind: "date" },
      { name: "notes", label: "Notas", kind: "textarea" },
    ],
  },
  Pólizas: {
    resource: "policies",
    eyebrow: "CARTERA",
    title: "Pólizas",
    description: "Consulta y administra pólizas de tus clientes.",
    fields: [
      { name: "policyNumber", label: "Número de póliza", required: true },
      { name: "contactId", label: "Contacto", kind: "select", required: true, referenceResource: "contacts" },
      { name: "insurerId", label: "Aseguradora", kind: "select", required: true, referenceResource: "insurers" },
      { name: "productId", label: "Producto", kind: "select", referenceResource: "products" },
      { name: "premium", label: "Prima", kind: "number", required: true },
      { name: "currency", label: "Moneda", kind: "select", options: choices(["HNL", "USD"]) },
      { name: "startDate", label: "Inicio de vigencia", kind: "date", required: true },
      { name: "endDate", label: "Fin de vigencia", kind: "date", required: true },
      { name: "status", label: "Estado", kind: "select", required: true, options: choices(["activa", "vencida", "cancelada"]) },
    ],
  },
  Renovaciones: {
    resource: "renewals",
    eyebrow: "CONTINUIDAD DE CARTERA",
    title: "Renovaciones",
    description: "Anticípate a los vencimientos y registra el avance de cada renovación.",
    fields: [
      { name: "policyId", label: "Póliza", kind: "select", required: true, referenceResource: "policies" },
      { name: "contactId", label: "Contacto", kind: "select", required: true, referenceResource: "contacts" },
      { name: "dueDate", label: "Fecha límite", kind: "date", required: true },
      { name: "premium", label: "Prima", kind: "number" },
      { name: "status", label: "Estado", kind: "select", required: true, options: choices(["pendiente", "en_gestion", "renovada", "no_renovada"]) },
      { name: "notes", label: "Notas", kind: "textarea" },
    ],
  },
  Siniestros: {
    resource: "claims",
    eyebrow: "ATENCIÓN Y SERVICIO",
    title: "Siniestros",
    description: "Registra siniestros y mantén el seguimiento de sus estados.",
    fields: [
      { name: "policyId", label: "Póliza", kind: "select", required: true, referenceResource: "policies" },
      { name: "contactId", label: "Contacto", kind: "select", required: true, referenceResource: "contacts" },
      { name: "claimNumber", label: "Número de siniestro" },
      { name: "reportedAt", label: "Fecha de reporte", kind: "date", required: true },
      { name: "amount", label: "Monto reclamado", kind: "number" },
      { name: "status", label: "Estado", kind: "select", required: true, options: choices(["reportado", "en_revision", "aprobado", "rechazado", "cerrado"]) },
      { name: "description", label: "Descripción", kind: "textarea", required: true },
      { name: "notes", label: "Notas de seguimiento", kind: "textarea" },
    ],
  },
  Tareas: {
    resource: "tasks",
    eyebrow: "SEGUIMIENTO",
    title: "Tareas y actividades",
    description: "Organiza pendientes y actividades asociadas a tus operaciones.",
    fields: [
      { name: "title", label: "Tarea", required: true },
      { name: "dueDate", label: "Fecha límite", kind: "date" },
      { name: "priority", label: "Prioridad", kind: "select", required: true, options: choices(["baja", "media", "alta"]) },
      { name: "status", label: "Estado", kind: "select", required: true, options: choices(["pendiente", "en_progreso", "completada"]) },
      { name: "relatedType", label: "Tipo relacionado", kind: "select", options: choices(["contact", "opportunity", "policy", "claim", "renewal"]) },
      { name: "relatedId", label: "ID relacionado" },
      { name: "assignee", label: "Responsable" },
      { name: "description", label: "Descripción", kind: "textarea" },
    ],
  },
  Documentos: {
    resource: "documents",
    eyebrow: "ARCHIVO",
    title: "Documentos",
    description: "Registra documentos y vincúlalos con clientes u operaciones.",
    fields: [
      { name: "name", label: "Nombre del documento", required: true },
      { name: "fileName", label: "Nombre del archivo" },
      { name: "mimeType", label: "Tipo de archivo" },
      { name: "relatedType", label: "Tipo relacionado", kind: "select", options: choices(["contact", "opportunity", "quote", "policy", "claim"]) },
      { name: "relatedId", label: "ID relacionado" },
      { name: "notes", label: "Notas", kind: "textarea" },
    ],
  },
  Administración: {
    resource: "agencies",
    eyebrow: "CONFIGURACIÓN",
    title: "Agencia y usuarios",
    description: "Administra los datos básicos de la agencia y su lista de usuarios de demostración.",
    fields: [
      { name: "name", label: "Nombre", required: true },
      { name: "email", label: "Correo", kind: "email" },
      { name: "phone", label: "Teléfono", kind: "tel" },
      { name: "address", label: "Dirección" },
    ],
  },
};

export const userFields: ModuleField[] = [
  { name: "name", label: "Nombre", required: true },
  { name: "email", label: "Correo", kind: "email", required: true },
  { name: "role", label: "Rol", kind: "select", required: true, options: choices(["administrador", "agente", "consulta"]) },
  { name: "status", label: "Estado", kind: "select", required: true, options: choices(["activo", "inactivo"]) },
];
