# @dsh-uo/client-ui-model-input

English | [中文](README.zh.md)

DSH Desktop Unofficial client plugin for editing a model's request modalities from the Models settings page. It occupies the single `settings.models.model.input` slot and writes only the existing `input` model field.

The three curated modes are automatic, text only (`[text]`), and text with images (`[text, image]`). Automatic mode follows the reasoning mapping preset already selected for the same model: OpenAI GPT, Anthropic Claude, xAI Grok, and Kimi use text with images; GLM and DeepSeek use text only. Changing the preset updates input while the model remains in automatic mode. An explicit input selection stops that synchronization.

For a custom reasoning map or a model without a selected preset, automatic mode removes `input` and retains Harness's built-in catalog, provider `defaultInput`, and final text-only fallback. The plugin never guesses from a provider or model id and never probes an endpoint for capabilities. Unknown future modality lists are preserved until the user explicitly selects another mode.

The Web bundle enables this plugin by default. Disabling or removing its Cordis entry removes the editor while Harness continues to honor previously saved `input` declarations.

## Retirement path

If Harness ships an equivalent editor, remove the `dsh-uo-model-input` row from the Web bundle Cordis patch first. The official Models page continues to work without a slot occupant. The package dependency, TypeScript project reference, and copied override package can then be removed independently. Finally, compare the upstream implementation before dropping the small Models slot patch.

No user-data migration is required because the plugin stores only Harness's existing `input` field.
