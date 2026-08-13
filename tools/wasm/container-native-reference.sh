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

cp "$SRC/getdp/tutorials/01-Electrostatics/"microstrip.{geo,pro} "$OUT/"
pushd "$OUT" >/dev/null
"$BUILD/gmsh/gmsh" microstrip.geo -format msh2 -2 -o microstrip.msh
"$BUILD/getdp/getdp" microstrip.pro -msh microstrip.msh -solve Ele -pos Map 2>&1 | tee getdp.log
popd >/dev/null

nodes=$(awk '/\$Nodes/{getline; print; exit}' "$OUT/microstrip.msh")
elements=$(awk '/\$Elements/{getline; print; exit}' "$OUT/microstrip.msh")
initial_residual_line=$(grep 'Residual' "$OUT/getdp.log" | head -1)
initial_residual=${initial_residual_line##* }
residual_line=$(grep 'Residual' "$OUT/getdp.log" | tail -1)
residual=${residual_line##* }
compiler=$(gcc --version | head -1)
compiler_sha256=$(sha256sum "$(command -v gcc)" | cut -d' ' -f1)
petsc_config_sha256=$(sha256sum "$petsc_config" | cut -d' ' -f1)
getdp_config_sha256=$(sha256sum "$config" | cut -d' ' -f1)
cat > "$OUT/metadata.env" <<EOF
nodes=$nodes
elements=$elements
initial_residual=$initial_residual
residual=$residual
compiler=$compiler
compiler_sha256=$compiler_sha256
petsc_config_sha256=$petsc_config_sha256
getdp_config_sha256=$getdp_config_sha256
EOF
