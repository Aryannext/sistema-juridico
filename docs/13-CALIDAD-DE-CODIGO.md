# 13 — Calidad del código: SOLID y código limpio

**Fecha:** 1 de septiembre de 2026
**Método:** medición sobre el código real, no impresiones. Cada afirmación de este documento
lleva el número que la respalda y el comando que lo reproduce.

> ## ⚠️ Este documento describe el estado del 1 de septiembre
>
> El **2 de septiembre** se ejecutaron el **Paso 2** (repartir `ProcesoDetalle.jsx`) y el
> **Paso 4** (linter del backend), y se corrigieron siete defectos que esta revisión no había
> buscado. Lo que cambió:
>
> | | Aquí se dice | Hoy |
> |---|---:|---:|
> | `ProcesoDetalle.jsx` | 3 094 líneas, 76 `useState` | **2 522 líneas, 8 `useState`** |
> | Linter del backend | no existe | **0 errores** |
> | Pruebas | 21 en 8 suites | **27 en 9 suites** |
>
> El resto del análisis —los principios SOLID, la duplicación del backend, los Pasos 0, 1 y 3—
> **sigue vigente sin cambios**. Detalle en [14-AUDITORIA-DE-DEFECTOS.md](14-AUDITORIA-DE-DEFECTOS.md).

---

## Resumen honesto

El código **funciona y es legible**. Los nombres son claros y en español, las reglas de negocio
difíciles están bien implementadas y el sistema pasa 21 pruebas y 34 comprobaciones de extremo
a extremo. Nada de lo que sigue es urgente ni impide desplegar.

Dicho eso, hay **dos problemas estructurales reales** y un montón de duplicación medible:

| Problema | Magnitud | Gravedad |
|---|---|---|
| `ProcesoDetalle.jsx` concentra el 36 % del frontend en un archivo | 3 094 líneas, 76 `useState`, 14 modales | **Alta** |
| Los controladores mezclan HTTP, negocio, persistencia, auditoría y notificaciones | Funciones de hasta 174 líneas | Media |
| Duplicación de auditoría y de comprobaciones de pertenencia | 16 y 11 repeticiones | Media |
| El backend no tiene linter | 0 reglas aplicadas | Baja |

Y una advertencia que vale más que cualquier recomendación de este documento:

> **No se debe refactorizar esto todavía.** Con 21 pruebas unitarias, una refactorización de
> este alcance se hace a ciegas. El orden correcto es **primero pruebas, después refactor**.
> Ver la sección 6.

> **Nota del 2 de septiembre.** El reparto se hizo, y sigue siendo cierto que el frontend no
> tiene pruebas. Lo que redujo el riesgo a algo aceptable fue una restricción de método: los
> hooks devuelven los mismos nombres de variable que había en el componente, de modo que el JSX
> no se tocó. Se movió estado, no se reescribió interfaz. Sigue pendiente escribir esas pruebas.

---

## 1. Los números

```bash
# Tamaños
wc -l frontend/src/pages/*/*.jsx backend/src/modules/*/*.js | sort -rn

# Anatomía del archivo más grande
grep -c 'useState('        frontend/src/pages/procesos/ProcesoDetalle.jsx
grep -c '{/\* MODAL'       frontend/src/pages/procesos/ProcesoDetalle.jsx

# Duplicación en el backend
grep -rho 'bitacoraAuditoria.create'   backend/src/modules | wc -l
grep -rho 'tenant_id: req.tenant_id'   backend/src/modules | wc -l
```

### Frontend — 8 640 líneas

| Archivo | Líneas | % del total |
|---|---:|---:|
| `ProcesoDetalle.jsx` | **3 094** | **36 %** |
| `ProcesosList.jsx` | 660 | 8 % |
| `AjustesPage.jsx` | 574 | 7 % |
| `ClienteFicha.jsx` | 556 | 6 % |
| `DashboardIndex.jsx` | 536 | 6 % |
| resto (8 archivos) | 3 220 | 37 % |

