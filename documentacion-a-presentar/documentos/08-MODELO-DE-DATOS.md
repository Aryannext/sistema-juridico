# 08 — Modelo de datos

**19 entidades y 17 enumeraciones**, derivadas del esquema real
(`backend/prisma/schema.prisma`), no de un diseño previo.

> El diagrama entidad–relación completo está en
> [`diagramas/06-entidad-relacion.md`](../diagramas/06-entidad-relacion.md).

---

## 1. Las entidades, por qué existe cada una

### Consultorio y personas

| Entidad | Qué guarda | Detalle que importa |
|---|---|---|
| **Tenant** | El consultorio o abogado independiente | `activo` **corta el acceso de todos sus usuarios de golpe**. Es la palanca para suspender por impago |
| **Usuario** | Quien entra al sistema | `email` y `nombre_usuario` son únicos en **todo** el sistema, no por consultorio. El segundo es opcional y es la credencial alternativa de RF01.2 *(ver más abajo)* |
| **PermisoRol** | Permisos de un usuario sobre un módulo | Cuatro banderas: leer, crear, editar, eliminar |
| **Cliente** | La persona o empresa representada | `numero_documento` único **por consultorio** |

### El expediente y su contenido

| Entidad | Qué guarda | Detalle que importa |
|---|---|---|
| **Proceso** | El expediente judicial | `numero_radicado` único **por consultorio** |
| **ProcesoAbogado** | El equipo asignado | Clave compuesta: nadie se asigna dos veces |
| **ParteProcesal** | Demandante, demandado, terceros | Un expediente puede existir sin partes completas (RF16) |
| **Actuacion** | Los actos ocurridos en el juzgado | Distingue `fecha_actuacion` de `fecha_registro` |
| **Documento** | Archivo del expediente | `id_proceso` es **opcional**: hay documentos generales (RF21) |
| **VersionDocumento** | Cada versión subida | El documento apunta a su versión activa |

### Plazos y avisos

| Entidad | Qué guarda | Detalle que importa |
|---|---|---|
| **Audiencia** | Diligencia programada | |
| **RecordatorioAudiencia** | Aviso previo | Relativo: `minutos_antes`. Reprogramar recalcula solo |
| **TerminoJudicial** | El plazo perentorio | `id_actuacion` **opcional**: el término puede nacer de una actuación |
| **RecordatorioTermino** | Aviso previo | Absoluto: `fecha_hora_envio` |
| **Notificacion** | La alerta que ve el usuario | `leida` y `gestionada` son distintas: ver no es atender |

### Rastro

| Entidad | Qué guarda | Detalle que importa |
|---|---|---|
| **BitacoraAuditoria** | Quién hizo qué, cuándo y desde dónde | **Solo se escribe.** No hay `update` ni `delete` (RN01) |
| **HistorialProceso** | Cambios sobre un expediente | Guarda valor anterior y nuevo |

### Administración de la plataforma

| Entidad | Qué guarda | Detalle que importa |
|---|---|---|
| **AdminPlataforma** | Quien opera el servicio | **Sin `tenant_id`**: no pertenece a ningún consultorio |
| **BitacoraPlataforma** | Altas, suspensiones y bajas | Guarda el **nombre** del consultorio como texto, no como clave foránea |

> **Por qué `BitacoraPlataforma` va aparte.** La bitácora de un consultorio se borra con él. Si el
> registro de «quién eliminó este consultorio» viviera ahí, desaparecería junto con lo que
> documenta. Por eso es otra tabla y guarda el nombre como texto: tiene que seguir teniendo
> sentido cuando la fila del consultorio ya no exista.

---

## 2. La asimetría de las claves únicas

Es la decisión de modelado que más se pregunta.

