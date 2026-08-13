#!/usr/bin/env bash
set -euo pipefail

TARGET=${1:-all}
JOBS=${JOBS:-4}
SRC=/workspace/cache/src
BUILD=/workspace/cache/build
OUT=/workspace/out
TOOLS=/workspace/tools
F2CBLASLAPACK=/workspace/cache/downloads/f2cblaslapack-3.8.0.q2.tar.gz

verify_petsc_config() {
  local config=$1
  grep -q '^#define PETSC_USE_REAL_DOUBLE 1' "$config"
  ! grep -q '^#define PETSC_USE_COMPLEX' "$config"
  ! grep -q '^#define PETSC_USE_64BIT_INDICES' "$config"
  grep -q '^#define PETSC_HAVE_F2CBLASLAPACK 1' "$config"
}

build_gmsh() {
  local occ=OFF
  [[ ${GMSH_PROFILE:-baseline} == occ ]] && occ=ON
  if [[ $occ == ON ]]; then
    echo "The OCC profile is retained but requires a wasm OpenCASCADE prefix at /workspace/cache/occt." >&2
    [[ -d /workspace/cache/occt/lib ]] || exit 3
  fi

  rm -rf "$BUILD/gmsh" "$BUILD/gmsh-js"
  cp -a "$SRC/gmsh-js" "$BUILD/gmsh-js"
  rm -rf "$BUILD/gmsh-js/gmsh"
  cp -a "$SRC/gmsh" "$BUILD/gmsh-js/gmsh"
  patch -d "$BUILD/gmsh-js" -p1 < "$TOOLS/gmsh/view-bindings.patch"
  patch -d "$BUILD/gmsh-js/gmsh" -p1 < "$TOOLS/gmsh/optional-quad-predicate.patch"
  python3 "$BUILD/gmsh-js/scripts/gen_js.py"

  emcmake cmake -S "$BUILD/gmsh-js/gmsh" -B "$BUILD/gmsh" \
    -DCMAKE_BUILD_TYPE=Release -DCMAKE_CXX_FLAGS=-fexceptions \
    -DDEFAULT=OFF -DENABLE_BUILD_LIB=ON -DENABLE_MESH=ON \
    -DENABLE_PARSER=ON -DENABLE_POST=ON -DENABLE_ONELAB=ON \
    -DENABLE_EIGEN=ON -DENABLE_OCC="$occ"
  nice cmake --build "$BUILD/gmsh" --target lib --parallel "$JOBS"
  local libgmsh
  libgmsh=$(find "$BUILD/gmsh" -name libgmsh.a -print -quit)
  emcc "$libgmsh" -O3 -fexceptions \
    -sMODULARIZE=1 -sEXPORT_NAME=createGmshModule -sEXPORT_ES6=1 \
    -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=64MB -sMAXIMUM_MEMORY=2GB \
    -sSTACK_SIZE=4MB -sFORCE_FILESYSTEM=1 \
    -sENVIRONMENT=web,worker \
    -sEXPORTED_RUNTIME_METHODS=FS,ccall,cwrap,getValue,setValue,UTF8ToString,stringToUTF8,lengthBytesUTF8,wasmMemory,addFunction,removeFunction \
    -sEXPORTED_FUNCTIONS=@"$BUILD/gmsh-js/generated/exported_functions.json" \
    -o "$BUILD/gmsh-js/dist/gmsh-core.mjs"
  node "$BUILD/gmsh-js/scripts/assemble.mjs"
  /emsdk/upstream/bin/wasm-opt "$BUILD/gmsh-js/dist/gmsh-core.wasm" --all-features --strip-debug --strip-producers -o "$BUILD/gmsh-js/dist/gmsh-core.wasm"
  rm -rf "$OUT/gmsh"
  mkdir -p "$OUT/gmsh"
  cp "$BUILD/gmsh-js/dist/"{gmsh.mjs,gmsh-core.mjs,gmsh-core.wasm,runtime.mjs,gmsh-descriptor.mjs,gmsh.d.ts} "$OUT/gmsh/"
}

build_getdp() {
  rm -rf "$BUILD/getdp"
  mkdir -p "$BUILD/getdp"
  pushd "$SRC/petsc" >/dev/null
  if [[ ! -f "$PETSC_ARCH/lib/libpetsc.a" ]]; then
    ./configure PETSC_ARCH="$PETSC_ARCH" \
      --with-cc=emcc --with-cxx=em++ --with-fc=0 \
      --with-ranlib=emranlib --with-ar=emar --with-shared-libraries=0 \
      --download-f2cblaslapack="file://$F2CBLASLAPACK" \
      --with-scalar-type=real --with-precision=double --with-64-bit-indices=0 \
      --with-mpi=0 --with-batch \
      COPTFLAGS=-O2 CXXOPTFLAGS=-O2
    nice make PETSC_DIR="$SRC/petsc" PETSC_ARCH="$PETSC_ARCH" -j"$JOBS" all
  fi
  verify_petsc_config "$SRC/petsc/$PETSC_ARCH/include/petscconf.h"
  popd >/dev/null

  cp "$TOOLS/getdp/bridge.cpp" "$BUILD/getdp/bridge.cpp"
  cp "$TOOLS/getdp/CMakeLists.append.txt" "$BUILD/getdp/CMakeLists.append.txt"
  cp -a "$SRC/getdp" "$BUILD/getdp/src"
  cat "$BUILD/getdp/CMakeLists.append.txt" >> "$BUILD/getdp/src/CMakeLists.txt"
  PETSC_DIR="$SRC/petsc" PETSC_ARCH="$PETSC_ARCH" emcmake cmake \
    -S "$BUILD/getdp/src" -B "$BUILD/getdp/cmake" \
    -DCMAKE_BUILD_TYPE=Release -DCMAKE_CXX_FLAGS=-fexceptions \
    -DSIZEOF_VOID_P=4 -DSOCKLEN_T_SIZE=4 -DINTPTR_T_SIZE=4 \
    -DDEFAULT=OFF -DENABLE_KERNEL=ON -DENABLE_PETSC=ON -DENABLE_SPARSKIT=OFF \
    -DENABLE_BUILD_LIB=ON -DOPENSIMPHY_BRIDGE="$BUILD/getdp/bridge.cpp" \
    -DPETSC_DIR="$SRC/petsc" -DPETSC_ARCH="$PETSC_ARCH" \
    -DPETSC_LIBS="$SRC/petsc/$PETSC_ARCH/lib/libpetsc.a"
  local config="$BUILD/getdp/cmake/src/common/GetDPConfig.h"
  grep -q '^#define HAVE_PETSC' "$config"
  grep -q '^#define HAVE_BLAS' "$config"
  grep -q '^#define HAVE_LAPACK' "$config"
  ! grep -q '^#define HAVE_SPARSKIT' "$config"
  nice cmake --build "$BUILD/getdp/cmake" --target getdp_wasm --parallel "$JOBS"
  /emsdk/upstream/bin/wasm-opt "$BUILD/getdp/cmake/getdp.wasm" --all-features --strip-debug --strip-producers -o "$BUILD/getdp/cmake/getdp.wasm"
  rm -rf "$OUT/getdp"
  mkdir -p "$OUT/getdp"
  cp "$BUILD/getdp/cmake/getdp.mjs" "$BUILD/getdp/cmake/getdp.wasm" "$OUT/getdp/"
}

case "$TARGET" in
  gmsh) build_gmsh ;;
  getdp) build_getdp ;;
  all) build_gmsh; build_getdp ;;
  *) echo "usage: $0 {gmsh|getdp|all}" >&2; exit 2 ;;
esac