### Backend — 4 336 líneas

| Archivo | Líneas |
|---|---:|
| `procesos.controller.js` | 632 |
| `documentos.controller.js` | 608 |
| `auth.controller.js` | 400 |
| `audiencias.controller.js` | 332 |
| `terminos.controller.js` | 325 |

### Funciones más largas

| Función | Líneas |
|---|---:|
| `reportes.getStats` | 174 |
| `terminos.createTermino` | 163 |
| `audiencias.updateAudiencia` | 129 |
| `auth.login` | 123 |
| `auth.registro` | 110 |

Como referencia habitual: por encima de **50 líneas** una función deja de caber en pantalla y
cuesta razonar sobre ella; por encima de **100** casi siempre está haciendo más de una cosa.

---

## 2. SOLID, principio por principio

Un apunte de método: **SOLID nació para lenguajes de orientación a objetos con interfaces y
herencia**. Este proyecto es JavaScript con módulos y funciones. Aplicar los cinco principios
al pie de la letra sería forzar la máquina, así que a continuación se dice con franqueza cuáles
aplican de verdad y cuáles no.

### S — Responsabilidad única · ❌ **Se incumple, y es el problema principal**

**En el backend.** Un controlador debería traducir HTTP a una llamada de negocio y devolver la
respuesta. Los de este proyecto hacen seis cosas. `createTermino` (163 líneas) por sí solo:

1. Valida los datos de entrada.
2. Comprueba que el expediente pertenece al consultorio.
3. Valida el vínculo con la actuación.
4. Crea el término.
5. Calcula y crea hasta 3 recordatorios con sus valores por defecto.
6. Resuelve quiénes son los destinatarios (responsable, colaboradores y administradores si es
   crítico) y crea sus notificaciones.

Los puntos 5 y 6 son **reglas de negocio del dominio jurídico**, no manejo de HTTP. Hoy no se
pueden reutilizar desde el cron ni desde un script, ni probar sin simular `req` y `res`.

**En el frontend.** `ProcesoDetalle.jsx` es un solo componente que contiene:

| Elemento | Cantidad |
|---|---:|
| `useState` | **76** |
| Modales | 14 |
| Pestañas | 5 |
| Manejadores de eventos | 21 |
| Funciones de carga de datos | 6 |
| Llamadas a la API | 27 |

Setenta y seis piezas de estado en un componente significan que **cualquier cambio obliga a
releer 3 000 líneas** para saber qué más se ve afectado. Es el archivo donde un error nuevo
tiene más probabilidad de esconderse.

### O — Abierto/cerrado · 🟡 Se incumple de forma leve

Añadir un módulo obliga a copiar y pegar el mismo andamiaje de rutas y el mismo bloque de
`try/catch`. Lo viví al crear `actuaciones`: el archivo de rutas es casi idéntico al de
`terminos`. No es grave —el coste es teclear, no razonar—, pero es señal de que falta una
abstracción.

### L — Sustitución de Liskov · ➖ **No aplica**

No hay herencia ni jerarquías de clases en el proyecto. Buscar violaciones de Liskov aquí sería
inventarlas.

### I — Segregación de interfaces · ➖ **No aplica directamente**

No hay interfaces. El equivalente más cercano —que un módulo no dependa de cosas que no usa— se
respeta razonablemente: cada controlador importa solo lo suyo.

### D — Inversión de dependencias · ❌ **Se incumple**

**Los 12 controladores** hacen exactamente esto:

```js
const prisma = require('../../config/prisma');
```

Dependen de una **implementación concreta**, no de una abstracción. La consecuencia no es
teórica, se mide: **toda prueba unitaria tiene que interceptar el módulo**.

```js
jest.mock('../config/prisma', () => ({ terminoJudicial: { findFirst: jest.fn(), ... } }));
```

Ese `jest.mock` aparece en las 8 suites. Es frágil: cada vez que un controlador usa una tabla
nueva, hay que recordar añadirla al objeto simulado o la prueba falla con un error confuso.

---

