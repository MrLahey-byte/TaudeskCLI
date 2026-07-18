# taudesk v1 — three-pane TUI

Mission: surface-fork `anomalyco/opencode` (MIT) into a three-pane TUI — Context / Control / Observability — on OpenCode's existing terminal client. INHERIT and EXPOSE (never rebuild): agent loop, tool exec, provider routing, session persistence, streaming, diff preview, plugin ecosystem.

## Architecture

### Functional core (pure, no @opentui/*, no bus, I/O injected, unit-tested)
- `redact` — 5 R1 regex via `.replace()` ONLY (T8)
- `routing` — lookup→context, action→control, confirmation→observability; EXCEPTIONS frozen session-switcher→observability BY DESIGN
- `pane-focus` — pure factory (no Solid): get/set/cycle wraps / subscribe / repair (focus->Control if focused disappears on shrink)
- `keybind-parse` + `keybind-conflicts` — parse with aliases ctrl|control, alt|option, meta|cmd|super|win; matches ALL FOUR mods; RESERVED table R4; defaults R4 reserved-clean (T11)
- `config/parse` — pure name regex, reject .. traversal and absolute, merge over DEFAULT; load walks cwd→git-root precedence
- `floor` — assessFloor consumes observed probes not static table
- `suggest` — commit message max 72 chars
- `checkout/gate-pure` — isCheckoutClean, parseGitStatus
- `pty/{select-backend,keys,read-buffer,passthrough}` — keys table-driven arrows via csi() R8 (ONE calc, meta excluded T12); passthrough early-return so pane-switch wins (G14)
- `classify` — SDK event → {topic,kind} for v1 and v2 shapes plus pty.*

### Imperative shell (thin glue)
- `bus` — createTaudeskBus safe() catches sync+async, redactValue EXCEPT topic "pty", freeze, caps R3 shift-oldest, revision++
- `runner` — verify: resolve cwd containment, 60s default timeout, 200KiB cap, Bun.spawn pipe, publish started→output {chunk: redactText}→exited
- `gate` — wraps prompt: isRepo && dirty && isTaskStart -> refused + PRE-ATTACHED rejected promise (.catch noop) + original NOT called
- `state` — per-instance signals, no module-level signal leak; focus+bus+config+systemPrompt+ptyTabs inside provider
- `bootstrap` — owns process.cwd() + instruction-file AGENTS.md/CLAUDE.md/CONTEXT.md discovery (IO injected)
- `guard` — idempotent via globalThis flag; unhandledRejection log keep-alive; uncaughtException narrow ERR_SOCKET_CLOSED+node-pty degrade else exit(1)
- `layout/shell` — geometry memo over live width; contextVisible = hidden?false:pinned?true:three-pane-tier; ErrorBoundary per pane; mouse focus onMouseDown
- `pty/{session,renderable}` — session publishes ONLY opened/exited on bus, EPHEMERAL no disk writes; SIGWINCH chain pane resize→renderable.onResize→session.resize→proc.resize; shell win32 Bun.which(pwsh)->powershell->cmd.exe else $SHELL||/bin/sh; renderable full-fidelity DIRECT blit never bus (60fps frame firehose) — 6-arg setCell + INVERSE cursor visible

## OS gatekeeping
Only bus/tool-exec layer touches FS/git/process for agent-loop and tool-exec. EXCEPTION: PTY tab owns child directly (same tier as tool-exec) and blits cell frames STRAIGHT to its own renderer never bus. Only PTY lifecycle rides bus. I/O allowlist only these touch FS/process/dynamic-import: `bootstrap.ts runner.ts config.ts gate.ts guard.ts plugin/host.tsx pty/session.ts pty/*-backend.ts`

## UI doctrine — OpenTUI, harder
Terminal is canvas not log. Theme tokens only, NEVER hex in views: `text textMuted primary secondary accent success warning error background backgroundElement backgroundPanel border borderActive selected selectedListItemText diffAdded diffRemoved`. Panes bordered+titled focused=borderActive. Views semantic color: tool ✓success/✗error/running-accent + BOLD command + textMuted output + ellipsis; diff +diffAdded/-diffRemoved hunk accent BOLD; thinking textMuted ITALIC; switcher colored glyphs ○/●/◐ selected-row bg subagent depth tree active marker accent; identity agent·provider/model.

