use super::Services;
use editor_md::fonts;
use serde_json::{json, Value};

#[tauri::command]
pub(crate) async fn list_fonts(state: tauri::State<'_, Services>) -> Result<Value, String> {
    let root = state.root.clone();
    tauri::async_runtime::spawn_blocking(
        move || json!({"system":fonts::system_families(),"custom":fonts::list(&root)}),
    )
    .await
    .map_err(|e| e.to_string())
}
#[tauri::command]
pub(crate) async fn import_custom_font(
    state: tauri::State<'_, Services>,
) -> Result<Option<fonts::CustomFont>, String> {
    let root = state.root.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let picked = if std::env::args().any(|arg| arg == "--smoke-test") {
            Some(
                std::path::PathBuf::from(std::env::var("WINDIR").map_err(|e| e.to_string())?)
                    .join("Fonts/arial.ttf"),
            )
        } else {
            rfd::FileDialog::new()
                .set_title("Load a custom document font")
                .add_filter("TrueType / OpenType font", &["ttf", "otf"])
                .pick_file()
        };
        picked.map(|path| fonts::import(&root, &path)).transpose()
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
pub(crate) async fn read_custom_font(
    state: tauri::State<'_, Services>,
    id: String,
) -> Result<tauri::ipc::Response, String> {
    let root = state.root.clone();
    tauri::async_runtime::spawn_blocking(move || {
        fonts::read(&root, &id).map(tauri::ipc::Response::new)
    })
    .await
    .map_err(|e| e.to_string())?
}
