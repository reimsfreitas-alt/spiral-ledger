"use strict";
/** Registra UMA decisão no Ledger de produção. O gesto real do dia a dia.
 *  Uso: LEDGER_URL=... LEDGER_TOKEN=... node examples/record-one.js "DEC-001" "DECIDIDA" "cfo@empresa" "aprovado em comitê" */
const https = require("https"); const http = require("http");
const BASE = (process.env.LEDGER_URL || "http://127.0.0.1:4700").replace(/\/$/, "");
const TOKEN = process.env.LEDGER_TOKEN || null;
const [,, decision_id, state, actor, why] = process.argv;
if (!decision_id || !state) { console.error('Uso: node examples/record-one.js "<decision_id>" "<state>" "[actor]" "[why]"'); process.exit(1); }
const u = new URL(BASE + "/v1/records"); const lib = u.protocol === "https:" ? https : http;
const body = JSON.stringify({ decision_id, state, actor: actor||null, why: why||null });
const req = lib.request({ hostname:u.hostname, port:u.port||(u.protocol==="https:"?443:80), path:u.pathname, method:"POST",
  headers:{ "Content-Type":"application/json","Content-Length":Buffer.byteLength(body), ...(TOKEN?{Authorization:"Bearer "+TOKEN}:{}) }},
  res=>{ let d="";res.on("data",c=>d+=c);res.on("end",()=>console.log(res.statusCode<300?"registrado: "+d:"erro "+res.statusCode+": "+d)); });
req.on("error",e=>console.error("erro:",e.message)); req.write(body); req.end();
