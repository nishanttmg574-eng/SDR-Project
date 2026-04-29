"use client";

import { useMemo, useState } from "react";
import {
  AI_PROVIDER_LABELS,
  AI_PROVIDER_MODELS,
  providerDefaultModel,
  type AiProviderId,
} from "@/lib/config";
import type { AiReadiness } from "@/lib/ai-providers";

const PROVIDERS: AiProviderId[] = ["openai", "anthropic"];

export function AiSettingsFields({
  provider,
  model,
  readiness,
}: {
  provider: AiProviderId;
  model: string;
  readiness: Record<AiProviderId, AiReadiness>;
}) {
  const [selectedProvider, setSelectedProvider] = useState<AiProviderId>(provider);
  const [selectedModel, setSelectedModel] = useState(model);
  const providerModels = AI_PROVIDER_MODELS[selectedProvider];
  const modelIsKnown = providerModels.includes(selectedModel);
  const [customModel, setCustomModel] = useState(modelIsKnown ? "" : selectedModel);
  const effectiveModel = modelIsKnown ? selectedModel : customModel.trim();

  const setup = readiness[selectedProvider];
  const options = useMemo(
    () => providerModels.map((option) => ({ value: option, label: option })),
    [providerModels]
  );

  function switchProvider(next: AiProviderId): void {
    setSelectedProvider(next);
    const nextDefault = providerDefaultModel(next);
    setSelectedModel(nextDefault);
    setCustomModel("");
  }

  return (
    <div className="space-y-5 rounded-lg border border-neutral-200 bg-white p-4">
      <input type="hidden" name="aiProvider" value={selectedProvider} />
      <input type="hidden" name="model" value={effectiveModel || providerDefaultModel(selectedProvider)} />

      <div>
        <div className="text-sm font-medium text-neutral-800">AI provider</div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {PROVIDERS.map((item) => {
            const active = item === selectedProvider;
            const itemReadiness = readiness[item];
            return (
              <button
                key={item}
                type="button"
                onClick={() => switchProvider(item)}
                className={`rounded-md border px-3 py-2 text-left text-sm ${
                  active
                    ? "border-blue-500 bg-blue-50 text-blue-900"
                    : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                }`}
                aria-pressed={active}
              >
                <span className="block font-medium">{AI_PROVIDER_LABELS[item]}</span>
                <span
                  className={`mt-0.5 block text-xs ${
                    itemReadiness.configured ? "text-neutral-500" : "text-amber-700"
                  }`}
                >
                  {itemReadiness.configured ? "API key ready" : `${itemReadiness.envVar} missing`}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="text-sm font-medium text-neutral-800">Model</div>
        <select
          className="input mt-2"
          value={modelIsKnown ? selectedModel : "custom"}
          onChange={(event) => {
            const value = event.target.value;
            if (value === "custom") {
              setSelectedModel("custom");
              setCustomModel(customModel || "");
            } else {
              setSelectedModel(value);
              setCustomModel("");
            }
          }}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
          <option value="custom">Custom model ID</option>
        </select>

        {!modelIsKnown && (
          <input
            className="input mt-2"
            value={customModel}
            onChange={(event) => setCustomModel(event.target.value)}
            placeholder={`${providerDefaultModel(selectedProvider)} or another model ID`}
          />
        )}
      </div>

      <div
        className={`rounded-md border p-3 text-sm ${
          setup.configured
            ? "border-green-200 bg-green-50 text-green-900"
            : "border-amber-200 bg-amber-50 text-amber-900"
        }`}
      >
        <div className="font-medium">{AI_PROVIDER_LABELS[selectedProvider]} key</div>
        <div className="mt-0.5">
          {setup.configured ? "Ready. Full key is never shown." : setup.setupHint}
        </div>
      </div>
    </div>
  );
}
