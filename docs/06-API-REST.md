# 06 — Catálogo de la API REST

**Base:** `/api` · **Formato:** JSON · **Autenticación:** `Authorization: Bearer <JWT>`
**Total:** 67 endpoints en 13 módulos (+ 1 de salud).
Extraído directamente de los archivos `*.routes.js`. Recuento reproducible:

```bash
grep -rhoE "router\.(get|post|put|patch|delete)\(" backend/src/modules/*/*.routes.js | wc -l
```

---

## Cómo leer las columnas

- **Auth** — requiere JWT válido.
- **Permiso** — `requirePermission(MODULO, ACCION)` contra la tabla `permiso_rol`.
  Los `ADMINISTRADOR` siempre pasan sin consultar la tabla.
- **Rol** — `requireRole([...])`, filtro grueso adicional.
- **Audit** — la ruta declara `auditMiddleware`, que escribe en bitácora al terminar
  la respuesta si el método fue mutante y el código de estado fue 2xx.

---

## 1. Autenticación — `/api/auth` (10)

| Método | Ruta | Auth | Permiso | Audit | Qué hace | HU |
|---|---|:--:|---|:--:|---|---|
| POST | `/registro` | — | — | — | Crea tenant + usuario administrador en una transacción; envía correo de verificación | HU-35 |
| GET | `/verificar/:token` | — | — | — | Activa la cuenta y anula el token. El enlace caduca a las 24 h (RF54) | HU-35 |
| POST | `/reenviar-verificacion` | — | — | — | Reenvía el correo de activación con un token nuevo. Máx. 5 cada 15 min. Responde igual exista o no la cuenta | RF54 |
| POST | `/recuperar` | — | — | — | Envía el enlace para restablecer la contraseña. Máx. 5 cada 15 min. Responde igual exista o no la cuenta | HU-01 |
| POST | `/restablecer` | — | — | — | Fija la contraseña nueva. Enlace de un solo uso y 1 h de vigencia; desbloquea al usuario y queda en la bitácora | HU-01 |
| POST | `/login` | — | — | — | Valida credenciales; aplica bloqueo progresivo; devuelve JWT o `require2FA` | HU-01 |
| POST | `/2fa/verificar` | preAuth | — | — | Canjea el código OTP por el JWT definitivo | HU-32 |
| GET | `/perfil` | ✔ | — | — | Datos del usuario en sesión + preferencias | HU-01 |
| PUT | `/preferencias` | ✔ | — | — | Canal y prioridades por tipo de evento | HU-29 |
| POST | `/2fa/configurar` | ✔ | — | — | Activa o desactiva el segundo factor | HU-32 |
| POST | `/logout` | ✔ | — | — | Registra el cierre de sesión en la bitácora. El JWT sigue siendo válido hasta caducar: la sesión se descarta en el navegador (ver nota) | HU-01 |

> **Auditoría de sesión (RF05).** `login`, `2fa/verificar` y `logout` escriben en la bitácora a
> través de `sesion.auditoria.js`: entrada, entrada con doble factor, intento fallido, bloqueo
> por intentos y cierre. El registro nunca interrumpe la petición —si la bitácora falla, se
> traza el error y el usuario entra igual—, porque un problema de auditoría no puede dejar a
> nadie fuera del sistema.

> **Por qué existe `POST /logout` si el JWT no se invalida.** Un JWT es autocontenido y no se
> revoca sin mantener una lista de tokens anulados, que este sistema no lleva. La ruta no
> pretende invalidar nada: existe para que el cierre de sesión **deje rastro**. Sin ella, la
> bitácora podría decir quién entró pero nunca quién salió.

**Cuerpo de `POST /login`:** `{ email, password }`
**Respuesta sin 2FA:** `{ token, user: { id, nombre, rol, tenant_id } }`
**Respuesta con 2FA:** `{ message, require2FA: true, preAuthToken }` (el `preAuthToken` vive 10 min)
**Respuesta con cuenta bloqueada:** `403 { error, lockUntil }` — el frontend usa `lockUntil` para pintar la cuenta regresiva

