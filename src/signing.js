"use strict";
/**
 * ========================================
 * SPIRAL KERNEL · Signing (Não-Repúdio)
 * ========================================
 * Fase 3 — Assinatura de verdade. Elimina o has_sig booleano.
 *
 * Usa Ed25519 (par de chaves ASSIMÉTRICO) via crypto nativo do Node.
 * Por que assimétrico e não HMAC: HMAC prova integridade, mas emissor e
 * verificador compartilham a mesma chave — não há não-repúdio (qualquer um
 * dos dois pode ter assinado). Com Ed25519, só quem tem a CHAVE PRIVADA pode
 * ter assinado; o Kernel guarda apenas a chave PÚBLICA para verificar.
 * Isso é não-repúdio corporativo real: a autoridade do emissor é provável.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

function canonical(obj) {
    return JSON.stringify(obj, Object.keys(obj).sort());
}

/** Gera um par de chaves Ed25519 (rodar uma vez no provisionamento). */
function generateKeyPair() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
    return {
        publicKeyPem: publicKey.export({ type: "spki", format: "pem" }),
        privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" })
    };
}

/** Assina o payload canônico. Retorna assinatura base64. (Lado da autoridade emissora.) */
function sign(payload, privateKeyPem) {
    const data = Buffer.from(canonical(payload));
    const sig = crypto.sign(null, data, privateKeyPem); // Ed25519 => algoritmo null
    return sig.toString("base64");
}

/** Verifica a assinatura contra a chave pública. (Lado do Kernel.) */
function verify(payload, signatureB64, publicKeyPem) {
    if (!signatureB64 || !publicKeyPem) return false;
    try {
        const data = Buffer.from(canonical(payload));
        return crypto.verify(null, data, publicKeyPem, Buffer.from(signatureB64, "base64"));
    } catch {
        return false;
    }
}

/** Carrega a chave pública de verificação do ambiente/arquivo (config, nunca hardcode). */
function loadPublicKey() {
    if (process.env.SPIRAL_PUBLIC_KEY) return process.env.SPIRAL_PUBLIC_KEY;
    const p = path.join(process.cwd(), "config", "keys", "authority.pub.pem");
    if (fs.existsSync(p)) return fs.readFileSync(p, "utf8");
    return null;
}

module.exports = { generateKeyPair, sign, verify, loadPublicKey, canonical };
