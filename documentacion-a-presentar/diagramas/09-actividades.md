# 09 — Diagrama de actividades

**Qué responde:** los procesos completos con sus decisiones, bifurcaciones y quién hace cada
paso.

> **Diferencia con el diagrama de flujo.** Aquel muestra el recorrido feliz; este muestra **todas
> las ramas**, incluidas las que terminan en rechazo. Las calles verticales indican quién ejecuta
> cada paso.

---

## 1. Archivar un expediente

El proceso con más reglas del sistema.

```mermaid
flowchart TD
    Start([El abogado quiere<br/>archivar un expediente]) --> A["Elige estado ARCHIVADO"]
    A --> B{"¿Escribió<br/>justificación?"}
    B -->|No| B1["400 · La justificación<br/>es obligatoria"] --> End1([Fin])

    B -->|Sí| C["El sistema busca<br/>pendientes"]
    C --> D{"¿Hay términos<br/>pendientes?"}
    D -->|Sí| F["Recopila la lista"]
    D -->|No| E{"¿Hay audiencias<br/>en 30 días?"}
    E -->|Sí| F
    E -->|No| J["Archiva"]

    F --> G{"¿Es<br/>Administrador?"}
    G -->|No| H["400 · Enumera qué lo impide"] --> End2([Fin])
    G -->|Sí| I{"¿Confirmó<br/>explícitamente?"}
    I -->|No| H
    I -->|Sí| J

    J --> K["Guarda el estado"]
    K --> L["Registra en el historial<br/>con la justificación"]
    L --> M["Registra en la bitácora"]
    M --> End3([Archivado])

    classDef rechazo fill:#3a1a1a,stroke:#c04040,color:#fff
    classDef exito fill:#1a2a1a,stroke:#4a8a4a,color:#fff
    class B1,H rechazo
    class End3 exito
```

**La rama que importa** es la de la derecha: cuando hay pendientes, el sistema **no dice
simplemente que no**. Devuelve la lista de qué lo impide, y solo entonces el Administrador puede
decidir forzarlo. Archivar apaga la vigilancia de los plazos; tiene que ser una decisión
consciente (RN05).

---

## 2. Registrar y vigilar un término

```mermaid
flowchart TD
    subgraph ABO["Abogado"]
        A1([Registra el término]) --> A2["Indica descripción<br/>y vencimiento"]
        A2 --> A3{"¿Lo vincula a<br/>una actuación?"}
        A3 -->|Sí| A4["Selecciona el auto<br/>que lo originó"]
        A3 -->|No| A5["Queda suelto"]
        A4 --> A6{"¿Es crítico?"}
        A5 --> A6
    end

    subgraph SIS["Sistema"]
        A6 --> B1["Crea el término"]
        B1 --> B2["Genera hasta 3 recordatorios<br/>5 días · 1 día · el día"]
        B2 --> B3{"¿Alguno ya<br/>habría pasado?"}
        B3 -->|Sí| B4["Lo omite"]
        B3 -->|No| B5["Lo programa"]
        B4 --> B6
        B5 --> B6{"¿Es crítico?"}
        B6 -->|Sí| B7["Notifica también<br/>al Administrador"]
        B6 -->|No| B8["Notifica al responsable<br/>y colaboradores"]
        B7 --> B8
    end

    subgraph CRON["Cron · cada 15 min"]
        B8 --> C1{"¿Llegó la hora<br/>de algún recordatorio?"}
        C1 -->|No| C2([Espera]) --> C1
        C1 -->|Sí| C3["Crea la notificación"]
        C3 --> C4["Envía el correo"]
        C4 --> C5["Marca como enviado"]
    end

    C5 --> D{"¿El abogado<br/>lo gestiona?"}
    D -->|No| D1["⚠️ Sigue visible<br/>aunque venza"]
    D1 --> D
    D -->|Sí| E([Ver actividad 3])

    classDef alerta fill:#3a2a1a,stroke:#DFB971,color:#fff
    class D1 alerta
```

> **El bucle de la parte inferior es intencional.** Un término vencido **no desaparece**: sigue
> visible y sigue reclamando atención hasta que alguien lo gestione. Un plazo vencido es justo lo
> que no debe dejar de verse (RF34).

---

## 3. Gestionar el cumplimiento — la regla RN07

```mermaid
flowchart TD
    A([El abogado abre<br/>el término]) --> B{"¿Escribió<br/>justificación?"}
    B -->|No| B1["400"] --> End1([Fin])

    B -->|Sí| C{"¿Qué estado<br/>registra?"}
    C -->|Incumplido| D["Estado: INCUMPLIDO"]
    C -->|Cumplido| E{"El sistema compara:<br/>¿hoy > vencimiento?"}

    E -->|No| F["Estado: CUMPLIDO"]
    E -->|Sí| G["⚠️ RECLASIFICA SOLO<br/>a CUMPLIDO_TARDIO"]

    G --> H{"¿El Administrador<br/>lo sobrescribe?"}
    H -->|No| I["Queda CUMPLIDO_TARDIO"]
    H -->|Sí| J["Sobrescribe"]
    J --> K["Registra SOBREESCRITURA_<br/>TERMINO_TARDIO en bitácora"]

    D --> L["Cierra las alertas<br/>asociadas"]
    F --> L
    I --> L
    K --> L
    L --> End2([Gestionado])

    classDef regla fill:#3a2a1a,stroke:#DFB971,color:#fff
    class G,K regla
```

**La reclasificación ocurre en el servidor y no se puede evitar desde la interfaz.** Es la regla
con más peso jurídico del sistema: un término es **perentorio**, y cumplirlo tarde no es
cumplirlo. Registrarlo como cumplido a secas falsearía el historial del caso, que es
exactamente lo que se discutiría en una reclamación de responsabilidad profesional.

