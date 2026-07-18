# PTY backend decision

## Evaluated

### Bun.spawn({ terminal })

- **Win 1.3.x:** "PTY not supported" — `terminal` option rejected.
- **Linux resize:** child does not receive SIGWINCH nor size updates via this path.
- Evidence: `bun --version 1.3.12` test spawn with terminal:true throws on win32, and resize no-op on linux.

### @lydell/node-pty

- **Win32:** works via ConPTY, but drops writes under load with uncatchable `ERR_SOCKET_CLOSED`.
- **Behavior:** `write()` after close throws `ERR_SOCKET_CLOSED`; no recovery path; upstream issue observed.
- Evidence: guard.ts catches ERR_SOCKET_CLOSED + node-pty stack to degrade tabs.

## Selected

- **win32:** `node-pty` (best-effort, guarded, documented)
- **linux/darwin:** `bun-pty 0.4.8` (native, lightweight)

Both lazily imported on first tab open so non-PTY users never load native binding (B5).

### Deps (R6 pre-approved, not a perf-budget call)

- `bun-pty 0.4.8`
- `@xterm/headless 5.5–6.0` (grid parsing)

Shell env: `TERM=xterm-256color COLORTERM=truecolor LC_ALL=C.UTF-8 OPENCODE_TERMINAL=1 COLUMNS/LINES`.

Platform: Linux-confirmed, Windows-best-effort. G12 yields partial on win32 if ConPTY unreliable; G8 perf unaffected.
