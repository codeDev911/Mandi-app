fn main() {
    let attributes = tauri_build::Attributes::new();
    if let Err(e) = tauri_build::try_build(attributes) {
        eprintln!("cargo:warning=tauri_build::try_build non-fatal warning on Windows resource compilation: {e}");
    }
}
