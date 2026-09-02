# 14 — Auditoría de defectos y refactorización

**Fecha:** 2 de septiembre de 2026
**Alcance:** búsqueda de defectos en la plataforma, reparto de `ProcesoDetalle.jsx` y
suspensión de consultorios.
**Estado:** aplicado y verificado. D-01 a D-08 están en `main` y desplegados; D-09 quedó
listo después y se despliega aparte.

> **Método.** Ningún defecto de este documento se afirma por lectura del código. Cada uno se
> reprodujo contra la base de datos real antes de tocar nada, y se volvió a comprobar después.
> Los dos guiones que lo hacen quedan en el repositorio:
>
> ```bash
> npm --prefix backend run defectos   # demuestra que el defecto existe
> npm --prefix backend run arreglos   # comprueba que ya no
> ```
>
> Ambos se niegan a ejecutarse si `DATABASE_URL` no apunta a una base local.

---

## 1. Defectos encontrados

| ID | Defecto | Gravedad | Estado |
|---|---|:--:|:--:|
| D-01 | Borrar un expediente con actuaciones falla con 500 | Alta | Corregido |
| D-02 | Modificar un expediente ajeno devolvía 500 en vez de 404 | Media | Corregido |
| D-04 | El radicado era único en todo el sistema, no por consultorio | Alta | Corregido |
| D-05 | Una persona no podía ser cliente de dos consultorios | Alta | Corregido |
| D-06 | `updateCliente` permitía mudar un cliente a otro consultorio | **Alta, seguridad** | Corregido |
| D-07 | El código 2FA y el enlace de verificación se escribían en los registros | **Alta, seguridad** | Corregido |
| D-08 | Ocho bloques `catch` descartaban el error sin dejar rastro | Media | Corregido |
| D-09 | Suspender un consultorio no impedía que sus usuarios entraran | Alta | Corregido |
| D-10 | Las opciones de los 29 desplegables eran ilegibles | Alta (uso) | Corregido |
| D-11 | La bitácora escribía rutas de la API en vez de lenguaje llano | Media | Corregido |
| D-12 | El logo del consultorio se subía pero no se mostraba en ninguna parte | Media | Corregido |
| D-13 | El icono del navegador era el logotipo de otra herramienta | Baja | Corregido |
| D-14 | El desplegable de abogado responsable ofrecía a colaboradores y clientes | Media | Corregido |
| D-15 | La exportación a CSV omitía los clientes sin expedientes y no escapaba comillas | Media | Corregido |
| D-16 | El panel principal encadenaba tres tandas de peticiones | Media (rendimiento) | Corregido |

### D-15 · La exportación a CSV no mostraba los clientes

El síntoma: *«en esta cuenta hay creado un cliente, le di a exportar y no me mostró nada»*.

La causa es que la consulta **partía del expediente**, no del cliente:

```js
const procesos = await prisma.proceso.findMany({ where: { tenant_id, create_at: { gte, lte } } });
```

Un consultorio con clientes dados de alta pero sin procesos abiertos se descargaba un archivo
con solo la cabecera. Y era correcto según el código: no había expedientes que listar.

**Segundo defecto, latente, encontrado al reescribirlo.** El archivo se componía interpolando
sin escapar:

```js
csv += `"${p.numero_radicado}";"${p.cliente.nombre}";…`
```

Un cliente llamado `Gómez; Herrera y "Asociados"` **rompía la estructura del archivo** y
descuadraba todas las columnas siguientes. La convención (RFC 4180) es duplicar las comillas
internas. Comprobado: con el nombre anterior las tres filas mantienen sus 10 columnas.

**Forma acordada antes de escribirlo:**

1. **Una fila por expediente**, no por cliente. Un cliente con dos procesos ocupa dos filas
   repitiendo su nombre. Es lo que permite ordenar, filtrar y hacer tablas dinámicas en Excel;
   meter los dos procesos en una celda convertiría el CSV en algo que ya no se puede procesar.
2. **Los clientes sin expedientes aparecen**, marcados `SIN EXPEDIENTES` y con las columnas de
   proceso vacías.
