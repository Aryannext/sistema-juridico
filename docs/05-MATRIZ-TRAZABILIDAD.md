# 05 — Matriz de trazabilidad

Este es el documento que **conecta la especificación con el código real**. Para cada requisito
funcional indica qué historia lo cubre, qué endpoint lo expone, en qué archivo vive la lógica
y si existe una prueba automatizada que lo verifique.

Es la respuesta directa a *"los RF y las HU no coinciden con la plataforma"*: aquí queda
demostrado, línea por línea, dónde sí coinciden y dónde no.

**Convención:** las rutas se escriben sin el prefijo `/api`.

---

## 1. Trazabilidad RF → HU → código

| RF | HU | Endpoint | Archivo | Prueba | Estado |
|---|---|---|---|---|:--:|
| RF01 | HU-01 | `POST /auth/login` | `auth.controller.js: login` | `auth.controller.test.js` | 🟡 |
| RF02 | HU-02 | — | `schema.prisma: RolUsuario` | — | ✅ |
| RF03 | HU-02 | `PUT /admin/permisos/:id` | `admin.controller.js: updatePermisos` · `roles.middleware.js` | — | ✅ |
| RF04 | HU-02 | `GET /procesos` | `procesos.controller.js: getProcesos` | — | ✅ |
| RF05 | HU-03 | *(transversal)* | `audit.middleware.js` + escrituras en controladores | `auditoria.test.js` | 🟡 |
| RF06 | HU-04, HU-05 | `POST /clientes` | `clientes.controller.js: createCliente` | — | 🟡 |
| RF07 | HU-06 | — | relación `Cliente → Proceso` | — | ✅ |
| RF08 | HU-06 | `GET /clientes/:id` | `clientes.controller.js: getClienteById` | — | ✅ |
| RF09 | HU-07 | `POST /procesos` | `procesos.controller.js: createProceso` | — | ✅ |
| RF10 | HU-07 | `POST /procesos` | idem (`findUnique` por radicado) | — | 🟡 |
| RF11 | HU-07, HU-33 | `POST /procesos`, `PUT /procesos/:id` | `createProceso`, `updateProceso` | — | ✅ |
| RF12 | HU-08 | `POST /procesos/:id/abogados` | `addAbogadoProceso` | — | ✅ |
| RF13 | HU-09 | `PUT /procesos/:id/estado` | `cambiarEstadoProceso` | `procesos.controller.test.js` | ✅ |
| RF14 | HU-09, HU-10 | `GET /procesos/:id` | `historial_proceso` | — | ✅ |
| RF55 | HU-37 | `POST /actuaciones` | `actuaciones.controller.js: createActuacion` | `actuaciones.test.js` | ✅ |
| RF56 | HU-37 | `POST /actuaciones` | `enum TipoActuacion` + `TIPOS_VALIDOS` | `actuaciones.test.js` | ✅ |
| RF57 | HU-37 | `GET /actuaciones/proceso/:id` | `getActuacionesProceso` | — | ✅ |
| RF58 | HU-37 | `POST /terminos` | `TerminoJudicial.id_actuacion` | — | ✅ |
| RF59 | HU-37 | `DELETE /actuaciones/:id` | `deleteActuacion` | `actuaciones.test.js` | ✅ |
| RF15 | HU-11 | `POST /procesos/:id/partes` | `addParteProcesal` | — | ✅ |
| RF16 | HU-11 | — | sin validación bloqueante (correcto) | — | ✅ |
| RF17 | HU-11 | — | `ProcesoDetalle.jsx:744` | — | 🟡 |
| RF18 | HU-12 | `POST /documentos` | `documentos.routes.js` (multer, 10 MB) | — | 🟡 |
| RF19 | HU-13 | `POST /documentos` | `schema.prisma: CategoriaDocumento` | — | 🟡 |
| RF20 | HU-13 | `GET /documentos/proceso/:id` | `getProcesoDocumentos` (`created_at desc`) | — | ✅ |
| RF21 | HU-13 | `POST /documentos` | `Documento.id_proceso` opcional | — | ✅ |
| RF22 | HU-14 | `GET /documentos/proceso/:id` | `documentos.controller.js:282-300` | — | ✅ |
| RF23 | HU-15 | `POST /documentos/:id/version` | `uploadNuevaVersion` | — | ✅ |
| RF24 | HU-12 | *(transversal)* | bitácora módulo `DOCS` | — | ✅ |
| RF25 | HU-16 | `DELETE /documentos/:id/definitivo` | `deleteDocumentoDefinitivo` | `eliminacion_documentos.test.js` | ✅ |
| RF26 | HU-16 | `PATCH /documentos/:id/estado` | `updateDocumentoEstado` | `eliminacion_documentos.test.js` | ✅ |
| RF27 | HU-17 | `POST /audiencias` | `createAudiencia` | — | ✅ |
| RF28 | HU-18 | `POST /audiencias` | idem (48 h / 24 h / mismo día) | — | ✅ |
| RF29 | HU-18 | *(cron)* | `recordatorios.job.js` | — | ✅ |
| RF30 | HU-19 | `PUT /audiencias/:id` | `updateAudiencia` | — | ✅ |
| RF31 | HU-20 | `GET /audiencias` | `autoArchivePastHearings` | — | ✅ |
| RF32 | HU-21 | `POST /terminos` | `createTermino` | `terminos_audiencias.test.js` | ✅ |
| RF33 | HU-22 | `POST /terminos` | idem (5 d / 1 d / día) | — | ✅ |
| RF34 | HU-21 | `GET /terminos/vencimientos` | `getAlertasVencimientos` | — | ✅ |
| RF35 | HU-23 | `PUT /terminos/:id/gestion` | `gestionarTermino` | `terminos_audiencias.test.js` | ✅ |
| RF36 | HU-22 | — | `RecordatorioTermino` | — | 🟡 |
| RF37 | HU-21, HU-22 | `POST /terminos` | notificación adicional a administradores | — | ✅ |
| RF38 | HU-24 | `GET /reportes/stats`, `GET /terminos/vencimientos` | `DashboardIndex.jsx` | — | ✅ |
| RF39 | HU-24 | — | `DashboardIndex.jsx` | — | ✅ |
| RF40 | HU-24 | — | `DashboardIndex.jsx` | — | 🟡 |
| RF41 | HU-25 | `GET /notificaciones` | `Tenant.horas_ocultar_notificaciones` | — | ✅ |
| RF42 | HU-26 | `GET /reportes/stats` | `reportes.controller.js: getStats` | — | ✅ |
| RF43 | HU-27 | `GET /portal/dashboard` | `getPortalDashboard` | — | ✅ |
| RF44 | HU-14 | `POST /documentos` | `VisibilidadDocumento` | — | ✅ |
| RF45 | HU-28 | `GET /documentos/download/:id` | `getVersionDownloadUrl` | — | ✅ |
| RF46 | HU-27 | `GET /portal/procesos/:id` | `portal.controller.js:119` | — | ✅ |
| RF47 | HU-25, HU-29 | `GET /notificaciones` | ventana deslizante en `notificaciones.controller.js` | — | ✅ |
| RF48 | HU-29, HU-30 | `PUT /auth/preferencias` | `PrioridadNotificacion` | — | ✅ |
| RF49 | HU-30 | `PUT /notificaciones/:id/gestionar` | `gestionarNotificacion` | `notificaciones.test.js` | ✅ |
| RF50 | HU-25 | `GET /notificaciones` | las notificaciones no se borran | — | ✅ |
| RF51 | HU-35 | `POST /auth/registro` | `auth.controller.js: registro` | — | ✅ |
| RF52 | *(transversal)* | todos | `auth.middleware.js:29` + `where: { tenant_id }` | — | 🟡 |
| RF53 | HU-36 | `PUT /tenant/perfil` | `tenant.controller.js: updatePerfil` | — | ✅ |
| RF54 | HU-35 | `GET /auth/verificar/:token` | `verificarEmail` | — | 🟡 |

