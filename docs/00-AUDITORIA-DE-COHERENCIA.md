# 00 — Auditoría de coherencia: documentación vs. plataforma construida

**Fecha:** 1 de septiembre de 2026
**Alcance auditado:** `backend/` (11 módulos, 51 endpoints), `frontend/` (17 páginas), `docs/` (13 archivos), `.github/workflows/`
**Método:** lectura completa del código fuente, del esquema Prisma, de las rutas y de los cuatro documentos de especificación; contraste uno a uno.

---

## Resumen ejecutivo

La plataforma construida es **mejor de lo que la documentación sugiere**. El código implementa
fielmente la mayoría de las reglas de negocio difíciles (clasificación automática de términos
tardíos, bloqueo de archivado con pendientes, cierre restringido de alertas críticas,
agrupación de alertas en ventanas de 10 minutos, versionado documental). El problema **no es
que el sistema esté mal hecho, es que nadie actualizó los papeles**.

Se identificaron **27 hallazgos**, clasificados así:

| Tipo | Cantidad | Qué significa |
|---|---|---|
| 🟦 **Documento desactualizado** | 15 | El código está bien; el documento miente. Se corrige el documento. |
| 🟥 **Defecto de implementación** | 9 | El requisito es correcto y el código no lo cumple. Se corrige el código. |
| 🟨 **Ambigüedad de especificación** | 3 | Dos documentos se contradicen entre sí. Hace falta una decisión humana. |

Seis son de severidad alta: H-10, H-19, H-20, H-21, H-24 y **H-27**.
H-27 se detectó probando el sistema con datos reales, no leyendo código — es el argumento
a favor de verificar ejecutando, no solo revisando.

---

## A. Arquitectura

### H-01 🟦 El sistema se documenta como "microservicios" y es un monolito modular

- **Dice el documento:** `README.md:10` y `docs/historico/arquitectura.md:4` — *"arquitectura de microservicios lógicos (modular)"*.
- **Dice el código:** `backend/server.js` levanta **un único proceso** Express; `backend/src/app.js:21-43` monta los 11 módulos como routers de la misma aplicación; todos comparten una sola instancia de Prisma (`src/config/prisma.js`) y una sola base de datos.
- **Por qué importa:** "microservicios" implica servicios desplegables por separado, comunicación entre procesos y bases de datos independientes. Nada de eso existe. Usar el término en una sustentación académica es un error conceptual que invalida el resto de la argumentación arquitectónica.
- **Nombre correcto:** **Monolito modular con organización por capas**. Ver [01-ARQUITECTURA.md](01-ARQUITECTURA.md) y [ADR-001](11-DECISIONES-ARQUITECTONICAS.md).
- **Acción:** corregir `README.md` y sustituir `docs/historico/arquitectura.md`.

### H-02 🟦 El diagrama de arquitectura referencia un archivo que no existe

- **Dice el diagrama:** `docs/fuentes/Diagramas_v2.xml`, página *"arquitectura general"*, celda 202: *"`tenant.middleware.js` → entre auth y roles"*.
- **Dice el código:** `backend/src/middlewares/` contiene exactamente tres archivos: `audit.middleware.js`, `auth.middleware.js`, `roles.middleware.js`. **No hay `tenant.middleware.js`.**
- **Dónde está realmente la lógica de tenant:** en `auth.middleware.js:29`, la línea `req.tenant_id = user.tenant_id;` — el tenant se resuelve dentro del middleware de autenticación, no en uno propio.
- **Acción:** el diagrama Mermaid del doc 01 ya refleja la realidad. Regenerar el `.xml` o marcarlo como histórico.

### H-03 🟦 Las rutas públicas del diagrama no coinciden con las reales

- **Dice el diagrama:** `/registro` y `/verificar-email`.
- **Dice el código:** `frontend/src/App.jsx:74` define `/verificacion` (no `/verificar-email`); el endpoint de backend es `GET /api/auth/verificar/:token` (`auth.routes.js`).
- **Acción:** corregido en el doc 06.

### H-04 🟦 No se documenta en ninguna parte la integración con n8n

