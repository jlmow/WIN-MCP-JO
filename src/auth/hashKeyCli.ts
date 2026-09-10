import { hashApiKey } from "./credentialStore.js";

/**
 * Utilitário de linha de comandos para gerar o hash SHA-256 de uma API key
 * a colocar em `config/integrations.json`. A key em texto plano nunca é
 * guardada — só o hash é comparado no momento da autenticação.
 *
 * Uso: npm run hash-key -- "a-minha-api-key-secreta"
 */
const rawKey = process.argv[2];
if (!rawKey) {
  console.error('Uso: npm run hash-key -- "<api-key>"');
  process.exit(1);
}

console.log(hashApiKey(rawKey));
