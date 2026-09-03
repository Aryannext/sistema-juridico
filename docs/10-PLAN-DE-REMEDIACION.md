# 10 — Plan de remediación

Este documento convierte los 28 hallazgos del doc 00 en **trabajo ordenado y ejecutable**.

> ✅ **Estado a 1 de septiembre de 2026: las Olas 0 y 1 están ejecutadas por completo.**
> Verificación posterior a los cambios: `npm test` 21/21 en verde, `npm run build` correcto,
> `npm run lint` sin errores nuevos respecto a la línea base (48 preexistentes), y revisión
> visual en 360 px y escritorio. Las olas 2 a 6 siguen pendientes.
>
> Fuera del plan original se implementaron además las **actuaciones procesales**
> (RF55–RF59, HU-37, [ADR-010](11-DECISIONES-ARQUITECTONICAS.md)) y se corrigió el
> **desfase de un día en las fechas** (hallazgo H-27).

**Principio que ordena todo el plan:** primero lo que es barato e irreversiblemente bueno
(higiene del repositorio, correcciones de una línea), después lo que exige cuidado
(migraciones, funcionalidad nueva). **Nada de lo propuesto toca el diseño visual.**

**Notación de riesgo:**
🟢 sin riesgo · 🟡 requiere verificación · 🔴 requiere rama aparte y plan de reversión

---

## Panorama

| Ola | Contenido | Esfuerzo | Riesgo |
|:--:|---|---|:--:|
| **0** | Higiene del repositorio | 30 min | 🟢 |
| **1** | Interfaz e idioma | 1,5 h | 🟢 |
| **2** | Cumplimiento y seguridad | 1 día | 🟡 |
| **3** | Corrección del esquema de datos | 1 día | 🔴 |
| **4** | Funcionalidad faltante | 3–5 días | 🟡 |
| **5** | Cobertura de pruebas | 2 días | 🟢 |
| **6** | Actualización de dependencias mayores | 2–3 días | 🔴 |
| **7** | Calidad de código y deuda técnica | 6–8 días | 🟡 |

**Total estimado:** 9–13 días de trabajo efectivo.
**Las olas 0 y 1 juntas son 2 horas y resuelven los problemas más visibles.**

---

## Ola 0 — Higiene del repositorio · 30 min · 🟢

Todo aquí es corrección de estado del proyecto. Nada cambia el comportamiento del sistema.

### 0.1 Versionar el archivo que falta — **bloqueante**

```bash
git add backend/src/config/webhook.js docs/fuentes/investigacion.docx
```

Sin esto, **cualquiera que clone el repositorio obtiene un backend que no arranca**:
`procesos.controller.js` importa `../../config/webhook`, que no está en Git.
Es el problema más urgente del repositorio y se resuelve en diez segundos.

### 0.2 Resolver la colisión de mayúsculas del manual

Git rastrea `docs/MANUAL_USUARIO.md` **y** `docs/manual_usuario.md`; en Windows solo existe uno
en disco. Antes de decidir, comparar ambos blobs:

```bash
git show HEAD:docs/MANUAL_USUARIO.md > /tmp/manual_mayus.md
git show HEAD:docs/manual_usuario.md > /tmp/manual_minus.md
diff /tmp/manual_mayus.md /tmp/manual_minus.md
```

Después conservar uno solo (se sugiere `MANUAL_USUARIO.md`, que es el que aparece enlazado
desde el `README.md`):

```bash
git rm --cached docs/manual_usuario.md
```

> ⚠️ **Revisar el diff antes de ejecutar.** Si los contenidos divergieron, hay que fusionarlos
> a mano primero: el descartado se pierde del árbol de trabajo.

### 0.3 Corregir `.env.example`

