//! Writing a real PDF into `exports/`.
//!
//! The spec's resolved decision is the **WebView print-to-PDF path**, not a
//! native Rust PDF library, and it has to produce an actual file — a print
//! dialog or a "copy the text" fallback does not satisfy it. Tauri 2 exposes no
//! cross-platform print-to-PDF command, so this is two platform
//! implementations behind one function:
//!
//! * **macOS** — `WKWebView.printOperationWithPrintInfo:`, with the print info's
//!   job disposition set to *save* and `NSPrintJobSavingURL` pointing at the
//!   target file. This is AppKit's own print pipeline, so it paginates the
//!   document across A4 pages the way printing it would.
//! * **Windows** — WebView2's `ICoreWebView2_7::PrintToPdf`, which takes the
//!   page size, orientation and margins and writes the file itself.
//!
//! Both are given the page geometry in the same units from the same place, so
//! a sheet exported on the teacher's Windows PC and one exported on the
//! development Mac describe the same A4 page.
//!
//! **Why the document is built in the frontend and arrives here as HTML.** Every
//! user-facing string in this app lives in `src/i18n/el.ts` and is resolved
//! through one lookup — that is what makes M9's English pass one new file
//! rather than an edit to every screen. A PDF is user-facing text, so its
//! labels have to come from the same place. Rust's job is the page geometry and
//! the file, not the wording.

use crate::error::{AppError, AppResult};
use std::path::{Path, PathBuf};

/// A4 at 72 points to the inch — 210mm × 297mm.
pub const A4_WIDTH_PT: f64 = 595.28;
pub const A4_HEIGHT_PT: f64 = 841.89;
/// 10mm, the source product's own page margin.
pub const MARGIN_PT: f64 = 28.35;

const POINTS_PER_INCH: f64 = 72.0;

/// One export: the document, the page it goes on, and where it lands.
#[derive(Debug, Clone)]
pub struct PrintJob {
    /// A complete standalone HTML document, built by the frontend.
    pub html: String,
    /// Landscape for the wide sheets — the gradebook grid and the conduct
    /// sheet — matching the source product's own orientation for them.
    pub landscape: bool,
    pub target: PathBuf,
}

impl PrintJob {
    /// The page size in points, with the A4 sides swapped for landscape.
    pub fn page_size_pt(&self) -> (f64, f64) {
        if self.landscape {
            (A4_HEIGHT_PT, A4_WIDTH_PT)
        } else {
            (A4_WIDTH_PT, A4_HEIGHT_PT)
        }
    }

    /// The same page, in the inches WebView2's print settings want.
    pub fn page_size_in(&self) -> (f64, f64) {
        let (w, h) = self.page_size_pt();
        (w / POINTS_PER_INCH, h / POINTS_PER_INCH)
    }

    pub fn margin_in(&self) -> f64 {
        MARGIN_PT / POINTS_PER_INCH
    }
}

/// Makes a teacher-facing name safe to write to disk on both platforms.
///
/// Greek letters, spaces and dashes are kept exactly as they are — the file is
/// named in the language the app is in, and `Βαθμοί — Α1 — 20.09.2026.pdf` is
/// the point of the exercise. Only the characters Windows or macOS genuinely
/// refuse are replaced, and a name is never allowed to escape `exports/` via
/// `..` or a separator.
pub fn safe_file_name(raw: &str) -> String {
    let cleaned: String = raw
        .chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '-',
            c if (c as u32) < 0x20 => ' ',
            c => c,
        })
        .collect();
    // Windows refuses a trailing dot or space; a *leading* dot would make the
    // export a hidden file on macOS, and is what a name like `../planner` is
    // left as once its separators are gone.
    let trimmed = cleaned
        .trim()
        .trim_end_matches('.')
        .trim_start_matches(['.', '-'])
        .trim();
    let name = if trimmed.is_empty() {
        "export"
    } else {
        trimmed
    };
    if name.to_lowercase().ends_with(".pdf") {
        name.to_string()
    } else {
        format!("{name}.pdf")
    }
}

