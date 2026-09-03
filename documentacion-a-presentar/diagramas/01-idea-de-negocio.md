# 01 — Idea de negocio

**Qué responde:** quién usa el sistema, quién lo paga, qué recibe cada uno y por dónde entra el
dinero.

---

## El modelo

```mermaid
graph LR
    subgraph OFERTA["Lo que ofrece el SGPA"]
        V1["Expediente digital<br/>centralizado"]
        V2["Alertas antes de que<br/>venza un término"]
        V3["Portal donde el cliente<br/>consulta solo"]
        V4["Rastro auditable<br/>de cada acción"]
    end

    subgraph CLIENTES["Quién paga"]
        C1["Consultorio jurídico<br/>varios abogados"]
        C2["Abogado independiente"]
    end

    subgraph USUARIOS["Quién lo usa a diario"]
        U1["Administrador"]
        U2["Abogado"]
        U3["Colaborador"]
        U4["Cliente del despacho"]
    end

    subgraph PLATAFORMA["Quién opera el servicio"]
        P1["Administrador<br/>de plataforma"]
    end

    C1 -->|"suscripción"| OFERTA
    C2 -->|"suscripción"| OFERTA
    OFERTA --> U1 & U2 & U3
    OFERTA -->|"acceso restringido"| U4
    P1 -->|"da de alta, suspende<br/>y da de baja"| C1
    P1 --> C2

    classDef oferta fill:#DFB971,stroke:#000,color:#000
    classDef paga fill:#2a2a2a,stroke:#DFB971,color:#fff
    class V1,V2,V3,V4 oferta
    class C1,C2 paga
```

---

## Quién es quién

| Actor | Qué obtiene | Qué aporta |
|---|---|---|
| **Consultorio jurídico** | Todos sus abogados trabajando sobre los mismos expedientes, sin carpetas duplicadas | Paga la suscripción |
| **Abogado independiente** | Un sistema que vigila sus plazos sin necesitar personal de apoyo | Paga la suscripción |
| **Abogado** | Deja de depender de su memoria para no perder un término | Registra actuaciones y plazos |
| **Colaborador** | Apoya la gestión sin acceso a lo que no le corresponde | Carga documentos, agenda audiencias |
| **Cliente del despacho** | Consulta el estado de su caso sin llamar por teléfono | Reduce la carga de atención del despacho |
| **Administrador de plataforma** | Gestiona altas, suspensiones y bajas | Opera el servicio |

---

## Por qué un consultorio pagaría por esto

El valor no está en «tener los documentos en la nube». Está en **una consecuencia concreta que
se evita**:

> Un término judicial es **perentorio**. Si se vence, la oportunidad procesal se pierde y no se
> recupera. Eso puede convertirse en una reclamación de responsabilidad profesional contra el
> abogado.

El sistema no calcula términos ni sustituye el criterio jurídico. Lo que hace es **no dejar que
un plazo pase inadvertido**: lo registra, lo vigila y avisa con la antelación que se le indique,
por plataforma y por correo.

Todo lo demás —expediente centralizado, versionado documental, portal del cliente— es
consecuencia de haber tenido que construir un lugar donde vivan esos plazos.

---

## Modelo de ingresos

**Suscripción por consultorio**, con dos planes previstos (`BASICO` y `PRO`).

### Estado real, sin adornos

| Pieza | Estado |
|---|---|
| La plataforma distingue consultorios y los aísla entre sí | ✅ |
| Se puede **suspender** un consultorio y sus usuarios dejan de entrar al instante | ✅ |
| Se puede darlo de baja definitivamente, con tres cerrojos | ✅ |
| Los planes `BASICO` y `PRO` **cambian algo** | 🟥 el campo existe pero no se lee |
| Fechas de vencimiento y de último pago | 🟥 no existen |
| Suspensión automática por impago | 🟥 es manual |
| Pasarela de pago | 🟥 fuera de alcance |

> **Lo construido es la palanca, no la maquinaria.** Hoy se puede cortar el acceso de un
> consultorio moroso en un clic, pero alguien tiene que decidir hacerlo. Conviene decirlo así:
> el aislamiento y la suspensión —que es lo difícil— están resueltos; la automatización del cobro
> está definida y no implementada.

Detalle en [15-ADMINISTRACION-DE-PLATAFORMA.md](../../docs/15-ADMINISTRACION-DE-PLATAFORMA.md).
