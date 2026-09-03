# 03 — Descomposición funcional

**Qué responde:** cómo se pasa del problema a las funciones concretas, bajando nivel a nivel
hasta llegar al requisito que las implementa.

Se lee de arriba abajo. Cada nivel **descompone** el anterior; no añade nada nuevo.

---

## Nivel 0 · El sistema en su contexto

Qué entra, qué sale y con qué se relaciona.

```mermaid
graph LR
    A1["Abogado"] -->|"registra actuaciones,<br/>plazos y documentos"| S
    A2["Colaborador"] -->|"apoya la gestión"| S
    A3["Administrador"] -->|"configura usuarios<br/>y permisos"| S

    S(["SGPA<br/>Sistema de Gestión de<br/>Procesos de Abogados"])

    S -->|"alertas de vencimiento"| A1
    S -->|"estado del caso"| A4["Cliente"]
    S -->|"correo"| EXT1["Servicio de correo"]
    S -->|"archivos"| EXT2["Almacenamiento<br/>de documentos"]

    classDef sistema fill:#DFB971,stroke:#000,color:#000,font-weight:bold
    class S sistema
```

**Qué entra:** actuaciones del juzgado, plazos, documentos, datos de clientes y expedientes.
**Qué sale:** alertas antes del vencimiento, estado del caso para el cliente, rastro auditable.

---

## Nivel 1 · Las seis funciones principales

El problema del despacho, descompuesto en lo que el sistema tiene que **saber hacer**.

```mermaid
graph TD
    S(["SGPA"])

    S --> F1["F1 · Controlar<br/>quién entra y qué puede hacer"]
    S --> F2["F2 · Gestionar el<br/>expediente digital"]
    S --> F3["F3 · Vigilar plazos<br/>y audiencias"]
    S --> F4["F4 · Administrar<br/>documentos"]
    S --> F5["F5 · Avisar<br/>a tiempo"]
    S --> F6["F6 · Dar cuenta<br/>de lo ocurrido"]

    classDef sistema fill:#DFB971,stroke:#000,color:#000,font-weight:bold
    classDef funcion fill:#2a2a2a,stroke:#DFB971,color:#fff
    class S sistema
    class F1,F2,F3,F4,F5,F6 funcion
```

| Función | Ataca la causa | Objetivo específico |
|---|---|---|
| **F1** Controlar el acceso | Nadie sabe quién hizo qué | OE-5 |
| **F2** Gestionar el expediente | Información repartida | OE-1 |
| **F3** Vigilar plazos | Fechas en la memoria | OE-2, OE-3 |
| **F4** Administrar documentos | Sin copia ni orden | OE-4 |
| **F5** Avisar a tiempo | **Nada avisa antes del vencimiento** | OE-2 |
| **F6** Dar cuenta | Sin registro de cambios | OE-6, OE-7 |

> **F5 es el corazón del sistema.** Las otras cinco existen para que F5 sea posible: no se puede
> avisar de un plazo que no está registrado, en un expediente que no existe, a un usuario que no
> tiene sesión.

---

## Nivel 2 · Desglose hasta el requisito

Cada función abierta en las capacidades concretas que la componen, con el número de requisito que
la implementa.

### F1 · Controlar quién entra y qué puede hacer

```mermaid
graph LR
    F1["F1 · Control<br/>de acceso"]
    F1 --> F11["F1.1 · Registrar<br/>un consultorio"]
    F1 --> F12["F1.2 · Autenticar<br/>usuarios"]
    F1 --> F13["F1.3 · Asignar roles<br/>y permisos"]
    F1 --> F14["F1.4 · Aislar cada<br/>consultorio"]

    F11 --> R11["RF51 · RF54"]
    F12 --> R12["RF01 · RNF02"]
    F13 --> R13["RF02 · RF03 · RF04"]
    F14 --> R14["RF52 · RNF11"]

    classDef req fill:#1a2a1a,stroke:#4a8a4a,color:#fff
    class R11,R12,R13,R14 req
```

### F2 · Gestionar el expediente digital

