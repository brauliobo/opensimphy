#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
source "$ROOT/tools/wasm/versions.env"
JOBS=${JOBS:-4}
CACHE="$ROOT/tools/wasm/.cache/native"

if (( JOBS < 1 || JOBS > 4 )); then
  echo "JOBS must be between 1 and 4" >&2
  exit 2
fi
mkdir -p "$CACHE/build" "$CACHE/out" "$CACHE/downloads" "$CACHE/fixtures"
"$ROOT/tools/wasm/acquire-sources.sh"
rm -rf "$CACHE/src"
mkdir -p "$CACHE/src"
cp -a "$ROOT/tools/wasm/.cache/src/gmsh" "$ROOT/tools/wasm/.cache/src/getdp" "$ROOT/tools/wasm/.cache/src/petsc" "$CACHE/src/"
cp "$ROOT/tools/wasm/.cache/downloads/f2cblaslapack-3.8.0.q2.tar.gz" "$CACHE/downloads/"
cp "$ROOT/tools/wasm/.cache/fixtures/microstrip/"microstrip.{geo,pro} "$CACHE/fixtures/"

docker run --rm \
  --hostname opensimphy-native \
  --user "$(id -u):$(id -g)" -e HOME=/tmp/home -e JOBS="$JOBS" -e SOURCE_DATE_EPOCH=1784116593 \
  -v "$CACHE:/workspace/native" -v "$ROOT/tools/wasm:/workspace/tools:ro" \
  "$EMSDK_IMAGE" bash /workspace/tools/container-native-reference.sh

reference_output="$CACHE/out/microstrip-reference.json"
node "$ROOT/tools/wasm/summarize-pos.mjs" "$CACHE/out" "$reference_output" "$CACHE/out/metadata.env"
if [[ ${UPDATE_REFERENCE:-0} == 1 ]]; then
  cp "$reference_output" "$ROOT/tools/wasm/fixtures/microstrip-reference.json"
else
  cmp "$reference_output" "$ROOT/tools/wasm/fixtures/microstrip-reference.json" || {
    echo "native reference drift; inspect $reference_output or regenerate intentionally with UPDATE_REFERENCE=1" >&2
    exit 1
  }
fi
