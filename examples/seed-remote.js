"use strict";
/**
 * SEED REMOTO — popula um Spiral Ledger EM PRODUÇÃO via API HTTPS.
 * Diferente do quickstart (que grava em arquivo local), este alimenta o Ledger
 * que já está no ar, para o Vision ter dados reais para medir.
 *
 * Uso:
 *   LEDGER_URL=https://ledger.spiralwealth.com.br \
 *   LEDGER_TOKEN=seu_token \
 *   node examples/seed-remote.js [quantidade]
 *
 * Gera decisões pareadas (DISPATCHED -> EXECUTED/FAILED) com idempotency_key e
 * target — o formato que o motor M1-M9 do Vision precisa para calcular latência,
 * variabilidade, falhas e diversidade.
 */
const https = require("https");
const http = require("http");

const BASE = (process.env.LEDGER_URL || "http://127.0.0.1:4700").replace(/\/$/, "");
const TOKEN = process.env.LEDGER_TOKEN || null;
const N = parseInt(process.argv[2] || "40", 10);

function post(pathname, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(BASE + pathname);
    const lib = u.protocol === "https:" ? https : http;
    const payload = JSON.stringify(body);
    const req = lib.request({
      hostname: u.hostname, port: u.port || (u.protocol === "https:" ? 443 : 80),
      path: u.pathname, method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload),
        ...(TOKEN ? { Authorization: "Bearer " + TOKEN } : {}) }
    }, res => { let d = ""; res.on("data", c => d += c); res.on("end", () =>
      res.statusCode < 300 ? resolve(JSON.parse(d || "{}")) : reject(new Error("HTTP " + res.statusCode + ": " + d))); });
    req.on("error", reject); req.write(payload); req.end();
  });
}

const TARGETS = ["gmail", "telegram", "linkedin"];
const ACTORS = ["cfo@empresa.com", "coo@empresa.com", "diretoria@empresa.com"];

(async () => {
  console.log(`Semeando ${N} decisões em ${BASE} ...`);
  let ok = 0, fail = 0;
  for (let i = 0; i < N; i++) {
    const target = TARGETS[i % TARGETS.length];
    const key = "seed-" + Date.now() + "-" + i;
    const decision_id = "DEC-" + String(i).padStart(4, "0");
    try {
      // 1. a decisão é despachada (nasce)
      await post("/v1/records", { decision_id, state: "DISPATCHED",
        idempotency_key: key, target, actor: ACTORS[i % ACTORS.length],
        why: "decisão operacional " + i, payload: { idempotency_key: key, target, state: "DISPATCHED" } });
      // 2. a decisão se concretiza (ou falha) — dá latência ao Vision
      const executed = i % 11 !== 0;
      await post("/v1/records", { decision_id, state: executed ? "EXECUTED" : "FAILED",
        idempotency_key: key, target,
        payload: { idempotency_key: key, target, state: executed ? "EXECUTED" : "FAILED" } });
      ok++;
    } catch (e) { fail++; if (fail <= 3) console.error("  falha:", e.message); }
  }
  console.log(`Concluído: ${ok} decisões registradas, ${fail} falhas.`);
  console.log(`O Vision (modo Live) agora tem dados para medir. Recarregue o painel.`);
})();