## 3. Código limpio: duplicación medible

No es SOLID, pero pesa más en el día a día.

| Patrón repetido | Repeticiones | Dónde |
|---|---:|---|
| `tenant_id: req.tenant_id` en consultas | **91** | Los 12 controladores |
| `catch { res.status(500).json(...) }` | **58** | Los 12 controladores |
| `prisma.bitacoraAuditoria.create({...})` a mano | **16** | 6 controladores |
| `prisma.historialProceso.create({...})` a mano | **11** | 3 controladores |
| Comprobar que un expediente es del consultorio | **11** | 5 controladores |
| `toast.error(error.response?.data?.error \|\| ...)` | **17** | `ProcesoDetalle.jsx` |

### El caso más claro: la comprobación de pertenencia

Este bloque aparece **once veces**, prácticamente idéntico:

```js
const proceso = await prisma.proceso.findFirst({
  where: { id_proceso: id, tenant_id: req.tenant_id }
});
if (!proceso) return res.status(404).json({ error: 'Expediente no encontrado' });
```

Once copias significan once sitios donde alguien puede olvidarlo. Y olvidarlo **no falla de
forma ruidosa: filtra datos entre consultorios en silencio**. Es la deuda de duplicación con
peor consecuencia de todo el código.

### El segundo: las escrituras de auditoría

Dieciséis bloques de 10 líneas repitiendo la misma estructura. Además conviven dos mecanismos
—`auditMiddleware` y escrituras manuales— sin un criterio escrito de cuándo usar cada uno.

---

## 4. Ausencia de linter en el backend

El frontend tiene ESLint (`eslint.config.js`); **el backend no tiene ninguno**. Nada impide hoy
que entre una variable sin usar, un `await` olvidado o un `console.log` de depuración.

De hecho hay rastros: `console.log` con el código 2FA y con la URL de verificación en
`auth.controller.js`. En desarrollo son útiles; en producción escriben datos sensibles en los
logs del contenedor.

---

## 5. Lo que está bien y no conviene tocar

Para que la lectura sea justa:

- **Nombres claros y en español.** `gestionarTermino`, `getAlertasVencimientos`,
  `autoArchivePastHearings` se entienden sin abrir el cuerpo.
- **Organización por dominio.** `src/modules/<dominio>/` es mejor decisión que la estructura
  clásica por tipo de archivo. Se mantiene.
- **Transacciones bien usadas.** `prisma.$transaction` está donde debe: registro, términos,
  audiencias, borrado de expediente.
- **Middlewares con responsabilidad única.** `auth`, `roles` y `audit` hacen una cosa cada uno.
  Son la parte más limpia del backend.
- **Reglas de negocio correctas.** RN03, RN05, RN07 y RN08 están bien implementadas y probadas.
  Están mal *ubicadas*, no mal *escritas*.

---

## 6. Qué hacer, y en qué orden

> **La regla que ordena todo esto:** no se refactoriza sin red. Con 21 pruebas unitarias,
> mover 3 000 líneas es apostar. Cada paso de abajo empieza por asegurar el comportamiento
> actual y solo después cambia la forma.

### Paso 0 — Antes de tocar nada · 1 día

Subir la cobertura de lo que se va a mover. Como mínimo:

- Aislamiento entre consultorios como prueba **unitaria** (hoy solo existe de extremo a extremo).
- `createTermino`: recordatorios por defecto y destinatarios de las notificaciones.
- `getStats`: los cuatro rangos de fecha.

**Sin este paso, los siguientes son peligrosos.**

### Paso 1 — Duplicación de bajo riesgo · medio día · 🟢

Extraer dos ayudantes. No cambian comportamiento y eliminan 27 repeticiones:

```js
// src/utils/pertenencia.js
const buscarProcesoDelTenant = (id_proceso, tenant_id) =>
  prisma.proceso.findFirst({ where: { id_proceso, tenant_id } });

// src/utils/auditoria.js
const registrarAuditoria = (tx, { req, accion, modulo, detalle }) =>
  tx.bitacoraAuditoria.create({ data: {
    tenant_id: req.tenant_id, id_usuario: req.user.id_usuario,
    accion, modulo, detalle, ip_adress: req.ip || '127.0.0.1'
  }});
```

