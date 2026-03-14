# Playwright MCP Server

The **Playwright MCP** (`@playwright/mcp`) exposes browser automation tools to AI assistants (Claude, Copilot, etc.) via the [Model Context Protocol](https://modelcontextprotocol.io).

## What it enables

With Playwright MCP active, Claude can:
- Navigate to any URL and inspect live pages
- Click, fill, and interact with ERP/middleware forms
- Take screenshots of monitoring dashboards
- Run ad-hoc checks during incident investigation
- Generate tests from live application observation

## Integration with Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"],
      "env": {
        "PLAYWRIGHT_HEADLESS": "false"
      }
    }
  }
}
```

## Integration with VS Code (Copilot)

Add to `.vscode/mcp.json` in the project:

```json
{
  "servers": {
    "playwright": {
      "type": "stdio",
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```

## Standalone server (any MCP client)

```bash
# Start MCP server on stdio (default — for Claude Desktop / VS Code)
npx @playwright/mcp@latest

# Start as SSE HTTP server (for web-based MCP clients)
npx @playwright/mcp@latest --port 8931
```

## Example Claude prompts once connected

```
"Navigate to https://erp.example.com/Account/Login and take a screenshot"
"Log in with user monitor_user and check if the dashboard loaded"
"Check the /health endpoint of https://api.example.com and tell me the response"
"Take a screenshot of the current consolidated monitoring report"
```

## Available MCP Tools (provided by @playwright/mcp)

| Tool                   | Description                              |
|------------------------|------------------------------------------|
| `browser_navigate`     | Go to a URL                              |
| `browser_screenshot`   | Take a full-page screenshot              |
| `browser_click`        | Click an element                         |
| `browser_fill`         | Type into an input                       |
| `browser_select_option`| Select dropdown option                   |
| `browser_wait_for`     | Wait for element or URL                  |
| `browser_evaluate`     | Run JavaScript in the page               |
| `browser_network_requests` | Inspect network activity             |
| `browser_close`        | Close the browser                        |
