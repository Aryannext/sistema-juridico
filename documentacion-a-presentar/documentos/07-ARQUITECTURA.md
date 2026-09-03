# 07 — Arquitectura

> Los diagramas están en [`diagramas/08-componentes.md`](../diagramas/08-componentes.md) y
> [`diagramas/10-arquitectura-y-despliegue.md`](../diagramas/10-arquitectura-y-despliegue.md).

---

## 1. Qué es el sistema — y qué no es

**El SGPA es un monolito modular.** Un único proceso de Node.js, una única base de datos, un
único despliegue, organizado internamente por dominio de negocio.

> **No es microservicios**, aunque documentación anterior del proyecto lo llamara así. La
> diferencia no es de vocabulario: microservicios implica servicios que se despliegan por
> separado, se comunican entre procesos y tienen bases de datos independientes. **Nada de eso
> existe aquí**, y afirmarlo en una sustentación invalidaría el resto del argumento
> arquitectónico. Razonado en [ADR-001](../../docs/11-DECISIONES-ARQUITECTONICAS.md).

**Tampoco es MVC clásico.** No hay carpetas `controllers/`, `models/` y `views/`. La organización
es **por dominio**: todo lo de expedientes vive junto, todo lo de documentos vive junto.

```
backend/src/modules/procesos/
├── procesos.routes.js       ← qué URL responde qué
└── procesos.controller.js   ← qué hace
```

Un desarrollador nuevo entiende «expedientes» abriendo dos archivos contiguos, en lugar de saltar
entre tres carpetas.

---

## 2. Las capas

Cada petición atraviesa siempre el mismo camino:

```
Navegador
   ↓  HTTPS
Nginx                    ← TLS, sirve el frontend, reenvía /api
   ↓
Express · app.js         ← helmet, CORS, limitador de peticiones
   ↓
Router del módulo        ← qué URL corresponde a qué función
   ↓
authMiddleware           ← ¿quién eres? → inyecta req.user y req.tenant_id
   ↓
rolesMiddleware          ← ¿puedes hacer esto en este módulo?
   ↓
auditMiddleware          ← registra la acción cuando termine
   ↓
Controlador              ← reglas de negocio
   ↓
Prisma → PostgreSQL
```

**La pieza que sostiene el aislamiento es `authMiddleware`.** Además de autenticar, escribe
`req.tenant_id`, y **cada consulta del sistema lo incluye en su filtro**. Sin esa línea, un
consultorio vería los datos de otro.

---

## 3. Tecnologías

| Capa | Tecnología | Versión |
|---|---|---|
| Interfaz | React · Vite · Tailwind CSS · React Router | 19 · 8 · 4 · 7 |
| API | Node.js · Express | 24 · 4 |
| Acceso a datos | Prisma ORM | 5.22 |
| Base de datos | PostgreSQL, en contenedor propio | 16 |
| Archivos | Cloudflare R2, con enlaces firmados temporales | — |
| Tareas programadas | `node-cron`, dentro del propio proceso | — |
| Correo | SMTP configurable | — |
| Despliegue | Docker Compose sobre VPS, tras Nginx | — |

---

## 4. Multi-consultorio: cómo se garantiza el aislamiento

Cada tabla de negocio lleva una columna `tenant_id`. El aislamiento se impone **en el código**:

```js
// En el middleware, una vez por petición:
req.tenant_id = user.tenant_id;

// En cada consulta, sin excepción:
where: { id_proceso: id, tenant_id: req.tenant_id }
```

**Consecuencia honesta:** el aislamiento depende de que ninguna consulta olvide ese filtro. No es
una garantía de la base de datos. Se evaluó *Row Level Security* de PostgreSQL —que lo haría
imposible de olvidar— y se pospuso ([ADR-003](../../docs/11-DECISIONES-ARQUITECTONICAS.md)).

**Por eso el aislamiento es lo que más se prueba:** una suite unitaria dedicada más cuatro
comprobaciones de extremo a extremo. Es la clase de error que no falla de forma ruidosa: filtra
datos en silencio.

### La excepción deliberada: el administrador de plataforma