---

## 2. Tenant — `/api/tenant` (2)

| Método | Ruta | Auth | Rol | Qué hace | HU |
|---|---|:--:|---|---|---|
| GET | `/perfil` | ✔ | cualquiera | Datos del consultorio | HU-36 |
| PUT | `/perfil` | ✔ | `ADMINISTRADOR` | Actualiza datos y logo (`multipart`, JPG/PNG, máx. 2 MB) | HU-36 |

---

## 3. Clientes — `/api/clientes` (5)

| Método | Ruta | Permiso | Audit | Qué hace | HU |
|---|---|---|:--:|---|---|
| POST | `/` | `CLIENTES:CREAR` | ✔ | Registra cliente natural o jurídico; dispara webhook `NUEVO_CLIENTE` | HU-04, HU-05 |
| GET | `/` | `CLIENTES:LEER` | — | Lista los clientes del tenant | HU-06 |
| GET | `/:id` | `CLIENTES:LEER` | — | Ficha con sus procesos asociados | HU-06 |
| PUT | `/:id` | `CLIENTES:EDITAR` | ✔ | Actualiza datos | HU-06 |
| POST | `/:id/portal-access` | `CLIENTES:EDITAR` | ✔ | Genera credenciales de portal para el cliente | HU-27 |

---

## 4. Procesos — `/api/procesos` (10)

| Método | Ruta | Permiso | Audit | Qué hace | HU |
|---|---|---|:--:|---|---|
| POST | `/` | `PROCESOS:CREAR` | ✔ | Crea expediente; valida radicado no duplicado | HU-07 |
| GET | `/` | `PROCESOS:LEER` | — | **Búsqueda y paginación.** Query: `search`, `estado`, `tipo_proceso`, `page`, `limit` | HU-31 |
| GET | `/:id` | `PROCESOS:LEER` | — | Detalle con cliente, equipo, partes e historial | HU-07, HU-10 |
| PUT | `/:id` | `PROCESOS:EDITAR` | ✔ | Edita juzgado, clase, área y fecha. **El radicado no es modificable** | HU-33 |
| POST | `/:id/abogados` | `PROCESOS:EDITAR` | ✔ | Asigna abogado o colaborador | HU-08 |
| DELETE | `/:id/abogados/:id_usuario` | `PROCESOS:EDITAR` | ✔ | Desasigna | HU-08 |
| PUT | `/:id/estado` | `PROCESOS:EDITAR` | ✔ | Cambia estado aplicando RN03 y RN05; dispara webhook | HU-09 |
| POST | `/:id/partes` | `PROCESOS:EDITAR` | ✔ | Registra parte procesal | HU-11 |
| DELETE | `/:id/partes/:id_parte` | `PROCESOS:EDITAR` | ✔ | Elimina parte procesal | HU-11 |
| DELETE | `/:id` | `PROCESOS:ELIMINAR` | ✔ | Borrado definitivo en cascada. Exige `ADMINISTRADOR` + `justificacion` | HU-34 |

**`GET /api/procesos` — contrato de búsqueda (RNF05):**

```http
GET /api/procesos?search=11001&estado=ACTIVO&page=1&limit=20
```

```json
{
  "procesos": [ /* ... */ ],
  "pagination": { "total": 137, "page": 1, "limit": 20, "pages": 7 }
}
```

`search` se ignora con menos de 3 caracteres. Busca en `numero_radicado`, `juzgado`,
`cliente.nombre`, `cliente.razon_social` y `abogado_resp.nombre`, sin distinguir mayúsculas.

**`PUT /api/procesos/:id/estado` — respuesta cuando hay pendientes (RN05):**

```json
{
  "error": "No se puede archivar el expediente: ...",
  "hasPending": true,
  "terminos": ["Contestación de demanda"],
  "audiencias": ["Audiencia inicial (15/09/2026)"]
}
```

