"use client";

import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Bot,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Clock3,
  FileText,
  Filter,
  HandCoins,
  Home,
  LifeBuoy,
  LockKeyhole,
  LogOut,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UsersRound,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { DataModulePage } from "./data-module-page";
import { AiAssistant } from "./ai-assistant";
import { modules } from "@/lib/ams-modules";
import { demoAgencies, demoDataKey, demoFetch, getDemoAgency, selectDemoAgency, type DemoAgencyId } from "@/lib/demo-agencies";

type Contact = {
  id: string;
  name: string;
  email: string;
  phone: string;
  type: string;
  status: string;
  company: string;
  initials: string;
  color: string;
};

const initialContacts: Contact[] = [
  { id: "C-1001", name: "María Fernanda López", email: "maria.lopez@email.com", phone: "+504 9988-1204", type: "Cliente", status: "Activo", company: "Particular", initials: "ML", color: "blue" },
  { id: "C-1002", name: "Carlos Eduardo Mejía", email: "carlos.mejia@email.com", phone: "+504 9876-2210", type: "Prospecto", status: "Seguimiento", company: "Particular", initials: "CM", color: "violet" },
  { id: "C-1003", name: "Inversiones del Valle", email: "contacto@inversionesvalle.com", phone: "+504 2234-8812", type: "Cliente", status: "Activo", company: "Empresa", initials: "IV", color: "green" },
  { id: "C-1004", name: "Ana Lucía Rivera", email: "ana.rivera@email.com", phone: "+504 9901-4077", type: "Asegurado", status: "Activo", company: "Particular", initials: "AR", color: "amber" },
  { id: "C-1005", name: "Grupo Horizonte S.A.", email: "administracion@horizonte.hn", phone: "+504 2216-0320", type: "Cliente", status: "Activo", company: "Empresa", initials: "GH", color: "rose" },
  { id: "C-1006", name: "Roberto Antonio Flores", email: "roberto.flores@email.com", phone: "+504 9980-0156", type: "Prospecto", status: "Nuevo", company: "Particular", initials: "RF", color: "slate" },
];

const menuGroups = [
  {
    title: "GENERAL",
    links: [
      { id: "Inicio", icon: Home },
      { id: "Contactos", icon: UsersRound },
      { id: "Oportunidades", icon: BriefcaseBusiness },
      { id: "Cotizaciones", icon: ClipboardList },
    ],
  },
  {
    title: "OPERACIONES",
    links: [
      { id: "Pólizas", icon: Shield },
      { id: "Renovaciones", icon: CalendarDays },
      { id: "Siniestros", icon: LifeBuoy },
      { id: "Aseguradoras", icon: BuildingIcon },
      { id: "Productos", icon: FileText },
    ],
  },
  {
    title: "GESTIÓN",
    links: [
      { id: "Tareas", icon: Check },
      { id: "Documentos", icon: FileText },
      { id: "Reportes", icon: Activity },
    ],
  },
  {
    title: "INTELIGENCIA",
    links: [
      { id: "Asistente IA", icon: Bot },
    ],
  },
];

const sectionDetails: Record<string, { eyebrow: string; title: string; description: string }> = {
  Oportunidades: { eyebrow: "GESTIÓN COMERCIAL", title: "Oportunidades", description: "Da seguimiento a cada oportunidad, desde el primer contacto hasta el cierre." },
  Cotizaciones: { eyebrow: "COTIZACIONES", title: "Solicitudes y propuestas", description: "Compara las propuestas recibidas de las aseguradoras." },
  Pólizas: { eyebrow: "CARTERA", title: "Pólizas", description: "Consulta y administra la cartera de tus clientes." },
  Renovaciones: { eyebrow: "CONTINUIDAD DE CARTERA", title: "Renovaciones", description: "Anticípate a los vencimientos y acompaña cada renovación." },
  Siniestros: { eyebrow: "ATENCIÓN Y SERVICIO", title: "Siniestros", description: "Mantén el seguimiento de los casos y sus próximos pasos." },
  Aseguradoras: { eyebrow: "CATÁLOGOS", title: "Aseguradoras", description: "Administra las compañías y sus canales de atención." },
  Productos: { eyebrow: "CATÁLOGOS", title: "Productos de seguros", description: "Explora los productos disponibles para tu agencia." },
  Tareas: { eyebrow: "SEGUIMIENTO", title: "Tareas y actividades", description: "Organiza tus pendientes y actividades comerciales." },
  Documentos: { eyebrow: "ARCHIVO", title: "Documentos", description: "Documentos vinculados a clientes y operaciones." },
  Reportes: { eyebrow: "ANÁLISIS", title: "Reportes", description: "Indicadores de cartera, actividad y seguimiento." },
  Administración: { eyebrow: "CONFIGURACIÓN", title: "Administración", description: "Preferencias, usuarios y configuración de la agencia." },
};

