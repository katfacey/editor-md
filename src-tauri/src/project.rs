use crate::{decode_markdown, read_utf8};
use regex::{Regex, RegexBuilder};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
};

const MAX_ENTRIES: usize = 10_000;
const MAX_HITS: usize = 200;
const SEARCH_BUDGET: usize = 128 * 1024 * 1024;
pub const MAX_ATTACHMENT_BYTES: u64 = 32 * 1024 * 1024;

pub fn excluded(path: &Path) -> bool {
    path.components().any(|part| {
        matches!(
            part.as_os_str().to_str(),
            Some(
                ".git"
                    | "node_modules"
                    | "target"
                    | ".tools"
                    | "EditorMD-data"
                    | "EditorMD-smoke"
                    | ".obsidian"
                    | ".editor-md"
            )
        )
    })
}
pub fn markdown_file(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_ascii_lowercase()
            .as_str(),
        "md" | "markdown" | "mdown"
    )
}
pub fn image_mime(path: &Path) -> Option<&'static str> {
    match path.extension()?.to_str()?.to_ascii_lowercase().as_str() {
        "png" => Some("image/png"),
        "jpg" | "jpeg" => Some("image/jpeg"),
        "gif" => Some("image/gif"),
        "webp" => Some("image/webp"),
        _ => None,
    }
}
pub fn portable_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    pub path: String,
    pub name: String,
    pub kind: String,
    pub size: u64,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub root: String,
    pub name: String,
    pub entries: Vec<Entry>,
    pub warnings: Vec<String>,
    pub truncated: bool,
}
pub fn scan(root: &Path) -> Result<Project, String> {
    if !root.is_dir() {
        return Err(
            "The project folder is unavailable. Reconnect it or choose another folder.".into(),
        );
    }
    let mut project = Project {
        root: root.to_string_lossy().into(),
        name: root
            .file_name()
            .unwrap_or(root.as_os_str())
            .to_string_lossy()
            .into(),
        entries: Vec::new(),
        warnings: Vec::new(),
        truncated: false,
    };
    let mut pending = vec![(root.to_path_buf(), 0)];
    while let Some((folder, depth)) = pending.pop() {
        if depth > 32 {
            project
                .warnings
                .push(format!("Folder depth limit: {}", folder.display()));
            continue;
        }
        let children = match fs::read_dir(&folder) {
            Ok(entries) => entries,
            Err(error) => {
                project
                    .warnings
                    .push(format!("{}: {error}", folder.display()));
                continue;
            }
        };
        for child in children {
            let child = match child {
                Ok(value) => value,
                Err(error) => {
                    project.warnings.push(error.to_string());
                    continue;
                }
            };
            let path = child.path();
            let relative = path.strip_prefix(root).map_err(|e| e.to_string())?;
            if excluded(relative) || child.file_name().to_string_lossy().starts_with('.') {
                continue;
            }
            let metadata = match fs::symlink_metadata(&path) {
                Ok(value) => value,
                Err(error) => {
                    project
                        .warnings
                        .push(format!("{}: {error}", relative.display()));
                    continue;
                }
            };
            // Reparse points/symlinks are not followed into other folders.
            if metadata.file_type().is_symlink() {
                continue;
            }
            #[cfg(windows)]
            {
                use std::os::windows::fs::MetadataExt;
                if metadata.file_attributes() & 0x400 != 0 {
                    continue;
                }
            }
            if project.entries.len() >= MAX_ENTRIES {
                project.truncated = true;
                pending.clear();
                break;
            }
            let directory = metadata.is_dir();
            if !directory && !metadata.is_file() {
                continue;
            }
            project.entries.push(Entry {
                path: portable_path(relative),
                name: child.file_name().to_string_lossy().into(),
                kind: if directory {
                    "folder"
                } else if markdown_file(&path) {
                    "markdown"
                } else if image_mime(&path).is_some() {
                    "image"
                } else {
                    "attachment"
                }
                .into(),
                size: metadata.len(),
            });
            if directory {
                pending.push((path, depth + 1));
            }
        }
    }
    project
        .entries
        .sort_by(|a, b| a.path.to_lowercase().cmp(&b.path.to_lowercase()));
    Ok(project)
}

