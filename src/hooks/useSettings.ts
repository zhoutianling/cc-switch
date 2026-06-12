import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { providersApi, settingsApi } from "@/lib/api";
import { syncCurrentProvidersLiveSafe } from "@/utils/postChangeSync";
import { useSettingsQuery, useSaveSettingsMutation } from "@/lib/query";
import type { Settings } from "@/types";
import { useSettingsForm, type SettingsFormState } from "./useSettingsForm";
import {
  useDirectorySettings,
  type DirectoryAppId,
  type ResolvedDirectories,
} from "./useDirectorySettings";
import { useSettingsMetadata } from "./useSettingsMetadata";

interface SaveResult {
  requiresRestart: boolean;
}

export interface UseSettingsResult {
  settings: SettingsFormState | null;
  isLoading: boolean;
  isSaving: boolean;
  isPortable: boolean;
  appConfigDir?: string;
  resolvedDirs: ResolvedDirectories;
  requiresRestart: boolean;
  updateSettings: (updates: Partial<SettingsFormState>) => void;
  updateDirectory: (app: DirectoryAppId, value?: string) => void;
  updateAppConfigDir: (value?: string) => void;
  browseDirectory: (app: DirectoryAppId) => Promise<void>;
  browseAppConfigDir: () => Promise<void>;
  resetDirectory: (app: DirectoryAppId) => Promise<void>;
  resetAppConfigDir: () => Promise<void>;
  saveSettings: (
    overrides?: Partial<SettingsFormState>,
    options?: { silent?: boolean },
  ) => Promise<SaveResult | null>;
  autoSaveSettings: (
    updates: Partial<SettingsFormState>,
  ) => Promise<SaveResult | null>;
  resetSettings: () => void;
  acknowledgeRestart: () => void;
}

export type { SettingsFormState, ResolvedDirectories };

const sanitizeDir = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const buildSettingsPayload = (
  settings: SettingsFormState,
  dirs: {
    claudeConfigDir?: string;
    codexConfigDir?: string;
    geminiConfigDir?: string;
    opencodeConfigDir?: string;
  },
): Settings => ({
  ...settings,
  ...dirs,
  language: "zh",
});