function BuildingIcon({ size = 18 }: { size?: number }) {
  return <BriefcaseBusiness size={size} />;
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? "brand-compact" : ""}`} aria-label="Ficohsa Seguros">
      <svg viewBox="0 0 38 38" role="img" aria-label="Ficohsa">
        <path d="M6 8 32 3 29 10 8 14zM8 18l21-4-3 7-17 3zM12 29l15-4-3 8-10 2z" />
      </svg>
      <span className="brand-name">Ficohsa</span>
      <span className="brand-divider" />
      <span className="brand-seguros">Seguros</span>
    </div>
  );
}

function LoginScreen({ onLogin }: { onLogin: (email: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 4) {
      setError("Ingresa un correo válido y una contraseña de al menos 4 caracteres.");
      return;
    }
    setError("");
    onLogin(email);
  }

  return (
    <div className="login-page">
      <header className="login-header"><Brand /></header>
      <main className="login-main">
        <form className="login-card" onSubmit={submit}>
          <div className="login-icon"><LockKeyhole size={29} /></div>
          <h1>Bienvenido</h1>
          <p className="login-subtitle">Ingresa tus credenciales para continuar.</p>
          <label className="login-label" htmlFor="login-email">Correo electrónico</label>
          <input id="login-email" type="email" autoComplete="email" placeholder="nombre@ficohsa.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <label className="login-label" htmlFor="login-password">Contraseña</label>
          <input id="login-password" type="password" autoComplete="current-password" placeholder="••••••••" value={password} onChange={(event) => setPassword(event.target.value)} minLength={4} required />
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="login-submit" type="submit"><span>Iniciar sesión</span><ArrowRight size={22} /></button>
          <div className="demo-note">
            <div className="demo-note-heading"><Sparkles size={16} /> Acceso demostrativo</div>
            <p>Usa cualquier correo válido y una contraseña de 4 caracteres o más.</p>
          </div>
          <p className="login-disclaimer">Esta pantalla es una simulación y no reemplaza autenticación corporativa.</p>
        </form>
      </main>
    </div>
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-HN", { style: "currency", currency: "HNL", maximumFractionDigits: 0 }).format(value);
}

export function AmsApp() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [email, setEmail] = useState("agente@ficohsa.com");
  const [active, setActive] = useState("Inicio");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");
  const [agency, setAgency] = useState<DemoAgencyId>("demo");
  const agencyName = demoAgencies.find((item) => item.id === agency)!.name;
  const nameParts = email.split("@")[0].split(/[._+\-]+/).filter(Boolean)
    .map((part) => part.charAt(0).toLocaleUpperCase("es") + part.slice(1).toLocaleLowerCase("es"));
  const displayName = nameParts.join(" ") || "Agente";
  const firstName = nameParts[0] || "Agente";
  const initials = nameParts.slice(0, 2).map((part) => part.charAt(0)).join("") || "A";

  useEffect(() => {
    setAgency(getDemoAgency());
    const savedSession = window.localStorage.getItem("brukiz-demo-session");
    if (savedSession) {
      setEmail(savedSession);
      setLoggedIn(true);
    }
  }, []);

  useEffect(() => {
    if (toast) {
      const timeout = window.setTimeout(() => setToast(""), 2800);
      return () => window.clearTimeout(timeout);
    }
  }, [toast]);

  function logIn(nextEmail: string) {
    setEmail(nextEmail.trim());
    setActive("Inicio");
    setLoggedIn(true);
    window.localStorage.setItem("brukiz-demo-session", nextEmail.trim());
  }

  function logOut() {
    setLoggedIn(false);
    window.localStorage.removeItem("brukiz-demo-session");
  }

  if (!loggedIn) return <LoginScreen onLogin={logIn} />;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand"><Brand compact /><button className="mobile-close" aria-label="Cerrar menú" onClick={() => setMobileMenu(false)}><X size={19} /></button></div>
        <div className="agency-switcher">
          <div className="agency-avatar">F</div>
          <div className="agency-copy"><strong>Ficohsa Seguros</strong>
            <select aria-label="Agencia de demostración" value={agency} onChange={(event) => {
              setAgency(selectDemoAgency(event.target.value));
              setSearch("");
              setToast("");
            }}>
              {demoAgencies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>
        </div>
        <nav className="side-nav" aria-label="Navegación principal">
          {menuGroups.map((group) => (
            <div className="nav-group" key={group.title}>
              <p className="nav-heading">{group.title}</p>
              {group.links.map((link) => {
                const Icon = link.icon;
                return (
                <button key={link.id} className={`nav-link ${active === link.id ? "nav-link-active" : ""}`} onClick={() => { setActive(link.id); setMobileMenu(false); }}>
                  <Icon size={18} strokeWidth={1.8} /><span>{link.id}</span>
                </button>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card"><div className="help-icon"><CircleHelp size={17} /></div><strong>¿Necesitas ayuda?</strong><p>Estamos para apoyarte.</p><button onClick={() => setToast("Centro de ayuda disponible próximamente.")}>Contactar soporte <ArrowRight size={14} /></button></div>
          <button className="nav-link settings-link" onClick={() => setActive("Administración")}><SlidersHorizontal size={18} /><span>Administración</span></button>
          <div className="profile-row"><div className="profile-avatar">{initials}</div><div className="profile-copy"><strong title={email}>{displayName}</strong><span>Agente de seguros</span></div><button aria-label="Cerrar sesión" title="Cerrar sesión" className="profile-logout" onClick={logOut}><LogOut size={17} /></button></div>
        </div>
      </aside>
      {mobileMenu && <button className="sidebar-overlay" aria-label="Cerrar menú" onClick={() => setMobileMenu(false)} />}
      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu-button" aria-label="Abrir menú" onClick={() => setMobileMenu(true)}><Menu size={21} /></button>
          <div className="breadcrumbs"><span>{agencyName}</span><ChevronRight size={15} /><strong>{active}</strong></div>
          <div className="topbar-actions">
            <label className="global-search"><Search size={17} /><input aria-label="Buscar en el sistema" placeholder="Buscar en todo..." value={search} onChange={(event) => setSearch(event.target.value)} /><kbd>⌘ K</kbd></label>
            <button className="icon-button notification-button" aria-label="Notificaciones" onClick={() => setToast("No tienes notificaciones nuevas.")}><Bell size={19} /><span /></button>
            <div className="topbar-divider" />
            <div className="topbar-user" title={email}><div className="profile-avatar">{initials}</div><ChevronDown size={15} /></div>
          </div>
        </header>

        <div className="page-content" key={agency}>
          <div className="demo-banner"><span className="demo-banner-dot" /><strong>{agencyName.toLocaleUpperCase()} · DEMO</strong><span>Agencias simuladas de acceso público. Usa solo datos ficticios.</span></div>
          {active === "Inicio" ? (
            <Dashboard onNavigate={setActive} firstName={firstName} />
          ) : active === "Asistente IA" ? (
            <AiAssistant onToast={setToast} userInitials={initials} />
          ) : (
            <DataModulePage section={active} search={search} setSearch={setSearch} onToast={setToast} />
          )}
        </div>
      </main>
      {toast && <div className="toast" role="status"><Check size={17} />{toast}</div>}
    </div>
  );
}

function Dashboard({ onNavigate, firstName }: { onNavigate: (section: string) => void; firstName: string }) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [summaryError, setSummaryError] = useState("");

  useEffect(() => {
    async function loadSummary() {
      try {
        const apiBaseUrl = process.env.NEXT_PUBLIC_BRUKIZ_API_URL?.replace(/\/+$/, "");
        if (apiBaseUrl) {
          const response = await demoFetch(`${apiBaseUrl}/v1/reports`);
          const result = await response.json();
          if (!response.ok) throw new Error(result.message ?? `La API respondió ${response.status}.`);
          setCounts(result.counts as Record<string, number>);
          return;
        }
        const next: Record<string, number> = {};
        for (const module of Object.values(modules)) {
          const stored = window.localStorage.getItem(demoDataKey(module.resource));
          const rows: unknown = stored ? JSON.parse(stored) : module.resource === "contacts" && getDemoAgency() === "demo" ? Array(4).fill(null) : [];
          if (!Array.isArray(rows)) throw new Error(`Los datos locales de ${module.resource} no tienen un formato válido.`);
          next[module.resource] = rows.filter((row) => !row || typeof row !== "object" || !(row as { archived?: boolean }).archived).length;
        }
        const users = window.localStorage.getItem(demoDataKey("users"));
        const userRows: unknown = users ? JSON.parse(users) : [];
        if (!Array.isArray(userRows)) throw new Error("Los datos locales de usuarios no tienen un formato válido.");
        next.users = userRows.filter((row) => !row || typeof row !== "object" || !(row as { archived?: boolean }).archived).length;
        setCounts(next);
      } catch (cause) {
        setSummaryError(cause instanceof Error ? cause.message : "No se pudo cargar el resumen de la agencia.");
      }
    }
    void loadSummary();
  }, []);

  return (
    <>
      <div className="page-heading dashboard-heading">
        <div><div className="eyebrow">RESUMEN DE OPERACIONES</div><h1>Buenos días, {firstName} <span className="wave">✦</span></h1><p>Registros y pendientes de tu agencia en un solo lugar.</p></div>
        <button className="primary-button" onClick={() => onNavigate("Contactos")}><Plus size={17} /> Nuevo contacto</button>
      </div>
      <div className="summary-row">
        <div className="summary-copy"><strong>Resumen de la agencia</strong><span>Conteos actuales de los registros activos.</span></div>
      </div>
      {summaryError && <p className="form-error" role="alert">{summaryError}</p>}
      <section className="metrics-grid" aria-label="Indicadores de la agencia">
        <MetricCard label="Contactos" amount={String(counts.contacts ?? "—")} delta="Registros" icon={<UsersRound size={18} />} tone="blue" note="En el directorio" />
        <MetricCard label="Pólizas" amount={String(counts.policies ?? "—")} delta="Registros" icon={<ShieldCheck size={18} />} tone="green" note="En cartera" />
        <MetricCard label="Oportunidades" amount={String(counts.opportunities ?? "—")} delta="Registros" icon={<BriefcaseBusiness size={18} />} tone="violet" note="En pipeline" />
        <MetricCard label="Tareas pendientes" amount={String(counts.tasks ?? "—")} delta="Registros" icon={<Check size={18} />} tone="amber" note="Revisa sus estados" />
      </section>
      <div className="dashboard-grid">
        <section className="panel task-panel">
          <div className="panel-header"><div><h2>Renovaciones</h2><p>Registros para seguimiento</p></div><button className="text-link" onClick={() => onNavigate("Renovaciones")}>Ver renovaciones <ArrowRight size={14} /></button></div>
          <div className="pipeline-total"><strong>{counts.renewals ?? "—"}</strong><span>renovaciones registradas</span></div>
        </section>
        <section className="panel pipeline-panel">
          <div className="panel-header"><div><h2>Siniestros</h2><p>Casos registrados</p></div><button className="text-link" onClick={() => onNavigate("Siniestros")}>Ver siniestros <ArrowRight size={14} /></button></div>
          <div className="pipeline-total"><strong>{counts.claims ?? "—"}</strong><span>siniestros registrados</span></div>
        </section>
      </div>
      <p className="dashboard-footnote"><CircleHelp size={14} /> Los conteos reflejan registros activos; las primas, comisiones y métricas financieras no están calculadas.</p>
    </>
  );
}

function MetricCard({ label, amount, delta, icon, tone, note }: { label: string; amount: string; delta: string; icon: React.ReactNode; tone: string; note: string }) {
  return <div className="metric-card"><div className="metric-top"><span>{label}</span><span className={`metric-icon ${tone}`}>{icon}</span></div><strong className="metric-amount">{amount}</strong><div className="metric-bottom"><span className={`metric-delta ${tone}`}>{tone !== "amber" && <ArrowUpRight size={13} />}{delta}</span><span>{note}</span></div></div>;
}

function RevenueChart() {
  const bars = [38, 50, 42, 66, 49, 75, 57, 46, 69, 55, 84, 64, 50, 71, 91, 60, 77, 48, 65, 83, 58, 72, 52, 91, 67, 79, 56, 86, 64, 97];
  return <div className="chart-wrap"><div className="chart-y-labels"><span>500k</span><span>375k</span><span>250k</span><span>125k</span><span>0</span></div><div className="chart-plot"><div className="chart-lines"><i /><i /><i /><i /><i /></div><div className="chart-bars">{bars.map((height, index) => <span key={index} className="chart-bar" style={{ height: `${height}%` }} />)}</div></div></div>;
}

function RenewalItem({ initials, name, product, date, tone }: { initials: string; name: string; product: string; date: string; tone: string }) {
  return <div className="renewal-item"><div className={`contact-avatar ${tone}`}>{initials}</div><div className="renewal-copy"><strong>{name}</strong><span>{product}</span></div><span className="renewal-date"><Clock3 size={13} />{date}</span></div>;
}

function TaskItem({ title, subtitle, time, priority }: { title: string; subtitle: string; time: string; priority: string }) {
  return <div className="task-item"><button className="task-check" aria-label={`Completar ${title}`} /><div className="task-copy"><strong>{title}</strong><span>{subtitle}</span></div><span className={`priority-pill ${priority === "Alta" ? "priority-high" : "priority-medium"}`}>{priority}</span><span className="task-time">{time}</span></div>;
}

function PipelineStage({ name, count, percent, color }: { name: string; count: number; percent: number; color: string }) {
  return <div className="pipeline-stage"><div><span>{name}</span><strong>{count}</strong></div><div className="pipeline-track"><i className={color} style={{ width: `${percent}%` }} /></div></div>;
}

function ContactsPage({ contacts, search, setSearch, onAdd }: { contacts: Contact[]; search: string; setSearch: (value: string) => void; onAdd: () => void }) {
  const [filter, setFilter] = useState("Todos los tipos");
  const visible = filter === "Todos los tipos" ? contacts : contacts.filter((contact) => contact.type === filter);
  return (
    <>
      <div className="page-heading module-heading"><div><div className="eyebrow">RELACIONES Y CRM</div><h1>Contactos</h1><p>Administra clientes, prospectos y las relaciones de tu agencia.</p></div><button className="primary-button" onClick={onAdd}><Plus size={17} /> Nuevo contacto</button></div>
      <section className="contact-summary">
        <div className="contact-summary-item"><span>Total de contactos</span><strong>248</strong><small><ArrowUpRight size={13} /> 12 nuevos este mes</small></div>
        <div className="contact-summary-divider" />
        <div className="contact-summary-item"><span>Clientes activos</span><strong>186</strong><small className="neutral-summary">75% de tu cartera</small></div>
        <div className="contact-summary-divider" />
        <div className="contact-summary-item"><span>Prospectos</span><strong>62</strong><small className="neutral-summary">En seguimiento</small></div>
        <div className="contact-summary-note"><UsersRound size={18} /><span>Vista de contactos<br /><strong>Última actualización: hoy</strong></span></div>
      </section>
      <section className="panel contacts-panel">
        <div className="contacts-toolbar"><div><h2>Todos los contactos</h2><p>Busca y administra tus relaciones comerciales.</p></div><div className="contact-actions"><label className="table-search"><Search size={16} /><input placeholder="Buscar contacto..." value={search} onChange={(event) => setSearch(event.target.value)} /></label><button className="filter-button" onClick={() => setFilter(filter === "Todos los tipos" ? "Cliente" : filter === "Cliente" ? "Prospecto" : "Todos los tipos")}><Filter size={15} />{filter}<ChevronDown size={14} /></button><button className="icon-button table-settings" aria-label="Opciones de tabla"><SlidersHorizontal size={17} /></button></div></div>
        <div className="table-scroll"><table className="contacts-table"><thead><tr><th><input type="checkbox" aria-label="Seleccionar todos" /></th><th>CONTACTO</th><th>TIPO</th><th>TELÉFONO</th><th>ESTADO</th><th>ÚLTIMA ACTIVIDAD</th><th /></tr></thead><tbody>
          {visible.map((contact, index) => <tr key={contact.id}><td><input type="checkbox" aria-label={`Seleccionar ${contact.name}`} /></td><td><div className="table-person"><div className={`contact-avatar ${contact.color}`}>{contact.initials}</div><div><strong>{contact.name}</strong><span>{contact.email}</span></div></div></td><td><span className={`type-pill ${contact.type === "Cliente" ? "type-client" : contact.type === "Prospecto" ? "type-lead" : "type-insured"}`}>{contact.type}</span></td><td className="phone-cell">{contact.phone}</td><td><span className={`status-indicator ${contact.status === "Activo" ? "status-active" : contact.status === "Nuevo" ? "status-new" : "status-follow"}`}><i />{contact.status}</span></td><td className="activity-cell">{["Hace 2 horas", "Ayer", "Hace 2 días", "Hace 4 días", "Hace 1 semana", "Hace 2 semanas"][index % 6]}</td><td><button className="row-more" aria-label={`Más opciones para ${contact.name}`}><MoreHorizontal size={18} /></button></td></tr>)}
          {visible.length === 0 && <tr><td colSpan={7} className="empty-row">No se encontraron contactos con esos criterios.</td></tr>}
        </tbody></table></div>
        <div className="table-footer"><span>Mostrando <strong>{visible.length}</strong> de <strong>248</strong> contactos</span><div className="pagination"><button aria-label="Página anterior" disabled><ChevronLeft size={16} /></button><button className="page-current">1</button><button>2</button><button>3</button><span>...</span><button>25</button><button aria-label="Página siguiente"><ChevronRight size={16} /></button></div></div>
      </section>
      <p className="dashboard-footnote"><CircleHelp size={14} /> Los registros mostrados son de demostración; las acciones se guardan solo en este navegador.</p>
    </>
  );
}

function ModulePreview({ section, onAdd }: { section: { eyebrow: string; title: string; description: string }; onAdd: () => void }) {
  return (
    <>
      <div className="page-heading module-heading"><div><div className="eyebrow">{section.eyebrow}</div><h1>{section.title}</h1><p>{section.description}</p></div><button className="primary-button" onClick={onAdd}><Plus size={17} /> Nuevo registro</button></div>
      <section className="panel module-placeholder"><div className="placeholder-illustration"><FileText size={29} /></div><span className="placeholder-badge"><Sparkles size={13} /> PRÓXIMAMENTE</span><h2>Tu espacio de {section.title.toLowerCase()}</h2><p>Estamos preparando este módulo para que administres la información de manera simple y segura.</p><button className="secondary-button" onClick={onAdd}>Conocer más <ArrowRight size={15} /></button></section>
      <p className="dashboard-footnote"><CircleHelp size={14} /> Este módulo aún no está conectado a operaciones reales.</p>
    </>
  );
}

function ContactModal({ onClose, onSave }: { onClose: () => void; onSave: (contact: Omit<Contact, "id" | "initials" | "color">) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [type, setType] = useState("Cliente");
  const [company, setCompany] = useState("Particular");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({ name, email, phone, type, status: "Nuevo", company });
  }

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="contact-modal" onSubmit={submit}><div className="modal-header"><div><span className="eyebrow">DIRECTORIO</span><h2>Nuevo contacto</h2><p>Agrega una persona u organización a tu espacio de demostración.</p></div><button className="modal-close" type="button" aria-label="Cerrar" onClick={onClose}><X size={19} /></button></div><label>Nombre completo<input autoFocus required value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. María Fernanda López" /></label><label>Correo electrónico<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nombre@correo.com" /></label><label>Teléfono<input required value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+504 0000-0000" /></label><div className="modal-two-col"><label>Tipo<select value={type} onChange={(event) => setType(event.target.value)}><option>Cliente</option><option>Prospecto</option><option>Asegurado</option><option>Beneficiario</option></select></label><label>Organización<input value={company} onChange={(event) => setCompany(event.target.value)} placeholder="Particular o empresa" /></label></div><div className="modal-notice"><ShieldCheck size={16} /><span>Los datos ingresados se guardarán solo en este navegador mientras el entorno sea demostrativo.</span></div><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button type="submit" className="primary-button"><Plus size={16} /> Agregar contacto</button></div></form></div>;
}
