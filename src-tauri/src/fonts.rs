use crate::{atomic_write, revision};
use serde::{Deserialize, Serialize};
use std::{collections::BTreeSet, fs, io::Read, path::Path};
const MAX_FONT: u64 = 32 * 1024 * 1024;
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomFont {
    pub id: String,
    pub family: String,
    pub weight: u16,
    pub style: String,
}
pub fn system_families() -> Vec<String> {
    let mut db = fontdb::Database::new();
    db.load_system_fonts();
    db.faces()
        .flat_map(|face| face.families.first().map(|(name, _)| name.clone()))
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect()
}
fn describe(bytes: Vec<u8>, id: String) -> Result<CustomFont, String> {
    let mut db = fontdb::Database::new();
    db.load_font_data(bytes);
    if db.len() > 1 {
        return Err("Choose an individual TTF or OTF font, rather than a collection.".into());
    }
    let face = db
        .faces()
        .next()
        .ok_or("This is not a supported TrueType or OpenType font.")?;
    if face.index != 0 {
        return Err("Choose an individual TTF or OTF font, rather than a collection.".into());
    }
    Ok(CustomFont {
        id,
        family: face
            .families
            .first()
            .ok_or("This font has no family name.")?
            .0
            .clone(),
        weight: face.weight.0,
        style: match face.style {
            fontdb::Style::Italic => "italic",
            fontdb::Style::Oblique => "oblique",
            _ => "normal",
        }
        .into(),
    })
}
fn bytes(path: &Path) -> Result<Vec<u8>, String> {
    let mut data = Vec::new();
    fs::File::open(path)
        .map_err(|e| e.to_string())?
        .take(MAX_FONT + 1)
        .read_to_end(&mut data)
        .map_err(|e| e.to_string())?;
    if data.len() as u64 > MAX_FONT {
        return Err("Choose a font smaller than 32 MiB.".into());
    }
    Ok(data)
}
fn valid_id(id: &str) -> bool {
    id.len() == 64 && id.bytes().all(|c| c.is_ascii_hexdigit())
}
pub fn import(root: &Path, picked: &Path) -> Result<CustomFont, String> {
    let ext = picked
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if !matches!(ext.as_str(), "ttf" | "otf") {
        return Err("Choose a TTF or OTF font file.".into());
    }
    let data = bytes(picked)?;
    let font = describe(data.clone(), revision(&data))?;
    let folder = root.join("fonts");
    fs::create_dir_all(&folder).map_err(|e| e.to_string())?;
    atomic_write(&folder.join(format!("{}.font", font.id)), &data)?;
    Ok(font)
}
pub fn list(root: &Path) -> Vec<CustomFont> {
    let Ok(entries) = fs::read_dir(root.join("fonts")) else {
        return Vec::new();
    };
    entries
        .flatten()
        .filter_map(|entry| {
            let path = entry.path();
            let id = path.file_stem()?.to_str()?;
            if path.extension()?.to_str()? != "font" || !valid_id(id) {
                return None;
            }
            let data = bytes(&path).ok()?;
            if revision(&data) != id {
                return None;
            }
            describe(data, id.into()).ok()
        })
        .collect()
}
pub fn read(root: &Path, id: &str) -> Result<Vec<u8>, String> {
    if !valid_id(id) {
        return Err("Invalid custom font identifier.".into());
    }
    let data = bytes(&root.join("fonts").join(format!("{id}.font")))?;
    if revision(&data) != id {
        return Err("The custom font file has changed. Import it again.".into());
    }
    Ok(data)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_non_fonts_and_escaping_ids() {
        let root = tempfile::tempdir().unwrap();
        let bad = root.path().join("bad.ttf");
        fs::write(&bad, b"not a font").unwrap();
        assert!(import(root.path(), &bad).is_err());
        assert!(read(root.path(), "../../workspace").is_err());
        assert!(list(root.path()).is_empty());
    }
    #[cfg(windows)]
    #[test]
    fn imports_valid_font_persistently_without_installing() {
        let root = tempfile::tempdir().unwrap();
        let system = std::env::var("WINDIR").unwrap();
        let path = std::path::PathBuf::from(system).join("Fonts/arial.ttf");
        let first = import(root.path(), &path).unwrap();
        let second = import(root.path(), &path).unwrap();
        assert_eq!(first.id, second.id);
        assert_eq!(list(root.path()).len(), 1);
        assert_eq!(first.family, "Arial");
        assert!(!read(root.path(), &first.id).unwrap().is_empty());
    }
}
