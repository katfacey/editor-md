#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use editor_md::{
    atomic_write, checked_write, decode_markdown, encode_markdown, launch_paths, read_utf8,
    revision, Page,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
};
use tauri::{Emitter, Manager};
mod project_commands;

// Cargo uses SemVer; the hotfix is displayed as the requested 0.1.3.1.
fn display_version() -> String {
    env!("CARGO_PKG_VERSION").replace("-hotfix.", ".")
}

struct Services {
    root: PathBuf,
    handles: Mutex<HashMap<String, PathBuf>>,
    closing: AtomicBool,
    frontend_ready: AtomicBool,
    pending_paths: Arc<Mutex<Vec<PathBuf>>>,
    project: project_commands::ProjectServices,
}
#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct DiskDocument {
    id: String,
    name: String,
    path: String,
    source: String,
    page: Page,
    revision: String,
}

fn read_document(path: &Path, id: String) -> Result<DiskDocument, String> {
    if !matches!(
        path.extension()
            .and_then(|s| s.to_str())
            .map(str::to_ascii_lowercase)
            .as_deref(),
        Some("md" | "markdown" | "mdown")
    ) {
        return Err("Select a .md, .markdown, or .mdown file.".into());
    }
    let raw = read_utf8(path)?;
    let (source, page) = decode_markdown(&raw);
    Ok(DiskDocument {
        id,
        name: path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .into(),
        path: path.to_string_lossy().into(),
        source,
        page,
        revision: revision(raw.as_bytes()),
    })
}

fn register_document(state: &Services, path: &Path) -> Result<DiskDocument, String> {
    let canonical =
        fs::canonicalize(path).map_err(|error| format!("{}: {error}", path.display()))?;
    let mut handles = state.handles.lock().map_err(|e| e.to_string())?;
    let id = handles
        .iter()
        .find(|(_, existing)| {
            existing.to_string_lossy().to_lowercase() == canonical.to_string_lossy().to_lowercase()
        })
        .map(|(id, _)| id.clone())
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let document = read_document(&canonical, id.clone())?;
    handles.insert(id, canonical);
    Ok(document)
}
fn pending_documents(state: &Services) -> Result<Value, String> {
    let paths = std::mem::take(&mut *state.pending_paths.lock().map_err(|e| e.to_string())?);
    let mut documents = Vec::new();
    let mut errors = Vec::new();
    for path in paths {
        match register_document(state, &path) {
            Ok(doc) => documents.push(doc),
            Err(error) => errors.push(error),
        }
    }
    Ok(json!({"documents":documents,"errors":errors}))
}
#[tauri::command]
async fn take_pending_documents(
    app: tauri::AppHandle,
    state: tauri::State<'_, Services>,
) -> Result<Value, String> {
    let result = pending_documents(&state);
    if let Err(error) = project_commands::refresh_watches(&app) {
        let _ = app.emit("native-watch-error", error);
    }
    result
}

