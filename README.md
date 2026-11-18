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

In Claude Desktop, go to **Settings → Desktop app**, select **Manage** next to
**Extensions**, then open **Advanced settings → Install Extension…** and select
the `.mcpb` file. The app includes a Node.js runtime. See
[Claude's desktop extension guide](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop).

Never put the key in source control, a prompt, a URL or shared configuration.
Revoke it in Feeduna when you no longer need the integration. This bundle fixes
the API destination to https://app.feeduna.com. No API key is included.

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

Feeduna offers an open 14-day trial without a card or automatic charge. The site
displays an approximate USD price; the paid subscription is invoiced and charged
at EUR25 per month. Paid checkout currently supports US businesses. Connector
source licensing does not grant a Feeduna subscription or waive service terms.

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

The SDK handles MCP stdio and protocol negotiation. This release candidate was
checked with a synthetic local API fixture; that is not evidence of installation
in a particular customer MCP host. See the publisher's release evidence for
exact validation scope.
