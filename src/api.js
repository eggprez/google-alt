import { startOverview } from './overview.js';

const log = (...a) => console.log(new Date().toISOString(), ...a);

const publicResult = (r, cached) => ({
  html: r.html, sources: r.sources, verification: r.verification ?? null, mode: r.mode, ms: r.ms, cached, cost: r.cost, model: r.model,
});

/** GET /api/overview?q= — JSON when complete. Add &stream=1 for server-sent events while it runs. */
export function overviewHandler(req, res) {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!q) return res.status(400).json({ error: 'missing q' });
  if (req.query.stream === '1') return overviewStream(q, req, res);
  return overviewJson(q, req, res);
}

async function overviewJson(q, req, res) {
  const t0 = Date.now();
  try {
    const r = startOverview(q);
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
 * Events: status {text}, snapshot {html}, quick {html}, done {…result}, fail {error}.
 * X-Accel-Buffering tells nginx not to buffer even when proxy_buffering is on.
 */
function overviewStream(q, req, res) {
  res.set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'private, no-store',
    'X-Accel-Buffering': 'no',
    Connection: 'keep-alive',
  });
  res.flushHeaders();
  const send = (event, data) => { if (!res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); };
  const t0 = Date.now();

  const r = startOverview(q);
  if (r.cached) {
    log(`overview "${q}" cached`);
    send('done', publicResult(r.result, true));
    return res.end();
  }
  const run = r.run;
  const ping = setInterval(() => { if (!res.writableEnded) res.write(': ping\n\n'); }, 15000);
  const onStatus = (text) => send('status', { text });
  const onSnapshot = (html) => send('snapshot', { html });
  const onQuick = (d) => send('quick', d);
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
    run.off('snapshot', onSnapshot);
    run.off('quick', onQuick);
    run.off('done', onDone);
    run.off('fail', onFail);
  }

  if (run.done) {
    if (run.result) return onDone(run.result);
    return onFail(run.error || new Error('overview failed'));
  }
  // Replay current state for clients joining an in-flight run.
  send('status', { text: run.phase });
  if (run.quickHtml) send('quick', { html: run.quickHtml });
  else if (run.html) send('snapshot', { html: run.html });
  run.on('status', onStatus);
  run.on('snapshot', onSnapshot);
  run.on('quick', onQuick);
  run.once('done', onDone);
  run.once('fail', onFail);
  req.on('close', cleanup);
}
