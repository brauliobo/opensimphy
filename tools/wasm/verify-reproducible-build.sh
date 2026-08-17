#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
JOBS=${JOBS:-4}
WORK=${WASM_REPRO_WORK:-/tmp/opensimphy-wasm-reproducibility}
REPORT=${WASM_REPRO_REPORT:-"$ROOT/tools/wasm/reproducibility-report.json"}

if (( JOBS < 1 || JOBS > 4 )); then
  echo "JOBS must be between 1 and 4" >&2
  exit 2
fi
rm -rf "$WORK"
mkdir -p "$WORK/build-1" "$WORK/build-2"
for run in 1 2; do
  WASM_CACHE="$WORK/build-$run/cache" WASM_OUT="$WORK/build-$run/out" STAGE_ASSETS=0 GMSH_PROFILE=occ \
    JOBS="$JOBS" nice "$ROOT/tools/wasm/build.sh" all
done
GMSH_PROFILE=occ node "$ROOT/tools/wasm/compare-builds.mjs" "$WORK/build-1/out" "$WORK/build-2/out" "$REPORT"
rm -rf "$ROOT/tools/wasm/out"
cp -a "$WORK/build-1/out" "$ROOT/tools/wasm/out"
echo "canonical output installed from verified build 1"
