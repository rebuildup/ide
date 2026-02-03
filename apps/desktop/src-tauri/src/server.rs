use tokio::process::{Command, Child};
use std::path::PathBuf;

pub struct ServerHandle {
    child: Child,
    pub port: u16,
}

pub async fn start(port: u16) -> Result<ServerHandle, String> {
    // Check if we're in development mode
    if is_development_mode() {
        start_dev_server(port).await
    } else {
        start_production_server(port).await
    }
}

pub async fn stop(handle: ServerHandle) -> Result<(), String> {
    handle.child.kill()
        .await
        .map_err(|e| format!("Failed to stop server: {}", e))?;
    Ok(())
}

fn is_development_mode() -> bool {
    // Check if we're running in development environment
    std::env::var("TAURI_DEV")
        .or_else(|_| std::env::var("DEBUG"))
        .is_ok()
        || !std::env::current_exe()
            .map(|p| p.extension().is_some())
            .unwrap_or(false)
}

async fn start_dev_server(port: u16) -> Result<ServerHandle, String> {
    // Find the project root (where package.json exists)
    let project_root = find_project_root()
        .map_err(|e| format!("Failed to find project root: {}", e))?;

    let server_dir = project_root.join("apps").join("server");

    // Use npm to run the server in development mode
    let child = Command::new("npm")
        .current_dir(&server_dir)
        .arg("run")
        .arg("dev")
        .spawn()
        .map_err(|e| format!("Failed to start dev server: {}. Ensure npm is in PATH", e))?;

    Ok(ServerHandle { child, port })
}

async fn start_production_server(port: u16) -> Result<ServerHandle, String> {
    let server_path = get_server_executable_path().await?;

    let child = Command::new(&server_path)
        .arg("--port")
        .arg(port.to_string())
        .spawn()
        .map_err(|e| format!("Failed to start server: {}", e))?;

    Ok(ServerHandle { child, port })
}

async fn get_server_executable_path() -> Result<PathBuf, String> {
    let mut exe_path = std::env::current_exe()
        .map_err(|e| format!("Failed to get exe path: {}", e))?;

    exe_path.pop(); // Remove exe name
    exe_path.push("server");

    #[cfg(windows)]
    {
        exe_path.set_extension("exe");
    }

    Ok(exe_path)
}

fn find_project_root() -> Result<PathBuf, String> {
    let current_dir = std::env::current_dir()
        .map_err(|e| format!("Failed to get current dir: {}", e))?;

    let mut path = current_dir;

    // Search up for package.json
    for _ in 0..10 {
        let package_json = path.join("package.json");
        if package_json.exists() {
            return Ok(path);
        }
        if !path.pop() {
            break;
        }
    }

    // Fallback: try relative paths from the exe
    let exe_path = std::env::current_exe()
        .map_err(|e| format!("Failed to get exe path: {}", e))?;

    let mut search_path = exe_path;
    search_path.pop();

    // In dev, exe is in target/debug, go up to project root
    for _ in 0..5 {
        let package_json = search_path.join("package.json");
        if package_json.exists() {
            return Ok(search_path);
        }
        if !search_path.pop() {
            break;
        }
    }

    Err("Could not find project root (package.json)".to_string())
}
