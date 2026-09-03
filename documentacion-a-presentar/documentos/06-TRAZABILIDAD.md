# 06 — Trazabilidad

Este documento responde a una sola pregunta, en los dos sentidos:

> **«Muéstreme dónde está esto implementado»** — y al revés — **«¿de qué requisito viene este código?»**

---

## 1. De requisito a código

| RF | Qué exige (resumen) | Historia | Endpoint | Archivo |
|---|---|---|---|---|
| RF01 | Inicio de sesión | HU-01 | `POST /auth/login` | `auth.controller.js` |
| RF02 | Cuatro roles | HU-02 | — | `enum RolUsuario` |
| RF03 | Permisos por módulo | HU-02 | `PUT /admin/permisos/:id` | `roles.middleware.js` |
| RF04 | El abogado ve solo lo suyo | HU-02 | `GET /procesos` | `procesos.controller.js` |
| RF05 | Bitácora completa | HU-03 | `GET /admin/auditoria` | `audit.middleware.js` |
| RF06 | Campos por tipo de persona | HU-04, HU-05 | `POST /clientes` | `clientes.controller.js` |
| RF07 | Un cliente, varios procesos | HU-06 | `GET /clientes/:id` | `clientes.controller.js` |
| RF08 | Procesos desde la ficha | HU-06 | `GET /clientes/:id` | `ClienteFicha.jsx` |
| RF09 | Crear expediente | HU-07 | `POST /procesos` | `procesos.controller.js` |
| RF10 | Radicado no duplicado | HU-07 | `POST /procesos` | `procesos.controller.js` |
| RF11 | Datos del expediente | HU-07, HU-33 | `PUT /procesos/:id` | `procesos.controller.js` |
| RF12 | Equipo de trabajo | HU-08 | `POST /procesos/:id/abogados` | `procesos.controller.js` |
| RF13 | Estado del proceso | HU-09 | `PUT /procesos/:id/estado` | `procesos.controller.js` |
| RF14 | Historial de cambios | HU-10, HU-33 | `GET /procesos/:id` | `historial_proceso` |
| RF15 | Tipos de parte | HU-11 | `POST /procesos/:id/partes` | `procesos.controller.js` |
| RF16 | Proceso sin partes | HU-11 | — | *(sin validación bloqueante)* |
| RF17 | Aviso de incompleto | HU-11 | — | `ProcesoDetalle.jsx` |
| RF18 | Formatos y tamaño | HU-12 | `POST /documentos` | `documentos.routes.js` |
| RF19 | Categorías | HU-13 | — | `enum CategoriaDocumento` |
| RF20 | Orden cronológico | HU-13 | `GET /documentos/proceso/:id` | `documentos.controller.js` |
| RF21 | Documentos generales | HU-13 | `POST /documentos` | `Documento.id_proceso` opcional |
| RF22 | Visibilidad | HU-14 | `PATCH /documentos/:id/estado` | `documentos.controller.js` |
| RF23 | Versionado | HU-15 | `POST /documentos/:id/version` | `documentos.controller.js` |
| RF24 | Historial documental | HU-12 | — | `audit.middleware.js` |
| RF25 | Eliminación restringida | HU-16 | `DELETE /documentos/:id/definitivo` | `documentos.controller.js` |
| RF26 | Reemplazado o inactivo | HU-16 | `PATCH /documentos/:id/estado` | `documentos.controller.js` |
| RF27 | Registrar audiencia | HU-17 | `POST /audiencias` | `audiencias.controller.js` |
| RF28 | Recordatorios de audiencia | HU-18 | `POST /audiencias` | `audiencias.controller.js` |
| RF29 | Destinatarios | HU-18 | — | `recordatorios.job.js` |
| RF30 | Reprogramación | HU-19 | `PUT /audiencias/:id` | `audiencias.controller.js` |
| RF31 | Archivado automático | HU-20 | `GET /audiencias/proceso/:id` | `autoArchivePastHearings` |
| RF32 | Registrar término | HU-21 | `POST /terminos` | `terminos.controller.js` |
| RF33 | Recordatorios por defecto | HU-22 | `POST /terminos` | `terminos.controller.js` |
| RF34 | Vencidos visibles | HU-21 | `GET /terminos/vencimientos` | `terminos.controller.js` |
| RF35 | Gestión del término | HU-23 | `PUT /terminos/:id/gestion` | `terminos.controller.js` |
| RF36 | Historial de alertas | HU-22 | — | `RecordatorioTermino` |
| RF37 | Recordatorios y criticidad | HU-21, HU-22, HU-23 | `POST /terminos` | `terminos.controller.js` |
| RF38 | Panel por rol | HU-24 | — | `DashboardIndex.jsx` |
| RF39 | Priorización | HU-24 | — | `DashboardIndex.jsx` |
| RF40 | Semáforo | HU-24 | — | `terminos.utils.js` |
| RF41 | Ocultar lo gestionado | HU-25 | `GET /notificaciones` | `notificaciones.controller.js` |
| RF42 | Estadísticas y exportación | HU-26 | `GET /reportes/stats`, `/export/csv` | `reportes/exportacion.js` |
| RF43 | Contenido del portal | HU-27 | `GET /portal/dashboard` | `portal.controller.js` |
| RF44 | Qué ve el cliente | HU-14, HU-28 | — | `enum VisibilidadDocumento` |
| RF45 | Descarga | HU-28 | `GET /documentos/download/:id` | `documentos.controller.js` |
| RF46 | Restricción de lo interno | HU-27 | `GET /portal/procesos/:id` | `portal.controller.js` |
| RF47 | Canal y agrupación | HU-25, HU-29 | `PUT /auth/preferencias` | `notificaciones.controller.js` |
| RF48 | Prioridades | HU-29, HU-30 | — | `enum PrioridadNotificacion` |
| RF49 | Alertas persistentes | HU-30 | `PUT /notificaciones/:id/gestionar` | `notificaciones.controller.js` |
| RF50 | Historial de notificaciones | HU-30 | `GET /notificaciones` | `notificaciones.controller.js` |
| RF51 | Registro público | HU-35 | `POST /auth/registro` | `auth.controller.js` |
| RF52 | Aislamiento | HU-02 | *(todos)* | `auth.middleware.js` |
| RF53 | Perfil del consultorio | HU-36 | `PUT /tenant/perfil` | `tenant.controller.js` |
| RF54 | Verificación de cuenta | HU-35 | `GET /auth/verificar/:token` | `recuperacion.controller.js` |
| RF55 | Registrar actuaciones | HU-37 | `POST /actuaciones` | `actuaciones.controller.js` |
| RF56 | Catálogo de tipos | HU-37 | `POST /actuaciones` | `enum TipoActuacion` |
| RF57 | Cronología y dos fechas | HU-37 | `GET /actuaciones/proceso/:id` | `actuaciones.controller.js` |
| RF58 | Vínculo con el término | HU-37 | `POST /terminos` | `terminos.controller.js` |
| RF59 | Eliminación restringida | HU-37 | `DELETE /actuaciones/:id` | `actuaciones.controller.js` |

