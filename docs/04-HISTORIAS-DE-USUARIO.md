# 04 — Historias de usuario (reconciliadas)

**Fuente vigente:** `docs/fuentes/HU_Sistema_Juridico_v3.docx` — **36 historias**.
`docs/historico/Combined_Sprint_Stories.md` y `docs/historico/Jira_Import_Stories.csv` quedan **desactualizados**:
listan solo 34 y omiten HU-35 y HU-36, que sí están implementadas (hallazgo H-11).
`docs/historico/Jira_Sprints_Plan_v2.md` **sí contiene las 36**; solo le falta el rebalanceo de sprints
de la sección 3 de este documento.

**Total:** 37 historias · 11 módulos · 170 puntos de historia.
HU-37 es **nueva**: cubre RF55–RF59 (actuaciones procesales).

---

## 1. Correcciones aplicadas al backlog

| Corrección | Detalle |
|---|---|
| **HU-29** | La tabla resumen decía 3 pts y el detalle 4 pts. **Se fija en 4 pts** (prevalece el detalle) — hallazgo H-14 |
| **HU-24** | Citaba `RN09`, que no existía. Se **formaliza RN09** (semántica del color de riesgo) en el doc 03 — hallazgo H-13 |
| **HU-01** | El criterio *"correo electrónico o nombre de usuario"* no es implementable: no existe campo `username`. Se marca como brecha (RF01) |
| **Rol "Colaborador"** | En BD y código es `ASISTENTE`. Las historias conservan "Colaborador" como término de negocio — ver [ADR-004](11-DECISIONES-ARQUITECTONICAS.md) |

---

## 2. Catálogo completo

Estado: ✅ implementada · 🟡 parcial · ❌ no implementada

### Módulo 1 — Autenticación y gestión de usuarios

| ID | Historia | Sprint | Prio | Pts | RF/RN | Estado | Dónde vive |
|---|---|:--:|:--:|:--:|---|:--:|---|
| HU-01 | Inicio de sesión en el sistema | 1 | Alta | 5 | RF01, RNF01, RNF02 | 🟡 | `auth.controller.js: login` · `LoginPage.jsx` — solo correo; sin recuperación de contraseña; sin cierre por inactividad |
| HU-02 | Gestión de roles y permisos por módulo | 1 | Alta | 8 | RF02–RF05, RN02 | 🟡 | `admin.controller.js` · `UsuariosPage.jsx` — falta impedir que el único Administrador se degrade a sí mismo |
| HU-03 | Registro de acciones en bitácora de auditoría | 1 | Alta | 5 | RF05, RNF03, RN01 | ✅ | `audit.middleware.js` · `sesion.auditoria.js` · `exportacion-bitacora.js` · `AuditoriaList.jsx` — incluye inicio y cierre de sesión (cierra H-20) y la exportación en CSV con filtros |
| HU-32 | Habilitar y configurar 2FA | 1 | Alta | 5 | RNF02 | ✅ | `POST /api/auth/2fa/configurar` · `TwoFactorPage.jsx` |
| HU-35 | Registro en la plataforma | 1 | Alta | 8 | RF51, RF54 | 🟡 | `POST /api/auth/registro` · `RegisterPage.jsx` — el enlace no expira a las 24 h ni se puede reenviar |
| HU-36 | Configurar perfil del consultorio | 1 | Media | 3 | RF53 | ✅ | `PUT /api/tenant/perfil` · `AjustesPage.jsx` |

### Módulo 2 — Gestión de clientes

| ID | Historia | Sprint | Prio | Pts | RF/RN | Estado | Dónde vive |
|---|---|:--:|:--:|:--:|---|:--:|---|
| HU-04 | Registrar cliente persona natural | 1 | Alta | 3 | RF06, RF05 | 🟡 | `clientes.controller.js` · `ClientesList.jsx` — sin validación de obligatorios en backend |
| HU-05 | Registrar cliente persona jurídica | 1 | Alta | 3 | RF06, RF05 | 🟡 | igual que HU-04 |
| HU-06 | Consultar y gestionar ficha del cliente | 1 | Alta | 3 | RF07, RF08, RNF06, RNF10 | ✅ | `getClienteById` · `ClienteFicha.jsx` |

### Módulo 3 — Gestión de procesos jurídicos

| ID | Historia | Sprint | Prio | Pts | RF/RN | Estado | Dónde vive |
|---|---|:--:|:--:|:--:|---|:--:|---|
| HU-07 | Crear expediente jurídico digital | 1 | Alta | 8 | RF09–RF11, RF05 | ✅ | `POST /api/procesos` · `ProcesosList.jsx` |
| HU-33 | Modificar información general del expediente | 1 | Alta | 3 | RF11, RF05 | ✅ | `updateProceso` — el radicado es inmodificable, como exige la HU |
| HU-08 | Asignar múltiples abogados y colaboradores | 2 | Alta | 5 | RF12, RN04 | 🟡 | `addAbogadoProceso` / `removeAbogadoProceso` — RN04 solo parcialmente garantizada |
| HU-09 | Cambiar el estado del proceso | 2 | Alta | 5 | RF13, RF14, RN03, RN05 | ✅ | `cambiarEstadoProceso` — implementa ambas reglas correctamente |
| HU-10 | Consultar historial de cambios del proceso | 2 | Media | 3 | RF14, RNF03 | ✅ | `getProcesoById` incluye `historial` ordenado desc |
| HU-31 | Buscar y filtrar procesos/expedientes | 2 | Alta | 5 | RNF05, RNF08 | 🟡 | `getProcesos` — falta índices para garantizar los < 2 s |
| HU-34 | Eliminar definitivamente expedientes (Admin) | 2 | Alta | 3 | RNF06, RNF10, RF05 | ✅ | `deleteProcesoDefinitivo` con transacción, validaciones y bitácora |

### Módulo 3.b — Actuaciones procesales (nuevo)

| ID | Historia | Sprint | Prio | Pts | RF/RN | Estado | Dónde vive |
|---|---|:--:|:--:|:--:|---|:--:|---|
| HU-37 | Registrar y consultar las actuaciones procesales de un expediente | 2 | Alta | 5 | RF55–RF59 | ✅ | `actuaciones.controller.js` · pestaña "Actuaciones" en `ProcesoDetalle.jsx` |

