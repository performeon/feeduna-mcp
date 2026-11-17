#!/usr/bin/env node
import { serveStdio, StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { FeedunaApi, readConfiguration } from './api.mjs';
import { createFeedunaServer } from './server.mjs';

try {
  const api = new FeedunaApi(readConfiguration());
  const handle = serveStdio(() => createFeedunaServer(api), {
    transport: new StdioServerTransport(process.stdin, process.stdout, { maxBufferSize: 65536 }),
    onerror: () => { process.stderr.write('Feeduna MCP transport error.\n'); },
  });
  const close = () => { void handle.close(); };
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
} catch {
  process.stderr.write('Feeduna MCP configuration is invalid. Check FEEDUNA_API_URL and FEEDUNA_API_TOKEN.\n');
  process.exitCode = 1;
}
