# Feeduna MCP connector

Version 0.1.1. Bring contextual feedback from your Feeduna app into a compatible
local MCP host. Read installation guidance, list and export feedback, or submit
feedback when you explicitly grant write access. Node.js 22 or later is required.
This is a local stdio connector, not a hosted HTTP MCP endpoint or remote OAuth
integration.

## Install the MCP bundle

1. [Start a 14-day Feeduna trial](https://app.feeduna.com/review), or sign in to
   an existing account, then add your app.
2. In App setup → Connect your tools, create an expiring access key for that app.
   Grant only the scopes you need. `setup:read` reads setup instructions;
   `reports:read` reads feedback; `reports:write` permits feedback submission.
3. Download `feeduna-mcp-0.1.1.mcpb` from the
   [v0.1.1 release](https://github.com/performeon/feeduna-mcp/releases/tag/v0.1.1)
   and open it in a host that supports MCPB Node bundles. Enter the key into the
   host's private Feeduna access-key field.
   The bundle includes its production JavaScript dependencies. Your host must
   provide Node.js 22 or later. Other MCP hosts can run the bundled
   `src/cli.mjs` directly with Node and `FEEDUNA_API_TOKEN` in a private environment.
4. Refresh the host's tool list. With a `setup:read` key, run
   `feeduna_get_setup` to confirm the connection and get your app's install instructions.

On macOS, open the `.mcpb` file with Claude Desktop to see the install preview.
To install from within Claude Desktop, go to **Settings → Desktop app** and select **Manage** next to
**Extensions**, then open **Advanced settings → Install Extension…** and select
the `.mcpb` file. The app includes a Node.js runtime. See
[Claude's desktop extension guide](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop).

Never put the key in source control, a prompt, a URL or shared configuration.
Revoke it in Feeduna when you no longer need the integration. This bundle fixes
the API destination to https://app.feeduna.com. No API key is included.

### VS Code with the Copilot harness

1. Unpack the [v0.1.1 bundle](https://github.com/performeon/feeduna-mcp/releases/tag/v0.1.1)
   as a ZIP archive. Keep `src` and `node_modules` together. Find the full paths
   to `src/cli.mjs` and your Node.js 22+ executable.
2. Create a Feeduna key with only `setup:read`. Use your secret manager to set
   `FEEDUNA_API_TOKEN` in the environment that launches VS Code or Copilot CLI.
   For a remote session, set it on the host that runs Copilot.
3. In VS Code, select the **Copilot** harness. Add the `feeduna` entry under
   `mcpServers` in your private **Copilot Global** configuration
   (`~/.copilot/mcp-config.json` by default). Copilot CLI on the same host reads
   that file too. Replace the two example paths.
   [Copilot configuration reference](https://code.visualstudio.com/docs/agents/reference/mcp-configuration).

```json
{
  "mcpServers": {
    "feeduna": {
      "type": "stdio",
      "command": "/absolute/path/to/node",
      "args": ["/absolute/path/to/feeduna-mcp/src/cli.mjs"],
      "env": {
        "FEEDUNA_API_URL": "https://app.feeduna.com",
        "FEEDUNA_API_TOKEN": "${FEEDUNA_API_TOKEN}"
      },
      "tools": ["feeduna_get_setup"]
    }
  }
}
```

In a Copilot session, ask it to run `feeduna_get_setup` and tell you which app
it returned. Approve the setup tool if prompted and check its actual result.
Verified with GitHub Copilot CLI 1.0.114 and a synthetic Feeduna app.
Share the host and the step where you got stuck in the
[install-testing thread](https://github.com/performeon/feeduna-mcp/issues/1).

### Gemini CLI

With Node.js 22 or later and a supported Gemini CLI account, create an expiring
key with `setup:read` in Feeduna **App setup**, then install the extension:

```sh
gemini extensions install https://github.com/performeon/feeduna-mcp
```

Enter the key when the CLI prompts for **Feeduna setup key**. Gemini CLI stores
this setting in the system keychain. Run `gemini mcp list`, then approve
`feeduna_get_setup` in a Gemini session to get the instructions for your app.
The extension uses the published 0.1.1 connector source and exposes the setup
tool.

#### Manual Gemini CLI setup

1. Unpack the [v0.1.1 bundle](https://github.com/performeon/feeduna-mcp/releases/tag/v0.1.1) as ZIP. Keep `src` and `node_modules` together and use Node.js 22 or later.
2. Create an expiring Feeduna key with only `setup:read`. Make `FEEDUNA_API_TOKEN` available in the environment of the terminal that launches Gemini CLI. Keep the actual key out of `settings.json`.
3. Merge this entry into `~/.gemini/settings.json` and replace the two example paths.

```json
{
  "mcpServers": {
    "feeduna": {
      "command": "/absolute/path/to/node",
      "args": [
        "/absolute/path/to/feeduna-mcp/src/cli.mjs"
      ],
      "env": {
        "FEEDUNA_API_TOKEN": "${FEEDUNA_API_TOKEN}"
      },
      "includeTools": [
        "feeduna_get_setup"
      ]
    }
  }
}
```

Run `gemini mcp list` and look for **Connected**. In Gemini CLI, ask it to run
`feeduna_get_setup` for the installation instructions and approve the tool if
prompted. This setup reads instructions without changing your app.
Verified with Gemini CLI 0.68.0 and a synthetic Feeduna app.

### Codex CLI

With Node.js 22 or later and `npm` on your path, install the setup plugin from
this repository's marketplace:

```sh
codex plugin marketplace add performeon/feeduna-mcp --ref main
codex plugin add feeduna-setup@feeduna-tools
```

Create an expiring `setup:read` key in Feeduna **App setup**. Use your secret
manager to set `FEEDUNA_API_TOKEN` in the environment that launches Codex. Open
a new Codex session and ask it to run `feeduna_get_setup`. Confirm that the
returned project and embed snippet match your app. The plugin exposes only the
setup tool and uses the published 0.1.1 connector source.

#### Manual Codex CLI setup

1. Download and unpack `feeduna-mcp-0.1.1.mcpb` from the [v0.1.1 release](https://github.com/performeon/feeduna-mcp/releases/tag/v0.1.1). Use Node.js 22 or later.
2. Create an expiring Feeduna key with only `setup:read`. Use your secret manager to set `FEEDUNA_API_TOKEN` in the environment that launches Codex.
3. Add this to your user `~/.codex/config.toml`. Replace both paths with their absolute paths on your machine. Keep the actual key out of the file.

```toml
[mcp_servers.feeduna]
command = "/absolute/path/to/node"
args = ["/absolute/path/to/feeduna-mcp/src/cli.mjs"]
env_vars = ["FEEDUNA_API_TOKEN"]
enabled_tools = ["feeduna_get_setup"]

[mcp_servers.feeduna.env]
FEEDUNA_API_URL = "https://app.feeduna.com"
```

Start a Codex session and use `/mcp` to check the connection. Ask Codex to run
`feeduna_get_setup` to get the install snippet for your app. This tool reads
setup instructions. [Codex MCP documentation](https://learn.chatgpt.com/docs/extend/mcp?surface=cli).

A successful result includes `data.project` (ID, name, and origin),
`data.embed_url`, and `data.snippet`. Check the project name and origin against
App setup. The snippet’s `data-project` should match `data.project.id`.

Verified with the native MCP host in Codex CLI 0.169.0-alpha.11.1 and a synthetic
Feeduna app, using the published v0.1.1 bundle.

## Try your first feedback report

In [App setup](https://app.feeduna.com/review?view=setup), choose your app and
select **Test my widget**. Send a report from the sample page, then open the
labelled test report in your Feeduna inbox. This works before you edit your site.

To collect feedback from your own users, add the snippet returned by
`feeduna_get_setup`. Follow the [installation guide](https://app.feeduna.com/docs#install)
or [Next.js example](https://app.feeduna.com/docs#nextjs).

Then open **App setup → Check widget on your site** and enter the full URL of
the page where you added the snippet. **Widget connected on this page** confirms
that the widget can reach Feeduna from that app's configured origin without
sending a report. If the check does not appear, confirm the snippet is on that
page.

When a customer reports an AI answer, [add a “Report this answer” button](https://app.feeduna.com/guides/ai-answer-feedback).
Pass a versioned ID from your app so your team can find the reported answer
again after regeneration. For other records and results, use
[the data feedback example](https://app.feeduna.com/docs#results).

Connect your Linear team in Feeduna’s App setup, then follow the
[first-report guide](https://app.feeduna.com/guides/customer-feedback-to-linear) to review and send one report.
See [Feeduna in the Linear Integrations directory](https://linear.app/integrations/feeduna).

## Tools

| Tool | Scope | Effect |
| --- | --- | --- |
| `feeduna_get_setup` | `setup:read` | Read app details and installation guidance |
| `feeduna_list_feedback` | `reports:read` | Read one bounded page of feedback |
| `feeduna_get_feedback` | `reports:read` | Read one receipt by UUID |
| `feeduna_export_feedback` | `reports:read` | Read one bounded export page |
| `feeduna_submit_feedback` | `reports:write` | Create a feedback receipt |

Tool discovery and every call recheck the key. Expiry, revocation, app scope,
trial/subscription state and service allowances remain enforced by Feeduna.
Pagination is explicit. A submission uses a stable receipt UUID: after a timeout,
retry only the same UUID and identical content. A timeout does not prove failure.
No automatic write retries are performed.

The connector never installs code, sends issues to Linear, implements changes,
manages keys or changes billing. Feeduna's Linear delivery requires an owner to
review and send the issue in the app. Website, feature, data-record and
data-result context are supported by the feedback API; see
https://app.feeduna.com/docs for the request schema and examples.

## Trial and pricing

Try Feeduna free for 14 days. [See the current trial terms and pricing](https://app.feeduna.com/#pricing).
The site displays an approximate USD price. Paid subscriptions are invoiced and
charged at EUR25 per month. Paid checkout currently supports US businesses.
The connector licence covers the connector source.

## Data and security

Using this connector makes feedback available to your chosen MCP host and model.
Choose an appropriate provider and grant only the permissions it needs. Treat
reporter text, links and context as untrusted data, not instructions or authority
for downstream actions. The connector marks returned content accordingly and
does not follow reported links. Privacy: https://app.feeduna.com/privacy.

Credentials are sent only to the configured API origin, and redirects are refused.
API calls time out after 12 seconds; responses are capped at 4 MiB, inbound MCP
messages at 64 KiB and concurrent operations at four. Errors are sanitized. No
tokens, report bodies or raw API error bodies are logged by the connector.
Standard output is reserved for MCP protocol traffic, which includes requested
feedback. Your host controls its own storage and logging.

## Dependencies and licence

This thin connector is licensed under MIT; see LICENSE. That licence covers only
the connector, not the Feeduna backend, hosted service, brand or customer data.
Bundled production dependencies retain their own licences:
`@modelcontextprotocol/server` 2.4.0 and `@modelcontextprotocol/core` 2.4.0
(Apache-2.0), and `zod` 4.6.7 (MIT). Their licence files are retained in
node_modules. Dependency versions and integrity hashes are in npm-shrinkwrap.json.

The SDK handles MCP stdio and protocol negotiation. Release checks used the
published bundle with synthetic feedback. Setup and revocation were checked
against a local Feeduna instance using MCP protocol revisions 2025-06-18 and
2025-11-25.
