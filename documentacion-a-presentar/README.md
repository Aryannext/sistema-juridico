# Documentación del SGPA — Carpeta de sustentación

**Sistema de Gestión de Procesos de Abogados**
Plataforma en producción: <https://proyectosena.online/sistema-juridico>

---

## Si busca algo concreto, empiece aquí

| Pregunta | Documento |
|---|---|
| **¿Qué problema resuelve y hasta dónde llega?** | [01 — Problema, objetivos y alcance](documentos/01-PROBLEMA-OBJETIVOS-ALCANCE.md) |
| **¿Qué reglas del derecho procesal respeta?** | [02 — Reglas de negocio](documentos/02-REGLAS-DE-NEGOCIO.md) |
| **¿Dónde dice que el sistema hace X?** | [03 — Requisitos funcionales](documentos/03-REQUISITOS-FUNCIONALES.md) |
| **¿Qué exige en seguridad, rendimiento o disponibilidad?** | [04 — Requisitos no funcionales](documentos/04-REQUISITOS-NO-FUNCIONALES.md) |
| **¿De qué requisito nace esta historia? ¿De qué otra depende?** | [05 — Historias de usuario](documentos/05-HISTORIAS-DE-USUARIO.md) |
| **¿Dónde está implementado esto? ¿Qué prueba lo respalda?** | [06 — Trazabilidad](documentos/06-TRAZABILIDAD.md) |
| **¿Cómo está construido?** | [07 — Arquitectura](documentos/07-ARQUITECTURA.md) |
| **¿Cómo se guardan los datos?** | [08 — Modelo de datos](documentos/08-MODELO-DE-DATOS.md) |
| **Los diagramas** | [carpeta `diagramas/`](diagramas/) |

---

## Cómo está pensada esta carpeta

Cada documento es **autocontenido**. Cuando una historia de usuario dice que nace del RF14, el
texto del RF14 **está ahí mismo**, no en otro archivo. La razón es práctica: quien evalúa no
debería tener que abrir tres pestañas para comprobar una afirmación.

Eso implica que hay texto repetido a propósito. Es una decisión, no un descuido.

### Orden de lectura

El recorrido sigue la lógica de por qué existe cada cosa:

```
problema  →  reglas del dominio  →  qué debe hacer el sistema  →  cómo lo vive el usuario
   01              02                    03 y 04                         05
```

**Las reglas de negocio van antes que los requisitos** a propósito. Existen aunque no se
construya el software: vienen del Código General del Proceso y de cómo trabaja un despacho. Los
requisitos son la **respuesta del sistema** a esas reglas, no al revés.

---

## Los diagramas

| # | Diagrama | Qué responde |
|---|---|---|
| [01](diagramas/01-idea-de-negocio.md) | Idea de negocio | Quién paga, quién usa y qué se intercambia |
| [02](diagramas/02-arbol-del-problema.md) | Árbol del problema | Causas y efectos del problema real |
| [03](diagramas/03-descomposicion-funcional.md) | Descomposición funcional | Del problema a las funciones, nivel a nivel, hasta el RF |
| [04](diagramas/04-casos-de-uso.md) | Casos de uso | Qué puede hacer cada actor |
| [05](diagramas/05-flujos-principales.md) | Flujo | Los recorridos completos, paso a paso |
| [06](diagramas/06-entidad-relacion.md) | Entidad–relación | Las tablas reales y sus vínculos |
| [07](diagramas/07-clases.md) | Clases | Las entidades del dominio y su comportamiento |
| [08](diagramas/08-componentes.md) | Componentes | Las piezas del sistema y quién habla con quién |
| [09](diagramas/09-actividades.md) | Actividades | Los procesos con decisiones y bifurcaciones |
| [10](diagramas/10-arquitectura-y-despliegue.md) | Arquitectura y despliegue | Cómo corre en el servidor |

Todos están escritos en **Mermaid dentro de Markdown**: se ven renderizados en GitHub, se
versionan con el código y no dependen de ninguna herramienta externa. Si un diagrama cambia,
cambia en el mismo *commit* que el código.

---

## Relación con la carpeta `docs/`

Esta carpeta **no sustituye** a [`docs/`](../docs/), la documentación técnica de trabajo. La
relación es deliberada:

| | `documentacion-a-presentar/` | `docs/` |
|---|---|---|
| Para quién | Quien evalúa o recibe el sistema | Quien lo desarrolla y lo mantiene |
| Contiene | Requisitos, historias, diagramas | Además: auditorías, ADR, planes de remediación, registro histórico |
| Numeración | **La misma.** RF01 es RF01 en las dos | |

> **La numeración no puede divergir, y no se confía en la memoria para ello.** Un guion lo
> comprueba:
>
> ```bash
> npm --prefix backend run verificar:docs
> ```
>
> Falla si un RF, un RNF, una RN o una HU existe en una carpeta y no en la otra. Este proyecto
> nació precisamente de tener documentación que no correspondía al sistema; mantener dos
> catálogos sin comprobación sería repetir el error.

---

## Cómo comprobar que esto es cierto

Toda la documentación afirma cosas sobre un sistema que está funcionando. Se puede verificar:

```bash
npm --prefix backend test          # 110 pruebas automatizadas
npm --prefix backend run verificar # 34 comprobaciones contra la plataforma en ejecución
npm --prefix backend run verificar:docs
```

La segunda es la relevante aquí: **contrasta el comportamiento real de la plataforma contra lo
que afirman estos documentos**. Su resultado actual —34 conformes, 0 no conformes— está
detallado en [06 — Trazabilidad](documentos/06-TRAZABILIDAD.md), junto con las tres brechas que
este mismo catálogo declaró como pendientes antes de cerrarlas.
