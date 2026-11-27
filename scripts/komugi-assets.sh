#!/usr/bin/env bash
# Installs a Komugi model release where the site looks for it, with the assets command of @komugi-ai/engine.
# Nothing it writes is committed.
#
# usage: scripts/komugi-assets.sh [release-dir]
#
# A release directory holds models.json, <id>.card.json and <id>.onnx, and models.json must recommend the
# model for Advanced. The script uses the directory given, else $KOMUGI_RELEASE_DIR; with neither, it
# downloads the published release named below from the Komugi repository's GitHub releases into a temporary
# directory, removed when it exits. The assets command checks the model's sha256 against its card and the
# card against models.json, so a damaged or altered download is refused.
#
# Writes apps/web/public/komugi/ (git-ignored): onnxruntime-web's runtime files (wasm and WebGPU builds)
# under ort-<version>/, the model, its card, models.json and ort-assets.json, which lists the runtime
# files. The page reads ort-assets.json and models.json to offer Komugi. Vite serves public/ in
# development and copies it into the build. Run `npm install` first: the command comes from node_modules.
set -euo pipefail

# The published model release installed by default: the model id and the GitHub release tag that holds it.
MODEL_ID=komugi-c6-s580800-c4970e1e
MODEL_TAG=model-komugi-c6-s580800-c4970e1e
RELEASE_URL="https://github.com/chessai/komugi/releases/download/$MODEL_TAG"

if [[ $# -gt 1 || "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
	echo "usage: $0 [release-dir]" >&2
	exit 2
fi

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
CLI="$ROOT/node_modules/@komugi-ai/engine/bin/komugi-assets.mjs"
if [[ ! -f "$CLI" ]]; then
	echo "error: $CLI is missing; run npm install first" >&2
	exit 1
fi

# Temporary directories, removed on exit: the downloaded release and the staged install.
DOWNLOAD=
STAGE=
cleanup() {
	if [[ -n "$STAGE" ]]; then rm -rf -- "$STAGE"; fi
	if [[ -n "$DOWNLOAD" ]]; then rm -rf -- "$DOWNLOAD"; fi
}
trap cleanup EXIT

RELEASE=${1:-${KOMUGI_RELEASE_DIR:-}}
if [[ -z "$RELEASE" ]]; then
	if ! command -v curl >/dev/null; then
		echo "error: curl is needed to download release $MODEL_TAG (or pass a release directory)" >&2
		exit 1
	fi
	DOWNLOAD=$(mktemp -d "${TMPDIR:-/tmp}/komugi-release-XXXXXX")
	for file in models.json "$MODEL_ID.card.json" "$MODEL_ID.onnx"; do
		echo "downloading $RELEASE_URL/$file" >&2
		if ! curl -fsSL --proto '=https' -o "$DOWNLOAD/$file" "$RELEASE_URL/$file"; then
			echo "error: could not download $file of release $MODEL_TAG" >&2
			exit 1
		fi
	done
	RELEASE=$DOWNLOAD
fi
if [[ ! -f "$RELEASE/models.json" ]]; then
	echo "error: $RELEASE has no models.json (pass the release directory, or set KOMUGI_RELEASE_DIR)" >&2
	exit 1
fi

PUBLIC="$ROOT/apps/web/public"
DEST="$PUBLIC/komugi"
# A fresh directory, swapped in only once complete, so no file of an older release stays behind.
STAGE=$(mktemp -d "$PUBLIC/.komugi-XXXXXX")
node "$CLI" assets "$STAGE" --release-dir "$RELEASE" --webgpu >/dev/null
rm -rf -- "$DEST"
mv "$STAGE" "$DEST"
STAGE=
chmod 755 "$DEST"
echo "installed $(cd "$DEST" && find . -type f | sort | sed 's|^\./||' | tr '\n' ' ')into ${DEST#"$ROOT"/}"