/// Where an export lands: always directly inside `exports/`, never below it.
pub fn target_path(exports_dir: &Path, raw_name: &str) -> PathBuf {
    exports_dir.join(safe_file_name(raw_name))
}

fn pdf_err(message: impl Into<String>) -> AppError {
    AppError::Pdf(message.into())
}

/// Checks that the platform actually wrote a file, so a silent failure in a
/// native print pipeline cannot be reported to the teacher as a success.
fn confirm_written(target: &Path) -> AppResult<()> {
    match std::fs::metadata(target) {
        Ok(meta) if meta.len() > 0 => Ok(()),
        Ok(_) => Err(pdf_err("the PDF was created but is empty")),
        Err(_) => Err(pdf_err("the print pipeline did not write a PDF")),
    }
}

// ------------------------------------------------------------------ macOS ---

/// Captures one A4 page of the loaded document and hands back its PDF bytes.
///
/// **Why a page at a time, rather than one print job.** The obvious route —
/// `WKWebView.printOperationWithPrintInfo:`, AppKit's own print pipeline — does
/// not work against this webview: its print view comes back zero-sized and
/// renders nothing, so the job emits blank A4 pages for as long as it is left
/// running (the first attempt produced 220MB of them). That was tried with and
/// without a visible window, with default and explicit print settings, with the
/// print view's frame forced to the printable area, and run both directly and
/// modally for the window. All four produced the same empty pages.
///
/// What does work is WebKit's other PDF path, `createPDFWithConfiguration:`. It
/// renders the *whole* document, off-screen content included — verified against
/// a document three times taller than the window — and it embeds the fonts it
/// drew with, which is what makes Greek come out as Greek. What it does not do
/// is paginate: given no rectangle it returns one page as tall as the content.
///
/// So the app paginates. The document is laid out as fixed A4-sized blocks in
/// the print window, and each block is captured by its own rectangle, which
/// makes every captured page exactly A4 — and makes the page breaks the app's
/// decision rather than two different rendering engines', which is what keeps
/// a sheet printed on Windows and one printed on macOS the same document.
///
/// Runs on the main thread. The completion handler fires later, on the run
/// loop, so the bytes come back through `send`.
#[cfg(target_os = "macos")]
pub fn capture_page(
    webview: *mut std::ffi::c_void,
    job: &PrintJob,
    page: usize,
    send: std::sync::mpsc::Sender<Result<Vec<u8>, String>>,
) -> AppResult<()> {
    use objc2::msg_send;
    use objc2::rc::Retained;
    use objc2::runtime::AnyObject;
    use objc2_foundation::{NSData, NSPoint, NSRect, NSSize};

    if webview.is_null() {
        return Err(pdf_err("no webview to print from"));
    }
    let (width, height) = job.page_size_pt();

    unsafe {
        let webview: &AnyObject = &*(webview as *mut AnyObject);
        let configuration: Retained<AnyObject> = msg_send![objc2::class!(WKPDFConfiguration), new];
        // The document is laid out in page-sized blocks, so page `n` is the
        // slice of it starting `n` pages down.
        let rect = NSRect::new(
            NSPoint::new(0.0, height * page as f64),
            NSSize::new(width, height),
        );
        let _: () = msg_send![&*configuration, setRect: rect];

        let handler = block2::RcBlock::new(move |data: *mut NSData, _error: *mut AnyObject| {
            let result = if data.is_null() {
                Err("WebKit returned no PDF for this page".to_string())
            } else {
                let data: &NSData = &*data;
                Ok(data.to_vec())
            };
            let _ = send.send(result);
        });
        let _: () = msg_send![webview, createPDFWithConfiguration: &*configuration, completionHandler: &*handler];
    }
    Ok(())
}