## File tree (exact)
```
packages/tui/src/taudesk/
  index.tsx layout.tsx geometry.ts routing.ts state.tsx bus.ts classify.ts redact.ts config.ts floor.ts gate.ts guard.ts suggest.ts bootstrap.ts
  checkout/gate-pure.ts runner.ts
  pty/ select-backend.ts bun-backend.ts node-pty-backend.ts keys.ts passthrough.ts screen.ts read-buffer.ts renderable.tsx session.ts tab.tsx DECISION.md
  panes/ context.tsx control.tsx observability.tsx fallback.tsx
  views/ system-prompt.tsx thinking.tsx commands.tsx diff.tsx switcher.tsx verify.tsx identity.tsx keybinds.tsx
  plugin/ registry.ts host.tsx
  plugins-ported/ quota-sidebar/ // REAL external per T5 R5
packages/tui/test/taudesk/
  geometry redact routing config floor suggest keys passthrough select-backend read-buffer classify bus gate guard registry pane-focus keybind community-plugin production-events performance pty-session
top: .github/workflows/taudesk-upstream-sync.yml .taudesk.json TAUDESK.md PLATFORM.md
```

## Config
```json
{
  "keybinds": { "pane_switch": "ctrl+shift+]", "pane_switch_reverse": "ctrl+shift+[", "terminal_toggle": "ctrl+`" },
  "verify": { "commands": [{ "name": "typecheck", "command": "bun turbo typecheck --continue" }]},
  "contextMode": "auto|hidden|pinned"
}
```
Precedence defaults < root-most < nearest, within dir taudesk.json < .taudesk.json; io injected; init from process.cwd() NOT project.instance.directory() (empty pre-sync race).

## Source→SDK→topic→consumer event map
| Source | SDK event | Topic | Consumer |
|---|---|---|---|
| tool call | session.next.tool.called | tool | commands.tsx (redacted) |
| tool result | session.next.tool.success/failed + message.part.updated(tool) | tool | commands.tsx |
| diff | session.diff → sync.data.session_diff | diff | diff.tsx (+suggest, NEVER commits) |
| model/agent | message.updated last-assistant + session.next.model/agent.switched | identity | identity.tsx; selector stays in Control |
| switcher | sync.data.session.filter(parentID) + sync.session.status(id) | session | switcher.tsx (Observability — routing exception) direct-select 1-9 + mouse, glyphs ○/●/◐, status READ not computed |
| thinking | session.next.reasoning.started/ended+deltas | thinking | thinking.tsx |
| pty lifecycle | pty.created/exited | pty | session manager publishes opened/exited only |
| verify | (taudesk-originated) | verify | verify.tsx output REDACTED |
| checkout | (taudesk-originated) | checkout | gate publishes refused/sent |

Only R2 types used; every wired signal cites SDK type verified by rg.

## Plugin API
`TAUDESK_PLUGIN_API_VERSION="1.0.0"`. Slots: context|observability — Control NOT hostable. validateTaudeskPlugin throws on apiVersion mismatch, empty views, bad id /^[a-z0-9][a-z0-9._-]*$/i, duplicate id, empty title, bad pane, non-fn render. Registry pure Map ordered throws duplicate. Host Object.freeze api {registerView, events{sub, history frozen}, session{current frozen}, theme frozen}; async load .catch(console.error). Built OVER existing plugin discovery/runtime/lifecycle — no second loader. Privilege: no route/dialog mutation, no tool-exec interception, no Context/Control state mutation, cannot bypass confirms; same-process JS capability-limited not sandboxed.

## Migration worked
`sidebar_content` → `registerView`:
```ts
// Before (original external)
api.slots.register({ slots: { sidebar_content(_ctx, props) { return <SidebarContentView api={api} sessionID={props.session_id} /> } } })
// After (taudesk port)
api.registerView({ id: "leo.quota-sidebar", slot: "observability", title: "Quota Sidebar (Ported)", order: 100, component: (props) => <SidebarContentPorted sessionID={props.session_id} /> })
```

## Floor
- Tier1 100% KEEP; unreachable=LOST=blocks release: multi-provider routing (exposed Control, stored keys/prefs unmodified) · session persistence (zero silent loss — PTY ephemerality NOT violation) · headless opencode -p (CLI untouched) · Plan/Build diff-before-apply (session_diff populated, diff viewer intact) · plugin system (runtime+host+app slots rendered)
- Tier2 degradation allowed WITH documented fallback: LSP→verify commands · reconnect/resume mark uncertain restart · subagent/Explore keybind/command reachable · sidebar plugins migration path + B7 port · scrollback ephemeral only
- Tier3 OUT_OF_SCOPE: desktop/web parity · Zen marketplace · PR-review triggers · cross-project tabs

## Deps (pre-approved R6, not perf-budget)
`bun-pty 0.4.8` + `@xterm/headless 5.5–6.0` lazy-imported on first tab open so non-PTY users never load native binding. Shell env TERM=xterm-256color COLORTERM=truecolor LC_ALL=C.UTF-8 OPENCODE_TERMINAL=1 COLUMNS/LINES. Linux-confirmed Windows-best-effort documented.
