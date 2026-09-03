# 08 — Diagrama de componentes

**Qué responde:** de qué piezas se compone el sistema y quién habla con quién.

---

## Vista general

```mermaid
graph TB
    subgraph NAV["Navegador"]
        UI["Interfaz React 19<br/>20 páginas"]
        AX["Cliente HTTP<br/>axios + interceptores"]
        UI --> AX
    end

    subgraph SRV["Servidor"]
        NG["Nginx<br/>TLS · archivos estáticos · proxy"]

        subgraph API["API Express"]
            MW["Middlewares<br/>auth · roles · auditoría · subidas"]
            MOD["13 módulos de dominio"]
            CRON["node-cron<br/>cada 15 minutos"]
        end

        ORM["Prisma ORM"]
        BD[("PostgreSQL 16")]
    end

    subgraph EXT["Servicios externos"]
        R2["Cloudflare R2<br/>archivos"]
        SMTP["SMTP<br/>correo saliente"]
    end

    AX -->|HTTPS| NG
    NG -->|estáticos| UI
    NG -->|"/api"| MW
    MW --> MOD
    MOD --> ORM
    CRON --> ORM
    ORM --> BD
    MOD --> R2
    MOD --> SMTP
    CRON --> SMTP

    classDef api fill:#2a2a2a,stroke:#DFB971,color:#fff
    class MW,MOD,CRON api
```

---

## Los 13 módulos de la API

Cada uno es una carpeta con dos archivos: sus rutas y su controlador.

| Módulo | Endpoints | De qué responde |
|---|---:|---|
| `auth` | 11 | Registro, acceso, 2FA, verificación, recuperación y cierre de sesión |
| `procesos` | 10 | Expedientes, equipo, estados, partes |
| `documentos` | 8 | Carga, versiones, visibilidad, descarga |
| `plataforma` | 6 | **Administración del servicio, aislada** |
| `admin` | 6 | Usuarios, permisos y bitácora del consultorio (con exportación) |
| `clientes` | 5 | Clientes y acceso al portal |
| `actuaciones` | 4 | Actos del juzgado |
| `audiencias` | 4 | Agenda |
| `terminos` | 4 | Plazos y su gestión |
| `reportes` | 3 | Estadísticas y exportación en CSV y PDF |
| `notificaciones` | 2 | Centro de alertas |
| `portal` | 2 | Vista restringida del cliente |
| `tenant` | 2 | Perfil del consultorio |

**67 endpoints.** Recuento reproducible:

```bash
grep -rhoE "router\.(get|post|put|patch|delete)\(" backend/src/modules/*/*.routes.js | wc -l
```

---

## La cadena de middlewares

Toda petición atraviesa lo mismo, en este orden. **El orden importa**: cada capa asume que la
anterior ya hizo su trabajo.

```mermaid
graph LR
    A["Petición"] --> B["helmet<br/>cabeceras de seguridad"]
    B --> C["cors"]
    C --> D["rateLimit<br/>1000 / 15 min"]
    D --> E["authMiddleware"]
    E --> F["rolesMiddleware"]
    F --> G["auditMiddleware"]
    G --> H["Controlador"]

    E -.->|"inyecta<br/>req.tenant_id"| E
    G -.->|"registra al<br/>terminar"| G

    classDef clave fill:#3a2a1a,stroke:#DFB971,color:#fff
    class E clave
```

**`authMiddleware` es la pieza crítica del sistema.** Además de autenticar:

1. Comprueba que el usuario esté activo.
2. Comprueba que **su consultorio** esté activo — la palanca de suspensión.
3. Rechaza los tokens de plataforma con 403.
4. **Inyecta `req.tenant_id`**, que todas las consultas usan para filtrar.

Sin el punto 4, el aislamiento entre consultorios no existiría.

---

## Los dos mundos de autenticación

```mermaid
graph TB
    subgraph M1["Mundo del consultorio"]
        T1["Token con<br/>id_usuario + tenant_id"]
        MW1["authMiddleware"]
        API1["12 módulos<br/>de negocio"]
        T1 --> MW1 --> API1
    end

    subgraph M2["Mundo de la plataforma"]
        T2["Token con<br/>id_admin + tipo PLATAFORMA"]
        MW2["plataformaMiddleware"]
        API2["módulo plataforma"]
        T2 --> MW2 --> API2
    end

    T2 -.->|"403"| MW1
    T1 -.->|"401"| MW2

    classDef rechazo stroke:#c04040,color:#c04040
```

Las dos flechas punteadas son la garantía: **cada middleware rechaza los tokens del otro**. Están
verificadas por las comprobaciones P-03 y P-04 de `npm run verificar:plataforma`.

---

## Piezas transversales

| Componente | Qué hace | Por qué está separado |
|---|---|---|
| `mailer.js` | Envío de correo | Admite SMTP propio o Gmail como respaldo. Cambiar de proveedor es tocar el `.env`, no el código |
| `cloudflare.js` | Cliente de almacenamiento | Aísla el proveedor de archivos del resto |
| `subida.middleware.js` | Traduce errores de subida | Los fallos de tamaño y formato ocurren **antes** del controlador; sin esta pieza acababan en un 500 genérico |
| `recordatorios.job.js` | El cron de alertas | Corre dentro del proceso de la API ([ADR-007](../../docs/11-DECISIONES-ARQUITECTONICAS.md)) |
| `terminos.utils.js` | Semáforo y cuenta atrás | Funciones puras: se razonan y prueban sin montar la interfaz |

---

## Frontend

```mermaid
graph TB
    APP["App.jsx<br/>enrutado y protección"]
    APP --> AUTH["Páginas de acceso<br/>login · registro · recuperar"]
    APP --> LAYOUT["DashboardLayout"]
    APP --> PORTAL["PortalLayout<br/>cliente"]
    APP --> PLAT["Consola de plataforma<br/>sesión aparte"]

    LAYOUT --> P1["Panel"]
    LAYOUT --> P2["Clientes"]
    LAYOUT --> P3["Expedientes"]
    LAYOUT --> P4["Bitácora · Reportes · Ajustes"]

    P3 --> DET["ProcesoDetalle"]
    DET --> H["5 hooks de dominio<br/>actuaciones · documentos<br/>audiencias · términos · equipo"]

    classDef refac fill:#1a2a1a,stroke:#4a8a4a,color:#fff
    class H refac
```

**`ProcesoDetalle` concentraba el 36 % del frontend** en un solo archivo: 3 094 líneas y 76
piezas de estado. Se repartió en cinco *hooks* de dominio, quedando en 2 522 líneas y 8 estados.

La restricción que lo hizo seguro: **cada hook devuelve los mismos nombres de variable** que
había en el componente, de modo que las 2 300 líneas de interfaz no se tocaron. Se movió estado;
no se reescribió la pantalla.
