# 09 — Compatibilidad con Node.js y estado de las dependencias

**Pregunta que responde este documento:** *"¿el sistema funciona con la versión nueva de Node
que hay instalada?"*

**Respuesta corta: sí, ya funciona.** Verificado, no supuesto. Abajo está la evidencia y,
a continuación, lo que conviene actualizar de todas formas.

---

## 1. Entorno verificado

```
Node.js  v24.16.0
npm      11.13.0
Sistema  Windows 11 (10.0.26200)
```

### Prueba 1 — Suite de pruebas del backend

```bash
cd backend && npm test
```

```
Test Suites: 7 passed, 7 total
Tests:       15 passed, 15 total
Time:        8.258 s
```

✅ **Las 15 pruebas pasan en Node 24.16.0.** Ninguna advertencia de compatibilidad.

### Prueba 2 — Compilación del frontend

```bash
cd frontend && npm run build
```

```
vite v8.0.14 building client environment for production...
✓ 1820 modules transformed.
dist/index.html                   0.79 kB │ gzip:   0.43 kB
dist/assets/index--4a5puQI.css   94.71 kB │ gzip:  14.28 kB
dist/assets/index-npBPvCxS.js   634.10 kB │ gzip: 157.32 kB
✓ built in 1.94s
```

✅ **Compila sin errores en Node 24.16.0.**

Una sola advertencia, y no es de compatibilidad:

```
(!) Some chunks are larger than 500 kB after minification.
```

El paquete JavaScript pesa 634 kB (157 kB comprimido). Se puede reducir con
`React.lazy()` sobre las páginas, pero no es un problema de Node ni bloquea nada.

### Conclusión

**No hay que hacer nada para que el sistema funcione con Node 24.** Ya funciona.
Lo que sigue son mejoras de higiene, no arreglos necesarios.

---

## 2. Una inconsistencia que sí conviene cerrar

| Entorno | Versión de Node |
|---|---|
| Máquina de desarrollo | **24.16.0** |
| Integración continua (`.github/workflows/ci.yml`) | **22** |
| Documentación (`README.md`) | **18+** |
| Producción | **sin declarar** |

Tres versiones distintas y una sin declarar. Hoy no causa problemas porque las tres son
compatibles, pero es exactamente el tipo de desalineación que produce un *"en mi máquina
funciona"* difícil de diagnosticar.

**Corrección recomendada — declarar la versión mínima en ambos `package.json`:**

```json
"engines": {
  "node": ">=22.0.0"
}
```

Y añadir un archivo `.nvmrc` en la raíz:

```
24
```

`>=22` en vez de `>=24` porque 22 es LTS activa, el CI ya la usa y no hay ninguna
funcionalidad del código que exija 24. Con eso, npm avisa si alguien intenta instalar con una
versión anterior, y el CI queda dentro del rango declarado.

**Opcional:** subir el CI a Node 24 para que coincida con el entorno de desarrollo. Es un
cambio de una línea en `.github/workflows/ci.yml` (`node-version: '24'`).

---

## 3. Estado de las dependencias del backend

Instaladas hoy vs. última publicada:

| Paquete | Instalada | Última | Salto | Riesgo de actualizar |
|---|---|---|---|---|
| `express` | 4.22.2 | 5.2.1 | **mayor** | ⚠️ Alto — Express 5 cambia el manejo de errores asíncronos y el enrutamiento |
| `@prisma/client` / `prisma` | 5.22.0 | 7.10.0 | **dos mayores** | ⚠️ Alto — requiere revisar el esquema y regenerar el cliente |
| `multer` | 1.4.5-lts.2 | 2.3.0 | **mayor** | 🟡 Medio — la API de errores cambia; el uso aquí es sencillo |
| `nodemailer` | 6.10.1 | 9.1.1 | **tres mayores** | 🟡 Medio — **tiene vulnerabilidades conocidas** (ver abajo) |
| `express-rate-limit` | 6.11.2 | 8.7.0 | **dos mayores** | 🟢 Bajo — la configuración usada es mínima |
| `helmet` | 7.2.0 | 8.3.0 | mayor | 🟢 Bajo — se usa con la configuración por defecto |
| `node-cron` | 3.0.3 | 4.6.0 | mayor | 🟢 Bajo — solo se usa `cron.schedule()` |
| `bcryptjs` | 2.4.3 | 3.0.3 | mayor | 🟢 Bajo — API estable |
| `dotenv` | 16.6.1 | 17.4.2 | mayor | 🟢 Bajo |
| `@aws-sdk/client-s3` | 3.1092.0 | 3.1124.0 | menor | 🟢 Ninguno |
| `jsonwebtoken` | 9.0.3 | 9.0.3 | — | ✅ Al día |
| `cors` | 2.8.6 | 2.8.6 | — | ✅ Al día |

---

## 4. Vulnerabilidades reportadas

```bash
cd backend && npm audit --omit=dev
```

