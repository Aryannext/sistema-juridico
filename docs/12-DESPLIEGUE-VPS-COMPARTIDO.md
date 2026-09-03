# 12 — Despliegue en VPS compartido con Docker

**Problema que resuelve este documento.** El VPS está compartido con otro usuario. Cuando se
actualiza Node.js —o cualquier otra dependencia del sistema— para que funcione el SGPA, **la
aplicación del otro usuario se cae**, porque trabajaba con la versión anterior. Y al revés.
El PostgreSQL del servidor también es compartido.

La causa es que ambas aplicaciones comparten dependencias instaladas a nivel de sistema.
Mientras eso siga así, cada actualización es una apuesta.

**La solución adoptada:** meter el SGPA entero en contenedores —API **y** base de datos—.
Las versiones dejan de vivir en el VPS y pasan a vivir en archivos versionados del proyecto.
Actualizar Node se convierte en cambiar una línea y reconstruir; el resto del servidor ni se
entera.

> Decisión registrada en [ADR-011](11-DECISIONES-ARQUITECTONICAS.md).

---

## 1. Cómo queda el servidor

```mermaid
graph TB
    subgraph VPS["VPS compartido"]
        NG["Nginx del host<br/>:443 · <b>no se toca</b>"]

        subgraph OTRO["Del otro usuario — intacto"]
            O1["su Node, su versión"]
            O2["PostgreSQL del sistema"]
        end

        subgraph SGPA["SGPA — aislado en Docker"]
            EST["frontend/dist<br/>archivos estáticos"]
            CT["sgpa-backend<br/>Node 24 · 127.0.0.1:3005"]
            PG["sgpa-postgres<br/>volumen propio"]
        end
    end

    R2["Cloudflare R2"]

    U["Navegador"] -->|HTTPS| NG
    NG -->|"/sistema-juridico/"| EST
    NG -->|"/sistema-juridico/api → proxy"| CT
    NG --> O1
    CT --> PG
    CT --> R2
```

**Qué NO se toca del servidor:**

| Componente del host | Por qué se deja como está |
|---|---|
| **Nginx** | Sirve también a la otra aplicación. Sus bloques `location` del SGPA ya existen: solo se **ajusta el puerto** del `proxy_pass` |
| **PostgreSQL del sistema** | Lo comparte el otro usuario. Cambiar `pg_hba.conf` o `listen_addresses` y reiniciarlo le cortaría las conexiones. El SGPA usa su **propio** PostgreSQL en contenedor |
| **Node.js del sistema** | Ni se usa. El backend lleva el suyo dentro y el frontend se compila también en contenedor |

El único cambio a nivel de sistema es **instalar Docker**, una sola vez.

---

## 2. Archivos que componen el montaje

| Archivo | Para qué sirve |
|---|---|
| `docker-compose.yml` | Orquesta los tres servicios: base de datos, API y compilación del frontend |
| `.env.example` (raíz) | Variables que lee el compose: clave de la base y puerto del host |
| `backend/Dockerfile` | Imagen de la API. Fija la versión de Node y genera el cliente de Prisma |
| `frontend/Dockerfile` | Contenedor **de compilación**: produce `dist/` y termina |
| `backend/.dockerignore`, `frontend/.dockerignore` | Impiden que `node_modules` y los `.env` entren en las imágenes |

---

## 3. Preparación (una sola vez)

### 3.1 Instalar Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
```

Cierra la sesión SSH y vuelve a entrar para que el grupo tenga efecto. Comprueba:

```bash
docker --version && docker compose version
```

> **Cortesía con el otro usuario:** instalar Docker no altera su aplicación —no toca su Node,
> su PostgreSQL ni su Nginx—, pero es un cambio a nivel de sistema. Conviene avisarle.

### 3.2 Traer el código

Si el repositorio ya está clonado en esa ruta:

```bash
cd /home/cristian/proyectos/proyectosena.online/sistema-juridico
git fetch origin
git checkout docs/reconstruccion-y-actuaciones     # o main, tras fusionar
git pull
```

Si todavía no lo está:

```bash
git clone https://github.com/Aryannext/sistema-juridico.git \
          /home/cristian/proyectos/proyectosena.online/sistema-juridico
