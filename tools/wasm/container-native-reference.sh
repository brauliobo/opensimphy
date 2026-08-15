#!/usr/bin/env bash
set -euo pipefail

SRC=/workspace/native/src
BUILD=/workspace/native/build
OUT=/workspace/native/out
RUN=/workspace/native/run
JOBS=${JOBS:-4}
F2CBLASLAPACK=/workspace/native/downloads/f2cblaslapack-3.8.0.q2.tar.gz

rm -rf "$OUT" "$RUN"
mkdir -p "$BUILD/occt" "$BUILD/gmsh" "$OUT" "$RUN"

cmake -S "$SRC/occt" -B "$BUILD/occt" \
  -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX="$BUILD/occt-prefix" \
  -DBUILD_LIBRARY_TYPE=Static -DBUILD_MODULE_Draw=OFF -DBUILD_MODULE_Visualization=OFF \
  -DBUILD_MODULE_ApplicationFramework=OFF -DBUILD_MODULE_DataExchange=ON \
  -DBUILD_MODULE_ModelingAlgorithms=ON -DBUILD_MODULE_ModelingData=ON \
  -DBUILD_MODULE_FoundationClasses=ON -DBUILD_DOC_Overview=OFF -DBUILD_USE_PCH=OFF \
  -DUSE_FREETYPE=OFF -DUSE_TK=OFF -DUSE_TCL=OFF -DUSE_OPENGL=OFF -DUSE_GLES2=OFF \
  -DUSE_RAPIDJSON=OFF -DUSE_DRACO=OFF -DUSE_VTK=OFF -DUSE_FREEIMAGE=OFF -DUSE_OPENVR=OFF -DUSE_XLIB=OFF
occt_toolkits=(TKDESTEP TKDEIGES TKXSBase TKOffset TKFeat TKFillet TKBool TKMesh TKHLR TKBO TKPrim TKShHealing TKTopAlgo TKGeomAlgo TKBRep TKGeomBase TKG3d TKG2d TKMath TKernel)
nice cmake --build "$BUILD/occt" --target "${occt_toolkits[@]}" --parallel "$JOBS"
occt_libraries=""
for toolkit in "${occt_toolkits[@]}"; do occt_libraries+="${occt_libraries:+;}$BUILD/occt/lin64/gcc/lib/lib$toolkit.a"; done

patch -d "$SRC/gmsh" -p1 < /workspace/tools/gmsh/optional-quad-predicate.patch
cmake -S "$SRC/gmsh" -B "$BUILD/gmsh" \
  -DCMAKE_BUILD_TYPE=Release -DOCC_INC="$BUILD/occt/include/opencascade" -DOCC_LIBS="$occt_libraries" \
  -DDEFAULT=OFF -DENABLE_MESH=ON -DENABLE_BUILD_LIB=ON -DENABLE_PRIVATE_API=ON -DENABLE_PARSER=ON \
  -DENABLE_POST=ON -DENABLE_ONELAB=ON -DENABLE_EIGEN=ON -DENABLE_OCC=ON \
  -DENABLE_OCC_CAF=OFF -DENABLE_OCC_STATIC=ON
grep -q '^#define HAVE_OCC' "$BUILD/gmsh/src/common/GmshConfig.h"
nice cmake --build "$BUILD/gmsh" --target gmsh lib --parallel "$JOBS"
cmake --install "$BUILD/gmsh" --prefix "$BUILD/gmsh-prefix"
g++ -std=c++17 -O2 -I"$SRC/gmsh/api" /workspace/tools/native-probe.cpp "$BUILD/gmsh/libgmsh.a" \
  -L"$BUILD/occt/lin64/gcc/lib" -Wl,--start-group -lTKDESTEP -lTKDEIGES -lTKXSBase -lTKOffset -lTKFeat -lTKFillet -lTKBool -lTKMesh -lTKHLR -lTKBO -lTKPrim -lTKShHealing -lTKTopAlgo -lTKGeomAlgo -lTKBRep -lTKGeomBase -lTKG3d -lTKG2d -lTKMath -lTKernel -Wl,--end-group \
  -o "$BUILD/gmsh/native-probe" -ldl -lpthread