3. **El informe cubre el periodo elegido**: entra el cliente que abrió algún expediente en el
   rango, y también el que se dio de alta en el rango aunque aún no tenga ninguno. Sin la
   segunda condición, un consultorio con años de historia que exporta «este mes» recibiría
   cientos de filas antiguas sin relación con el periodo.

Columnas: `# · Cliente · Documento · Radicado · Abogado responsable · Tipo de proceso · Estado ·
Plazos pendientes · Audiencias · Fecha de creación`.

La construcción del archivo vive en `src/modules/reportes/exportacion.js`, fuera del controlador:
armar el CSV es una regla de negocio, no manejo de HTTP, y así se prueba sin simular `req` y
`res`. **12 casos** en `src/tests/exportacion_csv.test.js`.

### D-16 · El panel tardaba porque encadenaba tres tandas de peticiones

Se reportó que cambiar de módulo tardaba de 1 a 3 segundos con la plataforma **vacía**. La
hipótesis previa —que faltaban índices en la base de datos— **resultó ser falsa**, y por eso se
midió antes de tocar nada.

**Medición 1 — el servidor.** Cinco pasadas por endpoint, sin red de por medio:

| Endpoint | Media |
|---|---:|
| `/api/clientes` | 10 ms |
| `/api/procesos` | 10 ms |
| `/api/notificaciones` | 5 ms |
| `/api/reportes/stats` | 17 ms |
| `/api/admin/auditoria` | 10 ms |

La base de datos no tenía nada que ver.

**Medición 2 — la red.** Contra el VPS, un endpoint que devuelve **401 sin tocar la base**:

```
dns=0,20s  conexion=0,49s  tls=1,01s  primer_byte=1,36s
```

Es decir, ~350 ms por viaje de ida y vuelta, y ~1 s para establecer la conexión la primera vez.

**Medición 3 — el navegador.** El panel lanzaba **8 peticiones en tres tandas**:

| Tanda | Empieza | Endpoints |
|---|---:|---|
| 1ª | 0–16 ms | clientes, procesos, audiencias, términos, notificaciones, tenant |
| 2ª | **81 ms** | `admin/auditoria` |
| 3ª | **234 ms** | `reportes/stats` |

Las dos últimas iban con `await` sueltos después del `Promise.all`, **sin necesitar el resultado
de las anteriores**. En local no se notaba (10 ms por viaje); contra el VPS, tres tandas ≈ 1 s de
pantalla en blanco cada vez que se abría el panel.

**Arreglo.** Las 8 salen en un único `Promise.all`. Medido después: **todas arrancan entre 0 y
1 ms**, y la ventana total bajó de 262 ms a 78 ms en local. Contra el VPS, de tres viajes a uno.

> **Dos avisos sobre medir en desarrollo**, que estuvieron a punto de desviar el diagnóstico:
> `StrictMode` duplica cada efecto y en la compilación de producción no lo hace; y en desarrollo
> la API es de otro origen, así que cada petición lleva un `OPTIONS` de CORS que en producción no
> existe (allí es `/sistema-juridico/api`, mismo origen). Ambos inflan las cifras locales.

> **De D-10 a D-16, siete defectos, los encontró el usuario usando la plataforma en
> producción**, no una revisión de código. Vale la pena anotarlo: ninguna de las auditorías
> anteriores los detectó, porque todas miraban el código o la documentación y ninguna se sentó
> a trabajar con la aplicación. Es el argumento más fuerte de todo este documento a favor de
> probar el producto terminado, y no solo sus piezas.

### D-10 · Las opciones de los desplegables eran invisibles

El síntoma que se reportó: *«la lista está en blanco; paso el ratón por encima y ahí sí me deja
ver cuáles hay»*. Y no era un desplegable, eran **los 29** de la plataforma.

La causa no está en la aplicación. La lista que se abre al pulsar un `<select>` **la dibuja el
sistema operativo**, no la página, y la pinta con fondo blanco. Como los desplegables heredan el
texto claro del tema oscuro, el resultado era **texto blanco sobre fondo blanco**. Solo se leía
la fila resaltada bajo el cursor, porque esa sí la pinta el sistema con su propio color.

