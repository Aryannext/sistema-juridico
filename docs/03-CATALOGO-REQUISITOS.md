# 03 — Catálogo de requisitos: RF, RNF y RN

**Fuente única y vigente:** `docs/fuentes/sistema.docx`.
La numeración RF01–RF09 de `investigacion.docx` queda **retirada de circulación** por colisión
de identificadores (hallazgo H-10); ese documento se reclasifica como investigación de dominio
y su contenido útil se rescata en [07-GLOSARIO-JURIDICO.md](07-GLOSARIO-JURIDICO.md).

**Total:** 59 requisitos funcionales · 10 no funcionales · 9 reglas de negocio.
RF55–RF59 son **nuevos**: recuperan la entidad *Actuación*, perdida al reescribir los requisitos.

### Leyenda de estado

| Símbolo | Significado |
|---|---|
| ✅ | Implementado y verificado en el código |
| 🟡 | Parcial — funciona, pero no cumple todo lo que el requisito exige |
| ❌ | No implementado |
| 🔵 | Cumplido por la infraestructura, no por el código de la aplicación |

---

## 1. Requisitos funcionales

### 1.1 Gestión de usuarios y acceso

| ID | Requisito | Estado | Evidencia / brecha |
|---|---|:--:|---|
| RF01 | Inicio de sesión con correo **o nombre de usuario** y contraseña | ✅ | Cerrado el 3-09-2026. `Usuario.nombre_usuario` (opcional, único en todo el sistema) + `utils/nombre-usuario.js`. `login` elige la columna por la que busca según lleve arroba o no; un nombre de usuario no puede contenerla. Se gestiona en `PATCH /auth/nombre-usuario` |
| RF02 | Cuatro roles: Administrador, Abogado, Colaborador, Cliente | ✅ | `enum RolUsuario` — el tercer rol se llama `ASISTENTE` en la BD (H-09) |
| RF03 | Permisos leer/crear/editar/eliminar por módulo | ✅ | Tabla `permiso_rol`, `roles.middleware.js`, `PUT /api/admin/permisos/:id_usuario` |
| RF04 | El abogado solo ve sus procesos asignados | ✅ | `procesos.controller.js: getProcesos` — filtra por `id_abogado_resp` o pertenencia a `proceso_abogados` cuando el rol no es `ADMINISTRADOR` |
| RF05 | Bitácora con usuario, fecha/hora, IP, módulo y detalle | ✅ | `audit.middleware.js` + escrituras explícitas cubren procesos, clientes, documentos, términos, audiencias y descargas; `sesion.auditoria.js` cubre entrada, doble factor, intento fallido, bloqueo y cierre de sesión (cierra H-20) |

### 1.2 Gestión de clientes

| ID | Requisito | Estado | Evidencia / brecha |
|---|---|:--:|---|
| RF06 | Campos mínimos según persona natural / jurídica | ✅ | Cerrado el 3-09-2026 con `clientes/validacion.js`, que `createCliente` aplica antes de tocar la base. La regla *«si es jurídica, entonces razón social y NIT»* solo puede vivir en el código: esas columnas admiten nulo porque la tabla la comparten las personas naturales |
| RF07 | Un cliente asociado a múltiples procesos | ✅ | Relación 1:N `Cliente → Proceso` |
| RF08 | Ver todos los procesos del cliente desde su ficha | ✅ | `getClienteById` incluye `procesos: true`; se renderiza en `ClienteFicha.jsx` |

### 1.3 Gestión de procesos jurídicos

| ID | Requisito | Estado | Evidencia / brecha |
|---|---|:--:|---|
| RF09 | Crear expediente asociado a un radicado | ✅ | `POST /api/procesos` |
| RF10 | Validar radicado no duplicado | ✅ | Cerrado el 2-09-2026 (H-19), migración `unicidad_por_consultorio`. `createProceso` busca con `findFirst` acotado al consultorio: la contraparte litiga el mismo proceso con el mismo radicado desde otra oficina, y antes no podía registrarlo. El mensaje ya no revela datos ajenos |
| RF11 | Registrar juzgado, tipo, clase, área, estado, fecha y abogado | ✅ | Campos completos en `Proceso`; obligatorios mínimos validados en UI |
| RF12 | Asignar múltiples abogados o colaboradores | ✅ | `POST /api/procesos/:id/abogados`, tabla `proceso_abogados` |
| RF13 | Modificar estado (activo/archivado/suspendido/finalizado) | ✅ | `PUT /api/procesos/:id/estado`, con las validaciones de RN03 y RN05 |
| RF14 | Mantener historial de cambios | ✅ | Tabla `historial_proceso`, escrita en cada mutación relevante |

