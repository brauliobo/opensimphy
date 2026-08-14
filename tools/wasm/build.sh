#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
source "$ROOT/tools/wasm/versions.env"

PROFILE=${GMSH_PROFILE:-occ}
TARGET=${1:-all}
JOBS=${JOBS:-4}
CACHE=${WASM_CACHE:-"$ROOT/tools/wasm/.cache"}
OUT=${WASM_OUT:-"$ROOT/tools/wasm/out"}

if (( JOBS < 1 || JOBS > 4 )); then
  echo "JOBS must be between 1 and 4" >&2
  exit 2
fi
if [[ "$PROFILE" != baseline && "$PROFILE" != occ ]]; then
  echo "GMSH_PROFILE must be baseline or occ" >&2
  exit 2
fi

mkdir -p "$CACHE/src" "$CACHE/build" "$OUT"
WASM_CACHE="$CACHE" "$ROOT/tools/wasm/acquire-sources.sh"

docker run --rm \
  --hostname opensimphy-build \
  --user "$(id -u):$(id -g)" \
  -e HOME=/tmp/home \
  -e JOBS="$JOBS" \
  -e GMSH_PROFILE="$PROFILE" \
  -e PETSC_ARCH_REAL="$PETSC_ARCH_REAL" \
  -e PETSC_ARCH_COMPLEX="$PETSC_ARCH_COMPLEX" \
  -e SOURCE_DATE_EPOCH=1784116593 \
  -v "$CACHE:/workspace/cache" \
  -v "$OUT:/workspace/out" \
  -v "$ROOT/tools/wasm:/workspace/tools:ro" \
  "$EMSDK_IMAGE" \
  bash "/workspace/tools/container-build.sh" "$TARGET"

if [[ ${STAGE_ASSETS:-1} == 1 ]]; then
  node "$ROOT/tools/wasm/stage-assets.mjs" --verify-lock
fi
