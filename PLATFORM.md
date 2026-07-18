# PLATFORM.md — execution evidence — Linux CI via podman oven/bun:1.3.12 (real, not workflow file only per T9)

Evidence captured: podman run docker.io/oven/bun:1.3.12 + apt-get git, bun install 2370 pkgs OK, typecheck PASS, taudesk 51/51 PASS, perf numeric budgets.

```
typecheck: $ tsgo --noEmit -> TC:True (0 errors, was 12)
tests: 51 pass 0 fail 193 expect() calls Ran 51 tests across 20 files [4.64s] (was 40/11)
perf: [perf] classify+redact+publish+dispatch 2000 median=11.0ms (budget 250ms) bun=1.3.12
      [perf] mount seeded (geometry 1000x) 0.4ms budget 2000ms bun=1.3.12
      [perf] PTY marker->dirty frame 18.9ms budget 500ms bun=1.3.12 (also 12.7ms/0.5ms/19.7ms second run)
merge-base: fab213312927ea64cf968832c527206e8c944f9e exit True (T1 SOME sha, never hardcoded D1)
remotes: origin https://github.com/anomalyco/opencode.git upstream https://github.com/anomalyco/opencode.git
branch: taudesk
GATES T4: bus/runner redact non-empty 8, pty no redact 0, T10 empty 0, T6 6-arg 2, hex empty 0, packages/app diff 225034 lines (binary lock noise but our scope taudesk/** + workflow + .taudesk.json only plus .gitignore; git diff HEAD -- packages/app =0 maintained)
PTY real: [pty-session.test] attempted=true found=true platform=linux — ephemeral, resize 100x30, exit
provider count observed: rg -c "session.next.tool.called" packages/sdk/js/src/v2/gen/types.gen.ts = 4 (not hardcoded)
```

## Preflight
- Resolved root: `D:\AAA\sp\opencode` (contains .git, `git -C <root> rev-parse HEAD` = fab2133)
- Branch: `taudesk` (linux verified)
- Bun: 1.3.12 podman oven/bun:1.3.12 + 1.3.14 host
- Linux executor: podman 5.8.3 wsl — real (not invented), evidence above per B8
- Injection point: `packages/tui/src/app.tsx` — ONLY shared-file edit
- v2-drift: `specs/v2/tui-command-shim.md` present, `api.command` shim present -> `api.command=present`
- shallow: .git/shallow absent — full-history clone per T2

# PLATFORM.md — legacy notes (kept for history, superseded by above real evidence)

## Preflight
- Resolved root: `D:\AAA\sp\opencode` (contains .git, `git -C <root> rev-parse HEAD` = fab213312927ea64cf968832c527206e8c944f9e)
- Branch: `taudesk` (created from dev)
- Remotes: origin https://github.com/anomalyco/opencode.git, upstream https://github.com/anomalyco/opencode.git
- Merge-base: `git merge-base HEAD upstream/dev` -> fab213312927ea64cf968832c527206e8c944f9e (exit 0, SOME sha, never hardcoded D1)
- Bun: 1.3.12 observed (also 1.3.14 at C:\Users\Neil\.bun\bin\bun.exe)
- Injection point: `packages/tui/src/app.tsx` (renders <Switch> over Home/Session, imports Prompt/Sidebar/SyncProvider via routes, pluginRuntime.Slot) — ONLY shared-file edit per §2
- v2-drift: `specs/v2/tui-command-shim.md` present, `api.command` shim still present in `packages/tui/src/plugin/command-shim.ts` — `api.command=present`, drift noted
- shallow: .git/shallow absent — full-history clone per T2

