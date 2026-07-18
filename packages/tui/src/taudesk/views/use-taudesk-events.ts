// use-taudesk-events.ts — shared hook to fix duplicated bus.on pattern in 5 views (Rule of Three violation).
// Why this exists: 5 views had identical `const off = bus.on(...); onCleanup(off); setX(prev => { next=[...prev,entry]; if(next.length>N) shift; })`
// Unify only on true shared meaning — here the meaning IS identical: capped rolling log of bus events.

import { createSignal, onCleanup } from "solid-js";
import { useTaudeskState } from "../state.tsx";

export function useTaudeskEvents<T>(
  topic: string,
  map: (evt: { data: unknown; revision: number; ts: number } & Record<string, unknown>) => T | null,
  cap: number,
) {
  const state = useTaudeskState();
  const [items, setItems] = createSignal<T[]>([]);

  const off = state.bus.on(topic, (evt) => {
    const mapped = map(evt as never);
    if (mapped == null) return;
    setItems((prev) => {
      const next = [...prev, mapped];
      if (next.length > cap) next.shift();
      return next;
    });
  });
  onCleanup(off);

  return items;
}
