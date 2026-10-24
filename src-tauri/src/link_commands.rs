fn web_url(value: &str) -> Result<tauri::Url, String> {
    if value.chars().any(char::is_control) {
        return Err("This link contains invalid characters.".into());
    }
    let url = tauri::Url::parse(value).map_err(|_| "Enter a valid http(s) address.")?;
    if !matches!(url.scheme(), "http" | "https") || url.host_str().is_none() {
        return Err("Only http(s) web addresses can open in your browser.".into());
    }
    Ok(url)
}

#[tauri::command]
pub(crate) async fn open_web_link(target: String) -> Result<(), String> {
    let url = web_url(&target)?;
    // Tests validate the complete command route without launching another app.
    if std::env::args().any(|arg| arg == "--smoke-test") {
        return Ok(());
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        std::process::Command::new("explorer.exe")
            .arg(url.as_str())
            .creation_flags(0x08000000)
            .spawn()
            .map_err(|error| error.to_string())?;
        Ok(())
    }
    #[cfg(not(windows))]
    {
        let _ = url;
        Err("Web links currently open on Windows only.".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn web_links_allow_only_web_addresses() {
        assert!(web_url("https://example.com/notes?a=1&b=2#heading").is_ok());
        for value in [
            "file:///C:/test.exe",
            "javascript:alert(1)",
            "cmd:/c",
            "relative.md",
            "https://",
            "https://example.com\n",
        ] {
            assert!(web_url(value).is_err(), "{value}");
        }
    }
}