> Historia nueva, redactada en este proyecto para cubrir RF55–RF59. Sus criterios de aceptación
> están, como los del resto, en la [sección 5](#5-criterios-de-aceptación-detallados).

### Módulo 4 — Gestión de partes procesales

| ID | Historia | Sprint | Prio | Pts | RF/RN | Estado | Dónde vive |
|---|---|:--:|:--:|:--:|---|:--:|---|
| HU-11 | Registrar partes procesales | 2 | Alta | 5 | RF15–RF17 | 🟡 | `addParteProcesal` · `ProcesoDetalle.jsx:744` — el aviso de proceso incompleto falta en el dashboard |

### Módulo 5 — Gestión documental

| ID | Historia | Sprint | Prio | Pts | RF/RN | Estado | Dónde vive |
|---|---|:--:|:--:|:--:|---|:--:|---|
| HU-12 | Cargar documentos al expediente | 2 | Alta | 5 | RF18, RF20, RF24 | 🟡 | `uploadDocumento` — límite de 10 MB sí; **filtro de formatos no** |
| HU-13 | Clasificar y organizar documentos por categoría | 2 | Alta | 3 | RF19–RF21 | 🟡 | Falta la categoría `ESCRITO` (H-18); el filtro por categoría es en cliente |
| HU-14 | Controlar la visibilidad de documentos | 2 | Alta | 5 | RF22, RF43, RF44, RF46 | ✅ | `documentos.controller.js:282-300` |
| HU-15 | Versionar documentos y consultar versiones | 3 | Alta | 5 | RF23, RN06 | ✅ | `uploadNuevaVersion`, `getDocumentoVersiones` |
| HU-16 | Restringir y gestionar eliminación de documentos | 3 | Alta | 5 | RF25, RF26, RN06, RNF06 | ✅ | `updateDocumentoEstado`, `deleteDocumentoDefinitivo` |

### Módulo 6 — Gestión de audiencias

| ID | Historia | Sprint | Prio | Pts | RF/RN | Estado | Dónde vive |
|---|---|:--:|:--:|:--:|---|:--:|---|
| HU-17 | Registrar audiencia o diligencia | 3 | Alta | 3 | RF27 | ✅ | `createAudiencia` |
| HU-18 | Configurar recordatorios de audiencia | 3 | Alta | 5 | RF28, RF29, RF47 | ✅ | Predeterminados 48 h / 24 h / mismo día |
| HU-19 | Reprogramar audiencia con historial | 3 | Alta | 3 | RF30, RF05 | ✅ | `updateAudiencia` — los recordatorios se recalculan por ser relativos |
| HU-20 | Archivar audiencias realizadas al historial | 3 | Media | 3 | RF31 | ✅ | `autoArchivePastHearings` — se dispara al consultar la agenda |

### Módulo 7 — Gestión de términos judiciales

| ID | Historia | Sprint | Prio | Pts | RF/RN | Estado | Dónde vive |
|---|---|:--:|:--:|:--:|---|:--:|---|
| HU-21 | Registrar término judicial con vencimiento | 3 | Alta | 3 | RF32, RF34, RF37 | ✅ | `createTermino` — notifica al Administrador si es crítico |
| HU-22 | Configurar recordatorios de término | 3 | Alta | 5 | RF33, RF36, RF37 | ✅ | Predeterminados 5 días / 1 día / día del vencimiento |
| HU-23 | Gestionar el estado de un término judicial | 3 | Alta | 5 | RF35, RF37, RN07, RN08, RN02 | ✅ | `gestionarTermino` — reclasificación automática a tardío no sobrescribible |

### Módulo 8 — Dashboard principal

| ID | Historia | Sprint | Prio | Pts | RF/RN | Estado | Dónde vive |
|---|---|:--:|:--:|:--:|---|:--:|---|
| HU-24 | Panel principal personalizado según rol | 4 | Alta | 8 | RF38–RF40, RN09 | 🟡 | `DashboardIndex.jsx` — el umbral de días sin movimiento no es configurable |
| HU-25 | Gestionar notificaciones del panel | 4 | Alta | 5 | RF41, RF47–RF50 | ✅ | `notificaciones.controller.js` — incluye la agrupación de >5 en 10 min |
| HU-26 | Consultar estadísticas y reportes generales | 4 | Media | 5 | RF42 | ✅ | `getStats`, `exportCSV`, `exportPDF` — CSV y PDF sobre la misma consulta |

### Módulo 9 — Portal del cliente

| ID | Historia | Sprint | Prio | Pts | RF/RN | Estado | Dónde vive |
|---|---|:--:|:--:|:--:|---|:--:|---|
| HU-27 | Acceder al portal del cliente | 4 | Alta | 5 | RF43, RF46, RN02, RNF02, RNF04 | 🟡 | `getPortalDashboard` · `PortalDashboard.jsx` — la sesión no expira a los 30 min de inactividad |
| HU-28 | Descargar documentos autorizados desde el portal | 4 | Alta | 3 | RF44–RF46, RF05 | ✅ | `getVersionDownloadUrl` — se audita como `DESCARGAR_DOCUMENTO_CLIENTE` |

### Módulo 10 — Alertas y notificaciones

| ID | Historia | Sprint | Prio | Pts | RF/RN | Estado | Dónde vive |
|---|---|:--:|:--:|:--:|---|:--:|---|
| HU-29 | Configurar canal y preferencias de notificación | 4 | Media | 4 | RF47, RF48 | ✅ | `PUT /api/auth/preferencias` · `AjustesPage.jsx` |
| HU-30 | Visualizar y gestionar alertas críticas | 4 | Alta | 5 | RF48–RF50, RN08, RN02 | ✅ | `gestionarNotificacion` — implementa RN08 con la excepción de destinatario inactivo |

---

## 3. Distribución por sprint: declarada vs. propuesta

El `Reporte_Coherencia_SGPA.md` señaló en su momento que el Sprint 1 estaba sobrecargado.
Con las 36 historias del backlog actual, la sobrecarga es **peor** de lo que ese informe calculó,
porque HU-35 (8 pts) y HU-36 (3 pts) también caen en Sprint 1.

| Sprint | Declarado | | Propuesto | |
|---|---|---|---|---|
| | HU | Pts | HU | Pts |
| **1** | 11 | **54** 🚨 | 8 | 43 |
| **2** | 9 | 39 | 10 | 42 |
| **3** | 9 | 37 | 11 | 45 |
| **4** | 7 | 35 | 7 | 35 |
| **Total** | 36 | 165 | 36 | 165 |

### Redistribución propuesta

| Historia | De | A | Razón |
|---|:--:|:--:|---|
| HU-32 · 2FA | 1 | 2 | El 2FA es un refuerzo de seguridad, no un bloqueante para tener login funcionando |
| HU-33 · Modificar expediente | 1 | 2 | Pertenece naturalmente al bloque de gestión de procesos del Sprint 2 |
| HU-36 · Perfil del consultorio | 1 | 2 | Configuración organizacional; no bloquea nada del Sprint 1 |
| HU-13 · Clasificar documentos | 2 | 3 | Descarga el Sprint 2, que absorbe las tres anteriores |
| HU-14 · Visibilidad de documentos | 2 | 3 | Se agrupa con el resto del bloque documental (HU-15, HU-16) |

**Sprint 1 propuesto (43 pts):** HU-35, HU-01, HU-02, HU-03, HU-04, HU-05, HU-06, HU-07.
Es un sprint coherente: *"un consultorio puede registrarse, entrar, administrar su equipo,
registrar clientes y crear su primer expediente"*. Eso es un producto demostrable.

**Sprint 2 propuesto (42 pts):** HU-36, HU-32, HU-33, HU-08, HU-09, HU-10, HU-11, HU-31, HU-12, HU-34.
**Sprint 3 propuesto (45 pts):** HU-13, HU-14, HU-15, HU-16, HU-17, HU-18, HU-19, HU-20, HU-21, HU-22, HU-23.
**Sprint 4 propuesto (35 pts):** HU-24, HU-25, HU-26, HU-27, HU-28, HU-29, HU-30.

> **Nota metodológica para la sustentación:** el sistema ya está construido, así que esta
> redistribución es una **corrección documental retroactiva**, no una replanificación. Conviene
> presentarla como tal y no fingir que se ejecutó así. La honestidad metodológica se evalúa
> mejor que un plan perfecto pero falso.

---

## 4. Estado global del backlog

| Estado | Historias | % |
|---|:--:|:--:|
| ✅ Implementada completa | 25 | 68 % |
| 🟡 Implementada con brechas | 12 | 32 % |
| ❌ No implementada | 0 | 0 % |

Ninguna historia está sin empezar. Las parciales comparten pocas causas raíz. De las cinco
identificadas originalmente —falta de auditoría de sesión, ausencia de recuperación de
contraseña, ausencia de generación de PDF, el enum documental incompleto y la falta de
índices— **las tres primeras están cerradas** (2 y 3 de septiembre de 2026). Quedan el enum
documental y los índices.
---

## 5. Criterios de aceptación detallados

Transcritos desde `docs/fuentes/HU_Sistema_Juridico_v3.docx` para que sean consultables y
buscables sin abrir Word. **195 criterios repartidos en 36 historias**, más los 10 de la
HU-37, que se redactó en este proyecto.

> El texto de las 36 historias originales se reproduce **sin modificar**. Cuando un criterio
> no coincide con lo que hace la plataforma, la discrepancia se registra en el estado de la
> sección 2 y en el [catálogo de requisitos](03-CATALOGO-REQUISITOS.md), no corrigiendo el
> criterio. Ejemplo: HU-01 exige inicio de sesión *"con correo o nombre de usuario"* y el
> sistema solo acepta correo — ver RF01.

### Módulo 1 — Autenticación y gestión de usuarios

#### HU-01 — Inicio de sesión en el sistema

`Prioridad: Alta` · `Sprint: 1` · `5 pts` · `RF01 · RNF01 · RNF02`

> Como usuario registrado (Administrador, Abogado, Colaborador o Cliente), quiero iniciar sesión con mi correo electrónico o nombre de usuario y contraseña, para acceder a las funcionalidades del sistema según mi rol.

**Criterios de aceptación**

- El formulario de login acepta correo electrónico o nombre de usuario junto con contraseña.
- Si las credenciales son correctas, el sistema redirige al usuario al módulo correspondiente según su rol.
- Si las credenciales son incorrectas, el sistema muestra un mensaje de error genérico sin revelar cuál campo es incorrecto.
- Después de 5 intentos fallidos consecutivos, la cuenta se bloquea temporalmente y se notifica al usuario.
- El usuario puede recuperar el acceso mediante correo de recuperación o con ayuda del Administrador.
- La contraseña debe tener mínimo 8 caracteres, al menos una mayúscula, un número y un carácter especial.
- La sesión inactiva se cierra automáticamente tras 30 minutos sin actividad.
- El token JWT tiene vigencia máxima de 8 horas y es renovable mediante reautenticación.

#### HU-02 — Gestión de roles y permisos por módulo

`Prioridad: Alta` · `Sprint: 1` · `8 pts` · `RF02 · RF03 · RF04 · RF05 · RN02`

> Como Administrador, quiero asignar y modificar roles y permisos granulares (leer / crear / editar / eliminar) a cada usuario por módulo, para garantizar que cada persona acceda únicamente a la información y acciones que le corresponden.

**Criterios de aceptación**

- El sistema maneja 4 roles: Administrador, Abogado, Colaborador y Cliente.
- El Administrador puede asignar permisos de lectura, creación, edición y eliminación sobre los módulos: Procesos, Documentos, Clientes, Audiencias, Términos, Reportes y Portal del cliente.
- Un Abogado solo visualiza los procesos que le fueron asignados, a menos que el Administrador le otorgue permisos adicionales.
- Un Colaborador solo accede a las tareas que le han sido asignadas.
- Un Cliente solo accede a su propio portal.
- Al modificar permisos, el sistema registra en la bitácora: usuario que hizo el cambio, fecha/hora, IP y detalle de la modificación.
- El sistema impide que el Administrador se quite a sí mismo el rol de Administrador si es el único con ese rol.

#### HU-03 — Registro de acciones en bitácora de auditoría

`Prioridad: Alta` · `Sprint: 1` · `5 pts` · `RF05 · RNF03 · RN01`

> Como sistema (proceso automatizado), quiero registrar automáticamente cada acción relevante con usuario, fecha/hora UTC, IP, módulo y descripción, para garantizar trazabilidad completa e inmutable de todas las operaciones críticas.

**Criterios de aceptación**

- El sistema registra automáticamente: inicio/cierre de sesión, creación/edición/eliminación de procesos, documentos y clientes, cambio de estado de proceso, asignación de permisos y descarga de documentos.
- Cada registro incluye: usuario, fecha y hora exacta en UTC, dirección IP, módulo afectado y descripción de la acción.
- La bitácora es de solo lectura para todos los roles, incluido el Administrador.
- Ningún usuario ni proceso automatizado puede editar o eliminar registros de auditoría (invariante absoluta).
- Los registros se conservan por mínimo 5 años desde su creación.
- El Administrador puede exportar la bitácora en CSV o PDF, con filtros por usuario, módulo y rango de fechas.

### Módulo 2 — Gestión de clientes

#### HU-04 — Registrar cliente persona natural

`Prioridad: Alta` · `Sprint: 1` · `3 pts` · `RF06 · RF05`

> Como Abogado o Administrador, quiero registrar un cliente persona natural con sus datos personales obligatorios y opcionales, para tener su información centralizada y poder asociarlo a procesos jurídicos.

**Criterios de aceptación**

- El formulario solicita campos obligatorios: nombre completo, tipo de documento, número de documento, teléfono y correo electrónico.
- Los campos opcionales incluyen: fecha de nacimiento y dirección.
- El sistema valida que el número de documento no esté duplicado.
- Al guardar, el sistema crea la ficha del cliente y la deja disponible para asociarla a procesos.
- El sistema muestra mensaje de error descriptivo si se omite un campo obligatorio.
- La creación del cliente queda registrada en la bitácora de auditoría.

#### HU-05 — Registrar cliente persona jurídica

`Prioridad: Alta` · `Sprint: 1` · `3 pts` · `RF06 · RF05`

> Como Abogado o Administrador, quiero registrar un cliente persona jurídica con sus datos corporativos, para gestionar entidades empresariales como clientes dentro del sistema.

**Criterios de aceptación**

- El formulario solicita campos obligatorios: razón social, NIT, representante legal, teléfono y correo electrónico.
- Los campos opcionales incluyen: dirección y datos adicionales del representante.
- El sistema valida que el NIT no esté duplicado.
- Al seleccionar tipo de cliente, el formulario cambia dinámicamente entre persona natural y persona jurídica.
- La creación queda registrada en la bitácora de auditoría.

#### HU-06 — Consultar y gestionar ficha del cliente

`Prioridad: Alta` · `Sprint: 1` · `3 pts` · `RF07 · RF08 · RNF06 · RNF10`

> Como Abogado o Administrador, quiero consultar la ficha de un cliente y ver todos sus procesos asociados desde un solo lugar, para tener una visión completa del historial jurídico del cliente sin navegar por múltiples módulos.

**Criterios de aceptación**

- La ficha del cliente muestra todos sus datos registrados (persona natural o jurídica).
- La ficha incluye una sección con la lista de todos los procesos jurídicos asociados a ese cliente.
- Desde la lista de procesos en la ficha, el abogado puede acceder directamente a cada expediente con un clic.
- El Abogado puede editar los datos del cliente; la modificación queda registrada en bitácora.
- No es posible eliminar definitivamente un cliente que tenga procesos activos asociados.

### Módulo 3 — Gestión de procesos jurídicos

#### HU-07 — Crear expediente jurídico digital

`Prioridad: Alta` · `Sprint: 1` · `8 pts` · `RF09 · RF10 · RF11 · RF05`

> Como Abogado o Administrador, quiero crear un expediente jurídico digital asociado a un número de radicado único, para centralizar toda la información del caso en un solo lugar digital.

**Criterios de aceptación**

- El formulario de creación solicita campos obligatorios: número de radicado, tipo de proceso, estado procesal y abogado responsable.
- Los campos opcionales incluyen: juzgado, clase de proceso, área del derecho y fecha de radicación.
- El sistema valida que no exista otro proceso con el mismo número de radicado; si hay duplicado, muestra error descriptivo.
- Al guardar, el expediente queda creado con estado inicial 'Activo'.
- El sistema asocia automáticamente el expediente al cliente seleccionado.
- La creación queda registrada en bitácora con usuario, fecha/hora e IP.

#### HU-08 — Asignar múltiples abogados y colaboradores a un proceso

`Prioridad: Alta` · `Sprint: 2` · `5 pts` · `RF12 · RN04`

> Como Administrador o Abogado responsable, quiero asignar o desasignar abogados y colaboradores adicionales a un proceso, para permitir el trabajo colaborativo en casos complejos que requieren más de un profesional.

**Criterios de aceptación**

- El sistema permite asignar uno o más abogados y/o colaboradores a un mismo proceso.
- El proceso siempre debe tener al menos un abogado responsable asignado.
- El sistema impide eliminar al único abogado responsable de un proceso activo sin designar simultáneamente a otro.
- Los colaboradores asignados reciben notificaciones de audiencias y términos del proceso.
- El cambio de asignación queda registrado en el historial del proceso y en bitácora.

#### HU-09 — Cambiar el estado del proceso

`Prioridad: Alta` · `Sprint: 2` · `5 pts` · `RF13 · RF14 · RN03 · RN05`

> Como Abogado responsable o Administrador, quiero modificar el estado de un proceso jurídico (activo, suspendido, archivado, finalizado), para reflejar con exactitud la situación actual del caso y controlar el ciclo de vida del expediente.

**Criterios de aceptación**

- Los estados disponibles son: Activo, Suspendido, Archivado y Finalizado.
- Un proceso no puede cambiar a 'Archivado' si tiene términos vencidos sin gestionar o audiencias programadas en los próximos 30 días; el sistema muestra los pendientes específicos.
- El Administrador puede forzar el archivado con confirmación explícita, lo cual queda registrado en auditoría.
- Un proceso en estado Finalizado o Archivado no puede regresar a Activo sin autorización del Administrador y justificación escrita registrada en historial y bitácora.
- Cada cambio de estado queda reflejado en el historial del proceso con usuario, fecha/hora y descripción.

#### HU-10 — Consultar historial de cambios del proceso

`Prioridad: Media` · `Sprint: 2` · `3 pts` · `RF14 · RNF03`

> Como Abogado o Administrador, quiero visualizar el historial completo de cambios realizados sobre un expediente, para auditar internamente las modificaciones y tener trazabilidad del avance del caso.

**Criterios de aceptación**

- El historial muestra todos los cambios registrados: modificaciones de datos, cambios de estado, reasignaciones de abogados y novedades.
- Cada entrada del historial indica: usuario responsable, fecha y hora del cambio y descripción de la acción.
- El historial está ordenado cronológicamente de más reciente a más antiguo.
- El historial es de solo lectura; ningún usuario puede editarlo.

### Módulo 4 — Gestión de partes procesales

#### HU-11 — Registrar partes procesales de un expediente

`Prioridad: Alta` · `Sprint: 2` · `5 pts` · `RF15 · RF16 · RF17`

> Como Abogado o Administrador, quiero registrar las partes involucradas en un proceso (demandante, demandado, víctima, tercero, cliente u otras), para tener identificados todos los actores del caso y su rol dentro del proceso.

**Criterios de aceptación**

- El sistema permite registrar partes con los roles: demandante, demandado, víctima, tercero, cliente y otros.
- Se puede crear un proceso sin registrar todas las partes desde el inicio.
- Si un proceso activo no tiene al menos un demandante y un demandado registrados, el sistema lo marca como incompleto.
- El proceso incompleto muestra un aviso visible en el dashboard y en la ficha del expediente.
- Se pueden agregar, editar o eliminar partes mientras el proceso está activo.

### Módulo 5 — Gestión documental

#### HU-12 — Cargar documentos al expediente

`Prioridad: Alta` · `Sprint: 2` · `5 pts` · `RF18 · RF20 · RF24`

> Como Abogado o Colaborador, quiero subir documentos digitales al expediente de un proceso, para centralizar toda la documentación del caso y eliminar el uso de carpetas físicas.

**Criterios de aceptación**

- Los formatos aceptados son: PDF, DOCX, XLSX, JPG y PNG.
- El tamaño máximo por archivo es 10 MB.
- El sistema muestra un error descriptivo si el archivo supera el límite o el formato no es válido.
- Al cargar, el sistema registra automáticamente la fecha y hora de carga.
- El documento queda asociado al expediente seleccionado.
- El sistema conserva un historial de creación, modificación y carga de cada documento.

#### HU-13 — Clasificar y organizar documentos por categoría

`Prioridad: Alta` · `Sprint: 2` · `3 pts` · `RF19 · RF20 · RF21`

> Como Abogado o Colaborador, quiero clasificar cada documento en una categoría al momento de subirlo o editarlo, para mantener el expediente organizado y poder localizar documentos rápidamente.

**Criterios de aceptación**

- Las categorías disponibles son: Demandas, Pruebas, Contratos, Escritos, Notificaciones, Providencias y Otros.
- El abogado puede cambiar la categoría de un documento después de cargarlo.
- La vista del expediente permite filtrar documentos por categoría.
- Los documentos se listan cronológicamente por fecha y hora de carga dentro de cada categoría.
- El sistema permite asociar documentos generales no vinculados a un proceso específico.

#### HU-14 — Controlar la visibilidad de documentos

`Prioridad: Alta` · `Sprint: 2` · `5 pts` · `RF22 · RF43 · RF44 · RF46`

> Como Abogado o Administrador, quiero definir la visibilidad de cada documento entre tres niveles: privado, compartido con cliente o visible para colaboradores, para proteger información confidencial y controlar qué puede ver cada actor del proceso.

**Criterios de aceptación**

- Al cargar o editar un documento, el abogado elige la visibilidad: Privado, Compartido con cliente, o Visible para colaboradores.
- Los documentos marcados como Privados solo los ve el abogado responsable y el Administrador.
- Los documentos 'Compartidos con cliente' aparecen en el portal del cliente para descarga.
- Los documentos 'Visibles para colaboradores' son accesibles para los colaboradores asignados al proceso.
- El cliente nunca puede ver notas internas, estrategias jurídicas ni documentos privados.

#### HU-15 — Versionar documentos y consultar versiones anteriores

`Prioridad: Alta` · `Sprint: 3` · `5 pts` · `RF23 · RN06`

> Como Abogado o Administrador, quiero subir nuevas versiones de un documento y consultar o descargar cualquier versión anterior, para mantener el historial completo del documento sin perder versiones previas relevantes para el proceso.

**Criterios de aceptación**

- Al subir un archivo sobre un documento existente, el sistema lo guarda como nueva versión sin eliminar las anteriores.
- La versión activa siempre es la más reciente.
- El abogado puede visualizar la lista de versiones anteriores con fecha, hora y usuario que la cargó.
- El abogado puede descargar cualquier versión anterior.
- Un documento marcado como Reemplazado o Inactivo no puede ser reactivado; si se necesita su contenido, debe cargarse como nueva versión.

#### HU-16 — Restringir y gestionar eliminación de documentos

`Prioridad: Alta` · `Sprint: 3` · `5 pts` · `RF25 · RF26 · RN06 · RNF06`

> Como Abogado o Administrador, quiero marcar documentos erróneos como reemplazados o inactivos, y restringir la eliminación definitiva de documentos críticos, para garantizar la integridad del expediente y cumplir con los estándares de trazabilidad documental.

**Criterios de aceptación**

- El sistema no permite eliminar definitivamente documentos que hayan sido utilizados en actuaciones procesales.
- El abogado puede marcar un documento como 'Reemplazado' o 'Inactivo' sin perder trazabilidad.
- Un documento inactivo o reemplazado no puede ser reactivado.
- La eliminación definitiva de un documento solo la puede realizar el Administrador tras confirmar la acción en dos pasos.
- Toda eliminación definitiva queda registrada en la bitácora de auditoría.

### Módulo 6 — Gestión de audiencias

#### HU-17 — Registrar audiencia o diligencia

`Prioridad: Alta` · `Sprint: 3` · `3 pts` · `RF27`

> Como Abogado o Administrador, quiero registrar una audiencia o diligencia asociada a un proceso con fecha, hora y lugar, para centralizar el calendario de compromisos judiciales y evitar olvidos que generen sanciones disciplinarias.

**Criterios de aceptación**

- El formulario solicita: nombre/tipo de audiencia, fecha, hora, lugar y proceso asociado.
- La audiencia queda vinculada al expediente del proceso.
- Al registrar la audiencia, el sistema la muestra en el calendario general y en la ficha del proceso.
- El sistema permite registrar múltiples audiencias para un mismo proceso.
- El registro de la audiencia queda en bitácora.

#### HU-18 — Configurar recordatorios de audiencia

`Prioridad: Alta` · `Sprint: 3` · `5 pts` · `RF28 · RF29 · RF47`

> Como Abogado o Administrador, quiero configurar hasta 3 recordatorios con intervalos personalizados para cada audiencia, para recibir avisos con suficiente anticipación y garantizar que no se pierda ninguna diligencia.

**Criterios de aceptación**

- Al crear o editar una audiencia, el sistema permite configurar hasta 3 recordatorios.
- El intervalo de cada recordatorio es configurable por el usuario (ejemplo: 7 días, 3 días, 1 día antes).
- El sistema sugiere valores predeterminados al crear la audiencia: 48 horas antes, 24 horas antes y el mismo día de la audiencia.
- El abogado puede elegir el canal de notificación: solo plataforma, solo correo electrónico o ambos.
- Las notificaciones se envían al abogado responsable y a los colaboradores asignados al proceso.

#### HU-19 — Reprogramar audiencia con historial de cambios

`Prioridad: Alta` · `Sprint: 3` · `3 pts` · `RF30 · RF05`

> Como Abogado o Administrador, quiero reprogramar una audiencia a una nueva fecha u hora manteniendo un historial de los cambios, para reflejar modificaciones judiciales sin perder el registro de las fechas anteriores.

**Criterios de aceptación**

- El abogado puede modificar fecha, hora y lugar de una audiencia existente.
- El sistema mantiene el historial de todas las versiones anteriores de la audiencia (fechas y horas originales).
- Al reprogramar, los recordatorios se recalculan automáticamente con base en la nueva fecha.
- Se notifica al abogado responsable y colaboradores sobre la reprogramación.
- El cambio queda registrado en el historial del proceso y en bitácora.

#### HU-20 — Archivar audiencias realizadas al historial

`Prioridad: Media` · `Sprint: 3` · `3 pts` · `RF31`

> Como sistema (proceso automatizado), quiero mover automáticamente las audiencias cuya fecha ya pasó al historial del proceso, para mantener el panel de audiencias pendientes limpio y organizado, sin mezclar compromisos pasados con futuros.

**Criterios de aceptación**

- El sistema detecta audiencias con fecha y hora ya vencida y las mueve automáticamente al historial.
- Las audiencias archivadas siguen siendo consultables desde la ficha del proceso.
- El movimiento al historial queda registrado con fecha y hora de la operación.
- El abogado puede marcar manualmente una audiencia como realizada antes de que el sistema lo haga.

### Módulo 7 — Gestión de términos judiciales

#### HU-21 — Registrar término judicial con fecha de vencimiento

`Prioridad: Alta` · `Sprint: 3` · `3 pts` · `RF32 · RF34 · RF37`

> Como Abogado o Administrador, quiero registrar manualmente un término judicial con su fecha y hora de vencimiento, para hacer seguimiento a plazos legales críticos y evitar su vencimiento por falta de atención.

**Criterios de aceptación**

- El formulario solicita: nombre del término, fecha de vencimiento, proceso asociado e indicador de criticidad.
- El término queda asociado al expediente del proceso.
- El sistema mantiene visibles los términos vencidos hasta que el abogado los gestione manualmente.
- Los términos marcados como críticos envían una alerta adicional al Administrador.
- El registro queda en bitácora.

#### HU-22 — Configurar recordatorios de término judicial

`Prioridad: Alta` · `Sprint: 3` · `5 pts` · `RF33 · RF36 · RF37`

> Como Abogado o Administrador, quiero configurar hasta 3 recordatorios con fechas y horas específicas para cada término judicial, para recibir avisos oportunos antes del vencimiento y actuar dentro del plazo.

**Criterios de aceptación**

- El sistema permite configurar hasta 3 recordatorios por término, con fecha y hora configurables.
- Los valores predeterminados sugeridos son: 5 días, 1 día y el día del vencimiento.
- El sistema notifica al abogado asignado y a los colaboradores del proceso.
- El abogado elige entre notificación en plataforma, correo o ambos.
- Los términos críticos envían adicionalmente una alerta al Administrador.
- El sistema mantiene historial completo de todas las alertas enviadas por cada término.

#### HU-23 — Gestionar el estado de un término judicial

`Prioridad: Alta` · `Sprint: 3` · `5 pts` · `RF35 · RF37 · RN07 · RN08 · RN02`

> Como Abogado asignado o Administrador, quiero marcar un término judicial como cumplido, cumplido tardíamente o incumplido, para documentar oficialmente el resultado de cada plazo judicial y mantener el expediente actualizado.

**Criterios de aceptación**

- Los estados disponibles para un término son: Cumplido, Cumplido tardíamente e Incumplido.
- Si la gestión se registra después de la fecha de vencimiento, el sistema clasifica automáticamente el término como 'Cumplido tardíamente', sin permitir al usuario sobrescribir esa clasificación.
- Solo el Administrador puede corregir una clasificación tardía, con justificación escrita registrada en bitácora.
- El sistema registra quién gestionó el término y la fecha/hora exacta.
- Una alerta crítica de término solo puede ser cerrada por el usuario destinatario o por el Administrador (únicamente si el usuario destinatario está inactivo en el sistema), de forma manual y explícita.

### Módulo 8 — Dashboard principal

#### HU-24 — Ver panel principal personalizado según rol

`Prioridad: Alta` · `Sprint: 4` · `8 pts` · `RF38 · RF39 · RF40 · RN09`

> Como usuario autenticado, quiero acceder a un panel principal que muestre la información más relevante según mi rol, para tener visión inmediata del estado de mis responsabilidades sin revisar módulos individuales.

**Criterios de aceptación**

- El Administrador ve: todos los procesos, estadísticas globales, usuarios activos y alertas del sistema.
- El Abogado ve: sus procesos asignados, términos próximos a vencer, audiencias próximas y tareas pendientes.
- El Colaborador ve: tareas asignadas y los procesos en que participa.
- El Cliente solo accede a su portal personal.
- El panel prioriza visualmente: términos por vencer, términos vencidos, audiencias próximas, tareas pendientes y novedades judiciales.
- Los elementos en riesgo (términos vencidos, audiencias sin confirmar <24h, procesos sin movimiento) se marcan en rojo.
- El color rojo solo se usa para condiciones de riesgo procesal o disciplinario, nunca para elementos decorativos o recordatorios de baja prioridad.

#### HU-25 — Gestionar notificaciones del panel

`Prioridad: Alta` · `Sprint: 4` · `5 pts` · `RF41 · RF47 · RF48 · RF49 · RF50`

> Como Abogado o Administrador, quiero ver, leer y gestionar las notificaciones desde el panel principal, para mantener el panel ordenado y asegurarme de haber atendido cada alerta relevante.

**Criterios de aceptación**

- Las notificaciones leídas y tareas completadas se ocultan del panel pasadas 48 horas desde su gestión.
- El Administrador puede ajustar el tiempo de ocultación en la configuración general del sistema.
- Las alertas de prioridad alta (rojo) no se pueden desactivar y permanecen visibles hasta que el usuario las gestione manualmente.
- Las alertas de prioridad media se resaltan en naranja; las de baja prioridad, en gris.
- Si el mismo evento genera más de 5 alertas en 10 minutos, el sistema las agrupa en un resumen.
- El historial de notificaciones enviadas es consultable por el usuario.

#### HU-26 — Consultar estadísticas y reportes generales

`Prioridad: Media` · `Sprint: 4` · `5 pts` · `RF42`

> Como Administrador o Abogado, quiero consultar estadísticas de procesos (activos, finalizados, archivados, carga por abogado) con filtros por fecha, para tomar decisiones informadas sobre la distribución de trabajo y el rendimiento del consultorio.

**Criterios de aceptación**

- Las estadísticas muestran: procesos activos, finalizados, archivados y carga procesal por abogado.
- Las estadísticas son visibles únicamente para Administrador y Abogados.
- El usuario puede filtrar las estadísticas por rango de fechas: mes, trimestre, año o rango personalizado.
- Los datos se actualizan en tiempo real al aplicar filtros.
- El Administrador puede exportar el reporte en formato PDF o CSV.

### Módulo 9 — Portal del cliente

#### HU-27 — Acceder al portal del cliente

`Prioridad: Alta` · `Sprint: 4` · `5 pts` · `RF43 · RF46 · RN02 · RNF02 · RNF04`

> Como Cliente, quiero acceder a un portal personalizado donde pueda ver el estado de mis procesos y próximas audiencias, para estar informado sobre el avance de mi caso sin necesidad de llamar al abogado constantemente.

**Criterios de aceptación**

- El portal del cliente muestra: lista de sus procesos con estado actual, próximas audiencias autorizadas y últimas novedades registradas por el abogado.
- El cliente no puede ver notas internas, estrategias jurídicas ni información de otros clientes.
- El portal es accesible desde el navegador sin instalación de software adicional.
- El acceso requiere autenticación con las credenciales del cliente.
- La sesión del cliente expira tras 30 minutos de inactividad.

#### HU-28 — Descargar documentos autorizados desde el portal

`Prioridad: Alta` · `Sprint: 4` · `3 pts` · `RF44 · RF45 · RF46 · RF05`

> Como Cliente, quiero descargar desde mi portal los documentos que el abogado me ha habilitado, para obtener copias de mis documentos legales de forma autónoma y segura sin depender de visitas presenciales.

**Criterios de aceptación**

- El portal muestra únicamente los documentos marcados por el abogado como 'Compartido con cliente'.
- El cliente puede descargar cualquier documento visible en su portal.
- La descarga queda registrada en la bitácora de auditoría (usuario, fecha/hora, IP, documento).
- El cliente no puede subir, modificar ni eliminar documentos.
- Si un documento ha sido marcado como inactivo o reemplazado por el abogado, deja de aparecer en el portal del cliente.

### Módulo 10 — Alertas y notificaciones

#### HU-29 — Configurar canal y preferencias de notificación

`Prioridad: Media` · `Sprint: 4` · `4 pts` · `RF47 · RF48`

> Como Abogado o Colaborador, quiero elegir si quiero recibir notificaciones dentro de la plataforma, por correo electrónico o por ambos canales, para adaptar el sistema de alertas a mi forma de trabajo y no perder avisos importantes.

**Criterios de aceptación**

- El usuario puede activar o desactivar el canal: notificación en plataforma, correo electrónico o ambos.
- La configuración se guarda por usuario y puede modificarse en cualquier momento.
- El usuario puede ajustar la prioridad predeterminada por tipo de evento (audiencia, término, tarea).
- Las alertas de prioridad alta no pueden desactivarse independientemente del canal seleccionado.
- El cambio de preferencias queda registrado en bitácora.

#### HU-30 — Visualizar y gestionar alertas críticas

`Prioridad: Alta` · `Sprint: 4` · `5 pts` · `RF48 · RF49 · RF50 · RN08 · RN02`

> Como Abogado responsable o Administrador, quiero visualizar y cerrar manualmente las alertas de prioridad alta que me corresponden, para asegurar que ninguna alerta crítica desaparezca del panel sin haber sido atendida conscientemente.

**Criterios de aceptación**

- Las alertas críticas (prioridad alta) se resaltan en rojo y permanecen visibles en el panel hasta ser gestionadas manualmente.
- Una alerta crítica solo puede cerrarse por el usuario destinatario de la alerta o por el Administrador (únicamente si el usuario destinatario está inactivo en el sistema), de forma manual y explícita.
- Ningún proceso automatizado del sistema puede cerrar una alerta de prioridad alta.
- El Administrador puede gestionar alertas críticas de un abogado inactivo.
- Al cerrar una alerta, el sistema registra quién la gestionó, cuándo y desde qué IP.
- El usuario puede consultar el historial completo de notificaciones enviadas y gestionadas.

#### HU-31 — Buscar y filtrar procesos/expedientes

`Prioridad: Alta` · `Sprint: 2` · `5 pts` · `RNF05 · RNF08`

> Como Abogado o Administrador, quiero buscar y filtrar expedientes jurídicos en el sistema por radicado, nombre de cliente, juzgado, abogado responsable, estado procesal y tipo de proceso, para localizar rápidamente la información de un caso específico.

**Criterios de aceptación**

- La búsqueda permite filtrar por: número de radicado, nombre del cliente, juzgado, abogado responsable, estado procesal y tipo de proceso.
- El sistema muestra los resultados en menos de 2 segundos bajo carga normal.
- La búsqueda se activa automáticamente al ingresar al menos 3 caracteres (búsqueda parcial).
- Es posible combinar múltiples filtros de búsqueda de forma simultánea.
- Los resultados de búsqueda se muestran paginados en grupos de 20 registros.
- La búsqueda está disponible únicamente para Administradores, Abogados y Colaboradores en sus respectivos niveles de visibilidad.

#### HU-32 — Habilitar y configurar autenticación de doble factor (2FA)

`Prioridad: Alta` · `Sprint: 1` · `5 pts` · `RNF02`

> Como usuario registrado, quiero habilitar y configurar la autenticación de doble factor (2FA) en mi cuenta, para añadir una capa adicional de seguridad al iniciar sesión en la plataforma.

**Criterios de aceptación**

- El usuario puede activar o desactivar la autenticación de doble factor (2FA) desde su perfil.
- Al iniciar sesión con 2FA activo, el sistema solicita un código de verificación de un solo uso después del login básico.
- El código de verificación se envía por correo electrónico (o canal configurado) y tiene una validez estricta de 5 minutos.
- Si el código ingresado es incorrecto o expira, el sistema muestra un mensaje descriptivo y bloquea el acceso.
- El sistema registra en la bitácora de auditoría la habilitación, deshabilitación y uso de 2FA.

#### HU-33 — Modificar información general del expediente

`Prioridad: Alta` · `Sprint: 1` · `3 pts` · `RF11 · RF05`

> Como Abogado responsable o Administrador, quiero editar los datos generales de un expediente (juzgado, clase de proceso, área del derecho, fecha de radicación), para corregir errores de digitación o registrar actualizaciones del proceso.

**Criterios de aceptación**

- El usuario con permisos de edición puede modificar: juzgado, clase de proceso, área del derecho y fecha de radicación.
- No se puede modificar el número de radicado original para evitar duplicidades o inconsistencias en auditoría.
- Cada modificación queda registrada en el historial del proceso y en la bitácora de auditoría, indicando el usuario, fecha/hora, IP y los campos modificados.

#### HU-34 — Eliminar de forma definitiva expedientes (Admin)

`Prioridad: Alta` · `Sprint: 2` · `3 pts` · `RNF06 · RNF10 · RF05`

> Como Administrador, quiero eliminar de forma definitiva un expediente de proceso del sistema, para depurar información errónea bajo condiciones estrictas de seguridad.

**Criterios de aceptación**

- La eliminación definitiva está restringida exclusivamente al usuario con rol Administrador.
- El sistema requiere una confirmación en dos pasos antes de ejecutar la eliminación definitiva.
- No se permite eliminar procesos que tengan documentos activos o términos judiciales pendientes sin gestionar.
- La eliminación del expediente se registra en la bitácora de auditoría de forma inmutable, indicando el radicado, el Administrador que ejecutó la acción, la justificación, fecha/hora e IP.

#### HU-35 — Registro en la plataforma

`Prioridad: Alta` · `Sprint: 1` · `8 pts` · `RF51 · RF54`

> Como consultorio jurídico o abogado independiente, quiero registrarme desde una página pública eligiendo mi tipo de perfil, para obtener mi propio espacio aislado en el sistema.

**Criterios de aceptación**

- Página /registro permite elegir entre abogado independiente o consultorio.
- Formulario cambia dinámicamente según el tipo elegido.
- Campos obligatorios para independiente: nombre, email, contraseña.
- Campos obligatorios para consultorio: nombre del consultorio, email, contraseña.
- Campos opcionales para consultorio: razón social, NIT, teléfono, ciudad.
- Sistema envía email de verificación al registrarse.
- Enlace de verificación válido por 24 horas.
- Si expira el enlace el usuario puede solicitar reenvío.
- Al verificar se crea el tenant y usuario admin automáticamente.
- El nuevo usuario puede iniciar sesión de inmediato.

#### HU-36 — Configurar perfil del consultorio

`Prioridad: Media` · `Sprint: 1` · `3 pts` · `RF53`

> Como Administrador del tenant, quiero actualizar los datos de mi consultorio, para mantener la información actualizada.

**Criterios de aceptación**

- El Admin puede editar: nombre, razón social, NIT, logo, teléfono, dirección y ciudad.
- Los cambios quedan guardados inmediatamente.
- El logo acepta formato JPG y PNG máximo 2 MB.
- Los cambios quedan registrados en bitácora.
- Ningún otro tenant puede ver ni modificar esta configuración.

### Módulo 3.b — Actuaciones procesales

#### HU-37 — Registrar y consultar las actuaciones procesales de un expediente

`Prioridad: Alta` · `Sprint: 2` · `5 pts` · `RF55 · RF56 · RF57 · RF58 · RF59`

> Como Abogado o Colaborador, quiero registrar cada actuación ocurrida en el juzgado (auto, sentencia, notificación, audiencia…) con su fecha y anotación, para reconstruir la historia del caso y saber de qué acto procesal nace cada término.

**Criterios de aceptación**

- El formulario solicita fecha de la actuación, tipo y anotación; los tres son obligatorios.
- El tipo se elige de un catálogo cerrado de 10 valores: AUTO, SENTENCIA, NOTIFICACION, AUDIENCIA, MEMORIAL, DEMANDA, CONTESTACION, RECURSO, TRASLADO y OTRO. El sistema rechaza cualquier otro valor.
- La fecha de la actuación (cuándo ocurrió en el juzgado) es distinta de la fecha de registro (cuándo se digitó en el sistema); ambas se conservan.
- Las actuaciones se listan en orden cronológico inverso dentro de la ficha del expediente.
- Cada actuación muestra los términos judiciales que se originaron a partir de ella.
- Al registrar un término judicial se puede indicar, de forma opcional, la actuación que lo originó; el sistema valida que esa actuación pertenezca al mismo expediente.
- El registro de una actuación queda en el historial del expediente y en la bitácora de auditoría.
- El abogado responsable y el Administrador pueden corregir una actuación mal digitada; el cambio conserva el valor anterior en el historial.
- Solo el Administrador puede eliminar una actuación, y el botón únicamente se le muestra a él.
- No se puede eliminar una actuación que tenga términos judiciales asociados.

> **Nota:** esta historia no existía en `HU_Sistema_Juridico_v3.docx`. Se redactó para cubrir
> RF55–RF59, que recuperan una entidad presente en la investigación de dominio y perdida al
> reescribir los requisitos. Ver [ADR-010](11-DECISIONES-ARQUITECTONICAS.md).