cd /home/cristian/proyectos/proyectosena.online/sistema-juridico
git checkout docs/reconstruccion-y-actuaciones
```

> **Ojo con la ruta.** `/home/cristian/proyectos/proyectosena.online` es la **raíz del dominio**,
> y aloja varios proyectos (`sistema-juridico/`, `costura/`…). El repositorio va en la
> subcarpeta `sistema-juridico/`, que es donde el Nginx ya apunta.

### 3.3 y 3.4 — Generar los dos archivos `.env`

La clave de PostgreSQL tiene que ser **idéntica** en los dos archivos: en el de la raíz la lee
el contenedor de la base, y en el del backend forma parte de la cadena de conexión. Escribirla
a mano dos veces es la primera fuente de errores, así que conviene generarla una sola vez:

```bash
cd /home/cristian/proyectos/proyectosena.online/sistema-juridico

# Una sola clave, sin / + = para que no rompa la URL de conexión
CLAVE_BD=$(openssl rand -base64 48 | tr -d '/+=' | head -c 32)

# ── .env de la raíz (lo lee docker compose) ──
cp .env.example .env
sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$CLAVE_BD|" .env

# ── .env del backend (lo lee la aplicación) ──
cp backend/.env.example backend/.env
sed -i "s|^DATABASE_URL=.*|DATABASE_URL=\"postgresql://sgpa:$CLAVE_BD@postgres:5432/sgpa?schema=public\"|" backend/.env
sed -i "s|^DIRECT_URL=.*|DIRECT_URL=\"postgresql://sgpa:$CLAVE_BD@postgres:5432/sgpa?schema=public\"|" backend/.env
sed -i "s|^JWT_SECRET=.*|JWT_SECRET=\"$(openssl rand -hex 32)\"|" backend/.env
sed -i "s|^NODE_ENV=.*|NODE_ENV=\"production\"|" backend/.env
sed -i "s|^DEV_AUTO_VERIFY=.*|DEV_AUTO_VERIFY=\"false\"|" backend/.env
sed -i "s|^FRONTEND_URL=.*|FRONTEND_URL=\"https://proyectosena.online/sistema-juridico\"|" backend/.env
```

Eso deja resueltas la base de datos, el JWT y las rutas. **Faltan las credenciales de servicios
externos**, que hay que copiar del entorno anterior:

```bash
nano backend/.env
```

| Variable | De dónde sale |
|---|---|
| `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | Panel de Cloudflare R2 |
| `R2_BUCKET_NAME` | **Sin esta no se sube ni un documento** |
| `R2_PUBLIC_DOMAIN`, `R2_ACCOUNT_ID` | Opcionales, para la URL del logo |
| `GMAIL_USER`, `GMAIL_PASS` | Contraseña de aplicación de Gmail, 16 caracteres |

`SGPA_PUERTO` ya viene en **3005** en el `.env.example`: en este VPS el 3001 lo ocupa otro
servicio (`ss -tlnp` muestra los puertos en uso).

Comprobar que la clave quedó igual en los dos archivos:

```bash
grep POSTGRES_PASSWORD .env
grep DATABASE_URL backend/.env
```

> **El error más común:** dejar `DATABASE_URL` apuntando a `localhost`. Dentro de un
> contenedor, `localhost` es el propio contenedor, no el servidor. El host correcto es
> `postgres`, que es el nombre del servicio en el compose.

---

## 4. Desplegar

> ⚠️ **Los pasos 3.3 y 3.4 son obligatorios antes de esto.** Sin los dos `.env` el compose se
> niega a arrancar, a propósito, con este mensaje:
>
> ```
> required variable POSTGRES_PASSWORD is missing a value
> ```
>
> Es un guardarraíl, no un fallo: evita levantar una base de datos con contraseña vacía.
> Comprueba antes de seguir:
>
> ```bash
> ls -la .env backend/.env
> ```

```bash
cd /home/cristian/proyectos/proyectosena.online/sistema-juridico

# 1. Levantar la base de datos
docker compose up -d postgres

# 2. Crear el esquema. La base es nueva, así que migrate deploy es lo correcto
docker compose run --rm backend npx prisma migrate deploy

# 3. Levantar la API
docker compose up -d --build backend

# 4. Compilar el frontend (el contenedor se borra al terminar)
docker compose --profile build run --rm frontend-build
```

Comprobar:

```bash
docker compose ps                          # los dos deben decir "healthy"
curl http://127.0.0.1:3005/                # {"message":"SGPA API is running"}
```

> **Sobre `migrate deploy`:** funciona porque la base del contenedor nace vacía y la migración
> crea el esquema completo. Si algún día apuntas a una base que ya tiene tablas, `migrate deploy`
> fallará con *relation already exists*; ahí el comando sería `npx prisma db push`.