---

## 2. De historia a requisitos

| Historia | Nace de | Reglas | Depende de |
|---|---|---|---|
| HU-35 Registro | RF51, RF54 | — | *(raíz)* |
| HU-01 Login | RF01, RNF01, RNF02 | — | HU-35 |
| HU-32 2FA | RNF02 | — | HU-01 |
| HU-36 Perfil | RF53 | — | HU-01 |
| HU-02 Roles | RF02, RF03, RF04, RF05 | RN02 | HU-01 |
| HU-03 Bitácora | RF05, RNF03 | RN01 | HU-01 |
| HU-29 Preferencias | RF47, RF48 | — | HU-01 |
| HU-04 Cliente natural | RF06, RF05 | — | HU-01 |
| HU-05 Cliente jurídica | RF06, RF05 | — | HU-01 |
| HU-06 Ficha | RF07, RF08, RNF06, RNF10 | — | HU-04 / HU-05 |
| HU-07 Expediente | RF09, RF10, RF11, RF05 | — | HU-06, HU-02 |
| HU-33 Modificar | RF11, RF05 | — | HU-07 |
| HU-08 Equipo | RF12 | RN04 | HU-07 |
| HU-09 Estado | RF13, RF14 | RN03, RN05 | HU-07 |
| HU-10 Historial | RF14, RNF03 | — | HU-07 |
| HU-31 Buscar | RNF05, RNF08 | — | HU-07 |
| HU-34 Eliminar | RNF06, RNF10, RF05 | — | HU-07 |
| HU-11 Partes | RF15, RF16, RF17 | — | HU-07 |
| HU-37 Actuaciones | RF55–RF59 | — | HU-07 |
| HU-12 Cargar doc. | RF18, RF20, RF24 | — | HU-07 |
| HU-13 Categorías | RF19, RF20, RF21 | — | HU-12 |
| HU-14 Visibilidad | RF22, RF43, RF44, RF46 | — | HU-12 |
| HU-15 Versiones | RF23 | RN06 | HU-12 |
| HU-16 Eliminar doc. | RF25, RF26, RNF06 | RN06 | HU-12 |
| HU-17 Audiencia | RF27 | — | HU-07 |
| HU-18 Recordatorios | RF28, RF29, RF47 | — | HU-17 |
| HU-19 Reprogramar | RF30, RF05 | — | HU-17 |
| HU-20 Archivar | RF31 | — | HU-17 |
| HU-21 Término | RF32, RF34, RF37 | — | HU-07, *(HU-37)* |
| HU-22 Recordatorios | RF33, RF36, RF37 | — | HU-21 |
| HU-23 Gestionar | RF35, RF37 | RN07, RN08, RN02 | HU-21 |
| HU-24 Panel | RF38, RF39, RF40 | RN09 | HU-07, HU-17, HU-21 |
| HU-25 Notificaciones | RF41, RF47–RF50 | — | HU-18, HU-22 |
| HU-26 Reportes | RF42 | — | HU-07 |
| HU-27 Portal | RF43, RF46, RNF02, RNF04 | RN02 | HU-06 |
| HU-28 Descargar | RF44, RF45, RF46, RF05 | — | HU-27, HU-14 |
| HU-30 Alertas | RF48, RF49, RF50 | RN08, RN02 | HU-25 |

