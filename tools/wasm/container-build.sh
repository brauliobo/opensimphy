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

  rm -rf "$BUILD/gmsh" "$BUILD/gmsh-js" "$BUILD/gmsh-prefix"
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
    -DDEFAULT=OFF -DENABLE_BUILD_LIB=ON -DENABLE_PRIVATE_API=ON -DENABLE_MESH=ON \
    -DENABLE_PARSER=ON -DENABLE_POST=ON -DENABLE_ONELAB=ON \
    -DENABLE_EIGEN=ON -DENABLE_OCC="$occ" -DENABLE_OCC_CAF=OFF -DENABLE_OCC_STATIC=ON \
    "${occ_args[@]}"
  if [[ $occ == ON ]]; then grep -q '^#define HAVE_OCC' "$BUILD/gmsh/src/common/GmshConfig.h"; fi
  nice cmake --build "$BUILD/gmsh" --target lib --parallel "$JOBS"
  nice cmake --install "$BUILD/gmsh" --prefix "$BUILD/gmsh-prefix"
  local libgmsh
  libgmsh=$(find "$BUILD/gmsh" -name libgmsh.a -print -quit)
  emcc -Wl,--start-group "$libgmsh" "${occ_link_libs[@]}" -Wl,--end-group -O3 -fexceptions \
    -Wl,-Map="$BUILD/gmsh-js/dist/gmsh-core.link.map" -g3 \
    -sMODULARIZE=1 -sEXPORT_NAME=createGmshModule -sEXPORT_ES6=1 \
    -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=64MB -sMAXIMUM_MEMORY=2GB \
    -sSTACK_SIZE=4MB -sFORCE_FILESYSTEM=1 \
    -sENVIRONMENT=web,worker \
    -sEXPORTED_RUNTIME_METHODS=FS,ccall,cwrap,getValue,setValue,UTF8ToString,stringToUTF8,lengthBytesUTF8,wasmMemory,addFunction,removeFunction \
    -sEXPORTED_FUNCTIONS=@"$BUILD/gmsh-js/generated/exported_functions.json" \
    -o "$BUILD/gmsh-js/dist/gmsh-core.mjs"
  node "$BUILD/gmsh-js/scripts/assemble.mjs"
  /emsdk/upstream/bin/llvm-nm -C "$BUILD/gmsh-js/dist/gmsh-core.wasm" > "$BUILD/gmsh-js/dist/gmsh-core.pre-strip.symbols.txt"
  /emsdk/upstream/bin/wasm-opt "$BUILD/gmsh-js/dist/gmsh-core.wasm" --all-features --strip-debug --strip-producers -o "$BUILD/gmsh-js/dist/gmsh-core.wasm"
  rm -rf "$OUT/gmsh"
  mkdir -p "$OUT/gmsh"
  cp "$BUILD/gmsh-js/dist/"{gmsh.mjs,gmsh-core.mjs,gmsh-core.wasm,gmsh-core.link.map,gmsh-core.pre-strip.symbols.txt,runtime.mjs,gmsh-descriptor.mjs,gmsh.d.ts} "$OUT/gmsh/"
}

ensure_petsc_profile() {
  local scalar=$1 arch=$2
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
}