Quien opera el servicio necesita dar de alta y suspender consultorios. Podría haberse resuelto
con un rol más, y **se decidió que no**:

- Tabla propia, **sin `tenant_id`**.
- Token de otro tipo, marcado `PLATAFORMA`.
- Middleware propio que **no define `req.tenant_id` ni `req.user`**: si un controlador de
  consultorio se invocara por error, filtraría por `undefined` y no devolvería nada, en lugar de
  devolverlo todo.
- Comprobación **en los dos sentidos**: cada middleware rechaza los tokens del otro.

Así, la separación no depende de acordarse de comprobar un rol: depende de que el token sea de
otro tipo. Los expedientes están cubiertos por el secreto profesional entre abogado y cliente, y
esa distinción tenía que ser exigible por diseño. [ADR-012](../../docs/11-DECISIONES-ARQUITECTONICAS.md).

---

## 5. Cómo se disparan las alertas

Es el mecanismo que resuelve el problema original: que un plazo no se venza sin que nadie avise.

```
node-cron, cada 15 minutos
   ↓
Busca recordatorios cuya hora de envío ya pasó y siguen sin enviarse
   ↓
Resuelve destinatarios: responsable + colaboradores (+ Administrador si es crítico)
   ↓
Crea la notificación en plataforma  ·  Envía el correo
   ↓
Marca el recordatorio como enviado
```

**Corre dentro del mismo proceso de la API**, no como servicio aparte. Para el volumen de un
despacho es suficiente y evita otra pieza que desplegar y vigilar. La contrapartida está
declarada: si el proceso se cae, se detienen también las alertas
([ADR-007](../../docs/11-DECISIONES-ARQUITECTONICAS.md)).

---

## 6. Despliegue

El sistema corre en un **VPS compartido con otra aplicación** de otro usuario, que depende de una
versión distinta de Node.

Eso obligó a una decisión: **contenedores**. Al fijar la versión de Node dentro de la imagen,
actualizar el SGPA deja de poder romperle el servicio al vecino.

| Contenedor | Qué hace | Puerto |
|---|---|---|
| `sgpa-backend` | API y cron | `127.0.0.1:3005` — **no expuesto a internet** |
| `sgpa-postgres` | Base de datos | **Ninguno.** Solo alcanzable desde la red interna |
| `frontend-build` | Compila y termina | — |

El Nginx del servidor sirve los archivos estáticos y reenvía `/api` al contenedor. El
`127.0.0.1` no es decorativo: sin él, Docker abriría el puerto a internet saltándose el
cortafuegos.

Procedimiento completo en
[12-DESPLIEGUE-VPS-COMPARTIDO.md](../../docs/12-DESPLIEGUE-VPS-COMPARTIDO.md).

---

## 7. Decisiones estructurales

Las doce decisiones de arquitectura están registradas con su contexto, sus alternativas
descartadas y sus consecuencias en
[11-DECISIONES-ARQUITECTONICAS.md](../../docs/11-DECISIONES-ARQUITECTONICAS.md).

Las que más se preguntan:

| | Decisión | Por qué |
|---|---|---|
| ADR-001 | Monolito modular | Microservicios multiplicaría la complejidad operativa sin resolver ningún problema real |
| ADR-003 | Aislamiento por columna, aplicado en código | Simple y verificado; RLS queda anotado como mejora |
| ADR-005 | Sin capa de servicios | Extraerla toca 13 módulos con riesgo de regresión y **cero cambio funcional** |
| ADR-008 | El sistema **vigila** términos, no los **calcula** | Calcularlos exige criterio jurídico; equivocarlo tendría consecuencias graves |
| ADR-011 | Contenedores | El VPS es compartido; actualizar no puede romperle el servicio a otro |
| ADR-012 | Administrador de plataforma separado | Secreto profesional: la separación debe ser por diseño, no por confianza |

> **Un ADR nunca se reescribe.** Cuando una decisión cambia, se añade una nota debajo o un ADR
> nuevo que la supere. El valor está en poder reconstruir por qué se pensó lo que se pensó,
> incluso cuando se demostró equivocado.