/// Resolve an existing relative URL, checking its final canonical destination.
pub fn resolve(root: &Path, document: &Path, target: &str) -> Result<PathBuf, String> {
    let normalized = target.replace('\\', "/");
    if normalized.starts_with('/') || normalized.contains(':') {
        return Err("Choose a relative file inside the project folder.".into());
    }
    let base = tauri::Url::from_file_path(document).map_err(|_| "Invalid document path")?;
    let url = base.join(&normalized).map_err(|e| e.to_string())?;
    let path = url
        .to_file_path()
        .map_err(|_| "Invalid local attachment path")?;
    let canonical =
        fs::canonicalize(&path).map_err(|e| format!("Could not find {}: {e}", path.display()))?;
    let root = fs::canonicalize(root).map_err(|e| e.to_string())?;
    if !canonical.starts_with(&root) {
        return Err(
            "That file is outside this project. Open its containing project folder to access it."
                .into(),
        );
    }
    Ok(canonical)
}
pub fn project_file(root: &Path, relative: &str) -> Result<PathBuf, String> {
    let relative = Path::new(relative);
    if relative.is_absolute() || relative.to_string_lossy().contains(':') {
        return Err("Choose a relative path inside the project.".into());
    }
    let root = fs::canonicalize(root).map_err(|e| e.to_string())?;
    let target = fs::canonicalize(root.join(relative)).map_err(|e| e.to_string())?;
    if !target.starts_with(root) {
        return Err("That file is outside the selected project.".into());
    }
    Ok(target)
}