Es el cambio con mejor relación beneficio/riesgo del documento: reduce la superficie donde se
puede olvidar el filtro por consultorio.

### Paso 2 — Partir `ProcesoDetalle.jsx` · 2 días · 🟡

**El de mayor impacto.** Las 5 pestañas ya son bloques JSX separados, así que la división es
casi mecánica:

```
pages/procesos/ProcesoDetalle/
├── index.jsx                    ← orquestador: ~250 líneas
├── PestanaGeneral.jsx
├── PestanaActuaciones.jsx
├── PestanaDocumentos.jsx
├── PestanaAgenda.jsx
├── PestanaTerminos.jsx
├── modales/                     ← los 14 modales
└── hooks/
    ├── useActuaciones.js        ← estado + carga + handlers
    ├── useTerminos.js
    └── useDocumentos.js
```

Los *hooks* absorben los 76 `useState`: cada uno se lleva los suyos. **No se toca ni una clase
de Tailwind**, así que el diseño queda idéntico — la misma restricción que se respetó en la
españolización.

### Paso 3 — Capa de servicios en el backend · 3–4 días · 🔴

Sacar las reglas de negocio del controlador:

```
src/modules/terminos/
├── terminos.routes.js
├── terminos.controller.js    ← solo HTTP: leer req, llamar, responder
└── terminos.service.js       ← reglas: recordatorios, destinatarios, RN07
```

Esto **revisa [ADR-005](11-DECISIONES-ARQUITECTONICAS.md)**, que decidió no hacerlo. Aquella
decisión sigue siendo correcta *hoy*; este documento define cuándo dejará de serlo: cuando
haya cobertura suficiente, o cuando haga falta ejecutar una regla desde el cron o un script.

### Paso 4 — ESLint en el backend · 2 horas · 🟢

Configuración mínima que atrape lo que hoy nadie atrapa:

```js
rules: {
  'no-unused-vars': 'error',
  'no-console': ['warn', { allow: ['error'] }],
  'require-await': 'error',
  'max-lines-per-function': ['warn', 200]   // bajar a 80 tras el Paso 3
}
```

El umbral empieza alto **a propósito**: un linter que marca 300 avisos el primer día se acaba
desactivando. Se baja a medida que se refactoriza.

### Lo que NO conviene hacer

| Tentación | Por qué no |
|---|---|
| Reescribir todo con clases e interfaces | JavaScript no lo necesita y multiplica el código sin reducir la complejidad real |
| Introducir inyección de dependencias con un contenedor | Sobreingeniería para 12 módulos. Basta con pasar `prisma` como parámetro donde estorbe |
| Refactorizar y añadir funcionalidad en el mismo commit | Hace imposible saber qué rompió qué |
| Aplicar los cinco principios SOLID a la fuerza | Liskov y segregación de interfaces no aplican aquí. Fingir que sí es teatro |

---

## 7. Resumen

| Principio | Estado | Comentario |
|---|:--:|---|
| **S** — Responsabilidad única | ❌ | El problema principal, en ambos lados |
| **O** — Abierto/cerrado | 🟡 | Andamiaje repetido; molesto, no grave |
| **L** — Liskov | ➖ | No aplica: no hay herencia |
| **I** — Segregación de interfaces | ➖ | No aplica: no hay interfaces |
| **D** — Inversión de dependencias | ❌ | 12/12 controladores atados a Prisma |

**Esfuerzo total del plan:** 6–8 días, de los cuales el primero es escribir pruebas.

**Si solo hubiera tiempo para una cosa:** el Paso 1. Media jornada, riesgo casi nulo, y reduce
el número de sitios donde se puede olvidar el filtro por consultorio — que es el error con peor
consecuencia posible en un sistema multi-consultorio.