/// Assembles the captured pages into the one PDF the teacher gets.
///
/// PDFKit is the system's own PDF framework, not a third-party PDF writer: the
/// pages are WebKit's, and this only puts them in one file in order.
#[cfg(target_os = "macos")]
pub fn merge_pages(pages: Vec<Vec<u8>>, target: &Path) -> AppResult<()> {
    use objc2::AnyThread;
    use objc2_foundation::{NSData, NSString, NSURL};
    use objc2_pdf_kit::PDFDocument;

    if pages.is_empty() {
        return Err(pdf_err("the document had no pages to write"));
    }
    if let Some(parent) = target.parent() {
        std::fs::create_dir_all(parent)?;
    }

    unsafe {
        let combined = PDFDocument::new();
        let mut index = 0usize;
        for bytes in &pages {
            let data = NSData::with_bytes(bytes);
            let document = PDFDocument::initWithData(PDFDocument::alloc(), &data)
                .ok_or_else(|| pdf_err("a captured page was not a readable PDF"))?;
            for page_index in 0..document.pageCount() {
                let page = document
                    .pageAtIndex(page_index)
                    .ok_or_else(|| pdf_err("a captured page could not be read back"))?;
                combined.insertPage_atIndex(&page, index);
                index += 1;
            }
        }
        let path = NSString::from_str(&target.to_string_lossy());
        let url = NSURL::fileURLWithPath(&path);
        if !combined.writeToURL(&url) {
            return Err(pdf_err("the finished PDF could not be written"));
        }
    }
    confirm_written(target)
}

// ---------------------------------------------------------------- Windows ---

