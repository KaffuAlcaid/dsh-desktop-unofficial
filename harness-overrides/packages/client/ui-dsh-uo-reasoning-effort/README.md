# @dsh-uo/client-ui-reasoning-effort

English | [中文](README.zh.md)

DSH Desktop Unofficial client plugin for editing per-model reasoning effort from the Models settings page. It occupies the single `settings.models.model.reasoning` slot declared by the official Models plugin and writes only the existing Harness and pi-ai fields `reasoningEfforts`, `compat.thinkingFormat`, `compat.supportsReasoningEffort`, and `compat.supportsDeveloperRole`.

The plugin provides manual presets for OpenAI GPT, Anthropic Claude, xAI Grok, Kimi, GLM, and DeepSeek, plus a custom mapping mode. It never guesses a preset from the model ID. Gemini has no preset or dedicated adapter.

For `openai-completions` and `openai-responses`, the system-prompt role can keep pi-ai's protocol default or be fixed explicitly to `Developer` or `System`. The setting only overrides pi-ai's role selection and never probes the endpoint.

The Web bundle enables this plugin by default. Disabling or removing its Cordis entry removes the reasoning UI while leaving the official Models editor and its saved-data validation in place.

## Retirement path

If Harness ships an equivalent editor, remove the `dsh-uo-reasoning-effort` row from the Web bundle Cordis patch first. The official Models page continues to work without a slot occupant. The package dependency, TypeScript project reference, and copied override package can then be removed independently. Finally, compare the upstream implementation before dropping the small Models slot and validation patch.

No migration of user settings is required: this plugin stores only fields already understood by Harness and pi-ai, with no DSH-UO marker or preset id.
