import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { config } from './config.js';
import { Semaphore } from './semaphore.js';
import { renderOverview } from './render.js';

const sem = new Semaphore(config.claude.concurrency);
const cache = new Map(); // key -> { html, sources, at }
const inflight = new Map(); // key -> Promise

const SCHEMA = {
  type: 'object',
  properties: {
    answer: { type: 'string', description: 'Markdown answer with bracketed numeric citations like [1].' },
    sources: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          title: { type: 'string' },
          url: { type: 'string' },
        },
        required: ['id', 'title', 'url'],
      },
    },
  },
  required: ['answer', 'sources'],
};

function systemPrompt() {
  const today = new Date().toISOString().slice(0, 10);
  return [
    'You write the "AI Overview" block shown at the top of a personal search results page.',
    'The user message is a raw web search query. Research it with WebSearch, and WebFetch a page when the snippets are not enough, then answer.',
    `Today's date is ${today}. Prefer recent, primary, and authoritative sources.`,
    'Style: direct and dense. Lead with the answer. 60-200 words of markdown for simple queries, up to 350 for genuinely complex ones. Short paragraphs or tight bullet lists. No preamble, no "here is an overview", no closing offer.',
    'If the query is ambiguous, cover the one or two most likely meanings briefly. If it is navigational (a site or brand name), say what it is in one line and stop.',
    'Cite claims inline with bracketed numbers like [1] or [2][3] that refer to entries in the sources array. Every source in the array must be cited at least once. Put sources only in the sources array, never as a list in the answer text.',
    'Never mention that you are an AI overview generator or that you searched the web.',
  ].join('\n');
}

function key(q) {
  return q.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function cacheStats() {
  return { entries: cache.size, inflight: inflight.size };
}

export async function getOverview(q) {
  const k = key(q);
  const ttl = config.claude.cacheTtlS * 1000;
  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < ttl) return { ...hit, cached: true };
  if (inflight.has(k)) return inflight.get(k);

  const p = sem.run(() => runClaude(q)).then((res) => {
    const entry = { ...res, at: Date.now() };
    if (ttl > 0) cache.set(k, entry);
    return { ...entry, cached: false };
  }).finally(() => inflight.delete(k));
  inflight.set(k, p);
  return p;
}

function runClaude(q) {
  const started = Date.now();
  const workDir = path.join(config.dataDir, 'work');
  fs.mkdirSync(workDir, { recursive: true });
  const args = [
    '-p', `Search query: ${q}`,
    '--output-format', 'json',
    '--json-schema', JSON.stringify(SCHEMA),
    '--model', config.claude.model,
    '--max-turns', String(config.claude.maxTurns),
    '--allowedTools', 'WebSearch,WebFetch',
    '--disallowedTools', 'Bash,Edit,Write,MultiEdit,NotebookEdit,Read,Glob,Grep,Agent,Task,TodoWrite,AskUserQuestion',
    '--append-system-prompt', systemPrompt(),
    '--no-session-persistence',
  ];
  const env = {
    ...process.env,
    DISABLE_AUTOUPDATER: '1',
    DISABLE_TELEMETRY: '1',
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
    CLAUDE_CONFIG_DIR: process.env.CLAUDE_CONFIG_DIR || path.join(config.dataDir, 'claude'),
  };

  return new Promise((resolve, reject) => {
    const child = spawn(config.claude.bin, args, { cwd: workDir, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 5000).unref();
    }, config.claude.timeoutMs);
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) return reject(new Error(`Claude timed out after ${config.claude.timeoutMs} ms`));
      let data;
      try {
        data = JSON.parse(out.trim().split('\n').filter(Boolean).pop() || '{}');
      } catch {
        return reject(new Error(`Claude returned non-JSON (exit ${code}): ${(err || out).slice(0, 500)}`));
      }
      if (code !== 0 || data.is_error) {
        return reject(new Error(`Claude failed (exit ${code}): ${data.result || err.slice(0, 500) || 'unknown error'}`));
      }
      let answer;
      let sources;
      if (data.structured_output && typeof data.structured_output.answer === 'string') {
        answer = data.structured_output.answer;
        sources = Array.isArray(data.structured_output.sources) ? data.structured_output.sources : [];
      } else if (typeof data.result === 'string') {
        answer = data.result;
        sources = [];
      } else {
        return reject(new Error('Claude returned no answer'));
      }
      const html = renderOverview(answer, sources);
      resolve({
        html,
        sources,
        ms: Date.now() - started,
        cost: data.total_cost_usd ?? null,
        turns: data.num_turns ?? null,
        model: config.claude.model,
      });
    });
  });
}