---

## 5. Configuración de Nginx en el host

### Cómo está el servidor

`nginx -T` muestra tres `server` block relevantes, y conviene tener claro qué es de quién:

| `server_name` | Raíz | De quién |
|---|---|---|
| `proyectosena.online` | `/home/cristian/proyectos/proyectosena.online` | **Tuyo.** Aloja varios proyectos: `sistema-juridico/`, `costura/`… |
| `iuris.proyectosena.online` | — | Tuyo, subdominio aparte |
| `sgdp.yessica.online` | `/home/yessica/proyectos/SGDP/public` | **De tu vecina.** PHP con FastCGI |

**Buena noticia:** la aplicación de Yessica vive en un `server` block distinto. Modificar el de
`proyectosena.online` **no la afecta**. El único riesgo compartido es que un error de sintaxis
impida recargar Nginx y deje caídos todos los sitios — por eso se valida siempre con
`nginx -t` antes de recargar.

### Los bloques ya existen: hay que ajustarlos, no añadirlos

El `server` block de `proyectosena.online` ya contiene `location /sistema-juridico` y
`location /sistema-juridico/api/`, de un despliegue anterior. **No los dupliques.** Ábrelos y
compáralos con esto:

```bash
sudo nano /etc/nginx/sites-available/proyectosena.online   # o el archivo que uses
```

**Lo que hay que cambiar:** el `proxy_pass` del bloque de la API, para que apunte al **3005**,
que es donde publica el contenedor. Antes apuntaba al puerto del proceso Node que corría
directamente en el servidor.

**Cómo está hoy el bloque de la API:**

```nginx
location /sistema-juridico/api/ {
    proxy_pass http://localhost:3000/api/;      # ← proceso Node en el host
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

**Cómo debe quedar:**

```nginx
location /sistema-juridico/api/ {
    proxy_pass         http://127.0.0.1:3005/api/;
    proxy_http_version 1.1;
    proxy_set_header   Host              $host;
    proxy_set_header   X-Real-IP         $remote_addr;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;

    # Sin esto Nginx rechaza con 413 cualquier archivo de más de 1 MB,
    # y el sistema acepta documentos de hasta 10 MB (RF18)
    client_max_body_size 12M;
}
```

**Los cuatro cambios y por qué:**

| Cambio | Motivo |
|---|---|
| `localhost:3000` → `127.0.0.1:3005` | El 3005 es donde publica el contenedor. Y se escribe `127.0.0.1`, no `localhost`: en sistemas con IPv6, `localhost` puede resolver primero a `::1`, y Docker publica solo en IPv4 → `502 Bad Gateway` |
| Añadir `X-Real-IP` y `X-Forwarded-For` | Sin ellas, la bitácora de auditoría registra la IP de Nginx en lugar de la del cliente, incumpliendo RF05 y RNF03 |
| Añadir `client_max_body_size 12M` | El valor por defecto de Nginx es 1 MB. Sin esta línea, **subir un documento de más de 1 MB falla con 413**, aunque el backend acepte hasta 10 MB |
| Quitar `Upgrade` / `Connection 'upgrade'` | Son cabeceras de WebSocket y el SGPA no usa WebSockets. Dejarlas no rompe nada, pero sobran |

> **La otra mitad de la IP real está en el código.** Que Nginx envíe `X-Forwarded-For` no basta:
> Express lo ignora salvo que se le indique que confíe en el proxy. `app.js` incluye
> `app.set('trust proxy', 1)` precisamente para eso. Sin esa línea **y** sin estas cabeceras,
> los 9 puntos del backend que escriben `req.ip` guardarían siempre `127.0.0.1`.

**El bloque del frontend ya está correcto** y no hay que tocarlo:

```nginx
location /sistema-juridico {
    alias /home/cristian/proyectos/proyectosena.online/sistema-juridico/frontend/dist;
    try_files $uri $uri/ /sistema-juridico/index.html;
}
```

Validar **antes** de recargar, para no dejar el servidor caído:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

> **Cuatro detalles que suelen fallar:**
> 1. La barra final en `proxy_pass http://127.0.0.1:3005/api/;` es obligatoria. Sin ella la
>    ruta se concatena mal y todo devuelve 404.
> 2. `location /sistema-juridico/` con barra final, no `location /sistema-juridico`. Con `alias`,
>    la barra del `location` y la del `alias` deben coincidir o Nginx concatena mal la ruta.
> 3. `try_files ... /sistema-juridico/index.html` es lo que hace funcionar el enrutado de React
>    al recargar una página interna. Es el equivalente al `vercel.json` que se retiró.
> 4. Nginx necesita permiso de lectura sobre `frontend/dist`. Si da 403:
>    `chmod o+x /home/cristian /home/cristian/proyectos`.