**Arreglo.** Una regla de CSS global en `index.css`, no una clase repetida en 29 sitios:

```css
select option { background-color: #171717; color: #fafafa; }
```

Verificado sobre el estilo calculado, no de vista: fondo `rgb(23,23,23)` y texto
`rgb(250,250,250)`.

### D-11 · La bitácora hablaba en lenguaje de desarrollador

El detalle de cada registro decía literalmente:

```
Acción CREAR realizada en /api/clientes
```

El middleware componía el texto con `req.originalUrl`. A un abogado administrando su consultorio
eso no le dice nada, y la bitácora existe precisamente para que él pueda auditar quién hizo qué.

**Arreglo.** El middleware envuelve `res.json` para quedarse con la respuesta del controlador
—que trae la entidad ya guardada— y redacta la frase a partir del patrón de ruta, no de la URL.
Ahora dice:

```
Registró el cliente María Fernanda Rojas
Creó el expediente con radicado 41001310300120260014500
Registró a Pedro Gómez como demandado en el expediente
Cambió el estado del expediente a archivado
```

Distinguir el patrón importa: `POST /api/procesos/:id/partes` es *«registró una parte
procesal»*, no *«creó un expediente»*, aunque ambas empiecen igual.

> **Los registros antiguos NO se reescriben.** Una bitácora de auditoría no debe poder
> modificarse (RNF03), así que los que ya existen conservan su texto técnico. Solo mejoran los
> nuevos.

**Vigilancia.** `src/tests/auditoria_detalle.test.js`, 16 casos. Entre ellos uno que recorre
varias rutas y **exige que ningún detalle vuelva a contener `/api/`**.

### D-12 · El logo del consultorio no iba a ninguna parte

`logo_url` solo se usaba **dentro de la propia pantalla de Ajustes**, para mostrar la vista
previa de lo que acababas de subir. No aparecía en ningún otro lugar de la plataforma.

**Arreglo.** Se muestra en la barra superior, junto al nombre del consultorio: *«Espacio de
trabajo · Consultorio Jurídico Demo»*. Si no hay logo, queda exactamente como antes. Si la
imagen ya no está disponible en el almacenamiento, se oculta y vuelve la balanza: nunca un icono
roto.

### D-13 · El icono del navegador era de otra herramienta

`public/favicon.svg` no era el logotipo de la plataforma sino una figura morada (`#863bff`)
heredada del andamiaje inicial del proyecto. Sustituido por una balanza en el dorado de la marca
(`#DFB971`) sobre fondo oscuro.

### D-14 · El abogado responsable podía ser la asistente

El desplegable pintaba la lista completa de `/admin/usuarios` sin filtrar, así que ofrecía como
responsable del caso a colaboradores (`ASISTENTE`) y a clientes con acceso al portal. Un
asistente no puede responder de un caso ante un juzgado.

**Arreglo.** `soloAbogadosResponsables()` en `lib/utils.js`, usada en los dos sitios donde se
abre un expediente. Además el rol se muestra con su nombre legible (*Administrador*, no
*ADMINISTRADOR*), siguiendo [ADR-004](11-DECISIONES-ARQUITECTONICAS.md).

> **Sigue pendiente, y es distinto:** un expediente admite un solo abogado responsable
> (`id_abogado_resp`). Para varios abogados existe la tabla `ProcesoAbogado` y se gestionan
> desde *Equipo de trabajo* en el detalle del expediente. Lo que falta es poder añadirlos ya
> desde el formulario de creación.

### D-09 · `Tenant.activo` era un interruptor sin conectar

Salió al preguntar cómo se desactiva un consultorio que no ha pagado la suscripción. El modelo
tiene el campo desde el principio:

```prisma
model Tenant {
  activo  Boolean  @default(true)
}
```

