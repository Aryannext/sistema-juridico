# 14 — Auditoría de defectos y refactorización

**Fecha:** 2 de septiembre de 2026
**Alcance:** búsqueda de defectos en la plataforma y reparto de `ProcesoDetalle.jsx`.
**Estado:** todo aplicado en el árbol de trabajo y verificado. **Nada subido al repositorio.**

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
| Suites | 8 | **9** |
| Casos | 21 | **27** |

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
