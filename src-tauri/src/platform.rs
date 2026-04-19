use std::path::Path;

pub fn open_in_file_manager(path: &Path) {
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("explorer").arg(path).spawn();
    }
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open").arg(path).spawn();
    }
    #[cfg(target_os = "linux")]
    {
        let _ = std::process::Command::new("xdg-open").arg(path).spawn();
    }
}

/// True on Linux running under a Wayland session.
///
/// Checked at every call site rather than cached, because the session can
/// differ between app launch (e.g. a service daemon) and the actual user
/// session, and because `WAYLAND_DISPLAY` can be set by XWayland-hosted
/// apps even when `XDG_SESSION_TYPE=x11`.
///
/// Used by: `dictation_auto_paste` (skip the `enigo` key injection — it is
/// not reliable on Wayland; clipboard write still succeeds so the user can
/// paste manually) and by the renderer's Settings UI (surface the
/// limitation to the user instead of silently swallowing it).
#[cfg(target_os = "linux")]
pub fn is_wayland() -> bool {
    if std::env::var("XDG_SESSION_TYPE")
        .map(|v| v.eq_ignore_ascii_case("wayland"))
        .unwrap_or(false)
    {
        return true;
    }
    std::env::var("WAYLAND_DISPLAY").is_ok()
}

#[cfg(not(target_os = "linux"))]
pub fn is_wayland() -> bool {
    false
}
