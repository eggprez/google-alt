import { startOverview, runFollowup } from './overview.js';

const log = (...a) => console.log(new Date().toISOString(), ...a);

const publicResult = (r, cached) => ({
  html: r.html,
  sources: r.sources ?? [],
  verification: r.verification ?? null,
  mode: r.mode,
  ms: r.ms,
  cached,
  cost: r.cost,
  model: r.model,
});

const sseHeaders = (res) => {
  // X-Accel-Buffering tells nginx not to buffer even when proxy_buffering is on.
  res.set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'private, no-store',
    'X-Accel-Buffering': 'no',
    Connection: 'keep-alive',
  });
  res.flushHeaders();
};

/** GET /api/overview?q= — JSON when complete. Add &stream=1 for server-sent events while it runs. */
export function overviewHandler(req, res) {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!q) return res.status(400).json({ error: 'missing q' });
  const refresh = req.query.refresh === '1';
  if (req.query.stream === '1') return overviewStream(q, refresh, req, res);
  return overviewJson(q, refresh, req, res);
}

async function overviewJson(q, refresh, req, res) {
  const t0 = Date.now();
  try {
    const r = startOverview(q, { refresh });
    const result = r.cached ? r.result : { ...(await r.run.promise), cached: false };
    log(`overview "${q}" ${Date.now() - t0}ms cached=${result.cached} mode=${result.mode} verify=${result.verification?.status ?? '-'} cost=${result.cost ?? '?'}`);
    res.set('Cache-Control', 'private, no-store');
    res.json(publicResult(result, result.cached));
  } catch (e) {
    log('overview error', e.message);
    res.status(502).json({ error: e.message });
  }
}

/**
 * Events: status {text}, sources {sources}, snapshot {html}, quick {html},
 * check {html, verification}, done {…result}, fail {error}.
 */
function overviewStream(q, refresh, req, res) {
  sseHeaders(res);
  const send = (event, data) => { if (!res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); };
  const t0 = Date.now();

  const r = startOverview(q, { refresh });
  if (r.cached) {
    log(`overview "${q}" cached`);
    send('done', publicResult(r.result, true));
    return res.end();
  }
  const run = r.run;
  const ping = setInterval(() => { if (!res.writableEnded) res.write(': ping\n\n'); }, 15000);
  const onStatus = (text) => send('status', { text });
  const onSources = (d) => send('sources', d);
  const onSnapshot = (html) => send('snapshot', { html });
  const onQuick = (d) => send('quick', d);
  const onCheck = (d) => send('check', d);
  const onDone = (result) => {
    log(`overview "${q}" ${Date.now() - t0}ms mode=${result.mode} verify=${result.verification?.status ?? '-'} cost=${result.cost ?? '?'} turns=${result.turns ?? '?'}`);
    send('done', publicResult(result, false));
    cleanup();
    res.end();
  };
  const onFail = (err) => {
    log('overview error', err.message);
    send('fail', { error: err.message });
    cleanup();
    res.end();
  };
  function cleanup() {
    clearInterval(ping);
    run.off('status', onStatus);
    run.off('sources', onSources);
    run.off('snapshot', onSnapshot);
    run.off('quick', onQuick);
    run.off('check', onCheck);
    run.off('done', onDone);
    run.off('fail', onFail);
  }

  if (run.done) {
    if (run.result) return onDone(run.result);
    return onFail(run.error || new Error('overview failed'));
  }
  // Replay current state for clients joining an in-flight run.
  send('status', { text: run.phase });
  if (run.sources.length) send('sources', { sources: run.sources });
  if (run.checked) send('check', run.checked);
  else if (run.quickHtml) send('quick', { html: run.quickHtml });
  else if (run.html) send('snapshot', { html: run.html });
  run.on('status', onStatus);
  run.on('sources', onSources);
  run.on('snapshot', onSnapshot);
  run.on('quick', onQuick);
  run.on('check', onCheck);
  run.once('done', onDone);
  run.once('fail', onFail);
  res.on('close', cleanup);
}

/**
 * POST /api/followup {q, question, history:[{question,answer}]}
 * Streams status/snapshot/done/fail as server-sent events, like the overview.
 */
export async function followupHandler(req, res) {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const q = typeof body.q === 'string' ? body.q.trim() : '';
  const question = typeof body.question === 'string' ? body.question.trim().slice(0, 500) : '';
  if (!q || !question) return res.status(400).json({ error: 'missing q or question' });
  const history = Array.isArray(body.history)
    ? body.history
      .filter((h) => h && typeof h.question === 'string' && typeof h.answer === 'string')
      .map((h) => ({ question: h.question.slice(0, 500), answer: h.answer.slice(0, 4000) }))
      .slice(-3)
    : [];

  const t0 = Date.now();
  let open = true;
  // Note: req 'close' fires as soon as the request body has been read (immediately, for a POST).
  // The response's 'close' is the one that means the client actually went away.
  res.on('close', () => { open = false; });
  const send = (event, data) => { if (open && !res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); };
  try {
    sseHeaders(res);
    send('status', { text: 'Thinking' });
    const ping = setInterval(() => { if (open && !res.writableEnded) res.write(': ping\n\n'); }, 15000);
    try {
      const r = await runFollowup({
        q,
        question,
        history,
        onStatus: (text) => send('status', { text }),
        onSnapshot: (html) => send('snapshot', { html }),
      });
      log(`followup "${q}" :: "${question}" ${Date.now() - t0}ms cost=${r.cost ?? '?'}`);
      send('done', { html: r.html, answer: r.answer, sources: r.sources });
    } finally {
      clearInterval(ping);
    }
  } catch (e) {
    log('followup error', e.message);
    if (!res.headersSent) return res.status(e.status || 502).json({ error: e.message });
    send('fail', { error: e.message });
  }
  if (!res.writableEnded) res.end();
}