**4 vulnerabilidades: 1 baja, 2 moderadas, 1 alta.**

### 🔴 Alta — `nodemailer` ≤ 9.0.0

Ocho advisorías, entre ellas:

- Inyección de comandos SMTP mediante el parámetro `envelope.size` sin sanear.
- Inyección CRLF en el nombre del transporte (EHLO/HELO).
- Inyección de cabeceras arbitrarias mediante comentarios en cabeceras `List-*`.
- Envío de correo a un dominio no previsto por conflicto de interpretación de direcciones.
- Validación incorrecta del certificado TLS al obtener tokens OAuth2.

**Evaluación de exposición real en el SGPA:** moderada, no crítica. El código usa `nodemailer`
con transporte de Gmail fijo y plantillas construidas en el servidor
(`config/mailer.js`, `jobs/recordatorios.job.js`). Ningún dato de usuario llega a
`envelope`, al nombre del transporte ni a cabeceras `List-*`.

**Pero sí hay un vector que merece atención:** en `recordatorios.job.js`, los nombres de
audiencias, términos, radicados y usuarios se interpolan **directamente en HTML** sin escapar:

```js
const subject = `🔔 RECORDATORIO: Audiencia Judicial - ${hearingName}`;
```

Si un usuario crea una audiencia llamada `<img src=x onerror=...>`, ese HTML llega al cliente
de correo del abogado. La mayoría de clientes lo neutralizan, pero es una inyección de HTML
real y **es independiente de la versión de nodemailer**: se corrige escapando las
interpolaciones, no actualizando la librería.

**Acción:** actualizar a `nodemailer@9` (cambio mayor; revisar la creación del transporte)
**y** escapar las interpolaciones de las plantillas.

### 🟡 Moderada — `uuid` < 11.1.1, vía `node-cron@3`

Falta de comprobación de límites de búfer en `uuid` v3/v5/v6. `node-cron` no usa esas
variantes en el camino que ejecuta el SGPA. **Riesgo real: prácticamente nulo.**
Se resuelve actualizando a `node-cron@4`.

### 🟢 Baja — `body-parser` < 1.20.6, vía `express@4`

Denegación de servicio si un valor de `limit` inválido desactiva silenciosamente la
comprobación de tamaño. El SGPA usa `express.json()` sin `limit` personalizado.
Se resuelve con `npm audit fix` (sin cambio mayor).

---

## 5. Plan de actualización por fases

Diseñado para que **nunca haya que actualizar dos cosas riesgosas a la vez**.

### Fase 1 — Sin riesgo (hacer ya)

```bash
cd backend && npm audit fix
```

Resuelve `body-parser` sin cambios mayores. **No usar `--force`**, que arrastraría
actualizaciones mayores sin control.

### Fase 2 — Riesgo bajo (una tarde)

```bash
npm i helmet@8 express-rate-limit@8 node-cron@4 bcryptjs@3 dotenv@17
```

Cuatro verificaciones tras instalar:
1. `npm test` sigue en verde.
2. El servidor arranca y `GET /` responde.
3. El cron imprime su mensaje de inicialización.
4. El inicio de sesión funciona (`bcryptjs@3` cambia la API a promesas; el código ya usa
   `async/await`, así que debería ser transparente — **verificarlo de todas formas**).

`node-cron@4` cierra además la advertencia de `uuid`.

### Fase 3 — Riesgo medio (medio día)

```bash
npm i nodemailer@9 multer@2
```

- **`nodemailer@9`:** revisar `config/mailer.js`. Probar el envío real del correo de
  verificación y de un recordatorio. Aprovechar para **escapar las interpolaciones HTML**
  de las plantillas.
- **`multer@2`:** revisar `documentos.routes.js` y `tenant.routes.js`. Probar la subida de un
  documento y de un logo, incluido el caso de archivo demasiado grande, para confirmar que el
  error sigue llegando bien al cliente. **Aprovechar para añadir el `fileFilter` de formatos
  que exige RF18** y que hoy no existe.

### Fase 4 — Riesgo alto (evaluar antes de decidir)

**`prisma@5` → `prisma@7`.** Prisma 5 está fuera de soporte, así que a mediano plazo hay que
moverse. Pero es un salto de dos versiones mayores sobre la capa de datos completa.

Recomendación: **hacerlo en una rama aparte**, y aprovechar el mismo trabajo para aplicar las
correcciones de esquema que ya están identificadas en el doc 02:
`@@unique([tenant_id, ...])`, índices y el valor `ESCRITO`. Así se paga una sola migración
en vez de tres.

**`express@4` → `express@5`.** No hay ninguna razón funcional para hacerlo hoy. Express 4
sigue recibiendo parches de seguridad. **Recomendación: no actualizar por ahora.** El cambio
más delicado de Express 5 es el manejo de errores en controladores asíncronos, y este proyecto
tiene 11 controladores llenos de `async` con `try/catch` propio.

---

## 6. Variables de entorno reales

