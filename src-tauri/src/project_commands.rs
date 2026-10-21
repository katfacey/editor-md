use super::{read_document, register_document, DiskDocument, Services};
use editor_md::{
    atomic_write,
    project::{self, Buffer, Project, Search},
};
use notify::{EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Deserialize;
use serde_json::{json, Value};
use std::{
    collections::BTreeMap,
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
};
use tauri::{Emitter, Manager};

#[derive(Default)]
pub(crate) struct ProjectServices {
    pub root: Mutex<Option<PathBuf>>,
    watcher: Mutex<Option<RecommendedWatcher>>,
}
pub(crate) fn refresh_watches(app: &tauri::AppHandle) -> Result<(), String> {
    let state = app.state::<Services>();
    let project_root = state
        .project
        .root
        .lock()
        .map_err(|e| e.to_string())?
        .clone();
    let mut roots = BTreeMap::new();
    if let Some(root) = &project_root {
        roots.insert(root.clone(), true);
    }
    for path in state.handles.lock().map_err(|e| e.to_string())?.values() {
        if project_root
            .as_ref()
            .is_some_and(|root| path.starts_with(root))
        {
            continue;
        }
        if let Some(parent) = path.parent() {
            roots.entry(parent.to_path_buf()).or_insert(false);
        }
    }
    let handle = app.clone();
    let watched: Vec<PathBuf> = roots.keys().cloned().collect();
    let data_root = state.root.clone();
    let mut watcher =
        notify::recommended_watcher(move |result: notify::Result<notify::Event>| match result {
            Ok(event)
                if !matches!(event.kind, EventKind::Access(_))
                    && (event.paths.is_empty()
                        || event.paths.iter().any(|path| {
                            if path.parent() == Some(data_root.as_path())
                                && matches!(
                                    path.file_name().and_then(|s| s.to_str()),
                                    Some("workspace.json" | "project.json" | "smoke-result.json")
                                )
                            {
                                return false;
                            }
                            let relative = watched
                                .iter()
                                .filter_map(|root| path.strip_prefix(root).ok())
                                .min_by_key(|relative| relative.components().count())
                                .unwrap_or(path);
                            !project::excluded(relative)
                                && !relative
                                    .components()
                                    .any(|part| part.as_os_str().to_string_lossy().starts_with('.'))
                        })) =>
            {
                let _ = handle.emit("native-files-changed", ());
            }
            Err(error) => {
                let _ = handle.emit("native-watch-error", error.to_string());
            }
            _ => (),
        })
        .map_err(|e| e.to_string())?;
    let mut warnings = Vec::new();
    for (root, recursive) in roots {
        if let Err(error) = watcher.watch(
            &root,
            if recursive {
                RecursiveMode::Recursive
            } else {
                RecursiveMode::NonRecursive
            },
        ) {
            warnings.push(format!("Could not watch {}: {error}", root.display()));
        }
    }
    *state.project.watcher.lock().map_err(|e| e.to_string())? = Some(watcher);
    if warnings.is_empty() {
        let _ = app.emit("native-watch-ready", ());
        Ok(())
    } else {
        Err(warnings.join("\n"))
    }
}
fn root_of(state: &Services) -> Result<PathBuf, String> {
    state
        .project
        .root
        .lock()
        .map_err(|e| e.to_string())?
        .clone()
        .ok_or_else(|| "Open a project folder first.".into())
}
fn document_path(state: &Services, id: &str) -> Result<PathBuf, String> {
    state
        .handles
        .lock()
        .map_err(|e| e.to_string())?
        .get(id)
        .cloned()
        .ok_or_else(|| "Save this document before using relative attachments.".into())
}
fn asset_path(state: &Services, id: &str, target: &str) -> Result<PathBuf, String> {
    let document = document_path(state, id)?;
    let project = state
        .project
        .root
        .lock()
        .map_err(|e| e.to_string())?
        .clone();
    let root = project
        .filter(|root| document.starts_with(root))
        .or_else(|| document.parent().map(Path::to_path_buf))
        .ok_or("Missing document folder")?;
    project::resolve(&root, &document, target)
}
fn select_project(app: &tauri::AppHandle, root: PathBuf) -> Result<Project, String> {
    let root = fs::canonicalize(root).map_err(|e| e.to_string())?;
    let project = project::scan(&root)?;
    let state = app.state::<Services>();
    atomic_write(
        &state.root.join("project.json"),
        &serde_json::to_vec(&json!({"root":root.to_string_lossy()})).map_err(|e| e.to_string())?,
    )?;
    *state.project.root.lock().map_err(|e| e.to_string())? = Some(root);
    if let Err(error) = refresh_watches(app) {
        let _ = app.emit("native-watch-error", error);
    }
    Ok(project)
}
#[tauri::command]
pub(crate) async fn open_project(app: tauri::AppHandle) -> Result<Option<Project>, String> {
    let Some(root) = rfd::FileDialog::new()
        .set_title("Open project folder")
        .pick_folder()
    else {
        return Ok(None);
    };
    tauri::async_runtime::spawn_blocking(move || select_project(&app, root))
        .await
        .map_err(|e| e.to_string())?
        .map(Some)
}
#[tauri::command]
pub(crate) async fn restore_project(app: tauri::AppHandle) -> Result<Option<Project>, String> {
    let state = app.state::<Services>();
    let path = state.root.join("project.json");
    if std::env::args().any(|a| a == "--smoke-test") || !path.exists() {
        return Ok(None);
    }
    let config: Value = serde_json::from_str(&fs::read_to_string(path).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    let Some(root) = config["root"].as_str().map(PathBuf::from) else {
        return Ok(None);
    };
    tauri::async_runtime::spawn_blocking(move || select_project(&app, root))
        .await
        .map_err(|e| e.to_string())?
        .map(Some)
}
#[tauri::command]
pub(crate) async fn refresh_project(
    app: tauri::AppHandle,
    state: tauri::State<'_, Services>,
    restart: bool,
) -> Result<Option<Project>, String> {
    if restart {
        if let Err(error) = refresh_watches(&app) {
            let _ = app.emit("native-watch-error", error);
        }
    }
    let root = state
        .project
        .root
        .lock()
        .map_err(|e| e.to_string())?
        .clone();
    let Some(root) = root else { return Ok(None) };
    tauri::async_runtime::spawn_blocking(move || project::scan(&root))
        .await
        .map_err(|e| e.to_string())?
        .map(Some)
}
#[tauri::command]
pub(crate) async fn close_project(
    app: tauri::AppHandle,
    state: tauri::State<'_, Services>,
) -> Result<(), String> {
    atomic_write(&state.root.join("project.json"), b"{}")?;
    *state.project.root.lock().map_err(|e| e.to_string())? = None;
    refresh_watches(&app)
}
#[tauri::command]
pub(crate) async fn open_project_document(
    app: tauri::AppHandle,
    state: tauri::State<'_, Services>,
    path: String,
) -> Result<DiskDocument, String> {
    let root = root_of(&state)?;
    let target = project::project_file(&root, &path)?;
    let document = register_document(&state, &target)?;
    if let Err(error) = refresh_watches(&app) {
        let _ = app.emit("native-watch-error", error);
    }
    Ok(document)
}
#[tauri::command]
pub(crate) async fn reload_document(
    state: tauri::State<'_, Services>,
    id: String,
) -> Result<DiskDocument, String> {
    read_document(&document_path(&state, &id)?, id)
}
#[tauri::command]
pub(crate) async fn search_project(
    state: tauri::State<'_, Services>,
    query: String,
    case_sensitive: bool,
    buffers: Vec<Buffer>,
) -> Result<Search, String> {
    let root = root_of(&state)?;
    tauri::async_runtime::spawn_blocking(move || {
        project::search(&root, &query, case_sensitive, buffers)
    })
    .await
    .map_err(|e| e.to_string())?
}
#[derive(Deserialize)]
pub(crate) struct DiskCheck {
    id: String,
    revision: String,
}
#[tauri::command]
pub(crate) async fn check_documents(
    state: tauri::State<'_, Services>,
    checks: Vec<DiskCheck>,
) -> Result<Vec<Value>, String> {
    let handles = state.handles.lock().map_err(|e| e.to_string())?.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mut changed = Vec::new();
        for check in checks {
            let Some(path) = handles.get(&check.id) else { continue; };
            match read_document(path, check.id.clone()) {
                Ok(document) if document.revision == check.revision => (),
                Ok(document) => changed.push(json!({"id":check.id,"baseline":check.revision,"kind":"modified","document":document})),
                Err(error) => changed.push(json!({"id":check.id,"baseline":check.revision,"kind":if matches!(path.try_exists(),Ok(false)){"missing"}else{"error"},"error":error})),
            }
        }
        changed
    }).await.map_err(|e|e.to_string())
}
#[tauri::command]
pub(crate) async fn read_attachment(
    state: tauri::State<'_, Services>,
    id: String,
    target: String,
) -> Result<tauri::ipc::Response, String> {
    let path = asset_path(&state, &id, &target)?;
    if project::image_mime(&path).is_none() {
        return Err("Inline preview supports PNG, JPEG, GIF, and WebP images.".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        project::attachment_bytes(&path).map(tauri::ipc::Response::new)
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
pub(crate) async fn open_relative_document(
    app: tauri::AppHandle,
    state: tauri::State<'_, Services>,
    id: String,
    target: String,
) -> Result<DiskDocument, String> {
    let document = register_document(&state, &asset_path(&state, &id, &target)?)?;
    if let Err(error) = refresh_watches(&app) {
        let _ = app.emit("native-watch-error", error);
    }
    Ok(document)
}
#[tauri::command]
pub(crate) async fn open_wiki_document(
    app: tauri::AppHandle,
    state: tauri::State<'_, Services>,
    id: Option<String>,
    target: String,
) -> Result<DiskDocument, String> {
    let document = id
        .as_deref()
        .and_then(|id| state.handles.lock().ok()?.get(id).cloned());
    let root = state
        .project
        .root
        .lock()
        .map_err(|e| e.to_string())?
        .clone()
        .filter(|root| {
            document
                .as_ref()
                .map(|doc| doc.starts_with(root))
                .unwrap_or(true)
        })
        .or_else(|| {
            document
                .as_deref()
                .and_then(Path::parent)
                .map(Path::to_path_buf)
        })
        .ok_or("Open a project folder or save this document to resolve wiki links.")?;
    let path = tauri::async_runtime::spawn_blocking(move || {
        project::wiki_file(&root, document.as_deref(), &target)
    })
    .await
    .map_err(|e| e.to_string())??;
    let doc = register_document(&state, &path)?;
    if let Err(error) = refresh_watches(&app) {
        let _ = app.emit("native-watch-error", error);
    }
    Ok(doc)
}
#[tauri::command]
pub(crate) async fn open_attachment(
    state: tauri::State<'_, Services>,
    id: Option<String>,
    target: String,
) -> Result<(), String> {
    let path = if let Some(id) = id {
        asset_path(&state, &id, &target)?
    } else {
        project::project_file(&root_of(&state)?, &target)?
    };
    let extension = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if !matches!(
        extension.as_str(),
        "pdf"
            | "txt"
            | "csv"
            | "png"
            | "jpg"
            | "jpeg"
            | "gif"
            | "webp"
            | "mp3"
            | "wav"
            | "mp4"
            | "webm"
            | "docx"
            | "xlsx"
            | "pptx"
    ) {
        return Err(
            "This attachment type cannot be opened from Editor, MD. Use File Explorer to open it."
                .into(),
        );
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        std::process::Command::new("explorer.exe")
            .arg(path)
            .creation_flags(0x08000000)
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
    #[cfg(not(windows))]
    {
        let _ = path;
        Err("Attachment launching is currently supported on Windows.".into())
    }
}

#[tauri::command]
pub(crate) async fn insert_attachment(
    state: tauri::State<'_, Services>,
    id: String,
    image_only: bool,
) -> Result<Option<Value>, String> {
    let document = document_path(&state, &id)?;
    let root = state
        .project
        .root
        .lock()
        .map_err(|e| e.to_string())?
        .clone()
        .filter(|root| document.starts_with(root))
        .or_else(|| document.parent().map(Path::to_path_buf))
        .ok_or("Missing document folder")?;
    let data_root = state.root.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mut dialog = rfd::FileDialog::new().set_title(if image_only {
            "Insert image"
        } else {
            "Insert attachment"
        });
        if image_only {
            dialog = dialog.add_filter("Images", &["png", "jpg", "jpeg", "gif", "webp"]);
        }
        let chosen = if std::env::args().any(|arg| arg == "--smoke-test") {
            let path = data_root.join("wide-image.png");
            atomic_write(&path, include_bytes!("../../tests/fixtures/wide-image.png"))?;
            Some(path)
        } else {
            dialog.pick_file()
        };
        let Some(picked) = chosen else {
            return Ok(None);
        };
        let picked = fs::canonicalize(picked).map_err(|e| e.to_string())?;
        if image_only && project::image_mime(&picked).is_none() {
            return Err("Choose a PNG, JPEG, GIF, or WebP image.".into());
        }
        Ok(Some(
            serde_json::to_value(project::import_attachment(&root, &document, &picked)?)
                .map_err(|e| e.to_string())?,
        ))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub(crate) async fn smoke_project(app: tauri::AppHandle, action: String) -> Result<Value, String> {
    if !std::env::args().any(|a| a == "--smoke-test") {
        return Err("Available only in the built-in smoke test.".into());
    }
    let state = app.state::<Services>();
    let root = state.root.join("project-fixture");
    fs::create_dir_all(root.join("notes")).map_err(|e| e.to_string())?;
    fs::create_dir_all(root.join("assets")).map_err(|e| e.to_string())?;
    match action.as_str() {
        "setup" => {
            atomic_write(&root.join("notes/first.md"),b"# First\n\nProject needle in unopened file.\n\n![Test](../assets/pixel.png)\n\n[Second](second.md)\n")?;
            atomic_write(
                &root.join("notes/second.md"),
                "# Second\n\nUnicode 二 needle.\n".as_bytes(),
            )?;
            // A complete, valid 1×1 PNG.
            atomic_write(
                &root.join("assets/pixel.png"),
                &[
                    137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0,
                    0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 11, 73, 68, 65, 84, 120, 156,
                    99, 96, 0, 2, 0, 0, 5, 0, 1, 165, 246, 69, 64, 0, 0, 0, 0, 73, 69, 78, 68, 174,
                    66, 96, 130,
                ],
            )?;
            Ok(serde_json::to_value(select_project(&app, root)?).map_err(|e| e.to_string())?)
        }
        "modify" => {
            atomic_write(
                &root.join("notes/first.md"),
                b"# Changed externally\n\nExternal needle.\n",
            )?;
            Ok(json!(null))
        }
        "modify-again" => {
            atomic_write(
                &root.join("notes/first.md"),
                b"# Changed again\n\nAnother external update.\n",
            )?;
            Ok(json!(null))
        }
        "delete" => {
            fs::remove_file(root.join("notes/first.md")).map_err(|e| e.to_string())?;
            Ok(json!(null))
        }
        _ => Err("Unknown test operation".into()),
    }
}