build_getdp() {
  local scalar=$1 arch="arch-opensimphy-native-$1" work="$BUILD/getdp-$1"
  pushd "$SRC/petsc" >/dev/null
  ./configure PETSC_ARCH="$arch" --with-debugging=0 \
    --with-cc=gcc --with-cxx=g++ --with-fc=0 --with-shared-libraries=0 \
    --download-f2cblaslapack="file://$F2CBLASLAPACK" --with-scalar-type="$scalar" \
    --with-precision=double --with-64-bit-indices=0 --with-mpi=0 COPTFLAGS=-O2 CXXOPTFLAGS=-O2
  nice make PETSC_DIR="$SRC/petsc" PETSC_ARCH="$arch" -j"$JOBS" all
  popd >/dev/null
  cmake -S "$SRC/getdp" -B "$work" -DCMAKE_BUILD_TYPE=Release -DDEFAULT=OFF \
    -DENABLE_KERNEL=ON -DENABLE_PETSC=ON -DENABLE_SPARSKIT=OFF -DENABLE_GMSH=OFF -DENABLE_BUILD_LIB=OFF \
    -DPETSC_DIR="$SRC/petsc" -DPETSC_ARCH="$arch" -DPETSC_LIBS="$SRC/petsc/$arch/lib/libpetsc.a"
  grep -q '^#define HAVE_PETSC' "$work/src/common/GetDPConfig.h"
  nice cmake --build "$work" --target getdp --parallel "$JOBS"
}
build_phase5_trace() {
  local scalar=$1 arch="arch-opensimphy-native-$1" work="$BUILD/phase5-trace-$1"
  cmake -S "$SRC/getdp" -B "$work" -DCMAKE_BUILD_TYPE=Release -DDEFAULT=OFF \
    -DENABLE_KERNEL=ON -DENABLE_PETSC=ON -DENABLE_SPARSKIT=OFF -DENABLE_GMSH=ON \
    -DENABLE_BUILD_LIB=ON -DOPENSIMPHY_NATIVE_TRACE=/workspace/tools/phase5-native-trace.cpp \
    -DGMSH_LIB="$BUILD/gmsh-prefix/lib/libgmsh.a" -DGMSH_INC="$BUILD/gmsh-prefix/include" \
    -DOPENSIMPHY_GMSH_SOURCE="$SRC/gmsh" -DOPENSIMPHY_GMSH_LIBRARY="$BUILD/gmsh-prefix/lib/libgmsh.a" \
    -DOPENSIMPHY_GMSH_STATIC_DEPENDENCIES="$occt_libraries" \
    -DPETSC_DIR="$SRC/petsc" -DPETSC_ARCH="$arch" -DPETSC_LIBS="$SRC/petsc/$arch/lib/libpetsc.a"
  grep -q '^#define HAVE_GMSH' "$work/src/common/GetDPConfig.h"
  grep -q '^#define HAVE_PETSC' "$work/src/common/GetDPConfig.h"
  nice cmake --build "$work" --target phase5_native_trace --parallel "$JOBS"
}
cat /workspace/tools/getdp/CMakeLists.native-trace.txt >> "$SRC/getdp/CMakeLists.txt"
build_getdp real
build_getdp complex
build_phase5_trace real
build_phase5_trace complex