Pero **no se comprobaba en ningún sitio**. El login validaba `user.activo` y el middleware de
autenticación también, y ninguno de los dos miraba el consultorio. Consecuencia: marcar un
consultorio como inactivo no tenía **ningún efecto**. Sus abogados seguían entrando, creando
expedientes y subiendo documentos con total normalidad.

Es la peor clase de defecto: un campo que cualquiera daría por hecho que sirve para suspender
una oficina, y que no sirve. Nada avisa de que la suspensión no funciona hasta que alguien
confía en ella.

Reproducido con un consultorio `activo: false` y un usuario suyo activo:

```
REPRODUCIDO  D-09a  El middleware dejó pasar la petición pese a estar el consultorio inactivo.
REPRODUCIDO  D-09b  El login devolvió un token válido.
```

**Arreglo.** El middleware y el login incluyen ahora el consultorio en la consulta y responden
**403** con `consultorioSuspendido: true` si está inactivo. Dos decisiones de detalle:

- **La comprobación va después de validar la contraseña**, no antes. Si fuera antes, cualquiera
  podría averiguar qué oficinas están suspendidas probando correos ajenos.
- **El mensaje es distinto del de «cuenta inactiva»** a propósito: al abogado no le sirve
  *«verifica tu correo»* cuando el problema real es que su consultorio dejó de pagar.

**Vigilancia.** `src/tests/consultorio_suspendido.test.js` (6 casos) y las comprobaciones A-09
a A-09d, que verifican **las dos caras**: que el suspendido queda fuera y que el activo sigue
entrando. Un arreglo que bloqueara a todo el mundo también «pasaría» si solo se mirase la
primera.

> **Lo que esto NO resuelve.** Queda la palanca, no la maquinaria. `Tenant.plan`
> (`BASICO`/`PRO`) sigue sin leerse en ningún sitio, y **no existe ni un solo campo de
> suscripción**: ni fecha de pago, ni de vencimiento, ni estado, ni historial. Suspender sigue
> siendo un `UPDATE` manual. La administración de la plataforma es un área de negocio nueva que
> ninguno de los 59 requisitos documentados menciona.

### D-01 · El borrado definitivo no contemplaba las actuaciones

**Este defecto lo introduje yo** al añadir la entidad Actuación: la transacción en cascada de
`deleteProcesoDefinitivo` borra abogados, partes, audiencias, términos, documentos e historial,
pero no las actuaciones. Y su clave foránea es `ON DELETE RESTRICT`:

```sql
ALTER TABLE "actuaciones" ADD CONSTRAINT "actuaciones_id_proceso_fkey"
  FOREIGN KEY ("id_proceso") REFERENCES "procesos"("id_proceso") ON DELETE RESTRICT;
```

Resultado: en cuanto un expediente tenía **una sola actuación**, el administrador no podía
eliminarlo. Recibía un 500 genérico, sin pista de la causa.

**Arreglo.** Una línea en la transacción, colocada después del borrado de términos (que apuntan a
la actuación de la que nacen) y antes del borrado del expediente.

**Vigilancia.** `src/tests/eliminacion_expediente.test.js` ahora afirma que
`tx.actuacion.deleteMany` se llama. Si alguien quita la línea, la prueba falla.

### D-04 y D-05 · Unicidad global en un sistema multi-consultorio

> **No son hallazgos nuevos.** Ya estaban documentados como **H-19** en
> [00-AUDITORIA-DE-COHERENCIA.md](00-AUDITORIA-DE-COHERENCIA.md) y como riesgo nº 1 en
> [02-MODELO-DE-DATOS.md § 8](02-MODELO-DE-DATOS.md). Lo que faltaba era corregirlos, y eso es
> lo que se hizo hoy. Se reprodujeron primero para confirmar que seguían vivos.

`Proceso.numero_radicado` y `Cliente.numero_documento` estaban declarados `@unique`, es decir,
únicos en **toda la base**, compartida por todos los consultorios. Dos consecuencias:

1. **Impedía el uso legítimo.** En un proceso judicial la contraparte litiga con **el mismo
   radicado** desde otra oficina. Si un consultorio registraba el caso, el de la contraparte
   ya no podía. Lo mismo con una persona que es cliente de dos despachos.