---

## 4. Subir un documento y compartirlo

```mermaid
flowchart TD
    A([Selecciona el archivo]) --> B{"¿Formato<br/>admitido?"}
    B -->|No| B1["400 · Dice cuáles<br/>formatos sí valen"] --> End1([Fin])
    B -->|Sí| C{"¿Menos<br/>de 10 MB?"}
    C -->|No| C1["400 · Indica<br/>el tamaño máximo"] --> End1

    C -->|Sí| CA{"¿Categoría<br/>de las siete?"}
    CA -->|No| CA1["400 · Enumera<br/>las admitidas"] --> End1

    CA -->|Sí| D["Sube al almacenamiento"]
    D --> E{"¿El almacenamiento<br/>lo aceptó?"}
    E -->|No| E1["502 · Nombra el<br/>almacenamiento, no un<br/>error genérico"] --> End1

    E -->|Sí| F["Registra documento<br/>y versión 1"]
    F --> G["Visibilidad inicial:<br/>PRIVADO"]
    G --> H["Registra en bitácora"]
    H --> I{"¿El abogado lo<br/>comparte con el cliente?"}
    I -->|No| J([Solo lo ve el despacho])
    I -->|Sí| K["Cambia a<br/>COMPARTIDO_CLIENTE"]
    K --> L([Aparece en el portal])

    classDef rechazo fill:#3a1a1a,stroke:#c04040,color:#fff
    class B1,C1,CA1,E1 rechazo
```

**Las cuatro ramas de rechazo dicen qué corregir.** Las de formato y tamaño devolvían el mismo
`500 "Algo salió mal!"` hasta el 2 de septiembre de 2026, porque la validación de multer ocurre
**antes** del controlador y su `try/catch` nunca llegaba a ejecutarse. La de categoría se añadió
el 3 de septiembre: una categoría inexistente viajaba sin validar hasta Prisma y volvía con el
mismo error opaco.

---

## 5. Suspender un consultorio por impago

```mermaid
flowchart TD
    subgraph PLAT["Administrador de plataforma"]
        A([Detecta el impago]) --> B["Abre la consola"]
        B --> C["Pulsa suspender"]
        C --> D{"¿Escribió<br/>el motivo?"}
        D -->|No| D1["400"] --> End1([Fin])
        D -->|Sí| E["Confirma"]
    end

    subgraph SIS["Sistema"]
        E --> F["Marca el consultorio<br/>como inactivo"]
        F --> G["Registra en la bitácora<br/>de plataforma"]
    end

    subgraph USR["Usuarios del consultorio"]
        G --> H{"¿Tenían sesión<br/>abierta?"}
        H -->|Sí| I["Su siguiente petición<br/>recibe 403"]
        H -->|No| J["No pueden entrar"]
        I --> K["'Su consultorio está<br/>suspendido'"]
        J --> K
    end

    K --> L{"¿Pagan?"}
    L -->|Sí| M["El administrador reactiva"] --> N([Todo sigue donde estaba])
    L -->|No| O{"¿Solicitan la baja?"}
    O -->|No| K
    O -->|Sí| P([Ver actividad 6])

    classDef exito fill:#1a2a1a,stroke:#4a8a4a,color:#fff
    class N exito
```

> **Suspender no borra nada.** Al reactivar, todo sigue donde estaba. Es lo que permite usarlo
> como palanca de cobro sin riesgo para los expedientes del despacho.

---

## 6. Dar de baja un consultorio — los tres cerrojos

```mermaid
flowchart TD
    A([Solicitud de baja]) --> B{"¿El consultorio está<br/>SUSPENDIDO?"}
    B -->|No| B1["400 · Hay que suspenderlo<br/>primero. En la consola el botón<br/>ni siquiera aparece"] --> End1([Fin])

    B -->|Sí| C{"¿Escribió el<br/>nombre EXACTO?"}
    C -->|No| C1["400 · Muestra el<br/>nombre esperado"] --> End1

    C -->|Sí| D{"¿Justificación de<br/>10 caracteres o más?"}
    D -->|No| D1["400"] --> End1

    D -->|Sí| E["Registra en la bitácora<br/>ANTES de borrar"]
    E --> F["Transacción: borra en orden<br/>de las hojas a la raíz<br/>en once tablas"]
    F --> G{"¿Fue bien?"}
    G -->|No| G1["Revierte todo.<br/>Queda constancia del intento"] --> End1
    G -->|Sí| H["Avisa de los archivos<br/>que quedan en el<br/>almacenamiento externo"]
    H --> End2([Eliminado])

    classDef cerrojo fill:#3a2a1a,stroke:#DFB971,color:#fff
    classDef rechazo fill:#3a1a1a,stroke:#c04040,color:#fff
    class B,C,D cerrojo
    class B1,C1,D1,G1 rechazo
```

**Los tres cerrojos son deliberados y ninguno es decorativo.** Esto borra expedientes judiciales:
para un despacho, perderlos puede tener consecuencias legales frente a sus propios clientes.

- **El primero** obliga a que exista un periodo en el que el consultorio ya no entra pero sus
  datos siguen ahí. Es el margen para rectificar.
- **El segundo** evita eliminar el de la fila de al lado.
- **El tercero** deja escrito por qué se hizo.

Y la bitácora se escribe **antes** de borrar, fuera de la transacción: si el borrado fallara a
medias, queda constancia del intento. Su tabla no cuelga del consultorio, así que sobrevive a su
desaparición.
