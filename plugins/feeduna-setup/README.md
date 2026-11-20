# Feeduna Setup for Codex

With Node.js 22 or later on your PATH, add the plugin from the Feeduna marketplace.

```sh
codex plugin marketplace add performeon/feeduna-mcp --ref main
codex plugin add feeduna-setup@feeduna-tools
```

Create an expiring `setup:read` key in Feeduna **App setup**. Set
`FEEDUNA_API_TOKEN` in the environment that starts Codex, using your secret
manager. Start a new Codex session and ask it to run `feeduna_get_setup`. Check
that the app name and origin match App setup and that the snippet uses its app ID.

The plugin launches the included Feeduna MCP v0.1.1 bundle with Node. It makes
HTTPS requests to Feeduna for the authorized app's setup information. The
launcher disables JavaScript code generation from strings. See
[SECURITY.md](SECURITY.md) and [third-party notices](THIRD_PARTY_NOTICES.txt).