```mermaid
graph LR
    F2["F2 · Expediente<br/>digital"]
    F2 --> F21["F2.1 · Registrar<br/>clientes"]
    F2 --> F22["F2.2 · Crear y editar<br/>el expediente"]
    F2 --> F23["F2.3 · Registrar<br/>partes procesales"]
    F2 --> F24["F2.4 · Registrar<br/>actuaciones"]
    F2 --> F25["F2.5 · Controlar<br/>el estado del proceso"]
    F2 --> F26["F2.6 · Asignar<br/>el equipo"]

    F21 --> R21["RF06 · RF07 · RF08"]
    F22 --> R22["RF09 · RF10 · RF11"]
    F23 --> R23["RF15 · RF16 · RF17"]
    F24 --> R24["RF55 · RF56 · RF57"]
    F25 --> R25["RF13 · RN03 · RN05"]
    F26 --> R26["RF12 · RN04"]

    classDef req fill:#1a2a1a,stroke:#4a8a4a,color:#fff
    class R21,R22,R23,R24,R25,R26 req
```

### F3 · Vigilar plazos y audiencias

```mermaid
graph LR
    F3["F3 · Vigilar<br/>plazos"]
    F3 --> F31["F3.1 · Registrar<br/>un término"]
    F3 --> F32["F3.2 · Vincularlo a la<br/>actuación que lo originó"]
    F3 --> F33["F3.3 · Gestionar<br/>su cumplimiento"]
    F3 --> F34["F3.4 · Agendar<br/>audiencias"]
    F3 --> F35["F3.5 · Reprogramar<br/>y archivar"]

    F31 --> R31["RF32 · RF34"]
    F32 --> R32["RF58"]
    F33 --> R33["RF35 · RN07"]
    F34 --> R34["RF27"]
    F35 --> R35["RF30 · RF31"]

    classDef req fill:#1a2a1a,stroke:#4a8a4a,color:#fff
    class R31,R32,R33,R34,R35 req
```

### F4 · Administrar documentos

```mermaid
graph LR
    F4["F4 · Documentos"]
    F4 --> F41["F4.1 · Cargar<br/>archivos"]
    F4 --> F42["F4.2 · Clasificar<br/>por categoría"]
    F4 --> F43["F4.3 · Versionar"]
    F4 --> F44["F4.4 · Controlar<br/>quién los ve"]
    F4 --> F45["F4.5 · Eliminar<br/>con control"]

    F41 --> R41["RF18 · RF20 · RF21"]
    F42 --> R42["RF19"]
    F43 --> R43["RF23 · RN06"]
    F44 --> R44["RF22 · RF44 · RF46"]
    F45 --> R45["RF25 · RF26 · RNF06"]

    classDef req fill:#1a2a1a,stroke:#4a8a4a,color:#fff
    class R41,R42,R43,R44,R45 req
```

### F5 · Avisar a tiempo

```mermaid
graph LR
    F5["F5 · Alertas"]
    F5 --> F51["F5.1 · Configurar<br/>recordatorios"]
    F5 --> F52["F5.2 · Resolver<br/>destinatarios"]
    F5 --> F53["F5.3 · Enviar por el<br/>canal elegido"]
    F5 --> F54["F5.4 · Agrupar<br/>si son muchas"]
    F5 --> F55["F5.5 · Exigir gestión<br/>de las críticas"]
    F5 --> F56["F5.6 · Priorizar<br/>en el panel"]

    F51 --> R51["RF28 · RF33 · RF37"]
    F52 --> R52["RF29 · RF37"]
    F53 --> R53["RF47 · RF48"]
    F54 --> R54["RF47"]
    F55 --> R55["RF49 · RN08"]
    F56 --> R56["RF38 · RF39 · RF40 · RN09"]

    classDef req fill:#1a2a1a,stroke:#4a8a4a,color:#fff
    class R51,R52,R53,R54,R55,R56 req
```

### F6 · Dar cuenta de lo ocurrido

