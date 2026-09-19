//! Detecting that the data file changed underneath us.
//!
//! The concurrency model is "one device at a time, cloud sync catches up in
//! between". The one realistic failure is opening the app before sync finished
//! pulling down the other device's copy, then saving over it. So: fingerprint
//! the file whenever we read it, re-check before every write, and refuse the
//! write if it no longer matches. Per the spec's resolved decision this is a
//! hard block requiring a manual reload — there is no save-alongside fallback.

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::Path;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Fingerprint {
    pub size: u64,
    /// Content hash. Size and mtime alone are too weak here: a sync client can
    /// rewrite a file to the same length, and mtime can be preserved across a
    /// sync, so the hash is what the decision actually rests on.
    pub sha256: String,
}

impl Fingerprint {
    /// Fingerprints the file at `path`. A missing file has no fingerprint,
    /// which is distinct from an empty one.
    pub fn of(path: &Path) -> std::io::Result<Option<Self>> {
        let bytes = match std::fs::read(path) {
            Ok(b) => b,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
            Err(e) => return Err(e),
        };
        let mut hasher = Sha256::new();
        hasher.update(&bytes);
        Ok(Some(Fingerprint {
            size: bytes.len() as u64,
            sha256: format!("{:x}", hasher.finalize()),
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn write(path: &Path, contents: &[u8]) {
        let mut f = std::fs::File::create(path).unwrap();
        f.write_all(contents).unwrap();
    }

    #[test]
    fn missing_file_has_no_fingerprint() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(
            Fingerprint::of(&dir.path().join("nope.sqlite")).unwrap(),
            None
        );
    }

    #[test]
    fn identical_contents_fingerprint_identically() {
        let dir = tempfile::tempdir().unwrap();
        let a = dir.path().join("a");
        let b = dir.path().join("b");
        write(&a, b"hello");
        write(&b, b"hello");
        assert_eq!(Fingerprint::of(&a).unwrap(), Fingerprint::of(&b).unwrap());
    }

    #[test]
    fn a_same_length_edit_is_still_detected() {
        // This is the case size+mtime would miss.
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("f");
        write(&p, b"hello");
        let before = Fingerprint::of(&p).unwrap().unwrap();
        write(&p, b"HELLO");
        let after = Fingerprint::of(&p).unwrap().unwrap();
        assert_eq!(before.size, after.size);
        assert_ne!(before, after);
    }
}
