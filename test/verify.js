"use strict";
/* SPIRAL LEDGER · verify — o selo do produto standalone. */
const fs = require("fs"); const path = require("path");
const Ledger = require("../src/ledger"); const signing = require("../src/signing");
const results = []; const check = (n, ok) => results.push({ n, ok: !!ok });
const F = path.join(__dirname, "fx.aof"); try { fs.unlinkSync(F); } catch {}

let l = new Ledger({ file: F });
l.append({ decision_id: "D1", state: "DECIDIDA", actor: "a@b", why: "teste" });
l.append({ decision_id: "D1", state: "EXECUTADA" });
check("durabilidade: grava com fsync", fs.existsSync(F));
check("O(1): getLatest", l.getLatest("D1").state === "EXECUTADA");
l.close();
let r = new Ledger({ file: F });
check("reboot: passado intacto", r.getLatest("D1").state === "EXECUTADA");
check("corrente íntegra", r.verifyChain() === true);
r.close();
// adulteração detectada
let raw = fs.readFileSync(F, "utf8").split("\n").filter(Boolean);
raw[0] = raw[0].replace("DECIDIDA", "REJEITADA");
fs.writeFileSync(F + ".t", raw.join("\n") + "\n");
let tampered = false; try { new Ledger({ file: F + ".t" }); } catch { tampered = true; }
check("adulteração detectada e recusada", tampered);
// assinatura ponta a ponta
const { publicKeyPem, privateKeyPem } = signing.generateKeyPair();
const payload = { decision_id: "D2", state: "DECIDIDA" };
const sig = signing.sign(payload, privateKeyPem);
check("assinatura Ed25519: válida verifica", signing.verify(payload, sig, publicKeyPem) === true);
check("assinatura Ed25519: adulterada falha", signing.verify({ ...payload, state: "OUTRA" }, sig, publicKeyPem) === false);
// API em processo
process.env.PORT = 4750; delete process.env.LEDGER_TOKEN;
process.env.LEDGER_PATH = path.join(__dirname, "api.aof"); try { fs.unlinkSync(process.env.LEDGER_PATH); } catch {}
const server = require("../src/server");
const { SpiralLedgerClient } = require("../sdk/client");
setTimeout(async () => {
  const c = new SpiralLedgerClient("http://localhost:4750");
  const rec = await c.record({ decision_id: "API-1", state: "DECIDIDA", actor: "sdk", why: "smoke" });
  check("API: POST /v1/records grava", rec.seq === 1 && !!rec.hash);
  const latest = await c.latest("API-1");
  check("API: GET latest O(1)", latest.state === "DECIDIDA");
  const v = await c.verify();
  check("API: corrente íntegra via HTTP", v.intact === true);
  let missing = false; try { await c.latest("NAO-EXISTE"); } catch (e) { missing = e.status === 404; }
  check("API: 404 para decisão inexistente", missing);
  server.close();
  console.log("\n===========================================");
  console.log("  SPIRAL LEDGER · SELO DO PRODUTO");
  console.log("===========================================");
  for (const x of results) console.log(`  ${x.ok ? "✅" : "❌"}  ${x.n}`);
  const all = results.every(x => x.ok);
  console.log("-------------------------------------------");
  console.log(`  ${all ? "✅ PRODUTO ÍNTEGRO" : "❌ FALHOU"}  (${results.filter(x => x.ok).length}/${results.length})`);
  process.exit(all ? 0 : 1);
}, 400);