build_combined_profile() {
  local scalar=$1 arch=$2 output=$3 work="$BUILD/combined-$1"
  local gmsh_lib="$BUILD/gmsh-prefix/lib/libgmsh.a"
  local gmsh_include="$BUILD/gmsh-prefix/include"
  local gmsh_dependencies=""
  for toolkit in TKDESTEP TKDEIGES TKXSBase TKOffset TKFeat TKFillet TKBool TKMesh TKHLR TKBO TKPrim TKShHealing TKTopAlgo TKGeomAlgo TKBRep TKGeomBase TKG3d TKG2d TKMath TKernel; do
    gmsh_dependencies+="${gmsh_dependencies:+;}$BUILD/occt-prefix/lib/lib$toolkit.a"
  done
  [[ -f "$gmsh_lib" && -f "$gmsh_include/gmsh/GmshConfig.h" && -f "$gmsh_include/gmsh/GmshGlobal.h" ]] || {
    echo "combined profile requires the canonical Gmsh private SDK" >&2
    exit 3
  }
  ensure_petsc_profile "$scalar" "$arch"
  rm -rf "$work"
  mkdir -p "$work"
  cp "$TOOLS/getdp/combined-bridge.cpp" "$work/combined-bridge.cpp"
  cp "$TOOLS/getdp/CMakeLists.combined.txt" "$work/CMakeLists.combined.txt"
  cp -a "$SRC/getdp" "$work/src"
  cat "$work/CMakeLists.combined.txt" >> "$work/src/CMakeLists.txt"
  node -e 'const fs=require("fs"); const [source,target]=process.argv.slice(1); const names=JSON.parse(fs.readFileSync(source)); for(const name of ["_opensimphy_combined_run","_opensimphy_combined_onelab_set_json","_opensimphy_combined_onelab_get_json","_opensimphy_combined_onelab_clear","_opensimphy_combined_onelab_get_changed","_opensimphy_combined_onelab_set_changed","_opensimphy_combined_loop_initialize","_opensimphy_combined_loop_increment","_opensimphy_combined_server_identity","_opensimphy_combined_last_getdp_server_identity","_opensimphy_combined_getdp_calls","_opensimphy_combined_loop_initialize_calls","_opensimphy_combined_loop_increment_calls","_opensimphy_combined_json_import_calls","_opensimphy_combined_json_export_calls","_opensimphy_combined_abort","_opensimphy_combined_close","_opensimphy_combined_last_error","_opensimphy_combined_heap_bytes","_malloc","_free"]) if(!names.includes(name)) names.push(name); fs.writeFileSync(target, JSON.stringify(names.sort()))' \
    "$BUILD/gmsh-js/generated/exported_functions.json" "$work/combined-exports.json"
  PETSC_DIR="$SRC/petsc" PETSC_ARCH="$arch" emcmake cmake \
    -S "$work/src" -B "$work/cmake" \
    -DCMAKE_BUILD_TYPE=Release -DCMAKE_CXX_FLAGS=-fexceptions \
    -DSIZEOF_VOID_P=4 -DSOCKLEN_T_SIZE=4 -DINTPTR_T_SIZE=4 \
    -DDEFAULT=OFF -DENABLE_KERNEL=ON -DENABLE_PETSC=ON -DENABLE_SPARSKIT=OFF \
    -DENABLE_SLEPC=OFF -DENABLE_GMSH=ON -DENABLE_BUILD_LIB=ON \
    -DGMSH_LIB="$gmsh_lib" -DGMSH_INC="$gmsh_include" \
    -DOPENSIMPHY_COMBINED_BRIDGE="$work/combined-bridge.cpp" \
    -DOPENSIMPHY_GMSH_INCLUDE="$gmsh_include" \
    -DOPENSIMPHY_GMSH_STATIC_DEPENDENCIES="$gmsh_dependencies" \
    -DOPENSIMPHY_GMSH_EXPORTS="$work/combined-exports.json" \
    -DOPENSIMPHY_LINK_MAP="$work/combined.link.map" \
    -DPETSC_DIR="$SRC/petsc" -DPETSC_ARCH="$arch" \
    -DPETSC_LIBS="$SRC/petsc/$arch/lib/libpetsc.a"
  local config="$work/cmake/src/common/GetDPConfig.h"
  grep -q '^#define HAVE_GMSH' "$config"
  grep -q '^#define HAVE_PETSC' "$config"
  ! grep -q '^#define HAVE_SLEPC' "$config"
  ! grep -q '^#define HAVE_SPARSKIT' "$config"
  nice cmake --build "$work/cmake" --target opensimphy_combined --parallel "$JOBS"
  /emsdk/upstream/bin/llvm-nm -C "$work/cmake/combined.wasm" > "$work/combined.pre-strip.symbols.txt"
  /emsdk/upstream/bin/wasm-opt "$work/cmake/combined.wasm" --all-features --strip-debug --strip-producers -o "$work/cmake/combined.wasm"
  # The singleton and utility gates are link-contract checks, not source heuristics.
  local symbols="$work/defined-symbols.txt"
  /emsdk/upstream/bin/llvm-nm -C --defined-only "$gmsh_lib" "$work/cmake/libgetdp.a" > "$symbols"
  [[ $(grep -Ec ' [BDRSTVW] onelab::server::_server$' "$symbols" || true) -eq 1 ]]
  [[ $(grep -Ec ' [TW] onelabUtils::initializeLoops\(\)$' "$symbols" || true) -eq 1 ]]
  [[ $(grep -Ec ' [TW] onelabUtils::incrementLoops\(\)$' "$symbols" || true) -eq 1 ]]
  for symbol in 'Malloc\(' 'Calloc\(' 'Realloc\(' 'Free\(' 'List_Create\(' 'Tree_Create\('; do
    [[ $(grep -Ec " [BDRSTVW] $symbol" "$symbols" || true) -le 1 ]]
  done
  rm -rf "$OUT/$output"
  mkdir -p "$OUT/$output"
  cp "$work/cmake/combined.mjs" "$work/cmake/combined.wasm" "$OUT/$output/"
  cp "$work/combined.link.map" "$work/combined.pre-strip.symbols.txt" "$OUT/$output/"
  cp "$TOOLS/getdp/combined-runtime.mjs" "$BUILD/gmsh-js/dist/runtime.mjs" \
    "$BUILD/gmsh-js/dist/gmsh-descriptor.mjs" "$BUILD/gmsh-js/dist/gmsh.d.ts" "$OUT/$output/"
}

