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
  local config=$1 scalar=$2
  grep -q '^#define PETSC_USE_REAL_DOUBLE 1' "$config"
  if [[ $scalar == complex ]]; then
    grep -q '^#define PETSC_USE_COMPLEX 1' "$config"
  else
    ! grep -q '^#define PETSC_USE_COMPLEX' "$config"
  fi
  ! grep -q '^#define PETSC_USE_64BIT_INDICES' "$config"
  grep -q '^#define PETSC_HAVE_F2CBLASLAPACK 1' "$config"
}

build_occt() {
  [[ ${GMSH_PROFILE:-occ} == occ ]] || return
  local prefix="$BUILD/occt-prefix"
  if [[ -f "$prefix/include/opencascade/Standard_Version.hxx" && -f "$prefix/lib/libTKDESTEP.a" ]]; then return; fi
  rm -rf "$BUILD/occt" "$prefix"
  emcmake cmake -S "$SRC/occt" -B "$BUILD/occt" \
    -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX="$prefix" \
    -DCMAKE_CXX_FLAGS=-fexceptions -DBUILD_LIBRARY_TYPE=Static \
    -DBUILD_MODULE_Draw=OFF -DBUILD_MODULE_Visualization=OFF \
    -DBUILD_MODULE_ApplicationFramework=OFF -DBUILD_MODULE_DataExchange=ON \
    -DBUILD_MODULE_ModelingAlgorithms=ON -DBUILD_MODULE_ModelingData=ON \
    -DBUILD_MODULE_FoundationClasses=ON -DBUILD_DOC_Overview=OFF \
    -DBUILD_USE_PCH=OFF -DUSE_FREETYPE=OFF -DUSE_TK=OFF -DUSE_TCL=OFF \
    -DUSE_OPENGL=OFF -DUSE_GLES2=OFF -DUSE_RAPIDJSON=OFF -DUSE_DRACO=OFF \
    -DUSE_VTK=OFF -DUSE_FREEIMAGE=OFF -DUSE_OPENVR=OFF -DINSTALL_TEST_CASES=OFF
  nice cmake --build "$BUILD/occt" --parallel "$JOBS"
  # Emscripten does not emit the developer-only ExpToCasExe companion expected
  # by OCCT's install rule; verify every linked toolkit below instead.
  nice cmake --install "$BUILD/occt" || true
  for toolkit in TKDESTEP TKDEIGES TKXSBase TKOffset TKFeat TKFillet TKBool TKMesh TKHLR TKBO TKPrim TKShHealing TKTopAlgo TKGeomAlgo TKBRep TKGeomBase TKG3d TKG2d TKMath TKernel; do
    [[ -f "$prefix/lib/lib$toolkit.a" ]] || { echo "missing OCCT toolkit $toolkit" >&2; exit 3; }
  done
}

