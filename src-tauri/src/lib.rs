mod audio;
mod commands;
mod state;

use commands::*;
use state::AppState;
use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(
            // Ctrl+Space — show/toggle the dictation window
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state() != ShortcutState::Pressed {
                        return;
                    }
                    let ctrl_space =
                        Shortcut::new(Some(Modifiers::CONTROL), Code::Space);
                    if shortcut != &ctrl_space {
                        return;
                    }
                    if let Some(window) = app.get_webview_window("main") {
                        if window.is_visible().unwrap_or(false) {
                            // Window is visible — toggle recording
                            let _ = window.emit("quick-dictation-toggle", ());
                        } else {
                            // Window is hidden — show it, then start recording
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.emit("quick-dictation-toggle", ());
                        }
                    }
                })
                .build(),
        )
        .manage(AppState::default())
        .setup(|app| {
            // Register Ctrl+Space global shortcut
            app.global_shortcut()
                .register(Shortcut::new(Some(Modifiers::CONTROL), Code::Space))?;

            // Minimize-to-tray close handler: intercept the close event on the
            // main window and hide instead of destroying if the setting is on.
            let main_window = app
                .get_webview_window("main")
                .expect("main window not found");
            let app_handle = app.handle().clone();
            main_window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    let state = app_handle.state::<AppState>();
                    let minimize = *state.minimize_to_tray.lock().unwrap();
                    if minimize {
                        api.prevent_close();
                        if let Some(win) = app_handle.get_webview_window("main") {
                            let _ = win.hide();
                        }
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Audio
            audio_list_devices,
            audio_set_device,
            audio_start,
            audio_stop,
            audio_get_level,
            // Deepgram streaming
            deepgram_start,
            deepgram_stop,
            // Buffered recording
            recording_start,
            recording_stop,
            recording_cancel,
            // Clipboard & auto-paste
            clipboard_write,
            dictation_auto_paste,
            // Window settings
            dictation_set_always_on_top,
            settings_open_window,
            app_set_minimize_to_tray,
            // Theme & settings broadcast
            theme_broadcast,
            settings_broadcast,
            // Auth (stubs — removed in Phase 6)
            auth_get_user,
            auth_sign_up_email,
            auth_sign_in_email,
            auth_sign_in_oauth,
            auth_sign_out,
            auth_reset_password,
            auth_get_subscription,
            auth_get_managed_keys,
            auth_checkout,
            auth_billing_portal,
        ])
        .run(tauri::generate_context!())
        .expect("error while running MacroVox");
}
