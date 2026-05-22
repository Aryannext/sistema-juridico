# Reporte de Coherencia de Documentación — Proyecto SGPA

Este documento presenta un análisis detallado de la coherencia entre las especificaciones de requerimientos (`sistema.docx`), las historias de usuario (`Historias_de_Usuario_Sistema_Juridico.docx`) y los diagramas de arquitectura, roles y flujos (`Diagramas.xml`), con el fin de asegurar que la información sea consistente antes de realizar la carga en Jira.

---

## 1. Contradicciones Directas e Inconsistencias Críticas

### 🔴 Contradicción en la Gestión de Alertas Críticas (Administrador)
*   **Regla de Negocio (`RN02`):** Establece de forma explícita que el Administrador **NO puede** marcar como gestionada una alerta crítica que no le fue asignada directamente, a menos que el abogado destinatario esté inactivo en el sistema.
*   **Historias de Usuario (`HU-23` y `HU-30`):** Los criterios de aceptación de ambas HU indican que una alerta crítica/término judicial crítico *"solo puede ser cerrada por el usuario destinatario de la alerta o por el Administrador, de forma manual y explícita"*.
*   **Impacto:** Hay una contradicción directa. Las historias de usuario permiten que el Administrador cierre cualquier alerta de forma general, rompiendo la restricción de seguridad/auditoría definida en la regla de negocio `RN02`.

### 🟡 Discrepancia en la Nomenclatura de Roles (Colaborador vs. Asistente)
*   **Requerimientos y Historias de Usuario:** Definen los cuatro roles principales como: *Administrador*, *Abogado*, *Colaborador* y *Cliente*.
*   **Diagramas de Flujo (`Diagramas.xml`):** En los diagramas de *"Flujo autenticación"* y *"Flujo documental"*, el rol se denomina **ASISTENTE** en lugar de **Colaborador** (ej. *"¿quién intentó acceder al documento? -> ASISTENTE"*, *"Visibilidad = visible asistente?"*).
*   **Impacto:** Esto puede causar confusión al momento de diseñar el esquema de la base de datos (tablas de roles/usuarios) y al programar los controles de acceso en el backend.

### 🟡 Contradicción en Tiempos de Alertas de Audiencia Predeterminados
*   **Requerimiento `RF28`:** Indica que los valores predeterminados sugeridos al crear una audiencia son **48 horas antes, 24 horas antes y el mismo día** de la audiencia.
*   **Requerimiento `RF29`:** Indica que el valor predeterminado es **24 horas antes, con recordatorio a 1 hora**.
*   **Impacto:** Confusión sobre cuáles son los valores de fábrica exactos que debe implementar el sistema de alertas para audiencias. (Nota: `HU-18` adopta los valores de `RF28`).

---

## 2. Gaps y Vacíos Funcionales (Historias de Usuario Faltantes)

### 🔍 Falta Historia de Usuario para Búsquedas y Filtros (`RNF05`)
*   **Requerimiento (`RNF05`):** Detalla exhaustivamente que el sistema debe permitir realizar búsquedas de expedientes por radicado, nombre de cliente, juzgado, abogado, estado procesal y tipo de proceso, soportando texto parcial y combinación de filtros con paginación de 20 registros.
*   **Historias de Usuario:** No existe ninguna historia de usuario en el backlog que describa la funcionalidad de **Búsqueda y Filtrado de Procesos** (solo la consulta de ficha de cliente individual en `HU-06`).
*   **Impacto:** Si se sube el backlog actual, el equipo de desarrollo omitirá la interfaz y la lógica de búsqueda general de expedientes, una funcionalidad elemental para el uso diario de los abogados.

### 🔐 Falta Historia de Usuario para Doble Factor de Autenticación (2FA)
*   **Requerimiento (`RNF02`) y Diagrama de Flujo de Autenticación:** Ambos describen que si el usuario tiene habilitado el 2FA, se le enviará un código de verificación con validez de 5 minutos y de un solo uso.
*   **Historias de Usuario:** La `HU-01` (Inicio de sesión) no menciona el flujo de 2FA, y no existe ninguna otra HU para que el usuario configure o habilite el 2FA en su perfil.
*   **Impacto:** El backend y el frontend se desarrollarán sin considerar la pantalla de ingreso de código 2FA ni la integración con el servicio de envío de códigos (email/SMS).

### 📝 Falta Historia de Usuario para Editar Detalles del Expediente
*   **Requerimiento (`RF11`):** Define los campos obligatorios y opcionales al crear un proceso (juzgado, tipo, clase, área, estado, fecha de radicación, abogado).
*   **Historias de Usuario:** Existe `HU-07` para *crear* el expediente, `HU-08` para asignar abogados/colaboradores, y `HU-09` para cambiar el estado. Sin embargo, **no hay una HU que permita editar** los otros datos básicos del proceso (como el juzgado, la clase de proceso o el área del derecho) una vez creado.
*   **Impacto:** Los abogados no podrán corregir errores de tipografía o cambios en los datos generales del proceso, a menos que eliminen y vuelvan a crear el expediente.