build_combined() {
  build_gmsh
  build_combined_profile real "$PETSC_ARCH_REAL" combined-real
  build_combined_profile complex "$PETSC_ARCH_COMPLEX" combined-complex
}

build_getdp_profile() {
  local scalar=$1 arch=$2 output=$3 work="$BUILD/getdp-$1"
  rm -rf "$work"
  mkdir -p "$work"
  ensure_petsc_profile "$scalar" "$arch"

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
    -DOPENSIMPHY_LINK_MAP="$work/getdp.link.map" \
    -DPETSC_DIR="$SRC/petsc" -DPETSC_ARCH="$arch" \
    -DPETSC_LIBS="$SRC/petsc/$arch/lib/libpetsc.a"
  local config="$work/cmake/src/common/GetDPConfig.h"
  grep -q '^#define HAVE_PETSC' "$config"
  grep -q '^#define HAVE_BLAS' "$config"
  grep -q '^#define HAVE_LAPACK' "$config"
  ! grep -q '^#define HAVE_SPARSKIT' "$config"
  nice cmake --build "$work/cmake" --target getdp_wasm --parallel "$JOBS"
  /emsdk/upstream/bin/llvm-nm -C "$work/cmake/getdp.wasm" > "$work/getdp.pre-strip.symbols.txt"
  /emsdk/upstream/bin/wasm-opt "$work/cmake/getdp.wasm" --all-features --strip-debug --strip-producers -o "$work/cmake/getdp.wasm"
  rm -rf "$OUT/$output"
  mkdir -p "$OUT/$output"
  cp "$work/cmake/getdp.mjs" "$work/cmake/getdp.wasm" "$work/getdp.link.map" "$work/getdp.pre-strip.symbols.txt" "$OUT/$output/"
}

build_getdp() {
  build_getdp_profile real "$PETSC_ARCH_REAL" getdp
  build_getdp_profile complex "$PETSC_ARCH_COMPLEX" getdp-complex
}

case "$TARGET" in
  gmsh) build_gmsh ;;
  getdp) build_getdp ;;
  combined) build_combined ;;
  all) build_gmsh; build_getdp; build_combined_profile real "$PETSC_ARCH_REAL" combined-real; build_combined_profile complex "$PETSC_ARCH_COMPLEX" combined-complex ;;
  *) echo "usage: $0 {gmsh|getdp|combined|all}" >&2; exit 2 ;;
esac
