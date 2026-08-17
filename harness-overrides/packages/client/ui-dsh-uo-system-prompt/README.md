# DSH-UO System Prompt Editor

Browser plugin that creates user agent presets from `standard` and edits only the `@deepseek-ai/dsh-persona` `config.text` value. Host patches own YAML validation and atomic persistence.

Changes apply to sessions created after the save. Existing sessions keep the preset generation they started with.

## Model Experience

- Model input: none.
- Model-visible prompt: the saved persona text is mounted by the existing Harness persona plugin in later sessions.
- Token and KV-cache effect: determined by the saved text; the editor itself adds none.

## Known Limitations and Deferred Work

- The Host must include the matching agent-preset persona API and UI-slot patches.
