# WASM release distribution

The compiled browser simulation runtime is deliberately absent from Git. `public/simulation/`, `tools/wasm/out/`, and `tools/wasm/.cache/` remain ignored. GitHub Releases in `brauliobo/opensimphy` are the durable runtime store. Git LFS is not used, workflow artifacts are not durable distribution, and the Pages artifact is only a deploy handoff. Candidate workflow artifacts expire after three days.

## Version contract

The current bootstrap version is `8b4dd5c93e4141bd5be9`, read from `tools/wasm/artifacts.lock.json`. Its only acceptable release tag is `wasm-8b4dd5c93e4141bd5be9`. Pages and local fetches resolve that exact tag rather than "latest". A release must be published, non-prerelease, target the source commit recorded by its metadata, contain exactly the required assets with no extras, and match `SHA256SUMS` plus GitHub-provided `sha256:` asset digests when GitHub exposes them.

The archive is the exact lock-verified `public/simulation/` tree. Packaging uses deterministic sorted depth-first POSIX ustar entries, uid/gid/mtime zero, regular mode `0644`, directory mode `0755`, and gzip level 9 without a filename or timestamp. Verification rejects absolute, traversal, ambiguous, duplicate, linked, device, and other special entries before extracting. Extraction occurs in a temporary sibling directory, runs the existing per-file and partition lock verifier there, and only then replaces the staged tree.

## Local use

Fetch the currently locked release and build without Docker or WASM compilation:

```sh
npm ci
npm run simulation:fetch
npm run build:deploy
```

`WASM_RELEASE_REPO=owner/repository` selects another repository. `GITHUB_TOKEN` or `GH_TOKEN` supplies a token for private repositories or higher API limits. A local source build remains explicit:

```sh
JOBS=4 nice npm run wasm:reproducibility
npm run simulation:stage -- --verify-lock
npm run simulation:verify
npm run simulation:package:verify
```

The package includes deterministic release metadata, a complete pinned corresponding-source recipe/manifest, deterministic SPDX 2.3 SBOM, the two-build reproducibility report, and checksums. Packaging and release verification reject the report unless its artifact-lock hash, canonical input map, exact output map, staged output bytes/hashes, `byteIdentical` flag, and empty drift list all match the current lock and staged tree. Licensing fields remain `NOASSERTION` where the runtime aggregate has not selected a project-level license; this does not weaken source provenance or byte verification.

## Candidate and publication

`.github/workflows/wasm-candidate.yml` compiles twice from isolated caches with pinned Node `22.18.0` and the digest-pinned Emscripten image, checks native references, runs type/unit/E2E gates, packages twice, verifies the candidate, creates build-provenance attestations, and uploads a three-day handoff artifact. Every third-party action is pinned to a reviewed full commit SHA. It does not create a tag or release.

`.github/workflows/publish-wasm-release.yml` is manual. It accepts a successful candidate run ID and exact content version, requires a `main` candidate commit from this repository, verifies every asset attestation against that repository, SHA, ref, and candidate workflow, and rejects an existing tag or release before creating anything. It then creates a draft through the API, uploads without clobbering, compares the exact uploaded asset set and checksums, publishes it, and performs an exact remote fetch verification. On failure it may delete only the still-draft release ID created by that run and its candidate-SHA tag; it refuses to delete a published release or a tag pointing elsewhere. Versioned releases and tags are treated as immutable: corrections require a new content version and release, never replacing an asset.

For the bootstrap release, first merge the distribution changes to `main`, run **WASM Release Candidate**, and wait for success. Then run **Publish WASM Release** with that run ID and `8b4dd5c93e4141bd5be9`. The resulting `release.published` event invokes Pages only when the event tag exactly matches the lock on current `main`, the release target is a full commit reachable from `main`, and the tag resolves to that target. Unrelated releases end successfully with the build and deploy jobs skipped, leaving the prior deployment unchanged. No repository setting change is part of this process.

## Retention and rollback

Keep every published `wasm-<contentVersion>` release needed by a deployed or rollback-capable application commit. Delete only expired candidate artifacts; do not apply artifact retention policy to releases. Rollback means deploying an application commit whose lock names an older retained content version. The fetch remains exact and never falls forward to another release.

GitHub Pages receives the large simulation files in its deployment artifact, but Workbox excludes `simulation/**` from precaching. Browsers fetch immutable versioned paths lazily and partition caches by content version. The manifest is intentionally uncached by the service worker, while HTTP/CDN caching of versioned WASM files is safe because a version is never replaced. Pages repository and deployment size limits still apply; a candidate may be valid while a Pages upload exceeds GitHub's current limits, in which case the previous successful deployment remains active.
