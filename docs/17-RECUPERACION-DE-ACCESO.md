# 17 — Recuperación de acceso

**Fecha:** 2 de septiembre de 2026
**Cierra:** RF54 (reenvío de verificación), HU-01 (recuperar contraseña) y la parte de servidor
de RNF02 (política de contraseñas).

---

## 1. El problema que resuelve

Hasta ahora, **un correo perdido dejaba a una persona bloqueada sin salida**.

Se registraba, el mensaje de verificación caía en spam y lo borraba sin verlo. A partir de ahí:
no podía activar su cuenta, no podía pedir otro correo —esa ruta no existía— y no podía
recuperar su contraseña —tampoco existía—. Reintentar el registro era imposible: el sistema
respondía *«El correo ya está registrado»*.

La única salida era que alguien con acceso al servidor ejecutara esto, uno por uno:

```sql
UPDATE usuario SET activo = true, token_verificacion = NULL WHERE email = '...';
```

Con un consultorio de cinco abogados y dos correos en spam, son dos consultas manuales. Con
veinte consultorios, es un trabajo diario.

> El problema estaba señalado desde la primera auditoría, pero se veía como una carencia menor.
> Lo que lo puso en su sitio fue tropezar con el correo de verdad: al cambiar de proveedor y
> quedarse el envío bloqueado, se hizo evidente que **la fragilidad no era el spam, sino no
> tener plan B cuando un mensaje no llega**.

---

## 2. Los tres flujos

### Reenviar el correo de verificación — RF54

`POST /api/auth/reenviar-verificacion` · cuerpo `{ email }`

Se ofrece **en la misma pantalla del enlace caducado**, que es donde el usuario descubre el
problema. Antes ese texto decía *«intenta registrarte de nuevo»*, algo que no podía hacer.

Cada reenvío genera un **token nuevo** con 24 horas de vigencia. Reutilizar el anterior
alargaría la vida de un enlace que quizá lleva semanas circulando por un buzón.

### Recuperar la contraseña — HU-01

`POST /api/auth/recuperar` · cuerpo `{ email }`

El enlace **«¿Olvidaste tu contraseña?»** del login vuelve a estar visible. Estaba comentado en
el código con una nota que decía *«se restablece cuando existan los endpoints»*: apuntaba a `#`
y no hacía nada, y mostrarlo solo hacía más evidente que no funcionaba.

No se envía enlace a una cuenta **sin verificar** —primero hay que activarla, o esto serviría
para saltarse la verificación del correo— ni a un consultorio **suspendido**, o serviría para
recuperar el acceso a algo deliberadamente cerrado.

### Fijar la contraseña nueva

`POST /api/auth/restablecer` · cuerpo `{ token, password }`

- El enlace vive **una hora** y es de **un solo uso**: el token se borra al aplicarlo.
- Se **desbloquea** al usuario. Quien olvida su contraseña suele haberse bloqueado a sí mismo
  probando la que no recordaba; sería absurdo dejarlo fuera justo después de recuperarla.
- Queda en la bitácora como `RESTABLECER_CONTRASENA` (RNF03): es un cambio de credenciales y
  tiene que ser rastreable.

---

## 3. La decisión que gobierna estas pantallas

**Nunca se revela si un correo está registrado.** Las tres rutas responden exactamente lo mismo
exista o no la cuenta:

> Si el correo corresponde a una cuenta registrada, recibirás un mensaje en unos minutos.

Si la respuesta cambiara, cualquiera podría averiguar qué direcciones tienen cuenta probándolas
una a una. En un sistema jurídico eso además **revela quién trabaja con quién**, que es
información sensible por sí sola.

La discreción se mantiene hasta el final:

- Un fallo interno tampoco cambia la respuesta. Devolver un 500 delataría que el correo sí
  existe y que el error ocurrió al intentar enviarle algo.
- Un token inexistente y uno caducado dan **el mismo mensaje**. Quien tenga un enlace viejo no
  debe poder deducir si alguna vez fue válido.
- La interfaz respeta esa neutralidad en lugar de deshacerla con un mensaje más "útil".

---

## 4. Límite de envíos

`/reenviar-verificacion` y `/recuperar` tienen su propio limitador: **5 peticiones cada 15
minutos** por dirección IP.

No es una formalidad. Estas rutas **envían correo a una dirección que indica quien llama**: sin
límite, cualquiera podría escribir el correo de otra persona y repetir mil veces para inundarle
el buzón, con mensajes firmados por nosotros. Además de la molestia, eso quema la reputación del
remitente y acabaría mandando a spam el correo legítimo. El limitador general de la API —1000
peticiones cada 15 minutos— es inútil para esto.

---

## 5. Política de contraseñas, ahora también en el servidor

Antes solo la comprobaba el formulario del navegador. Una petición directa a
`POST /api/auth/registro` aceptaba la contraseña `"1"`.

```
Mínimo 8 caracteres, una mayúscula, una minúscula y un número.
```

Vive en `src/utils/password.js` y la aplican **registro** y **restablecimiento**. Está en un
solo sitio a propósito: tres copias serían tres sitios donde relajarla por descuido.

El mensaje enumera **todo lo que falta de una vez**:

> La contraseña debe tener al menos 8 caracteres, una letra mayúscula y una letra minúscula.

Decirlo de uno en uno obliga a reintentar varias veces para descubrir el conjunto de requisitos.
En la pantalla de restablecimiento, además, los requisitos se van marcando en verde mientras se
escribe: quien acaba de perder el acceso ya viene incómodo, y hacerle adivinar la regla a base
de intentos lo empeora.

---

## 6. Caducidad de los enlaces

| Enlace | Vigencia | Usos |
|---|---|---|
| Activación de cuenta | 24 horas (RF54) | Uno |
| Recuperación de contraseña | 1 hora | Uno |

Antes el de activación **no caducaba nunca**: un correo de hace un año seguía sirviendo.

> Un token de verificación **sin fecha** se sigue aceptando. Es el de las cuentas creadas antes
> de que existiera el campo, y rechazarlas las habría dejado a todas bloqueadas de golpe.

---

## 7. Comprobado

**15 pruebas** en `src/tests/recuperacion.test.js`, centradas en lo que se rompe sin hacer ruido:
que no se pueda enumerar correos, que el token se queme al usarlo y que caduque.

Y de extremo a extremo, contra la base de datos y el navegador:

| | |
|---|---|
| El registro rechaza `"1"` como contraseña | ✓ |
| Un correo registrado y otro inexistente dan la misma respuesta | ✓ |
| El token se guarda con su fecha de caducidad | ✓ |
| La pantalla marca los requisitos en verde según se escribe | ✓ |
| La contraseña nueva entra | ✓ |
| La antigua deja de servir | ✓ |
| El enlace no se puede reutilizar | ✓ |
| Queda en la bitácora con texto legible | ✓ |
| El enlace caducado ofrece pedir otro | ✓ |