Solo un `ADMINISTRADOR` puede reintentar con `{ "force": true }`.

---

## 4.b Actuaciones procesales — `/api/actuaciones` (4)

Reutiliza los permisos del módulo `PROCESOS`: la actuación forma parte del expediente y
crear un valor nuevo en `ModuloPermiso` habría dejado sin permisos a los usuarios existentes
([ADR-010](11-DECISIONES-ARQUITECTONICAS.md)).

| Método | Ruta | Permiso | Audit | Qué hace | HU |
|---|---|---|:--:|---|---|
| POST | `/` | `PROCESOS:CREAR` | ✔ | Registra una actuación y la deja en el historial del expediente | HU-37 |
| GET | `/proceso/:id_proceso` | `PROCESOS:LEER` | — | Actuaciones en orden cronológico inverso, con los términos que originaron | HU-37 |
| PUT | `/:id` | `PROCESOS:EDITAR` | ✔ | Corrige una actuación mal digitada, dejando rastro del valor anterior en `historial_proceso` | HU-37 |
| DELETE | `/:id` | `PROCESOS:ELIMINAR` | ✔ | Elimina la actuación. **Solo `ADMINISTRADOR`** y solo si no tiene términos asociados | HU-37 |

Los cuatro endpoints están expuestos en la interfaz: la pestaña «Actuaciones» tiene el botón
*Registrar Actuación* y, en cada tarjeta, los iconos de corregir y eliminar.

**Cuerpo de `POST /api/actuaciones`:**

```json
{
  "id_proceso": "uuid",
  "fecha_actuacion": "2026-06-20",
  "tipo": "AUTO",
  "anotacion": "Auto admisorio de demanda"
}
```

`tipo` debe pertenecer al catálogo cerrado: `AUTO`, `SENTENCIA`, `NOTIFICACION`,
`AUDIENCIA`, `MEMORIAL`, `DEMANDA`, `CONTESTACION`, `RECURSO`, `TRASLADO`, `OTRO`.

**Vinculación con términos:** `POST /api/terminos` acepta ahora un `id_actuacion` opcional.
El servidor valida que esa actuación pertenezca al mismo expediente y al mismo consultorio.

---

## 5. Documentos — `/api/documentos` (8)

| Método | Ruta | Permiso | Audit | Qué hace | HU |
|---|---|---|:--:|---|---|
| POST | `/` | `DOCS:CREAR` | ✔ | Sube documento v1 a R2 (`multipart`, campo `archivo`, máx. 10 MB) | HU-12 |
| POST | `/:id/version` | `DOCS:CREAR` | ✔ | Sube nueva versión conservando las anteriores | HU-15 |
| GET | `/proceso/:id_proceso` | `DOCS:LEER` | — | Lista documentos filtrados por visibilidad según rol | HU-13, HU-14 |
| GET | `/:id/versiones` | `DOCS:LEER` | — | Historial de versiones (desc) | HU-15 |
| GET | `/download/:id_version` | `DOCS:LEER` | — | Devuelve URL firmada temporal de R2; **audita explícitamente** | HU-28 |
| PATCH | `/:id/estado` | `DOCS:EDITAR` | ✔ | Marca `INACTIVO` o `REEMPLAZADO`. RN06 impide reactivar | HU-16 |
| DELETE | `/:id/definitivo` | `DOCS:ELIMINAR` | ✔ | Borrado definitivo (solo Administrador) | HU-16 |
| DELETE | `/:id` | `DOCS:ELIMINAR` | ✔ | Borrado lógico | HU-16 |

**Nota de orden de rutas:** `/:id/definitivo` se declara **antes** que `/:id`. Correcto — al
revés, Express capturaría `definitivo` como parámetro.

**Visibilidad aplicada en `GET /proceso/:id_proceso`:**

| Rol | Ve |
|---|---|
| `ADMINISTRADOR`, abogado responsable | Todo, incluido `PRIVADO` |
| `ASISTENTE` (colaborador asignado) | `VISIBLE_COLAB` y `COMPARTIDO_CLIENTE` |
| `CLIENTE` | Solo `COMPARTIDO_CLIENTE` |

