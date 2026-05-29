use serde::Serialize;
use tauri::{AppHandle, Manager};

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
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PetAppearanceState {
    kind: &'static str,
    skin: &'static str,
    animation_style: &'static str,
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
    CompanionRuntimeState {
        companion: CompanionState {
            id: "active-companion",
            display_name: "AgentSoul Companion",
            soul_id: "default-soul",
            pet_appearance: PetAppearanceState {
                kind: "slime",
                skin: "default",
                animation_style: "idle",
            },
            mood: "neutral",
            vitals: CompanionVitalsState {
                level: 1,
                xp: 0,
                companion_energy: 100,
                hunger: 100,
                intimacy: 0,
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

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_companion_runtime_state,
            show_desktop_companion,
            show_control_center
        ])
        .run(tauri::generate_context!())
        .expect("failed to run AgentSoul v2 Tauri shell");
}
