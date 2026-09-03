# Documentación del SGPA — Índice maestro

**Sistema de Gestión de Procesos de Abogados (SGPA)**
Última revisión: **1 de septiembre de 2026**

---

## Búsqueda rápida

Lo que se consulta a diario, con enlace directo:

| Si buscas… | Ve a |
|---|---|
| **Un requisito funcional (RF01–RF59)** | [03 — Catálogo de requisitos § 1](03-CATALOGO-REQUISITOS.md#1-requisitos-funcionales) |
| **Un requisito no funcional (RNF01–RNF11)** | [03 — Catálogo de requisitos § 2](03-CATALOGO-REQUISITOS.md#2-requisitos-no-funcionales) |
| **Una regla de negocio (RN01–RN09)** | [03 — Catálogo de requisitos § 3](03-CATALOGO-REQUISITOS.md#3-reglas-de-negocio) |
| **Una historia de usuario (HU-01–HU-37)** | [04 — Historias de usuario § 2](04-HISTORIAS-DE-USUARIO.md#2-catálogo-completo) |
| **Los criterios de aceptación de una HU** | [04 — Historias de usuario § 5](04-HISTORIAS-DE-USUARIO.md#5-criterios-de-aceptación-detallados) |
| **En qué archivo vive un requisito** | [05 — Matriz de trazabilidad](05-MATRIZ-TRAZABILIDAD.md) |
| **Un endpoint de la API** | [06 — API REST](06-API-REST.md) |
| **Qué significa un término jurídico** | [07 — Glosario jurídico](07-GLOSARIO-JURIDICO.md) |
| **Cómo desplegar sin romper el VPS** | [12 — Despliegue en VPS compartido](12-DESPLIEGUE-VPS-COMPARTIDO.md) |
| **Deuda técnica y calidad del código** | [13 — Calidad de código](13-CALIDAD-DE-CODIGO.md) |
| **Defectos encontrados y corregidos** | [14 — Auditoría de defectos](14-AUDITORIA-DE-DEFECTOS.md) |
| **Suspender o dar de baja un consultorio** | [15 — Administración de la plataforma](15-ADMINISTRACION-DE-PLATAFORMA.md) |
| **Que los correos no vayan a spam** | [16 — Correo y entregabilidad](16-CORREO-Y-ENTREGABILIDAD.md) |
| **Recuperar contraseña o reenviar la verificación** | [17 — Recuperación de acceso](17-RECUPERACION-DE-ACCESO.md) |

---

## Por qué existe esta carpeta reorganizada

La documentación previa del proyecto se escribió **antes** de que la plataforma tomara su forma
actual y nunca se sincronizó con el código. Los documentos describían un sistema que no era el
construido: decían "microservicios" y es un monolito modular; decían React 18 y Tailwind 3 y
corre React 19 y Tailwind 4; decían almacenamiento en Supabase y los archivos van a Cloudflare R2.

Estos documentos **no reescriben el sistema**: lo describen tal como está, en español, y dejan
por escrito qué corregir y en qué orden.

> **Principio rector:** el código y el diseño visual existentes son la fuente de verdad. Cuando
> un documento antiguo y el código no coinciden, se corrige el documento — salvo en los casos
> marcados como *defecto de implementación* en [00-AUDITORIA-DE-COHERENCIA.md](00-AUDITORIA-DE-COHERENCIA.md).

---

## Estructura de la carpeta

```
docs/
├── README.md                      ← estás aquí
├── 00 … 13                        documentación vigente
├── MANUAL_USUARIO.md              manual para el usuario final
├── fuentes/                       material de origen (no es especificación)
└── historico/                     documentos superados, se conservan como registro
```

---

## Documentación vigente

| # | Documento | Qué responde |
|---|---|---|
| 00 | [Auditoría de coherencia](00-AUDITORIA-DE-COHERENCIA.md) | ¿Qué no concuerda entre documentos y plataforma? 28 hallazgos con evidencia |
| 01 | [Arquitectura](01-ARQUITECTURA.md) | ¿Es MVC o monolito modular? Diagramas de capas, despliegue y flujos |
| 02 | [Modelo de datos](02-MODELO-DE-DATOS.md) | ERD real derivado de `schema.prisma` + diccionario de datos |
| 03 | [Catálogo de requisitos](03-CATALOGO-REQUISITOS.md) | RF01–RF59, RNF01–RNF11, RN01–RN09 con su estado de implementación |
| 04 | [Historias de usuario](04-HISTORIAS-DE-USUARIO.md) | HU-01 a HU-37 con sprint, puntos y **criterios de aceptación completos** |
| 05 | [Matriz de trazabilidad](05-MATRIZ-TRAZABILIDAD.md) | RF → HU → endpoint → archivo → prueba |
| 06 | [API REST](06-API-REST.md) | Los 55 endpoints reales, con rol y permiso exigido |
| 07 | [Glosario jurídico](07-GLOSARIO-JURIDICO.md) | Vocabulario del dominio (CGP colombiano) y su mapeo al modelo de datos |
| 08 | [Plan de españolización](08-PLAN-ESPANOLIZACION.md) | Inventario de textos en inglés y su traducción, sin tocar el diseño |
| 09 | [Compatibilidad con Node.js](09-COMPATIBILIDAD-NODE.md) | Evidencia de funcionamiento en Node 24, variables de entorno y dependencias |
| 10 | [Plan de remediación](10-PLAN-DE-REMEDIACION.md) | Qué hacer, en qué orden, con qué esfuerzo y riesgo |
| 11 | [Decisiones de arquitectura (ADR)](11-DECISIONES-ARQUITECTONICAS.md) | Las 11 decisiones estructurales, con contexto y consecuencias |
| 12 | [Despliegue en VPS compartido](12-DESPLIEGUE-VPS-COMPARTIDO.md) | Cómo actualizar Node y desplegar sin romper la aplicación del otro usuario |
| 13 | [Calidad de código](13-CALIDAD-DE-CODIGO.md) | Revisión SOLID y de código limpio, con métricas reales y un plan de refactor por pasos |
| 14 | [Auditoría de defectos](14-AUDITORIA-DE-DEFECTOS.md) | 16 defectos reproducidos contra la base de datos y corregidos; reparto de `ProcesoDetalle.jsx` |
| 15 | [Administración de la plataforma](15-ADMINISTRACION-DE-PLATAFORMA.md) | Alta, suspensión y baja de consultorios sin entrar al servidor |
| 16 | [Correo y entregabilidad](16-CORREO-Y-ENTREGABILIDAD.md) | Por qué los correos van a spam y cómo enviarlos desde el propio dominio |
| 17 | [Recuperación de acceso](17-RECUPERACION-DE-ACCESO.md) | Reenvío de verificación, recuperación de contraseña y política de contraseñas |
| — | [Manual de usuario](MANUAL_USUARIO.md) | Guía para el usuario final, sin lenguaje técnico |

---

## `fuentes/` — material de origen

No son especificación vigente. Se conservan porque de ahí salió el contenido de los documentos 00–13.

| Archivo | Naturaleza |
|---|---|
| [`sistema.docx`](fuentes/sistema.docx) | Requisitos originales RF01–RF54, RNF01–RNF11, RN01–RN08. **Especificación funcional de referencia** → consolidada en el doc 03 |
| [`HU_Sistema_Juridico_v3.docx`](fuentes/HU_Sistema_Juridico_v3.docx) | Las 36 historias de usuario con sus criterios → consolidadas en el doc 04 |
| [`investigacion.docx`](fuentes/investigacion.docx) | Investigación de dominio jurídico, benchmark y matriz de supuestos → destilada en el doc 07. **Su numeración RF01–RF09 es incompatible** con la de `sistema.docx` (hallazgo H-10) |
| [`Diagramas_v2.xml`](fuentes/Diagramas_v2.xml) | 7 diagramas draw.io → sustituidos por los diagramas Mermaid del doc 01 |
| [`diagrama_db.txt`](fuentes/diagrama_db.txt) | Modelo entidad-relación en DBML → sustituido por el doc 02 |
| [`24_propuesta.pdf`](fuentes/24_propuesta.pdf) | Propuesta institucional |

---

## `historico/` — documentos superados

Se conservan **a propósito**: sirven para demostrar la evolución del proyecto en una
sustentación. Cada uno lleva un aviso al inicio remitiendo al documento que lo reemplaza.

| Archivo | Por qué está aquí |
|---|---|
| [`arquitectura.md`](historico/arquitectura.md) | Describía "microservicios lógicos" y un `tenant.middleware.js` inexistente |
| [`especificaciones_tecnicas.md`](historico/especificaciones_tecnicas.md) | Versiones del stack desfasadas y almacenamiento en Supabase |
| [`Reporte_Coherencia_SGPA.md`](historico/Reporte_Coherencia_SGPA.md) | Analiza archivos que ya no existen y reporta como pendientes cosas resueltas |
| [`Combined_Sprint_Stories.md`](historico/Combined_Sprint_Stories.md) | Lista 34 HU; faltan HU-35 y HU-36 |
| [`Jira_Import_Stories.csv`](historico/Jira_Import_Stories.csv) | Backlog de 34 HU para importar a Jira |
| [`Jira_Sprints_Plan_v2.md`](historico/Jira_Sprints_Plan_v2.md) | Sí contiene las 36 HU, pero con la distribución de sprints sobrecargada que corrige el doc 04 |

---

## Rutas de lectura según lo que necesites

**Para sustentar el proyecto ante un jurado o instructor:**
doc 00 (qué estaba mal y cómo se resolvió) → doc 01 (arquitectura) → doc 05 (trazabilidad) → doc 11 (decisiones).

**Para programar sobre el sistema:**
doc 01 (arquitectura) → doc 02 (datos) → doc 06 (API) → doc 09 (entorno).

**Para desplegar en el VPS:**
doc 12, que resuelve el conflicto de versiones con la otra aplicación del servidor.

**Para corregir el sistema:**
doc 10, que ordena todo lo demás por prioridad.

**Si no entiendes el vocabulario jurídico:**
doc 07, antes que cualquier otro.
