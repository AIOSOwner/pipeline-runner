# pipeline-runner

Deterministic **sequential** orchestration for the video language-transformation pipeline. The runner **orchestrates and validates only**; it does not modify upstream artifacts beyond what subprocess stages explicitly write under the workspace.

## Execution model (single, documented)

All subprocess-based stages must use **`invokeStage`** from this package (`spawn-sync-explicit`):

- `child_process.spawnSync` only (no shell)
- Explicit `command` and `args`
- Explicit `cwd` and merged `env` when needed
- Stdin defaults to **`ignore`** so stages cannot implicitly block on stdin

`runPipeline({ videoPath, outputDir, stages })` creates `outputDir` (recursive) first, then builds a **`PipelineContext`** with:

- `videoPath`, `outputDir` (absolute)
- **`paths`**: `resolveStagePaths(outputDir)` — deterministic **stage** and **artifact** paths under the workspace root only (`stages/ingest`, `stages/transcript`, … and expected filenames). Stages must read/write using these paths or explicit env vars passed from `ctx`; no implicit discovery.

Stages are an **explicit ordered array** (`{ id, run(ctx) }`). Execution is **fail-fast**. There is **no** parallel invocation model.

### Default stages

`getDefaultStages()` returns two stages that **only** use `invokeStage`:

1. **`ingest_bootstrap`** — runs `stage-scripts/bootstrap-ingest.js` with `PIPELINE_VIDEO_PATH` and `PIPELINE_OUTPUT_DIR`; creates `stages/ingest/audio/` and writes `stages/ingest/input_video_ref.json`.
2. **`ingest_verify_ref`** — runs `stage-scripts/verify-ingest-ref.js` with `PIPELINE_VIDEO_PATH` and `PIPELINE_INPUT_VIDEO_REF` pointing at `ctx.paths.artifacts.inputVideoRef`.

## CLI

```bash
node src/cli.js --video <path> --output-dir <path>
```

Short flags: `-v`, `-o`. Creates `output_dir`, checks the video is readable, then runs `runPipeline` with `getDefaultStages()`.

## API

```javascript
const {
  runPipeline,
  invokeStage,
  getDefaultStages,
  buildPipelineContext,
  resolveStagePaths,
  EXECUTION_MODEL,
} = require('./src/index.js');
```

## Tests

```bash
npm test
```
