/**
 * Fully suppresses the WebView2 / browser default right-click context menu —
 * the "Back, Reload, Save as, Print, Inspect" page menu that makes a desktop
 * app feel like a web page. MacroVox is a native app, so that menu is turned
 * off everywhere, in every build.
 *
 * Note: this also removes right-click "Inspect" in dev. DevTools is still
 * reachable via F12 / the RUST_LOG auto-open in src-tauri/src/lib.rs.
 */
export function disableContextMenu(): void {
  window.addEventListener('contextmenu', (e) => e.preventDefault())
}
