use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager, PhysicalPosition};

const REQUIRED_PET_STATES: [&str; 6] = ["idle", "blink", "happy", "attention", "sleep", "degraded"];

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CompanionRuntimeState {
    companion: CompanionState,
    provider_profile: ProviderProfileState,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CompanionState {
    id: &'static str,
    display_name: String,
    soul_id: &'static str,
    pet_appearance: PetAppearanceState,
    mood: &'static str,
    vitals: CompanionVitalsState,
    activity_state: &'static str,
    health_state: &'static str,
    summary: String,
    available_quick_actions: Vec<&'static str>,
    last_updated_at: String,
    autonomy: CompanionAutonomyState,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PetAppearanceState {
    kind: &'static str,
    skin: String,
    animation_style: &'static str,
    asset_pack_id: String,
    asset_pack_path: String,
    display_name: String,
    spritesheet_path: String,
    spritesheet_data_url: Option<String>,
    asset_pack_version: String,
    asset_validation: AssetValidationState,
    asset_manifest: Option<PetAssetManifestState>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AssetValidationState {
    level: &'static str,
    messages: Vec<String>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PetAssetManifestState {
    id: String,
    display_name: String,
    description: Option<String>,
    spritesheet_path: String,
    spritesheet_data_url: Option<String>,
    kind: String,
    version: Option<String>,
    frame: Option<FrameConfigState>,
    states: Option<Value>,
    fps: Option<f64>,
    chroma_key: Option<String>,
    anchor: Option<AnchorState>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FrameConfigState {
    width: u32,
    height: u32,
    count: Option<u32>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AnchorState {
    x: f64,
    y: f64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CompanionVitalsState {
    level: u8,
    xp: u16,
    companion_energy: u8,
    hunger: u8,
    intimacy: u8,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CompanionAutonomyState {
    user_presence: &'static str,
    companion_mode: &'static str,
    last_event_priority: &'static str,
    last_output_strategy: &'static str,
    queued_output_count: u8,
    last_action: &'static str,
    cooldown_until: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProviderProfileState {
    id: &'static str,
    name: &'static str,
}

#[tauri::command]
fn get_companion_runtime_state() -> CompanionRuntimeState {
    let asset_pack_path = resolve_active_pet_asset_pack_path();
    let asset_pack_path_str = asset_pack_path.to_string_lossy().to_string();
    let asset_result = read_asset_pack(&asset_pack_path_str);
    let (asset_manifest, asset_validation) = match asset_result {
        Ok(ok) => (
            Some(ok),
            AssetValidationState {
                level: "ok",
                messages: vec![],
            },
        ),
        Err(errs) => (
            None,
            AssetValidationState {
                level: "error",
                messages: errs,
            },
        ),
    };
    let (health_state, mood, activity_state, summary) = if asset_manifest.is_some() {
        (
            "healthy",
            "neutral",
            "idle",
            "desktop-body:ready; pet-asset:ready".to_string(),
        )
    } else {
        (
            "attention",
            "neutral",
            "attention",
            "desktop-body:ready; pet-asset:needs-attention".to_string(),
        )
    };

    CompanionRuntimeState {
        companion: CompanionState {
            id: "active-companion",
            display_name: asset_manifest
                .as_ref()
                .map(|manifest| manifest.display_name.clone())
                .unwrap_or_else(|| "元气眠眠".to_string()),
            soul_id: "default-soul",
            pet_appearance: PetAppearanceState {
                kind: "custom",
                skin: asset_manifest
                    .as_ref()
                    .map(|manifest| manifest.id.clone())
                    .unwrap_or_else(|| "yuanqi-mianmian".to_string()),
                animation_style: "idle",
                asset_pack_id: asset_manifest
                    .as_ref()
                    .map(|manifest| manifest.id.clone())
                    .unwrap_or_else(|| "yuanqi-mianmian".to_string()),
                asset_pack_path: asset_pack_path_str.clone(),
                display_name: asset_manifest
                    .as_ref()
                    .map(|manifest| manifest.display_name.clone())
                    .unwrap_or_else(|| "元气眠眠".to_string()),
                spritesheet_path: asset_manifest
                    .as_ref()
                    .map(|manifest| manifest.spritesheet_path.clone())
                    .unwrap_or_else(|| {
                        asset_pack_path
                            .join("spritesheet.webp")
                            .to_string_lossy()
                            .to_string()
                    }),
                spritesheet_data_url: asset_manifest
                    .as_ref()
                    .and_then(|manifest| manifest.spritesheet_data_url.clone()),
                asset_pack_version: asset_manifest
                    .as_ref()
                    .and_then(|manifest| manifest.version.clone())
                    .unwrap_or_else(|| "codex-pet-v1".to_string()),
                asset_validation,
                asset_manifest,
            },
            mood,
            vitals: CompanionVitalsState {
                level: 1,
                xp: 0,
                companion_energy: 100,
                hunger: 100,
                intimacy: 0,
            },
            activity_state,
            health_state,
            summary,
            available_quick_actions: vec!["refresh-runtime", "show-status"],
            last_updated_at: iso_timestamp_now(),
            autonomy: CompanionAutonomyState {
                user_presence: "PRESENT",
                companion_mode: "AUTONOMOUS",
                last_event_priority: "LOW",
                last_output_strategy: "silent",
                queued_output_count: 0,
                last_action: "reflect-and-update-affect",
                cooldown_until: None,
            },
        },
        provider_profile: ProviderProfileState {
            id: "default-provider-profile",
            name: "Local Desktop Body",
        },
    }
}

fn resolve_active_pet_asset_pack_path() -> PathBuf {
    let project_root = resolve_project_root();
    let bundled_default = PathBuf::from("/Users/ldh/Downloads/yuanqi-mianmian.codex-pet");
    resolve_active_pet_asset_pack_path_from_root(&project_root, &bundled_default)
}

fn resolve_active_pet_asset_pack_path_from_root(
    project_root: &Path,
    bundled_default: &Path,
) -> PathBuf {
    let current = project_root
        .join("data")
        .join("desktop-v2")
        .join("pets")
        .join("current.codex-pet");
    if read_asset_pack(&current.to_string_lossy()).is_ok() {
        return current;
    }
    if read_asset_pack(&bundled_default.to_string_lossy()).is_ok() {
        return bundled_default.to_path_buf();
    }
    if current.join("pet.json").exists() {
        return current;
    }
    bundled_default.to_path_buf()
}

fn iso_timestamp_now() -> String {
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true)
}

#[tauri::command]
fn load_pet_asset_pack(asset_pack_path: String) -> Result<PetAssetPackLoadResult, String> {
    match read_asset_pack(&asset_pack_path) {
        Ok(manifest) => Ok(PetAssetPackLoadResult {
            asset_pack_path,
            manifest: Some(manifest),
            validation: AssetValidationState {
                level: "ok",
                messages: vec![],
            },
        }),
        Err(messages) => Ok(PetAssetPackLoadResult {
            asset_pack_path,
            manifest: None,
            validation: AssetValidationState {
                level: "error",
                messages,
            },
        }),
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PetAssetPackLoadResult {
    asset_pack_path: String,
    manifest: Option<PetAssetManifestState>,
    validation: AssetValidationState,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PetAssetPackImportResult {
    source_asset_pack_path: String,
    asset_pack_path: String,
    manifest: Option<PetAssetManifestState>,
    validation: AssetValidationState,
}

fn read_asset_pack(asset_pack_path: &str) -> Result<PetAssetManifestState, Vec<String>> {
    let mut errors = Vec::<String>::new();
    let pet_json_path = Path::new(asset_pack_path).join("pet.json");
    let raw = match fs::read_to_string(&pet_json_path) {
        Ok(content) => content,
        Err(error) => {
            errors.push(format!("error: failed reading pet.json: {error}"));
            return Err(errors);
        }
    };
    let parsed: Value = match serde_json::from_str(&raw) {
        Ok(value) => value,
        Err(error) => {
            errors.push(format!("error: invalid pet.json JSON: {error}"));
            return Err(errors);
        }
    };
    let id = str_field(&parsed, "id").unwrap_or_else(|| "unknown-pack".to_string());
    let display_name = str_field(&parsed, "displayName").unwrap_or_else(|| id.clone());
    let spritesheet_rel =
        str_field(&parsed, "spritesheetPath").unwrap_or_else(|| "spritesheet.webp".to_string());
    let spritesheet_full = if spritesheet_rel.starts_with('/') {
        spritesheet_rel.clone()
    } else {
        Path::new(asset_pack_path)
            .join(&spritesheet_rel)
            .to_string_lossy()
            .to_string()
    };
    if !Path::new(&spritesheet_full).exists() {
        errors.push(format!("error: spritesheet missing at {spritesheet_full}"));
    }
    validate_pet_asset_manifest(&parsed, &mut errors);
    let spritesheet_data_url = if Path::new(&spritesheet_full).exists() {
        match read_spritesheet_data_url(&spritesheet_full) {
            Ok(data_url) => Some(data_url),
            Err(error) => {
                errors.push(format!("error: failed encoding spritesheet: {error}"));
                None
            }
        }
    } else {
        None
    };
    let frame = parsed
        .get("frame")
        .and_then(|value| serde_json::from_value::<FrameConfigState>(value.clone()).ok());
    let anchor = parsed
        .get("anchor")
        .and_then(|value| serde_json::from_value::<AnchorState>(value.clone()).ok());
    let states = repair_known_pet_states(&id, parsed.get("states").cloned());
    let manifest = PetAssetManifestState {
        id,
        display_name,
        description: str_field(&parsed, "description"),
        spritesheet_path: spritesheet_full,
        spritesheet_data_url,
        kind: str_field(&parsed, "kind").unwrap_or_else(|| "custom".to_string()),
        version: str_field(&parsed, "version"),
        frame,
        states,
        fps: parsed.get("fps").and_then(Value::as_f64),
        chroma_key: str_field(&parsed, "chromaKey"),
        anchor,
    };
    if errors.is_empty() {
        Ok(manifest)
    } else {
        Err(errors)
    }
}

fn validate_pet_asset_manifest(parsed: &Value, errors: &mut Vec<String>) {
    for field in ["id", "displayName", "spritesheetPath"] {
        if str_field(parsed, field)
            .map(|value| value.trim().is_empty())
            .unwrap_or(true)
        {
            errors.push(format!("error: {field} missing in pet.json"));
        }
    }
    match parsed.get("frame") {
        Some(frame) => {
            validate_positive_u64(frame, "width", "frame.width", errors);
            validate_positive_u64(frame, "height", "frame.height", errors);
            validate_positive_u64(frame, "count", "frame.count", errors);
        }
        None => errors.push("error: frame config missing in pet.json".to_string()),
    }
    if !parsed
        .get("fps")
        .and_then(Value::as_f64)
        .map(|fps| fps > 0.0)
        .unwrap_or(false)
    {
        errors.push("error: fps missing or invalid in pet.json".to_string());
    }
    let states = match parsed.get("states").and_then(Value::as_object) {
        Some(states) => states,
        None => {
            errors.push("error: states missing in pet.json".to_string());
            return;
        }
    };
    let mut missing = Vec::<&str>::new();
    for state_name in REQUIRED_PET_STATES {
        match states.get(state_name) {
            Some(state) if has_non_empty_frame_sequence(state) => {}
            Some(_) => errors.push(format!(
                "error: state '{state_name}' has empty frame sequence"
            )),
            None => missing.push(state_name),
        }
    }
    if !missing.is_empty() {
        errors.push(format!(
            "error: states {} missing in pet.json",
            missing.join(", ")
        ));
    }
}

fn validate_positive_u64(root: &Value, key: &str, label: &str, errors: &mut Vec<String>) {
    if !root
        .get(key)
        .and_then(Value::as_u64)
        .map(|value| value > 0)
        .unwrap_or(false)
    {
        errors.push(format!("error: {label} missing or invalid in pet.json"));
    }
}

fn has_non_empty_frame_sequence(state: &Value) -> bool {
    state
        .get("frames")
        .and_then(Value::as_array)
        .map(|frames| !frames.is_empty() && frames.iter().all(Value::is_u64))
        .unwrap_or(false)
        || state
            .get("rects")
            .and_then(Value::as_array)
            .map(|rects| !rects.is_empty())
            .unwrap_or(false)
}

fn repair_known_pet_states(id: &str, states: Option<Value>) -> Option<Value> {
    if id != "yuanqi-mianmian" {
        return states;
    }
    Some(serde_json::json!({
        "idle": {"frames": [0, 1, 2, 3], "loop": true, "fps": 5},
        "blink": {"frames": [0, 2, 3], "loop": true, "fps": 5},
        "happy": {"frames": [18, 19, 20], "loop": true, "fps": 6},
        "attention": {"frames": [0, 1, 2, 3], "loop": true, "fps": 5},
        "sleep": {"frames": [30, 31, 32, 33, 34, 35], "loop": true, "fps": 5},
        "degraded": {"frames": [48, 49, 50, 51], "loop": true, "fps": 5}
    }))
}

fn read_spritesheet_data_url(path: &str) -> Result<String, std::io::Error> {
    let bytes = fs::read(path)?;
    let mime = match Path::new(path)
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.to_ascii_lowercase())
        .as_deref()
    {
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        _ => "application/octet-stream",
    };
    Ok(format!(
        "data:{mime};base64,{}",
        BASE64_STANDARD.encode(bytes)
    ))
}

fn str_field(root: &Value, key: &str) -> Option<String> {
    root.get(key)
        .and_then(Value::as_str)
        .map(|value| value.to_string())
}

#[tauri::command]
fn pick_pet_asset_pack_folder() -> Result<String, String> {
    match rfd::FileDialog::new()
        .set_title("Select codex-pet folder")
        .pick_folder()
    {
        Some(path) => Ok(path.to_string_lossy().to_string()),
        None => Err("selection_cancelled".to_string()),
    }
}

#[tauri::command]
fn import_pet_asset_pack(
    source_asset_pack_path: String,
) -> Result<PetAssetPackImportResult, String> {
    let source = PathBuf::from(source_asset_pack_path.trim());
    import_pet_asset_pack_into_root(&source, &resolve_project_root())
}

fn import_pet_asset_pack_into_root(
    source: &Path,
    project_root: &Path,
) -> Result<PetAssetPackImportResult, String> {
    if !source.exists() || !source.is_dir() {
        return Err("source folder not found".to_string());
    }
    let source_pet_json = source.join("pet.json");
    if !source_pet_json.exists() {
        return Err("invalid asset pack folder: missing pet.json".to_string());
    }

    let pets_root = project_root.join("data").join("desktop-v2").join("pets");
    fs::create_dir_all(&pets_root)
        .map_err(|error| format!("failed creating pets folder: {error}"))?;

    let target = pets_root.join("current.codex-pet");
    let source_canonical = source
        .canonicalize()
        .unwrap_or_else(|_| source.to_path_buf());
    let target_canonical = target.canonicalize().unwrap_or_else(|_| target.clone());

    if source_canonical == target_canonical {
        let target_path = target.to_string_lossy().to_string();
        return match read_asset_pack(&target_path) {
            Ok(manifest) => Ok(PetAssetPackImportResult {
                source_asset_pack_path: source.to_string_lossy().to_string(),
                asset_pack_path: target_path,
                manifest: Some(manifest),
                validation: AssetValidationState {
                    level: "ok",
                    messages: vec!["asset pack already current; validated in place".to_string()],
                },
            }),
            Err(messages) => Ok(PetAssetPackImportResult {
                source_asset_pack_path: source.to_string_lossy().to_string(),
                asset_pack_path: target_path,
                manifest: None,
                validation: AssetValidationState {
                    level: "error",
                    messages,
                },
            }),
        };
    }

    let temp_target = pets_root.join(format!(
        ".import-{}.codex-pet",
        chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0)
    ));
    if temp_target.exists() {
        fs::remove_dir_all(&temp_target)
            .map_err(|error| format!("failed clearing temp asset pack: {error}"))?;
    }
    copy_dir_recursive(source, &temp_target)
        .map_err(|error| format!("failed copying asset pack: {error}"))?;
    let temp_path = temp_target.to_string_lossy().to_string();
    if let Err(messages) = read_asset_pack(&temp_path) {
        let _ = fs::remove_dir_all(&temp_target);
        return Ok(PetAssetPackImportResult {
            source_asset_pack_path: source.to_string_lossy().to_string(),
            asset_pack_path: target.to_string_lossy().to_string(),
            manifest: None,
            validation: AssetValidationState {
                level: "error",
                messages,
            },
        });
    };

    let backup_target = pets_root.join(format!(
        ".previous-{}.codex-pet",
        chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0)
    ));
    let had_existing_target = target.exists();
    if had_existing_target {
        fs::rename(&target, &backup_target)
            .map_err(|error| format!("failed staging current asset pack replacement: {error}"))?;
    }
    if let Err(error) = fs::rename(&temp_target, &target) {
        if had_existing_target {
            let _ = fs::rename(&backup_target, &target);
        }
        return Err(format!("failed activating imported asset pack: {error}"));
    }
    if had_existing_target {
        let _ = fs::remove_dir_all(&backup_target);
    }
    clear_other_pet_packs(&pets_root, "current.codex-pet")
        .map_err(|error| format!("failed clearing old asset packs: {error}"))?;
    let target_path = target.to_string_lossy().to_string();
    let manifest = read_asset_pack(&target_path).map_err(|messages| {
        format!(
            "imported asset pack failed validation after activation: {}",
            messages.join("; ")
        )
    })?;

    Ok(PetAssetPackImportResult {
        source_asset_pack_path: source.to_string_lossy().to_string(),
        asset_pack_path: target_path,
        manifest: Some(manifest),
        validation: AssetValidationState {
            level: "ok",
            messages: vec![],
        },
    })
}

fn resolve_project_root() -> PathBuf {
    let mut cursor = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    for _ in 0..8 {
        let package_json = cursor.join("package.json");
        let app_dir = cursor.join("apps").join("desktop-v2");
        if package_json.exists() && app_dir.exists() {
            return cursor;
        }
        if !cursor.pop() {
            break;
        }
    }
    std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
}

fn copy_dir_recursive(source: &Path, target: &Path) -> Result<(), std::io::Error> {
    fs::create_dir_all(target)?;
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let from = entry.path();
        let to = target.join(entry.file_name());
        if file_type.is_dir() {
            copy_dir_recursive(&from, &to)?;
        } else if file_type.is_file() {
            fs::copy(&from, &to)?;
        }
    }
    Ok(())
}

fn clear_other_pet_packs(pets_root: &Path, keep_name: &str) -> Result<(), std::io::Error> {
    if !pets_root.exists() {
        return Ok(());
    }
    for entry in fs::read_dir(pets_root)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        if !file_type.is_dir() {
            continue;
        }
        let name = entry.file_name();
        if name.to_string_lossy() == keep_name {
            continue;
        }
        fs::remove_dir_all(entry.path())?;
    }
    Ok(())
}

#[tauri::command]
fn show_desktop_companion(app: AppHandle) -> Result<(), String> {
    show_window(&app, "desktop-companion")
}

#[tauri::command]
fn hide_desktop_companion(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("desktop-companion")
        .ok_or_else(|| "Window not found: desktop-companion".to_string())?;
    window.hide().map_err(|error| error.to_string())
}

fn show_window(app: &AppHandle, label: &str) -> Result<(), String> {
    let window = app
        .get_webview_window(label)
        .ok_or_else(|| format!("Window not found: {label}"))?;

    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ScreenInfo {
    width: u32,
    height: u32,
    scale_factor: f64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct WindowInfo {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

#[tauri::command]
fn get_screen_info(app: AppHandle) -> Result<ScreenInfo, String> {
    let window = app
        .get_webview_window("desktop-companion")
        .ok_or_else(|| "Window not found: desktop-companion".to_string())?;

    let monitor = window
        .primary_monitor()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "No primary monitor found".to_string())?;

    let size = monitor.size();
    Ok(ScreenInfo {
        width: size.width,
        height: size.height,
        scale_factor: monitor.scale_factor(),
    })
}

#[tauri::command]
fn get_window_info(app: AppHandle, label: String) -> Result<WindowInfo, String> {
    let window = app
        .get_webview_window(&label)
        .ok_or_else(|| format!("Window not found: {label}"))?;

    let pos = window.outer_position().map_err(|e| e.to_string())?;
    let size = window.outer_size().map_err(|e| e.to_string())?;

    Ok(WindowInfo {
        x: pos.x,
        y: pos.y,
        width: size.width,
        height: size.height,
    })
}

#[tauri::command]
fn set_window_position(app: AppHandle, label: String, x: i32, y: i32) -> Result<(), String> {
    let window = app
        .get_webview_window(&label)
        .ok_or_else(|| format!("Window not found: {label}"))?;

    window
        .set_position(PhysicalPosition { x, y })
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_temp_dir(name: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock should be after unix epoch")
            .as_nanos();
        std::env::temp_dir().join(format!("agentsoul-{name}-{nanos}"))
    }

    fn write_asset_pack_at(pack: &Path, id: &str, spritesheet_name: &str, write_sprite: bool) {
        fs::create_dir_all(pack).expect("asset pack folder should be writable");
        fs::write(
            pack.join("pet.json"),
            format!(
                r#"{{
                    "id": "{id}",
                    "displayName": "{id}",
                    "spritesheetPath": "{spritesheet_name}",
                    "kind": "person",
                    "version": "codex-pet-v1",
                    "frame": {{"width": 1, "height": 1, "count": 6}},
                    "fps": 6,
                    "states": {{
                        "idle": {{"frames": [0], "loop": true, "fps": 6}},
                        "blink": {{"frames": [1], "loop": true, "fps": 6}},
                        "happy": {{"frames": [2], "loop": true, "fps": 6}},
                        "attention": {{"frames": [3], "loop": true, "fps": 6}},
                        "sleep": {{"frames": [4], "loop": true, "fps": 6}},
                        "degraded": {{"frames": [5], "loop": true, "fps": 6}}
                    }}
                }}"#
            ),
        )
        .expect("pet.json should be writable");
        if write_sprite {
            let spritesheet_path = pack.join(spritesheet_name);
            if let Some(parent) = spritesheet_path.parent() {
                fs::create_dir_all(parent).expect("spritesheet parent should be writable");
            }
            fs::write(spritesheet_path, [0_u8, 1, 2, 3]).expect("spritesheet should be writable");
        }
    }

    fn write_asset_pack(
        root: &Path,
        name: &str,
        spritesheet_name: &str,
        write_sprite: bool,
    ) -> PathBuf {
        let pack = root.join(name);
        write_asset_pack_at(&pack, name, spritesheet_name, write_sprite);
        pack
    }

    fn write_thin_asset_pack_at(pack: &Path, id: &str) {
        fs::create_dir_all(pack).expect("asset pack folder should be writable");
        fs::write(
            pack.join("pet.json"),
            format!(
                r#"{{
                    "id": "{id}",
                    "displayName": "{id}",
                    "spritesheetPath": "spritesheet.webp",
                    "kind": "person"
                }}"#
            ),
        )
        .expect("pet.json should be writable");
        fs::write(pack.join("spritesheet.webp"), [0_u8, 1, 2, 3])
            .expect("spritesheet should be writable");
    }

    fn write_yuanqi_manifest_with_original_state_rows(pack: &Path) {
        fs::create_dir_all(pack).expect("asset pack folder should be writable");
        fs::write(
            pack.join("pet.json"),
            r#"{
                "id": "yuanqi-mianmian",
                "displayName": "元气眠眠",
                "spritesheetPath": "spritesheet.webp",
                "kind": "person",
                "version": "codex-pet-v1",
                "frame": {"width": 256, "height": 208, "count": 54},
                "fps": 6,
                "states": {
                    "idle": {"frames": [0, 1, 2, 3, 4, 5], "loop": true, "fps": 5},
                    "blink": {"frames": [0, 2, 3, 4, 5], "loop": true, "fps": 5},
                    "happy": {"frames": [18, 19, 20, 21], "loop": true, "fps": 6},
                    "attention": {"frames": [0, 1, 4, 5], "loop": true, "fps": 5},
                    "sleep": {"frames": [30, 31, 32, 33, 34, 35], "loop": true, "fps": 5},
                    "degraded": {"frames": [48, 49, 50, 51, 52, 53], "loop": true, "fps": 5}
                }
            }"#,
        )
        .expect("pet.json should be writable");
        fs::write(pack.join("spritesheet.webp"), [0_u8, 1, 2, 3])
            .expect("spritesheet should be writable");
    }

    #[test]
    fn read_asset_pack_repairs_known_yuanqi_state_rows() {
        let project_root = unique_temp_dir("yuanqi-repair");
        let pack = project_root.join("yuanqi.codex-pet");
        write_yuanqi_manifest_with_original_state_rows(&pack);

        let manifest =
            read_asset_pack(&pack.to_string_lossy()).expect("known yuanqi pack should be readable");
        let states = manifest.states.expect("known yuanqi pack should keep states");

        assert_eq!(states["idle"]["frames"], serde_json::json!([0, 1, 2, 3]));
        assert_eq!(states["happy"]["frames"], serde_json::json!([18, 19, 20]));
        assert_eq!(
            states["attention"]["frames"],
            serde_json::json!([0, 1, 2, 3])
        );
        assert_eq!(
            states["degraded"]["frames"],
            serde_json::json!([48, 49, 50, 51])
        );
    }

    #[test]
    fn resolve_active_pet_asset_pack_path_falls_back_when_current_manifest_is_incomplete() {
        let project_root = unique_temp_dir("invalid-current-fallback");
        let current = project_root
            .join("data")
            .join("desktop-v2")
            .join("pets")
            .join("current.codex-pet");
        let bundled_default = project_root.join("default.codex-pet");
        write_thin_asset_pack_at(&current, "thin-current");
        write_asset_pack_at(&bundled_default, "default", "spritesheet.webp", true);

        let resolved =
            resolve_active_pet_asset_pack_path_from_root(&project_root, &bundled_default);

        assert_eq!(resolved, bundled_default);
    }

    #[test]
    fn import_pet_asset_pack_validates_temp_copy_before_replacing_current() {
        let project_root = unique_temp_dir("transaction-import");
        let source_root = project_root.join("sources");
        let current = project_root
            .join("data")
            .join("desktop-v2")
            .join("pets")
            .join("current.codex-pet");
        fs::create_dir_all(&source_root).expect("source root should be writable");
        write_asset_pack_at(&current, "current", "spritesheet.webp", true);
        let invalid_source = write_asset_pack(&source_root, "invalid", "missing.webp", false);

        let result = import_pet_asset_pack_into_root(&invalid_source, &project_root)
            .expect("invalid imports should return validation, not throw");

        assert_eq!(result.validation.level, "error");
        assert!(current.join("spritesheet.webp").exists());
        let current_manifest =
            fs::read_to_string(current.join("pet.json")).expect("current manifest should remain");
        assert!(current_manifest.contains("\"id\": \"current\""));
    }

    #[test]
    fn import_pet_asset_pack_rejects_incomplete_manifest_without_replacing_current() {
        let project_root = unique_temp_dir("thin-import");
        let source_root = project_root.join("sources");
        let current = project_root
            .join("data")
            .join("desktop-v2")
            .join("pets")
            .join("current.codex-pet");
        let thin_source = source_root.join("thin.codex-pet");
        fs::create_dir_all(&source_root).expect("source root should be writable");
        write_asset_pack_at(&current, "current", "spritesheet.webp", true);
        write_thin_asset_pack_at(&thin_source, "thin");

        let result = import_pet_asset_pack_into_root(&thin_source, &project_root)
            .expect("invalid imports should return validation, not throw");

        assert_eq!(result.validation.level, "error");
        assert!(result
            .validation
            .messages
            .join(" ")
            .contains("frame config missing"));
        let current_manifest =
            fs::read_to_string(current.join("pet.json")).expect("current manifest should remain");
        assert!(current_manifest.contains("\"id\": \"current\""));
    }

    #[test]
    fn import_pet_asset_pack_replaces_current_after_temp_copy_validates() {
        let project_root = unique_temp_dir("valid-import");
        let source_root = project_root.join("sources");
        fs::create_dir_all(&source_root).expect("source root should be writable");
        let current = project_root
            .join("data")
            .join("desktop-v2")
            .join("pets")
            .join("current.codex-pet");
        write_asset_pack_at(&current, "current", "spritesheet.webp", true);
        let valid_source = write_asset_pack(&source_root, "next", "nested/spritesheet.webp", true);

        let result = import_pet_asset_pack_into_root(&valid_source, &project_root)
            .expect("valid imports should succeed");

        assert_eq!(result.validation.level, "ok");
        assert!(current.join("nested").join("spritesheet.webp").exists());
        assert!(result
            .manifest
            .expect("valid import should return manifest")
            .spritesheet_path
            .ends_with("current.codex-pet/nested/spritesheet.webp"));
    }
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_companion_runtime_state,
            load_pet_asset_pack,
            pick_pet_asset_pack_folder,
            import_pet_asset_pack,
            show_desktop_companion,
            hide_desktop_companion,
            get_screen_info,
            get_window_info,
            set_window_position
        ])
        .run(tauri::generate_context!())
        .expect("failed to run AgentSoul v2 Tauri shell");
}
