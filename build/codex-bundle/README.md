# Feeduna Codex local stdio bundle

The bundle uses the source and npm shrinkwrap from [Feeduna MCP v0.1.1](https://github.com/performeon/feeduna-mcp/tree/735efda4350c94e128a16b4da7e424680e10ee1c). The release `src/` files, `package.json`, lock and `LICENSE` were compared byte-for-byte with commit `cbc802969c75683b457774f803eb6e0700704ebb`, which the existing npm launcher pins. The build uses [esbuild v0.28.2](https://github.com/evanw/esbuild/releases/tag/v0.28.2) and checks the source archive, lock and native compiler archive SHA-256 digests before use.

The build needs Bash, Node 22+, npm, curl, tar and shasum, plus read access to the pinned public GitHub and npm artifacts. The build uses isolated npm configuration/cache and disables install lifecycle scripts. Start from this directory and run the recipe twice to compare the bytes between clean builds.

```sh
bash rebuild.sh /absolute/path/to/node /absolute/path/to/npm dist
bash rebuild.sh /absolute/path/to/node /absolute/path/to/npm dist-repro
cmp dist/feeduna-mcp.cjs dist-repro/feeduna-mcp.cjs
cmp dist/LICENSE dist-repro/LICENSE
cmp dist/THIRD_PARTY_NOTICES.txt dist-repro/THIRD_PARTY_NOTICES.txt
cmp dist/bundle-dependencies.json dist-repro/bundle-dependencies.json
/absolute/path/to/node --test smoke-test.mjs
```

The distributed bundle runs as `node feeduna-mcp.cjs` from the containing directory. It reads `FEEDUNA_API_TOKEN` from its environment using the original connector code. It needs Node 22 or later and HTTPS access to the configured Feeduna API. The shipped entry is readable CommonJS, so it handles vendored CommonJS dependencies and the one remaining Node builtin, `node:process`, without an ESM `require` shim. The bundle has no dependency directory, npm runtime invocation, runtime package downloads or new network routes. Include `LICENSE` and `THIRD_PARTY_NOTICES.txt` when distributing the bundle. The inventory records each bundled package and the SDK's internally vendored code recovered from its published source maps. The upstream SDK includes Ajv's schema validation code generator. Native Codex tool allowlisting is configured outside the bundle. Use a key limited to `setup:read` for the setup plugin.

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `dist/feeduna-mcp.cjs` | 860,841 | `de28137c172489d9999131286087f4695efdaa833c2707feb982b335376ab496` |
| `dist/LICENSE` | 1,072 | `f8673e060c56d428337822ff3eb89c97988590e7e23fb9d217597563682d587d` |
| `dist/THIRD_PARTY_NOTICES.txt` | 33,550 | `e9615969a0762f47a002a6079cdf0a332f27a33e05e52e9e0c595c9eb15a3772` |
| `dist/bundle-dependencies.json` | 3,465 | `d8f477cbe08951218699e3ba8d28aadbd9b0a7f75a8d9536280cfd90829a6f9e` |

The Node smoke test copies only the executable bundle into a temporary directory and checks that npm cannot be found on its `PATH`. It verifies startup, MCP initialization, setup-only capability discovery, a successful setup read, refusal of report access, and clean missing-key handling against synthetic loopback HTTP. The tests passed on Node v22.0.0 and v26.13.1. The two final builds matched using macOS arm64, Node v26.13.1 and npm 11.20.0.
