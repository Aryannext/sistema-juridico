# 05 — Flujos principales

**Qué responde:** el recorrido completo de las cuatro operaciones que definen el sistema, paso a
paso y con lo que ocurre por debajo.

---

## 1. Del auto del juzgado a la alerta

**Es el flujo que resuelve el problema original.** Del juzgado sale un auto, del auto nace un
plazo, y del plazo debe salir un aviso antes de que se venza.

```mermaid
sequenceDiagram
    actor A as Abogado
    participant UI as Interfaz
    participant API as API
    participant BD as Base de datos
    participant CRON as Cron · cada 15 min
    participant MAIL as Correo

    Note over A: Llega un auto del juzgado
    A->>UI: Registra la actuación<br/>(fecha, tipo, anotación)
    UI->>API: POST /actuaciones
    API->>BD: Guarda actuación + historial
    BD-->>A: Actuación registrada

    Note over A: De ese auto nace un plazo
    A->>UI: Registra el término<br/>y lo vincula a la actuación
    UI->>API: POST /terminos
    API->>BD: Guarda término
    API->>BD: Crea 3 recordatorios<br/>(5 días, 1 día, el día)
    API->>BD: Notifica al responsable<br/>(+ Administrador si es crítico)

    Note over CRON: Pasan los días
    loop Cada 15 minutos
        CRON->>BD: ¿Hay recordatorios vencidos<br/>sin enviar?
        BD-->>CRON: Sí, uno
        CRON->>BD: Crea notificación en plataforma
        CRON->>MAIL: Envía correo
        CRON->>BD: Marca el recordatorio<br/>como enviado
    end

    MAIL-->>A: "Vence en 5 días:<br/>contestar la demanda"
```

**Por qué importa el vínculo actuación → término.** Sin él, un plazo aparece suelto y nadie
recuerda de dónde salió. Con él, se puede responder a *«¿por qué existe este término?»*
señalando el auto que lo originó.

---

## 2. Gestionar el término, y la regla que lo gobierna

```mermaid
flowchart TD
    A["El abogado abre<br/>el término pendiente"] --> B{"¿Qué registra?"}
    B -->|Cumplido| C{"¿Ya pasó la fecha<br/>de vencimiento?"}
    B -->|Incumplido| D["Estado: INCUMPLIDO"]

    C -->|No| E["Estado: CUMPLIDO"]
    C -->|Sí| F["⚠️ El sistema lo reclasifica<br/>SOLO como CUMPLIDO_TARDIO"]

    F --> G{"¿El Administrador<br/>lo sobrescribe?"}
    G -->|No| H["Queda CUMPLIDO_TARDIO"]
    G -->|Sí| I["Se sobrescribe<br/>y queda en la bitácora como<br/>SOBREESCRITURA_TERMINO_TARDIO"]

    E --> J["Se cierran las alertas<br/>asociadas"]
    H --> J
    I --> J
    D --> J

    classDef regla fill:#3a2a1a,stroke:#DFB971,color:#fff
    class F,I regla
```

> **La reclasificación no se puede evitar desde la interfaz.** Ocurre en el servidor, antes de
> guardar. Un término perentorio cumplido fuera de plazo **no es un término cumplido**, y
> registrarlo como tal falsearía el historial del caso. Es la regla RN07.

---

## 3. De un documento privado a la descarga del cliente

```mermaid
sequenceDiagram
    actor A as Abogado
    participant API as API
    participant R2 as Almacenamiento
    actor C as Cliente

    A->>API: Sube el documento<br/>(visibilidad: PRIVADO)
    API->>API: Valida formato y tamaño
    API->>R2: Guarda el archivo
    API->>API: Registra documento + versión 1
    Note over API: El cliente NO lo ve

    A->>API: Cambia visibilidad a<br/>COMPARTIDO_CLIENTE
    Note over API: Ahora sí aparece en el portal

    C->>API: Entra al portal
    API->>API: Filtra: solo sus procesos<br/>y solo lo compartido
    API-->>C: Lista de documentos

    C->>API: Pide descargar
    API->>API: Verifica que sea suyo<br/>y esté compartido
    API->>R2: Genera enlace firmado<br/>y temporal
    R2-->>C: Descarga
    API->>API: Registra la descarga<br/>en la bitácora
```

**Tres controles antes de cada descarga:** que el documento pertenezca a un proceso del cliente,
que esté marcado como compartido, y que el enlace sea temporal. Y la descarga queda auditada.

---

## 4. Del registro al primer expediente

El recorrido de un consultorio nuevo, de principio a fin.

```mermaid
flowchart TD
    A["Se registra en la plataforma"] --> B["Cuenta creada INACTIVA"]
    B --> C["Llega el correo<br/>de verificación"]
    C --> D{"¿Abre el enlace<br/>antes de 24 h?"}
    D -->|No| E["Solicita un enlace nuevo<br/>desde la misma pantalla"]
    E --> C
    D -->|Sí| F["Cuenta ACTIVA"]

    F --> G["Inicia sesión"]
    G --> H{"¿Tiene 2FA?"}
    H -->|Sí| I["Introduce el código<br/>recibido por correo"]
    H -->|No| J["Entra al panel"]
    I --> J

    J --> K["Registra un cliente"]
    K --> L["Crea el expediente<br/>con su radicado"]
    L --> M["Registra partes,<br/>actuaciones y documentos"]
    M --> N["Registra términos<br/>y audiencias"]
    N --> O["El sistema empieza<br/>a vigilar los plazos"]

    classDef exito fill:#1a2a1a,stroke:#4a8a4a,color:#fff
    class O exito
```

> El paso **E** —solicitar otro enlace— no existía hasta el 2 de septiembre de 2026. Sin él, un
> correo perdido en la carpeta de spam dejaba a esa persona **bloqueada sin salida**: no podía
> activar la cuenta, no podía pedir otro mensaje y no podía volver a registrarse porque el correo
> ya figuraba como usado.

---

## 5. Qué ocurre cuando alguien intenta ver lo que no es suyo

```mermaid
flowchart TD
    A["Usuario del<br/>Consultorio A"] --> B["Pide GET /procesos/{id}<br/>de un expediente del<br/>Consultorio B"]
    B --> C["authMiddleware<br/>inyecta tenant_id = A"]
    C --> D["La consulta filtra por<br/>id_proceso Y tenant_id"]
    D --> E{"¿Encuentra algo?"}
    E -->|No| F["404 Expediente no encontrado"]

    F --> G["El usuario NO sabe si<br/>ese expediente existe"]

    classDef seguro fill:#1a2a1a,stroke:#4a8a4a,color:#fff
    class G seguro
```

**Se responde 404, no 403, y es deliberado.** Un 403 diría «existe, pero no puedes verlo», lo
que confirma la existencia de un expediente ajeno. El 404 no revela nada.

> El requisito RNF11 pide explícitamente un 403. **Se decidió no cumplirlo**, y la razón está
> escrita en el catálogo: cumplir la letra de ese requisito empeoraría la seguridad. Es un
> desacuerdo argumentado con la especificación, no un olvido.