---

## 2. Trazabilidad RN → código → prueba

Esta tabla es la más valiosa para una sustentación: las reglas de negocio son lo que
distingue un CRUD de un sistema real, y **cinco de las nueve tienen prueba automatizada**.

| RN | Regla | Dónde se aplica | Prueba | Estado |
|---|---|---|---|:--:|
| RN01 | Bitácora inmutable | Ausencia de `update`/`delete` sobre `bitacoraAuditoria` en todo el backend | `auditoria.test.js` | ✅ |
| RN02 | Límites del Administrador | `notificaciones.controller.js`; `portal.controller.js` exige `rol === 'CLIENTE'` | `notificaciones.test.js` | 🟡 |
| RN03 | Reactivación restringida | `cambiarEstadoProceso`, Regla 2 | — | ✅ |
| RN04 | Continuidad del abogado responsable | `removeAbogadoProceso` | — | 🟡 |
| RN05 | No archivar con pendientes | `cambiarEstadoProceso`, Regla 1 | `procesos.controller.test.js` | ✅ |
| RN06 | Documento inactivo no se reactiva | `updateDocumentoEstado` | `eliminacion_documentos.test.js` | ✅ |
| RN07 | Término tardío automático | `gestionarTermino` | `terminos_audiencias.test.js` | ✅ |
| RN08 | Cierre manual de alertas críticas | `gestionarNotificacion` | `notificaciones.test.js` (3 casos) | ✅ |
| RN09 | Semántica del color de riesgo | `DashboardIndex.jsx` | — | ✅ |

