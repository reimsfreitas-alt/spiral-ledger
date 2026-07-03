"use strict";
/* QUICKSTART — o Ledger embutido em 15 linhas. `npm run quickstart` */
const { Ledger, signing } = require("../sdk/client");
const ledger = new Ledger({ file: "data/quickstart.aof" });

// 1. registre a intenção no momento em que ela nasce (D0)
const rec = ledger.append({
  decision_id: "COMPRA-2026-042", state: "DECIDIDA",
  actor: "cfo@empresa.com", why: "renovação de frota aprovada em comitê"
});
console.log("registrado: seq", rec.seq, "hash", rec.hash.slice(0, 12) + "…");

// 2. recupere a verdade em O(1), a qualquer momento, para sempre
console.log("último estado:", ledger.getLatest("COMPRA-2026-042").state);

// 3. prove que ninguém adulterou o passado
console.log("corrente íntegra?", ledger.verifyChain());
ledger.close();
