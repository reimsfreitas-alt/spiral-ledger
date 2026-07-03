"use strict";
/**
 * SPIRAL LEDGER · SDK — o que um dev precisa para plugar o Ledger em 48h.
 * Dois modos:
 *   EMBUTIDO : const { Ledger } = require("spiral-ledger/sdk/client")  (mesmo processo)
 *   HTTP     : const c = new SpiralLedgerClient("http://host:4700", token)
 */
const http = require("http");
const Ledger = require("../src/ledger");
const signing = require("../src/signing");

class SpiralLedgerClient {
  constructor(baseUrl, token) { this.base = baseUrl.replace(/\/$/, ""); this.token = token || null; }
  _req(method, p, body) {
    return new Promise((resolve, reject) => {
      const u = new URL(this.base + p);
      const req = http.request({ hostname: u.hostname, port: u.port, path: u.pathname, method,
        headers: { "Content-Type": "application/json", ...(this.token ? { Authorization: "Bearer " + this.token } : {}) } },
        res => { let d = ""; res.on("data", c => d += c); res.on("end", () => {
          const j = d ? JSON.parse(d) : {};
          res.statusCode < 300 ? resolve(j) : reject(Object.assign(new Error(j.error || res.statusCode), { status: res.statusCode }));
        }); });
      req.on("error", reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }
  /** Registra uma decisão. record({decision_id, state, actor, why, payload?, signature?}) */
  record(r) { return this._req("POST", "/v1/records", r); }
  /** Último estado de uma decisão (O(1) no servidor). */
  latest(decision_id) { return this._req("GET", "/v1/records/" + encodeURIComponent(decision_id)); }
  /** A corrente está íntegra? */
  verify() { return this._req("GET", "/v1/chain/verify"); }
}
module.exports = { SpiralLedgerClient, Ledger, signing };
