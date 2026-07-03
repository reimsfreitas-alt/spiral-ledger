"use strict";
/**
 * ========================================
 * SPIRAL KERNEL · Ledger (A Memória)
 * ========================================
 * Fase 1 — Blindagem: Append-Only Log em disco com garantia de escrita.
 *
 * Invariantes que este arquivo GARANTE (não assume):
 *  - Durabilidade: todo append é gravado e sincronizado (fsync) no disco ANTES
 *    de retornar. kill -9 no milissegundo seguinte não perde o passado.
 *  - Imutabilidade verificável: cada evento carrega hash encadeado (prev_hash),
 *    formando uma corrente. Alterar o passado quebra a corrente e é detectável.
 *  - Leitura O(1): getLatest usa índice em memória, não varredura linear.
 *
 * Formato de persistência: JSONL (uma linha por evento) em logs/ledger/ledger.aof
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const GENESIS = "0".repeat(64);

function canonical(obj) {
    // serialização determinística (chaves ordenadas) para hash/assinatura estáveis
    return JSON.stringify(obj, Object.keys(obj).sort());
}

function hashRecord(prev_hash, seq, ts, payload) {
    return crypto.createHash("sha256")
        .update(prev_hash + "|" + seq + "|" + ts + "|" + canonical(payload))
        .digest("hex");
}

class Ledger {
    constructor(opts = {}) {
        this.file = opts.file || path.join(process.cwd(), "logs", "ledger", "ledger.aof");
        fs.mkdirSync(path.dirname(this.file), { recursive: true });

        // índices em memória (reconstruídos no boot a partir do disco)
        this._latestByDecision = new Map();   // decision_id -> record  (O(1) getLatest)
        this._latestByIdem = new Map();        // idempotency_key -> record
        this._seq = 0;
        this._lastHash = GENESIS;

        this._replay();                        // recuperação: O(n) UMA vez no boot
        this.fd = fs.openSync(this.file, "a"); // fd persistente em modo append
    }

    /** Recupera índice e corrente de hash a partir do disco. Verifica integridade. */
    _replay() {
        if (!fs.existsSync(this.file)) return;
        const lines = fs.readFileSync(this.file, "utf8").split("\n").filter(Boolean);
        for (const line of lines) {
            let rec;
            try { rec = JSON.parse(line); } catch { continue; }
            const expected = hashRecord(rec.prev_hash, rec.seq, rec.ts, rec.payload);
            if (rec.hash !== expected || rec.prev_hash !== this._lastHash) {
                throw new Error(
                    `Ledger CORROMPIDO na seq ${rec.seq}: corrente de hash quebrada. ` +
                    `O passado foi adulterado.`
                );
            }
            this._index(rec);
            this._seq = rec.seq;
            this._lastHash = rec.hash;
        }
    }

    _index(rec) {
        const p = rec.payload;
        if (p.decision_id) this._latestByDecision.set(p.decision_id, rec);
        if (p.idempotency_key) this._latestByIdem.set(p.idempotency_key, rec);
    }

    /**
     * Anexa um evento. Persiste + fsync ANTES de retornar (durabilidade real).
     * @returns {object} o record persistido (com seq, ts, hash).
     */
    append(payload) {
        const seq = this._seq + 1;
        const ts = Date.now();
        const prev_hash = this._lastHash;
        const hash = hashRecord(prev_hash, seq, ts, payload);
        const rec = Object.freeze({ seq, ts, prev_hash, hash, payload: Object.freeze({ ...payload }) });

        const line = JSON.stringify(rec) + "\n";
        fs.writeSync(this.fd, line);
        fs.fsyncSync(this.fd);            // <- a garantia. Sem isto, é só cache de SO.

        this._seq = seq;
        this._lastHash = hash;
        this._index(rec);
        return rec;
    }

    /** O(1) — último estado de uma decisão. */
    getLatest(decision_id) {
        const rec = this._latestByDecision.get(decision_id);
        return rec ? rec.payload : null;
    }

    /** O(1) — último evento de uma chave de idempotência. */
    getByIdempotency(key) {
        const rec = this._latestByIdem.get(key);
        return rec ? rec.payload : null;
    }

    /** Todas as chaves de idempotência cujo último estado é "pendente" (para recovery). */
    pendingIdempotencyKeys(pendingState) {
        const out = [];
        for (const [key, rec] of this._latestByIdem.entries()) {
            if (rec.payload.state === pendingState) out.push(key);
        }
        return out;
    }

    /** Verifica a corrente inteira em disco. Retorna true se íntegra. */
    verifyChain() {
        let last = GENESIS;
        const lines = fs.existsSync(this.file)
            ? fs.readFileSync(this.file, "utf8").split("\n").filter(Boolean) : [];
        for (const line of lines) {
            const rec = JSON.parse(line);
            if (rec.prev_hash !== last) return false;
            if (rec.hash !== hashRecord(rec.prev_hash, rec.seq, rec.ts, rec.payload)) return false;
            last = rec.hash;
        }
        return true;
    }

    close() { if (this.fd != null) { fs.closeSync(this.fd); this.fd = null; } }
}

module.exports = Ledger;
