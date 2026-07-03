# Runbook de Operação — Spiral Ledger
**Backup:** copie o arquivo AOF (`data/ledger.aof`) com o serviço parado ou via snapshot do filesystem. O arquivo é autossuficiente.
**Restore:** coloque o AOF no caminho configurado e inicie; a corrente é verificada no boot — se íntegra, o passado inteiro volta.
**Verificação periódica:** `curl .../v1/chain/verify` (ou `npm run verify` no host). Agende diária.
**Escritor único:** uma instância por AOF (lock automático). Para escalar leitura, replique o arquivo (read-only) — nunca dois escritores.
**Chave privada:** NUNCA no servidor. A pública em `config/keys/authority.pub.pem` liga a exigência de assinatura.
**Atualização:** pare o serviço, troque o pacote, `npm run verify`, inicie. O AOF não muda de formato dentro da major 1.x.
**Incidente "corrente quebrada":** o produto RECUSA carregar — isso é feature. Restaure o último backup íntegro e investigue acesso ao disco.
