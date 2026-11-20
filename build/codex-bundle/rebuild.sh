#!/usr/bin/env bash
set -euo pipefail

if [[ $# != 3 || "$1" != /* || "$2" != /* ]]; then
  printf 'Usage: %s /absolute/path/to/node /absolute/path/to/npm OUTPUT_DIRECTORY\n' "$0" >&2
  exit 2
fi

node_bin="$1"
npm_cli="$2"
mkdir -p -- "$3"
output_dir="$(cd -- "$3" && pwd -P)"
script_dir="$(cd -- "$(dirname -- "$0")" && pwd -P)"
work_dir="$(mktemp -d "$script_dir/.feeduna-build.XXXXXXXX")"
trap 'rm -rf -- "$work_dir"' EXIT
mkdir -p "$work_dir/source" "$work_dir/esbuild" "$work_dir/out"
touch "$work_dir/npm-user.conf" "$work_dir/npm-global.conf"

source_commit=735efda4350c94e128a16b4da7e424680e10ee1c
source_sha256=bd59c32c21ea07900c4dbc05ea7a0e64fc3e3b8a975dda954b3d7d5ffe78cd18
lock_sha256=99ddd69a20c00501779963d34fa188dc9e94c2b682c953d6c88ce12a2d431b5b
esbuild_version=0.28.2

case "$(uname -s)/$(uname -m)" in
  Darwin/arm64) package=darwin-arm64; esbuild_sha256=1980cde09749094452b20d36ff267585ccb3f72749c7bc97291cd9996ccf5a2a ;;
  Darwin/x86_64) package=darwin-x64; esbuild_sha256=abb6a7a895aaf2cc0df36fecc3bf0042479ffec51a643a056d54e9109f27db55 ;;
  Linux/aarch64) package=linux-arm64; esbuild_sha256=a96dbfa41d3ef5dbd1ef22b1c10d5187be9267e86093a870f06402a7ec931596 ;;
  Linux/x86_64) package=linux-x64; esbuild_sha256=9573bb2233aab0f9ea7647d5cca9726113cc1768de61d66b17267f4db84488f6 ;;
  *) printf 'No verified esbuild archive for this platform.\n' >&2; exit 2 ;;
esac

check_sha256() {
  local digest
  read -r digest _ < <(shasum -a 256 -- "$2")
  if [[ "$digest" != "$1" ]]; then
    printf 'Unexpected digest for %s\n' "$(basename -- "$2")" >&2
    exit 1
  fi
}

curl -qfsSL --proto '=https' --proto-redir '=https' \
  "https://codeload.github.com/performeon/feeduna-mcp/tar.gz/$source_commit" -o "$work_dir/source.tgz"
check_sha256 "$source_sha256" "$work_dir/source.tgz"
curl -qfsSL --proto '=https' --proto-redir '=https' \
  "https://registry.npmjs.org/@esbuild/$package/-/$package-$esbuild_version.tgz" -o "$work_dir/esbuild.tgz"
check_sha256 "$esbuild_sha256" "$work_dir/esbuild.tgz"
tar -xzf "$work_dir/source.tgz" --strip-components=1 -C "$work_dir/source"
tar -xzf "$work_dir/esbuild.tgz" --strip-components=1 -C "$work_dir/esbuild" package/bin/esbuild

cd -- "$work_dir/source"
check_sha256 "$lock_sha256" npm-shrinkwrap.json
env -i PATH="$(dirname -- "$node_bin"):/usr/bin:/bin" \
  "$node_bin" "$npm_cli" ci --ignore-scripts --omit=dev --no-audit --no-fund \
  --cache "$work_dir/npm-cache" --userconfig "$work_dir/npm-user.conf" \
  --globalconfig "$work_dir/npm-global.conf" \
  --registry https://registry.npmjs.org
check_sha256 "$lock_sha256" npm-shrinkwrap.json
[[ "$("$work_dir/esbuild/bin/esbuild" --version)" == "$esbuild_version" ]]

"$work_dir/esbuild/bin/esbuild" src/cli.mjs --bundle --platform=node --target=node22 \
  --format=cjs --legal-comments=inline --outfile="$work_dir/out/feeduna-mcp.cjs" \
  --metafile="$work_dir/out/esbuild-metafile.json"
cp -- LICENSE "$work_dir/out/LICENSE"
"$node_bin" "$script_dir/write-notices.mjs" "$work_dir/out/esbuild-metafile.json" \
  "$work_dir/out/THIRD_PARTY_NOTICES.txt" "$work_dir/out/bundle-dependencies.json"
for artifact in feeduna-mcp.cjs LICENSE THIRD_PARTY_NOTICES.txt bundle-dependencies.json; do
  cp -- "$work_dir/out/$artifact" "$output_dir/$artifact"
done
