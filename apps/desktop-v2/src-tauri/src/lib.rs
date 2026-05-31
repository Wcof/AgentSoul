use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::net::{SocketAddr, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Manager, PhysicalPosition, State};

const EXTERNAL_TOOL_GATEWAY_HOST: &str = "127.0.0.1";
const EXTERNAL_TOOL_GATEWAY_PORT: u16 = 3001;

struct ExternalToolGatewayProcess {
    child: Mutex<Option<Child>>,
}

impl Default for ExternalToolGatewayProcess {
    fn default() -> Self {
        Self {
            child: Mutex::new(None),
        }
    }
}

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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ApprovalSurfaceState {
    approval_required_placeholder: &'static str,
    risk_notice_placeholder: &'static str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ExternalToolGatewayStatus {
    state: &'static str,
    host: &'static str,
    port: u16,
    url: String,
    pid: Option<u32>,
    message: String,
}

#[tauri::command]
fn get_companion_runtime_state() -> CompanionRuntimeState {
    let asset_pack_path = resolve_active_pet_asset_pack_path();
    let asset_pack_path_str = asset_pack_path.to_string_lossy().to_string();
    let asset_result = read_asset_pack(&asset_pack_path_str);
    let (asset_manifest, asset_validation) = match asset_result {
        Ok(ok) => (Some(ok), AssetValidationState { level: "ok", messages: vec![] }),
        Err(errs) => (None, AssetValidationState { level: "error", messages: errs }),
    };
    let session_ready = has_any_path(&[
        "./data/desktop-v2/agentsoul-v2.sqlite",
        "./data/sessions",
    ]);
    let gateway_ready = is_gateway_reachable("127.0.0.1:3001");
    let mcp_ready = has_any_path(&[
        "./apps/mcp-server",
        "./packages/mcp-adapter",
    ]);
    let permit_ready = has_any_path(&[
        "./data/desktop-v2/agentsoul-v2.sqlite",
        "./data/permits",
    ]);
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
            available_quick_actions: vec!["open-control-center", "refresh-runtime", "show-status"],
            last_updated_at: iso_timestamp_now(),
            autonomy: CompanionAutonomyState {
                user_presence: "PRESENT",
                companion_mode: if gateway_ready { "AUTONOMOUS" } else { "QUEUING" },
                last_event_priority: if gateway_ready { "LOW" } else { "MEDIUM" },
                last_output_strategy: if gateway_ready { "silent" } else { "queue" },
                queued_output_count: if gateway_ready { 0 } else { 1 },
                last_action: if gateway_ready {
                    "reflect-and-update-affect"
                } else {
                    "surface-memory-or-status"
                },
                cooldown_until: None,
            },
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

fn resolve_active_pet_asset_pack_path() -> PathBuf {
    let current = resolve_project_root()
        .join("data")
        .join("desktop-v2")
        .join("pets")
        .join("current.codex-pet");
    if current.join("pet.json").exists() {
        return current;
    }
    PathBuf::from("/Users/ldh/Downloads/yuanqi-mianmian.codex-pet")
}

fn has_any_path(paths: &[&str]) -> bool {
    paths.iter().any(|path| Path::new(path).exists())
}

fn is_gateway_reachable(addr: &str) -> bool {
    let socket: Option<SocketAddr> = addr.parse().ok();
    match socket {
        Some(target) => TcpStream::connect_timeout(&target, Duration::from_millis(250)).is_ok(),
        None => false,
    }
}

fn iso_timestamp_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    match SystemTime::now().duration_since(UNIX_EPOCH) {
        Ok(duration) => format!("{}Z", duration.as_secs()),
        Err(_) => "0Z".to_string(),
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
fn import_pet_asset_pack(source_asset_pack_path: String) -> Result<PetAssetPackImportResult, String> {
    let source = PathBuf::from(source_asset_pack_path.trim());
    if !source.exists() || !source.is_dir() {
        return Err("source folder not found".to_string());
    }
    let source_pet_json = source.join("pet.json");
    if !source_pet_json.exists() {
        return Err("invalid asset pack folder: missing pet.json".to_string());
    }

    let project_root = resolve_project_root();
    let pets_root = project_root.join("data").join("desktop-v2").join("pets");
    fs::create_dir_all(&pets_root).map_err(|error| format!("failed creating pets folder: {error}"))?;

    let target = pets_root.join("current.codex-pet");
    let source_canonical = source.canonicalize().unwrap_or_else(|_| source.clone());
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

    if target.exists() {
        fs::remove_dir_all(&target).map_err(|error| format!("failed clearing current asset pack: {error}"))?;
    }
    clear_other_pet_packs(&pets_root, "current.codex-pet")
        .map_err(|error| format!("failed clearing old asset packs: {error}"))?;

    copy_dir_recursive(&source, &target).map_err(|error| format!("failed copying asset pack: {error}"))?;
    let target_path = target.to_string_lossy().to_string();

    match read_asset_pack(&target_path) {
        Ok(manifest) => Ok(PetAssetPackImportResult {
            source_asset_pack_path: source.to_string_lossy().to_string(),
            asset_pack_path: target_path,
            manifest: Some(manifest),
            validation: AssetValidationState {
                level: "ok",
                messages: vec![],
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
    }
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

#[tauri::command]
fn get_external_tool_gateway_status(
    state: State<ExternalToolGatewayProcess>,
) -> Result<ExternalToolGatewayStatus, String> {
    external_tool_gateway_status(&state)
}

#[tauri::command]
fn start_external_tool_gateway(
    state: State<ExternalToolGatewayProcess>,
) -> Result<ExternalToolGatewayStatus, String> {
    let mut guard = state
        .child
        .lock()
        .map_err(|_| "external tool gateway state lock poisoned".to_string())?;

    if let Some(child) = guard.as_mut() {
        match child.try_wait() {
            Ok(None) => return Ok(status_running(Some(child.id()), "第三方工具网关运行中")),
            Ok(Some(_)) => {
                *guard = None;
            }
            Err(error) => {
                *guard = None;
                return Ok(status_error(format!("检查网关进程失败: {error}")));
            }
        }
    }

    if is_gateway_reachable(&external_tool_gateway_addr()) {
        return Ok(status_error(format!(
            "端口 {} 已被占用",
            EXTERNAL_TOOL_GATEWAY_PORT
        )));
    }

    let project_root = resolve_project_root();
    let script_path = project_root
        .join("apps")
        .join("desktop-v2")
        .join("scripts")
        .join("external-tool-gateway.mts");

    let child = Command::new("npx")
        .arg("tsx")
        .arg(script_path)
        .current_dir(&project_root)
        .env("AGENTSOUL_EXTERNAL_TOOL_GATEWAY_HOST", EXTERNAL_TOOL_GATEWAY_HOST)
        .env(
            "AGENTSOUL_EXTERNAL_TOOL_GATEWAY_PORT",
            EXTERNAL_TOOL_GATEWAY_PORT.to_string(),
        )
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| format!("启动第三方工具网关失败: {error}"))?;

    let pid = child.id();
    *guard = Some(child);
    Ok(status_running(Some(pid), "第三方工具网关已启动"))
}

#[tauri::command]
fn stop_external_tool_gateway(
    state: State<ExternalToolGatewayProcess>,
) -> Result<ExternalToolGatewayStatus, String> {
    let mut guard = state
        .child
        .lock()
        .map_err(|_| "external tool gateway state lock poisoned".to_string())?;

    if let Some(mut child) = guard.take() {
        let _ = child.kill();
        let _ = child.wait();
        return Ok(status_stopped("第三方工具网关已暂停"));
    }

    Ok(status_stopped("第三方工具网关未启动"))
}

#[tauri::command]
fn restart_external_tool_gateway(
    state: State<ExternalToolGatewayProcess>,
) -> Result<ExternalToolGatewayStatus, String> {
    let _ = stop_external_tool_gateway(state.clone());
    start_external_tool_gateway(state)
}

fn external_tool_gateway_status(
    state: &State<ExternalToolGatewayProcess>,
) -> Result<ExternalToolGatewayStatus, String> {
    let mut guard = state
        .child
        .lock()
        .map_err(|_| "external tool gateway state lock poisoned".to_string())?;

    if let Some(child) = guard.as_mut() {
        match child.try_wait() {
            Ok(None) => return Ok(status_running(Some(child.id()), "第三方工具网关运行中")),
            Ok(Some(_)) => {
                *guard = None;
            }
            Err(error) => {
                *guard = None;
                return Ok(status_error(format!("检查网关进程失败: {error}")));
            }
        }
    }

    if is_gateway_reachable(&external_tool_gateway_addr()) {
        return Ok(status_error(format!(
            "端口 {} 已被其他进程占用",
            EXTERNAL_TOOL_GATEWAY_PORT
        )));
    }

    Ok(status_stopped("第三方工具网关未启动"))
}

fn external_tool_gateway_addr() -> String {
    format!("{}:{}", EXTERNAL_TOOL_GATEWAY_HOST, EXTERNAL_TOOL_GATEWAY_PORT)
}

fn external_tool_gateway_url() -> String {
    format!(
        "http://{}:{}",
        EXTERNAL_TOOL_GATEWAY_HOST, EXTERNAL_TOOL_GATEWAY_PORT
    )
}

fn status_running(pid: Option<u32>, message: impl Into<String>) -> ExternalToolGatewayStatus {
    ExternalToolGatewayStatus {
        state: "running",
        host: EXTERNAL_TOOL_GATEWAY_HOST,
        port: EXTERNAL_TOOL_GATEWAY_PORT,
        url: external_tool_gateway_url(),
        pid,
        message: message.into(),
    }
}

fn status_stopped(message: impl Into<String>) -> ExternalToolGatewayStatus {
    ExternalToolGatewayStatus {
        state: "stopped",
        host: EXTERNAL_TOOL_GATEWAY_HOST,
        port: EXTERNAL_TOOL_GATEWAY_PORT,
        url: external_tool_gateway_url(),
        pid: None,
        message: message.into(),
    }
}

fn status_error(message: impl Into<String>) -> ExternalToolGatewayStatus {
    ExternalToolGatewayStatus {
        state: "error",
        host: EXTERNAL_TOOL_GATEWAY_HOST,
        port: EXTERNAL_TOOL_GATEWAY_PORT,
        url: external_tool_gateway_url(),
        pid: None,
        message: message.into(),
    }
}

pub fn run() {
    tauri::Builder::default()
        .manage(ExternalToolGatewayProcess::default())
        .invoke_handler(tauri::generate_handler![
            get_companion_runtime_state,
            load_pet_asset_pack,
            pick_pet_asset_pack_folder,
            import_pet_asset_pack,
            get_external_tool_gateway_status,
            start_external_tool_gateway,
            stop_external_tool_gateway,
            restart_external_tool_gateway,
            show_desktop_companion,
            show_control_center,
            hide_desktop_companion,
            get_screen_info,
            get_window_info,
            set_window_position
        ])
        .run(tauri::generate_context!())
        .expect("failed to run AgentSoul v2 Tauri shell");
}
