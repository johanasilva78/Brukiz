export const demoAgencies = [
  { id: "demo", name: "Agencia Principal" },
  { id: "demo-norte", name: "Agencia Norte" },
  { id: "demo-sur", name: "Agencia Sur" },
] as const;

export type DemoAgencyId = typeof demoAgencies[number]["id"];
const selectionKey = "brukiz-demo-agency";

export function getDemoAgency(): DemoAgencyId {
  const saved = typeof window === "undefined" ? null : window.sessionStorage.getItem(selectionKey);
  return demoAgencies.find((agency) => agency.id === saved)?.id ?? "demo";
}

export function selectDemoAgency(id: string): DemoAgencyId {
  const agency = demoAgencies.find((item) => item.id === id);
  if (!agency) throw new Error("La agencia de demostración no es válida.");
  window.sessionStorage.setItem(selectionKey, agency.id);
  return agency.id;
}

export function demoDataKey(resource: string) {
  const agency = getDemoAgency();
  // Preserve the existing Principal demo records without moving or duplicating them.
  return agency === "demo" ? `brukiz-demo-data:${resource}` : `brukiz-demo-data:${agency}:${resource}`;
}

export function demoFetch(input: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  headers.set("X-Demo-Agency", getDemoAgency());
  return fetch(input, { ...init, headers });
}
