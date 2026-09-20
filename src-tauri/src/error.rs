use serde::Serialize;

/// Errors crossing into the frontend. `code` is what the UI branches on — in
/// particular `disk_changed`, which drives the block-and-reload screen.
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("the data file changed on disk since the app last read it")]
    DiskChanged,
    #[error("database error: {0}")]
    Db(#[from] rusqlite::Error),
    #[error("file error: {0}")]
    Io(#[from] std::io::Error),
    /// Anything that went wrong on the way to writing a PDF: the print window,
    /// the platform's print pipeline, or the file it was meant to leave behind.
    #[error("PDF export failed: {0}")]
    Pdf(String),
}

impl AppError {
    pub fn code(&self) -> &'static str {
        match self {
            AppError::DiskChanged => "disk_changed",
            AppError::Db(_) => "db",
            AppError::Io(_) => "io",
            AppError::Pdf(_) => "pdf",
        }
    }
}

impl Serialize for AppError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        use serde::ser::SerializeStruct;
        let mut st = s.serialize_struct("AppError", 2)?;
        st.serialize_field("code", self.code())?;
        st.serialize_field("message", &self.to_string())?;
        st.end()
    }
}

/// A WebView2 call that fails is a failed export, the same as any other step
/// on the way to the file.
#[cfg(target_os = "windows")]
impl From<windows::core::Error> for AppError {
    fn from(e: windows::core::Error) -> Self {
        AppError::Pdf(e.to_string())
    }
}

/// A Tauri failure — creating the hidden print window, mostly — reads to the
/// teacher as a failed export, because that is what it is.
impl From<tauri::Error> for AppError {
    fn from(e: tauri::Error) -> Self {
        AppError::Pdf(e.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
