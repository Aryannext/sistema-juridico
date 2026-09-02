# ─────────────────────────────────────────────────────────────────
# Frontend del SGPA — contenedor de COMPILACIÓN, no de ejecución
#
# El resultado son archivos estáticos que sirve el Nginx del VPS.
# Compilar aquí dentro es lo que te permite NO tener Node instalado
# en el servidor: actualizas la versión cambiando la etiqueta de
# abajo y ningún otro usuario del VPS se ve afectado.
#
# Uso:  docker compose --profile build run --rm frontend-build
# Ver docs/12-DESPLIEGUE-VPS-COMPARTIDO.md
# ─────────────────────────────────────────────────────────────────

FROM node:24-slim AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Vite incrusta las variables VITE_* en el bundle en tiempo de
# compilación, así que tiene que llegar como argumento de build
ARG VITE_API_URL=/sistema-juridico/api
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build


# ── Etapa final: solo transporta el resultado ────────────────────
# Imagen mínima cuyo único trabajo es volcar dist/ en el volumen
# montado por docker-compose.
FROM alpine:3.20
COPY --from=build /app/dist /dist
CMD ["sh", "-c", "rm -rf /salida/* && cp -r /dist/. /salida/ && echo 'Frontend compilado y copiado a /salida'"]