```mermaid
graph LR
    F6["F6 · Rendición<br/>de cuentas"]
    F6 --> F61["F6.1 · Registrar cada<br/>acción en bitácora"]
    F6 --> F62["F6.2 · Historial<br/>por expediente"]
    F6 --> F63["F6.3 · Estadísticas<br/>y exportación"]
    F6 --> F64["F6.4 · Portal<br/>del cliente"]

    F61 --> R61["RF05 · RNF03 · RN01"]
    F62 --> R62["RF14"]
    F63 --> R63["RF42"]
    F64 --> R64["RF43 · RF45 · RF46"]

    classDef req fill:#1a2a1a,stroke:#4a8a4a,color:#fff
    class R61,R62,R63,R64 req
```

---

## La cadena completa, de un vistazo

Este es el recorrido que el diagrama permite responder sin abrir otro documento:

| | |
|---|---|
| **Problema** | Los plazos se vencen porque nada avisa |
| ↓ **Función (N1)** | F5 · Avisar a tiempo |
| ↓ **Capacidad (N2)** | F5.1 · Configurar recordatorios |
| ↓ **Requisito** | RF33 — Valores por defecto: 5 días, 1 día y el día del vencimiento |
| ↓ **Historia** | HU-22 · Recordatorios de término |
| ↓ **Código** | `terminos.controller.js` · `recordatorios.job.js` |
| ↓ **Prueba** | `terminos_audiencias.test.js` |

**Seis niveles, del problema al archivo.** Es la cadena que sostiene todo el sistema documental:
si en cualquier eslabón no hubiera respuesta, el requisito estaría de adorno.

---

## Cobertura

Se cuentan los **requisitos que este mismo diagrama asocia a cada función** —los RF y RNF de las
cajas verdes de arriba—, con el estado que declaran los documentos 03 y 04. Las reglas de negocio
tienen su propio cuadro en el [documento 02](../documentos/02-REGLAS-DE-NEGOCIO.md). Contarlo así
lo hace reproducible: sale del diagrama, no de una lista aparte que pueda desviarse.

| Función | Requisitos | Cumplidos | Qué queda |
|---|---:|---:|---|
| F1 · Control de acceso | 9 | 7 | RF52 y RNF11 *(aislamiento por base de datos)* |
| F2 · Expediente digital | 14 | 14 | — |
| F3 · Plazos y audiencias | 7 | 7 | — |
| F4 · Documentos | 11 | 11 | — |
| F5 · Alertas | 10 | 10 | — |
| F6 · Rendición de cuentas | 7 | 6 | RNF03 *(retención a cinco años)* |

> **F6 fue durante mucho tiempo la menos completa**, y era coherente con lo que declaraban los
> requisitos: faltaban exportar la bitácora, exportar reportes en PDF y registrar el inicio de
> sesión. Las tres no conformidades de la verificación automática caían justo ahí, lo cual dice
> algo sobre la naturaleza del hueco: **el sistema hacía bien su trabajo, pero no sabía
> contarlo.** Rendición de cuentas es la función que no se nota mientras nadie pregunta, y por eso
> fue la última en completarse. Los tres puntos se cerraron el 3 de septiembre de 2026; solo sigue
> abierto **RNF03.5**, la retención a cinco años, que depende de tener copias de seguridad
> automáticas y no de escribir código.
>
> **La menos completa es ahora F1 · Control de acceso, 7 de 9**, y sus dos pendientes son en
> realidad **una sola decisión**: RF52 y RNF11 piden lo mismo desde dos sitios, que el aislamiento
> entre consultorios lo sostenga además la base de datos y no solo el código. Se evaluó y se
> pospuso en [ADR-003](../../docs/11-DECISIONES-ARQUITECTONICAS.md).
>
> El tercer pendiente que tenía esta función, el limitador de peticiones en `/api/auth/login`
> (RNF02.8), se cerró el 3 de septiembre de 2026.
>
> **Esta tabla decía otra cosa hasta el 3 de septiembre de 2026**, y merece anotarse porque el
> error era de los que no se ven. Daba F5 como la más incompleta, 6 de 8, «por el umbral de
> inactividad fijo en 30 días en vez de configurable». Ese umbral **no era una brecha**: RF40 fija
> los 30 días de forma literal, así que hacerlo configurable sería una mejora y nunca fue un
> criterio. La tabla llevaba contabilizada como incumplimiento una exigencia que ningún requisito
> hace.
