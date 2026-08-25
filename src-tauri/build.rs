fn main() {
    let attributes = tauri_build::Attributes::new();
    if let Err(e) = tauri_build::try_build(attributes) {
        eprintln!("Warning: tauri_build::try_build encountered an issue with Windows resource compilation: {e}");
    }
}
