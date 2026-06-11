use std::collections::HashMap;
use tauri::State;

use crate::openclaw_config;
use crate::store::AppState;

// ============================================================================
// OpenClaw Provider Commands (migrated from provider.rs)
// ============================================================================

/// Import providers from OpenClaw live config to database.
///
/// OpenClaw uses additive mode — users may already have providers
/// configured in openclaw.json.
#[tauri::command]
pub fn import_openclaw_providers_from_live(state: State<'_, AppState>) -> Result<usize, String> {
    crate::services::provider::import_openclaw_providers_from_live(state.inner())
        .map_err(|e| e.to_string())
}

/// Get provider IDs in the OpenClaw live config.
#[tauri::command]
pub fn get_openclaw_live_provider_ids() -> Result<Vec<String>, String> {
    openclaw_config::get_providers()
        .map(|providers| providers.keys().cloned().collect())
        .map_err(|e| e.to_string())
}

/// Get a single OpenClaw provider fragment from live config.
#[tauri::command]
pub fn get_openclaw_live_provider(
    #[allow(non_snake_case)] providerId: String,
) -> Result<Option<serde_json::Value>, String> {
    openclaw_config::get_provider(&providerId).map_err(|e| e.to_string())
}

// ============================================================================
// Agents Configuration Commands
// ============================================================================

/// Get OpenClaw default model config (agents.defaults.model)
#[tauri::command]
pub fn get_openclaw_default_model() -> Result<Option<openclaw_config::OpenClawDefaultModel>, String>
{
    openclaw_config::get_default_model().map_err(|e| e.to_string())
}

/// Set OpenClaw default model config (agents.defaults.model)
#[tauri::command]
pub fn set_openclaw_default_model(
    model: openclaw_config::OpenClawDefaultModel,
) -> Result<openclaw_config::OpenClawWriteOutcome, String> {
    openclaw_config::set_default_model(&model).map_err(|e| e.to_string())
}

/// Get OpenClaw model catalog/allowlist (agents.defaults.models)
#[tauri::command]
pub fn get_openclaw_model_catalog(
) -> Result<Option<HashMap<String, openclaw_config::OpenClawModelCatalogEntry>>, String> {
    openclaw_config::get_model_catalog().map_err(|e| e.to_string())
}

/// Set OpenClaw model catalog/allowlist (agents.defaults.models)
#[tauri::command]
pub fn set_openclaw_model_catalog(
    catalog: HashMap<String, openclaw_config::OpenClawModelCatalogEntry>,
) -> Result<openclaw_config::OpenClawWriteOutcome, String> {
    openclaw_config::set_model_catalog(&catalog).map_err(|e| e.to_string())
}