---

## 6. Audiencias — `/api/audiencias` (4)

| Método | Ruta | Permiso | Audit | Qué hace | HU |
|---|---|---|:--:|---|---|
| POST | `/` | `AUDIENCIAS:CREAR` | ✔ | Programa audiencia + hasta 3 recordatorios (48 h / 24 h / mismo día por defecto) | HU-17, HU-18 |
| GET | `/` | `AUDIENCIAS:LEER` | — | Agenda del consultorio. **Efecto lateral:** archiva las audiencias pasadas | HU-17, HU-20 |
| GET | `/proceso/:id_proceso` | `AUDIENCIAS:LEER` | — | Audiencias de un expediente | HU-17 |
| PUT | `/:id` | `AUDIENCIAS:EDITAR` | ✔ | Reprograma; los recordatorios se recalculan por ser relativos | HU-19 |

---

## 7. Términos judiciales — `/api/terminos` (4)

| Método | Ruta | Permiso | Audit | Qué hace | HU |
|---|---|---|:--:|---|---|
| POST | `/` | `TERMINO:CREAR` | ✔ | Crea término + recordatorios (5 días / 1 día / día del vencimiento) + notificaciones | HU-21, HU-22 |
| GET | `/vencimientos` | `TERMINO:LEER` | — | Términos `PENDIENTE` para el dashboard, filtrados por rol | HU-24 |
| GET | `/proceso/:id_proceso` | `TERMINO:LEER` | — | Términos de un expediente | HU-21 |
| PUT | `/:id/gestion` | `TERMINO:EDITAR` | ✔ | Gestiona el término. Aplica RN07 y silencia recordatorios pendientes | HU-23 |

**`PUT /:id/gestion` — cuerpo:** `{ estado: "CUMPLIDO" | "CUMPLIDO_TARDIO" | "INCUMPLIDO", justificacion }`
Si `estado = CUMPLIDO` pero la fecha ya venció, el servidor lo **reescribe** a `CUMPLIDO_TARDIO`
sin posibilidad de sobrescritura por el usuario (RN07).

---

## 8. Notificaciones — `/api/notificaciones` (2)

| Método | Ruta | Auth | Qué hace | HU |
|---|---|:--:|---|---|
| GET | `/` | ✔ | Alertas activas, con agrupación de >5 eventos iguales en ventanas de 10 min | HU-25 |
| PUT | `/:id/gestionar` | ✔ | Cierra alerta. Aplica RN08 y RN02 | HU-30 |

**Notificaciones agrupadas:** el `GET` puede devolver objetos sintéticos con
`id_notificacion: "grouped_<uuid>"`, `isGrouped: true` y `groupedIds: [...]`.
Para cerrarlas hay que enviar `groupedIds` en el cuerpo del `PUT`.

**RN08 en la respuesta:** si un Administrador intenta cerrar una alerta `ALTA` ajena
cuyo destinatario **sigue activo**, la respuesta es `403` con el mensaje explicando la regla.

---

## 9. Portal del cliente — `/api/portal` (2)

| Método | Ruta | Auth | Qué hace | HU |
|---|---|:--:|---|---|
| GET | `/dashboard` | ✔ | Procesos, audiencias futuras y las 10 últimas novedades del historial | HU-27 |
| GET | `/procesos/:id` | ✔ | Detalle con documentos `COMPARTIDO_CLIENTE` únicamente | HU-27, HU-28 |

Ambas exigen `req.user.rol === 'CLIENTE'` dentro del controlador. Esto es lo que **impide
que un Administrador suplante a un cliente**, cumpliendo la segunda prohibición de RN02.

---

## 10. Reportes — `/api/reportes` (3)

