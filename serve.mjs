#!/usr/bin/env node
// Kept so the old command still works:  node serve.mjs <project-folder> [page]
// New:  unide init  (once per project), then your agents start unide by themselves.
import path from 'node:path';
import { start } from './lib/server.mjs';

await start({ root: path.resolve(process.argv[2] || '.'), page: (process.argv[3] || '').replace(/^\/+/, ''), port: +process.env.PORT || undefined });
