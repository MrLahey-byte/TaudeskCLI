// pty/tab.tsx — PTY tab bridging session + renderable. No global mutable data, narrow interfaces.
import { createSignal, onCleanup, onMount, Show } from "solid-js";
import { createPtySession, type PtySession } from "./session.ts";
import { type PtyFrame, type PtyCell } from "./renderable.tsx";
import { keyToPtyBytes } from "./keys.ts";
import { shouldConsumeForPty } from "./passthrough.ts";
import { useTaudeskState } from "../state.tsx";
import { PRIORITIES } from "../keybind-conflicts.ts";
import { useOpencodeKeymap } from "../../keymap.tsx";
import { createScreen } from "./screen.ts";

function ansiToCells(data: string, cols: number): PtyCell[][] {
  return data.split("\n").map((line) => line.split("").slice(0, cols).map((ch) => ({ char: ch })));
}

export type PtyTabProps = {
  cwd?: string;
  shell?: string;
  cols?: number;
  rows?: number;
  focused?: boolean;
};

export function PtyTab(props: PtyTabProps) {
  const taudesk = useTaudeskState();
  const keymap = useOpencodeKeymap();

  const [frame, setFrame] = createSignal<PtyFrame | null>(null);
  const [session, setSession] = createSignal<PtySession | null>(null);
  const cols = () => props.cols ?? 80;
  const rows = () => props.rows ?? 24;
  let screenHandle: Awaited<ReturnType<typeof createScreen>> | null = null;

  onMount(async () => {
    screenHandle = await createScreen(cols(), rows());

    const ptySession = await createPtySession({
      cols: cols(),
      rows: rows(),
      cwd: props.cwd,
      shell: props.shell,
      bus: taudesk.bus,
    });
    setSession(ptySession);

    ptySession.onData((chunk) => {
      screenHandle?.write(chunk);
      const grid = screenHandle?.readGrid();
      if (grid && grid.length > 0) {
        const cells: PtyCell[][] = grid.map((row) => row.map((c) => ({ char: c.char ?? " " })));
        setFrame({ cols: cols(), rows: rows(), cells, cursorX: 0, cursorY: grid.length - 1, cursorVisible: true });
      } else {
        const cells = ansiToCells(chunk, cols());
        setFrame({ cols: cols(), rows: rows(), cells: cells.slice(-rows()), cursorX: 0, cursorY: cells.length - 1, cursorVisible: true });
      }
    });
  });

  onCleanup(() => {
    try {
      session()?.kill();
    } catch (error) {
      // Why log: kill may throw if proc already exited; observable for debug, not fatal
      console.error("[taudesk pty] kill failed", error);
    }
    try {
      screenHandle?.dispose();
    } catch (error) {
      console.error("[taudesk pty] screen dispose failed", error);
    }
  });

  function handleResize(newCols: number, newRows: number) {
    try {
      session()?.resize(newCols, newRows);
    } catch (error) {
      console.error("[taudesk pty] resize session failed", error);
    }
    try {
      screenHandle?.resize(newCols, newRows);
    } catch (error) {
      console.error("[taudesk pty] resize screen failed", error);
    }
  }

  // G14: pane-switch intercepts at 10000 above PTY passthrough so terminal can never trap it
  if (props.focused) {
    const off = (keymap as unknown as { intercept: (t: string, h: (e: unknown) => void, o: { priority: number }) => () => void }).intercept(
      "key",
      (evt) => {
        const key = (evt as { key?: { name?: string; ctrl?: boolean; shift?: boolean; alt?: boolean; meta?: boolean; sequence?: string } }).key;
        if (!key) return;
        shouldConsumeForPty(
          { name: key.name, sequence: key.sequence, ctrl: !!key.ctrl, shift: !!key.shift, alt: !!key.alt, meta: !!key.meta },
          {
            isPaneSwitchCombo: (k) => !!(k.ctrl && k.shift && (k.name === "]" || k.name === "[" || k.sequence === "]" || k.sequence === "[")),
            toBytes: (k) => keyToPtyBytes({ name: k.name, sequence: k.sequence, ctrl: k.ctrl, shift: k.shift, alt: k.alt, meta: k.meta }),
            write: (bytes) => {
              try {
                session()?.write(bytes);
              } catch (error) {
                console.error("[taudesk pty] write failed", error);
              }
            },
          },
        );
      },
      { priority: PRIORITIES.PTY_PASSTHROUGH },
    );
    onCleanup(off as unknown as () => void);
  }

  return (
    <box flexGrow={1} minHeight={0} flexDirection="column">
      <Show when={frame()}>
        {(current) => <pty_renderable width="100%" height="100%" getFrame={() => current()} onResize={handleResize} live />}
      </Show>
      <Show when={!frame()}>
        <text fg="textMuted">Initializing terminal...</text>
      </Show>
    </box>
  );
}
