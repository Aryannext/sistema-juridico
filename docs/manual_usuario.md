# Manual de Usuario - SGPA (Sistema de Gestión de Procesos de Abogados)

Bienvenido al SGPA. Este manual te guiará por las funciones principales del sistema para que puedas gestionar tu consultorio jurídico, tus procesos y tus clientes de manera eficiente.

## 1. Registro e Inicio de Sesión
1. **Registro**: Al ingresar por primera vez, selecciona "Register Now". 
   - Elige tu tipo de perfil: **Abogado Independiente** o **Consultorio (Firma)**.
   - Llena los datos obligatorios. Si eres Consultorio, definirás el nombre de tu firma y tus datos actuarán como el Administrador Principal de todo el tenant.
2. **Inicio de Sesión**: Usa tu correo y contraseña. El sistema te llevará automáticamente al Dashboard principal correspondiente a tu rol (Administrador, Abogado o Cliente).

## 2. Dashboard (Panel Principal)
El panel principal es tu centro de comando. Aquí verás:
- **Métricas Generales**: Total de clientes, total de expedientes activos y agenda.
- **Riesgos Procesales (Semáforo)**: El sistema alerta automáticamente si tienes términos procesales vencidos o a punto de vencer (menos de 24 horas), así como procesos inactivos por más de 30 días.
- **Notificaciones**: La campanita superior derecha aloja notificaciones de modificaciones y alertas.
- **Carga de Trabajo (Solo Administrador)**: Un gráfico visual mostrando qué abogado tiene la mayor cantidad de expedientes asignados.

## 3. Gestión de Clientes
Desde el menú izquierdo ve a **Clientes**.
- **Crear Cliente**: Usa el botón "Nuevo Cliente". Puedes registrar personas naturales o jurídicas.
- **Habilitar Portal de Cliente**: Selecciona un cliente registrado y verás un botón para generar sus credenciales de acceso al portal web. Al hacer esto, el cliente podrá iniciar sesión para revisar el estado exclusivo de sus propios procesos (sin ver los demás).

## 4. Gestión de Expedientes (Legal Cases)
Dirígete a la sección **Procesos** o **Legal Cases**.
- **Crear Radicado**: Presiona "Nuevo Proceso". Asigna el cliente, un número de radicado (21 dígitos si es en Colombia), el tipo de proceso y el abogado a cargo de llevar el caso.
- **Detalles del Proceso**: Al hacer clic en un proceso, entras a su expediente digital completo.
  - **Historial (Actuaciones)**: Agrega cada movimiento del juzgado (Autos, Sentencias, Estados).
  - **Términos Judiciales**: Agrega las fechas límite. El sistema te alertará en el Dashboard cuando la fecha de vencimiento esté cerca.
  - **Audiencias**: Agenda la fecha de las audiencias. Estas aparecerán en tu calendario.
  - **Documentos**: Sube y gestiona archivos PDF, Word o imágenes asociados al proceso.

## 5. Accesos y Permisos (Solo Administrador)
En la sección de **Control de Acceso (Access Control)**, el administrador puede:
- Invitar nuevos abogados o asistentes a su firma.
- Asignar roles (Abogado, Asistente, Administrador).
- Bloquear accesos si un empleado deja la firma.
Los usuarios con rol "Abogado" solo podrán editar los procesos que se les asignen, mientras que el Administrador puede ver y editar todo el despacho.

## 6. Reportes y Auditoría
- **Reportes (Reports)**: Genera estadísticas de rendimiento del bufete y exporta toda tu base de datos a un archivo `.CSV` / Excel en caso de requerir respaldo local.
- **Auditoría (Audit Logs)**: El SGPA cuenta con registro inmutable. Cada vez que alguien entra, edita, borra o sube un documento, el sistema lo registra. El Administrador puede revisar la Bitácora para ver *Quién*, *Qué* y *Cuándo* se realizó alguna acción.

## 7. Portal del Cliente (Visión del End-User)
Si habilitas el acceso para un cliente, este entrará por la misma página de Login, pero el SGPA detectará su rol y le mostrará únicamente una vista resumida de sus casos.
- Podrá ver las actuaciones más recientes de su caso.
- No podrá editar, borrar ni ver casos de otros clientes.
- Esto reduce drásticamente las llamadas telefónicas al despacho preguntando "cómo va mi caso".