| Método | Ruta | Permiso | Qué hace | HU |
|---|---|---|---|---|
| GET | `/stats` | `REPORTES:LEER` | Procesos por estado y carga por abogado. Query: `filter` (`mes`/`trimestre`/`anio`/`custom`), `start_date`, `end_date` | HU-26 |
| GET | `/export/csv` | `REPORTES:LEER` | CSV con BOM UTF-8, separador `;` (compatible con Excel en español). Se audita como `EXPORTAR_REPORTES_CSV` | HU-26 |
| GET | `/export/pdf` | `REPORTES:LEER` | Informe de expedientes en PDF: portada, resumen por estado, carga por abogado y tabla de detalle. Mismos filtros que `/stats` | HU-26 |

> **Dos formatos porque son dos usos distintos.** El CSV sirve para **procesar** —abrirlo en
> Excel, filtrar, sumar—; el PDF sirve para **entregar**: a un socio, a un cliente o como
> soporte de una reunión. Por eso RF42 pide los dos y no uno.

> **Los dos formatos parten de la misma consulta**, en `reportes.controller.js`. Si cada uno
> armara la suya, un cambio en el filtro de fechas podría dejar el CSV y el PDF diciendo cifras
> distintas sobre el mismo periodo, que es la peor forma de fallar en un informe.

El PDF se construye en memoria y se envía como flujo, sin escribir en disco: un informe es
efímero y guardarlo en el servidor solo dejaría archivos que limpiar.

---

## 11. Administración — `/api/admin` (6)

Todo el módulo aplica `requireRole(['ADMINISTRADOR'])` a nivel de router.

| Método | Ruta | Qué hace | HU |
|---|---|---|---|
| GET | `/auditoria` | Bitácora del tenant, más reciente primero | HU-03 |
| GET | `/auditoria/export` | La misma bitácora en CSV. Filtros: `modulo`, `accion`, `desde`, `hasta` | HU-03 |
| GET | `/usuarios` | Usuarios del tenant | HU-02 |
| POST | `/usuarios` | Crea abogado o colaborador | HU-02 |
| GET | `/permisos/:id_usuario` | Permisos por módulo de un usuario | HU-02 |
| PUT | `/permisos/:id_usuario` | Actualiza la matriz de permisos | HU-02 |

**`GET /auditoria/export`** — RNF03. Devuelve `text/csv` con las columnas
`# · Fecha y hora · Usuario · Correo · Rol · Módulo · Acción · Detalle · Dirección IP`,
separadas por `;` y con marca de orden de bytes para que Excel muestre bien las tildes.
Acepta los mismos filtros que la pantalla, de modo que **lo exportado coincide con lo que se
está viendo**.

> **La exportación se audita a sí misma.** Sacar la bitácora del sistema es en sí un acto
> auditable: la petición deja su propio registro, con cuántas filas se llevó quien la pidió.

> **Si el usuario fue eliminado**, la fila no desaparece: sale como `(usuario eliminado)`
> conservando módulo, acción, detalle e IP. Borrar a alguien no puede borrar su rastro.

---

## 12.b Administración de la PLATAFORMA — `/api/plataforma` (6)

Gestión de los consultorios que usan el sistema, **no de sus expedientes**. Estas rutas usan un
middleware distinto (`plataforma.middleware.js`) y un token de otro tipo: un JWT de consultorio
NO sirve aquí, y el de plataforma no sirve en el resto de la API. Ver
[ADR-012](11-DECISIONES-ARQUITECTONICAS.md) y [doc 15](15-ADMINISTRACION-DE-PLATAFORMA.md).

| Método | Ruta | Auth | Qué hace |
|---|---|:--:|---|
| POST | `/login` | — | Sesión de plataforma. Máx. 20 intentos fallidos cada 15 min |
| GET | `/resumen` | Plataforma | Totales de consultorios, usuarios y expedientes |
| GET | `/consultorios` | Plataforma | Lista con datos administrativos y recuentos. **No expone contenido jurídico** |
| PATCH | `/consultorios/:id/estado` | Plataforma | Suspende o reactiva. La suspensión exige justificación |
| DELETE | `/consultorios/:id` | Plataforma | Baja definitiva. Exige estar suspendido, el nombre exacto y justificación |
| GET | `/bitacora` | Plataforma | Acciones de plataforma. Tabla aparte: sobrevive al consultorio borrado |