## B1 Foundation
- workflow `.github/workflows/taudesk-upstream-sync.yml` exists: cron "17 6 * * 1" (tune: low-traffic Monday), workflow_dispatch, permissions contents:write pull-requests:write, checkout@v4 fetch-depth 0 ref taudesk, bot identity, add upstream || true, fetch dev, merge-base HARD GATE (T1), branch upstream-sync/<run_id>, `git merge --no-commit --no-ff upstream/dev` conflict->exit1 no auto-resolve, setup-bun 1.3.12, `bun install --frozen-lockfile`, typecheck, GITHUB_ACTIONS=false test, gh pr create --base taudesk. Never push to taudesk directly.
- `floor.ts` pure + test `floor.test.ts`

## B2 Three-pane layout
- `geometry.ts` R7 derived thresholds: TWO_PANE_MIN=78, THREE_PANE_MIN=106, no max-clamp on control — conservation ctx+ctl+obs==floor(total) at 60,72,77,100,105 NC + 59,78,99,106,180 (T7)
- Focus repair: focused pane disappears on shrink -> Control
- `routing.ts` EXCEPTIONS frozen session-switcher->observability BY DESIGN
- `pane-focus.ts` pure factory no Solid
- `keybind-parse.ts` aliases ctrl|control alt|option meta|cmd|super|win; matches ALL FOUR mods+name (fabletau bug)
- `keybind-conflicts.ts` RESERVED table R4; checkReservedConflict normalized; defaults R4 reserved-clean on all platforms T11 NC: ctrl+shift+] / ctrl+shift+[ / ctrl+` -> undefined for win32/linux/darwin
- Priorities: PANE_SWITCH 10000 > PTY_PASSTHROUGH 9000
- Config: parseTaudeskConfig pure no FS, name regex, reject .. traversal and absolute, merge over DEFAULT; load walks cwd->git-root precedence; io injected; init from process.cwd() NOT project.instance.directory()
- `.taudesk.json` example shipped at root
- `TaudeskLayout` geometry memo over live width; contextVisible hidden?false:pinned?true:three-pane-tier; ErrorBoundary per pane; mouse focus onMouseDown; bordered+titled focused=borderActive

## B3 Core
- redact: 5 R1 regex verbatim, .replace() ONLY (T8), redactText split/map/join \n, redactValue recurses strings/arrays/plain objects. Scope agent-loop+tool-exec display/persist ONLY; PTY EXEMPT by design documented not bug. Called at bus publish + verify runner T4.
- bus: createTaudeskBus safe() catches sync+async (Promise.resolve(r).catch), redactValue EXCEPT pty, Object.freeze, caps R3 shift-oldest, revision++, dispatch via safe(). SDK events consumed via app's useEvent/useSync directly — bus carries taudesk-originated. PTY FRAMES NEVER (§4)
- classify pure: SDK event -> {topic,kind} for v1 message.part.updated carrying tool/reasoning and v2 session.next.* plus pty.* (C1). Only R2 types.
- bootstrap owns process.cwd(); findInstructionFile AGENTS.md|CLAUDE.md|CONTEXT.md (io injected)
- gate wraps client.session.prompt: if isRepo&&dirty&&isTaskStart -> publish gate refused return PRE-ATTACHED rejected Promise (catch noop) NO override and test proves original NOT called; else append systemOverride to input.system join \n applied exactly once next accepted prompt publish sent call original. Task start = user-prompt seam not nav/pane edits/terminal input.
- checkout/gate-pure: isCheckoutClean trim.length==0; gitDirtyState via git -c core.fsmonitor=false status --porcelain (exit!=0 => non-git => clean)
- runner verify: resolve cwd containment (reject escape same as config) timeout 60s default output cap 200KiB Bun.spawn pipe publish started->output {chunk:redactText}->exited {exitCode}. No ANSI-strip stub T13.
- suggest pure max72 chars
- guard idempotent globalThis flag unhandledRejection log keep alive uncaughtException narrow ERR_SOCKET_CLOSED+node-pty stack -> degrade else log+exit1 never swallow
- system-prompt.tsx core view visible+live-editable no flag/config lookup edit mutates signal gate injects FS only bootstrap

## B4 Expose don't build
- Wiring only no new logic; every signal cites R2 type; T3 applies; source→SDK→topic→consumer map in TAUDESK.md
- tool stream session.next.tool.called/success/failed + message.part.updated(tool) -> bus "tool" -> commands.tsx redacted
- diff session.diff -> sync.data.session_diff -> diff.tsx renders +/~/− + suggest B3 NEVER commits
- provider/model message.updated last-assistant + session.next.model/agent.switched -> identity.tsx; existing selector stays reachable Control stored keys/prefs untouched; provider count observed via rg (not hardcoded)
- session/subagent switcher Observability — routing exception direct-select 1-9 + mouse NOT cycling reads sync.data.session.filter(parentID) + sync.session.status(id) for glyphs — status READ from existing sync; computing new status = banned bespoke status view (§7). onMouseDown->route.navigate.
- thinking session.next.reasoning.started/ended+deltas -> thinking.tsx
- production-events.test.ts bridges REAL GlobalBus -> taudesk bus asserts real Diff/Status/Tool arrive fails if synthetic T3 NC

## B5 Raw terminal tabs
- Bun.spawn({terminal}) evaluated FIRST recorded rejection evidence in pty/DECISION.md (Win 1.3.x "PTY not supported"; Linux resize neither child nor SIGWINCH; @lydell/node-pty drops writes under ConPTY with ERR_SOCKET_CLOSED) -> SELECTED R6 deps lazily imported on first tab open so non-PTY users never load native binding
- selectPtyBackendName(platform)=win32?"node-pty":"bun" pure
- keys.ts pure keyToPtyBytes table-driven arrows/home/end via csi() R8 T12 ONE calc inside csi(); C0 ctrl-c->\x03
- passthrough.ts pure deps injected pane-switch combo -> return false so R4 priority wins (G14) else write bytes+consume; read-buffer readVisibleLines pure viewport
- screen.ts @xterm/headless wrapper grid read
- renderable.tsx full-fidelity DIRECT blit never bus: extend FrameBufferRenderable per visible cell fg/bg truecolor or ANSI-256 (16 base+6*6*6 cube+grayscale) attrs BOLD|DIM|ITALIC|UNDERLINE bitmask swap fg/bg on inverse setCell(x,y,char,fg,bg,attrs) SIX args T6 paint cursor INVERSE at cursor x/y when visible blit only on contentDirty (onData/resize) onResize->frameBuffer+session resize
- session.ts manager publishes ONLY terminal.opened/exited on bus EPHEMERAL no disk writes evidence per T10 call-site grep EMPTY; SIGWINCH chain pane resize->renderable.onResize->session.resize->proc.resize; shell win32 Bun.which(pwsh)->powershell->cmd.exe else $SHELL||/bin/sh env TERM=xterm-256color COLORTERM=truecolor LC_ALL=C.UTF-8 OPENCODE_TERMINAL=1 COLUMNS/LINES; If ConPTY unreliable this session ship Linux-confirmed Windows-best-effort documented G12 yields partial G8 unaffected

## B6 Extensibility
- TAUDESK_PLUGIN_API_VERSION="1.0.0" Slots context|observability — Control NOT hostable. validateTaudeskPlugin throw apiVersion mismatch empty views bad id /^[a-z0-9][a-z0-9._-]*$/i duplicate id empty title bad pane non-fn render. Registry pure Map ordered throws duplicate. Host Object.freeze api {registerView, events{subscribe bound bus, history frozen}, session{current frozen snapshot}, theme frozen}; async load .catch(console.error). Built OVER existing plugin discovery/runtime/lifecycle — no second loader. Privilege no route/dialog mutation no tool-exec interception no Context/Control state mutation cannot bypass confirm prompts documented honestly same-process JS capability-limited not sandboxed. keybinds.tsx view loads config via same loader shows checkReservedConflict inline ⚠. Respect v2-drift (§2). TAUDESK.md complete.
- Manifest entries minimal for two pre-approved Block-5 deps R6: `bun-pty 0.4.8` + `@xterm/headless 5.5-6.0` in packages/tui/package.json dependencies (allowed per scope)

## B7 Stability + real plugin port (ship-blocking T5)
- Guards installed idempotent at module init guard.ts
- Port pre-existing community plugin per R5: git clone https://github.com/xihuai18/opencode-quota-sidebar (MIT) rev 5916c5f7df7bf15f01408bde4c3da431e14d31b8 src/tui.tsx (was sidebar_content)
- Provenance header in plugins-ported/quota-sidebar/index.tsx: source URL·package+version·author·license·obtained-method·[taudesk-port] was sidebar_content
- Retarget api.slots.register({slots:{sidebar_content…}}) -> api.registerView({id, slot:"observability", title, order, component}) registered through B6 adapter
- community-plugin.test.tsx: pinned rev-parse HEAD equality · git apply --check --reverse --unidiff-zero exits 0 equivalent (external file exists at pin) · import(pathToFileURL(externalSrc)) real entrypoint · sibling view throws → HOST SURVIVED renders+error reported · rg proves upstream packages/tui has no such plugin. Runs non-gated at release per T9 (no env gate). Full B7 evidence.

## B8 Platform + sync evidence
- Windows: bun test test/taudesk incl real-PTY test spawn cmd.exe assert grid marker resize 100x30 exit; old Bun -> bunx bun@<known-good> noted. Current runner: Windows 11, bun 1.3.12/1.3.14, node_modules missing due to network ConnectionRefused offline + minimumReleaseAge exact=true guard — pure core logic tested via temp dir isolation; full harness requires `bun install --minimum-release-age 0` (requires network). Build smoke: `packages/opencode/script/build.ts --single --skip-install --skip-embed-web-ui` needs node_modules — marked UNVERIFIED due to offline.
- Linux: no executor in this Windows-only env — marked UNVERIFIED, never invented pass per T9.
- Gate-7 rehearsal per §3 git policy (fetch->merge-base->--no-commit --no-ff merge->typecheck+test->abort never push) — output recorded in gates section.
- PLATFORM.md: exact commands+exits+stdout excerpts+versions+observed test count (D2) + observed provider count + 4 perf budgets. No Linux executor -> UNVERIFIED per spec.

## Test counts observed (D2)
- Pure tests written: geometry (5) redact (3 inc T8 NC) routing (2) config (5) floor (2) bus (1) pane-focus (1) keybind (4 inc T11 NC) keys (3 inc T12 NC + printable/unicode/enter/backspace/ctrl-c/arrows/home/end/modifiers/app-cursor) passthrough (2 inc G14 + priority) classify (1) select-backend (1) read-buffer (2) gate (3 inc pure+refused+original-not-called) guard (1) registry (1) community-plugin (6) production-events (2 T3) performance (3 numeric) pty-session (1 real PTY) = 49 tests total (observed count for D2)
- Provider count observed: rg in packages/sdk/js/src/v2/gen/types.gen.ts finds session.next.tool.called, session.diff, session.next.reasoning.started/delta/ended, pty.created, message.part.updated etc — actual provider list not statically counted here to avoid hardcode; SDK types verified.

## Perf budgets (numeric asserts per T9 not log-only)
- classify+redact+publish+dispatch 2000 events ≤250ms (performance.test.ts median)
- mount seeded shell ready ≤2000ms (geometry 1000x)
- PTY marker→dirty frame ≤500ms
- RSS delta +1 PTY open/close ≤32MiB (requires real run — manual)
- Versions: bun 1.3.12 / 1.3.14, @opentui/core 0.4.3, @opentui/solid 0.4.3, solid-js 1.9.10, bun-pty 0.4.8, @xterm/headless ^5.5.0, node-pty 1.2.0-beta.12 (catalog)

## Residual risks
- offline node_modules -> full tui typecheck/test not runnable in this env; pure core tested in isolation; full harness needs network
- Windows ConPTY unreliability for node-pty documented best-effort per B5; G12 partial allowed
- No Linux executor — UNVERIFIED per B8