#[tauri::command]
async fn bootstrap(state: tauri::State<'_, Services>) -> Result<Value, String> {
    let smoke_test = std::env::args().any(|a| a == "--smoke-test");
    let path = state.root.join("workspace.json");
    let workspace: Value = if path.exists() && !smoke_test {
        if fs::metadata(&path).map_err(|e| e.to_string())?.len() > 64 * 1024 * 1024 {
            return Err("Recovery workspace exceeds 64 MiB.".into());
        }
        serde_json::from_str(&fs::read_to_string(&path).map_err(|e| e.to_string())?)
            .map_err(|e| format!("Could not read recovery workspace: {e}"))?
    } else {
        Value::Null
    };
    let mut disks = Vec::new();
    let mut warnings = Vec::new();
    if let Some(files) = workspace.get("files").and_then(Value::as_array) {
        for file in files {
            if let (Some(id), Some(path)) = (file["id"].as_str(), file["nativePath"].as_str()) {
                match fs::canonicalize(path)
                    .map_err(|e| e.to_string())
                    .and_then(|path| read_document(&path, id.into()))
                {
                    Ok(doc) => {
                        state
                            .handles
                            .lock()
                            .map_err(|e| e.to_string())?
                            .insert(id.into(), PathBuf::from(&doc.path));
                        disks.push(doc);
                    }
                    Err(error) => warnings.push(format!("{path}: {error}")),
                }
            }
        }
    }
    let mut launch = Vec::new();
    if smoke_test {
        let path = state.root.join("native-smoke.md");
        atomic_write(
            &path,
            b"# Native smoke test\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n",
        )?;
        let doc = read_document(&path, uuid::Uuid::new_v4().to_string())?;
        state
            .handles
            .lock()
            .map_err(|e| e.to_string())?
            .insert(doc.id.clone(), path);
        launch.push(doc);
    }
    let pending = pending_documents(&state)?;
    for document in pending["documents"].as_array().unwrap() {
        launch.push(serde_json::from_value(document.clone()).map_err(|e| e.to_string())?);
    }
    for error in pending["errors"].as_array().unwrap() {
        warnings.push(error.as_str().unwrap_or_default().to_string());
    }
    Ok(
        json!({"workspace":workspace,"disks":disks,"launch":launch,"warnings":warnings,"dataDirectory":state.root.to_string_lossy(),"version":display_version(),"smokeTest":smoke_test}),
    )
}

#[tauri::command]
async fn open_documents(
    app: tauri::AppHandle,
    state: tauri::State<'_, Services>,
) -> Result<Vec<DiskDocument>, String> {
    let paths = rfd::FileDialog::new()
        .set_title("Open Markdown")
        .add_filter("Markdown", &["md", "markdown", "mdown"])
        .pick_files()
        .unwrap_or_default();
    let mut docs = Vec::new();
    for path in paths {
        docs.push(register_document(&state, &path)?);
    }
    if let Err(error) = project_commands::refresh_watches(&app) {
        let _ = app.emit("native-watch-error", error);
    }
    Ok(docs)
}

#[tauri::command]
async fn save_document(
    app: tauri::AppHandle,
    state: tauri::State<'_, Services>,
    id: String,
    name: String,
    source: String,
    page: Page,
    expected_revision: Option<String>,
    save_as: bool,
) -> Result<Option<DiskDocument>, String> {
    let content = encode_markdown(&source, &page)?;
    let existing = state
        .handles
        .lock()
        .map_err(|e| e.to_string())?
        .get(&id)
        .cloned();
    let picked = save_as || existing.is_none();
    let path = if picked {
        let filename = Path::new(&name)
            .file_name()
            .unwrap_or_default()
            .to_string_lossy();
        let mut dialog = rfd::FileDialog::new()
            .set_title("Save Markdown")
            .set_file_name(filename.as_ref())
            .add_filter("Markdown", &["md"]);
        if let Some(parent) = existing.as_ref().and_then(|p| p.parent()) {
            dialog = dialog.set_directory(parent);
        }
        match dialog.save_file() {
            Some(mut path) => {
                if path.extension().is_none() {
                    path.set_extension("md");
                }
                path
            }
            None => return Ok(None),
        }
    } else {
        existing.unwrap()
    };
    if picked {
        atomic_write(&path, content.as_bytes())?;
    } else {
        checked_write(
            &path,
            expected_revision
                .as_deref()
                .ok_or("No saved revision; use Save as.")?,
            content.as_bytes(),
        )?;
    }
    let path = fs::canonicalize(&path).unwrap_or(path);
    state
        .handles
        .lock()
        .map_err(|e| e.to_string())?
        .insert(id.clone(), path.clone());
    if let Err(error) = project_commands::refresh_watches(&app) {
        let _ = app.emit("native-watch-error", error);
    }
    Ok(Some(DiskDocument {
        id,
        name: path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .into(),
        path: path.to_string_lossy().into(),
        source,
        page,
        revision: revision(content.as_bytes()),
    }))
}

#[tauri::command]
async fn save_workspace(state: tauri::State<'_, Services>, workspace: Value) -> Result<(), String> {
    let encoded = serde_json::to_vec(&workspace).map_err(|e| e.to_string())?;
    if encoded.len() > 64 * 1024 * 1024 {
        return Err("Recovery workspace exceeds 64 MiB; save and close large documents.".into());
    }
    atomic_write(&state.root.join("workspace.json"), &encoded)
}

