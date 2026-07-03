# Spiral Ledger — imagem de produção. Escreve em disco: EXIGE volume persistente.
FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .
ENV HOST=0.0.0.0
ENV PORT=8080
# LEDGER_TOKEN e LEDGER_PATH devem ser definidos no ambiente (ver docs/DEPLOY.md)
EXPOSE 8080
CMD ["node", "src/server.js"]
