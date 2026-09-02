# ─────────────────────────────────────────────────────────────────
# Backend del SGPA — API REST + cron de recordatorios
#
# La versión de Node vive AQUÍ, no en el VPS. Para actualizarla se
# cambia la etiqueta de la imagen y se reconstruye: el resto de
# aplicaciones del servidor no se entera.
# Ver docs/12-DESPLIEGUE-VPS-COMPARTIDO.md
# ─────────────────────────────────────────────────────────────────

# ── Etapa 1: dependencias y cliente de Prisma ────────────────────
FROM node:24-slim AS deps
WORKDIR /app

# Prisma necesita openssl para su motor de consultas
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

# El cliente se genera dentro de la imagen para que el motor binario
# coincida con este sistema operativo, no con el de tu portátil
COPY prisma ./prisma
RUN npx prisma generate


# ── Etapa 2: imagen de ejecución ─────────────────────────────────
FROM node:24-slim AS runtime
WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --system --create-home --uid 10001 sgpa

ENV NODE_ENV=production

COPY --from=deps --chown=sgpa:sgpa /app/node_modules ./node_modules
COPY --chown=sgpa:sgpa . .

# No ejecutar como root: si algún día hay una vulnerabilidad en una
# dependencia, el atacante queda con un usuario sin privilegios
USER sgpa

EXPOSE 3000

# server.js lee process.env.PORT y por defecto usa 3000
CMD ["node", "server.js"]
