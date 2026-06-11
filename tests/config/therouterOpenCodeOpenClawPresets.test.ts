import { describe, expect, it } from "vitest";
import { opencodeProviderPresets } from "@/config/opencodeProviderPresets";

describe("TheRouter OpenCode presets", () => {
  it("uses OpenAI-compatible config for OpenCode", () => {
    const preset = opencodeProviderPresets.find((item) => item.name === "TheRouter");
    const models = preset?.settingsConfig.models ?? {};

    expect(preset).toBeDefined();
    expect(preset?.websiteUrl).toBe("https://therouter.ai");
    expect(preset?.apiKeyUrl).toBe("https://dashboard.therouter.ai");
    expect(preset?.category).toBe("aggregator");
    expect(preset?.settingsConfig.npm).toBe("@ai-sdk/openai-compatible");
    expect(preset?.settingsConfig.options?.baseURL).toBe(
      "https://api.therouter.ai/v1",
    );
    expect(preset?.settingsConfig.options?.setCacheKey).toBe(true);
    expect(models).toHaveProperty("openai/gpt-5.3-codex");
    expect(models).toHaveProperty("anthropic/claude-sonnet-4.6");
    expect(models).toHaveProperty("google/gemini-3-flash-preview");
  });

});