pub fn attachment_bytes(path: &Path) -> Result<Vec<u8>, String> {
    let mut bytes = Vec::new();
    fs::File::open(path)
        .map_err(|e| e.to_string())?
        .take(MAX_ATTACHMENT_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    if bytes.len() as u64 > MAX_ATTACHMENT_BYTES {
        return Err("Attachment import and preview support files up to 32 MiB.".into());
    }
    Ok(bytes)
}
#[derive(Serialize)]
pub struct ImportedAttachment {
    pub target: String,
    pub name: String,
    pub image: bool,
}
pub fn import_attachment(
    root: &Path,
    document: &Path,
    picked: &Path,
) -> Result<ImportedAttachment, String> {
    let picked = fs::canonicalize(picked).map_err(|e| e.to_string())?;
    let root = fs::canonicalize(root).map_err(|e| e.to_string())?;
    let bytes = attachment_bytes(&picked)?;
    let target = if picked.starts_with(&root) {
        picked
    } else {
        let folder = root.join("attachments");
        fs::create_dir_all(&folder).map_err(|e| e.to_string())?;
        let folder = fs::canonicalize(folder).map_err(|e| e.to_string())?;
        if !folder.starts_with(&root) {
            return Err("The attachments folder points outside the project.".into());
        }
        let stem = picked.file_stem().unwrap_or_default().to_string_lossy();
        let extension = picked
            .extension()
            .map(|s| format!(".{}", s.to_string_lossy()))
            .unwrap_or_default();
        let mut temp = tempfile::NamedTempFile::new_in(&folder).map_err(|e| e.to_string())?;
        temp.write_all(&bytes).map_err(|e| e.to_string())?;
        temp.as_file().sync_all().map_err(|e| e.to_string())?;
        let mut suffix = 1;
        loop {
            let name = if suffix == 1 {
                picked
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .into_owned()
            } else {
                format!("{stem} ({suffix}){extension}")
            };
            let target = folder.join(name);
            match temp.persist_noclobber(&target) {
                Ok(_) => break target,
                Err(error) if error.error.kind() == std::io::ErrorKind::AlreadyExists => {
                    temp = error.file;
                    suffix += 1;
                }
                Err(error) => return Err(error.error.to_string()),
            }
        }
    };
    let base = tauri::Url::from_file_path(document).map_err(|_| "Invalid document path")?;
    let url = tauri::Url::from_file_path(&target).map_err(|_| "Invalid attachment path")?;
    Ok(ImportedAttachment {
        target: base
            .make_relative(&url)
            .ok_or("Could not make a relative attachment link")?
            .replace('(', "%28")
            .replace(')', "%29"),
        name: target
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .into(),
        image: image_mime(&target).is_some(),
    })
}

#[derive(Deserialize)]
pub struct Buffer {
    pub path: String,
    pub source: String,
}
#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Hit {
    pub path: String,
    pub line: usize,
    pub start: usize,
    pub end: usize,
    pub excerpt: String,
    pub filename: bool,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Search {
    pub hits: Vec<Hit>,
    pub searched: usize,
    pub truncated: bool,
    pub warnings: Vec<String>,
}
fn add_hits(path: &str, source: &str, pattern: &Regex, hits: &mut Vec<Hit>) -> bool {
    let mut offset = 0;
    let mut count = 0;
    for (index, line) in source.split_inclusive('\n').enumerate() {
        for found in pattern.find_iter(line) {
            if hits.len() >= MAX_HITS || count >= 20 {
                return true;
            }
            let start = offset + line[..found.start()].encode_utf16().count();
            let chars: Vec<char> = line.trim_end_matches(['\r', '\n']).chars().collect();
            let at = line[..found.start()].chars().count();
            let left = at.saturating_sub(55);
            let right = (at + 100).min(chars.len());
            hits.push(Hit {
                path: path.into(),
                line: index + 1,
                start,
                end: start + found.as_str().encode_utf16().count(),
                excerpt: format!(
                    "{}{}{}",
                    if left > 0 { "…" } else { "" },
                    chars[left..right].iter().collect::<String>(),
                    if right < chars.len() { "…" } else { "" }
                ),
                filename: false,
            });
            count += 1;
        }
        offset += line.encode_utf16().count();
    }
    false
}
pub fn search(
    root: &Path,
    query: &str,
    case_sensitive: bool,
    buffers: Vec<Buffer>,
) -> Result<Search, String> {
    if query.trim().is_empty() {
        return Ok(Search {
            hits: Vec::new(),
            searched: 0,
            truncated: false,
            warnings: Vec::new(),
        });
    }
    if query.len() > 512 {
        return Err("Search for a phrase up to 512 bytes long.".into());
    }
    let pattern = RegexBuilder::new(&regex::escape(query))
        .case_insensitive(!case_sensitive)
        .build()
        .map_err(|e| e.to_string())?;
    let project = scan(root)?;
    let mut output = Search {
        hits: Vec::new(),
        searched: 0,
        truncated: project.truncated,
        warnings: project.warnings,
    };
    let mut live = HashMap::new();
    let mut supplied = 0;
    for buffer in buffers {
        supplied += buffer.source.len();
        if supplied > 64 * 1024 * 1024 {
            return Err("Open buffers exceed the search memory limit.".into());
        }
        if let Ok(path) = project_file(root, &buffer.path) {
            live.insert(path, buffer.source);
        }
    }
    let mut bytes = 0;
    for entry in project
        .entries
        .into_iter()
        .filter(|entry| entry.kind != "folder")
    {
        if output.hits.len() >= MAX_HITS {
            output.truncated = true;
            break;
        }
        if pattern.is_match(&entry.path) {
            output.hits.push(Hit {
                path: entry.path.clone(),
                line: 0,
                start: 0,
                end: 0,
                excerpt: entry.name.clone(),
                filename: true,
            });
        }
        if entry.kind != "markdown" {
            continue;
        }
        let path = match project_file(root, &entry.path) {
            Ok(value) => value,
            Err(error) => {
                output.warnings.push(error);
                continue;
            }
        };
        let source = if let Some(source) = live.remove(&path) {
            source
        } else {
            match read_utf8(&path) {
                Ok(raw) => decode_markdown(&raw).0,
                Err(error) => {
                    output.warnings.push(format!("{}: {error}", entry.path));
                    continue;
                }
            }
        };
        bytes += source.len();
        if bytes > SEARCH_BUDGET {
            output.truncated = true;
            break;
        }
        output.searched += 1;
        if add_hits(&entry.path, &source, &pattern, &mut output.hits) {
            output.truncated = true;
        }
    }
    Ok(output)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn imports_keep_originals_and_use_unique_portable_paths() {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join("project");
        fs::create_dir_all(root.join("notes")).unwrap();
        let picked = temp.path().join("图 #1.png");
        fs::write(&picked, b"image contents").unwrap();
        let doc = fs::canonicalize(root.join("notes"))
            .unwrap()
            .join("test.md");
        let one = import_attachment(&root, &doc, &picked).unwrap();
        let two = import_attachment(&root, &doc, &picked).unwrap();
        assert_eq!(one.name, "图 #1.png");
        assert_eq!(two.name, "图 #1 (2).png");
        assert!(one.target.contains("%23"));
        assert_eq!(
            fs::read(resolve(&root, &doc, &one.target).unwrap()).unwrap(),
            b"image contents"
        );
        assert_eq!(fs::read(picked).unwrap(), b"image contents");
        assert!(project_file(&root, "attachments/图 #1.png").is_ok());
    }
    #[test]
    fn folder_scan_search_and_live_buffers() {
        let temp = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(temp.path()).unwrap();
        fs::create_dir(root.join("notes")).unwrap();
        fs::create_dir(root.join(".git")).unwrap();
        fs::write(root.join("notes/二.md"), "# Unopened\n\n😀 Café needle\n").unwrap();
        fs::write(root.join(".git/hidden.md"), "needle").unwrap();
        fs::write(root.join("manual.pdf"), "pdf").unwrap();
        let project = scan(&root).unwrap();
        assert_eq!(project.entries.len(), 3);
        let result = search(&root, "NEEDLE", false, vec![]).unwrap();
        assert_eq!(result.hits.len(), 1);
        assert_eq!(result.hits[0].line, 3);
        assert_eq!(result.hits[0].start, 20);
        let result = search(
            &root,
            "pending",
            false,
            vec![Buffer {
                path: "notes/二.md".into(),
                source: "Unsaved pending words".into(),
            }],
        )
        .unwrap();
        assert_eq!(result.hits.len(), 1);
        assert!(search(&root, "NEEDLE", true, vec![])
            .unwrap()
            .hits
            .is_empty());
        assert_eq!(
            search(&root, "manual", false, vec![]).unwrap().hits[0].path,
            "manual.pdf"
        );
    }
    #[test]
    fn relative_urls_decode_spaces_and_stay_in_root() {
        let temp = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(temp.path()).unwrap();
        fs::create_dir(root.join("notes")).unwrap();
        fs::create_dir(root.join("assets")).unwrap();
        fs::write(root.join("assets/图 one.png"), "png").unwrap();
        let doc = root.join("notes/test.md");
        let resolved = resolve(&root, &doc, "../assets/%E5%9B%BE%20one.png#part").unwrap();
        assert_eq!(
            resolved,
            fs::canonicalize(root.join("assets/图 one.png")).unwrap()
        );
        assert!(resolve(&root, &doc, "../../outside.png").is_err());
        assert!(resolve(&root, &doc, "https://example.com/image.png").is_err());
    }
    #[test]
    fn search_reports_limits_and_rejects_long_queries() {
        let temp = tempfile::tempdir().unwrap();
        fs::write(temp.path().join("many.md"), "needle\n".repeat(100)).unwrap();
        let result = search(temp.path(), "needle", false, vec![]).unwrap();
        assert!(result.truncated);
        assert_eq!(result.hits.len(), 20);
        assert!(search(temp.path(), &"x".repeat(513), false, vec![]).is_err());
    }
}
