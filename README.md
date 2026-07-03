# SPIRAL LEDGER 1.0
### O registro de decisões corporativas: durável, assinado, à prova de adulteração
Produto standalone — não requer Spiral Vision nem o Engine. Zero dependências.

## Integrar em 48 horas
**Hora 0–1 · instalar:** descompacte no servidor, `npm install` (nada é baixado), `npm run verify` (11 provas → PRODUTO ÍNTEGRO), `LEDGER_TOKEN=segredo npm start` → API em `:4700`, dados em `data/ledger.aof` (defina `LEDGER_PATH` para escolher o disco).
**Hora 1–4 · primeira decisão registrada:**
```bash
curl -X POST http://localhost:4700/v1/records \
  -H "Authorization: Bearer segredo" -H "Content-Type: application/json" \
  -d '{"decision_id":"COMPRA-042","state":"DECIDIDA","actor":"cfo@empresa.com","why":"renovação de frota aprovada em comitê"}'
```
**Hora 4–24 · plugar o legado:** no ponto do seu ERP/SAP/fluxo onde a decisão é aprovada, adicione UMA chamada à API (ou use o SDK embutido — `examples/quickstart.js`, 15 linhas). Contrato completo em `src/server.js` (v1: records, latest, chain/verify, export, health).
**Hora 24–48 · não-repúdio (opcional):** gere o par de chaves (`node -e "console.log(require('./src/signing').generateKeyPair().publicKeyPem)"`), guarde a privada FORA do servidor, coloque a pública em `config/keys/authority.pub.pem` → a API passa a EXIGIR assinatura válida em todo registro. Pronto: nem o administrador do servidor consegue forjar uma decisão.

## Garantias (todas provadas em `npm run verify`)
Durabilidade com fsync (kill -9 não perde o passado) · leitura O(1) · corrente de hash SHA-256 (adulteração detectada e recusada no boot) · assinatura Ed25519 · API + SDK testados ponta a ponta.

## O que ele responde, para sempre
**Quem. Quando. Por quê. Com que autoridade.** O resto é com os seus outros sistemas.
