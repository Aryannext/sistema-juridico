# 15 — Administración de la plataforma

**Fecha:** 2 de septiembre de 2026
**Decisión de fondo:** [ADR-012](11-DECISIONES-ARQUITECTONICAS.md)

Gestión de los consultorios que usan el SGPA: darlos de alta, suspenderlos y darlos de baja
**sin entrar por SSH al servidor**.

---

## 1. Qué puede y qué no puede hacer

| Puede | No puede |
|---|---|
| Ver todos los consultorios, su estado, plan y fecha de alta | Abrir un expediente |
| Ver **cuántos** usuarios, clientes y expedientes tiene cada uno | Ver el nombre de un cliente o el radicado de un proceso |
| Suspender el acceso de un consultorio completo | Descargar un documento |
| Reactivarlo | Entrar como un usuario de un consultorio |
| Eliminarlo definitivamente | Crear administradores desde la web |

**No es una limitación de la pantalla, es de la sesión.** El token de plataforma lleva
`tipo: "PLATAFORMA"` y `auth.middleware.js` lo rechaza. Aunque alguien escribiera a mano una
petición contra `/api/procesos` con ese token, recibiría un 403.

---

## 2. Crear el primer administrador

Es la única vía. No hay pantalla de registro.

**En el VPS:**

```bash
docker compose exec backend node -r dotenv/config \
  scripts/crear-admin-plataforma.js "Tu Nombre" "correo@dominio" "TuContraseñaLarga2026!"
```

**En local:**

```bash
npm --prefix backend run crear-admin-plataforma -- "Tu Nombre" "correo@dominio" "TuContraseña"
```

La contraseña exige 12 caracteres, mayúscula, minúscula, número y símbolo. Es más estricto que
para un usuario normal a propósito: esta cuenta puede eliminar consultorios enteros.

Si el correo ya existe, **actualiza la contraseña** en lugar de fallar. Así el mismo comando
sirve para recuperar el acceso si se olvida.

---

## 3. Entrar

```
https://proyectosena.online/sistema-juridico/plataforma
```

Es una dirección distinta de la de los consultorios y **no hay ningún enlace entre las dos**,
para que nadie confunda las puertas. La sesión se guarda con otra clave en el navegador, así
que se puede tener abierta a la vez que la de un consultorio sin que se pisen.

---

## 4. Suspender por impago

Es el caso de uso que originó todo esto.

1. En la consola, botón de **prohibido** en la fila del consultorio.
2. Escribir el motivo. Es obligatorio y queda en la bitácora.
3. Confirmar.

**Efecto inmediato:** todos sus usuarios dejan de poder entrar. Los que tuvieran sesión abierta
reciben un 403 en su siguiente petición, con el mensaje *«El acceso de su consultorio está
suspendido. Contacte al administrador de la plataforma»*.

**No se borra nada.** Al reactivarlo, todo sigue donde estaba.

---

## 5. Dar de baja un consultorio

Cuando un consultorio dice que ya no quiere el servicio.

**Tres cerrojos, y ninguno es decorativo.** Esto borra expedientes judiciales; para un despacho,
perderlos puede tener consecuencias legales frente a sus propios clientes.

1. **Tiene que estar suspendido primero.** Obliga a que exista un periodo en el que ya no entra
   pero sus datos siguen ahí. Es el margen para rectificar si la baja fue un error o si el
   cliente se arrepiente. En la consola, el botón de eliminar **ni siquiera aparece** mientras
   el consultorio esté activo.
2. **Escribir su nombre exacto.** Evita eliminar el de la fila de al lado.
3. **Justificación de al menos 10 caracteres**, que queda en la bitácora de plataforma.

Se eliminan en cascada, en una sola transacción: usuarios, permisos, clientes, expedientes,
actuaciones, partes procesales, documentos y sus versiones, audiencias, términos, sus
recordatorios, notificaciones, historial y bitácora del consultorio.

> **Los archivos del almacenamiento externo NO se borran.** Los documentos viven en Cloudflare
> R2 y la transacción de la base de datos no los alcanza. La respuesta avisa de cuántos quedan
> para que se retiren aparte. Es una limitación conocida, no un olvido.

---

## 6. La bitácora sobrevive

`BitacoraPlataforma` es una tabla **aparte** de la auditoría de cada consultorio, y la razón es
concreta: la del consultorio se borra con él, así que ahí desaparecería el registro de quién lo
borró y por qué.

Por eso guarda el **nombre** del consultorio como texto, no como clave foránea: tiene que
seguir teniendo sentido cuando la fila del consultorio ya no exista.

---

## 7. Verificación

```bash
npm --prefix backend run verificar:plataforma
```

Crea un consultorio desechable **con datos en todas las tablas**, recorre el ciclo completo y lo
elimina. 16 comprobaciones:

| | |
|---|---|
| P-01, P-02 | Rechaza credenciales incorrectas, acepta las buenas |
| **P-03** | **El token de plataforma NO abre un consultorio** |
| **P-04** | **El token de consultorio NO administra la plataforma** |
| P-05 | El listado solo expone campos administrativos |
| P-06 | Incluye los recuentos necesarios para facturar |
| P-07, P-08 | Suspender exige justificación y funciona |
| **P-09** | **Los usuarios del consultorio suspendido dejan de entrar** |
| P-10, P-11, P-13 | Los tres cerrojos del borrado |
| P-12 | Al reactivar, sus usuarios vuelven a entrar |
| P-14, P-15 | Elimina y **no deja ninguna fila huérfana en once tablas** |
| P-16 | La bitácora sobrevive al consultorio borrado |

Se niega a ejecutarse si `DATABASE_URL` no apunta a una base local.

---

## 8. Lo que falta para un modelo de suscripción

Esto es **la palanca, no la maquinaria**. Con lo que hay hoy, suspender por impago es una acción
manual que alguien tiene que acordarse de hacer.

| Falta | Esfuerzo |
|---|---|
| Campos de suscripción en `Tenant`: estado, fecha de vencimiento, último pago | ~medio día |
| Vencimiento automático: aviso antes y suspensión al pasarse la fecha, sobre el cron que ya existe | ~medio día |
| Que `Tenant.plan` (`BASICO`/`PRO`) signifique algo: hoy no se lee en ningún sitio | a decidir |
| Pasarela de pago | fuera del alcance actual |
