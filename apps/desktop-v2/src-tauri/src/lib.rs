use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::Path;
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CompanionRuntimeState {
    companion: CompanionState,
    provider_profile: ProviderProfileState,
    approval_surface: ApprovalSurfaceState,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CompanionState {
    id: &'static str,
    display_name: &'static str,
    soul_id: &'static str,
    pet_appearance: PetAppearanceState,
    mood: &'static str,
    vitals: CompanionVitalsState,
    activity_state: &'static str,
    health_state: &'static str,
    summary: String,
    available_quick_actions: Vec<&'static str>,
    last_updated_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PetAppearanceState {
    kind: &'static str,
    skin: &'static str,
    animation_style: &'static str,
    asset_pack_id: &'static str,
    asset_pack_path: &'static str,
    display_name: &'static str,
    spritesheet_path: &'static str,
    asset_pack_version: &'static str,
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
struct ProviderProfileState {
    id: &'static str,
    name: &'static str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ApprovalSurfaceState {
    approval_required_placeholder: &'static str,
    risk_notice_placeholder: &'static str,
}

#[tauri::command]
fn get_companion_runtime_state() -> CompanionRuntimeState {
    let asset_pack_path = "/Users/ldh/Downloads/yuanqi-mianmian.codex-pet";
    let asset_result = read_asset_pack(asset_pack_path);
    let (asset_manifest, asset_validation) = match asset_result {
        Ok(ok) => (Some(ok), AssetValidationState { level: "ok", messages: vec![] }),
        Err(errs) => (None, AssetValidationState { level: "error", messages: errs }),
    };
    let session_ready = Path::new("./data/sessions").exists();
    let gateway_ready = Path::new("./data/gateway").exists();
    let mcp_ready = Path::new("./apps/mcp-server").exists();
    let permit_ready = Path::new("./data/permits").exists();
    let ready_count = [session_ready, gateway_ready, mcp_ready, permit_ready]
        .iter()
        .filter(|ready| **ready)
        .count();
    let (health_state, mood, activity_state) = if ready_count >= 3 {
        ("healthy", "positive", "idle")
    } else if ready_count >= 2 {
        ("attention", "neutral", "attention")
    } else {
        ("degraded", "fatigued", "attention")
    };
    let summary = format!(
        "session:{}, gateway:{}, mcp:{}, permit:{}",
        bool_status(session_ready),
        bool_status(gateway_ready),
        bool_status(mcp_ready),
        bool_status(permit_ready)
    );

    CompanionRuntimeState {
        companion: CompanionState {
            id: "active-companion",
            display_name: "元气眠眠",
            soul_id: "default-soul",
            pet_appearance: PetAppearanceState {
                kind: "custom",
                skin: "yuanqi-mianmian",
                animation_style: "idle",
                asset_pack_id: "yuanqi-mianmian",
                asset_pack_path: "/Users/ldh/Downloads/yuanqi-mianmian.codex-pet",
                display_name: "元气眠眠",
                spritesheet_path: "/Users/ldh/Downloads/yuanqi-mianmian.codex-pet/spritesheet.webp",
                asset_pack_version: "codex-pet-v1",
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
            available_quick_actions: vec!["open-control-center", "refresh-runtime", "show-status"],
            last_updated_at: format!("{:?}", std::time::SystemTime::now()),
        },
        provider_profile: ProviderProfileState {
            id: "default-provider-profile",
            name: "Local Gateway Default",
        },
        approval_surface: ApprovalSurfaceState {
            approval_required_placeholder: "Approval Required",
            risk_notice_placeholder: "Risk Notice",
        },
    }
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
    let spritesheet_rel = str_field(&parsed, "spritesheetPath").unwrap_or_else(|| "spritesheet.webp".to_string());
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
    let frame = parsed
        .get("frame")
        .and_then(|value| serde_json::from_value::<FrameConfigState>(value.clone()).ok());
    let anchor = parsed
        .get("anchor")
        .and_then(|value| serde_json::from_value::<AnchorState>(value.clone()).ok());
    let manifest = PetAssetManifestState {
        id,
        display_name,
        description: str_field(&parsed, "description"),
        spritesheet_path: spritesheet_full,
        kind: str_field(&parsed, "kind").unwrap_or_else(|| "custom".to_string()),
        version: str_field(&parsed, "version"),
        frame,
        states: parsed.get("states").cloned(),
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

fn str_field(root: &Value, key: &str) -> Option<String> {
    root.get(key).and_then(Value::as_str).map(|value| value.to_string())
}

fn bool_status(ready: bool) -> &'static str {
    if ready {
        "ready"
    } else {
        "missing"
    }
}

#[tauri::command]
fn show_desktop_companion(app: AppHandle) -> Result<(), String> {
    show_window(&app, "desktop-companion")
}

#[tauri::command]
fn show_control_center(app: AppHandle) -> Result<(), String> {
    show_window(&app, "control-center")
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

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_companion_runtime_state,
            load_pet_asset_pack,
            show_desktop_companion,
            show_control_center,
            get_screen_info,
            get_window_info,
            set_window_position
        ])
        .run(tauri::generate_context!())
        .expect("failed to run AgentSoul v2 Tauri shell");
}