### Si algo sale mal, vuelve atrás

Haz copia del archivo **antes** de editarlo. Restaurar es entonces inmediato:

```bash
sudo cp /etc/nginx/sites-available/proyectosena.online{,.bak}
# ...si algo falla:
sudo cp /etc/nginx/sites-available/proyectosena.online{.bak,} && sudo nginx -t && sudo systemctl reload nginx
```

---

## 6. Crear el primer consultorio

El registro es público (`/sistema-juridico/registro`). Al registrarte recibirás un correo de
verificación.

**Si el correo no llega** —credenciales de Gmail mal puestas o SMTP bloqueado en el VPS—, la
cuenta **se crea igual pero inactiva**, y la respuesta te lo dice explícitamente
(hallazgo H-28). El enlace de verificación queda en los logs:

```bash
docker compose logs backend | grep "Enlace de verificación"
```

Ábrelo en el navegador y la cuenta se activa. También puedes activarla en la base:

```bash
docker compose exec postgres psql -U sgpa -d sgpa \
  -c "UPDATE usuario SET activo = true WHERE email = 'tu@correo.com';"
```

---

## 7. Operación diaria

```bash
# Actualizar tras un cambio de código
cd /home/cristian/proyectos/proyectosena.online/sistema-juridico
git pull
docker compose up -d --build backend
docker compose --profile build run --rm frontend-build

# SIEMPRE, aunque el cambio no traiga migraciones (ver la nota de abajo)
docker compose exec backend npx prisma migrate status
docker compose run --rm backend npx prisma migrate deploy   # si hay pendientes

# Ver qué pasa
docker compose logs -f backend
docker compose ps

# Detener el SGPA (la otra aplicación sigue intacta)
docker compose down
```

### Por qué `migrate status` va siempre, y no «solo si hay migraciones»

**Lo que importa no es si el cambio de hoy trae migraciones, sino si la base de producción
está al día.** Son cosas distintas, y confundirlas rompió el acceso a la plataforma el 3 de
septiembre de 2026.

Ocurrió así. La migración `recuperacion_de_acceso` se creó el 2 de septiembre y añadía tres
columnas a `usuario`. Nunca se aplicó en producción, y **nadie lo notó**: la imagen que estaba
corriendo llevaba un cliente de Prisma generado antes de esas columnas, así que jamás las
pedía. El sistema funcionaba con una base incompleta sin dar señales.

Al reconstruir la imagen —por un cambio que no traía ninguna migración— el cliente se regeneró
desde el esquema actual y empezó a pedir las tres columnas en cada `findUnique` sobre `usuario`.
El primer intento de acceso respondió `500`, con
`P2022: The column usuario.token_verificacion_expira does not exist`.

**El despliegue no rompió nada: destapó algo que llevaba un día roto.** Esa es la lección. Un
`git pull` que no trae migraciones puede aun así activar migraciones anteriores que no se
aplicaron, porque lo que cambia el comportamiento es el **cliente regenerado**, no el commit.

`migrate status` cuesta un segundo y responde la única pregunta que importa: *¿le falta algo a
esta base?*

### Copias de seguridad

La base vive en un volumen de Docker. **`docker compose down` no la borra**; solo
`docker compose down -v` lo haría.

```bash
# Respaldo
docker compose exec -T postgres pg_dump -U sgpa sgpa > respaldo-$(date +%F).sql

# Restauración
cat respaldo-2026-09-01.sql | docker compose exec -T postgres psql -U sgpa -d sgpa
```

Conviene automatizarlo con un cron diario del sistema.

### Actualizar la versión de Node — el objetivo de todo esto

Cambia la etiqueta en `backend/Dockerfile` y `frontend/Dockerfile`:

```dockerfile
FROM node:26-slim AS deps    # antes: node:24-slim
```

```bash
docker compose up -d --build backend
```

**Eso es todo.** El otro usuario conserva su Node de siempre. Si la versión nueva rompe algo,
revierte la etiqueta y reconstruye: vuelves al estado anterior en un minuto.