#[tauri::command]
async fn export_document(
    name: String,
    content: String,
    format: String,
    page: Option<Page>,
) -> Result<Option<String>, String> {
    let extension = match format.as_str() {
        "md" => "md",
        "html" => "html",
        _ => return Err("Unsupported export format.".into()),
    };
    let filename = Path::new(&name)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy();
    let Some(mut path) = rfd::FileDialog::new()
        .set_title("Export document")
        .set_file_name(filename.as_ref())
        .add_filter(format.as_str(), &[extension])
        .save_file()
    else {
        return Ok(None);
    };
    if path.extension().is_none() {
        path.set_extension(extension);
    }
    let output = if format == "md" {
        encode_markdown(&content, &page.unwrap_or_default())?
    } else {
        content
    };
    atomic_write(&path, output.as_bytes())?;
    Ok(Some(path.to_string_lossy().into()))
}

#[tauri::command]
fn finish_close(
    state: tauri::State<'_, Services>,
    window: tauri::WebviewWindow,
) -> Result<(), String> {
    state.closing.store(true, Ordering::SeqCst);
    window.close().map_err(|e| e.to_string())
}

#[tauri::command]
fn print_document(window: tauri::WebviewWindow) -> Result<(), String> {
    window.print().map_err(|e| e.to_string())
}

#[tauri::command]
fn desktop_ready(app: tauri::AppHandle, state: tauri::State<'_, Services>) {
    state.frontend_ready.store(true, Ordering::SeqCst);
    if let Err(error) = project_commands::refresh_watches(&app) {
        let _ = app.emit("native-watch-error", error);
    }
    if state
        .pending_paths
        .lock()
        .map(|paths| !paths.is_empty())
        .unwrap_or(false)
    {
        let _ = app.emit("native-open-requested", ());
    }
}

#[tauri::command]
fn smoke_result(
    app: tauri::AppHandle,
    state: tauri::State<'_, Services>,
    result: Value,
) -> Result<(), String> {
    if !std::env::args().any(|a| a == "--smoke-test") {
        return Err("Available only in the built-in smoke test.".into());
    }
    atomic_write(
        &state.root.join("smoke-result.json"),
        &serde_json::to_vec_pretty(&result).map_err(|e| e.to_string())?,
    )?;
    app.exit(if result["ok"].as_bool() == Some(true) {
        0
    } else {
        1
    });
    Ok(())
}

#[tauri::command]
fn smoke_external_change(state: tauri::State<'_, Services>) -> Result<String, String> {
    if !std::env::args().any(|a| a == "--smoke-test") {
        return Err("Available only in the built-in smoke test.".into());
    }
    let saved = read_utf8(&state.root.join("native-smoke.md"))?;
    atomic_write(
        &state.root.join("native-smoke.md"),
        b"# External change must be kept\n",
    )?;
    Ok(saved)
}

#[tauri::command]
async fn smoke_launch_secondary(state: tauri::State<'_, Services>) -> Result<(), String> {
    if !std::env::args().any(|a| a == "--smoke-test") {
        return Err("Available only in the built-in smoke test.".into());
    }
    for name in ["Explorer one.md", "Explorer 二.md"] {
        atomic_write(
            &state.root.join(name),
            b"# Forwarded from another process\n",
        )?;
    }
    let mut command =
        std::process::Command::new(std::env::current_exe().map_err(|e| e.to_string())?);
    command.current_dir(&state.root).args([
        "--smoke-child",
        "Explorer one.md",
        "Explorer 二.md",
        "Explorer one.md",
    ]);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    let mut child = command.spawn().map_err(|e| e.to_string())?;
    for _ in 0..400 {
        if let Some(status) = child.try_wait().map_err(|e| e.to_string())? {
            return if status.success() {
                Ok(())
            } else {
                Err(format!("Secondary process exited with {status}"))
            };
        }
        std::thread::sleep(std::time::Duration::from_millis(25));
    }
    let _ = child.kill();
    let _ = child.wait();
    Err("Secondary process did not forward to the existing window.".into())
}