2. **Filtraba información.** El mensaje *«El número de radicado ya existe en el sistema»*
   revelaba que otro consultorio lleva ese caso, que es justo lo que la separación por
   `tenant_id` debe impedir.

**Arreglo.** Migración `20260902090623_unicidad_por_consultorio`, que cambia el índice único
simple por uno compuesto con el consultorio. Es una **relajación** de la restricción, de modo
que ningún dato existente puede violarla:

```sql
DROP INDEX "procesos_numero_radicado_key";
CREATE UNIQUE INDEX "procesos_tenant_id_numero_radicado_key" ON "procesos"("tenant_id", "numero_radicado");
```

Los controladores pasaron de `findUnique({ numero_radicado })` a
`findFirst({ numero_radicado, tenant_id })`, y el mensaje ahora dice *«Su consultorio ya
tiene…»*, sin hablar de los demás.

> **Duplicar dentro del mismo consultorio sigue prohibido.** Es lo que comprueban A-04b y A-05b.

### D-06 · Asignación masiva: se podía mudar un cliente de consultorio

El más grave. `updateCliente` volcaba el cuerpo entero de la petición en Prisma:

```js
const updateData = req.body;
await prisma.cliente.update({ where: { id_cliente: id, tenant_id: req.tenant_id }, data: updateData });
```

El `where` estaba bien acotado, y por eso el defecto pasaba desapercibido: **el filtro protege
qué fila se toca, no qué columnas se escriben**. Bastaba enviar

```json
{ "nombre": "X", "tenant_id": "<identificador de otro consultorio>" }
```

para que el cliente desapareciera del consultorio propio y apareciera en el ajeno. Reproducido:
*«El cliente quedó registrado en el consultorio ajeno.»* También eran reescribibles `id_usuario`
y `create_at`.

**Arreglo.** Lista explícita de campos editables; todo lo demás se descarta. Además, el `P2025`
de Prisma se traduce ahora a un 404 en lugar de a un 500.

### D-07 · Datos sensibles en los registros del contenedor

`auth.controller.js` imprimía sin condición el **código de doble factor** y el **enlace de
verificación de cuenta**. En producción eso acaba en `docker compose logs backend`: cualquiera
con acceso a los registros podía completar el segundo factor de otra persona o activar una
cuenta ajena. Ahora ambos bloques van dentro de `if (process.env.NODE_ENV !== 'production')`.

---

## 2. Lo que se buscó y **no** resultó ser un defecto

Para que la lectura sea justa, y porque saber dónde no hay que mirar también vale:

- **El módulo de actuaciones** filtra por consultorio en las cuatro operaciones. Sin hallazgos.
- **`cambiarEstadoProceso`** actualiza sin `tenant_id`, pero un `findFirst` previo con
  consultorio ya devolvió 404. Está protegido; solo es incoherente con el resto.
- **`verificar2FA`** no permite entrar con el código a null: el control de caducidad lo ataja.
- **El bloqueo por intentos fallidos** (1, 5, 15, 30, 60 minutos) funciona como está descrito.
- **`Usuario.email` sigue siendo único global, y debe serlo:** el inicio de sesión es por correo
  y tiene que resolver a una única persona.

---

## 3. Reparto de `ProcesoDetalle.jsx`

El archivo concentraba el 36 % del frontend. Era el Paso 2 de
[13-CALIDAD-DE-CODIGO.md](13-CALIDAD-DE-CODIGO.md).

| Métrica | Antes | Después |
|---|---:|---:|
| Líneas de `ProcesoDetalle.jsx` | 3 094 | **2 522** |
| `useState` en el componente | 76 | **8** |
| Archivos | 1 | 7 |
| Errores de ESLint en el archivo | 4 | **0** |

