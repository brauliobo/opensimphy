#!/usr/bin/env bash
set -euo pipefail

SRC=/workspace/native/src
BUILD=/workspace/native/build
OUT=/workspace/native/out
JOBS=${JOBS:-4}
PETSC_ARCH=arch-opensimphy-native-real
F2CBLASLAPACK=/workspace/native/downloads/f2cblaslapack-3.8.0.q2.tar.gz

rm -rf "$BUILD/gmsh" "$BUILD/getdp" "$OUT"
mkdir -p "$BUILD/gmsh" "$BUILD/getdp" "$OUT"
patch -d "$SRC/gmsh" -p1 < /workspace/tools/gmsh/optional-quad-predicate.patch
cmake -S "$SRC/gmsh" -B "$BUILD/gmsh" \
  -DCMAKE_BUILD_TYPE=Release -DDEFAULT=OFF -DENABLE_MESH=ON \
  -DENABLE_PARSER=ON -DENABLE_POST=ON -DENABLE_ONELAB=ON -DENABLE_EIGEN=ON
nice cmake --build "$BUILD/gmsh" --target gmsh --parallel "$JOBS"

pushd "$SRC/petsc" >/dev/null
./configure PETSC_ARCH="$PETSC_ARCH" --with-debugging=0 \
  --with-cc=gcc --with-cxx=g++ --with-fc=0 --with-shared-libraries=0 \
  --download-f2cblaslapack="file://$F2CBLASLAPACK" \
  --with-scalar-type=real --with-precision=double --with-64-bit-indices=0 \
  --with-mpi=0 COPTFLAGS=-O2 CXXOPTFLAGS=-O2
nice make PETSC_DIR="$SRC/petsc" PETSC_ARCH="$PETSC_ARCH" -j"$JOBS" all
popd >/dev/null
petsc_config="$SRC/petsc/$PETSC_ARCH/include/petscconf.h"
grep -q '^#define PETSC_USE_REAL_DOUBLE 1' "$petsc_config"
! grep -q '^#define PETSC_USE_COMPLEX' "$petsc_config"
! grep -q '^#define PETSC_USE_64BIT_INDICES' "$petsc_config"
grep -q '^#define PETSC_HAVE_F2CBLASLAPACK 1' "$petsc_config"

cmake -S "$SRC/getdp" -B "$BUILD/getdp" \
  -DCMAKE_BUILD_TYPE=Release -DDEFAULT=OFF -DENABLE_KERNEL=ON -DENABLE_PETSC=ON \
  -DENABLE_SPARSKIT=OFF \
  -DPETSC_DIR="$SRC/petsc" -DPETSC_ARCH="$PETSC_ARCH" \
  -DPETSC_LIBS="$SRC/petsc/$PETSC_ARCH/lib/libpetsc.a"
config="$BUILD/getdp/src/common/GetDPConfig.h"
grep -q '^#define HAVE_PETSC' "$config"
grep -q '^#define HAVE_BLAS' "$config"
grep -q '^#define HAVE_LAPACK' "$config"
! grep -q '^#define HAVE_SPARSKIT' "$config"
nice cmake --build "$BUILD/getdp" --target getdp --parallel "$JOBS"

cp /workspace/native/fixtures/microstrip.{geo,pro} "$OUT/"
pushd "$OUT" >/dev/null
for mesh_size in 1 2; do
  suffix=${mesh_size//./_}
  "$BUILD/gmsh/gmsh" microstrip.geo -setnumber "Parameters/Mesh/Global mesh size factor" "$mesh_size" -format msh2 -2 -o "microstrip-$suffix.msh"
  "$BUILD/getdp/getdp" microstrip.pro -msh "microstrip-$suffix.msh" -solve Ele -pos Map 2>&1 | tee "getdp-$suffix.log"
  mv v.pos "v-$suffix.pos"
  mv e.pos "e-$suffix.pos"
done
popd >/dev/null

compiler=$(gcc --version | head -1)
compiler_sha256=$(sha256sum "$(command -v gcc)" | cut -d' ' -f1)
petsc_config_sha256=$(sha256sum "$petsc_config" | cut -d' ' -f1)
getdp_config_sha256=$(sha256sum "$config" | cut -d' ' -f1)
cat > "$OUT/metadata.env" <<EOF
compiler=$compiler
compiler_sha256=$compiler_sha256
petsc_config_sha256=$petsc_config_sha256
getdp_config_sha256=$getdp_config_sha256
EOF
for mesh_size in 1 2; do
  suffix=${mesh_size//./_}
  nodes=$(awk '/\$Nodes/{getline; print; exit}' "$OUT/microstrip-$suffix.msh")
  elements=$(awk '/\$Elements/{getline; print; exit}' "$OUT/microstrip-$suffix.msh")
  mesh_sha256=$(node /workspace/tools/canonical-msh-hash.mjs "$OUT/microstrip-$suffix.msh")
  initial_residual_line=$(grep 'Residual' "$OUT/getdp-$suffix.log" | head -1)
  residual_line=$(grep 'Residual' "$OUT/getdp-$suffix.log" | tail -1)
  dofs=$(grep -Eo 'System [0-9]+/[0-9]+: [0-9]+ Dofs' "$OUT/getdp-$suffix.log" | tail -1 | grep -Eo '[0-9]+ Dofs' | grep -Eo '[0-9]+' || true)
  cat >> "$OUT/metadata.env" <<EOF
nodes_$suffix=$nodes
elements_$suffix=$elements
mesh_sha256_$suffix=$mesh_sha256
dofs_$suffix=$dofs
initial_residual_$suffix=${initial_residual_line##* }
residual_$suffix=${residual_line##* }
EOF
done
