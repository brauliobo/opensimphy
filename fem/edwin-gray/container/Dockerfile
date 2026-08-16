FROM debian@sha256:362e64223cc0da95422b3b13c045186fc0a81250e765d31c025fbddf257f6143

ARG DEBIAN_SNAPSHOT=20260804T000000Z
ARG GMSH_PACKAGE_VERSION=4.8.4+ds2-3
ARG GETDP_VERSION=3.5.0
ARG SOLVER_IMAGE_REVISION=uncommitted

LABEL org.opencontainers.image.source="https://github.com/brauliobo/opensimphy" \
      org.opencontainers.image.revision="${SOLVER_IMAGE_REVISION}" \
      org.opencontainers.image.title="Edwin Gray Gmsh/GetDP solver" \
      org.opencontainers.image.version="gmsh-4.8.4_getdp-3.5.0"

ADD --checksum=sha256:d3c28fa18f20d6147b4c7367d4dd802e9f7ddb58c608688bbb71919dbca8041d \
    https://getdp.info/bin/Linux/getdp-3.5.0-Linux64c.tgz /tmp/getdp.tgz

RUN export DEBIAN_FRONTEND=noninteractive \
    && printf '%s\n' \
      "deb [check-valid-until=no] http://snapshot.debian.org/archive/debian/${DEBIAN_SNAPSHOT} bookworm main" \
      > /etc/apt/sources.list \
    && rm -f /etc/apt/sources.list.d/debian.sources \
    && apt-get update \
    && apt-get install --yes --no-install-recommends \
      "gmsh=${GMSH_PACKAGE_VERSION}" \
    && tar -xzf /tmp/getdp.tgz -C /tmp \
    && install --mode=0555 /tmp/getdp-3.5.0-Linux64/bin/getdp /usr/local/bin/getdp \
    && rm -rf /tmp/getdp.tgz /tmp/getdp-3.5.0-Linux64 \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 solver \
    && useradd --uid 10001 --gid solver --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin solver \
    && install --directory --owner=solver --group=solver /output

ENV DEBIAN_SNAPSHOT=${DEBIAN_SNAPSHOT} \
    GMSH_PACKAGE_VERSION=${GMSH_PACKAGE_VERSION} \
    GETDP_PACKAGE_VERSION="official-${GETDP_VERSION}" \
    OMP_NUM_THREADS=1 \
    SOLVER_BASE_IMAGE="debian@sha256:362e64223cc0da95422b3b13c045186fc0a81250e765d31c025fbddf257f6143" \
    SOLVER_IMAGE_REVISION=${SOLVER_IMAGE_REVISION} \
    SOLVER_SOURCE="debian-snapshot+getdp-official-sha256"

COPY --chmod=0555 container/entrypoint.sh /usr/local/bin/solver-entrypoint

USER 10001:10001
WORKDIR /output
ENTRYPOINT ["/usr/local/bin/solver-entrypoint"]
CMD ["manifest"]
