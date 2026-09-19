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
}

impl AppError {
    pub fn code(&self) -> &'static str {
        match self {
            AppError::DiskChanged => "disk_changed",
            AppError::Db(_) => "db",
            AppError::Io(_) => "io",
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

pub type AppResult<T> = Result<T, AppError>;
