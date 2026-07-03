"use strict";
/**
 * SPIRAL LEDGER · API — como sistemas legados (SAP/Oracle/ERP) inserem decisões.
 * Zero dependências. Auth opcional por bearer token (env LEDGER_TOKEN).
 * Contrato v1:
 *   POST /v1/records                 { decision_id, state, actor, why, payload?, signature? } → record
 *   GET  /v1/records/:decision_id    → último estado da decisão (O(1))
 *   GET  /v1/chain/verify            → { intact: bool }
 *   GET  /v1/export                  → AOF completo (auditoria)
 *   GET  /v1/health                  → { ok, seq }
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const Ledger = require("./ledger");
const { verify: verifySig, loadPublicKey } = require("./signing");

const PORT = process.env.PORT || 4700;
const HOST = process.env.HOST || "127.0.0.1"; // seguro por padrão: só local
const VERSION = require("../package.json").version;
const TOKEN = process.env.LEDGER_TOKEN || null;
const FILE = process.env.LEDGER_PATH || path.join(process.cwd(), "data", "ledger.aof");
const PUBKEY = loadPublicKey();
// GATE DE SEGURANÇA: exposto na rede exige token (a menos que explicitamente liberado)
if (HOST !== "127.0.0.1" && HOST !== "localhost" && !TOKEN && process.env.LEDGER_ALLOW_INSECURE !== "1") {
  console.error("[ledger] RECUSADO: exposição em rede (" + HOST + ") sem LEDGER_TOKEN. Defina o token ou LEDGER_ALLOW_INSECURE=1.");
  process.exit(1);
}
// LOCK DE ESCRITOR ÚNICO: duas instâncias no mesmo AOF quebrariam a corrente.
const LOCK = FILE + ".lock";
fs.mkdirSync(path.dirname(FILE), { recursive: true });
try {
  const fd = fs.openSync(LOCK, "wx"); fs.writeSync(fd, String(process.pid)); fs.closeSync(fd);
} catch {
  console.error("[ledger] RECUSADO: outra instância detém " + LOCK + " (escritor único por AOF). Se for lock órfão, remova o arquivo.");
  process.exit(1);
}
const releaseLock = () => { try { fs.unlinkSync(LOCK); } catch {} };
process.on("exit", releaseLock); process.on("SIGINT", () => process.exit(0)); process.on("SIGTERM", () => process.exit(0));
const ledger = new Ledger({ file: FILE });

function send(res, code, obj) { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); }
function unauthorized(req) { return TOKEN && (req.headers.authorization !== "Bearer " + TOKEN); }

const server = http.createServer((req, res) => {
  try {
  const url = new URL(req.url, "http://x");
  // /v1/health é público: plataformas de deploy checam liveness sem credencial
  if (url.pathname === "/v1/health") return send(res, 200, { ok: true, version: VERSION });
  if (unauthorized(req)) return send(res, 401, { error: "token inválido" });

  if (req.method === "POST" && url.pathname === "/v1/records") {
    let body = "";
    req.on("data", c => body += c);
    req.on("end", () => {
      let p; try { p = JSON.parse(body); } catch { return send(res, 400, { error: "JSON inválido" }); }
      if (!p.decision_id || !p.state) return send(res, 422, { error: "decision_id e state são obrigatórios" });
      // assinatura: se o produto estiver provisionado com chave pública, exige e verifica
      if (PUBKEY) {
        if (!p.signature || !verifySig(p.payload || { decision_id: p.decision_id, state: p.state }, p.signature, PUBKEY))
          return send(res, 403, { error: "assinatura ausente ou inválida (não-repúdio ativo)" });
      }
      const rec = ledger.append({
        decision_id: p.decision_id, state: p.state,
        actor: p.actor || null, why: p.why || null,
        idempotency_key: p.idempotency_key || undefined,
        payload: p.payload || undefined, signature: p.signature || undefined,
      });
      send(res, 201, { seq: rec.seq, ts: rec.ts, hash: rec.hash });
    });
    return;
  }
  if (req.method === "GET" && url.pathname.startsWith("/v1/records/")) {
    const id = decodeURIComponent(url.pathname.split("/").pop());
    const latest = ledger.getLatest(id);
    return latest ? send(res, 200, latest) : send(res, 404, { error: "decisão não encontrada" });
  }
  if (url.pathname === "/v1/chain/verify") return send(res, 200, { intact: ledger.verifyChain() });
  if (url.pathname === "/v1/export") {
    res.writeHead(200, { "Content-Type": "application/x-ndjson", "Content-Disposition": "attachment; filename=ledger.aof" });
    return res.end(fs.existsSync(FILE) ? fs.readFileSync(FILE) : "");
  }
  send(res, 404, { error: "rota desconhecida" });
  } catch (err) { try { send(res, 500, { error: "erro interno", detail: String(err.message||err) }); } catch {} }
});
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") { console.error(`\n  [Spiral Ledger] Porta ${PORT} em uso. Use: PORT=4701 npm start\n`); process.exit(1); }
  console.error(`\n  [Spiral Ledger] Falha ao iniciar: ${err.message}\n`); process.exit(1);
});
server.listen(PORT, HOST, () => console.log(`\n  SPIRAL LEDGER · registrando a verdade\n  API: http://${HOST}:${PORT}/v1  ·  v${VERSION}  ·  arquivo: ${FILE}\n  auth: ${TOKEN ? "bearer token ATIVO" : "aberto (defina LEDGER_TOKEN em produção)"}  ·  assinatura: ${PUBKEY ? "EXIGIDA" : "opcional (provisione config/keys/authority.pub.pem)"}\n`));
module.exports = server;