### 1.3.b Gestión de actuaciones procesales — **requisitos nuevos**

> **Origen de estos requisitos.** La entidad *Actuación* estaba modelada en
> `investigacion.docx` como entidad de primer nivel (*"Actuación (RF02) | fecha actuación,
> tipo actuación (FK catálogo), anotación… | Pestaña 4"*), con el término colgando de ella
> (*"Término (RF04) | fecha inicio, fecha fin, **FK actuación**"*). **Al reescribir los
> requisitos a la numeración RF01–RF54 la entidad desapareció y nadie lo notó**: en
> `sistema.docx` la palabra "actuación" aparece una sola vez, en RF25, y como adjetivo.
>
> Se recupera aquí porque el objetivo del cliente lo exige —*"administre el expediente digital
> de cada caso"*— y porque el problema declarado —*"los términos judiciales vencen por falta
> de seguimiento"*— describe una cadena **actuación → término → alerta** que estaba rota en su
> primer eslabón. Ver [ADR-010](11-DECISIONES-ARQUITECTONICAS.md).

| ID | Requisito | Estado | Evidencia |
|---|---|:--:|---|
| RF55 | El sistema debe permitir registrar las actuaciones procesales de un expediente, con fecha de la actuación, tipo, anotación y usuario que la registró | ✅ | `POST /api/actuaciones` · `actuaciones.controller.js: createActuacion` |
| RF56 | El tipo de actuación debe provenir de un catálogo cerrado: auto, sentencia, notificación, audiencia, memorial, demanda, contestación, recurso, traslado y otros | ✅ | `enum TipoActuacion` (10 valores) + validación en el backend |
| RF57 | El sistema debe mostrar las actuaciones en orden cronológico inverso y distinguir la **fecha de la actuación** (cuándo ocurrió en el juzgado) de la **fecha de registro** (cuándo se digitó) | ✅ | `getActuacionesProceso` ordena por `fecha_actuacion desc`; `Actuacion.fecha_registro` |
| RF58 | El sistema debe permitir vincular un término judicial con la actuación que lo originó, y mostrar esa relación en ambos sentidos | ✅ | `TerminoJudicial.id_actuacion` (opcional); `createTermino` acepta y valida `id_actuacion`; la ficha muestra los términos bajo su actuación |
| RF59 | La eliminación de una actuación queda restringida al Administrador y se impide si tiene términos judiciales asociados | ✅ | `deleteActuacion` — cubierto por prueba automatizada |

**Decisión de diseño en RF58:** el vínculo es **opcional**, no obligatorio. RF32 permite
registrar términos manualmente y existen términos previos sin actuación asociada. Hacerlo
obligatorio habría roto los datos existentes.

### 1.4 Gestión de partes procesales

| ID | Requisito | Estado | Evidencia / brecha |
|---|---|:--:|---|
| RF15 | Registrar demandante, demandado, víctima, tercero, cliente, otros | ✅ | `enum TipoParte`, `POST /api/procesos/:id/partes` |
| RF16 | Permitir crear procesos sin todas las partes | ✅ | Sin validación bloqueante — comportamiento correcto |
| RF17 | Marcar incompleto el proceso sin demandante y demandado, **con aviso en el dashboard y en la ficha** | ✅ | Cerrado el 3-09-2026: `procesos/atencion.js` + `GET /procesos/atencion`, y el aviso ya está en `DashboardIndex.jsx`. Nadie abre un expediente para enterarse de que le faltan partes |

### 1.5 Gestión documental

| ID | Requisito | Estado | Evidencia / brecha |
|---|---|:--:|---|
| RF18 | Formatos PDF/DOCX/XLSX/JPG/PNG, máximo 10 MB, error descriptivo | ✅ | **Corregido el 2-09-2026.** Límite de 10 MB y `fileFilter` con lista explícita (PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, WebP, TIFF, TXT). Antes no había filtro: se podía adjuntar un ejecutable a un expediente. El error también es descriptivo ahora: los fallos de `multer` se traducen en `subida.middleware.js`, porque ocurren ANTES del controlador y acababan en un 500 genérico |
| RF19 | Siete categorías: demandas, pruebas, contratos, **escritos**, notificaciones, providencias, otros, **y filtrado por categoría** | ✅ | Cerrado el 3-09-2026 (H-18). `enum CategoriaDocumento` tiene las **siete**; migración `20260903160300_categoria_escrito`. Una categoría inexistente devuelve `400`, no `500`. El **filtro** (RF19.2) figuraba como cumplido y no existía en ninguna parte: ahora es `GET /documentos/proceso/:id?categoria=`, aplicado tras las reglas de visibilidad |
| RF20 | Organización cronológica por fecha y hora de carga | ✅ | `getProcesoDocumentos` ordena por `created_at desc` |
| RF21 | Documentos generales no vinculados a un proceso | ✅ | `Documento.id_proceso` es opcional |
| RF22 | Visibilidad: privado / compartido con cliente / visible para colaboradores | ✅ | `enum VisibilidadDocumento`; filtrado por rol en `documentos.controller.js:282-300` |
| RF23 | Conservar todas las versiones; la activa es la más reciente | ✅ | `VersionDocumento` + `id_version_actual` |
| RF24 | Historial de creación, modificación y eliminación | ✅ | Bitácora del módulo `DOCS` |
| RF25 | Restringir eliminación de documentos usados en actuaciones | ✅ | `deleteDocumentoDefinitivo` restringido a Administrador con justificación |
| RF26 | Marcar como reemplazado o inactivo sin perder trazabilidad | ✅ | `PATCH /api/documentos/:id/estado` |

### 1.6 Gestión de audiencias

| ID | Requisito | Estado | Evidencia / brecha |
|---|---|:--:|---|
| RF27 | Registrar audiencias y diligencias | ✅ | `POST /api/audiencias` |
| RF28 | Hasta 3 recordatorios; por defecto 48 h, 24 h y el mismo día; canal configurable | ✅ | `audiencias.controller.js: createAudiencia` |
| RF29 | Notificar al abogado responsable y a los colaboradores | ✅ | `recordatorios.job.js` despacha por correo |
| RF30 | Reprogramar manteniendo historial | ✅ | `PUT /api/audiencias/:id` + `historial_proceso` |
| RF31 | Mover automáticamente al historial las audiencias realizadas | ✅ | `autoArchivePastHearings` en `audiencias.controller.js:4`. **Matiz:** se dispara al consultar la agenda, no por temporizador. Si nadie consulta, no se archiva |

### 1.7 Gestión de términos judiciales

| ID | Requisito | Estado | Evidencia / brecha |
|---|---|:--:|---|
| RF32 | Registrar términos manualmente con fecha de vencimiento | ✅ | `POST /api/terminos` |
| RF33 | Valores por defecto (5 días, 1 día, día del vencimiento) | ✅ | `terminos.controller.js` — omite los que ya quedaron en el pasado |
| RF34 | Mantener visibles los términos vencidos hasta gestión manual | ✅ | `getAlertasVencimientos` filtra por `estado: 'PENDIENTE'`, sin corte por fecha |
| RF35 | Registrar cumplido / cumplido tardíamente / incumplido | ✅ | `PUT /api/terminos/:id/gestion` |
| RF36 | Historial completo de alertas y estados | ✅ | Cerrado el 3-09-2026. `RecordatorioTermino` conserva los envíos y `gestionarTermino` escribe cada cambio de estado en `historial_proceso`. Antes solo quedaba el último: que hoy figure como *cumplido tardíamente* no decía si llegó ahí desde *pendiente* o si un Administrador lo rebajó desde *incumplido* |
| RF37 | Hasta 3 recordatorios; los críticos alertan también al Administrador | ✅ | `createTermino` añade a los administradores activos a la lista de destinatarios |

### 1.8 Dashboard principal

| ID | Requisito | Estado | Evidencia / brecha |
|---|---|:--:|---|
| RF38 | Panel diferenciado por rol | ✅ | `DashboardIndex.jsx` + `App.jsx: RootRedirect` |
| RF39 | Priorizar términos por vencer, vencidos, audiencias próximas | ✅ | `DashboardIndex.jsx` |
| RF40 | Marcar en rojo términos vencidos, audiencias < 24 h y procesos sin movimiento > 30 días | ✅ | Cerrado el 3-09-2026. **La brecha que esta fila declaraba no existía**: el enunciado fija los 30 días de forma literal, así que un umbral configurable sería una mejora, no un criterio; la frase «como exige el requisito» no correspondía a nada del enunciado. Lo que sí faltaba es que la inactividad la vieran también los abogados y no solo el Administrador (`procesos/atencion.js`) |
| RF41 | Ocultar lo gestionado tras X horas (48 por defecto, ajustable) | ✅ | `Tenant.horas_ocultar_notificaciones` + `notificaciones.controller.js` |
| RF42 | Estadísticas con filtro por rango de fechas | ✅ | `GET /api/reportes/stats` acepta `mes`, `trimestre`, `anio`, `custom`. Exportable en CSV (`GET /api/reportes/export/csv`) y en PDF (`GET /api/reportes/export/pdf`), ambos con los mismos filtros |

### 1.9 Portal del cliente

| ID | Requisito | Estado | Evidencia / brecha |
|---|---|:--:|---|
| RF43 | Procesos, audiencias autorizadas, documentos habilitados y novedades | ✅ | `getPortalDashboard` — las novedades son las 10 últimas entradas de `historial_proceso` |
| RF44 | El abogado define qué documentos ve el cliente | ✅ | Visibilidad `COMPARTIDO_CLIENTE` |
| RF45 | El cliente puede descargar los documentos autorizados | ✅ | `GET /api/documentos/download/:id_version` con validación de propiedad |
| RF46 | Restringir notas internas, estrategias y documentos privados | ✅ | `portal.controller.js:119` filtra `visibilidad: 'COMPARTIDO_CLIENTE'` |

### 1.10 Alertas y notificaciones

| ID | Requisito | Estado | Evidencia / brecha |
|---|---|:--:|---|
| RF47 | Canal configurable; agrupar más de 5 alertas en 10 minutos | ✅ | Algoritmo de ventana deslizante en `notificaciones.controller.js` |
| RF48 | Tres prioridades; la alta no se puede desactivar | ✅ | `enum PrioridadNotificacion` + preferencias por usuario |
| RF49 | Mantener visibles las alertas críticas hasta gestión | ✅ | `gestionarNotificacion` exige acción manual |
| RF50 | Registrar historial de notificaciones enviadas | ✅ | Las notificaciones no se borran; se marcan `leida` / `gestionada` |

### 1.11 Multi-tenant

| ID | Requisito | Estado | Evidencia / brecha |
|---|---|:--:|---|
| RF51 | Registro público de nuevos tenants, inactivo hasta verificar correo | ✅ | `POST /api/auth/registro`; `activo: false` salvo `DEV_AUTO_VERIFY` en desarrollo |
| RF52 | Aislamiento lógico total entre tenants | 🟡 | El filtrado por `tenant_id` es sistemático (118 usos), pero las restricciones `@unique` globales lo perforan (H-19) y no hay *Row Level Security* |
| RF53 | El Administrador actualiza los datos del consultorio | ✅ | `PUT /api/tenant/perfil` con carga de logo (JPG/PNG, 2 MB) |
| RF54 | Enlace de verificación único, tokenizado, vigente 24 h, un solo uso, reenviable | ✅ | **Completado el 2-09-2026.** Vigencia de 24 h en `token_verificacion_expira` y reenvío en `POST /api/auth/reenviar-verificacion`, ofrecido en la pantalla del enlace caducado. Un token sin fecha se sigue aceptando: es el de las cuentas anteriores al campo. Ver [doc 17](17-RECUPERACION-DE-ACCESO.md) |

---

## 2. Requisitos no funcionales

| ID | Requisito | Estado | Evidencia / brecha |
|---|---|:--:|---|
| RNF01 | Cifrado en reposo AES-256 y en tránsito TLS 1.2+ | 🔵 | En tránsito: TLS de Nginx. En reposo: cifrado por defecto de Cloudflare R2 para los archivos; **la base de datos, al estar en un contenedor propio, hereda el cifrado de disco del VPS y nada más**. No hay cifrado a nivel de aplicación. Debe declararse así en la sustentación |
| RNF02 | Política de contraseñas, bloqueo, expiración de sesión, JWT 8 h, 2FA 5 min | ✅ | **Los ocho criterios.** JWT de 8 h, 2FA de 5 min, bloqueo escalado (1/5/15/30/60 min), política de contraseñas en el servidor (`utils/password.js`) y recuperación operativa desde el 2-09-2026 —antes la API aceptaba la contraseña `"1"`—. Desde el 3-09-2026: cierre por 30 min de inactividad, la exigencia de **carácter especial** que HU-01.6 pedía y nadie comprobaba, y el **limitador dedicado en `/api/auth/login`** (20 fallos cada 15 min por IP, solo cuentan los fallidos). El bloqueo por usuario frena el ataque a una cuenta; el limitador frena el repartido entre muchas, que nunca llega a 5 fallos en ninguna |
| RNF03 | Bitácora inmutable, 5 años, exportable en CSV o PDF con filtros | 🟡 | **Esta fila se contradecía a sí misma**: figuraba como ✅ mientras su propia evidencia terminaba diciendo que la retención estaba pendiente. Corregido el 3-09-2026. Inmutable: no existe ningún `update` sobre `bitacoraAuditoria`, y ningún rol del consultorio puede borrar. El único `deleteMany` está en la baja completa de un consultorio (`plataforma.controller.js`), que se anota en `BitacoraPlataforma`. Exportación: `GET /api/admin/auditoria/export` → CSV con los filtros `modulo`, `accion`, `desde`, `hasta` (`exportacion-bitacora.js`). **Sigue abierto RNF03.5**, la conservación a 5 años: no hay purga, pero tampoco política de retención escrita ni respaldos automáticos (ver RNF10) |
| RNF04 | Compatibilidad con navegadores modernos y diseño responsivo 360–1440 px | ✅ | Tailwind con puntos de ruptura; el `DashboardLayout` oculta la barra lateral bajo `lg` |
| RNF05 | Búsqueda por 6 campos, < 2 s, texto parcial ≥ 3 caracteres, filtros combinables, paginación de 20 | ✅ | Cerrado el 3-09-2026. Once índices (migración `20260903160400_indices_de_busqueda`): seis B-tree y cinco GIN de trigramas, porque `ILIKE '%texto%'` no puede usar B-tree. Verificable con `npm run verificar:indices`, que pide el plan de cada consulta |
| RNF06 | Eliminación definitiva solo por Administrador con confirmación en dos pasos | ✅ | Backend exige rol + justificación escrita; la UI implementa la doble confirmación |
| RNF07 | Disponibilidad ≥ 99,5 % mensual | 🔵 | Depende enteramente del VPS: base de datos y API corren allí. **Sin monitoreo ni página de estado** |
| RNF08 | 50 usuarios concurrentes; consultas < 3 s, escrituras < 5 s | ❓ | **Nunca se ha medido.** No hay pruebas de carga en el repositorio |
| RNF10 | Transacciones atómicas, backups diarios con 30 días de retención, integridad referencial | 🟡 | Transacciones: ✅ (`prisma.$transaction` en registro, términos, audiencias, borrado de expediente). Integridad referencial: ✅ (claves foráneas de Prisma). **Backups: NO HAY.** Al pasar la base a un contenedor propio se perdió el respaldo automático que daba el proveedor gestionado, y no se ha puesto nada en su lugar. Es hoy el mayor riesgo operativo del sistema |
| RNF11 | Ninguna consulta debe retornar datos de otro tenant; intento → registro + 403 | 🟡 | El filtrado existe y está probado. **El registro del intento se cerró el 3-09-2026** (`acceso-cruzado.middleware.js`): se anota solo cuando el identificador existe de verdad en otro consultorio —un 404 corriente es un error de tecleo y ensuciaría la bitácora—, y va a la bitácora de quien lo intentó, no a la del afectado. **Sigue sin cumplirse el 403, y es deliberado**: se responde 404 porque un 403 confirmaría que el expediente ajeno existe |

> No existe RNF09: `sistema.docx` lo fusionó con RNF03. No es una omisión (H-15).

---

## 3. Reglas de negocio

| ID | Regla | Estado | Evidencia |
|---|---|:--:|---|
| RN01 | La bitácora es de solo lectura para todos, incluido el Administrador | ✅ | No existe ningún `update` ni `delete` sobre `bitacoraAuditoria` en el backend. `GET /api/admin/auditoria` es el único acceso |
| RN02 | Límites del acceso administrativo (3 prohibiciones) | ✅ | **Cumple las tres.** No edita la bitácora; no cierra alertas críticas ajenas salvo destinatario inactivo (`notificaciones.controller.js`); y desde el 3-09-2026 no puede suplantar al cliente en el portal. Esto último se daba por cumplido «de forma indirecta» y no lo estaba: quien habilitaba el acceso **escribía la contraseña del cliente**, así que podía entrar como él. Ahora la cuenta nace sin contraseña utilizable y el cliente elige la suya por un enlace de un solo uso |
| RN03 | Un proceso finalizado/archivado no vuelve a activo sin autorización del Administrador y justificación escrita | ✅ | `cambiarEstadoProceso`, Regla 2 |
| RN04 | Un proceso siempre debe tener al menos un abogado responsable | ✅ | Cerrada el 3-09-2026. `procesos/responsable.js` exige que el responsable sea del consultorio, esté activo y pueda responder (Abogado o Administrador); antes `createProceso` **no validaba nada** y admitía incluso un usuario de otra oficina. El relevo, que no existía, es ahora `PUT /procesos/:id/responsable` con justificación y doble registro |
| RN05 | No archivar con términos vencidos sin gestionar ni audiencias en 30 días | ✅ | `cambiarEstadoProceso`, Regla 1, con forzado explícito solo por Administrador |
| RN06 | Un documento inactivo o reemplazado no puede reactivarse | ✅ | `updateDocumentoEstado` |
| RN07 | Clasificación automática de término tardío, no sobrescribible salvo por el Administrador | ✅ | `gestionarTermino`: reclasifica `CUMPLIDO` → `CUMPLIDO_TARDIO` si `now > vencimiento` y registra `SOBREESCRITURA_TERMINO_TARDIO` en bitácora |
| RN08 | Una alerta de prioridad alta solo la cierra su destinatario, o el Administrador si el destinatario está inactivo | ✅ | `gestionarNotificacion` |
| RN09 | **[NUEVA]** El rojo se reserva para riesgo procesal o disciplinario; nunca decorativo | ✅ | Formalización del criterio de HU-24 que se citaba como `RN09` sin estar definido (H-13). El frontend la respeta |

---

## 4. Resumen cuantitativo

| Categoría | ✅ | 🟡 | ❌ | 🔵 | ❓ |
|---|:--:|:--:|:--:|:--:|:--:|
| Funcionales (59) | 48 | 11 | 0 | 0 | 0 |
| No funcionales (10) | 2 | 5 | 0 | 2 | 1 |
| Reglas de negocio (9) | 7 | 2 | 0 | 0 | 0 |

**Lectura honesta de estos números:** ninguna funcionalidad está ausente por completo.
Las 11 brechas funcionales son de **completitud**, no de existencia: el requisito está
construido pero le falta un detalle (un enum con seis valores en vez de siete, un aviso que
aparece en una pantalla y no en dos, un token sin fecha de expiración). Eso es
razonablemente sano para un sistema de este alcance, y todas son corregibles en horas,
no en semanas.

La excepción son los tres puntos que exigen trabajo real: **el registro de inicio de sesión
en bitácora (RF05), la recuperación de contraseña (RNF02) y la exportación en PDF (RNF03)**.
Priorizados en [10-PLAN-DE-REMEDIACION.md](10-PLAN-DE-REMEDIACION.md).

> **Actualización del 2 de septiembre de 2026.** De esos tres, **la recuperación de contraseña
> ya está hecha** ([doc 17](17-RECUPERACION-DE-ACCESO.md)), junto con el reenvío de verificación
> (RF54), la política de contraseñas en el servidor y el filtro de formatos de documento (RF18).
>
> Siguen abiertos **RF05** (inicio de sesión en bitácora) y **RNF03/RF42** (exportación en PDF).
> Son exactamente las 3 comprobaciones que fallan de las 34 de `npm --prefix backend run verificar`.

> **Actualización del 3 de septiembre de 2026.** Los tres quedan cerrados:
>
> - **RF05** — `sesion.auditoria.js` registra entrada, entrada con doble factor, intento
>   fallido, bloqueo y cierre de sesión. Se añadió `POST /api/auth/logout` para tener un
>   cierre que auditar.
> - **RNF03** — `GET /api/admin/auditoria/export` entrega la bitácora en CSV con los mismos
>   filtros de la pantalla (`modulo`, `accion`, `desde`, `hasta`). La propia exportación se audita.
> - **RF42** — `GET /api/reportes/export/pdf` genera el informe de expedientes con pdfkit,
>   reutilizando la misma consulta que el CSV para que ambos formatos no puedan divergir.
>
> `npm --prefix backend run verificar` pasa a **34 de 34**. Cubierto por 27 pruebas nuevas
> (`auditoria_sesion`, `exportacion_bitacora`, `exportacion_pdf`).
