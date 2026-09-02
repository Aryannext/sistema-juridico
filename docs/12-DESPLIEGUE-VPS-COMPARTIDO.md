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
            CT["sgpa-backend<br/>Node 24 · 127.0.0.1:3001"]
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
| **Nginx** | Sirve también a la otra aplicación. Solo se le **añaden** dos bloques `location` |
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

```bash
cd ~
git clone https://github.com/Aryannext/sistema-juridico.git   # si no está ya
cd sistema-juridico
git fetch origin
git checkout docs/reconstruccion-y-actuaciones                # o main, tras fusionar
```

### 3.3 Variables del compose (raíz)

```bash
cp .env.example .env
nano .env
```

Genera una contraseña larga para la base:

```bash
openssl rand -base64 32
```

Y ponla en `POSTGRES_PASSWORD`. Ajusta `SGPA_PUERTO` si el 3001 está ocupado
(`ss -tlnp` te dice qué puertos hay en uso).

### 3.4 Variables de la aplicación (backend)

```bash
cp backend/.env.example backend/.env
nano backend/.env
```

**Lo más importante y donde más se falla:** `DATABASE_URL` y `DIRECT_URL` deben apuntar al
servicio `postgres`, **no a `localhost`**. Dentro de un contenedor, `localhost` es el propio
contenedor.

```env
DATABASE_URL="postgresql://sgpa:LA_MISMA_CLAVE@postgres:5432/sgpa?schema=public"
DIRECT_URL="postgresql://sgpa:LA_MISMA_CLAVE@postgres:5432/sgpa?schema=public"
```

Rellena también `JWT_SECRET`, las cinco `R2_*` —sin `R2_BUCKET_NAME` no se sube ni un
documento—, `GMAIL_*` y `FRONTEND_URL` apuntando al dominio real:

```env
FRONTEND_URL="https://proyectosena.online/sistema-juridico"
```

---

## 4. Desplegar

```bash
cd ~/sistema-juridico

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
curl http://127.0.0.1:3001/                # {"message":"SGPA API is running"}
```

> **Sobre `migrate deploy`:** funciona porque la base del contenedor nace vacía y la migración
> crea el esquema completo. Si algún día apuntas a una base que ya tiene tablas, `migrate deploy`
> fallará con *relation already exists*; ahí el comando sería `npx prisma db push`.

---

## 5. Configuración de Nginx en el host

Añade estos dos bloques dentro del `server { ... }` que ya tienes. **No sustituyas tu
configuración**: solo agrega lo que falta, para no romper a la otra aplicación.

```nginx
# API del SGPA → contenedor
location /sistema-juridico/api/ {
    proxy_pass         http://127.0.0.1:3001/api/;
    proxy_http_version 1.1;
    proxy_set_header   Host              $host;
    proxy_set_header   X-Real-IP         $remote_addr;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;

    # Subida de documentos: el backend acepta hasta 10 MB
    client_max_body_size 12M;
}

# Frontend del SGPA → archivos estáticos
location /sistema-juridico/ {
    alias /home/TU_USUARIO/sistema-juridico/frontend/dist/;
    try_files $uri $uri/ /sistema-juridico/index.html;
}
```

Validar **antes** de recargar, para no dejar el servidor caído:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

> **Tres detalles que suelen fallar:**
> 1. La barra final en `proxy_pass http://127.0.0.1:3001/api/;` es obligatoria. Sin ella la
>    ruta se concatena mal y todo devuelve 404.
> 2. `try_files ... /sistema-juridico/index.html` es lo que hace funcionar el enrutado de React
>    al recargar una página interna. Es el equivalente al `vercel.json` que se retiró.
> 3. Nginx necesita permiso de lectura sobre `frontend/dist`. Si da 403:
>    `chmod o+x /home/TU_USUARIO`.

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
git pull
docker compose up -d --build backend
docker compose --profile build run --rm frontend-build

# Si el cambio incluye migraciones
docker compose run --rm backend npx prisma migrate deploy

# Ver qué pasa
docker compose logs -f backend
docker compose ps

# Detener el SGPA (la otra aplicación sigue intacta)
docker compose down
```

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
| `502 Bad Gateway` | El contenedor no está arriba: `docker compose ps`. Verifica que el puerto de Nginx coincide con `SGPA_PUERTO` |
| `404` en las rutas de la API | Falta la barra final en `proxy_pass .../api/` |
| Página en blanco al recargar una ruta interna | Falta el `try_files` del bloque de Nginx |
| `403 Forbidden` en los estáticos | Nginx no puede leer `frontend/dist`: permisos de la carpeta personal |
| El contenedor reinicia en bucle | `docker compose logs backend`. Casi siempre es una variable ausente en `backend/.env` |
| `Can't reach database server at localhost:5432` | `DATABASE_URL` apunta a `localhost` en vez de a `postgres`. Es el fallo más común |
| `password authentication failed` | La clave de `backend/.env` no coincide con `POSTGRES_PASSWORD` del `.env` de la raíz |
| El frontend llama a `localhost:3000` | Se compiló sin `VITE_API_URL`. Reconstruye el contenedor de compilación |
| No llega el correo de verificación | Ver la sección 6: la cuenta existe y se puede activar a mano |
