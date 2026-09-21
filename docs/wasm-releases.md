# WASM release distribution

The compiled browser simulation runtime is deliberately absent from Git. `public/simulation/`, `tools/wasm/out/`, and `tools/wasm/.cache/` remain ignored. GitHub Releases in `brauliobo/opensimphy` are the durable runtime store. Git LFS is not used, workflow artifacts are not durable distribution, and the Pages artifact is only a deploy handoff. GitHub Actions never compiles Gmsh, GetDP, PETSc, or SLEPc.

## Version contract

The current bootstrap version is `056dd2cea3a22399f191`, read from `tools/wasm/artifacts.lock.json`. Its only acceptable release tag is `wasm-056dd2cea3a22399f191`. Pages and local fetches resolve that exact tag rather than "latest". A release must be published, non-prerelease, target the source commit recorded by its metadata, contain exactly the required assets with no extras, and match `SHA256SUMS` plus GitHub-provided `sha256:` asset digests when GitHub exposes them.

The archive is the exact lock-verified `public/simulation/` tree. Packaging uses deterministic sorted depth-first POSIX ustar entries, uid/gid/mtime zero, regular mode `0644`, directory mode `0755`, and gzip level 9 without a filename or timestamp. Verification rejects absolute, traversal, ambiguous, duplicate, linked, device, and other special entries before extracting. Extraction occurs in a temporary sibling directory, runs the existing per-file and partition lock verifier there, and only then replaces the staged tree.

## Local use

Fetch the currently locked release and build without Docker or WASM compilation:

```sh
npm ci
npm run simulation:fetch
npm run build:deploy
```

`WASM_RELEASE_REPO=owner/repository` selects another repository. `GITHUB_TOKEN` or `GH_TOKEN` supplies a token for private repositories or higher API limits. Compiling a new runtime stays on the maintainer machine; see [Local compilation and publication](#local-compilation-and-publication).

The package includes deterministic release metadata, a complete pinned corresponding-source recipe/manifest, deterministic SPDX 2.3 SBOM, the lock-identity report, and checksums. Packaging and release verification reject the report unless its artifact-lock hash, canonical input map, exact output map, staged output bytes/hashes, `byteIdentical` flag, and empty drift list all match the current lock and staged tree. Licensing fields remain `NOASSERTION` where the runtime aggregate has not selected a project-level license; this does not weaken source provenance or byte verification.

## Local compilation and publication

Compile, lock, stage, and package on the maintainer machine. GitHub Pages, Browser ONELAB, and frontend CI only fetch the exact locked tag.

```sh
JOBS=4 nice npm run wasm:reproducibility
npm run wasm:lock:update
npm run simulation:stage -- --verify-lock
npm run simulation:verify
node tools/wasm/compare-builds.mjs tools/wasm/out tools/wasm/out tools/wasm/reproducibility-report.json
npm run simulation:package:verify
npm run simulation:release:verify -- "release/wasm-$(node -p "require('./tools/wasm/artifacts.lock.json').contentVersion")"
```

Publish the packaged directory as a non-prerelease GitHub Release whose tag is `wasm-<contentVersion>`, targeting the lock commit. Versioned releases and tags are immutable: corrections require a new content version and release, never replacing an asset. After the release exists, `npm run simulation:fetch` succeeds and **Deploy GitHub Pages** on `main` can copy those bytes into the Pages artifact. Release events do not trigger Pages.

## Retention and rollback

Keep every published `wasm-<contentVersion>` release needed by a deployed or rollback-capable application commit. Do not apply artifact retention policy to releases. Rollback means deploying an application commit whose lock names an older retained content version. The fetch remains exact and never falls forward to another release.

GitHub Pages receives the large simulation files in its deployment artifact, but Workbox excludes `simulation/**` from precaching. Browsers fetch immutable versioned paths lazily and partition caches by content version. The manifest is intentionally uncached by the service worker, while HTTP/CDN caching of versioned WASM files is safe because a version is never replaced. Pages repository and deployment size limits still apply; a packaged runtime may be valid while a Pages upload exceeds GitHub's current limits, in which case the previous successful deployment remains active.
