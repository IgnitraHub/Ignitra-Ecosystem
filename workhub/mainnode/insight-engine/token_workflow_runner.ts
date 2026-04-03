/* Orchestrated token analytics workflow (self-invoking) */
/* Assumes the following are available in your project:
   - TokenActivityAnalyzer
   - TokenDepthAnalyzer
   - detectVolumePatterns
   - ExecutionEngine
   - SigningEngine
*/

(async () => {
  const CONFIG = {
    rpcUrl: "https://solana.rpc",
    dexApiBase: "https://dex.api",
    mint: "MintPubkeyHere",
    market: "MarketPubkeyHere",
    activityLookback: 20,
    depthLookback: 30,
    patternWindow: 5,
    patternThreshold: 100,
  }

  const t0 = Date.now()
  const time = (label, start) => {
    const ms = Date.now() - start
    console.log(`[timing] ${label}: ${ms}ms`)
    return ms
  }

  const summarizePatterns = (events = []) => ({
    count: events.length,
    maxRatio: events.reduce((m, e) => Math.max(m, e?.ratio ?? 0), 0),
  })

  const runSafe = async (label, fn) => {
    const ts = Date.now()
    try {
      const result = await fn()
      time(label, ts)
      return { ok: true, result }
    } catch (err) {
      console.error(`[error] ${label}:`, err?.message || err)
      time(`${label} (failed)`, ts)
      return { ok: false, error: err?.message || String(err) }
    }
  }

  // 1) Analyze activity
  const activityAnalyzer = new TokenActivityAnalyzer(CONFIG.rpcUrl)
  const activityRes = await runSafe("analyzeActivity", async () =>
    activityAnalyzer.analyzeActivity(CONFIG.mint, CONFIG.activityLookback)
  )
  if (!activityRes.ok) return

  const records = Array.isArray(activityRes.result) ? activityRes.result : []
  if (records.length === 0) {
    console.warn("[warn] No activity records found; aborting workflow.")
    return
  }

  // 2) Analyze market depth
  const depthAnalyzer = new TokenDepthAnalyzer(CONFIG.dexApiBase, CONFIG.market)
  const depthRes = await runSafe("analyzeDepth", async () =>
    depthAnalyzer.analyze(CONFIG.depthLookback)
  )
  if (!depthRes.ok) return
  const depthMetrics = depthRes.result

  // 3) Detect volume patterns
  const volumes = records.map(r => r.amount ?? 0).filter(n => Number.isFinite(n))
  const patterns = detectVolumePatterns(volumes, CONFIG.patternWindow, CONFIG.patternThreshold)
  const patternSummary = summarizePatterns(patterns)

  // 4) Execute a custom task via ExecutionEngine
  const engine = new ExecutionEngine()
  engine.register("report", async params => ({ records: params.records.length }))
  engine.enqueue("task1", "report", { records })
  const taskResults = await engine.runAll()

  // 5) Sign and verify results
  const signer = new SigningEngine()
  const payload = JSON.stringify(
    { depthMetrics, patterns, patternSummary, taskResults },
    null,
    2
  )

  const signRes = await runSafe("sign", () => signer.sign(payload))
  if (!signRes.ok) return
  const signature = signRes.result

  const verifyRes = await runSafe("verify", () => signer.verify(payload, signature))
  const signatureValid = !!verifyRes.result

  console.log("[result]", {
    recordsCount: records.length,
    depthMetrics,
    patternSummary,
    taskResults,
    signatureValid,
    totalMs: Date.now() - t0,
  })
})()
