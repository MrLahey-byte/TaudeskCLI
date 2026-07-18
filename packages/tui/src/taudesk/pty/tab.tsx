// pty/tab.tsx — PTY tab component bridging session + renderable
import { createSignal, onCleanup, onMount, createEffect, Show } from "solid-js";
import { useRenderer } from "@opentui/solid";
import { createPtySession, type PtySession } from "./session.ts";
import { PtyRenderable, type PtyFrame, type PtyCell } from "./renderable.tsx";
import { keyToPtyBytes } from "./keys.ts";
import { shouldConsumeForPty } from "./passthrough.ts";
import { useTaudeskState } from "../state.tsx";
import { PRIORITIES } from "../keybind-conflicts.ts";
import { useOpencodeKeymap } from "../../keymap.tsx";
import { createScreen } from "./screen.ts";

function ansiToCells(data: string, cols: number): PtyCell[][] {
  // minimal VT parser: accumulate chars, handle basic colors via @xterm/headless would do proper, but fallback
  // For full fidelity we rely on screen.ts; here we buffer raw lines for renderable input when headless unavailable
  const lines = data.split("\n");
  return lines.map((line) =>
    line.split("").slice(0, cols).map((ch) => ({ char: ch })),
  );
}

export function PtyTab(props: {
  id?: string;
  cols?: number;
  rows?: number;
  cwd?: string;
  shell?: string;
  onExit?: (code: number) => void;
  focused?: boolean;
}) {
  const taudesk = useTaudeskState();
  const renderer = useRenderer();
  const keymap = useOpencodeKeymap();
  let container: unknown = null;

  const [frame, setFrame] = createSignal<PtyFrame | null>(null);
  const [session, setSession] = createSignal<PtySession | null>(null);
  const cols = () => props.cols ?? 80;
  const rows = () => props.rows ?? 24;

  let bufferLines: string[] = [];
  let cursorX = 0;
  let cursorY = 0;
  let screenHandle: Awaited<ReturnType<typeof createScreen>> | null = null;

  onMount(async () => {
    screenHandle = await createScreen(cols(), rows());

    const sess = await createPtySession(
      {
        cols: cols(),
        rows: rows(),
        cwd: props.cwd,
        shell: props.shell,
        bus: taudesk.bus,
      },
    );
    setSession(sess);

    sess.onData((data) => {
      // write to screen
      screenHandle?.write(data);
      bufferLines.push(data);
      if (bufferLines.length > 1000) bufferLines.shift();

      // build frame for renderable — use screen grid if available else ansi fallback
      const grid = screenHandle?.readGrid?.();
      if (grid && grid.length > 0) {
        const cells: PtyCell[][] = grid.map((row) =>
          row.map((c) => ({
            char: (c as { char?: string }).char ?? " ",
            // fg/bg parsed by renderable
          })),
        );
        setFrame({
          cols: cols(),
          rows: rows(),
          cells,
          cursorX,
          cursorY,
          cursorVisible: true,
        });
      } else {
        const cells = ansiToCells(data, cols());
        setFrame({
          cols: cols(),
          rows: rows(),
          cells: cells.slice(-rows()),
          cursorX: 0,
          cursorY: Math.min(rows() - 1, cells.length - 1),
          cursorVisible: true,
        });
      }
    });
  });

  onCleanup(() => {
    try { session()?.kill(); } catch {}
    try { screenHandle?.dispose(); } catch {}
  });

  // resize propagation: pane resize -> renderable.onResize -> session.resize -> proc.resize
  const handleResize = (c: number, r: number) => {
    try { session()?.resize(c, r); } catch {}
    try { screenHandle?.resize(c, r); } catch {}
  };

  // key passthrough — pane-switch intercepts at 10000 above PTY passthrough, so terminal can never trap
  if (props.focused) {
    const off = keymap.intercept(
      "key",
      (evt: { key?: { name?: string; ctrl?: boolean; shift?: boolean; alt?: boolean; meta?: boolean; sequence?: string } }) => {
        const k = evt.key;
        if (!k) return;
        // check if pane-switch combo — return false handled via shouldConsumeForPty early-return (G14)
        const consumed = shouldConsumeForPty(
          { name: k.name, sequence: k.sequence, ctrl: !!k.ctrl, shift: !!k.shift, alt: !!k.alt, meta: !!k.meta },
          {
            isPaneSwitchCombo: (key) => {
              // compare against config defaults — bus/handlers own actual check; here rely on TUI keymap dispatch ordering
              const combos = [taudesk.config().keybinds.pane_switch, taudesk.config().keybinds.pane_switch_reverse];
              // simple check: if ctrl+shift+] pressed
              return (key.ctrl && key.shift && (key.name === "]" || key.sequence === "]")) ||
                (key.ctrl && key.shift && (key.name === "[" || key.sequence === "[")) ;
            },
            toBytes: (key) => keyToPtyBytes({ name: key.name, sequence: key.sequence, ctrl: key.ctrl, shift: key.shift, alt: key.alt, meta: key.meta } as never),
            write: (b: string) => {
              try { session()?.write(b); } catch {}
            },
          },
        );
        if (consumed) {
          // prevent further bubbling already handled via write
        }
      },
      { priority: PRIORITIES.PTY_PASSTHROUGH },
    );
    onCleanup(off);
  }

  return (
    <box flexGrow={1} minHeight={0} flexDirection="column">
      <Show when={frame()}>
        {(f) => (
          // @ts-ignore custom element registered via extend
          <pty_renderable
            width="100%"
            height="100%"
            getFrame={() => f()}
            onResize={handleResize}
            live
          />
        )}
      </Show>
      <Show when={!frame()}>
        <text fg="textMuted">Initializing terminal...</text>
      </Show>
    </box>
  );
}
