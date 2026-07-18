// index.tsx — public entry for taudesk module.
// Exports pure core + shell for testing and layout integration.

export { computePaneGeometry, CONTEXT_MIN, CONTEXT_MAX, OBS_MIN, OBS_MAX, CONTROL_MIN, TWO_PANE_MIN, THREE_PANE_MIN } from "./geometry.ts";
export { routeIntent, classifyIntentForRouting, EXCEPTIONS } from "./routing.ts";
export { createPaneFocusState } from "./pane-focus.ts";
export { parseKeyCombo, matchesKeyCombo, normalizeKeyComboString } from "./keybind-parse.ts";
export { checkReservedConflict, DEFAULT_KEYBINDS, PRIORITIES, RESERVED_COMBOS } from "./keybind-conflicts.ts";
export { parseTaudeskConfig, loadTaudeskConfig, DEFAULT_CONFIG } from "./config.ts";
export type { TaudeskConfig } from "./config.ts";
export { redactLine, redactText, redactValue, REDACTION_PATTERNS } from "./redact.ts";
export { createTaudeskBus } from "./bus.ts";
export { classifySdkEvent } from "./classify.ts";
export { assessFloor } from "./floor.ts";
export { isCheckoutClean, parseGitStatusPorcelain } from "./checkout/gate-pure.ts";
export { suggestCommitMessage } from "./suggest.ts";
export { selectPtyBackendName } from "./pty/select-backend.ts";
export { keyToPtyBytes, csi } from "./pty/keys.ts";
export { readVisibleLines, readVisibleLinesFromStrings } from "./pty/read-buffer.ts";
export { shouldConsumeForPty, handleKeyPassthrough } from "./pty/passthrough.ts";
export { TaudeskPluginRegistry, TAUDESK_PLUGIN_API_VERSION, validateTaudeskPlugin } from "./plugin/registry.ts";
export { createTaudeskPluginHost, createTaudeskPluginHostForTest } from "./plugin/host.tsx";
export { createTaudeskState, TaudeskStateProvider, useTaudeskState } from "./state.tsx";
export { bootstrapTaudesk, findInstructionFile, getBootstrapCwd } from "./bootstrap.ts";
export { installProcessGuard } from "./guard.ts";
export { checkGateDirty, createGateWrapper, isTaskStart } from "./gate.ts";
export { runVerifyCommand } from "./runner.ts";
export { TaudeskLayout } from "./layout.tsx";
export { PtyRenderable, PtyRenderableView } from "./pty/renderable.tsx";
export { createPtySession } from "./pty/session.ts";
