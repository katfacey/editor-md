use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
pub mod project;
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
};

pub fn launch_paths(arguments: impl IntoIterator<Item = String>, cwd: &Path) -> Vec<PathBuf> {
    arguments
        .into_iter()
        .skip(1)
        .filter(|value| !value.starts_with("--"))
        .map(|value| {
            let path = PathBuf::from(value);
            if path.is_absolute() {
                path
            } else {
                cwd.join(path)
            }
        })
        .collect()
}

pub const MAX_DOCUMENT_BYTES: u64 = 20 * 1024 * 1024;
const PAGE_PREFIX: &str = "<!-- editor-md-page: ";

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Page {
    pub size: String,
    pub orientation: String,
    pub top: f64,
    pub bottom: f64,
    pub left: f64,
    pub right: f64,
}

impl Default for Page {
    fn default() -> Self {
        Self {
            size: "Letter".into(),
            orientation: "portrait".into(),
            top: 1.0,
            bottom: 1.0,
            left: 1.0,
            right: 1.0,
        }
    }
}

impl Page {
    pub fn validate(&self) -> Result<(), String> {
        let (mut width, mut height) = match self.size.as_str() {
            "Letter" => (8.5, 11.0),
            "A4" => (8.27, 11.69),
            "Legal" => (8.5, 14.0),
            _ => return Err("Unsupported paper size.".into()),
        };
        match self.orientation.as_str() {
            "portrait" => (),
            "landscape" => std::mem::swap(&mut width, &mut height),
            _ => return Err("Unsupported page orientation.".into()),
        }
        if [self.top, self.bottom, self.left, self.right]
            .iter()
            .any(|n| !n.is_finite() || *n < 0.0 || *n > 3.0)
            || self.left + self.right > width - 1.0
            || self.top + self.bottom > height - 1.0
        {
            return Err("Margins must leave at least one inch of writing space.".into());
        }
        Ok(())
    }
}

pub fn revision(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

pub fn read_utf8(path: &Path) -> Result<String, String> {
    if fs::metadata(path).map_err(|e| e.to_string())?.len() > MAX_DOCUMENT_BYTES {
        return Err("This beta supports documents up to 20 MiB.".into());
    }
    let bytes = fs::read(path).map_err(|e| e.to_string())?;
    if bytes.len() as u64 > MAX_DOCUMENT_BYTES {
        return Err("This beta supports documents up to 20 MiB.".into());
    }
    String::from_utf8(bytes).map_err(|_| "Use a UTF-8 encoded Markdown file.".into())
}

pub fn decode_markdown(raw: &str) -> (String, Page) {
    if let Some(rest) = raw.strip_prefix(PAGE_PREFIX) {
        if let Some((json, body)) = rest.split_once(" -->\n") {
            if let Ok(page) = serde_json::from_str::<Page>(json) {
                if page.validate().is_ok() {
                    return (body.to_string(), page);
                }
            }
        }
    }
    (raw.to_string(), Page::default())
}

pub fn encode_markdown(source: &str, page: &Page) -> Result<String, String> {
    page.validate()?;
    if source.len() as u64 > MAX_DOCUMENT_BYTES {
        return Err("This beta supports documents up to 20 MiB.".into());
    }
    if *page == Page::default() {
        return Ok(source.to_string());
    }
    let encoded = format!(
        "{PAGE_PREFIX}{} -->\n{source}",
        serde_json::to_string(page).map_err(|e| e.to_string())?
    );
    if encoded.len() as u64 > MAX_DOCUMENT_BYTES {
        return Err("Document and page metadata exceed 20 MiB.".into());
    }
    Ok(encoded)
}

/// Replace the target only after the complete temporary file has been flushed.
/// tempfile::persist uses replace semantics on Windows as well as Unix.
pub fn atomic_write(path: &Path, content: &[u8]) -> Result<(), String> {
    let parent = path.parent().ok_or("The file has no parent directory.")?;
    let mut temp = tempfile::NamedTempFile::new_in(parent).map_err(|e| e.to_string())?;
    temp.write_all(content).map_err(|e| e.to_string())?;
    temp.as_file().sync_all().map_err(|e| e.to_string())?;
    temp.persist(path).map_err(|e| e.error.to_string())?;
    Ok(())
}

pub fn checked_write(path: &Path, expected: &str, content: &[u8]) -> Result<String, String> {
    let current = fs::read(path).map_err(|e| format!("Could not read the saved file: {e}"))?;
    if revision(&current) != expected {
        return Err(
            "The file changed outside Editor, MD. Reopen it or use Save as to keep both versions."
                .into(),
        );
    }
    atomic_write(path, content)?;
    Ok(revision(content))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn explorer_arguments_preserve_spaces_unicode_and_launch_directory() {
        let cwd = std::env::temp_dir();
        let paths = launch_paths(
            vec![
                "editor.exe".into(),
                "--smoke-child".into(),
                "First file.md".into(),
                "第二.md".into(),
            ],
            &cwd,
        );
        assert_eq!(paths, vec![cwd.join("First file.md"), cwd.join("第二.md")]);
    }
    #[test]
    fn default_pages_preserve_source_bytes() {
        let source = "# Heading\r\n\r\n1. First\r\n2. Second\r\n\r\n\x60\x60\x60rust\r\nfn main() {}\r\n\x60\x60\x60\r\n";
        assert_eq!(encode_markdown(source, &Page::default()).unwrap(), source);
    }
    #[test]
    fn custom_page_metadata_round_trips() {
        let page = Page {
            size: "A4".into(),
            left: 0.5,
            ..Page::default()
        };
        assert_eq!(
            decode_markdown(&encode_markdown("# Test\n", &page).unwrap()),
            ("# Test\n".into(), page)
        );
    }
    #[test]
    fn invalid_metadata_is_kept_as_document_text() {
        let source = "<!-- editor-md-page: not-json -->\nHello";
        assert_eq!(decode_markdown(source).0, source);
    }
    #[test]
    fn invalid_margins_are_rejected() {
        assert!(Page {
            left: 3.0,
            right: 3.0,
            size: "A4".into(),
            orientation: "landscape".into(),
            top: 3.0,
            bottom: 3.0
        }
        .validate()
        .is_ok());
        assert!(Page {
            top: f64::NAN,
            ..Page::default()
        }
        .validate()
        .is_err());
        assert!(Page {
            size: "bad".into(),
            ..Page::default()
        }
        .validate()
        .is_err());
    }
    #[test]
    fn atomic_save_and_external_change_guard() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("test.md");
        atomic_write(&path, b"original").unwrap();
        let expected = revision(b"original");
        checked_write(&path, &expected, b"saved").unwrap();
        assert_eq!(fs::read(&path).unwrap(), b"saved");
        assert!(checked_write(&path, &expected, b"stale").is_err());
        assert_eq!(fs::read(&path).unwrap(), b"saved");
    }
    #[test]
    fn failed_write_preserves_target() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("missing").join("test.md");
        assert!(atomic_write(&path, b"new").is_err());
        assert!(!path.exists());
    }
    #[test]
    fn non_utf8_is_rejected() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("bad.md");
        fs::write(&path, [0xff, 0xfe, 0x00]).unwrap();
        assert!(read_utf8(&path).is_err());
    }
}