- **Dice el código:** existe `backend/src/config/webhook.js`, y se invoca en `procesos.controller.js` (`triggerWebhook('ACTUALIZACION_PROCESO', ...)`) al cambiar el estado de un expediente. Depende de la variable `N8N_WEBHOOK_URL`.
- **Dice el documento:** nada. Ni arquitectura, ni especificaciones técnicas, ni `.env.example`.
- **Riesgo:** un desarrollador nuevo no sabe que existe un canal de salida hacia un sistema externo. Es información relevante para el análisis de tratamiento de datos personales (Ley 1581 de 2012).
- **Acción:** documentado en el doc 01 y en el doc 09 (variables de entorno). Archivo actualmente **sin versionar en Git** — debe agregarse.

---

## B. Stack tecnológico

### H-05 🟦 Las versiones documentadas están una generación por detrás

| Componente | Dice `README.md` / `especificaciones_tecnicas.md` | Realidad (`package.json` + `npm ls`) |
|---|---|---|
| React | 18 | **19.2.6** |
| React Router | v6 | **v7.15.1** |
| Tailwind CSS | v3 (JIT) / v4 (según el doc) | **v4.3.0** (`@tailwindcss/postcss`) |
| Vite | sin versión | **v8.0.12** |
| Node.js | v18+ | **v24.16.0** en la máquina; **v22** en CI |
| Prisma | v5 | **5.22.0** (correcto, pero fuera de soporte) |
| Express | sin versión | **4.22.2** |

- **Acción:** ver [09-COMPATIBILIDAD-NODE.md](09-COMPATIBILIDAD-NODE.md).

### H-06 🟦 El documento dice Supabase Storage; el código usa Cloudflare R2

- **Dice `especificaciones_tecnicas.md`:** almacenamiento y base de datos en Supabase.
- **Dice el código:** `backend/src/config/supabase.js` contiene una sola línea: `// File deprecated. Now using Cloudflare R2`. El almacenamiento real es `backend/src/config/cloudflare.js`, un `S3Client` apuntando a `R2_ENDPOINT`, con URLs firmadas vía `@aws-sdk/s3-request-presigner`.
- **Matiz:** PostgreSQL **sí** sigue en Supabase (`DATABASE_URL` con PgBouncer). Lo que cambió es el almacenamiento de archivos.
- **Acción:** corregido en el doc 01.

### H-07 🟥 `.env.example` está desalineado con las variables que el código realmente lee