```
pages/procesos/
├── ProcesoDetalle.jsx        ← orquesta: expediente, pestaña activa, edición general
└── detalle/
    ├── useActuaciones.js     ← 121 líneas
    ├── useDocumentos.js      ← 222
    ├── useAudiencias.js      ← 138
    ├── useTerminos.js        ← 151
    ├── useEquipoYPartes.js   ← 198
    └── terminos.utils.js     ←  76  (funciones puras: semáforo, cuenta atrás, tamaños)
```

### La decisión que hizo esto seguro

**El frontend no tiene ni una prueba.** Con cero red, mover 3 000 líneas es apostar. La
técnica que lo redujo a algo razonable fue esta: **cada hook devuelve exactamente los mismos
nombres de variable que tenían dentro del componente**. Así, las ~2 300 líneas de JSX de las
pestañas y los 14 modales **no se tocaron ni un carácter**, y el diseño no puede haber cambiado.
Se movió estado y lógica; no se reescribió interfaz.

### Cómo se comprobó

Compilar no demuestra que funcione, así que se levantó la aplicación y se recorrió:

- Las **cinco pestañas** cargan sus datos. Cero errores en consola.
- El **semáforo de términos** (1 vencido / 0 próximos / 0 al día) y el texto «Vencido 🚨» salen
  correctos: son las funciones puras extraídas.
- El **selector «actuación que origina el término»**, dentro del modal de términos, aparece
  poblado con la lista de `useActuaciones`. Es la prueba de que los hooks componen bien entre sí.
- El modal de **corregir actuación** abre precargado con fecha 20/06/2026, tipo y anotación; se
  guardó y el camino completo funcionó: aviso, cierre del modal y recarga de la lista.

Queda dicho con claridad: **esto es verificación manual, no una suite**. Escribir pruebas de
frontend sigue pendiente y es el trabajo que más reduciría el riesgo de aquí en adelante.

### Un defecto latente corregido de paso

El efecto que carga los datos de cada pestaña dependía solo de `activeTab`. Al pasar de un
expediente a otro sin cambiar de pestaña, se seguían mostrando los documentos, audiencias y
términos del anterior. Ahora depende de `[activeTab, id]`.

---

## 4. Linter del backend

El backend no tenía ninguno; el frontend sí. Es lo que permitió que D-07 y ocho `catch` mudos
llegaran hasta aquí.

| | Primer pase | Ahora |
|---|---:|---:|
| Errores | 18 | **0** |
| Avisos | 17 | 4 |

Los 4 avisos que quedan son `async` sin `await` en middlewares de Express, que es idiomático;
por eso `require-await` está como aviso y no como error. Los umbrales de `eslint.config.js`
empiezan tolerantes **a propósito**: un linter que marca trescientos avisos el primer día acaba
desactivado. Se aprietan según avance el Paso 3 del documento 13.

```bash
npm --prefix backend run lint
```

---

## 5. Estado de las pruebas

| | Antes | Ahora |
|---|---:|---:|
| Suites | 8 | **12** |
| Casos | 21 | **61** |

La suite nueva, `src/tests/aislamiento_consultorio.test.js`, fija como prueba unitaria lo que
antes solo se comprobaba de extremo a extremo con la base levantada: que el radicado y el
documento se buscan dentro del consultorio, que `updateCliente` descarta `tenant_id` e
`id_usuario`, y que modificar un expediente ajeno da 404.

Es la clase de error que **no falla de forma ruidosa**: filtra datos en silencio. Por eso
merece prueba propia.

---

## 6. Lo que sigue pendiente

Por orden de lo que más reduce riesgo:

1. **Pruebas de frontend.** Hoy son cero. Es el mayor hueco que queda.
2. **Paso 1 del documento 13:** extraer `buscarProcesoDelTenant` y `registrarAuditoria`. Las
   comprobaciones de pertenencia siguen repetidas en varios controladores, y cada copia es un
   sitio donde alguien puede olvidarla.
3. **Paso 3:** sacar las reglas de negocio de los controladores a una capa de servicios.
4. Los otros archivos grandes del frontend: `ProcesosList.jsx` (660) y `AjustesPage.jsx` (574).
   Ninguno es urgente; el que dolía era el de 3 000.