---

## 3. Verificación de extremo a extremo

Además de las pruebas unitarias, existe un script que **arranca contra la API en ejecución** y
comprueba que el comportamiento real coincide con lo que afirman estos documentos. Es la
respuesta a *"¿la plataforma cumple lo que está documentado?"*.

```bash
cd backend
npm start                                    # en una terminal
npm run verificar                            # en otra
npm run verificar:limpiar                    # borra los datos que generó
```

El script crea **dos consultorios distintos** para poder probar el aislamiento, y se niega a
ejecutarse si `DATABASE_URL` no apunta a `localhost`.

### Resultado de la última ejecución — 2 de septiembre de 2026

**34 comprobaciones · 31 conformes · 3 no conformes.**

Las tres no conformidades son **brechas ya documentadas**, no hallazgos nuevos:

| Ref | Comprobación | Resultado | Dónde está documentada |
|---|---|---|---|
| RF05 | El inicio de sesión queda en la bitácora | ❌ no se registra | Hallazgo H-20 · Ola 2.1 |
| RNF03 | La bitácora se puede exportar | ❌ `404`, no existe el endpoint | Doc 03, RNF03 🟡 · Ola 4.3 |
| RF42 | Los reportes se exportan en PDF | ❌ `404`, no existe el endpoint | Doc 03, RF42 🟡 · Ola 4.3 |

> **Que las tres coincidan con lo documentado es el resultado deseado:** significa que el
> catálogo de requisitos describe el sistema con honestidad, sin marcar como ✅ cosas que no
> funcionan. Un fallo *no* documentado habría sido la mala noticia.

> **Cambio respecto a la ejecución del 1 de septiembre:** eran cuatro. La cuarta era que la API
> aceptaba la contraseña `"1"` en el registro (RNF02); quedó corregida el 2 de septiembre al
> llevar la política de contraseñas al servidor. Ver [doc 17](17-RECUPERACION-DE-ACCESO.md).

### Lo que sí quedó verificado en ejecución

| Área | Comprobaciones |
|---|---|
| **Aislamiento entre consultorios** (RF52, RNF11) | 4 — leer expediente ajeno, listado de expedientes, listado de clientes y registrar actuación en expediente ajeno. **Todas conformes** |
| Búsqueda y paginación (RNF05) | 4 — búsqueda parcial, forma del objeto `pagination`, tamaño de página 20, umbral de 3 caracteres |
| Actuaciones (RF55–RF59) | 7 — alta, catálogo cerrado, fechas sin desplazamiento, vínculo con términos, borrado restringido |
| Reglas de negocio (RN03, RN05, RN07) | 5 — justificación obligatoria, bloqueo de archivado, forzado por Administrador, término tardío automático |
| Autenticación y registro (RF01, RF51, RNF01) | 3 |
| Clientes y expedientes (RF06, RF09, RF10) | 3 |
| Bitácora y reportes | 4 |

**El aislamiento entre consultorios era el hueco más grave del plan de pruebas** —este documento
lo señalaba como *"la ausencia más grave"*— y ahora está cubierto y en verde.

---

## 4. Cobertura de pruebas automatizadas

**8 suites · 21 pruebas · todas en verde sobre Node 24.16.0** (ver doc 09).

