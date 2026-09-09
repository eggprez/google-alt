import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import readline from 'node:readline';
import path from 'node:path';
import fs from 'node:fs';
import { config } from './config.js';
import { Semaphore } from './semaphore.js';
import { renderAnswer, renderBlock, renderSourceList, splitSources, parseVerification, citedSources, hostOf } from './render.js';

const sem = new Semaphore(config.claude.concurrency);
const cache = new Map(); // key -> { ...result, at }
const runs = new Map(); // key -> OverviewRun (in flight)
const contexts = new Map(); // key -> { results, at } top Google results captured by /search
// The finished answer for a query, kept so follow-up questions have something to build on even
// when the result cache is disabled (OVERVIEW_CACHE_TTL_S=0) or has expired.
const answers = new Map(); // key -> { answer, sources, at }
const CONTEXT_TTL_MS = 15 * 60 * 1000;
const SNAPSHOT_MS = 150;

const NO_TOOLS = ['Bash', 'Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'Read', 'Glob', 'Grep', 'Agent', 'Task', 'TodoWrite', 'AskUserQuestion'];
const WEB_TOOLS = ['WebSearch', 'WebFetch'];

const STYLE = [
  'Write the answer as a shape the eye can scan, not a wall of prose.',
  'Open with one short sentence that answers the query outright. That line is displayed larger than the rest, so make it stand alone.',
  'After it, prefer structure to paragraphs. Use whatever fits the question:',
  '- a bullet list for parts, causes, options or key facts;',
  '- "**Label:** value" bullets for specs, dates, prices, measurements and other lookups;',
  '- a markdown table of two or three columns whenever two or more things are being compared;',
  '- a numbered list for anything sequential or procedural;',
  '- "### Short heading" over each group once the answer has more than one part;',
  '- "> " for a caveat, exception or warning that matters.',
  'Never write three sentences in a row without structure around them, and never use a bullet list of one item.',
  'Length: 60-200 words for a simple query, up to 350 for a genuinely complex one. No preamble, no "here is an overview", no closing offer.',
  'If the query is ambiguous, cover the one or two most likely meanings briefly. If it is navigational (a site or brand name), say what it is in one line and stop.',
  'Never mention that you are an AI overview generator, that you searched the web, or that you were given search results.',
].join('\n');

const today = () => new Date().toISOString().slice(0, 10);

function quickSystem() {
  return [
    'You write the "AI Overview" block shown at the top of a personal search results page.',
    'The user message is a raw web search query followed by the top web results for it (number, title, URL, snippet). Answer from those results only; you have no tools.',
    `Today's date is ${today()}.`,
    STYLE,
    'Cite claims inline with the bracketed result numbers, like [1] or [2][3]. Cite only results you actually relied on. Do not add a sources list; the numbers are enough.',
    'If the results do not settle the question, give the best answer they support and say in one short clause what remains unclear.',
  ].join('\n');
}

function searchSystem() {
  return [
    'You write the "AI Overview" block shown at the top of a personal search results page.',
    'The user message is a raw web search query. Research it with WebSearch, and WebFetch a page when the snippets are not enough, then answer.',
    `Today's date is ${today()}. Prefer recent, primary, and authoritative sources.`,
    STYLE,
    'Cite claims inline with bracketed numbers like [1] or [2][3]. After the answer, add a line "Sources:" followed by one line per source in the form "[n] Title — URL". Every source must be cited at least once.',
  ].join('\n');
}

function verifySystem() {
  return [
    'You fact-check an "AI Overview" that was written only from search-result snippets, and you fix it in place.',
    'The user message has the search query, the overview, and the sources it cited. Use WebSearch (and WebFetch when you need the page itself) to check every factual claim against current, primary, authoritative sources.',
    `Today's date is ${today()}. Treat outdated figures, prices, versions, dates, and office holders as errors.`,
    'You always return the overview itself, rewritten — never a note about it. Reply in exactly this layout and nothing else:',
    'STATUS: verified',
    '(when every claim held; the ANSWER below is then the same overview, possibly with wording tightened)',
    'or',
    'STATUS: corrected',
    'CHANGES:',
    '- one line per problem: what the overview said, and what is actually the case',
    'ANSWER:',
    'the complete overview as it should now read, with every fix already applied. Wrap each span you changed or added in double braces, like {{the corrected wording}}, so the reader can see what the check touched. Wrap only the words that actually changed, never a whole unchanged paragraph, and leave the braces out entirely when STATUS is verified. Keep bracketed citations like [1]. ' + STYLE,
    'Sources:',
    '[1] Title — URL',
    '(one line per source cited in ANSWER; use the sources you verified against)',
  ].join('\n');
}

function followupSystem(sourceCount) {
  return [
    'You answer a follow-up question about an "AI Overview" you already wrote on a personal search results page.',
    'The user message has the original search query, the overview you wrote, any earlier follow-ups, and the numbered sources behind it.',
    `Today's date is ${today()}.`,
    'Answer only the follow-up question. Do not repeat the overview, do not re-introduce the topic, and do not offer to help further.',
    'Use WebSearch or WebFetch when the sources you already have do not settle the question.',
    STYLE.replace('Length: 60-200 words for a simple query, up to 350 for a genuinely complex one.', 'Length: 30-150 words. Answer the question and stop.'),
    `Cite with bracketed numbers. Sources [1]-[${sourceCount || 1}] are the ones already listed; reuse those numbers for them.`,
    `If you rely on something new, add a trailing "Sources:" list numbering the new ones from [${(sourceCount || 0) + 1}] upward, one per line as "[n] Title — URL". Do not relist the sources you were given.`,
  ].join('\n');
}

function quickUser(q, results) {
  const list = results.map((r, i) => `[${i + 1}] ${r.title}\n${r.display || r.url}\n${r.snippet || '(no snippet)'}`).join('\n\n');
  return `Search query: ${q}\n\nTop results:\n\n${list}`;
}

function verifyUser(q, answer, sources) {
  const cited = new Set(Array.from(answer.matchAll(/\[(\d{1,3})\]/g), (m) => Number(m[1])));
  const list = sources.filter((s) => cited.has(Number(s.id))).map((s) => `[${s.id}] ${s.title} — ${s.host ? `${s.host} (${s.url})` : s.url}`).join('\n');
  return `Search query: ${q}\n\nOverview to verify:\n${answer}\n\nSources it cited:\n${list || '(none)'}`;
}

function key(q) {
  return q.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function claudeAuthStatus() {
  if (process.env.CLAUDE_CODE_OAUTH_TOKEN) return { loggedIn: true, via: 'CLAUDE_CODE_OAUTH_TOKEN' };
  if (process.env.ANTHROPIC_API_KEY) return { loggedIn: true, via: 'ANTHROPIC_API_KEY' };
  const dir = process.env.CLAUDE_CONFIG_DIR || path.join(config.dataDir, 'claude');
  if (fs.existsSync(path.join(dir, '.credentials.json'))) return { loggedIn: true, via: 'claude login' };
  return { loggedIn: false, via: null, hint: 'docker exec -it google-alt claude' };
}

export function cacheStats() {
  return { entries: cache.size, inflight: runs.size, contexts: contexts.size, answers: answers.size };
}

function rememberAnswer(q, answer, sources) {
  const now = Date.now();
  const ttl = config.claude.followupTtlS * 1000;
  for (const [k, a] of answers) if (now - a.at > ttl) answers.delete(k);
  answers.set(key(q), { answer, sources, at: now });
}

/** Keep the top results of a proxied page so the overview can be drafted from them. */
export function rememberResults(q, results) {
  if (!Array.isArray(results) || !results.length) return;
  const now = Date.now();
  for (const [k, c] of contexts) if (now - c.at > CONTEXT_TTL_MS) contexts.delete(k);
  contexts.set(key(q), { results: results.slice(0, 8), at: now });
}

function takeResults(q) {
  const c = contexts.get(key(q));
  if (!c || Date.now() - c.at > CONTEXT_TTL_MS) return null;
  return c.results;
}

/**
 * One overview generation. Emits:
 *   status(text)      what Claude is doing right now
 *   sources({sources}) the candidate sources, as soon as they are known
 *   snapshot(html)    the answer so far, while it streams
 *   quick({html})     the snippet-based draft is complete (the fact-check continues)
 *   check({html,verification}) the fact-check rewrote the answer in place
 *   done(result)      final result
 *   fail(error)
 */
class OverviewRun extends EventEmitter {
  constructor(q) {
    super();
    this.setMaxListeners(100);
    this.q = q;
    this.started = Date.now();
    this.phase = 'Queued';
    this.html = '';
    this.quickHtml = '';
    this.sources = [];
    this.checked = null;
    this.done = false;
    this.result = null;
    this.error = null;
    this.promise = new Promise((resolve, reject) => { this._resolve = resolve; this._reject = reject; });
    this.promise.catch(() => {});
    this._snap = null;
    this._snapTimer = null;
  }

  setPhase(text) { this.phase = text; this.emit('status', text); }

  scheduleSnapshot(render) {
    this._snap = render;
    if (this._snapTimer) return;
    this._snapTimer = setTimeout(() => { this._snapTimer = null; this.flushSnapshot(); }, SNAPSHOT_MS);
  }

  flushSnapshot() {
    if (this._snapTimer) { clearTimeout(this._snapTimer); this._snapTimer = null; }
    if (!this._snap) return;
    const render = this._snap;
    this._snap = null;
    this.html = render();
    this.emit('snapshot', this.html);
  }

  setQuick(html) { this.quickHtml = html; this.html = html; this.emit('quick', { html }); }

  setSources(sources) { this.sources = sources; this.emit('sources', { sources }); }

  setChecked(html, verification) {
    this.checked = { html, verification };
    this.html = html;
    this.emit('check', { html, verification });
  }

  finish(result) {
    this.flushSnapshot();
    this.done = true;
    this.result = result;
    this._resolve(result);
    this.emit('done', result);
  }

  fail(err) {
    if (this._snapTimer) { clearTimeout(this._snapTimer); this._snapTimer = null; }
    this.done = true;
    this.error = err;
    this._reject(err);
    this.emit('fail', err);
  }
}

/** Return a cached result or the (possibly shared) in-flight run for this query. */
export function startOverview(q, { refresh = false } = {}) {
  const k = key(q);
  const ttl = config.claude.cacheTtlS * 1000;
  // Only drop the cached answer if we are actually going to write a new one. A run already in
  // flight is as fresh as a restart would be, so a refresh joins it instead of discarding a
  // good entry and getting the same answer back.
  if (refresh && !runs.has(k)) cache.delete(k);
  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < ttl) return { cached: true, result: { ...hit, cached: true } };
  let run = runs.get(k);
  if (!run) {
    run = new OverviewRun(q);
    runs.set(k, run);
    sem.run(() => execute(run))
      .then((res) => {
        rememberAnswer(q, res.answer, res.sources);
        if (ttl > 0) cache.set(k, { ...res, at: Date.now() });
        run.finish(res);
      })
      .catch((e) => run.fail(e))
      .finally(() => runs.delete(k));
  }
  return { run };
}

export async function getOverview(q) {
  const r = startOverview(q);
  if (r.cached) return r.result;
  return { ...(await r.run.promise), cached: false };
}

// While streaming, drop the trailing source list and a half-typed "Sources:" line.
const streamRenderer = (text) => () => {
  let { answer } = splitSources(text);
  answer = answer.replace(/\n[ \t]*(?:#{1,6}[ \t]*)?[*_]{0,2}(?:s|so|sou|sour|sourc|source|sources)[*_]{0,2}:?[ \t]*$/i, '');
  return renderAnswer(answer, [], { streaming: true });
};

async function execute(run) {
  const started = Date.now();
  const results = takeResults(run.q);
  let cost = 0;
  let turns = 0;
  let answer;
  let sources;
  let verification = null;
  let mode;

  if (results && results.length) {
    // Stage 1: draft from the results Google already returned (fast, no tools).
    mode = 'quick';
    run.setPhase('Reading top results');
    sources = results.map((r, i) => ({ id: i + 1, title: r.title, url: r.url, host: r.host || hostOf(r.url) }));
    run.setSources(sources);
    const r1 = await runClaude({
      prompt: quickUser(run.q, results),
      system: quickSystem(),
      tools: [],
      maxTurns: 1,
      timeoutMs: config.claude.quickTimeoutMs,
      onStatus: (t) => run.setPhase(t),
      onText: (text) => run.scheduleSnapshot(streamRenderer(text)),
    });
    cost += r1.cost || 0;
    turns += r1.turns || 0;
    answer = splitSources(r1.text).answer;
    run.flushSnapshot();
    run.setQuick(renderBlock(answer, sources, null));

    // Stage 2: check it against the live web. The check rewrites the overview rather than
    // appending a note to it; the spans it changed come back wrapped in {{ }} and are shown
    // in a different colour.
    if (config.claude.verify) {
      mode = 'quick+verify';
      run.setPhase('Checking against the web');
      try {
        const r2 = await runClaude({
          prompt: verifyUser(run.q, answer, sources),
          system: verifySystem(),
          tools: WEB_TOOLS,
          maxTurns: config.claude.maxTurns,
          timeoutMs: config.claude.timeoutMs,
          onStatus: (t) => run.setPhase(t === 'Writing' ? 'Rewriting' : `Checking · ${t}`),
        });
        cost += r2.cost || 0;
        turns += r2.turns || 0;
        const v = parseVerification(r2.text);
        if (v.answer) {
          answer = v.answer;
          if (v.sources.length) sources = mergeSources(sources, v.sources);
        }
        verification = { status: v.status, changes: v.changes };
        run.setChecked(renderBlock(answer, sources, verification), verification);
      } catch (e) {
        verification = { status: 'failed', error: e.message };
        run.setChecked(renderBlock(answer, sources, verification), verification);
      }
    }
  } else {
    // No captured results (page served before a restart, or direct API call): research from scratch.
    mode = 'search';
    run.setPhase('Searching');
    const r = await runClaude({
      prompt: `Search query: ${run.q}`,
      system: searchSystem(),
      tools: WEB_TOOLS,
      maxTurns: config.claude.maxTurns,
      timeoutMs: config.claude.timeoutMs,
      onStatus: (t) => run.setPhase(t),
      onText: (text) => run.scheduleSnapshot(streamRenderer(text)),
    });
    cost += r.cost || 0;
    turns += r.turns || 0;
    ({ answer, sources } = splitSources(r.text));
    run.flushSnapshot();
    run.setSources(sources);
  }

  const cited = citedSources(answer, sources);
  return {
    html: renderBlock(answer, sources, verification),
    answer,
    sources: cited.length ? cited : sources,
    verification,
    mode,
    ms: Date.now() - started,
    cost,
    turns,
    model: config.claude.model,
  };
}

/** Later source lists reuse the same numbers; keep the first title/URL seen for each. */
function mergeSources(base, extra) {
  const byId = new Map();
  for (const s of [...(base || []), ...(extra || [])]) {
    const id = Number(s.id);
    if (!Number.isFinite(id) || !s.url) continue;
    if (!byId.has(id)) byId.set(id, { id, title: s.title || hostOf(s.url), url: s.url, host: s.host || hostOf(s.url) });
  }
  return Array.from(byId.values()).sort((a, b) => a.id - b.id);
}

/**
 * Answer a follow-up question about a finished overview, reusing its sources. Streams the same
 * way the overview does; resolves { html, answer, sources }.
 */
export async function runFollowup({ q, question, history = [], onStatus = () => {}, onSnapshot = () => {} }) {
  const base = answers.get(key(q));
  if (!base || !base.answer || Date.now() - base.at > config.claude.followupTtlS * 1000) {
    const err = new Error('That overview has expired. Reload the page to write a new one, then ask again.');
    err.status = 409;
    throw err;
  }
  const sources = base.sources || [];
  const nextId = sources.reduce((m, s) => Math.max(m, Number(s.id) || 0), 0);
  const lines = [
    `Original search query: ${q}`,
    '',
    'The overview you wrote:',
    base.answer,
    '',
  ];
  if (sources.length) {
    lines.push('Sources behind it:');
    for (const s of sources) lines.push(`[${s.id}] ${s.title} — ${s.host ? `${s.host} (${s.url})` : s.url}`);
    lines.push('');
  }
  for (const turn of history.slice(-3)) {
    lines.push(`Earlier follow-up: ${turn.question}`);
    lines.push(`Your answer: ${String(turn.answer || '').slice(0, 2000)}`);
    lines.push('');
  }
  lines.push(`Follow-up question: ${question}`);
  lines.push('Answer it now.');

  let snapTimer = null;
  let pending = null;
  const flush = () => {
    if (snapTimer) { clearTimeout(snapTimer); snapTimer = null; }
    if (!pending) return;
    const text = pending;
    pending = null;
    onSnapshot(renderAnswer(splitSources(text).answer, sources, { streaming: true }));
  };

  const r = await sem.run(() => runClaude({
    prompt: lines.join('\n'),
    system: followupSystem(nextId),
    tools: WEB_TOOLS,
    maxTurns: config.claude.maxTurns,
    timeoutMs: config.claude.timeoutMs,
    onStatus,
    onText: (text) => {
      pending = text;
      if (!snapTimer) snapTimer = setTimeout(flush, SNAPSHOT_MS);
    },
  }));
  flush();

  const { answer, sources: added } = splitSources(r.text);
  const all = mergeSources(sources, added);
  // Sources the overview already lists stay listed there; only the ones this answer introduced
  // get their own short list under it.
  const known = new Set(sources.map((s) => Number(s.id)));
  const fresh = citedSources(answer, all).filter((s) => !known.has(Number(s.id)));
  base.sources = all;
  base.at = Date.now();
  return {
    html: renderAnswer(answer, all) + renderSourceList(fresh),
    answer,
    sources: all,
    cost: r.cost,
    turns: r.turns,
  };
}

function statusFor(name, input) {
  if (name === 'WebSearch') return `Searching: ${input.query || ''}`.trim();
  if (name === 'WebFetch') return `Reading ${hostOf(input.url || '')}`;
  return `Using ${name}`;
}

/**
 * Run `claude -p` and parse its stream-json output.
 * onText(fullTextSoFar) fires as the current message's text grows; onStatus(text) on tool calls.
 * Resolves { text, cost, turns } with the final answer text.
 */
export function runClaude({ prompt, system, tools, maxTurns, timeoutMs, onStatus = () => {}, onText = () => {} }) {
  const workDir = path.join(config.dataDir, 'work');
  fs.mkdirSync(workDir, { recursive: true });
  const disallowed = tools.length ? NO_TOOLS : [...NO_TOOLS, ...WEB_TOOLS];
  const args = [
    '-p', prompt,
    '--output-format', 'stream-json',
    '--verbose',
    '--include-partial-messages',
    '--model', config.claude.model,
    '--max-turns', String(maxTurns),
    '--disallowedTools', disallowed.join(','),
    '--append-system-prompt', system,
    '--no-session-persistence',
  ];
  if (tools.length) args.push('--allowedTools', tools.join(','));
  const env = {
    ...process.env,
    DISABLE_AUTOUPDATER: '1',
    DISABLE_TELEMETRY: '1',
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
    CLAUDE_CONFIG_DIR: process.env.CLAUDE_CONFIG_DIR || path.join(config.dataDir, 'claude'),
  };

  return new Promise((resolve, reject) => {
    const child = spawn(config.claude.bin, args, { cwd: workDir, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    let raw = '';
    let timedOut = false;
    let text = '';
    let sawPartial = false;
    let writing = false;
    let pendingTool = null;
    let toolJson = '';
    let finalText = null;
    let resultError = null;
    let cost = null;
    let turns = null;
    const announced = new Set();
    const announce = (id, name, input) => {
      if (id && announced.has(id)) return;
      if (id) announced.add(id);
      writing = false;
      onStatus(statusFor(name, input || {}));
    };
    const grow = (t) => {
      text = t;
      if (!writing) { writing = true; onStatus('Writing'); }
      onText(text);
    };

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 5000).unref();
    }, timeoutMs);

    const rl = readline.createInterface({ input: child.stdout });
    rl.on('line', (line) => {
      line = line.trim();
      if (!line) return;
      if (raw.length < 4000) raw += line.slice(0, 500) + '\n';
      let ev;
      try { ev = JSON.parse(line); } catch { return; }
      if (ev.type === 'stream_event' && ev.event) {
        const e = ev.event;
        sawPartial = true;
        if (e.type === 'message_start') {
          text = '';
        } else if (e.type === 'content_block_start') {
          const b = e.content_block || {};
          pendingTool = b.type === 'tool_use' ? { id: b.id, name: b.name } : null;
          toolJson = '';
        } else if (e.type === 'content_block_delta') {
          const d = e.delta || {};
          if (d.type === 'text_delta') grow(text + (d.text || ''));
          else if (d.type === 'input_json_delta') toolJson += d.partial_json || '';
        } else if (e.type === 'content_block_stop' && pendingTool) {
          let input = {};
          try { input = JSON.parse(toolJson); } catch { /* partial */ }
          announce(pendingTool.id, pendingTool.name, input);
          pendingTool = null;
        }
      } else if (ev.type === 'assistant' && ev.message) {
        const blocks = Array.isArray(ev.message.content) ? ev.message.content : [];
        for (const b of blocks) if (b.type === 'tool_use') announce(b.id, b.name, b.input);
        if (!sawPartial) {
          const t = blocks.filter((b) => b.type === 'text').map((b) => b.text || '').join('');
          if (t) grow(t);
        }
      } else if (ev.type === 'result') {
        if (typeof ev.result === 'string' && ev.result.trim()) finalText = ev.result;
        cost = ev.total_cost_usd ?? null;
        turns = ev.num_turns ?? null;
        if (ev.is_error) resultError = ev.result || ev.error || `result subtype ${ev.subtype || 'error'}`;
      }
    });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) return reject(new Error(`Claude timed out after ${timeoutMs} ms`));
      if (resultError) return reject(new Error(`Claude failed: ${String(resultError).slice(0, 500)}`));
      if (code !== 0) return reject(new Error(`Claude failed (exit ${code}): ${(err || raw).slice(0, 500) || 'unknown error'}`));
      const out = finalText ?? text;
      if (!out || !out.trim()) return reject(new Error(`Claude returned no answer: ${(err || raw).slice(0, 300)}`));
      resolve({ text: out, cost, turns });
    });
  });
}