/// Renders the loaded document to `job.target` through WebView2's own
/// print-to-PDF.
///
/// `PrintToPdf` is asynchronous, and we are on the UI thread that has to keep
/// pumping messages for it to finish — so the completion handler drops its
/// result into a cell and the message loop is pumped until it arrives.
#[cfg(target_os = "windows")]
pub fn capture(
    controller: webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Controller,
    environment: webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Environment,
    job: &PrintJob,
) -> AppResult<()> {
    use std::cell::RefCell;
    use std::rc::Rc;
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        ICoreWebView2Environment6, ICoreWebView2_7, COREWEBVIEW2_PRINT_ORIENTATION_LANDSCAPE,
        COREWEBVIEW2_PRINT_ORIENTATION_PORTRAIT,
    };
    use webview2_com::PrintToPdfCompletedHandler;
    use windows::core::{Interface, HSTRING};

    // The same preparation the macOS path does: the folder has to be there,
    // and a file already sitting at the target is replaced rather than
    // appended to.
    if let Some(parent) = job.target.parent() {
        std::fs::create_dir_all(parent)?;
    }
    if job.target.exists() {
        std::fs::remove_file(&job.target)?;
    }

    let core = unsafe { controller.CoreWebView2() }
        .map_err(|e| pdf_err(format!("no WebView2 core: {e}")))?;
    let printing: ICoreWebView2_7 = core
        .cast()
        .map_err(|_| pdf_err("this WebView2 runtime is too old to print to PDF"))?;

    // The environment comes from Tauri rather than from the core webview:
    // `ICoreWebView2::Environment` only exists on a later revision of the
    // interface, and Tauri already holds the one this webview was made with.
    let environment: ICoreWebView2Environment6 = environment
        .cast()
        .map_err(|_| pdf_err("this WebView2 runtime cannot make print settings"))?;
    let settings = unsafe { environment.CreatePrintSettings() }
        .map_err(|e| pdf_err(format!("could not make print settings: {e}")))?;

    let (width, height) = job.page_size_in();
    let margin = job.margin_in();
    unsafe {
        settings.SetOrientation(if job.landscape {
            COREWEBVIEW2_PRINT_ORIENTATION_LANDSCAPE
        } else {
            COREWEBVIEW2_PRINT_ORIENTATION_PORTRAIT
        })?;
        // WebView2 wants the portrait dimensions plus an orientation, not a
        // pre-swapped page.
        let (page_w, page_h) = if job.landscape {
            (height, width)
        } else {
            (width, height)
        };
        settings.SetPageWidth(page_w)?;
        settings.SetPageHeight(page_h)?;
        settings.SetMarginTop(margin)?;
        settings.SetMarginBottom(margin)?;
        settings.SetMarginLeft(margin)?;
        settings.SetMarginRight(margin)?;
        settings.SetShouldPrintBackgrounds(true)?;
        settings.SetShouldPrintHeaderAndFooter(false)?;
    }

    let done: Rc<RefCell<Option<Result<bool, windows::core::Error>>>> = Rc::new(RefCell::new(None));
    let sink = done.clone();
    let path = HSTRING::from(job.target.as_os_str());

    PrintToPdfCompletedHandler::wait_for_async_operation(
        Box::new(move |handler| {
            unsafe { printing.PrintToPdf(&path, &settings, &handler) }?;
            Ok(())
        }),
        Box::new(move |error, success| {
            *sink.borrow_mut() = Some(error.map(|()| success));
            Ok(())
        }),
    )
    .map_err(|e| pdf_err(format!("print to PDF failed: {e}")))?;

    // Taken into a local first: matching on the borrow directly would hold it
    // for the whole match, past the end of what it borrows.
    let outcome = done.borrow_mut().take();
    match outcome {
        Some(Ok(true)) => confirm_written(&job.target),
        Some(Ok(false)) => Err(pdf_err("WebView2 declined to write the PDF")),
        Some(Err(e)) => Err(pdf_err(format!("print to PDF failed: {e}"))),
        None => Err(pdf_err("the print never reported back")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_greek_file_name_survives_intact() {
        assert_eq!(
            safe_file_name("Βαθμοί — Α1 — 20.09.2026"),
            "Βαθμοί — Α1 — 20.09.2026.pdf"
        );
    }

    #[test]
    fn the_characters_windows_refuses_are_replaced() {
        assert_eq!(safe_file_name("Α1/Β2: βαθμοί?"), "Α1-Β2- βαθμοί-.pdf");
    }

    #[test]
    fn an_export_cannot_escape_the_exports_folder() {
        let dir = Path::new("/planner/exports");
        let escaped = target_path(dir, "../../data/planner.sqlite");
        // It lands directly in `exports/`, under a name with no separators and
        // no leading dots — so it can neither climb out nor arrive hidden.
        assert_eq!(escaped.parent(), Some(dir));
        let name = escaped.file_name().unwrap().to_string_lossy().to_string();
        assert!(!name.contains('/') && !name.contains('\\'), "{name}");
        assert!(!name.starts_with('.'), "{name}");
    }

    #[test]
    fn an_empty_or_dotted_name_still_produces_a_usable_file() {
        assert_eq!(safe_file_name("   "), "export.pdf");
        assert_eq!(safe_file_name("Βαθμοί."), "Βαθμοί.pdf");
    }

    #[test]
    fn a_name_that_already_ends_in_pdf_is_not_doubled() {
        assert_eq!(safe_file_name("Βαθμοί.pdf"), "Βαθμοί.pdf");
    }

    #[test]
    fn landscape_swaps_the_a4_sides_and_portrait_does_not() {
        let job = |landscape| PrintJob {
            html: String::new(),
            landscape,
            target: PathBuf::from("/tmp/x.pdf"),
        };
        assert_eq!(job(false).page_size_pt(), (A4_WIDTH_PT, A4_HEIGHT_PT));
        assert_eq!(job(true).page_size_pt(), (A4_HEIGHT_PT, A4_WIDTH_PT));
        // A4's long side is 11.69in; both platforms are told the same page.
        let (w, h) = job(false).page_size_in();
        assert!((w - 8.2677).abs() < 0.001, "{w}");
        assert!((h - 11.6929).abs() < 0.001, "{h}");
    }
}
