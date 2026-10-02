# Lottie Creator WebMCP: install notes and analysis

Source page: <https://docs.lottiefiles.com/en/creator/13_ai-tools/lottie-creator-webmcp>
(this environment's network policy blocks `docs.lottiefiles.com`, `lottiefiles.com` and
`creator.lottiefiles.com`, so the findings below come from the published npm package
`@lottiefiles/creator-mcp@0.2.2`, which was installed and run, plus the W3C WebMCP spec repo.)

## Two ways to connect an AI to Lottie Creator

| | **WebMCP** (this page) | **Creator MCP bridge** (`@lottiefiles/creator-mcp`) |
|---|---|---|
| Where the tools live | Registered by the Creator web app itself via the browser's WebMCP API (`document.modelContext.registerTool`) | Same tools, relayed from the Creator tab to a local Node process |
| Install | Nothing. On by default in supported browsers | Node 18+, `npx -y @lottiefiles/creator-mcp@latest` |
| Agent | A browser-integrated agent (Chrome/Edge built-in AI, ChatGPT Desktop, Brave Leo…) | Any desktop MCP client (Claude Code/Desktop, Cursor, Codex, VS Code, Gemini CLI…) |
| Transport | In-page, no network hop | stdio (MCP) ⇄ `ws://127.0.0.1:3847` ⇄ Creator tab |
| Extras | "CodeMode" (faster, per LottieFiles) | `export_lottie` deliberately not exposed |

Browser support for WebMCP (spec repo, implementation-status.md):
- **Chrome 149**: origin trial live. For local testing, enable `chrome://flags/#enable-webmcp-testing`.
- **Edge 150**: origin trial live.
- **ChatGPT Desktop**: supported. **Brave**: experimental in Leo.
- **Firefox / Safari**: no support yet (standards-position discussions only).

## Installing

**WebMCP:** open <https://creator.lottiefiles.com> in a supported browser and use that
browser's built-in assistant. Nothing to install.

**Local bridge (installed in this repo):** `.mcp.json` at the repo root registers the server
for Claude Code. The same thing as a one-off command:

```bash
claude mcp add lottiefiles-creator -- npx -y @lottiefiles/creator-mcp@latest
```

Then open Creator, **enable MCP in Creator**, and keep the tab open. Test prompt:
*"What is the active scene size in LottieFiles Creator?"*

Environment overrides read by the bridge: `CREATOR_URL` (default
`https://creator.lottiefiles.com`, also the only allowed WebSocket origin), `WS_PORT`
(default `3847`), `SCRIPT_TIMEOUT_MS` (default 70000, range 1000–300000).

## How the bridge works (from the bundled source)

1. Starts a `ws` server on **127.0.0.1:3847** (loopback only, 10 MB max payload, 5 s pings).
2. Starts an MCP server on stdio and registers every *gateway* tool from LottieFiles'
   shared `motion-copilot-contract` (the same tool contract Motion Copilot uses), with
   zod input schemas.
3. On a tool call it sends `{type:"tool_request", id, name, input}` to the Creator tab. The
   tab replies `tool_request_ack`, then `tool_response` with exactly one of `result`/`error`.
4. Requests are queued and run **one at a time**. After a timeout the pipeline drains before
   it accepts the next call.
5. **Only one tab** may connect (a second gets close code `4001`). If port 3847 is taken,
   it falls back to "limited mode" (MCP only, all calls fail).

There is no `eval`/script tool: the agent can only call typed, native Creator operations.

## Tool catalog (111 in contract, 108 exposed over MCP)

Full names, parameters and descriptions are in [`tools.json`](./tools.json).