`backend/.env.example` está desactualizado (hallazgo H-07): pide variables que ya no se usan
y omite cinco que el código sí necesita. Este es el contenido correcto, derivado de leer
todos los `process.env` del backend:

```env
# ─── Base de datos ────────────────────────────────────────────
# Conexión con pooling (PgBouncer, puerto 6543) — usada por la aplicación
DATABASE_URL="postgresql://user:password@host:6543/postgres?pgbouncer=true"
# Conexión directa (puerto 5432) — usada por las migraciones de Prisma
DIRECT_URL="postgresql://user:password@host:5432/postgres"

# ─── Autenticación ────────────────────────────────────────────
JWT_SECRET="clave-larga-y-aleatoria-de-al-menos-32-caracteres"
JWT_EXPIRES_IN="8h"

# ─── Almacenamiento de archivos: Cloudflare R2 ────────────────
# ⚠️ FALTABAN en .env.example. Sin ellas no se puede subir ningún documento.
R2_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"
R2_ACCESS_KEY_ID="..."
R2_SECRET_ACCESS_KEY="..."
R2_BUCKET_NAME="..."     # documentos.controller.js y tenant.controller.js
R2_PUBLIC_DOMAIN=""      # opcional: dominio público del bucket, para la URL del logo
R2_ACCOUNT_ID=""         # solo para la URL de respaldo del logo si falta el anterior

# ─── Correo saliente ──────────────────────────────────────────
GMAIL_USER="tucorreo@gmail.com"
GMAIL_PASS="contraseña-de-aplicacion-de-16-caracteres"

# ─── Servidor ─────────────────────────────────────────────────
PORT=3000
NODE_ENV="development"

# ⚠️ FALTABA. Base de los enlaces de verificación enviados por correo.
FRONTEND_URL="http://localhost:5173/sistema-juridico"

# ⚠️ FALTABA. Solo en desarrollo: activa la cuenta sin verificar el correo.
# En producción se ignora, por diseño (auth.controller.js).
DEV_AUTO_VERIFY="false"

# ─── Integraciones opcionales ─────────────────────────────────
# ⚠️ FALTABA. Si está vacía, el webhook simplemente no se dispara.
N8N_WEBHOOK_URL=""
```

**Variables retiradas** (ya no las lee ningún archivo):

```env
SUPABASE_URL   # obsoleta: config/supabase.js está desactivado
SUPABASE_KEY   # obsoleta: el almacenamiento es Cloudflare R2
```

> **Actualizado el 2 de septiembre de 2026.** Supabase ya no interviene en nada: el
> almacenamiento de archivos pasó a Cloudflare R2 y **la base de datos vive en un contenedor
> propio** con su volumen (ver [ADR-011](11-DECISIONES-ARQUITECTONICAS.md)). La conexión va por
> `DATABASE_URL`, apuntando al servicio `postgres` del compose.

Frontend (`frontend/.env`):

```env
VITE_API_URL="http://localhost:3000/api"
```

Si no se define, `api/axios.js` usa `http://localhost:3000/api` en desarrollo y
`/sistema-juridico/api` en producción.

---

## 7. Comandos de verificación

Para confirmar que el entorno está sano tras cualquier cambio:

```bash
node -v && npm -v
```

```bash
cd backend && npm ci && npx prisma generate && npm test
```

```bash
cd frontend && npm ci && npm run build
```

```bash
cd backend && npm audit --omit=dev
```

### Scripts del proyecto

| Comando | Qué hace |
|---|---|
| `npm start` | Arranca la API y el cron de recordatorios |
| `npm run dev` | Igual, con recarga automática (nodemon) |
| `npm test` | 21 pruebas unitarias con Jest |
| `npm run seed:dev` | Siembra datos de prueba. Solo actúa si la base está vacía |
| `npm run verificar` | Comprueba, contra la API en ejecución, que el sistema cumple lo documentado. Ver [05 § 3](05-MATRIZ-TRAZABILIDAD.md#3-verificación-de-extremo-a-extremo) |
| `npm run verificar:limpiar` | Borra los consultorios que generó la verificación |

Los tres últimos **se niegan a ejecutarse si `DATABASE_URL` no apunta a `localhost`**: crean y
borran datos, y no deben tocar producción.

---

## 8. Resumen

| Pregunta | Respuesta |
|---|---|
| ¿Funciona con Node 24? | ✅ **Sí.** 15/15 pruebas en verde y compilación correcta |
| ¿Hay que cambiar algo para que funcione? | **No** |
| ¿Hay vulnerabilidades? | Sí, 4. Una alta (`nodemailer`), de exposición moderada en este uso |
| ¿Hay que actualizar todo ya? | No. Fases 1 y 2 son seguras y rápidas; la 4 exige planificación |
| ¿Qué es lo más urgente? | Declarar `engines`, ejecutar `npm audit fix`, corregir `.env.example` y escapar el HTML de las plantillas de correo |
