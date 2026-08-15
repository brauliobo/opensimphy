#!/bin/sh
set -eu

json_string() {
  escaped=$(printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g; s/	/\\t/g; s//\\r/g')
  printf '"%s"' "$escaped"
}

gmsh_version=$(gmsh --version 2>&1 | sed -n '1p')
getdp_version=$(getdp --version 2>&1 | sed -n '1p')
command_name=${1:-manifest}
if [ "$command_name" = "manifest" ]; then
  command_name=""
  shift "$#"
else
  shift
fi

options=""
separator=""
for option in "$@"; do
  options="${options}${separator}$(json_string "$option")"
  separator=","
done

manifest=$(printf '{\n  "schemaVersion": "solver-environment-v1",\n  "software": {"gmsh": %s, "getdp": %s},\n  "image": {"reference": %s, "revision": %s},\n  "source": {"kind": %s, "baseImage": %s, "debianSnapshot": %s, "gmshPackage": %s, "getdpPackage": %s},\n  "architecture": {"os": "linux", "debian": %s, "kernel": %s},\n  "execution": {"command": %s, "options": [%s], "threadCount": %s},\n  "runner": {"revision": %s, "sourceRevision": %s}\n}' \
  "$(json_string "$gmsh_version")" \
  "$(json_string "$getdp_version")" \
  "$(json_string "${SOLVER_IMAGE_REFERENCE:-unknown}")" \
  "$(json_string "${SOLVER_IMAGE_REVISION:-unknown}")" \
  "$(json_string "${SOLVER_SOURCE:-unknown}")" \
  "$(json_string "${SOLVER_BASE_IMAGE:-unknown}")" \
  "$(json_string "${DEBIAN_SNAPSHOT:-unknown}")" \
  "$(json_string "${GMSH_PACKAGE_VERSION:-unknown}")" \
  "$(json_string "${GETDP_PACKAGE_VERSION:-unknown}")" \
  "$(json_string "$(dpkg --print-architecture)")" \
  "$(json_string "$(uname -m)")" \
  "$(json_string "$command_name")" \
  "$options" \
  "${OMP_NUM_THREADS:-1}" \
  "$(json_string "${SOLVER_RUNNER_REVISION:-unknown}")" \
  "$(json_string "${SOLVER_SOURCE_REVISION:-unknown}")")

if [ -n "${SOLVER_ENVIRONMENT_MANIFEST:-}" ]; then
  printf '%s\n' "$manifest" > "$SOLVER_ENVIRONMENT_MANIFEST"
else
  printf '%s\n' "$manifest"
fi

if [ -n "$command_name" ]; then
  exec "$command_name" "$@"
fi
