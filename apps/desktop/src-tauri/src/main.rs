// Prevents additional console window on Windows in release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod server;
mod window;

use tauri::Manager;
use std::sync::Mutex;

struct ServerState(std::Mutex<Option<server::ServerHandle>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(ServerState(std::Mutex::new(None)))
        .setup(|app| {
            window::setup(app)?;

            // Auto-start server on app launch
            let state = app.state::<ServerState>();
            let handle = app.handle();
            tauri::async_runtime::spawn(async move {
                // Wait a bit for the app to initialize
                tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

                let mut server_state = state.0.lock().unwrap();
                if server_state.is_none() {
                    match server::start(8787).await {
                        Ok(handle) => {
                            println!("Server auto-started on port 8787");
                            *server_state = Some(handle);
                        }
                        Err(e) => {
                            eprintln!("Failed to auto-start server: {}", e);
                        }
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::start_server,
            commands::stop_server,
            commands::get_server_status,
            commands::get_server_logs,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run();
}
