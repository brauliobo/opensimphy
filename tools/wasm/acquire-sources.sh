#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
source "$ROOT/tools/wasm/versions.env"
CACHE=${WASM_CACHE:-"$ROOT/tools/wasm/.cache"}

mkdir -p "$CACHE/repos" "$CACHE/src" "$CACHE/downloads"

acquire() {
  local name=$1 url=$2 revision=$3 expected_tree=$4
  local repo="$CACHE/repos/$name.git" source="$CACHE/src/$name"
  if [[ ! -d "$repo" ]]; then
    git init --bare "$repo"
  fi
  if git -C "$repo" remote get-url origin >/dev/null 2>&1; then
    git -C "$repo" remote set-url origin "$url"
  else
    git -C "$repo" remote add origin "$url"
  fi
  if ! git -C "$repo" cat-file -e "$revision^{commit}" 2>/dev/null; then
    git -C "$repo" fetch --no-tags --depth=1 origin "$revision"
  fi
  local actual_tree
  actual_tree=$(git -C "$repo" rev-parse "$revision^{tree}")
  [[ "$actual_tree" == "$expected_tree" ]] || {
    echo "$name tree mismatch: expected $expected_tree, got $actual_tree" >&2
    exit 1
  }
  rm -rf "$source"
  mkdir -p "$source"
  git -C "$repo" archive "$revision" | tar -x -C "$source"
  printf '%s %s %s\n' "$name" "$revision" "$actual_tree"
}

acquire gmsh-js "$GMSH_JS_URL" "$GMSH_JS_REVISION" "$GMSH_JS_TREE"
acquire gmsh "$GMSH_URL" "$GMSH_REVISION" "$GMSH_TREE"
acquire getdp "$GETDP_URL" "$GETDP_REVISION" "$GETDP_TREE"
acquire petsc "$PETSC_URL" "$PETSC_REVISION" "$PETSC_TREE"

f2cblaslapack="$CACHE/downloads/f2cblaslapack-3.8.0.q2.tar.gz"
if [[ ! -f "$f2cblaslapack" ]] || [[ $(sha256sum "$f2cblaslapack" | cut -d' ' -f1) != "$F2CBLASLAPACK_SHA256" ]]; then
  rm -f "$f2cblaslapack"
  curl --fail --location --retry 3 --output "$f2cblaslapack" "$F2CBLASLAPACK_URL"
fi
actual_f2c_hash=$(sha256sum "$f2cblaslapack" | cut -d' ' -f1)
[[ "$actual_f2c_hash" == "$F2CBLASLAPACK_SHA256" ]] || {
  echo "f2cblaslapack SHA256 mismatch: expected $F2CBLASLAPACK_SHA256, got $actual_f2c_hash" >&2
  exit 1
}
printf 'f2cblaslapack %s %s\n' "$F2CBLASLAPACK_SHA256" "$f2cblaslapack"