---

## 3. Verificación contra la plataforma en ejecución

No basta con que los documentos lo afirmen. Un guion recorre la plataforma **funcionando** y
contrasta su comportamiento contra lo que dice este catálogo:

```bash
npm --prefix backend run verificar
```

Crea datos de prueba, ejecuta 34 comprobaciones y los borra. Se niega a ejecutarse si la base de
datos no es local.

### Resultado — 3 de septiembre de 2026

**34 comprobaciones · 34 conformes · 0 no conformes**

| Ref | Qué comprueba | Resultado |
|---|---|:--:|
| RF52 | Un consultorio no lee expedientes de otro | ✅ |
| RF52 | Un consultorio no lista clientes de otro | ✅ |
| RF52 | Un consultorio no registra actuaciones en expedientes ajenos | ✅ |
| RNF02 | La contraseña `"1"` se rechaza en el servidor | ✅ |
| RNF05 | La búsqueda parcial encuentra por radicado | ✅ |
| RNF05 | La respuesta incluye paginación de 20 | ✅ |
| RF55 | Se registra una actuación | ✅ |
| RF56 | Un tipo fuera del catálogo se rechaza | ✅ |
| RF57 | La fecha no se desplaza un día | ✅ |
| RF58 | El término se vincula a su actuación | ✅ |
| RF59 | No se elimina una actuación con términos | ✅ |
| RN07 | El término tardío se reclasifica solo | ✅ |
| RN03 | El cambio de estado exige justificación | ✅ |
| RN05 | No se archiva con términos pendientes | ✅ |
| RNF03 | La bitácora es consultable por el Administrador | ✅ |
| RF05 | El inicio de sesión queda en la bitácora | ✅ |
| RNF03 | La bitácora se puede exportar | ✅ |
| RF42 | Los reportes se exportan en PDF | ✅ |

*(La tabla recoge las más representativas de las 34.)*

### Las tres últimas: de dónde venían

Las tres filas finales estuvieron en 🟥 hasta el 2 de septiembre, **declaradas como pendientes
en este mismo catálogo antes de resolverse**. Se cerraron el 3 de septiembre:

| Ref | Qué faltaba | Qué se hizo |
|---|---|---|
| RF05 | El código llevaba un `// Todo: Record audit login` sin implementar | `sesion.auditoria.js` registra entrada, doble factor, intento fallido, bloqueo y cierre. Se añadió `POST /api/auth/logout` para tener un cierre que auditar |
| RNF03 | La bitácora se veía en pantalla pero no salía del sistema | `GET /api/admin/auditoria/export` la entrega en CSV con los mismos filtros de la pantalla |
| RF42 | No había generación de PDF en ninguna parte | `GET /api/reportes/export/pdf` con `pdfkit`, sobre la misma consulta que el CSV |

> **Que las tres no conformidades coincidieran exactamente con lo que este catálogo declaraba
> como pendiente era el resultado buscado.** La documentación no marcó como terminado nada que
> no funcionara. Un fallo **no** documentado habría sido la mala noticia; llegar a 34/34 sin ese
> rastro previo no habría demostrado nada.

**Cómo comprobarlo ahora mismo:** la verificación ya no se conforma con un `200`. Para RF05
busca un registro con `accion = INICIO_SESION` e imprime su detalle; para RNF03 cuenta las filas
del CSV devuelto; para RF42 exige la firma `%PDF-` en el cuerpo de la respuesta. Un endpoint que
respondiera correctamente pero sin contenido seguiría marcando fallo.

---

## 4. Respaldo automatizado

| Comando | Qué comprueba | Resultado |
|---|---|---|
| `npm --prefix backend test` | 110 pruebas unitarias en 17 suites | ✅ |
| `npm --prefix backend run verificar` | 34 comprobaciones sobre la plataforma en ejecución | 34/34 |
| `npm --prefix backend run verificar:plataforma` | 16 comprobaciones de la administración de plataforma | 16/16 |
| `npm --prefix backend run arreglos` | 12 comprobaciones sobre defectos corregidos | 12/12 |
| `npm --prefix backend run lint` | Análisis estático del backend | 0 errores |

### Pruebas que respaldan las reglas de negocio

| Regla | Prueba |
|---|---|
| RN01 · Bitácora inmutable | `auditoria.test.js` |
| RN03, RN05 · Estados del proceso | `eliminacion_expediente.test.js` · verificación e2e |
| RN06 · Documentos | `documentos.test.js` |
| RN07 · Término tardío | `terminos_audiencias.test.js` · verificación e2e |
| RN08 · Alertas críticas | `notificaciones.test.js` |
| RF52, RNF11 · Aislamiento | `aislamiento_consultorio.test.js` · 4 comprobaciones e2e |
