# 01 — Problema, objetivos y alcance

---

## 1. El problema

En los consultorios jurídicos y despachos de abogados independientes de **Neiva**, la gestión de
los procesos sigue apoyada en **carpetas físicas y agendas manuales**.

Cada expediente vive repartido: el escrito de demanda en una carpeta, las notificaciones del
juzgado en otra, las fechas de audiencia anotadas en una agenda de papel o en el teléfono del
abogado que lleva el caso. No hay un lugar donde esté todo, ni nadie que vigile los plazos salvo
la memoria de quien los anotó.

De ahí salen tres consecuencias que no son hipotéticas:

**Audiencias que se olvidan.** La fecha estaba anotada, pero nadie la miró a tiempo. La
inasistencia a una audiencia puede acarrear sanciones y, en algunos trámites, la pérdida de la
oportunidad procesal.

**Términos que se vencen.** Un término judicial es **perentorio**: pasado el plazo, la
oportunidad se extingue y no se recupera. Contestar una demanda fuera de término no es una
demora, es perder el derecho a contestar.

**Información dispersa e irrecuperable.** Cuando el cliente pregunta cómo va su caso, hay que
buscar la carpeta. Cuando un abogado se ausenta, nadie sabe en qué estado dejó sus procesos.
Cuando algo se pierde, no hay copia.

### Por qué esto importa más que en otros sectores

Un error de gestión en un despacho no es una molestia administrativa: **puede costarle a un
tercero su derecho**. El cliente confía su asunto al abogado, y el abogado responde por él.
Un plazo vencido por descuido es una responsabilidad profesional.

> El análisis de causas y efectos está desarrollado en
> [Árbol del problema](../diagramas/02-arbol-del-problema.md).

---

## 2. Objetivos

### 2.1 Objetivo general

Desarrollar un sistema web de gestión de procesos jurídicos que **administre el expediente
digital de cada caso**, controle las fechas de audiencias y términos, gestione la documentación
asociada y **genere alertas automáticas de vencimiento** para el abogado.

### 2.2 Objetivos específicos

| # | Objetivo | Se materializa en |
|---|---|---|
| **OE-1** | Centralizar en un expediente digital único toda la información de cada proceso: partes, actuaciones, documentos, audiencias y términos | RF09–RF17, RF55–RF59 |
| **OE-2** | Vigilar los términos judiciales y avisar **antes** de que venzan, con antelación configurable y por varios canales | RF32–RF37, RF47–RF50 |
| **OE-3** | Controlar la agenda de audiencias con recordatorios automáticos y registro de reprogramaciones | RF27–RF31 |
| **OE-4** | Gestionar los documentos del expediente con categorías, control de versiones y visibilidad selectiva hacia el cliente | RF18–RF26 |
| **OE-5** | Garantizar que cada consultorio solo acceda a su propia información, con roles y permisos diferenciados | RF01–RF05, RF51–RF54, RNF11 |
| **OE-6** | Dejar registro auditable e inmutable de toda acción que modifique el expediente | RF05, RNF03 |
| **OE-7** | Ofrecer al cliente una vía autónoma de consulta del estado de su caso, sin llamar al despacho | RF43–RF46 |

Cada objetivo específico se puede recorrer hasta el código: la cadena completa
**objetivo → requisito → historia → endpoint → archivo → prueba** está en
[06 — Trazabilidad](06-TRAZABILIDAD.md).

---

## 3. Alcance

### 3.1 Qué hace el sistema

**Gestión del expediente**
Registro de clientes (persona natural y jurídica), creación de expedientes con número de
radicado, partes procesales, cronología de actuaciones, y control de estado del proceso con
reglas de cierre.

**Control de plazos**
Términos judiciales con fecha de vencimiento, marca de criticidad, recordatorios configurables y
reclasificación automática del cumplimiento tardío. Agenda de audiencias con recordatorios y
archivado automático de las ya celebradas.

**Documentación**
Carga de archivos al expediente con categorías, control de versiones, y visibilidad
**privada / compartida con el cliente**. Eliminación en dos niveles: lógica y física, esta última
con justificación obligatoria.