| Suite | Qué verifica | HU / RN |
|---|---|---|
| `auth.controller.test.js` | Rechazo de credenciales inválidas; inicio del flujo 2FA con correo simulado | HU-01, HU-32 |
| `auditoria.test.js` | La bitácora registra usuario, IP y detalle | HU-03, RN01 |
| `procesos.controller.test.js` | Bloqueo de archivado con pendientes; archivado permitido sin pendientes | HU-09, RN05 |
| `eliminacion_expediente.test.js` | Bloqueo a no administradores; bloqueo con documentos activos; eliminación válida con registro en auditoría | HU-34, RNF06 |
| `eliminacion_documentos.test.js` | Bloqueo a no administradores; bloqueo por documento en uso; marcado como inactivo | HU-16, RN06 |
| `notificaciones.test.js` | El destinatario cierra su alerta crítica; el Administrador **no** puede cerrar la de un usuario activo; **sí** puede si está inactivo | HU-30, RN02, RN08 |
| `terminos_audiencias.test.js` | Reclasificación forzada a `CUMPLIDO_TARDIO` | HU-23, RN07 |
| `actuaciones.test.js` | Rechazo de tipo fuera del catálogo; bloqueo de actuación en expediente de otro consultorio; registro con historial; eliminación restringida al Administrador; bloqueo si hay términos asociados | HU-37, RF55–RF59 |

### Lo que las pruebas **no** cubren

Es tan importante saber esto como saber lo cubierto:

| Área sin cobertura | Riesgo |
|---|---|
| ~~**Aislamiento entre tenants**~~ | ✅ **RESUELTO** el 1/09/2026: cubierto por 4 comprobaciones de extremo a extremo (sección 3), todas conformes. Sigue sin prueba *unitaria*, pero ya no está sin verificar |
| Carga y versionado de documentos | Medio — implica simular R2 |
| ~~Búsqueda, filtros y paginación (HU-31)~~ | ✅ Cubierto por 4 comprobaciones de extremo a extremo (sección 3) |
| Permisos granulares (`requirePermission`) | Medio — solo se prueba el filtro grueso por rol |
| Portal del cliente | Medio — RF46 (no ver documentos privados) no tiene prueba |
| Trabajo del cron de recordatorios | Bajo |
| Frontend | Cypress está instalado y configurado en CI, pero **no hay ninguna especificación de prueba en el repositorio** |

**Siguiente paso recomendado:** trasladar las comprobaciones de aislamiento de la sección 3
a pruebas unitarias en `src/tests/`, para que corran en cada `npm test` y en el CI sin
necesidad de levantar la API. Hoy la verificación existe, pero es manual.

---

## 5. Trazabilidad inversa: código sin requisito que lo respalde

Funcionalidad que existe en la plataforma y **ningún RF menciona**:

| Funcionalidad | Dónde | Comentario |
|---|---|---|
| ~~Actuaciones procesales~~ | ~~ninguna~~ | ✅ **RESUELTO**: era el caso inverso — el README la prometía y no existía. Hoy es RF55–RF59 / HU-37 |
| Webhooks hacia n8n | `config/webhook.js`; eventos `NUEVO_CLIENTE` y `ACTUALIZACION_PROCESO` | Sin RF. **Debe documentarse**: envía datos de clientes y procesos a un sistema externo, lo cual es relevante para la Ley 1581 de 2012 |
| Bloqueo progresivo escalado (1/5/15/30/60 min) | `auth.controller.js: login` | RNF02 solo pide "bloqueo temporal tras 5 intentos". La implementación es **más estricta** que el requisito. Conviene actualizar RNF02 para reflejarlo |
| Cuenta regresiva visible de desbloqueo | `LoginPage.jsx` (commits `751ef70`, `7ebf5c4`) | Mejora de usabilidad no especificada |
| `Tenant.plan` (`BASICO` / `PRO`) | `schema.prisma` | Campo comercial sin RF ni uso en el código. Es un vestigio; decidir si se implementa o se retira |
| Acceso al portal generado por el abogado | `POST /clientes/:id/portal-access` | HU-27 asume que el cliente ya tiene credenciales, pero nunca dice quién las crea. La implementación resolvió el hueco; **falta la HU que lo documente** |

> **Sugerencia:** redactar **HU-37 — Habilitar el acceso al portal para un cliente**
> para cerrar el último punto. Es funcionalidad real, en producción, sin historia que la respalde.