| Campo | Alcance | Por qué |
|---|---|---|
| `Usuario.email` | **Global** | Es la credencial de acceso y **el formulario no tiene selector de consultorio**. Si dos consultorios registraran el mismo correo, el sistema no sabría a qué cuenta autenticar |
| `Usuario.nombre_usuario` | **Global** | La credencial alternativa de RF01.2, por la misma razón exacta. Es opcional: nulo significa «esta cuenta solo entra por correo». No admite arroba, y eso es lo que permite al login saber por cuál de las dos columnas buscar sin preguntar |
| `Cliente.numero_documento` | **Por consultorio** | Una misma persona puede ser cliente de dos despachos distintos |
| `Proceso.numero_radicado` | **Por consultorio** | En un mismo proceso judicial, **la contraparte litiga con el mismo radicado** desde otro despacho |

Los dos últimos eran globales hasta el 2 de septiembre de 2026, lo que **impedía usos legítimos**
y, además, filtraba información: el mensaje *«ese radicado ya existe en el sistema»* revelaba que
otro consultorio llevaba ese caso.

---

## 3. Cómo se ve el aislamiento en el modelo

Todas las tablas de negocio llevan `tenant_id`. En el esquema son 11 relaciones que cuelgan del
consultorio:

```
Tenant ──┬── Usuario
         ├── Cliente
         ├── Proceso
         ├── ParteProcesal
         ├── Actuacion
         ├── Documento
         ├── Audiencia
         ├── TerminoJudicial
         ├── Notificacion
         ├── BitacoraAuditoria
         └── HistorialProceso
```

**El aislamiento no lo garantiza la base de datos**: la columna existe, pero nada impide una
consulta que la olvide. Lo garantiza el código, y por eso es lo que más se prueba.

---

## 4. Integridad referencial

**Ninguna clave foránea tiene borrado en cascada automático.** Todas son `ON DELETE RESTRICT`.

Es deliberado: en un sistema jurídico, un borrado que arrastra registros en silencio es
peligroso. El borrado de un expediente se hace **explícitamente, en una transacción**, en el
orden correcto de las hojas hacia la raíz.

> Esa decisión tuvo un coste real: al añadir la entidad `Actuacion` se olvidó incluirla en esa
> transacción, y eliminar un expediente con actuaciones empezó a fallar con un error opaco. Hoy
> hay una prueba que vigila que la cascada las contemple.

---

## 5. Las dos fechas de una actuación

Parece un detalle y no lo es:

| Campo | Qué significa |
|---|---|
| `fecha_actuacion` | Cuándo **ocurrió** en el juzgado |
| `fecha_registro` | Cuándo se **digitó** en el sistema |

Un auto puede notificarse el lunes y registrarse el jueves. Para calcular plazos importa la
primera; para auditar quién y cuándo lo capturó, la segunda.

`fecha_actuacion` es de tipo **fecha sin hora**. Eso obliga a mostrarla en UTC: convertida a la
zona horaria local, la medianoche se desplaza al día anterior. **En términos judiciales, un día
de diferencia puede ser el plazo entero.**

---

## 6. Estados y sus transiciones

| Enumeración | Valores | Regla |
|---|---|---|
| `EstadoProceso` | Activo, suspendido, archivado, finalizado | No se archiva con pendientes (RN05); no se reabre sin Administrador (RN03) |
| `EstadoTermino` | Pendiente, cumplido, cumplido tardío, incumplido | El tardío se asigna **solo** (RN07) |
| `EstadoDocumento` | Activo, reemplazado, inactivo | Los dos últimos **no vuelven** a activo (RN06) |
| `EstadoAudiencia` | Programada, realizada, cancelada, reprogramada | Las pasadas se archivan solas (RF31) |
| `TipoActuacion` | Diez valores del catálogo cerrado | Cerrado por RF56 |

---

## 7. Limitaciones declaradas

| Limitación | Consecuencia |
|---|---|
| Solo **2 índices** en toda la base | Las búsquedas recorren la tabla entera. Hoy responden en 5–17 ms; no está garantizado al crecer (RNF05.5) |
| Sin *Row Level Security* | El aislamiento depende del código, no del motor |
| Sin respaldos automáticos | **El mayor riesgo operativo** (RNF10.3) |
| `RecordatorioTermino` no guarda el historial de estados | Solo conserva el último (RF36.2) |