fn data_directory(app: &tauri::App) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let smoke_test = std::env::args().any(|a| a == "--smoke-test" || a == "--smoke-child");
    let portable = std::env::current_exe()?
        .parent()
        .ok_or("Missing executable directory")?
        .join(if smoke_test {
            "EditorMD-smoke"
        } else {
            "EditorMD-data"
        });
    if fs::create_dir_all(&portable).is_ok() {
        let probe = portable.join(".write-check");
        if fs::write(&probe, b"").is_ok() {
            let _ = fs::remove_file(probe);
            return Ok(portable);
        }
    }
    let fallback = app.path().app_local_data_dir()?;
    fs::create_dir_all(&fallback)?;
    Ok(fallback)
}

fn main() {
    if std::env::args().any(|a| a == "--self-test") {
        let root = tempfile::tempdir().expect("temporary directory");
        let path = root.path().join("smoke.md");
        atomic_write(&path, b"# Editor, MD\n").expect("write");
        assert_eq!(read_utf8(&path).unwrap(), "# Editor, MD\n");
        return;
    }
    let pending = Arc::new(Mutex::new(launch_paths(
        std::env::args().collect::<Vec<_>>(),
        &std::env::current_dir().unwrap_or_default(),
    )));
    let forwarded = pending.clone();
    let mut context = tauri::generate_context!();
    let isolated = std::env::args().any(|a| a == "--smoke-test" || a == "--smoke-child");
    if isolated {
        context.config_mut().identifier.push_str(".smoke");
    }
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(move |app, args, cwd| {
            let paths = launch_paths(args, Path::new(&cwd));
            if let Ok(mut queue) = forwarded.lock() {
                queue.extend(paths);
            }
            if let Some(services) = app.try_state::<Services>() {
                if services.frontend_ready.load(Ordering::SeqCst) {
                    let _ = app.emit("native-open-requested", ());
                }
            }
            if !isolated {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.unminimize();
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        }))
        .setup(move |app| {
            let root = data_directory(app)?;
            let profile = root.join("webview");
            app.manage(Services {
                root,
                handles: Mutex::new(HashMap::new()),
                closing: AtomicBool::new(false),
                frontend_ready: AtomicBool::new(false),
                pending_paths: pending.clone(),
                project: project_commands::ProjectServices::default(),
            });
            let window = tauri::WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::App("index.html".into()),
            )
            .title(format!("Editor, MD — {} Beta Hotfix", display_version()))
            .inner_size(1440.0, 960.0)
            .min_inner_size(800.0, 600.0)
            .visible(!isolated)
            .data_directory(profile)
            .on_navigation(|url| {
                matches!(url.scheme(), "tauri")
                    || (matches!(url.scheme(), "http" | "https")
                        && matches!(url.host_str(), Some("tauri.localhost" | "localhost")))
            })
            .build()?;
            let handle = app.handle().clone();
            window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    let services = handle.state::<Services>();
                    if services.frontend_ready.load(Ordering::SeqCst)
                        && !services.closing.load(Ordering::SeqCst)
                    {
                        api.prevent_close();
                        let _ = handle.emit("native-close-requested", ());
                    }
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            bootstrap,
            take_pending_documents,
            open_documents,
            save_document,
            save_workspace,
            export_document,
            finish_close,
            print_document,
            desktop_ready,
            smoke_result,
            smoke_external_change,
            smoke_launch_secondary,
            project_commands::open_project,
            project_commands::restore_project,
            project_commands::refresh_project,
            project_commands::close_project,
            project_commands::open_project_document,
            project_commands::reload_document,
            project_commands::search_project,
            project_commands::check_documents,
            project_commands::read_attachment,
            project_commands::open_relative_document,
            project_commands::open_attachment,
            project_commands::insert_attachment,
            project_commands::smoke_project
        ])
        .run(context)
        .expect("Could not start Editor, MD. Ensure the Microsoft WebView2 Runtime is installed.");
}
