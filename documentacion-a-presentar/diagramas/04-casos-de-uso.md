# 04 — Casos de uso

**Qué responde:** qué puede hacer cada actor y qué casos comparten entre sí.

---

## Actores

| Actor | Quién es |
|---|---|
| **Administrador** | Titular del consultorio o abogado independiente |
| **Abogado** | Profesional que lleva casos |
| **Colaborador** | Personal de apoyo, con permisos limitados |
| **Cliente** | Persona o empresa representada |
| **Sistema** | Actor no humano: el cron que dispara las alertas |
| **Administrador de plataforma** | Opera el servicio. **Fuera del consultorio** |

---

## Casos de uso del despacho

```mermaid
graph LR
    ADM(["Administrador"])
    ABO(["Abogado"])
    COL(["Colaborador"])

    subgraph SISTEMA["SGPA"]
        CU01["Iniciar sesión"]
        CU02["Gestionar usuarios<br/>y permisos"]
        CU03["Consultar bitácora"]
        CU04["Configurar el<br/>consultorio"]
        CU05["Registrar cliente"]
        CU06["Crear expediente"]
        CU07["Asignar equipo<br/>al expediente"]
        CU08["Cambiar estado<br/>del proceso"]
        CU09["Registrar<br/>actuación"]
        CU10["Registrar partes<br/>procesales"]
        CU11["Cargar documento"]
        CU12["Definir visibilidad<br/>del documento"]
        CU13["Agendar audiencia"]
        CU14["Registrar término"]
        CU15["Gestionar término"]
        CU16["Consultar panel<br/>y alertas"]
        CU17["Buscar expedientes"]
        CU18["Exportar reportes"]
        CU19["Eliminar expediente<br/>definitivamente"]
        CU20["Habilitar portal<br/>al cliente"]
    end

    ADM --> CU02 & CU03 & CU04 & CU18 & CU19
    ADM --> CU01

    ABO --> CU01 & CU05 & CU06 & CU07 & CU08 & CU09
    ABO --> CU10 & CU11 & CU12 & CU13 & CU14 & CU15
    ABO --> CU16 & CU17 & CU20

    COL --> CU01 & CU05 & CU09 & CU10 & CU11 & CU13
    COL --> CU16 & CU17

    classDef admin fill:#3a2a1a,stroke:#DFB971,color:#fff
    class CU02,CU03,CU04,CU18,CU19 admin
```

Los casos resaltados son **exclusivos del Administrador**.

---

## Casos de uso del cliente y del sistema

```mermaid
graph LR
    CLI(["Cliente"])
    SIS(["Sistema<br/>cron"])
    PLA(["Administrador<br/>de plataforma"])

    subgraph PORTAL["Portal del cliente"]
        CU21["Consultar sus procesos"]
        CU22["Ver audiencias<br/>autorizadas"]
        CU23["Descargar documentos<br/>habilitados"]
    end

    subgraph AUTO["Automático"]
        CU24["Enviar recordatorios<br/>cada 15 minutos"]
        CU25["Archivar audiencias<br/>ya celebradas"]
        CU26["Reclasificar término<br/>cumplido tardíamente"]
    end

    subgraph PLAT["Administración de plataforma"]
        CU27["Dar de alta<br/>un consultorio"]
        CU28["Suspender consultorio"]
        CU29["Dar de baja<br/>definitivamente"]
    end

    CLI --> CU21 & CU22 & CU23
    SIS --> CU24 & CU25 & CU26
    PLA --> CU27 & CU28 & CU29

    classDef aislado fill:#1a1a2a,stroke:#6a6acc,color:#fff
    class CU27,CU28,CU29 aislado
```

> **Los tres casos en azul están fuera del sistema del consultorio.** El administrador de
> plataforma no aparece en el primer diagrama porque **no puede ejecutar ninguno de aquellos
> casos**: su token es de otro tipo y el middleware de consultorios lo rechaza. No es una
> restricción de pantalla, es de sesión ([ADR-012](../../docs/11-DECISIONES-ARQUITECTONICAS.md)).

---

## Casos que dependen de otros

Algunos casos de uso **no se pueden ejecutar aislados**. Esto es lo mismo que el grafo de
dependencias entre historias, visto desde el actor:

```mermaid
graph LR
    CU01["Iniciar sesión"] --> CU05["Registrar cliente"]
    CU05 --> CU06["Crear expediente"]
    CU06 --> CU09["Registrar actuación"]
    CU06 --> CU11["Cargar documento"]
    CU06 --> CU13["Agendar audiencia"]
    CU06 --> CU14["Registrar término"]
    CU09 -.opcional.-> CU14
    CU14 --> CU15["Gestionar término"]
    CU14 --> CU24["Enviar recordatorio"]
    CU13 --> CU24
    CU11 --> CU12["Definir visibilidad"]
    CU12 --> CU23["Cliente descarga"]
    CU20["Habilitar portal"] --> CU23
```

**Se lee así:** para que un cliente pueda descargar un documento (CU23) hacen falta antes cuatro
cosas: iniciar sesión, crear el expediente, cargar el documento, marcarlo como compartido y
habilitarle el portal.

---

## Detalle de los tres casos con más reglas

### CU08 · Cambiar el estado del proceso

| | |
|---|---|
| **Actor** | Abogado, Administrador |
| **Precondición** | El expediente existe y el actor tiene permiso de edición |
| **Flujo principal** | 1. Elige el estado nuevo · 2. Escribe la justificación · 3. Confirma · 4. El sistema valida y registra en el historial |
| **Flujo alterno A** | Si archiva y hay términos pendientes o audiencias en 30 días → el sistema **enumera qué lo impide** y no procede (RN05) |
| **Flujo alterno B** | Si es Administrador, puede repetir con confirmación explícita y forzarlo |
| **Flujo alterno C** | Si el proceso está cerrado y quiere reactivarlo sin ser Administrador → 403 (RN03) |
| **Postcondición** | Estado cambiado, justificación en el historial, acción en la bitácora |

### CU15 · Gestionar un término judicial

| | |
|---|---|
| **Actor** | Abogado |
| **Precondición** | El término existe y está pendiente |
| **Flujo principal** | 1. Elige cumplido, cumplido tardío o incumplido · 2. Escribe la justificación · 3. Confirma |
| **Flujo alterno** | Si marca **cumplido** y la fecha de vencimiento ya pasó → el sistema lo reclasifica **solo** como *cumplido tardío* (RN07) |
| **Excepción** | Sin justificación → 400 |
| **Postcondición** | Estado registrado, alertas asociadas cerradas |

> El flujo alterno de CU15 es la regla con más peso jurídico del sistema: un término es
> **perentorio**, y cumplirlo tarde no es cumplirlo.

### CU19 · Eliminar un expediente definitivamente

| | |
|---|---|
| **Actor** | Administrador **únicamente** |
| **Precondición** | Sin documentos activos ni términos pendientes |
| **Flujo principal** | 1. Escribe la justificación · 2. Confirma en dos pasos · 3. El sistema borra en cascada dentro de una transacción |
| **Excepción A** | Si el actor no es Administrador → 403 |
| **Excepción B** | Si hay pendientes → 400 con el recuento |
| **Postcondición** | Expediente y todo lo asociado eliminados; la acción queda en la bitácora, **que sobrevive** |
