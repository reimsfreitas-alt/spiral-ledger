# Spiral Ledger — Deploy em Produção
O Ledger ESCREVE a verdade em disco. Portanto, ao contrário do Vision, ele **exige volume persistente**.

## Variáveis de ambiente
| variável | obrigatória | valor |
|---|---|---|
| `HOST` | sim (nuvem) | `0.0.0.0` |
| `PORT` | não | injetada pelo host (ex.: 8080) |
| `LEDGER_TOKEN` | **SIM em produção** | segredo forte — sem ele, o servidor recusa subir exposto na rede |
| `LEDGER_PATH` | **SIM** | caminho no volume persistente, ex.: `/data/ledger.aof` |

## Render (rota recomendada)
1. Suba o repositório `spiral-ledger` ao GitHub.
2. New → Web Service → conecte o repo.
3. Start Command: `node src/server.js`
4. **Add Persistent Disk** → mount path `/data` (isto é obrigatório; sem disco, o redeploy apaga a verdade).
5. Environment: `HOST=0.0.0.0` · `LEDGER_TOKEN=<segredo>` · `LEDGER_PATH=/data/ledger.aof`
6. Deploy. HTTPS automático.
7. CNAME `ledger.spiralwealth.com.br` → host do Render.

## Verificação pós-deploy
1. `https://ledger.spiralwealth.com.br/v1/health` → `{"ok":true,"version":"1.0.0"}` (rota pública de liveness).
2. Registrar a primeira decisão real (com token):
```bash
curl -X POST https://ledger.spiralwealth.com.br/v1/records \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{"decision_id":"COMPRA-001","state":"DECIDIDA","actor":"cfo@empresa","why":"primeira decisao em producao"}'
```
3. Ler de volta: `GET /v1/records/COMPRA-001` com o mesmo Bearer → deve retornar o estado.

## Checklist de atualização de versão
- [ ] `npm run verify` (11/11) antes de subir.
- [ ] commit + tag da nova versão.
- [ ] push → redeploy automático.
- [ ] `/v1/health` retorna a nova versão.
- [ ] O volume `/data` (LEDGER_PATH) permanece intacto — nunca no container efêmero.