**Alertas**
Motor de recordatorios que se ejecuta cada 15 minutos. Notificaciones en plataforma y por correo,
con prioridad y preferencias por usuario.

**Multi-consultorio**
Cada consultorio o abogado independiente opera aislado: sus clientes, expedientes y documentos no
son visibles para ningún otro. Cuatro roles con permisos por módulo.

**Portal del cliente**
Acceso restringido donde el cliente ve el estado de sus propios procesos y descarga únicamente
los documentos que su abogado le ha habilitado.

**Administración de la plataforma**
Alta, suspensión y baja de consultorios, con identidad separada que **no da acceso a ningún
expediente**.

### 3.2 Qué NO hace, y por qué

Declararlo importa tanto como lo anterior: un alcance sin límites explícitos no se puede evaluar.

| Fuera de alcance | Razón |
|---|---|
| **Calcular los términos judiciales** | El sistema **registra y vigila** la fecha que el abogado indica; no la deduce. Calcular un término exige interpretar la norma aplicable, los días hábiles del despacho judicial y las suspensiones del proceso. Es criterio jurídico, y equivocarlo tendría consecuencias graves. Razonado en [ADR-008](../../docs/11-DECISIONES-ARQUITECTONICAS.md) |
| **Integración con la Rama Judicial** | No se consultan estados desde los sistemas oficiales. La actualización es manual |
| **Firma electrónica de documentos** | No se emiten ni validan firmas con validez legal |
| **Facturación y cobro a clientes** | El sistema gestiona procesos, no la contabilidad del despacho |
| **Aplicación móvil nativa** | La interfaz es web y adaptable, pero no hay aplicación de tienda |
| **Redacción asistida de escritos** | No se generan minutas ni plantillas de documentos procesales |

### 3.3 Usuarios del sistema

| Rol | Quién es | Qué puede hacer |
|---|---|---|
| **Administrador** | Titular del consultorio o abogado independiente | Todo dentro de su consultorio: gestionar usuarios y permisos, ver la bitácora, eliminar expedientes |
| **Abogado** | Profesional que lleva casos | Gestiona los expedientes en los que es responsable o está asignado |
| **Colaborador** | Personal de apoyo del despacho | Apoya en la gestión, con permisos limitados por módulo. *(En la base de datos figura como `ASISTENTE`; ver [ADR-004](../../docs/11-DECISIONES-ARQUITECTONICAS.md))* |
| **Cliente** | Persona o empresa representada | Consulta el estado de sus procesos y descarga los documentos habilitados |
| **Administrador de plataforma** | Quien opera el servicio | Da de alta, suspende y elimina consultorios. **No accede a expedientes de nadie** |

> El último es una identidad **separada** de las otras cuatro: no pertenece a ningún consultorio
> y su sesión es de otro tipo. Los expedientes están cubiertos por el secreto profesional entre
> abogado y cliente, y esa separación es lo que lo hace exigible por diseño y no por confianza.
> Razonado en [ADR-012](../../docs/11-DECISIONES-ARQUITECTONICAS.md).

---

## 4. Estado de la plataforma

En producción y verificable:

| | |
|---|---|
| Requisitos funcionales | 59 |
| Requisitos no funcionales | 10 |
| Reglas de negocio | 9 |
| Historias de usuario | 37 |
| Endpoints de la API | 67 en 13 módulos |
| Pruebas automatizadas | 110 |
| Verificación contra la plataforma en ejecución | **34 de 34 conformes** |

Hasta el 2 de septiembre eran **31 de 34**. Las tres que faltaban —el registro del inicio de
sesión en la bitácora (RF05), la exportación de la bitácora (RNF03) y la exportación de
reportes en PDF (RF42)— estaban **declaradas como brechas en esta misma documentación** antes
de resolverse, y se cerraron el 3 de septiembre. La secuencia queda registrada en
[06 — Trazabilidad](06-TRAZABILIDAD.md).

> Que la documentación declarara lo que **no** cumplía fue deliberado, y sigue siendo el punto
> importante: un catálogo donde todo aparece como terminado no se puede contrastar con nada.
> Llegar a 34 de 34 vale por el rastro de cómo se llegó, no por el número.
