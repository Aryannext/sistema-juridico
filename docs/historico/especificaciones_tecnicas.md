# Especificaciones Técnicas - SGPA

> ⚠️ **DOCUMENTO OBSOLETO — no usar como referencia.**
>
> Se conserva **a propósito**, sin corregir, como registro de lo que el proyecto creía ser.
> Corregirlo borraría la prueba de qué cambió y por qué.
>
> **Nada de esta tabla es cierto hoy:**
>
> | Dice aquí | Realidad |
> |---|---|
> | React 18 · Tailwind v3 · Router v6 | React 19 · Tailwind 4 · Router 7 |
> | Node.js v18+ | **Node 24**, fijado dentro de la imagen Docker |
> | Almacenamiento en Supabase | **Cloudflare R2** con URLs firmadas |
> | **Base de datos en Supabase (AWS us-west-1)** | **PostgreSQL 16 en contenedor propio**, en el VPS |
> | **Conexión vía PgBouncer, puerto 6543** | **Sin *pooler*.** Conexión directa al servicio `postgres` del compose |
>
> **Documentos vigentes:** [01-ARQUITECTURA.md](../01-ARQUITECTURA.md),
> [09-COMPATIBILIDAD-NODE.md](../09-COMPATIBILIDAD-NODE.md) y
> [12-DESPLIEGUE-VPS-COMPARTIDO.md](../12-DESPLIEGUE-VPS-COMPARTIDO.md).
> El porqué del cambio de base de datos está en [ADR-011](../11-DECISIONES-ARQUITECTONICAS.md).
> Detalle de los desajustes en [00-AUDITORIA-DE-COHERENCIA.md](../00-AUDITORIA-DE-COHERENCIA.md)
> (H-05, H-06, H-07).

---

El SGPA (Sistema de Gestión de Procesos de Abogados) es un sistema SaaS B2B robusto, construido con tecnologías modernas web para garantizar escalabilidad, seguridad en los datos sensibles de los casos y alto rendimiento.

## 1. Stack Tecnológico (Core)

### Frontend (Cliente)
- **Framework Base**: React 18
- **Construcción y Bundling**: Vite
- **Lenguaje**: JavaScript (ES6+)
- **Estilos y UI**: Tailwind CSS v3 (JIT engine), utilidades para *Glassmorphism*.
- **Iconografía**: Lucide React.
- **Enrutamiento**: React Router DOM v6 (Client-side routing).
- **Notificaciones UI**: Sonner.
- **Peticiones HTTP**: Axios (configurado con interceptores de Auth).
- **Manejo de Formularios**: React Hook Form.

### Backend (Servidor)
- **Entorno de Ejecución**: Node.js (v18+)
- **Framework Web**: Express.js
- **ORM (Object-Relational Mapping)**: Prisma ORM v5
- **Autenticación**: JSON Web Tokens (JWT) + Bcrypt para Hashing.
- **Manejo de CORS**: `cors` package.
- **Seguridad HTTP**: `helmet`.
- **Límite de Peticiones**: `express-rate-limit` (Configurado para prevenir ataques DDoS locales y fuerza bruta en logins).

### Base de Datos
- **Motor**: PostgreSQL (v15+)
- **Proveedor Cloud DB**: Supabase (Usando AWS us-west-1).
- **Conexión**: Connection Pooling vía PgBouncer (puerto 6543) optimizado para entornos Serverless y alta concurrencia.
- **Migraciones**: Administradas mediante `prisma migrate`.

## 2. Esquema de Base de Datos y Multi-Tenancy

El diseño emplea un esquema de tabla plana con **Multi-Tenancy lógico**. 
Cada registro en la base de datos almacena una llave foránea oculta `tenant_id` vinculada a la tabla primaria de `Tenant` (Consultorios y Abogados Independientes). 
- `Usuario`, `Cliente`, `Proceso`, `Documento`, `BitacoraAuditoria` derivan sus filtros estrictamente en base a este `tenant_id`.

## 3. Seguridad y Privacidad (Legal-Tech Standards)
Para el desarrollo de software jurídico (Legal-Tech), la protección de datos es primordial:
1. **Contraseñas**: Ninguna contraseña se almacena en texto plano. Todas usan `bcrypt` con un salt round seguro.
2. **Autorización**: Control de acceso basado en roles (RBAC). Roles definidos en Prisma Enum: `ADMINISTRADOR`, `ABOGADO`, `ASISTENTE`, `CLIENTE`.
3. **Inmutabilidad de Registros**: Se prohíbe el Hard Delete de historial o procesos desde la interfaz de usuario.
4. **Trazabilidad (Logs)**: Toda acción que altere datos dispara una escritura en la tabla `BitacoraAuditoria` capturando la acción, módulo, usuario e IP de origen (o `127.0.0.1` en desarrollo).

## 4. Requisitos para Despliegue en Producción

### Frontend
- Entorno: Puede ser alojado en cualquier CDN estático globalmente distribuido.
- Recomendación: **Vercel** o **AWS Amplify**.
- Variables de Entorno: `VITE_API_URL` apuntando a la URL segura (HTTPS) del backend en producción.

### Backend
- Entorno: Servidor con capacidad para ejecutar Node.js de manera persistente.
- Recomendación: **Render**, **AWS EC2 / Elastic Beanstalk** o **Railway**.
- Se recomienda desplegar en una región cercana a la Base de Datos (`us-west-1`) para disminuir la latencia de red y mantener tiempos de respuesta entre el servidor y Prisma menores a 5ms.
- Variables de Entorno Requeridas:
  - `DATABASE_URL`: URI de conexión a PostgreSQL usando PgBouncer.
  - `DIRECT_URL`: URI de conexión directa para migraciones.
  - `JWT_SECRET`: Llave criptográfica fuerte de 256 bits.
  - `PORT`: Generalmente asignado dinámicamente por la plataforma en la nube (ej. 8080).

## 5. Rendimiento y Optimizaciones
- El frontend realiza consultas `Promise.all` paralelas para recolección de estadísticas del Dashboard, previniendo bloqueos secuenciales.
- Se ha incluido `autoComplete="off"` a nivel de atributos DOM en formularios de autenticación para prevenir inyección indeseada de credenciales.
- Las tablas en el frontend usan paginación y/o scroll interno (`custom-scrollbar`) limitando el renderizado de DOM excesivo.