### 🗑️ Falta Historia de Usuario para la Eliminación de Expedientes
*   **Requerimiento (`RNF06`):** Detalla que la eliminación definitiva de información crítica (documentos, procesos, clientes) requiere rol de Administrador y confirmación en dos pasos.
*   **Historias de Usuario:** Se cubren restricciones de eliminación para documentos (`HU-16`) y clientes (`HU-06`), pero **no hay una HU que describa el proceso de eliminación definitiva de un proceso/expediente** por parte del Administrador.

---

## 3. Errores de Mapeo y Trazabilidad de Requerimientos

### 🔗 Omisión del Mapeo de `RF34`
*   **Requerimiento `RF34`:** *"El sistema debe mantener visibles los términos vencidos hasta que el abogado los gestione manualmente."*
*   **Historias de Usuario:** El criterio de aceptación está correctamente escrito dentro de la `HU-21` (Registrar término judicial), pero la sección de **"RF / RN asociados"** al final de la historia solo lista `RF32 | RF37`. Se debe agregar `RF34` a esta lista.

### 🔗 Referencia a Regla Obsoleta (`RN16` / `RN08`)
*   **Historias de Usuario:** La `HU-30` (Visualizar y gestionar alertas críticas) mapea la regla `RN08`. En el archivo de requerimientos, `RN08` indica entre paréntesis `(ajuste de RN16 original)`, pero no existe ninguna regla activa llamada `RN16`. No obstante, el backlog general de historias no hace referencia a `RN16`, por lo que la trazabilidad es correcta, salvo que existan sistemas externos que esperen esa codificación.

### 📊 Ausencia de Permisos de Auditoría en la Matriz de Roles
*   **Diagramas (`Diagramas.xml` - Matriz de roles):** El diagrama tiene filas para casi todas las acciones de los módulos, pero **no incluye una fila para "Consultar / Exportar bitácora de auditoría"**, a pesar de ser un requerimiento de seguridad de nivel Administrador clave (`RNF03`, `RN01` y `HU-03`).

---

## 4. Desequilibrio Crítico en la Planificación de Sprints

Al analizar los Story Points (estimaciones) por Sprint en el backlog propuesto, se observa una sobrecarga extrema en el Sprint 1:

| Sprint | Historias de Usuario | Story Points Totales | Estado de Carga |
| :--- | :---: | :---: | :--- |
| **Sprint 1** | 11 HUs (HU-01 a HU-11) | **53 pts** | 🚨 **Sobrecargado** |
| **Sprint 2** | 5 HUs (HU-12 a HU-16) | **23 pts** | 🟢 Balanceado |
| **Sprint 3** | 9 HUs (HU-17 a HU-23, HU-29, HU-30) | **35 pts** | 🟡 Moderado |
| **Sprint 4** | 5 HUs (HU-24 a HU-28) | **26 pts** | 🟢 Balanceado |

### Recomendación de Balanceo:
El Sprint 1 asume toda la base del sistema: autenticación, roles, auditoría, clientes, creación de expedientes, asignación de abogados, cambios de estado, historial y partes procesales. Esto es poco realista para un primer ciclo.
*   **Propuesta:** Mover la gestión de partes procesales (`HU-11` - 5 pts) y el historial de cambios del proceso (`HU-10` - 3 pts) al **Sprint 2**, incrementando este último a 31 pts y desahogando el Sprint 1 a 45 pts.

---

## 5. Recomendaciones de Acción antes de montar a Jira

> [!IMPORTANT]
> Se sugeriría realizar los siguientes ajustes en los documentos antes de proceder con la importación automatizada de Jira:
> 1. **Unificar nomenclatura de roles:** Reemplazar el término "Asistente" por "Colaborador" en todos los diagramas de flujo para mantener consistencia estricta con el código.
> 2. **Resolver la contradicción de alertas críticas:** Modificar el criterio de aceptación en `HU-23` y `HU-30` para aclarar que el Administrador solo puede cerrar alertas críticas si el abogado asignado está inactivo, alineándose con `RN02`.
> 3. **Redactar e incorporar las 4 Historias de Usuario faltantes:**
>    *   `HU-31: Buscar y filtrar procesos/expedientes` (Sprint 1 o 2 - Estimación sugerida: 5 pts - Asociado a `RNF05`).
>    *   `HU-32: Habilitar y configurar autenticación de doble factor (2FA)` (Sprint 1 - Estimación sugerida: 5 pts - Asociado a `RNF02`).
>    *   `HU-33: Modificar información general del expediente` (Sprint 1 - Estimación sugerida: 3 pts - Asociado a `RF11`).
>    *   `HU-34: Eliminar de forma definitiva expedientes (Admin)` (Sprint 2 - Estimación sugerida: 3 pts - Asociado a `RNF06`).
> 4. **Actualizar la matriz de roles en el diagrama:** Añadir la fila de "Exportar/Consultar Bitácora de Auditoría" asignada únicamente al Administrador.