---

## 7 bis. Respaldos — ⚠️ hoy NO existen

**Este es el mayor riesgo operativo del sistema.**

Cuando la base de datos vivía en un proveedor gestionado, los respaldos venían incluidos y nadie
tenía que ocuparse. Al pasarla a un contenedor propio ([ADR-011](11-DECISIONES-ARQUITECTONICAS.md))
**se ganó el aislamiento y se perdió el respaldo automático**, y no se puso nada en su lugar.

Se detectó el 2 de septiembre de 2026 al revisar RNF10, que exige *«backups diarios con 30 días
de retención»*. Ahora mismo, si el volumen del contenedor se corrompe, **se pierden todos los
expedientes de todos los consultorios**. En un sistema jurídico eso no es una molestia: es la
pérdida de documentación procesal de terceros.

### Respaldo manual, ahora mismo

```bash
cd ~/proyectos/proyectosena.online/sistema-juridico
mkdir -p respaldos
docker compose exec -T postgres pg_dump -U sgpa sgpa | gzip > respaldos/sgpa-$(date +%F-%H%M).sql.gz
ls -lh respaldos/
```

**Guarda ese archivo fuera del VPS.** Un respaldo en el mismo servidor no protege del fallo más
probable, que es perder el servidor.

### Restaurar

```bash
gunzip -c respaldos/sgpa-FECHA.sql.gz | docker compose exec -T postgres psql -U sgpa -d sgpa
```

> Conviene **probar la restauración al menos una vez**. Un respaldo que nunca se ha restaurado no
> es un respaldo: es un archivo del que se supone algo.

### Automatizarlo

Una tarea programada diaria en el host, con rotación a 30 días para cumplir RNF10:

```bash
crontab -e
```

```cron
0 3 * * * cd ~/proyectos/proyectosena.online/sistema-juridico && docker compose exec -T postgres pg_dump -U sgpa sgpa | gzip > respaldos/sgpa-$(date +\%F).sql.gz && find respaldos/ -name 'sgpa-*.sql.gz' -mtime +30 -delete
```

Sigue sin salir del servidor. Copiarlos a otro sitio queda pendiente.

**Los documentos subidos no entran aquí:** viven en Cloudflare R2 y tienen su propia durabilidad.
Este respaldo cubre la base de datos, que es lo que hoy no tiene ninguna red.

---

## 8. Limitaciones que conviene conocer

| Limitación | Detalle |
|---|---|
| **El cron vive dentro del contenedor** | `node-cron` corre en el mismo proceso que la API ([ADR-007](11-DECISIONES-ARQUITECTONICAS.md)). **No escales `backend` a varias réplicas** o se enviarán correos duplicados |
| **Docker consume disco** | Imágenes y capas se acumulan en un disco compartido. Limpia con `docker system prune -f` de vez en cuando |
| **La base ya no es la del sistema** | Si tenías datos en el PostgreSQL del VPS, no aparecerán: el contenedor arranca con una base vacía. Para traerlos: `pg_dump` de la vieja y restaurar en la nueva |
| **Instalar Docker sí afecta al sistema** | Es el único cambio a nivel de VPS. Después, ninguna actualización del SGPA vuelve a tocar el host |

---

## 9. Si algo sale mal

| Síntoma | Qué revisar |
|---|---|
| `502 Bad Gateway` | El contenedor no está arriba: `docker compose ps`. Verifica que el puerto de Nginx (3005) coincide con `SGPA_PUERTO` |
| `404` en las rutas de la API | Falta la barra final en `proxy_pass .../api/` |
| Página en blanco al recargar una ruta interna | Falta el `try_files` del bloque de Nginx |
| `403 Forbidden` en los estáticos | Nginx no puede leer `frontend/dist`: permisos de la carpeta personal |
| El contenedor reinicia en bucle | `docker compose logs backend`. Casi siempre es una variable ausente en `backend/.env` |
| `Can't reach database server at localhost:5432` | `DATABASE_URL` apunta a `localhost` en vez de a `postgres`. Es el fallo más común |
| `password authentication failed` | La clave de `backend/.env` no coincide con `POSTGRES_PASSWORD` del `.env` de la raíz |
| El frontend llama a `localhost:3000` | Se compiló sin `VITE_API_URL`. Reconstruye el contenedor de compilación |
| No llega el correo de verificación | Ver la sección 6: la cuenta existe y se puede activar a mano |