export function useSettings(): UseSettingsResult {
  const { t } = useTranslation();
  const { data } = useSettingsQuery();
  const saveMutation = useSaveSettingsMutation();
  const queryClient = useQueryClient();

  const {
    settings,
    isLoading: isFormLoading,
    initialLanguage,
    updateSettings,
    resetSettings: resetForm,
    syncLanguage,
  } = useSettingsForm();

  const {
    appConfigDir,
    resolvedDirs,
    isLoading: isDirectoryLoading,
    initialAppConfigDir,
    updateDirectory,
    updateAppConfigDir,
    browseDirectory,
    browseAppConfigDir,
    resetDirectory,
    resetAppConfigDir,
    resetAllDirectories,
  } = useDirectorySettings({
    settings,
    onUpdateSettings: updateSettings,
  });

  const {
    isPortable,
    requiresRestart,
    isLoading: isMetadataLoading,
    acknowledgeRestart,
    setRequiresRestart,
  } = useSettingsMetadata();

  const resetSettings = useCallback(() => {
    resetForm(data ?? null);
    syncLanguage(initialLanguage);
    resetAllDirectories({
      claude: sanitizeDir(data?.claudeConfigDir),
      codex: sanitizeDir(data?.codexConfigDir),
      gemini: sanitizeDir(data?.geminiConfigDir),
      opencode: sanitizeDir(data?.opencodeConfigDir),
    });
    setRequiresRestart(false);
  }, [
    data,
    initialLanguage,
    resetAllDirectories,
    resetForm,
    setRequiresRestart,
    syncLanguage,
  ]);

  const syncClaudePluginIfChanged = useCallback(
    async (
      enabled: boolean | undefined,
      prevEnabled: boolean | undefined,
    ): Promise<boolean> => {
      if (enabled === undefined || enabled === prevEnabled) return false;

      try {
        if (enabled) {
          const currentId = await providersApi.getCurrent("claude");
          let isOfficial = false;
          if (currentId) {
            const allProviders = await providersApi.getAll("claude");
            isOfficial = allProviders[currentId]?.category === "official";
          }
          await settingsApi.applyClaudePluginConfig({ official: isOfficial });
        } else {
          await settingsApi.applyClaudePluginConfig({ official: true });
        }

        const syncResult = await syncCurrentProvidersLiveSafe();
        if (!syncResult.ok) {
          console.warn(
            "[useSettings] Failed to sync providers after toggling Claude plugin",
            syncResult.error,
          );
          toast.error(
            t("notifications.syncClaudePluginFailed", {
              defaultValue: "同步 Claude 插件失败",
            }),
          );
        }
        return true;
      } catch (error) {
        console.warn("[useSettings] Failed to sync Claude plugin config", error);
        toast.error(
          t("notifications.syncClaudePluginFailed", {
            defaultValue: "同步 Claude 插件失败",
          }),
        );
        return false;
      }
    },
    [t],
  );

  const autoSaveSettings = useCallback(
    async (updates: Partial<SettingsFormState>): Promise<SaveResult | null> => {
      const mergedSettings = settings ? { ...settings, ...updates } : null;
      if (!mergedSettings) return null;

      try {
        const payload = buildSettingsPayload(mergedSettings, {
          claudeConfigDir: sanitizeDir(mergedSettings.claudeConfigDir),
          codexConfigDir: sanitizeDir(mergedSettings.codexConfigDir),
          geminiConfigDir: sanitizeDir(mergedSettings.geminiConfigDir),
          opencodeConfigDir: sanitizeDir(mergedSettings.opencodeConfigDir),
        });

        const prevPluginEnabled = queryClient.getQueryData<Settings>([
          "settings",
        ])?.enableClaudePluginIntegration;

        await saveMutation.mutateAsync(payload);

        if (
          payload.launchOnStartup !== undefined &&
          payload.launchOnStartup !== data?.launchOnStartup
        ) {
          try {
            await settingsApi.setAutoLaunch(payload.launchOnStartup);
          } catch (error) {
            console.error("Failed to update auto-launch:", error);
            toast.error(
              t("settings.autoLaunchFailed", {
                defaultValue: "设置开机自启失败",
              }),
            );
          }
        }

        const nextSkipClaudeOnboarding = updates.skipClaudeOnboarding;
        if (
          nextSkipClaudeOnboarding !== undefined &&
          nextSkipClaudeOnboarding !== (data?.skipClaudeOnboarding ?? false)
        ) {
          try {
            if (nextSkipClaudeOnboarding) {
              await settingsApi.applyClaudeOnboardingSkip();
            } else {
              await settingsApi.clearClaudeOnboardingSkip();
            }
          } catch (error) {
            console.warn(
              "[useSettings] Failed to sync Claude onboarding skip",
              error,
            );
            toast.error(
              nextSkipClaudeOnboarding
                ? t("notifications.skipClaudeOnboardingFailed", {
                    defaultValue: "跳过 Claude Code 初次安装确认失败",
                  })
                : t("notifications.clearClaudeOnboardingSkipFailed", {
                    defaultValue: "恢复 Claude Code 初次安装确认失败",
                  }),
            );
          }
        }

        await syncClaudePluginIfChanged(
          payload.enableClaudePluginIntegration,
          prevPluginEnabled,
        );

        try {
          await providersApi.updateTrayMenu();
        } catch (error) {
          console.warn("[useSettings] Failed to refresh tray menu", error);
        }

        return { requiresRestart: false };
      } catch (error) {
        console.error("[useSettings] Failed to auto-save settings", error);
        toast.error(
          t("notifications.settingsSaveFailed", {
            defaultValue: "保存设置失败: {{error}}",
            error: (error as Error)?.message ?? String(error),
          }),
        );
        throw error;
      }
    },
    [data, queryClient, saveMutation, settings, syncClaudePluginIfChanged, t],
  );

  const saveSettings = useCallback(
    async (
      overrides?: Partial<SettingsFormState>,
      options?: { silent?: boolean },
    ): Promise<SaveResult | null> => {
      const mergedSettings = settings ? { ...settings, ...overrides } : null;
      if (!mergedSettings) return null;

      try {
        const sanitizedAppDir = sanitizeDir(appConfigDir);
        const sanitizedClaudeDir = sanitizeDir(mergedSettings.claudeConfigDir);
        const sanitizedCodexDir = sanitizeDir(mergedSettings.codexConfigDir);
        const sanitizedGeminiDir = sanitizeDir(mergedSettings.geminiConfigDir);
        const sanitizedOpencodeDir = sanitizeDir(
          mergedSettings.opencodeConfigDir,
        );
        const previousAppDir = initialAppConfigDir;
        const previousClaudeDir = sanitizeDir(data?.claudeConfigDir);
        const previousCodexDir = sanitizeDir(data?.codexConfigDir);
        const previousGeminiDir = sanitizeDir(data?.geminiConfigDir);
        const previousOpencodeDir = sanitizeDir(data?.opencodeConfigDir);

        const payload = buildSettingsPayload(mergedSettings, {
          claudeConfigDir: sanitizedClaudeDir,
          codexConfigDir: sanitizedCodexDir,
          geminiConfigDir: sanitizedGeminiDir,
          opencodeConfigDir: sanitizedOpencodeDir,
        });

        const prevPluginEnabled = queryClient.getQueryData<Settings>([
          "settings",
        ])?.enableClaudePluginIntegration;

        await saveMutation.mutateAsync(payload);
        await settingsApi.setAppConfigDirOverride(sanitizedAppDir ?? null);

        if (
          payload.launchOnStartup !== undefined &&
          payload.launchOnStartup !== data?.launchOnStartup
        ) {
          try {
            await settingsApi.setAutoLaunch(payload.launchOnStartup);
          } catch (error) {
            console.error("Failed to update auto-launch:", error);
            toast.error(
              t("settings.autoLaunchFailed", {
                defaultValue: "设置开机自启失败",
              }),
            );
          }
        }

        const prevSkipClaudeOnboarding = data?.skipClaudeOnboarding ?? false;
        const nextSkipClaudeOnboarding = payload.skipClaudeOnboarding ?? false;
        if (nextSkipClaudeOnboarding !== prevSkipClaudeOnboarding) {
          try {
            if (nextSkipClaudeOnboarding) {
              await settingsApi.applyClaudeOnboardingSkip();
            } else {
              await settingsApi.clearClaudeOnboardingSkip();
            }
          } catch (error) {
            console.warn(
              "[useSettings] Failed to sync Claude onboarding skip",
              error,
            );
            toast.error(
              nextSkipClaudeOnboarding
                ? t("notifications.skipClaudeOnboardingFailed", {
                    defaultValue: "跳过 Claude Code 初次安装确认失败",
                  })
                : t("notifications.clearClaudeOnboardingSkipFailed", {
                    defaultValue: "恢复 Claude Code 初次安装确认失败",
                  }),
            );
          }
        }

        const pluginSynced = await syncClaudePluginIfChanged(
          payload.enableClaudePluginIntegration,
          prevPluginEnabled,
        );

        try {
          await providersApi.updateTrayMenu();
        } catch (error) {
          console.warn("[useSettings] Failed to refresh tray menu", error);
        }

        const claudeDirChanged = sanitizedClaudeDir !== previousClaudeDir;
        const codexDirChanged = sanitizedCodexDir !== previousCodexDir;
        const geminiDirChanged = sanitizedGeminiDir !== previousGeminiDir;
        const opencodeDirChanged = sanitizedOpencodeDir !== previousOpencodeDir;
        if (
          !pluginSynced &&
          (claudeDirChanged ||
            codexDirChanged ||
            geminiDirChanged ||
            opencodeDirChanged)
        ) {
          const syncResult = await syncCurrentProvidersLiveSafe();
          if (!syncResult.ok) {
            console.warn(
              "[useSettings] Failed to sync current providers after directory change",
              syncResult.error,
            );
          }
        }

        const appDirChanged = sanitizedAppDir !== (previousAppDir ?? undefined);
        setRequiresRestart(appDirChanged);

        if (!options?.silent) {
          toast.success(
            t("notifications.settingsSaved", {
              defaultValue: "设置已保存",
            }),
            { closeButton: true },
          );
        }

        return { requiresRestart: appDirChanged };
      } catch (error) {
        console.error("[useSettings] Failed to save settings", error);
        toast.error(
          t("notifications.settingsSaveFailed", {
            defaultValue: "保存设置失败: {{error}}",
            error: (error as Error)?.message ?? String(error),
          }),
        );
        throw error;
      }
    },
    [
      appConfigDir,
      data,
      initialAppConfigDir,
      queryClient,
      saveMutation,
      setRequiresRestart,
      settings,
      syncClaudePluginIfChanged,
      t,
    ],
  );

  const isLoading = useMemo(
    () => isFormLoading || isDirectoryLoading || isMetadataLoading,
    [isDirectoryLoading, isFormLoading, isMetadataLoading],
  );

  return {
    settings,
    isLoading,
    isSaving: saveMutation.isPending,
    isPortable,
    appConfigDir,
    resolvedDirs,
    requiresRestart,
    updateSettings,
    updateDirectory,
    updateAppConfigDir,
    browseDirectory,
    browseAppConfigDir,
    resetDirectory,
    resetAppConfigDir,
    saveSettings,
    autoSaveSettings,
    resetSettings,
    acknowledgeRestart,
  };
}