- **Pide `.env.example`:** `SUPABASE_URL`, `SUPABASE_KEY` — ya no se usan.
- **No documenta, pero el código las necesita:** `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` (`config/cloudflare.js`), **`R2_BUCKET_NAME`** (`documentos.controller.js`, `tenant.controller.js`), `R2_PUBLIC_DOMAIN` y `R2_ACCOUNT_ID` (`tenant.controller.js`), `FRONTEND_URL` (`auth.controller.js:56`), `DEV_AUTO_VERIFY` (`auth.controller.js:38`), `N8N_WEBHOOK_URL` (`config/webhook.js`).
- **Nota de método:** las tres variables `R2_BUCKET_NAME`, `R2_PUBLIC_DOMAIN` y `R2_ACCOUNT_ID` se pasaron por alto en la primera revisión, que solo miró `config/cloudflare.js`. Aparecieron al validar el despliegue con Docker. El inventario definitivo se obtiene con `grep -rhoE "process\.env\.[A-Z0-9_]+" backend/src backend/server.js | sort -u`, que es el método correcto.
- **Consecuencia práctica:** quien clone el repositorio y siga el README **no logrará subir un solo documento**, porque el cliente R2 se construirá sin credenciales.
- **Acción:** ver el listado corregido en [09-COMPATIBILIDAD-NODE.md](09-COMPATIBILIDAD-NODE.md#variables-de-entorno-reales).

### H-08 🟦 El README describe un despliegue en Vercel; el sistema está desplegado en subcarpeta

- **Dice `README.md`:** desplegar el frontend en Vercel apuntando a la carpeta `frontend`.
- **Dice el código:** `vite.config.js` fija `base: '/sistema-juridico/'` y `App.jsx:69` fija `basename="/sistema-juridico"`. `auth.controller.js:56` usa por defecto `https://proyectosena.online/sistema-juridico`. El commit `a21030f` corrige explícitamente redirecciones "para prevenir 404 de Nginx en subcarpeta".
- **Conclusión:** el despliegue real es **detrás de Nginx en una subcarpeta** de un VPS propio, no en Vercel. `frontend/vercel.json` era un residuo.
- **Acción:** ✅ corregido en el doc 01 (vista de despliegue) y `frontend/vercel.json` **retirado** el 1/09/2026, confirmado por el responsable del proyecto.

---

## C. Roles y nomenclatura

### H-09 🟨 "Colaborador" (requisitos) vs. `ASISTENTE` (base de datos)

- **Dicen los requisitos:** `sistema.docx` RF02 — roles *Administrador, Abogado, **Colaborador**, Cliente*. Igual en todas las HU.
- **Dice el código:** `schema.prisma`, enum `RolUsuario { ADMINISTRADOR, ABOGADO, ASISTENTE, CLIENTE }` y enum `RolProcesoAbogado { ABOGADO, ASISTENTE }`. El frontend valida `allowedRoles={['ADMINISTRADOR','ABOGADO','ASISTENTE']}` (`App.jsx:78`).
- **Nota histórica:** `Reporte_Coherencia_SGPA.md` recomendó lo contrario (renombrar todo a "Colaborador"). Esa recomendación **nunca se aplicó** y hoy exigiría una migración de datos con `ALTER TYPE` en PostgreSQL sobre una columna en uso.
- **Decisión adoptada:** conservar `ASISTENTE` como identificador técnico y usar **"Colaborador"** como etiqueta visible en la interfaz. Justificación completa en [ADR-004](11-DECISIONES-ARQUITECTONICAS.md).

---

## D. Requisitos e historias de usuario

### H-10 🟨 **[SEVERIDAD ALTA]** Existen dos numeraciones RF incompatibles

Este es el hallazgo más grave de la auditoría.

| Fuente | Numeración | Alcance descrito |
|---|---|---|
| `sistema.docx` | **RF01 – RF54**, RNF01–RNF11, RN01–RN08 | SaaS multi-tenant, 4 roles, portal del cliente con descargas, verificación de correo, R2/Supabase |
| `investigacion.docx` | **RF01 – RF09**, RNF01–RNF03 | MVP en VPS propio, 3 roles, Next.js + TypeScript, disco local cifrado AES-256-GCM, crontab del sistema, **sin descarga de documentos en el portal**, sin multi-tenant |

`RF01` significa "inicio de sesión" en un documento y "registro del cliente/proceso" en el otro.
`RF04` significa "un abogado ve solo sus procesos asignados" en uno y "vigilancia de términos" en el otro.
**Cualquier matriz de trazabilidad que mezcle ambas fuentes es inválida.**

- **Qué construyó el equipo:** el sistema de `sistema.docx` (multi-tenant, 4 roles, portal con descargas, Cloudflare R2, `node-cron` dentro del proceso Node).
- **Decisión adoptada:** `sistema.docx` es **la especificación funcional vigente**. `investigacion.docx` se reclasifica como **investigación de dominio y benchmark**: su valor real —que es alto— está en el glosario jurídico, la anatomía del radicado de 23 dígitos, la matriz de supuestos SUP-01…SUP-12 y la declaración de método. Su numeración RF se retira de circulación.
- **Acción:** ver [ADR-002](11-DECISIONES-ARQUITECTONICAS.md) y el rescate del contenido en [07-GLOSARIO-JURIDICO.md](07-GLOSARIO-JURIDICO.md).

### H-11 🟦 `Combined_Sprint_Stories.md` lista 34 historias; el documento maestro tiene 36

- **Faltan:** `HU-35 Registro en la plataforma` (RF51, RF54) y `HU-36 Configurar perfil del consultorio` (RF53).
- **Ironía:** ambas **están implementadas** (`POST /api/auth/registro`, `PUT /api/tenant/perfil`, páginas `RegisterPage.jsx` y `AjustesPage.jsx`). El resumen de sprints omite dos funcionalidades que sí existen.
- **Alcance de la desactualización:** `Jira_Import_Stories.csv` hereda la omisión (también se queda en 34). En cambio **`Jira_Sprints_Plan_v2.md` sí contiene las 36** — es el único derivado que está al día en cuanto a cobertura, aunque conserva la distribución de sprints sobrecargada que se corrige en el doc 04.

### H-12 🟦 `Reporte_Coherencia_SGPA.md` está caducado

Analiza archivos que **ya no existen en el repositorio**: `Historias_de_Usuario_Sistema_Juridico.docx` y `Diagramas.xml` (hoy son `HU_Sistema_Juridico_v3.docx` y `Diagramas_v2.xml`). Además reporta como pendientes cosas ya resueltas:

- Reporta faltantes HU-31, HU-32, HU-33, HU-34 → **las cuatro ya existen** en `HU_Sistema_Juridico_v3.docx` y están implementadas.
- Reporta la contradicción RF28 vs RF29 → **ya está resuelta**: en la versión actual de `sistema.docx`, RF29 remite explícitamente a los valores de RF28.
- Reporta ausencia de trazabilidad de RF34 en HU-21 → **ya corregida**: HU-21 lista hoy `RF32 | RF34 | RF37`.

**Acción:** archivarlo como documento histórico. Este documento (00) lo reemplaza.

### H-13 🟨 `RN09` se cita pero no existe

`HU-24` (Ver panel principal según rol) declara como regla asociada `RN09`. `sistema.docx` define únicamente **RN01 a RN08**. No hay RN09 en ninguna parte.

- **Interpretación probable:** el criterio de aceptación de HU-24 *"el color rojo solo se usa para condiciones de riesgo procesal o disciplinario, nunca decorativo"* tiene forma de regla de negocio y probablemente era RN09.
- **Acción propuesta:** formalizar esa frase como **RN09 — Semántica del color de riesgo** en el doc 03, o eliminar la referencia. Se optó por formalizarla, porque el frontend efectivamente la respeta.

### H-14 🟦 HU-29 tiene dos estimaciones distintas dentro del mismo documento

En `HU_Sistema_Juridico_v3.docx`: la tabla resumen dice **3 pts**; el detalle de la historia dice **4 pts**. Corregido a 4 pts en el doc 04 (prevalece el detalle).

### H-15 🟦 La numeración de RNF salta el 09

`sistema.docx` va de RNF08 a RNF10. No es un error: RNF03 declara ser *"fusión de RNF03 y RNF09 originales"*. Se documenta para que nadie lo reporte como faltante otra vez.

---

## E. Modelo de datos

### H-16 🟦 El diagrama `diagrama_db.txt` no incluye 11 campos que sí existen

Campos presentes en `schema.prisma` y ausentes del diagrama:

| Tabla | Campos faltantes en el diagrama |
|---|---|
| `tenants` | `horas_ocultar_notificaciones` |
| `usuario` | `intentos_fallidos`, `bloqueado_hasta`, `codigo_2fa`, `expira_2fa`, `token_verificacion`, `preferencia_canal`, `pref_prioridad_audiencia`, `pref_prioridad_termino`, `pref_prioridad_tarea` |
| `procesos` | `update_at` |
| `notificaciones` | `updated_at` |

Son precisamente los campos que soportan 2FA, bloqueo progresivo de cuenta, verificación de correo y preferencias de notificación. **El diagrama describe el sistema antes de que existieran esas funciones.**

### H-17 🟦 Discrepancia de tipo en `versiones_documentos.nombre_archivo`

Diagrama: `varchar(20)`. Esquema real: `@db.VarChar(255)`. El diagrama es incorrecto — 20 caracteres no alcanzan para un nombre de archivo real.

### H-18 🟥 Falta la categoría documental `ESCRITOS` exigida por RF19

- **Exige RF19:** siete categorías — *demandas, pruebas, contratos, **escritos**, notificaciones, providencias, otros*. HU-13 repite las siete.
- **Implementa el código:** `enum CategoriaDocumento { DEMANDA, PRUEBA, CONTRATO, NOTIFICACION, PROVIDENCIA, OTRO }` — **seis**. Falta `ESCRITO`.
- **Verificación:** `grep -rn "ESCRITO" backend/src frontend/src` → sin resultados.
- **Impacto:** bajo funcionalmente (los escritos caen en `OTRO`), pero es un incumplimiento literal y verificable de un RF. Corrección: agregar el valor al enum + migración. Coste estimado: 30 minutos.

### H-19 🟥 **[SEVERIDAD ALTA]** Tres restricciones `@unique` son globales y deberían ser por tenant

```prisma
model Usuario  { email            String @unique }   // schema.prisma
model Cliente  { numero_documento String @unique }
model Proceso  { numero_radicado  String @unique }
```

- **Exige RF52 / RNF11:** aislamiento lógico estricto entre tenants.
- **Consecuencia real:** si el Consultorio A registra al cliente con cédula `1.020.304`, **ningún otro consultorio del país puede registrar a esa misma persona**. Peor aún, el mensaje de error revela información de otro tenant: `procesos.controller.js:10` responde *"El número de radicado ya existe en el sistema"* aunque el radicado pertenezca a otro consultorio. Eso es una **fuga de información entre tenants por canal lateral**.
- **Escenario concreto:** dos despachos que litigan lados opuestos del mismo proceso — situación cotidiana — no pueden coexistir en la plataforma.
- **Corrección:** cambiar a claves compuestas.
  ```prisma
  @@unique([tenant_id, numero_documento])
  @@unique([tenant_id, numero_radicado])
  ```
  `Usuario.email` es un caso aparte: al ser la credencial de inicio de sesión y no llevar selector de tenant en el login, debe **permanecer globalmente único**. Se documenta como limitación consciente en [ADR-003](11-DECISIONES-ARQUITECTONICAS.md).
- **Prioridad:** alta. Requiere migración de datos.

### H-20 🟥 **[SEVERIDAD ALTA]** El inicio de sesión no se registra en la bitácora

- **Exige RF05 y RNF03:** *"Definir explícitamente: **inicio/cierre de sesión**, creación/edición/eliminación…"*. HU-03 lo repite como criterio de aceptación.
- **Dice el código:** `backend/src/modules/auth/auth.controller.js:227` — `// Todo: Record audit login`. El comentario sigue ahí; nunca se implementó.
- **Verificación:** `auth.routes.js` no aplica `auditMiddleware` a ninguna ruta, y `audit.middleware.js:9` solo registra métodos mutantes con respuesta 2xx en rutas que lo declaren.
- **Impacto:** el sistema **no puede responder "¿quién entró y cuándo?"**, que es la pregunta más elemental de una auditoría de seguridad y un requisito explícito de trazabilidad para software jurídico.
- **Corrección:** insertar el registro en bitácora tras un login exitoso, tras un login fallido y en el cierre de sesión. Coste estimado: 1 hora.

---

## F. Estado del repositorio

### H-21 🟥 **[SEVERIDAD ALTA]** Colisión de mayúsculas entre dos archivos de manual

```
$ git ls-files docs/ | grep -i manual
docs/MANUAL_USUARIO.md
docs/manual_usuario.md
```

Git rastrea **dos rutas distintas**. Windows tiene sistema de archivos insensible a mayúsculas, así que en disco solo puede existir **una**. Efecto observable en `git status`:

```
M docs/MANUAL_USUARIO.md      →  157 líneas modificadas
```

Ese "cambio" es ficticio: Git está comparando el contenido de `manual_usuario.md` (el archivo que sí existe en disco) contra el blob de `MANUAL_USUARIO.md`. En un checkout en Linux (el runner de CI, o un compañero con Ubuntu) aparecerían **dos manuales distintos y divergentes**.

- **Corrección sugerida** — decidir cuál conservar y eliminar la otra ruta del índice:
  ```bash
  git rm --cached docs/manual_usuario.md
  ```
  (o a la inversa). Revisar el contenido de ambos blobs antes de decidir:
  ```bash
  git show HEAD:docs/MANUAL_USUARIO.md | head -40
  ```
- **Prioridad:** alta, porque bloquea cualquier trabajo limpio con Git.

### H-22 🟥 Un archivo con lógica activa está sin versionar

```
?? backend/src/config/webhook.js
?? docs/fuentes/investigacion.docx
```

`webhook.js` es importado por `procesos.controller.js`. **Si otro desarrollador clona el repositorio, el backend no arranca**: `Cannot find module '../../config/webhook'`. Debe agregarse a Git de inmediato.

`investigacion.docx` es la fuente del glosario jurídico y de la matriz de supuestos; también conviene versionarlo.

---

## G. Idioma

### H-23 🟦 La interfaz está parcialmente en inglés

El requisito implícito es una plataforma en español para abogados colombianos. La interfaz mezcla ambos idiomas. Textos visibles en inglés localizados en **6 archivos**:

`DashboardLayout.jsx`, `PortalLayout.jsx`, `LoginPage.jsx`, `RegisterPage.jsx`, `TwoFactorPage.jsx`, `VerificacionPage.jsx`.

Ejemplos: *Clients*, *Legal Cases*, *Access Control*, *Audit Logs*, *Sign Out*, *Welcome to SGPA*, *Secure Portal for Legal Professionals*, *Forgot Password?*, *Create an Account*, *My Cases*, *Client Portal*.

Inventario completo con traducción propuesta: [08-PLAN-ESPANOLIZACION.md](08-PLAN-ESPANOLIZACION.md).

### H-24 🟥 **[SEVERIDAD ALTA]** La marca del producto es inconsistente: "SGPA" vs. "Lexica"

- `TwoFactorPage.jsx:51` y `VerificacionPage.jsx:46` muestran **"Lexica"**.
- Todas las demás pantallas muestran **"SGPA"**.

Un usuario que se registra ve "SGPA", recibe el correo, hace clic en el enlace de verificación y aterriza en una pantalla de una marca **distinta**. Eso se lee como suplantación de identidad y destruye la confianza justo en el punto más delicado del embudo. Es un defecto de producto, no cosmético.

- **Corrección:** dos cadenas de texto. Coste: 2 minutos. Prioridad alta por impacto/esfuerzo.

### H-25 🟦 Los comentarios del código mezclan español e inglés

De 275 comentarios en `backend/src`, aproximadamente **177 están en inglés** (*"Function that executes the reminder check"*, *"Only log successful mutating actions"*, *"Apply authentication middleware to all routes"*), conviviendo con comentarios en español en los mismos archivos.

- **Matiz importante:** los **identificadores** del código (`createProceso`, `getAlertasVencimientos`, `tenant_id`) están mayoritariamente en español o son términos técnicos estándar. Renombrarlos sería una refactorización riesgosa sin beneficio real.
- **Recomendación:** traducir comentarios y mensajes al usuario; **no** renombrar identificadores. Ver el doc 08.

---

## H. Requisitos no implementados o parciales

### H-26 🟥 Siete requisitos declarados no están completamente implementados

Detalle completo con evidencia en [03-CATALOGO-REQUISITOS.md](03-CATALOGO-REQUISITOS.md). Resumen:

| Requisito | Qué exige | Qué hay | Brecha |
|---|---|---|---|
| RNF02 | Sesión inactiva se cierra a los 30 min | JWT fijo de 8 h (`utils/jwt.js`), sin refresco ni control de inactividad | No implementado |
| RNF02 | Contraseña ≥8 con mayúscula, número y símbolo | `auth.controller.js: registro` no valida ningún patrón | No implementado (backend) |
| RNF02 | Desbloqueo por correo de recuperación o por el Administrador | No existe endpoint; el enlace *"Forgot Password?"* es `<Link to="#">` | No implementado |
| RNF03 / HU-26 | Exportar bitácora y reportes en **CSV o PDF** | Solo CSV (`reportes.controller.js:201`). La bitácora no tiene endpoint de exportación | Parcial |
| RF54 | Enlace de verificación con vigencia de 24 h, un solo uso y reenvío | `token_verificacion` no guarda fecha de emisión; `verificarEmail` no valida vigencia; no hay endpoint de reenvío | Parcial |
| RF17 | Aviso de proceso incompleto en **el dashboard y** la ficha | Solo en la ficha (`ProcesoDetalle.jsx:744`) | Parcial |
| RN04 | No desasignar al único abogado responsable | `removeAbogadoProceso` asume que `id_abogado_resp` lo garantiza, pero no valida el cambio del responsable principal | Parcial |

---

## Lo que sí está bien y conviene reconocer

Para no dejar una lectura injustamente negativa, estas reglas de negocio complejas **están correctamente implementadas** y verificadas en el código:

- **RN07** — Clasificación automática de término tardío: `terminos.controller.js` reclasifica `CUMPLIDO` → `CUMPLIDO_TARDIO` si `now > vencimiento`, y bloquea la sobrescritura a no administradores, dejando registro `SOBREESCRITURA_TERMINO_TARDIO` en bitácora.
- **RN08 + RN02** — Cierre de alertas críticas: `notificaciones.controller.js` permite cerrar una alerta ALTA solo al destinatario, y al Administrador **únicamente si el destinatario está inactivo**. Justo la restricción que el `Reporte_Coherencia` daba por contradictoria.
- **RN05** — Bloqueo de archivado con términos pendientes o audiencias en 30 días, con forzado explícito solo por Administrador y registro en historial.
- **RN03** — Reactivación de expediente finalizado/archivado restringida a Administrador con justificación obligatoria.
- **RF47** — Agrupación de más de 5 alertas del mismo evento en ventana de 10 minutos: implementada con un algoritmo de ventana deslizante real en `notificaciones.controller.js`.
- **RF23 / HU-15** — Versionado documental con `id_version_actual` y descarga de versiones anteriores por URL firmada.
- **RNF05 / HU-31** — Búsqueda parcial desde 3 caracteres, filtros combinables y paginación de 20: `procesos.controller.js: getProcesos`.
- **Multi-tenancy** — 118 referencias a `tenant_id` distribuidas en los 11 controladores; el filtrado es sistemático, no ocasional.

---

## I. Fechas

### H-27 🟥 **[SEVERIDAD ALTA]** Las fechas sin hora se mostraban con un día menos

Detectado el 1/09/2026 al probar la plataforma con datos reales. **Ya está corregido.**

- **Síntoma:** se registra una actuación con fecha **20/06/2026** y la ficha muestra **19/6/2026**.
  Se sembró un expediente con `fecha_radicado = 2026-03-10` y la pestaña General mostró **9/3/2026**.
- **El dato se guardaba bien.** Consultando la base directamente: `2026-06-20T00:00:00.000Z`.
  El fallo era **solo de visualización**.
- **Causa:** las columnas `@db.Date` (`fecha_radicado`, `fecha_actuacion`, `fecha_nacimiento`)
  guardan un **día del calendario**, no un instante. Prisma las devuelve como medianoche UTC.
  `new Date(valor).toLocaleDateString()` convierte esa medianoche a la zona local: en Colombia
  (UTC-5) cae a las 19:00 del **día anterior**.
- **Por qué importa aquí más que en otros sistemas:** de estas fechas dependen los términos
  procesales, y un término es perentorio — al vencer se extingue el derecho (Art. 117 CGP).
  Una fecha corrida un día no es un detalle cosmético.
- **Alcance:** 5 instancias en 4 archivos — `ProcesoDetalle.jsx` (2), `ProcesosList.jsx`,
  `ClienteFicha.jsx`, `PortalProcesoDetalle.jsx`. **Cuatro de las cinco eran preexistentes**;
  solo la de `fecha_actuacion` provenía del trabajo de esta sesión.
- **Corrección aplicada:** helper `formatFechaSinHora()` en `frontend/src/lib/utils.js`, que
  fuerza `timeZone: 'UTC'`. Documenta explícitamente que **no** debe usarse para fechas con
  hora real (`fecha_hora` de audiencias, `fecha_vencimiento` de términos, `created_at`):
  esas sí deben mostrarse en la zona del usuario.
- **Verificado:** tras el arreglo, la ficha muestra `10/3/2026` y `20/6/2026`.

> **Pendiente relacionado:** revisar si el mismo patrón afecta a la exportación CSV de reportes
> y a las plantillas de correo del cron, que también formatean fechas.

---

## Siguiente paso

Este documento describe **qué** está mal. El orden de corrección, el esfuerzo y el riesgo de cada
arreglo están en [10-PLAN-DE-REMEDIACION.md](10-PLAN-DE-REMEDIACION.md).
