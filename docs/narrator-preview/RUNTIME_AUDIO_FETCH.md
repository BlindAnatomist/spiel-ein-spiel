# Pinned runtime audio for Netlify Git builds

The owner approved publishing the existing runtime recordings as a public
GitHub Release package and retrieving it from the normal Netlify Git build.
External writes, future media changes and Actions runs still require the
applicable authorization; this document grants none.

## Immutable-by-verification release

`scripts/narrator-runtime-release.ts` pins one versioned GitHub Release asset:

- Release tag: `peter-audio-20261005`
- File: `peter-runtime-audio-20261005.tar.gz`
- Compressed bytes: `72747762`
- SHA256: `1bccdc43ebaaa0655ee59b0b7df47f5695510262ac4b1a1031856992da3ba8c7`
- Contents: exactly 2,133 existing `audio/<id>.mp3` recordings, totaling
  74,549,080 audio bytes, verified against `web/narrator-assets.ts`

The pack contains no source, manifests, comparison recordings, documents,
credentials or additional media. It is USTAR with regular file entries only,
sorted names, mode 0644, uid/gid zero, mtime zero, and gzip mtime zero with no
embedded filename. Directory, PAX, GNU-extension and link entries are not allowed.
The manifest in the reviewed checkout is authoritative; an archive cannot supply
its own trusted manifest. No generation or provider call is involved.

The fixed URL is
[the versioned runtime asset](https://github.com/BlindAnatomist/spiel-ein-spiel/releases/download/peter-audio-20261005/peter-runtime-audio-20261005.tar.gz).
Any replacement with different bytes fails verification, even at the same URL. Changing media
requires a newly reviewed version, URL, archive identity and manifest update.

## Build behavior

`npm run build` fetches only when `NETLIFY=true` and `CONTEXT` is `production` or
`deploy-preview`. It first checks every existing allowlisted recording. If all
are correct, the build uses them without downloading; missing recordings trigger
a fetch of the complete pinned archive. Differing existing bytes, links or special
files stop the build instead of being overwritten. No token or new dependency is
needed, and no environment variable can override the release URL/hash.

Production, deploy-preview and narrator-preview all require a complete, verified
runtime catalog before changing `dist`. Normal code-only CI/development builds
remain offline and safely disable Peter when media is absent. A code-only build
is not release-media verification. Offline production or preview builds can use
recordings restored through the existing private restoration route.

Public production and deploy-preview output contain only the runtime allowlist.
The separate repair/comparison originals remain available to narrator-preview
and local development builds, but are neither needed nor copied in deploy-preview.
The isolated deploy-preview layout fixtures continue to be included. This change
does not alter the existing Netlify functions, hosting configuration, game logic,
engine, bots, dialogue or storage keys.

## Verification and failure behavior

The downloader sends an anonymous HTTPS request to the pinned GitHub release URL,
then follows at most three HTTPS redirects to the exact official asset hosts
`release-assets.githubusercontent.com` or `objects.githubusercontent.com`.
Credentials, non-default ports, fragments, other hosts and HTTP redirects are
rejected. The request and body share a 120-second deadline. Declared and streamed
sizes must match the pinned compressed size, capped at 100 MiB. The complete
archive SHA256 is verified before decompression or parsing.

Decompression has a catalog-derived output limit. The deliberately small USTAR
parser validates header checksums, safe exact names, type, payload size, payload
SHA256, padding and end markers. Missing, extra, duplicate, linked, unsafe,
truncated or corrupted entries fail before any destination recordings are written.
The restore uses exclusive creation and never overwrites a destination. If an
I/O interruption leaves some verified files, the next run rechecks and reuses them.

Unavailable releases, network/timeout errors, corrupt downloads and stale or
conflicting caches stop Netlify builds. There is no partial-audio fallback for
those contexts. Do not weaken verification to repair a failure: investigate the
published archive, pinned metadata, cache or network first. A verified set of
existing recordings can be reused without the release service being available.

## Checks

```sh
npm run check
```

Unit coverage includes the Netlify context gate, release/catalog pin, complete
restoration, verified-cache reuse, conflicting/symlinked destinations, unsafe and
malformed archives, anonymous requests, redirect allowlisting/limits, HTTP and
body failures, size/hash mismatches, and request/body timeouts. All network unit
tests use injected responses and do not require an uploaded release.

Before integration approval, validate the actual private pack in a temporary
checkout and build both production and deploy-preview from restored recordings.
Check every output MP3 against the runtime manifest and confirm comparison media
is absent. After publication is separately authorized, also validate the real
anonymous GitHub download and a clean Netlify preview; mocked HTTP tests and local
builds cannot establish those external results.
