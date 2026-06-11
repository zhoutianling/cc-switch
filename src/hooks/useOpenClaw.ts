import { useQuery } from "@tanstack/react-query";
import { openclawApi } from "@/lib/api/openclaw";
import { providersApi } from "@/lib/api/providers";

/**
 * Centralized query keys for all OpenClaw-related queries.
 * Import this from any file that needs to invalidate OpenClaw caches.
 */
export const openclawKeys = {
  all: ["openclaw"] as const,
  liveProviderIds: ["openclaw", "liveProviderIds"] as const,
  defaultModel: ["openclaw", "defaultModel"] as const,
};

// ============================================================
// Query hooks
// ============================================================

/**
 * Query live provider IDs from openclaw.json config.
 * Used by ProviderList to show "In Config" badge.
 */
export function useOpenClawLiveProviderIds(enabled: boolean) {
  return useQuery({
    queryKey: openclawKeys.liveProviderIds,
    queryFn: () => providersApi.getOpenClawLiveProviderIds(),
    enabled,
  });
}

/**
 * Query the default model from agents.defaults.model.
 * Used by ProviderList to show which provider is the default.
 */
export function useOpenClawDefaultModel(enabled: boolean) {
  return useQuery({
    queryKey: openclawKeys.defaultModel,
    queryFn: () => openclawApi.getDefaultModel(),
    enabled,
  });
}
