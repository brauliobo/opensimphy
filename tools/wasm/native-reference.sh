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
cp -a "$ROOT/tools/wasm/.cache/src/gmsh" "$ROOT/tools/wasm/.cache/src/occt" "$ROOT/tools/wasm/.cache/src/getdp" "$ROOT/tools/wasm/.cache/src/petsc" "$CACHE/src/"
cp "$ROOT/tools/wasm/.cache/downloads/f2cblaslapack-3.8.0.q2.tar.gz" "$CACHE/downloads/"
cp "$ROOT/tools/wasm/.cache/fixtures/microstrip/"microstrip.{geo,pro} "$CACHE/fixtures/"
for fixture in radiator electromagnet full-wave; do cp -a "$ROOT/tools/wasm/.cache/fixtures/$fixture" "$CACHE/fixtures/"; done

docker run --rm \
  --hostname opensimphy-native \
  --user "$(id -u):$(id -g)" -e HOME=/tmp/home -e JOBS="$JOBS" -e SOURCE_DATE_EPOCH=1784116593 \
  -v "$CACHE:/workspace/native" -v "$ROOT/tools/wasm:/workspace/tools:ro" \
  "$EMSDK_IMAGE" bash /workspace/tools/container-native-reference.sh

mesh_target="$ROOT/tools/wasm/fixtures/native-meshes"
if [[ ${UPDATE_REFERENCE:-0} == 1 ]]; then mkdir -p "$mesh_target"; fi
for fixture in radiator-3d-transient electromagnet-2d-nonlinear full-wave-2d-edge-complex; do
  case "$fixture" in
    radiator-3d-transient) target=radiator ;;
    electromagnet-2d-nonlinear) target=electromagnet ;;
    full-wave-2d-edge-complex) target=full-wave ;;
  esac
  source_mesh="$CACHE/out/$fixture/$fixture.msh"
  if [[ ${UPDATE_REFERENCE:-0} == 1 ]]; then cp "$source_mesh" "$mesh_target/$target.msh"
  else cmp "$source_mesh" "$mesh_target/$target.msh" || { echo "native reference mesh drift: $fixture" >&2; exit 1; }
  fi
done

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

phase4_output="$CACHE/out/phase4-reference.json"
node "$ROOT/tools/wasm/summarize-phase4.mjs" "$CACHE/out" "$phase4_output" "$CACHE/out/metadata.env"
if [[ ${UPDATE_REFERENCE:-0} == 1 ]]; then
  cp "$phase4_output" "$ROOT/tools/wasm/fixtures/phase4-reference.json"
else
  cmp "$phase4_output" "$ROOT/tools/wasm/fixtures/phase4-reference.json" || {
    echo "Phase 4 native reference drift; inspect $phase4_output or regenerate intentionally with UPDATE_REFERENCE=1" >&2
    exit 1
  }
fi
