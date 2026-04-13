# pipeline-runner

Deterministic **sequential** orchestration for the five-stage video language-transformation pipeline. The runner **orchestrates and validates only**: it does not implement stage logic and does not synthesize missing media artifacts.

## Blackbox stage contract

Each sub-project stage is a **blackbox** invoked only via Node:

```text
node <entrypoint> --input_json=<path> --output_dir=<path>
```

- The runner writes one `input.json` per stage (stable JSON, `{ "inputs": { ... } }` matching each stage’s expected fields).
- The stage writes **`stage_output.json`** in `output_dir` with `status` (`SUCCESS` / `FAILED`) and `artifacts` (logical names → paths **relative to** `output_dir`).
- The runner reads **only** `stage_output.json` for routing; it does not import sub-project source code.

## Execution model

- **invokeStage** uses `child_process.spawnSync` only (`spawn-sync-explicit`): no shell, explicit `command` + `args`, stdin ignored.
- Stages run in fixed order: **ingest → transcript → subtitle → dub_audio → final**; execution is **fail-fast**.
- Logical artifact names (e.g. `timeline_json`, `full_audio_wav`, `final_video_mp4`) are resolved to absolute paths between stages; required artifacts and on-disk files are validated before continuing.

## CLI

```bash
node src/cli.js --video <path> --target-language <lang> --output-dir <runtime-dir>
```

Short flags: `-v`, `-t`, `-o`. The runner checks the video is readable, then runs the **wired** pipeline with `video_path` and `target_language` as pipeline inputs.

Example:

```bash
node src/cli.js --video ./samples/input.mp4 --target-language es --output-dir ./runtime
```

## Outputs (runtime directory)

On success:

- **`runtime/pipeline_report.json`** — Deterministic JSON (sorted keys): `overall_status`, `stages[]` (each with `stage_id`, `status`, `artifacts`, `timing_ms`), `final_video_path`.
- **`runtime/final_video.mp4`** — Copy of the final stage’s `final_video_mp4` artifact. After projection, the runner validates that the file exists, is non-empty, and contains a minimal **ISO BMFF** `ftyp` at offset 4; otherwise the pipeline fails at the final stage.

Per-stage inputs and outputs under **`runtime/stages/<stage_id>/`** (`input.json`, `stage_output.json`, and stage-produced files).

## API

```javascript
const {
  runPipeline,
  runWiredPipeline,
  runExplicitStagesPipeline,
  pipelineWiring,
  validateProjectedFinalVideoMp4,
  getDefaultStages,
  buildPipelineContext,
  resolveStagePaths,
  invokeStage,
  getStageRuntimeDir,
  runBlackboxStage,
  EXECUTION_MODEL,
} = require('./src/index.js');
```

- **`runPipeline({ runtimeRoot, videoPath, targetLanguage, projectsRoot? })`** — Wired five-stage run (default when `stages` is not passed).
- **`runPipeline({ runtimeRoot, stages: [...] })`** — Explicit ordered stages for tests (`stage_id`, `entrypoint`, and full `input` JSON body).

## Tests

```bash
npm test
```

Includes unit tests, wiring tests with stub stages, and end-to-end checks (five-stage report shape, **`pipeline_report.json` determinism** across two runs, and failure when the projected `final_video.mp4` is empty or not a valid MP4 container).