Sustituir por el contenido correcto de
[09-COMPATIBILIDAD-NODE.md § 6](09-COMPATIBILIDAD-NODE.md#6-variables-de-entorno-reales).
Quita `SUPABASE_*` y añade `R2_*`, `FRONTEND_URL`, `DEV_AUTO_VERIFY` y `N8N_WEBHOOK_URL`.

### 0.4 Declarar la versión de Node

`engines` en ambos `package.json`, `.nvmrc` en la raíz, y opcionalmente subir el CI a Node 24.
Detalle en el doc 09 § 2.

### 0.5 Actualizar el `README.md`

Cuatro correcciones concretas:
- "microservicios lógicos" → **"monolito modular"** (H-01)
- Versiones del stack: React 19, Router 7, Tailwind 4, Vite 8, Node 22+ (H-05)
- Almacenamiento: Supabase Storage → **Cloudflare R2** (H-06)
- Despliegue: Vercel → **Nginx en subcarpeta `/sistema-juridico/`** (H-08)

Y enlazar `docs/README.md` como índice de documentación.

### 0.6 Marcar como obsoletos los documentos superados

Añadir una nota de dos líneas al inicio de `docs/historico/arquitectura.md`,
`docs/historico/especificaciones_tecnicas.md`, `docs/historico/Reporte_Coherencia_SGPA.md` y
`docs/historico/Combined_Sprint_Stories.md`, remitiendo al documento vigente. **No borrarlos**: son
historia del proyecto y sirven para demostrar la evolución en una sustentación.

### 0.7 Retirar `frontend/vercel.json` — ✅ HECHO

Retirado el 1/09/2026. El despliegue vive en un VPS propio detrás de Nginx; el archivo era
un residuo de una configuración de Vercel que ya no se usa (H-08).

---

## Ola 1 — Interfaz e idioma · 1,5 h · 🟢

### 1.1 Corregir la marca — **prioridad máxima por relación impacto/esfuerzo**

`Lexica` → `SGPA` en `TwoFactorPage.jsx:51` y `VerificacionPage.jsx:46`.
**Dos cadenas.** Hoy el usuario que verifica su correo aterriza en una marca distinta de aquella
en la que se registró (H-24).

### 1.2 Españolizar la interfaz

Ejecutar [08-PLAN-ESPANOLIZACION.md](08-PLAN-ESPANOLIZACION.md): 61 cadenas en 7 archivos
(el inventario inicial decía 56 en 6; al verificar aparecieron 5 más, documentadas allí).
El plan incluye el mapeo exacto, el glosario de decisiones de traducción y el procedimiento de
verificación visual en 360/768/1440 px.

**No toca ni una clase de Tailwind.**

### 1.3 Decidir sobre "¿Olvidaste tu contraseña?"

El enlace es hoy `<Link to="#">`. Traducirlo sin implementarlo empeora la experiencia: el
usuario entiende mejor un enlace que sigue sin funcionar. Dos opciones:
- **A (ahora):** ocultarlo hasta que exista la funcionalidad.
- **B (Ola 4):** implementar la recuperación de contraseña.

Se recomienda A ahora y B después.

---

## Ola 2 — Cumplimiento y seguridad · 1 día · 🟡

Cada punto cierra una brecha concreta identificada en el doc 03.

### 2.1 Registrar el inicio de sesión en la bitácora — **RF05, RNF03** · 1 h

`auth.controller.js:227` conserva el comentario `// Todo: Record audit login`. Hay que escribir
en `bitacoraAuditoria` en tres momentos:

| Evento | Acción sugerida |
|---|---|
| Inicio de sesión exitoso | `INICIO_SESION` |
| Inicio de sesión fallido | `INTENTO_FALLIDO_SESION` |
| Cierre de sesión | `CIERRE_SESION` |

El cierre de sesión es hoy puramente del lado del cliente (`AuthContext` borra el token). Para
registrarlo hace falta añadir `POST /api/auth/logout`.

**Por qué importa:** sin esto el sistema no puede responder *"¿quién entró y cuándo?"*, que es
la pregunta más básica de cualquier auditoría de seguridad y un requisito explícito para
software jurídico.

### 2.2 Limitador dedicado para el inicio de sesión — **RNF02** · 20 min

Hoy hay un único limitador global de 1000 peticiones / 15 min sobre `/api/`, demasiado
permisivo para proteger el login. El bloqueo progresivo por usuario ayuda, pero no frena
un ataque distribuido sobre muchas cuentas.

```js
const loginLimiter = rateLimit({ windowMs: 15*60*1000, max: 10 });
router.post('/login', loginLimiter, authController.login);
```

### 2.3 ~~Validar la política de contraseñas en el backend~~ — ✅ HECHO (2-09-2026)

> Aplicada en `src/utils/password.js`, usada por registro y restablecimiento.
> Ver [17-RECUPERACION-DE-ACCESO.md § 5](17-RECUPERACION-DE-ACCESO.md).
> El análisis original se conserva:

Hoy solo valida el frontend (`RegisterPage.jsx` con `react-hook-form`). Una petición directa a
`POST /api/auth/registro` acepta la contraseña `"1"`. La validación de cliente es usabilidad;
la de servidor es seguridad.

Mínimo 8 caracteres, con al menos una mayúscula, un número y un carácter especial.

### 2.4 Filtrar formatos de archivo — **RF18** · 20 min

`documentos.routes.js` limita el tamaño pero **no el formato**. `tenant.routes.js` ya hace
exactamente lo que falta, para el logo — copiar ese patrón:

```js
fileFilter: (req, file, cb) => {
  const permitidos = ['application/pdf', 'image/jpeg', 'image/png',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
  permitidos.includes(file.mimetype)
    ? cb(null, true)
    : cb(new Error('Formato no permitido. Se aceptan PDF, DOCX, XLSX, JPG y PNG.'), false);
}
```

### 2.5 Restringir CORS · 15 min

`app.use(cors())` sin opciones permite cualquier origen. `docs/historico/arquitectura.md` afirma que ya
está restringido — no lo está.

```js
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
```

**Verificar** que el frontend sigue funcionando tras el cambio, tanto en desarrollo como
detrás de Nginx.

### 2.6 Escapar el HTML de las plantillas de correo · 1 h

`recordatorios.job.js` interpola nombres de audiencias, términos, radicados y usuarios
directamente en HTML. Un nombre de audiencia con etiquetas HTML llega tal cual al cliente de
correo del abogado. Añadir una función `escapeHtml()` y aplicarla a cada interpolación.

### 2.7 Registrar los intentos de acceso entre tenants — **RNF11** · 1 h

RNF11 exige que un acceso a datos de otro tenant devuelva `403` y quede en bitácora. Hoy
devuelve `404` y no se registra.

**Recomendación:** conservar el `404` (no confirma la existencia del recurso, lo cual es más
seguro), **enmendar el texto de RNF11** para reflejarlo, y añadir únicamente el registro en
bitácora del intento. Esto es una decisión de especificación, no solo de código — dejarla
escrita.

---

## Ola 3 — Corrección del esquema de datos · 1 día · 🔴

⚠️ **Requiere migración.** Trabajar en rama aparte, con respaldo previo de la base de datos.
Estos cambios se agrupan a propósito: es una sola migración en vez de cinco.

### 3.1 Unicidad por tenant — **RF52, RNF11 · el más importante de esta ola**

```prisma
model Cliente {
  numero_documento String @db.VarChar(30)   // se retira @unique
  @@unique([tenant_id, numero_documento])
}

model Proceso {
  numero_radicado String @db.VarChar(50)    // se retira @unique
  @@unique([tenant_id, numero_radicado])
}
```

**Antes de migrar, verificar que no haya colisiones dentro de un mismo tenant:**

```sql
SELECT tenant_id, numero_documento, COUNT(*)
FROM clientes GROUP BY 1,2 HAVING COUNT(*) > 1;
```

`Usuario.email` se mantiene único globalmente: es la credencial de inicio de sesión y el login
no lleva selector de consultorio. Decisión razonada en [ADR-003](11-DECISIONES-ARQUITECTONICAS.md).

**Además** hay que corregir el mensaje de error de `createProceso`: hoy dice *"El número de
radicado ya existe en el sistema"* incluso cuando pertenece a otro consultorio, revelando
información ajena.

### 3.2 Índices — **RNF05**

```prisma
model Proceso {
  @@index([tenant_id])
  @@index([tenant_id, estado])
  @@index([tenant_id, id_abogado_resp])
}
model Cliente           { @@index([tenant_id]) }
model Documento         { @@index([tenant_id, id_proceso]) }
model TerminoJudicial   { @@index([tenant_id, estado]) }
model Audiencia         { @@index([tenant_id, fecha_hora]) }
model Notificacion      { @@index([tenant_id, id_usuario, leida]) }
model BitacoraAuditoria { @@index([tenant_id, create_at]) }
```

Sin ellos, el compromiso de RNF05 (< 2 s) no está garantizado en cuanto crezcan los datos.

### 3.3 Completar los catálogos del dominio — **RF19, doc 07**

```prisma
enum CategoriaDocumento { DEMANDA PRUEBA CONTRATO ESCRITO NOTIFICACION PROVIDENCIA OTRO }
enum TipoParte { DEMANDANTE DEMANDADO VICTIMA TERCEROS CLIENTE APODERADO CURADOR_AD_LITEM OTRO }
```

`ESCRITO` cierra el incumplimiento literal de RF19. `APODERADO` y `CURADOR_AD_LITEM` son roles
procesales cotidianos que hoy no se pueden registrar (doc 07 § 6).

Añadir los valores a los desplegables del frontend.

### 3.4 Vigencia del token de verificación — **RF54**

```prisma
model Usuario {
  token_verificacion_expira DateTime?
}
```

Y validar la vigencia en `verificarEmail`. Sin este campo, RF54 (24 horas) es inimplementable.

### 3.5 Unicidad de permisos

```prisma
model PermisoRol { @@unique([id_usuario, modulo]) }
```

Hoy nada impide dos filas para el mismo usuario y módulo, y `roles.middleware.js` usa
`findFirst`: devolvería una de las dos de forma no determinista.

---

## Ola 4 — Funcionalidad faltante · 3–5 días · 🟡

Ordenada por valor para el usuario.

### 4.1 ~~Recuperación de contraseña~~ — ✅ HECHO (2-09-2026)

> `POST /api/auth/recuperar` y `/restablecer`, con el enlace del login restaurado.
> Ver [17-RECUPERACION-DE-ACCESO.md](17-RECUPERACION-DE-ACCESO.md).

Endpoints `POST /api/auth/recuperar` y `POST /api/auth/restablecer`, token con vigencia,
correo, y una pantalla nueva. Es la brecha que un usuario real encuentra primero: hoy, quien
olvida su contraseña **no tiene forma de entrar**.

### 4.2 ~~Reenvío del correo de verificación~~ — ✅ HECHO (2-09-2026)

> `POST /api/auth/reenviar-verificacion`, ofrecido en la pantalla del enlace caducado.
> Ver [17-RECUPERACION-DE-ACCESO.md](17-RECUPERACION-DE-ACCESO.md).

`POST /api/auth/reenviar-verificacion`. El nuevo enlace invalida el anterior. Junto con 3.4
cierra RF54 por completo.

### 4.3 Exportación en PDF — RF42, RNF03, HU-03, HU-26 · 1 día

Es la única brecha que aparece en **tres** requisitos distintos. Hace falta:
- `GET /api/reportes/export/pdf`
- `GET /api/admin/auditoria/export` (CSV **y** PDF, con filtros por usuario, módulo y rango)

Sugerencia de librería: `pdfkit` (ligera, sin navegador) o `puppeteer` (mejor maquetación,
mucho más pesada). Para tablas de reportes, `pdfkit` es suficiente.

### 4.4 Aviso de proceso incompleto en el dashboard — RF17 · 2 h

El aviso existe en la ficha (`ProcesoDetalle.jsx:744`) pero no en el dashboard, que es donde el
requisito lo pide y donde realmente sirve.

### 4.5 Umbral configurable de inactividad — RF40 · 3 h

RF40 exige que el Administrador defina cuántos días sin movimiento marcan un proceso en rojo.
Hoy está fijo en 30. Añadir `Tenant.dias_inactividad_alerta` y exponerlo en Ajustes,
igual que ya se hace con `horas_ocultar_notificaciones`.

### 4.6 Reforzar RN04 · 3 h

Impedir que el abogado responsable quede sin sustituto o apuntando a un usuario inactivo,
tanto al desasignar como al cambiar el responsable principal.

### 4.7 ~~Decidir sobre la entidad "Actuación"~~ — ✅ HECHO

Implementada el 1/09/2026: modelo `Actuacion`, módulo backend con 4 endpoints, pestaña en la
ficha del expediente, RF55–RF59, HU-37 y 6 pruebas automatizadas.

> ⚠️ **Queda un paso pendiente y bloqueante: ejecutar la migración de base de datos.**
> Hasta que se ejecute, la pestaña "Actuaciones" devolverá error porque las tablas no existen.
> Ver la sección «Migración pendiente» al final de este documento.

---

## Ola 5 — Cobertura de pruebas · 2 días · 🟢

### 5.1 Aislamiento entre tenants — **la prueba que más falta**

```js
describe('RF52/RNF11: aislamiento entre consultorios', () => {
  it('no permite leer un expediente de otro consultorio');
  it('no permite leer un cliente de otro consultorio');
  it('no permite descargar un documento de otro consultorio');
  it('no permite asignar un abogado de otro consultorio a un expediente propio');
});
```

Es el requisito de seguridad central del sistema y **hoy no tiene ni una sola prueba**.
Máximo valor por esfuerzo de todo el plan de pruebas.

### 5.2 Búsqueda y paginación — HU-31, RNF05

Verificar el umbral de 3 caracteres, la combinación de filtros y la forma del objeto `pagination`.

### 5.3 Permisos granulares

Hoy solo se prueba el filtro grueso por rol. Falta verificar `requirePermission` con un usuario
que tenga `puede_leer` pero no `puede_editar`.

### 5.4 Pruebas de extremo a extremo

Cypress está instalado y configurado en el CI, pero **no hay ninguna especificación en el
repositorio**: el paso de CI pasa sin ejecutar nada. Escribir al menos el recorrido
crítico: registro → verificación → inicio de sesión → crear cliente → crear expediente.

---

## Ola 6 — Dependencias mayores · 2–3 días · 🔴

Detalle completo en [09-COMPATIBILIDAD-NODE.md § 5](09-COMPATIBILIDAD-NODE.md).

| Paso | Acción | Riesgo |
|---|---|:--:|
| 6.1 | `npm audit fix` (sin `--force`) | 🟢 |
| 6.2 | `helmet@8`, `express-rate-limit@8`, `node-cron@4`, `bcryptjs@3`, `dotenv@17` | 🟢 |
| 6.3 | `nodemailer@9`, `multer@2` | 🟡 |
| 6.4 | `prisma@7` — **combinar con la Ola 3** para pagar una sola migración | 🔴 |
| 6.5 | `express@5` — **no recomendado por ahora** | 🔴 |

---

## Decisiones que requieren aprobación, no código

Cinco puntos que ningún desarrollador debería resolver por su cuenta. Conviene decidirlos
antes de empezar la Ola 3.

| # | Decisión | Opciones | Recomendación |
|:--:|---|---|---|
| 1 | ~~**Entidad "Actuación"**~~ | ~~A: corregir el README · B: modelarla~~ | ✅ **RESUELTO 1/09/2026: se eligió B.** Modelada e implementada (RF55–RF59, HU-37, [ADR-010](11-DECISIONES-ARQUITECTONICAS.md)). **Falta ejecutar la migración de BD** |
| 2 | **Rol Colaborador / ASISTENTE** | A: `ASISTENTE` en BD + "Colaborador" en UI · B: migrar el enum | **A** — evita una migración de datos sin ganancia real ([ADR-004](11-DECISIONES-ARQUITECTONICAS.md)) |
| 3 | **RNF11: 403 o 404** | A: enmendar el requisito y conservar 404 · B: cambiar a 403 | **A** — el 404 es más seguro; añadir solo el registro en bitácora |
| 4 | **`Tenant.plan` (BASICO/PRO)** | A: retirarlo · B: implementar límites por plan | **A** por ahora — es un campo sin uso ni RF que lo respalde |
| 5 | **Alcance de `investigacion.docx`** | A: reclasificarlo como investigación de dominio · B: reconciliar las dos numeraciones RF | **A** — ya aplicado en esta documentación ([ADR-002](11-DECISIONES-ARQUITECTONICAS.md)) |

---

## Ola 7 — Calidad de código · 6–8 días · 🟡

Revisión SOLID y de código limpio con métricas reales, en
[13-CALIDAD-DE-CODIGO.md](13-CALIDAD-DE-CODIGO.md). Resumen de los pasos, en orden obligatorio:

| Paso | Qué | Esfuerzo | Riesgo |
|:--:|---|---|:--:|
| 0 | **Pruebas primero.** Sin cobertura, los pasos siguientes son a ciegas | 1 día | 🟢 |
| 1 | Extraer los ayudantes de pertenencia y auditoría (elimina 27 repeticiones) | ½ día | 🟢 |
| 2 | Partir `ProcesoDetalle.jsx`, que concentra el 36 % del frontend en 3 094 líneas | 2 días | 🟡 |
| 3 | Capa de servicios en el backend (revisa [ADR-005](11-DECISIONES-ARQUITECTONICAS.md)) | 3–4 días | 🔴 |
| 4 | ESLint en el backend, que hoy no tiene ninguno | 2 h | 🟢 |

**Nada de esto bloquea el despliegue.** El código funciona; el problema es de mantenibilidad
futura, no de corrección.

---

## ⚠️ Migración de base de datos: local hecha, producción pendiente

### Estado en desarrollo — ✅ aplicada

Migración `20260901203729_agregar_actuaciones`, ejecutada el 1/09/2026 sobre la base local
(`localhost:5432/sistema_juridico`). Verificada en ejecución: se registró una actuación, se
vinculó un término y la ficha muestra la cadena completa.

### Estado en producción — ⚠️ NO aplicada, y no basta con `migrate deploy`

Hay una trampa concreta que conviene entender antes de desplegar.

La base local estaba **vacía**, así que Prisma generó una migración que **crea el esquema
completo** (17 tablas, 16 enums), no solo lo nuevo. La base de producción, en cambio, ya
tiene todas esas tablas, porque se gestionó con `prisma db push` (así lo describía el README).

**Si se ejecuta `npx prisma migrate deploy` contra producción, fallará** con
`relation "tenants" already exists`.

Dos caminos, en orden de preferencia:

**Opción A — Seguir con `db push` (recomendada, la más simple).**
Es el mecanismo con el que ya se venía gestionando esa base. `db push` compara el esquema
con la base y aplica **solo la diferencia**: crearía `actuaciones`, el enum `TipoActuacion`,
los dos índices y la columna anulable `id_actuacion`. Nada más.

```bash
cd backend && npx prisma db push
```

Revisar la salida antes de confirmar: si menciona **borrar** algo, detenerse.

**Opción B — Adoptar migraciones formalmente (más trabajo, mejor a largo plazo).**
Marcar la migración como ya aplicada (*baseline*) y aplicar el delta a mano:

```bash
# 1. Aplicar solo el delta con SQL
#    CREATE TYPE "TipoActuacion" ...
#    CREATE TABLE "actuaciones" ...
#    CREATE INDEX ...
#    ALTER TABLE "terminos_judiciales" ADD COLUMN "id_actuacion" UUID;
#    ALTER TABLE "terminos_judiciales" ADD CONSTRAINT ... FOREIGN KEY ...

# 2. Decirle a Prisma que la migración ya está aplicada
npx prisma migrate resolve --applied 20260901203729_agregar_actuaciones
```

**En cualquiera de los dos casos: copia de seguridad antes.**

### Qué introduce el cambio

Ambos son **aditivos**; no borran ni modifican datos existentes:

1. Tabla nueva `actuaciones` con su enum `TipoActuacion` y dos índices.
2. Columna nueva `id_actuacion` en `terminos_judiciales`, **anulable** — las filas
   existentes quedan en `NULL` y siguen funcionando igual.

> **Hasta que se aplique en producción, la pestaña «Actuaciones» responderá con error 500**
> en ese entorno. El resto del sistema no se ve afectado: ningún flujo previo consulta las
> tablas nuevas.

### Datos de prueba para desarrollo

`backend/prisma/seed-dev.js` crea un consultorio, un administrador, un cliente y un expediente
de ejemplo. **Solo siembra si la base está vacía**, para no duplicar nada, y no debe ejecutarse
contra producción.

```bash
cd backend && node prisma/seed-dev.js
```

---

## Si solo hubiera tiempo para una tarde

En orden, dos horas de trabajo que cambian la percepción del proyecto:

1. `git add backend/src/config/webhook.js` — sin esto el repositorio está roto para terceros.
2. `Lexica` → `SGPA` — dos cadenas, arreglan una fisura de confianza en el registro.
3. Ejecutar la españolización de la interfaz — es la queja original y se ve de inmediato.
4. Corregir `.env.example` — sin esto nadie puede levantar el proyecto desde cero.
5. Corregir el `README.md` (microservicios, versiones, R2, despliegue).
6. Enlazar `docs/README.md` como índice de la documentación.

Eso deja el repositorio **clonable, coherente y en español**, que es exactamente el problema
que se planteó al inicio.
