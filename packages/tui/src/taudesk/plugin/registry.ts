// plugin/registry.ts — pure Map, ordered, throws on duplicate. Privilege boundary documented in TAUDESK.md

export type TaudeskSlot = "context" | "observability";
export type TaudeskPluginViewDef = {
  id: string;
  slot: TaudeskSlot;
  title: string;
  order?: number;
  component: (props?: unknown) => unknown; // solid component
};

const ID_RE = /^[a-z0-9][a-z0-9._-]*$/i;

export function validateTaudeskPlugin(def: TaudeskPluginViewDef, apiVersion: string): void {
  if (apiVersion !== "1.0.0") throw new Error(`apiVersion mismatch: expected 1.0.0 got ${apiVersion}`);
  if (!def.id || !ID_RE.test(def.id)) throw new Error(`bad id: ${def.id}`);
  if (!def.title) throw new Error("empty title");
  if (def.slot !== "context" && def.slot !== "observability") throw new Error(`bad pane: ${def.slot}`);
  if (typeof def.component !== "function") throw new Error("non-fn render");
}

export class TaudeskPluginRegistry {
  private map = new Map<string, TaudeskPluginViewDef>();

  register(def: TaudeskPluginViewDef): void {
    if (this.map.has(def.id)) throw new Error(`duplicate id: ${def.id}`);
    validateTaudeskPlugin(def, "1.0.0");
    this.map.set(def.id, Object.freeze({ ...def }) as TaudeskPluginViewDef);
  }

  get(id: string): TaudeskPluginViewDef | undefined {
    return this.map.get(id);
  }

  list(): TaudeskPluginViewDef[] {
    return [...this.map.values()].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  listBySlot(slot: TaudeskSlot): TaudeskPluginViewDef[] {
    return this.list().filter((v) => v.slot === slot);
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}

export const TAUDESK_PLUGIN_API_VERSION = "1.0.0";
