#!/usr/bin/env bash
# Recovery installer for near-sdk-js 2.0.0 on Linux x86_64.
# The pinned assets are the same official sources as the SDK's installer.
set -euo pipefail
cd "$(dirname "$0")/../contract"
[ "$(uname -s)" = Linux ] && [ "$(uname -m)" = x86_64 ] || { echo 'Linux x86_64 required'; exit 1; }
[ -f node_modules/near-sdk-js/package.json ] || { echo 'Run npm ci --ignore-scripts in contract first'; exit 1; }
node -e "if(require('./node_modules/near-sdk-js/package.json').version !== '2.0.0') process.exit(1)"
work_dir=$(mktemp -d)
trap 'rm -rf "$work_dir"' EXIT
curl -fsSL --retry 2 --max-time 180 https://github.com/ailisp/binaryen/releases/download/v0.1.16/binaryen-Linux-X64.tar.gz -o "$work_dir/binaryen.tar.gz"
curl -fsSL --retry 2 --max-time 180 https://github.com/near/quickjs/releases/download/v0.1.3/qjsc-Linux-X64 -o "$work_dir/qjsc"
curl -fsSL --retry 2 --max-time 180 https://github.com/near/quickjs/archive/refs/tags/v0.1.3.tar.gz -o "$work_dir/quickjs.tar.gz"
curl -fsSL --retry 2 --max-time 180 https://github.com/WebAssembly/wasi-sdk/releases/download/wasi-sdk-11/wasi-sdk-11.0-linux.tar.gz -o "$work_dir/wasi.tar.gz"
(cd "$work_dir"; sha256sum -c <<'SUMS'
c8b396dac4218c2a88e00eb67038d85908c503fce9408d6c812addbc83d411df  binaryen.tar.gz
f311c47539587b6fce2fa8496a0c4ccaacb12de9aa072b90afc1946ef448a139  qjsc
83bdb56367f74beb1dc95baa6998091cc12a66a2f7ec88df24e40d4a8aa06b96  quickjs.tar.gz
4f0e8b468cf61e30efda4e336d60ca49cd4ed113074b1d9d8e687107c9dda1fc  wasi.tar.gz
SUMS
)
mkdir -p "$work_dir/deps/binaryen"
tar xzf "$work_dir/binaryen.tar.gz" -C "$work_dir/deps/binaryen"
tar xzf "$work_dir/quickjs.tar.gz" -C "$work_dir/deps"
tar xzf "$work_dir/wasi.tar.gz" -C "$work_dir/deps"
mv "$work_dir/deps/quickjs-0.1.3" "$work_dir/deps/quickjs"
mv "$work_dir/deps/wasi-sdk-11.0" "$work_dir/deps/wasi-sdk"
cp "$work_dir/qjsc" "$work_dir/deps/qjsc"
chmod +x "$work_dir/deps/qjsc"
# Only replace this SDK's generated dependency directory after verification.
rm -rf node_modules/near-sdk-js/lib/cli/deps
mv "$work_dir/deps" node_modules/near-sdk-js/lib/cli/deps
printf '%s\n' 'Toolchain installed. Run npm run build in contract.'