| Area | Tools |
|---|---|
| Scene & read | `read_scene`, `list_scenes`, `create_scene`, `switch_scene`, `set_scene_settings`, `set_scene_background` (preview only), `set_current_frame`, `create_scene_layer`, `break_scene_layer` |
| Shapes & layout | `create_shape`, `add_shape_to_layer`, `create_shape_group`, `bend_shape`, `duplicate_layer`, `tile_layer`, `layout`, `align_layer(s)`, `center_layer`, `group_layers`, `reorder_layer`, `reorder_shape`, `flip_layer`, `set_anchor_point`, `create_button`, `create_reference_board` |
| Text | `create_text`, `create_text_group`, `set_text`, `set_text_style`, `measure_text_units`, `split_text`, `list_fonts` |
| Paint & effects | `set_fill`, `set_stroke` (solid + gradients), `set_blend_mode`, `add_drop_shadow`, `add_blur`, `add_color_overlay`, `add_tint`, `add_tritone`, `list/update/remove_layer_effect` |
| Animation | `apply_keyframes`, `animate_property`, `animate_paint`, `read_keyframes`, `remove_keyframes`, `retime_keyframes`, `copy_animation`, `animate_entrance`, `stagger_layers`, `apply_motion_path`, `apply_motion_preset`, `set_group_transform`, `set_layer_time` |
| Physics | `apply_bounce`, `apply_squash`, `apply_coupled_shadow` |
| Masks & mattes | `create_mask`, `update_mask`, `remove_mask`, `set_matte`, `remove_matte` |
| Themes & tokens | `list_themes`, `add/select/remove_theme`, `list_slots`, `create_slot`, `create_slot_from_value`, `update_slot_value`, `link_slot_to_layer`, `unlink_slot`, `list_motion_system_items` |
| Segments | `list/add/rename/remove/select_segment` |
| Interactivity (state machines) | `list/add/remove_state_machine`, `set_active_state_machine`, `list/add/update/remove_state`, `add_global_state`, `set_initial_state`, `set_state_actions`, `add/remove_transition`, `list_interactions`, `add_pointer_interaction`, `add_state_interaction`, `remove_interaction`, `list/add/update/remove_input` |
| Assets | `import_asset` (Lottie/SVG/image), `vectorize_image` |
| Housekeeping | `delete_layer`, `rename_node`, `set_layer_visibility`, `set_layer_lock` |
| Not over local MCP | `export_lottie` (excluded by the bridge); `ask_user`, `inspect_scene` (PNG frame snapshots) are in-app UI tools only |

Notable details in the tool descriptions: new layers go on **top** of the render stack, so
create backgrounds first. Effects render in dotlottie-web, but some don't render in
lottie-web. `set_scene_background` is not exported.

## Verified in this environment

`node smoke-test.mjs` (with the package installed) showed:

- MCP handshake OK: `@lottiefiles/creator-mcp` 0.2.2, **108 tools** listed, `export_lottie` absent.
- `read_scene` with no tab returns a clean `isError`: *"No Creator tab is connected…"*.
- A WebSocket from `Origin: https://evil.example` is rejected (`1008 Origin not allowed`);
  `Origin: https://creator.lottiefiles.com` is accepted.

Not verified: the real Creator ↔ agent round trip and the WebMCP path itself. Both need a
signed-in browser with Creator open, which this headless container can't reach.

## Assessment

- **Pick WebMCP** if you already use a browser with built-in AI: zero install, no local
  port, and it can use CodeMode. Today that effectively means Chromium browsers in an
  origin trial, so availability depends on the browser.
- **Pick the bridge** to drive Creator from Claude Code, Cursor and similar tools. It's the
  same typed tool surface, minus export, and one tab at a time.
- **Security:** the bridge's only gate is the `Origin` header plus loopback binding. That
  stops other websites, but any local process can send that header and pose as the Creator
  tab. There's no token or pairing step. It's low risk on a single-user machine, but worth
  knowing on shared hosts.
- **Maturity:** pre-1.0 (0.1.1 → 0.2.2 between Apr and Sep 2026), MIT-licensed,
  published from GitHub Actions with provenance. The source repo isn't linked from the
  package.