> No existe ruta de registro a propósito. Los administradores de plataforma se crean solo con
> `npm run crear-admin-plataforma` en el servidor.

---

## 12. Salud

| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/` | `{ "message": "SGPA API is running" }` |

---

## 13. Convenciones y comportamientos transversales

### Códigos de estado

| Código | Cuándo |
|---|---|
| `200` | Consulta o actualización correcta |
| `201` | Recurso creado |
| `400` | Validación fallida o regla de negocio incumplida (p. ej. archivar con pendientes) |
| `401` | Sin token, token inválido, credenciales incorrectas |
| `403` | Autenticado pero sin permiso; cuenta bloqueada; cuenta sin verificar |
| `404` | Recurso inexistente **o perteneciente a otro tenant** |
| `500` | Error no controlado |

> **Sobre el 404 en accesos cruzados:** devolver `404` en vez de `403` para un recurso de otro
> tenant es, de hecho, la práctica **más segura** (no confirma la existencia del recurso). Pero
> **RNF11 exige explícitamente `403` y registro en bitácora**. Hay que decidir cuál de las dos
> cosas prevalece; la recomendación es enmendar RNF11 y conservar el comportamiento actual,
> añadiendo únicamente el registro en bitácora del intento.

### Limitación de peticiones

`app.js` aplica un limitador global sobre `/api/`: **1000 peticiones por IP cada 15 minutos**.
Es un valor relajado, pensado para no estorbar el uso normal.

Además hay limitadores propios donde el global no sirve de nada:

| Ruta | Límite | Por qué |
|---|---|---|
| `/api/auth/reenviar-verificacion` | 5 / 15 min | Envía correo a una dirección que indica quien llama: sin límite es una herramienta para inundar el buzón de otra persona con mensajes firmados por nosotros |
| `/api/auth/recuperar` | 5 / 15 min | Igual que la anterior |
| `/api/plataforma/login` | 20 fallos / 15 min | Es la credencial de mayor privilegio del sistema |

> ⚠️ **Sigue faltando un limitador en `/api/auth/login`.** Lo que hoy protege ese acceso es el
> bloqueo progresivo por usuario (1, 5, 15, 30 y 60 minutos), que frena el ataque a una cuenta
> concreta pero no uno distribuido contra muchas. Punto 2.2 del
> [plan de remediación](10-PLAN-DE-REMEDIACION.md).

### CORS

`app.use(cors())` sin opciones: **permite cualquier origen**. En producción debería restringirse
a `FRONTEND_URL`, como afirma `docs/historico/arquitectura.md` que ya ocurre (no ocurre).

### Rutas que no existen y podrían esperarse

| Ruta ausente | Requisito que la pediría |
|---|---|
| ~~`POST /api/auth/recuperar` y `/restablecer`~~ | ✅ Implementadas el 2-09-2026 ([doc 17](17-RECUPERACION-DE-ACCESO.md)) |
| ~~`POST /api/auth/reenviar-verificacion`~~ | ✅ Implementada el 2-09-2026 ([doc 17](17-RECUPERACION-DE-ACCESO.md)) |
| ~~`POST /api/auth/logout`~~ | ✅ Implementada el 3-09-2026 — RF05 (cierre de sesión en bitácora) |
| ~~`GET /api/admin/auditoria/export`~~ | ✅ Implementada el 3-09-2026 — RNF03, HU-03 |
| ~~`GET /api/reportes/export/pdf`~~ | ✅ Implementada el 3-09-2026 — RF42, HU-26 |
| `DELETE /api/clientes/:id` | RNF06 (eliminación de cliente por Administrador) |
| `GET /api/audiencias/:id` | — (no exigido; el detalle llega con el proceso) |