run_project() {
  local id=$1 directory=$2 geometry=$3 problem=$4 dimension=$5 scalar=$6 resolution=$7
  shift 7
  local work="$RUN/$id" output="$OUT/$id" args=()
  mkdir -p "$work" "$output"
  cp -a "/workspace/native/fixtures/$directory/." "$work/"
  while (( $# )); do args+=("-setnumber" "$1" "$2"); shift 2; done
  pushd "$work" >/dev/null
  "$BUILD/gmsh/gmsh" "$geometry" "${args[@]}" -format msh2 "-$dimension" -o "$id.msh"
  "$BUILD/getdp-$scalar/getdp" "$problem" -msh "$id.msh" "${args[@]}" -solve "$resolution" -pos Map 2>&1 | tee "$output/getdp.log"
  cp "$id.msh" "$output/"
  cp ./*.pos "$output/"
  popd >/dev/null
}

run_project radiator-3d-transient radiator radiator.geo radiator.pro 3 real The dim 3 s 4 zh 0.01 AnalysisType 1 tmax 10 dt 5
run_project electromagnet-2d-nonlinear electromagnet electromagnet.geo electromagnet.pro 2 real Mag SymmetryType 3 s 4 NonlinearCore 1 NewtonRaphson 1 Current 100
run_project full-wave-2d-edge-complex full-wave full_wave.geo full_wave.pro 2 complex Wav dim 2 L 4 airRadius 5 res 1.5

run_phase5_trace() {
  local id=$1 directory=$2 geometry=$3 problem=$4 scalar=$5 resolution=$6 parameter=$7 value=$8
  shift 8
  local work="$RUN/phase5/$id" args=()
  mkdir -p "$work" "$OUT/phase5"
  cp -a "/workspace/native/fixtures/$directory/." "$work/"
  while (( $# )); do args+=("-setnumber" "$1" "$2"); shift 2; done
  pushd "$work" >/dev/null
  "$BUILD/gmsh/gmsh" "$geometry" "${args[@]}" -setnumber "$parameter" "$value" -format msh2 -2 -o model.msh
  "$BUILD/phase5-trace-$scalar/phase5_native_trace" "$id" "$geometry" "$problem" model.msh "$resolution" "$parameter" "$value"
  cp "$id-native-trace.json" "$OUT/phase5/"
  popd >/dev/null
}

run_phase5_trace global-quantity-real-loop global-quantity microstrip.geo microstrip.pro real Ele s 1
run_phase5_trace transfo-complex-loop transfo transfo.geo transfo.pro complex Mag s 2

for specification in \
  'radiator-3d-transient:0.004:0.005:0.005' 'radiator-3d-transient:0.004:0.03:0.005' \
  'electromagnet-2d-nonlinear:0.025:0.05:0' 'electromagnet-2d-nonlinear:0.125:0.05:0' \
  'full-wave-2d-edge-complex:0:-0.02:0' 'full-wave-2d-edge-complex:0.03:0.01:0'; do
  IFS=: read -r id x y z <<< "$specification"
  for pos in "$OUT/$id"/*.pos; do
    if values=$("$BUILD/gmsh/native-probe" "$pos" "$x" "$y" "$z" 2>/dev/null); then
      printf '%s %s %s %s %s\n' "$(basename "$pos")" "$x" "$y" "$z" "$values" >> "$OUT/$id/probes.txt"
    fi
  done
done

compiler=$(gcc --version | head -1)
compiler_sha256=$(sha256sum "$(command -v gcc)" | cut -d' ' -f1)
cat > "$OUT/metadata.env" <<EOF
compiler=$compiler
compiler_sha256=$compiler_sha256
gmsh_sha256=$(sha256sum "$BUILD/gmsh/gmsh" | cut -d' ' -f1)
petsc_real_config_sha256=$(sha256sum "$SRC/petsc/arch-opensimphy-native-real/include/petscconf.h" | cut -d' ' -f1)
petsc_complex_config_sha256=$(sha256sum "$SRC/petsc/arch-opensimphy-native-complex/include/petscconf.h" | cut -d' ' -f1)
getdp_real_config_sha256=$(sha256sum "$BUILD/getdp-real/src/common/GetDPConfig.h" | cut -d' ' -f1)
getdp_complex_config_sha256=$(sha256sum "$BUILD/getdp-complex/src/common/GetDPConfig.h" | cut -d' ' -f1)
petsc_config_sha256=$(sha256sum "$SRC/petsc/arch-opensimphy-native-real/include/petscconf.h" | cut -d' ' -f1)
getdp_config_sha256=$(sha256sum "$BUILD/getdp-real/src/common/GetDPConfig.h" | cut -d' ' -f1)
EOF

# Preserve the Phase 0-3 native microstrip gate with the same OCC-capable tools.
cp /workspace/native/fixtures/microstrip.{geo,pro} "$OUT/"
pushd "$OUT" >/dev/null
for mesh_size in 1 2; do
  suffix=${mesh_size//./_}
  "$BUILD/gmsh/gmsh" microstrip.geo -setnumber "Parameters/Mesh/Global mesh size factor" "$mesh_size" -format msh2 -2 -o "microstrip-$suffix.msh"
  "$BUILD/getdp-real/getdp" microstrip.pro -msh "microstrip-$suffix.msh" -solve Ele -pos Map 2>&1 | tee "getdp-$suffix.log"
  mv v.pos "v-$suffix.pos"; mv e.pos "e-$suffix.pos"
  rm -f d.pos e_cut.pos microstrip.res
  for field in v e; do
    for probe in "ground:0.0004:0.0002:0" "substrate:0.0013:0.0007:0" "air:0.0032:0.00055:0"; do
      IFS=: read -r key x y z <<< "$probe"
      "$BUILD/gmsh/native-probe" "$field-$suffix.pos" "$x" "$y" "$z" >> "probe-$suffix-$field.txt"
    done
  done
  nodes=$(awk '/\$Nodes/{getline; print; exit}' "microstrip-$suffix.msh")
  elements=$(awk '/\$Elements/{getline; print; exit}' "microstrip-$suffix.msh")
  mesh_sha256=$(node /workspace/tools/canonical-msh-hash.mjs "$OUT/microstrip-$suffix.msh")
  initial_residual_line=$(grep 'Residual' "getdp-$suffix.log" | head -1)
  residual_line=$(grep 'Residual' "getdp-$suffix.log" | tail -1)
  dofs=$(grep -Eo 'System [0-9]+/[0-9]+: [0-9]+ Dofs' "getdp-$suffix.log" | head -1 | grep -Eo '[0-9]+ Dofs' | grep -Eo '[0-9]+')
  cat >> "$OUT/metadata.env" <<EOF
nodes_$suffix=$nodes
elements_$suffix=$elements
mesh_sha256_$suffix=$mesh_sha256
dofs_$suffix=$dofs
initial_residual_$suffix=${initial_residual_line##* }
residual_$suffix=${residual_line##* }
EOF
done
popd >/dev/null