build_gmsh() {
  local occ=OFF
  local occ_args=()
  local occ_link_libs=()
  [[ ${GMSH_PROFILE:-occ} == occ ]] && occ=ON
  build_occt
  if [[ $occ == ON ]]; then
    local prefix="$BUILD/occt-prefix" libraries=""
    for toolkit in TKDESTEP TKDEIGES TKXSBase TKOffset TKFeat TKFillet TKBool TKMesh TKHLR TKBO TKPrim TKShHealing TKTopAlgo TKGeomAlgo TKBRep TKGeomBase TKG3d TKG2d TKMath TKernel; do
      libraries+="${libraries:+;}$prefix/lib/lib$toolkit.a"
      occ_link_libs+=("$prefix/lib/lib$toolkit.a")
    done
    occ_args=(-DOCC_INC="$prefix/include/opencascade" -DOCC_LIBS="$libraries")
  fi

  rm -rf "$BUILD/gmsh" "$BUILD/gmsh-js"
  cp -a "$SRC/gmsh-js" "$BUILD/gmsh-js"
  rm -rf "$BUILD/gmsh-js/gmsh"
  cp -a "$SRC/gmsh" "$BUILD/gmsh-js/gmsh"
  patch -d "$BUILD/gmsh-js" -p1 < "$TOOLS/gmsh/view-bindings.patch"
  patch -d "$BUILD/gmsh-js/gmsh" -p1 < "$TOOLS/gmsh/optional-quad-predicate.patch"
  patch -d "$BUILD/gmsh-js/gmsh" -p1 < "$TOOLS/gmsh/persistent-parser-number.patch"
  python3 "$BUILD/gmsh-js/scripts/gen_js.py"

  emcmake cmake -S "$BUILD/gmsh-js/gmsh" -B "$BUILD/gmsh" \
    -DCMAKE_PREFIX_PATH="$BUILD/occt-prefix" \
    -DCMAKE_BUILD_TYPE=Release -DCMAKE_CXX_FLAGS=-fexceptions \
    -DDEFAULT=OFF -DENABLE_BUILD_LIB=ON -DENABLE_MESH=ON \
    -DENABLE_PARSER=ON -DENABLE_POST=ON -DENABLE_ONELAB=ON \
    -DENABLE_EIGEN=ON -DENABLE_OCC="$occ" -DENABLE_OCC_CAF=OFF -DENABLE_OCC_STATIC=ON \
    "${occ_args[@]}"
  if [[ $occ == ON ]]; then grep -q '^#define HAVE_OCC' "$BUILD/gmsh/src/common/GmshConfig.h"; fi
  nice cmake --build "$BUILD/gmsh" --target lib --parallel "$JOBS"
  local libgmsh
  libgmsh=$(find "$BUILD/gmsh" -name libgmsh.a -print -quit)
  emcc -Wl,--start-group "$libgmsh" "${occ_link_libs[@]}" -Wl,--end-group -O3 -fexceptions \
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

build_getdp_profile() {
  local scalar=$1 arch=$2 output=$3 work="$BUILD/getdp-$1"
  rm -rf "$work"
  mkdir -p "$work"
  pushd "$SRC/petsc" >/dev/null
  if [[ ! -f "$arch/lib/libpetsc.a" ]]; then
    ./configure PETSC_ARCH="$arch" \
      --with-cc=emcc --with-cxx=em++ --with-fc=0 \
      --with-ranlib=emranlib --with-ar=emar --with-shared-libraries=0 \
      --download-f2cblaslapack="file://$F2CBLASLAPACK" \
      --with-scalar-type="$scalar" --with-precision=double --with-64-bit-indices=0 \
      --with-mpi=0 --with-batch COPTFLAGS=-O2 CXXOPTFLAGS=-O2
    nice make PETSC_DIR="$SRC/petsc" PETSC_ARCH="$arch" -j"$JOBS" all
  fi
  verify_petsc_config "$SRC/petsc/$arch/include/petscconf.h" "$scalar"
  popd >/dev/null

  cp "$TOOLS/getdp/bridge.cpp" "$work/bridge.cpp"
  cp "$TOOLS/getdp/CMakeLists.append.txt" "$work/CMakeLists.append.txt"
  cp -a "$SRC/getdp" "$work/src"
  cat "$work/CMakeLists.append.txt" >> "$work/src/CMakeLists.txt"
  PETSC_DIR="$SRC/petsc" PETSC_ARCH="$arch" emcmake cmake \
    -S "$work/src" -B "$work/cmake" \
    -DCMAKE_BUILD_TYPE=Release -DCMAKE_CXX_FLAGS=-fexceptions \
    -DSIZEOF_VOID_P=4 -DSOCKLEN_T_SIZE=4 -DINTPTR_T_SIZE=4 \
    -DDEFAULT=OFF -DENABLE_KERNEL=ON -DENABLE_PETSC=ON -DENABLE_SPARSKIT=OFF \
    -DENABLE_BUILD_LIB=ON -DOPENSIMPHY_BRIDGE="$work/bridge.cpp" \
    -DPETSC_DIR="$SRC/petsc" -DPETSC_ARCH="$arch" \
    -DPETSC_LIBS="$SRC/petsc/$arch/lib/libpetsc.a"
  local config="$work/cmake/src/common/GetDPConfig.h"
  grep -q '^#define HAVE_PETSC' "$config"
  grep -q '^#define HAVE_BLAS' "$config"
  grep -q '^#define HAVE_LAPACK' "$config"
  ! grep -q '^#define HAVE_SPARSKIT' "$config"
  nice cmake --build "$work/cmake" --target getdp_wasm --parallel "$JOBS"
  /emsdk/upstream/bin/wasm-opt "$work/cmake/getdp.wasm" --all-features --strip-debug --strip-producers -o "$work/cmake/getdp.wasm"
  rm -rf "$OUT/$output"
  mkdir -p "$OUT/$output"
  cp "$work/cmake/getdp.mjs" "$work/cmake/getdp.wasm" "$OUT/$output/"
}

build_getdp() {
  build_getdp_profile real "$PETSC_ARCH_REAL" getdp
  build_getdp_profile complex "$PETSC_ARCH_COMPLEX" getdp-complex
}

case "$TARGET" in
  gmsh) build_gmsh ;;
  getdp) build_getdp ;;
  all) build_gmsh; build_getdp ;;
  *) echo "usage: $0 {gmsh|getdp|all}" >&2; exit 2 ;;
esac
