const prisma = require('../../config/prisma');
const { hashPassword, comparePassword } = require('../../utils/bcrypt');
const { signToken, generateOTP, generateVerificationToken } = require('../../utils/jwt');
const { sendEmail } = require('../../config/mailer');
const { validarPassword } = require('../../utils/password');
const {
  validarNombreUsuario,
  normalizar: normalizarNombreUsuario,
  pareceCorreo,
} = require('../../utils/nombre-usuario');
const sesion = require('./sesion.auditoria');

exports.registro = async (req, res) => {
  try {
    const { tipo, nombre_tenant, razon_social, nit, telefono, ciudad, email, password, nombre_admin, nombre_usuario } = req.body;

    // RNF02: la política de contraseñas se comprueba EN EL SERVIDOR. Hasta
    // ahora solo la validaba el formulario del navegador, de modo que una
    // petición directa a este endpoint aceptaba la contraseña "1".
    const politica = validarPassword(password);
    if (!politica.valida) {
      return res.status(400).json({ error: politica.error });
    }

    // Validate if email already exists
    const existingUser = await prisma.usuario.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'El correo ya está registrado' });
    }

    // RF01.2: el nombre de usuario es OPCIONAL en el registro. El correo sigue
    // siendo el identificador obligatorio, y quien no elija ninguno entra por
    // correo como hasta ahora. Quien lo omita puede reclamarlo después desde su
    // perfil.
    let nombreUsuario = null;
    if (nombre_usuario !== undefined && nombre_usuario !== null && String(nombre_usuario).trim() !== '') {
      const comprobacion = validarNombreUsuario(nombre_usuario);
      if (!comprobacion.valido) {
        return res.status(400).json({ error: comprobacion.error });
      }

      const yaTomado = await prisma.usuario.findUnique({
        where: { nombre_usuario: comprobacion.valor }
      });
      if (yaTomado) {
        return res.status(400).json({ error: 'Ese nombre de usuario ya está en uso' });
      }

      nombreUsuario = comprobacion.valor;
    }

    const hashedPassword = await hashPassword(password);
    const tokenVerificacion = generateVerificationToken();

    // Perform inside a transaction
    await prisma.$transaction(async (tx) => {
      // 1. Create Tenant
      const tenant = await tx.tenant.create({
        data: {
          nombre: nombre_tenant,
          tipo: tipo === 'INDEPENDIENTE' ? 'INDEPENDIENTE' : 'CONSULTORIO',
          razon_social: razon_social || null,
          nit: nit || null,
          telefono: telefono || null,
          ciudad: ciudad || null,
          email_admin: email,
        }
      });

      // 2. Create Admin User
      // 2. Create Admin User
      // Solo permite auto-verificación si explícitamente se pide Y estamos en desarrollo.
      // En producción SIEMPRE requerimos verificación de email.
      const isAutoVerify = process.env.NODE_ENV !== 'production' && process.env.DEV_AUTO_VERIFY === 'true';
      
      const usuario = await tx.usuario.create({
        data: {
          tenant_id: tenant.id_tenant,
          nombre: nombre_admin,
          email,
          nombre_usuario: nombreUsuario,
          password_hash: hashedPassword,
          rol: 'ADMINISTRADOR',
          activo: isAutoVerify, // Active if auto-verify is enabled, else inactive until verified
          token_verificacion: isAutoVerify ? null : tokenVerificacion,
          // RF54: el enlace de activación vive 24 horas. Antes no caducaba
          // nunca, así que un correo antiguo seguía sirviendo indefinidamente.
          token_verificacion_expira: isAutoVerify
            ? null
            : new Date(Date.now() + 24 * 3600 * 1000)
        }
      });

      return { tenant, usuario };
    });

    const isAutoVerify = process.env.NODE_ENV !== 'production' && process.env.DEV_AUTO_VERIFY === 'true';
    const frontendUrl = process.env.FRONTEND_URL || 'https://proyectosena.online/sistema-juridico';
    const verificationUrl = `${frontendUrl}/verificacion?token=${tokenVerificacion}`;

    // El enlace lleva el token de verificación: quien lo lea puede activar la
    // cuenta ajena. Fuera de desarrollo no se escribe en los registros.
    if (process.env.NODE_ENV !== 'production') {
      /* eslint-disable no-console -- Impresión deliberada y solo fuera de producción. */
      console.log('\n=========================================');
      console.log('REGISTRO (solo desarrollo)');
      console.log('Autoverificación activa:', isAutoVerify);
      console.log('Enlace de verificación:', verificationUrl);
      console.log('=========================================\n');
      /* eslint-enable no-console */
    }

    // El tenant y el usuario ya están creados y confirmados en la base.
    // Si el envío del correo falla, NO se puede devolver un error: la cuenta
    // quedaría creada e inactiva, y el usuario no podría reintentar el registro
    // porque el correo ya figuraría como usado. Se informa del fallo sin
    // destruir el registro. Ver hallazgo H-28 en docs/00-AUDITORIA-DE-COHERENCIA.md
    let correoEnviado = true;

    if (!isAutoVerify) {
      try {
      // Send verification email only if not auto-verified
      await sendEmail({
        to: email,
        subject: 'Verifica tu cuenta en SGPA',
        text: `Hola ${nombre_admin},\n\nGracias por registrarte. Para activar tu cuenta, por favor verifica tu dirección de correo electrónico copiando y pegando el siguiente enlace en tu navegador:\n\n${verificationUrl}\n\nSi no solicitaste este registro, puedes ignorar este mensaje.\n\nEl equipo de SGPA.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h1 style="color: #DFB971; text-align: center;">Bienvenido a SGPA</h1>
            <p>Hola ${nombre_admin},</p>
            <p>Gracias por registrarte. Para activar tu cuenta y poder iniciar sesión, por favor verifica tu dirección de correo electrónico haciendo clic en el siguiente botón:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" style="background-color: #DFB971; color: #000; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 5px;">Verificar mi Cuenta</a>
            </div>
            <p style="color: #666; font-size: 12px; text-align: center;">Si el botón no funciona, copia y pega este enlace en tu navegador:<br>${verificationUrl}</p>
          </div>
        `
      });
      } catch (errorCorreo) {
        correoEnviado = false;
        console.error(
          `[Registro] La cuenta de ${email} se creó correctamente, pero falló el envío ` +
          `del correo de verificación:`, errorCorreo.message
        );
        console.error(`[Registro] Enlace de verificación para activarla a mano: ${verificationUrl}`);
      }
    }

    res.status(201).json({
      message: isAutoVerify
        ? 'Registro exitoso. Tu cuenta ha sido auto-verificada para desarrollo local.'
        : correoEnviado
          ? 'Registro exitoso. Revisa tu correo electrónico para verificar y activar tu cuenta.'
          : 'Tu cuenta fue creada, pero no pudimos enviarte el correo de verificación. ' +
            'Contacta al administrador para que active tu acceso.',
      correoEnviado
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el registro' });
  }
};

exports.verificarEmail = async (req, res) => {
  try {
    const { token } = req.params;

    const user = await prisma.usuario.findFirst({
      where: { token_verificacion: token }
    });

    // Mismo mensaje para un token inexistente y para uno caducado, y con la
    // marca `puedeReenviar` para que la interfaz ofrezca pedir otro correo en
    // lugar de dejar al usuario en un callejón sin salida.
    const invalido = () =>
      res.status(400).json({
        error: 'El enlace no es válido o ya caducó. Solicita uno nuevo.',
        puedeReenviar: true
      });

    if (!user) return invalido();

    // RF54: 24 horas de vigencia. Un token sin fecha es de una cuenta anterior
    // a que existiera este campo; se acepta para no dejarlas bloqueadas.
    if (user.token_verificacion_expira && user.token_verificacion_expira < new Date()) {
      return invalido();
    }

    await prisma.usuario.update({
      where: { id_usuario: user.id_usuario },
      data: {
        activo: true,
        token_verificacion: null,
        token_verificacion_expira: null
      }
    });

    res.json({ message: 'Cuenta verificada exitosamente. Ya puedes iniciar sesión.' });
  } catch (error) {
    console.error('Error en verificarCuenta:', error);
    res.status(500).json({ error: 'Error verificando cuenta' });
  }
};

exports.login = async (req, res) => {
  try {
    // RF01.1 y RF01.2: se entra con correo O con nombre de usuario.
    //
    // El campo del formulario pasó a llamarse `identificador` porque ya no
    // contiene siempre un correo. Se sigue aceptando `email` para no romper a
    // quien llame a la API con el nombre antiguo.
    const { password } = req.body;
    // Se fuerza a texto antes de recortar: este endpoint es público y sin
    // autenticar, y un cuerpo con `{"identificador": {}}` haría estallar el
    // `.trim()` devolviendo un 500 en vez del 401 que corresponde.
    const bruto = req.body.identificador ?? req.body.email ?? '';
    const identificador = typeof bruto === 'string' ? bruto.trim() : '';

    if (!identificador || typeof password !== 'string' || !password) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Una sola búsqueda por clave única, no dos ni un OR: la arroba decide cuál
    // de los dos identificadores es, y ningún nombre de usuario puede llevarla
    // (ver utils/nombre-usuario.js). El correo se busca tal cual se escribió,
    // como siempre; el nombre de usuario se guarda siempre en minúsculas, así
    // que se normaliza antes de preguntar.
    const criterio = pareceCorreo(identificador)
      ? { email: identificador }
      : { nombre_usuario: normalizarNombreUsuario(identificador) };

    const user = await prisma.usuario.findUnique({
      where: criterio,
      include: { tenant: { select: { activo: true } } }
    });

    if (!user) {
      // Generic error
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Check if locked
    if (user.bloqueado_hasta && user.bloqueado_hasta > new Date()) {
      const remainingMs = user.bloqueado_hasta - new Date();
      const remainingMins = Math.ceil(remainingMs / 60000);
      return res.status(403).json({ 
        error: `Cuenta bloqueada por seguridad. Intenta nuevamente en ${remainingMins} minuto(s).`,
        lockUntil: user.bloqueado_hasta.toISOString()
      });
    }

    const isValid = await comparePassword(password, user.password_hash);

    if (!isValid) {
      const attempts = user.intentos_fallidos + 1;
      let updateData = { intentos_fallidos: attempts };
      
      let lockMinutes = 0;
      if (attempts % 5 === 0) {
        if (attempts === 5) lockMinutes = 1;
        else if (attempts === 10) lockMinutes = 5;
        else if (attempts === 15) lockMinutes = 15;
        else if (attempts === 20) lockMinutes = 30;
        else lockMinutes = 60; // Para 25, 30, etc.
        
        updateData.bloqueado_hasta = new Date(Date.now() + lockMinutes * 60 * 1000);
      }

      await prisma.usuario.update({
        where: { id_usuario: user.id_usuario },
        data: updateData
      });

      // RF05: el intento fallido queda en la bitácora. Solo se registra si el
      // usuario existe: un intento contra un correo no registrado no tiene
      // consultorio al que atribuirlo.
      await sesion.registrarIntentoFallido(user, req, attempts);

      if (lockMinutes > 0) {
        await sesion.registrarBloqueo(user, req, lockMinutes);
        return res.status(401).json({ 
          error: `Demasiados intentos fallidos. Cuenta bloqueada por ${lockMinutes} minuto(s).`,
          lockUntil: updateData.bloqueado_hasta.toISOString()
        });
      }

      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    if (!user.activo) {
      return res.status(403).json({ error: 'Cuenta inactiva. Verifica tu correo o contacta al administrador.' });
    }

    // La suspensión del consultorio se comprueba DESPUÉS de validar la
    // contraseña, no antes: si no, cualquiera podría averiguar qué oficinas
    // están suspendidas probando correos ajenos.
    // El mensaje es distinto del de cuenta inactiva a propósito: al abogado
    // no le sirve "verifica tu correo" cuando el problema es que su
    // consultorio dejó de pagar.
    if (!user.tenant.activo) {
      return res.status(403).json({
        error: 'El acceso de su consultorio está suspendido. Contacte al administrador de la plataforma.',
        consultorioSuspendido: true
      });
    }

    // Reset attempts on successful login
    await prisma.usuario.update({
      where: { id_usuario: user.id_usuario },
      data: { intentos_fallidos: 0, bloqueado_hasta: null }
    });

    // Check 2FA
    if (user.dos_factores) {
      const otp = generateOTP();
      const expira = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      await prisma.usuario.update({
        where: { id_usuario: user.id_usuario },
        data: { codigo_2fa: otp, expira_2fa: expira }
      });

      // El código de un solo uso NO puede acabar en los registros de
      // producción: cualquiera con acceso a los logs del contenedor podría
      // completar el segundo factor de otra persona. En desarrollo sí es útil,
      // porque evita depender del correo para poder entrar.
      if (process.env.NODE_ENV !== 'production') {
        /* eslint-disable no-console -- Impresión deliberada y solo fuera de producción. */
        console.log('\n=========================================');
        console.log('CÓDIGO 2FA (solo desarrollo)');
        console.log('Usuario:', user.email);
        console.log('Código:', otp);
        console.log('=========================================\n');
        /* eslint-enable no-console */
      }

      try {
        await sendEmail({
          to: user.email,
          subject: 'Código de verificación SGPA',
          text: `Tu código de verificación de 2 factores es: ${otp}\n\nEl código expira en 5 minutos.`,
          html: `<h1>Tu código de verificación</h1>
                 <p>Ingresa el siguiente código de 6 dígitos: <strong>${otp}</strong></p>
                 <p>El código expira en 5 minutos.</p>`
        });
      } catch (mailError) {
        console.error('Failed to send 2FA email, but logged OTP code to console:', mailError.message);
      }

      // Issue temporary token for 2FA step
      const preAuthToken = signToken({ id_usuario: user.id_usuario, pending2FA: true }, '10m');
      
      return res.json({ 
        message: 'Se ha enviado un código a tu correo electrónico',
        require2FA: true,
        preAuthToken
      });
    }

    // No 2FA -> Full login
    const token = signToken({ id_usuario: user.id_usuario, tenant_id: user.tenant_id, rol: user.rol });

    // RF05: quién entró y cuándo. Aquí estaba el `// Todo: Record audit login`
    // que la auditoría de coherencia registró como hallazgo H-20.
    await sesion.registrarEntrada(user, req, false);

    res.json({
      token,
      user: {
        id: user.id_usuario,
        nombre: user.nombre,
        rol: user.rol,
        tenant_id: user.tenant_id
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el inicio de sesión' });
  }
};

exports.verificar2FA = async (req, res) => {
  try {
    const { codigo, preAuthToken } = req.body;

    // TODO: We need a verifyPreAuthToken mechanism or decode it directly.
    // Let's decode it safely using jsonwebtoken
    const jwt = require('jsonwebtoken');
    let decoded;
    try {
      decoded = jwt.verify(preAuthToken, process.env.JWT_SECRET);
    } catch {
      // Un token temporal caducado o manipulado es un caso esperado, no una
      // anomalía: no se registra para no llenar el log de ruido.
      return res.status(401).json({ error: 'Token temporal inválido o expirado' });
    }

    if (!decoded.pending2FA) {
      return res.status(400).json({ error: 'Flujo inválido' });
    }

    const user = await prisma.usuario.findUnique({ where: { id_usuario: decoded.id_usuario } });

    if (!user || user.codigo_2fa !== codigo) {
      return res.status(401).json({ error: 'Código inválido' });
    }

    if (user.expira_2fa < new Date()) {
      return res.status(401).json({ error: 'El código ha expirado' });
    }

    // Success -> Clear 2FA and issue full token
    await prisma.usuario.update({
      where: { id_usuario: user.id_usuario },
      data: { codigo_2fa: null, expira_2fa: null }
    });

    const token = signToken({ id_usuario: user.id_usuario, tenant_id: user.tenant_id, rol: user.rol });

    // RF05: la entrada se registra al completar el SEGUNDO factor, no antes.
    // Superar la contraseña sin el código no es haber entrado.
    await sesion.registrarEntrada(user, req, true);

    res.json({
      token,
      user: {
        id: user.id_usuario,
        nombre: user.nombre,
        rol: user.rol,
        tenant_id: user.tenant_id
      }
    });

  } catch (error) {
    console.error('Error en verificar2FA:', error);
    res.status(500).json({ error: 'Error verificando 2FA' });
  }
};

exports.configurar2FA = async (req, res) => {
  try {
    const { enable } = req.body;
    // user comes from auth middleware, but we don't have it yet. Let's assume req.user is set
    if (!req.user) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    await prisma.usuario.update({
      where: { id_usuario: req.user.id_usuario },
      data: { dos_factores: enable }
    });

    res.json({ message: `Autenticación de dos factores ${enable ? 'habilitada' : 'deshabilitada'} exitosamente.` });
  } catch (error) {
    console.error('Error en configurar2FA:', error);
    res.status(500).json({ error: 'Error configurando 2FA' });
  }
};

exports.getPerfil = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const user = await prisma.usuario.findUnique({
      where: { id_usuario: req.user.id_usuario },
      select: {
        id_usuario: true,
        nombre: true,
        email: true,
        nombre_usuario: true,
        rol: true,
        activo: true,
        dos_factores: true,
        tenant_id: true,
        create_at: true,
        preferencia_canal: true,
        pref_prioridad_audiencia: true,
        pref_prioridad_termino: true,
        pref_prioridad_tarea: true
      }
    });

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error obteniendo el perfil del usuario' });
  }
};

exports.updatePreferencias = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const { preferencia_canal, pref_prioridad_audiencia, pref_prioridad_termino, pref_prioridad_tarea } = req.body;

    const dataToUpdate = {};
    if (preferencia_canal) dataToUpdate.preferencia_canal = preferencia_canal;
    if (pref_prioridad_audiencia) dataToUpdate.pref_prioridad_audiencia = pref_prioridad_audiencia;
    if (pref_prioridad_termino) dataToUpdate.pref_prioridad_termino = pref_prioridad_termino;
    if (pref_prioridad_tarea) dataToUpdate.pref_prioridad_tarea = pref_prioridad_tarea;

    const updatedUser = await prisma.usuario.update({
      where: { id_usuario: req.user.id_usuario },
      data: dataToUpdate,
      select: {
        id_usuario: true,
        preferencia_canal: true,
        pref_prioridad_audiencia: true,
        pref_prioridad_termino: true,
        pref_prioridad_tarea: true
      }
    });

    res.json({
      message: 'Preferencias de alerta actualizadas con éxito.',
      preferencias: updatedUser
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error actualizando preferencias de alerta' });
  }
};

/**
 * Fijar o cambiar el propio nombre de usuario — RF01.2.
 *
 * Sin esto la funcionalidad solo alcanzaría a quien se registre a partir de
 * ahora. La migración reparte un nombre a las cuentas existentes a partir de su
 * correo, pero deja fuera a propósito dos casos —la parte local no vale como
 * identificador, o dos consultorios la comparten—, y esas cuentas necesitan una
 * forma de reclamar el suyo. Es también donde se corrige un nombre mal elegido.
 *
 * Cada quien cambia el suyo y solo el suyo: el usuario sale del token, nunca
 * del cuerpo de la petición.
 */
exports.actualizarNombreUsuario = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const { nombre_usuario } = req.body;

    // Enviar vacío o nulo renuncia al nombre de usuario y libera la reserva.
    // La cuenta vuelve a entrar solo por correo, que nunca deja de funcionar.
    if (nombre_usuario === null || String(nombre_usuario ?? '').trim() === '') {
      await prisma.usuario.update({
        where: { id_usuario: req.user.id_usuario },
        data: { nombre_usuario: null }
      });
      return res.json({
        message: 'Se eliminó tu nombre de usuario. Seguirás entrando con tu correo.',
        nombre_usuario: null
      });
    }

    const comprobacion = validarNombreUsuario(nombre_usuario);
    if (!comprobacion.valido) {
      return res.status(400).json({ error: comprobacion.error });
    }

    const yaTomado = await prisma.usuario.findUnique({
      where: { nombre_usuario: comprobacion.valor },
      select: { id_usuario: true }
    });

    // Reasignarse el que ya se tiene no es un choque, es no cambiar nada.
    if (yaTomado && yaTomado.id_usuario !== req.user.id_usuario) {
      return res.status(409).json({ error: 'Ese nombre de usuario ya está en uso' });
    }

    const actualizado = await prisma.usuario.update({
      where: { id_usuario: req.user.id_usuario },
      data: { nombre_usuario: comprobacion.valor },
      select: { nombre_usuario: true }
    });

    // RF05: cambiar un identificador de acceso es un hecho de seguridad, y la
    // bitácora tiene que poder explicar por qué alguien empezó a entrar con un
    // nombre distinto del que tenía.
    await prisma.bitacoraAuditoria.create({
      data: {
        tenant_id: req.tenant_id,
        id_usuario: req.user.id_usuario,
        accion: 'CAMBIAR_NOMBRE_USUARIO',
        modulo: 'CONFIGURACION',
        detalle: `Nombre de usuario fijado en "${actualizado.nombre_usuario}"`,
        ip_adress: req.ip || '127.0.0.1'
      }
    });

    res.json({
      message: 'Nombre de usuario actualizado. Ya puedes entrar con él o con tu correo.',
      nombre_usuario: actualizado.nombre_usuario
    });
  } catch (error) {
    // La comprobación de arriba resuelve el caso normal; esto atrapa la
    // carrera entre dos peticiones simultáneas que pidan el mismo nombre. El
    // índice único es lo que decide de verdad, y sin esto devolvería un 500.
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Ese nombre de usuario ya está en uso' });
    }
    console.error('Error en actualizarNombreUsuario:', error);
    res.status(500).json({ error: 'Error actualizando el nombre de usuario' });
  }
};

/**
 * Cierre de sesión — RF05.
 *
 * El cierre era hasta ahora puramente del lado del cliente: el navegador
 * borraba el token y ya está. Sin este endpoint, la bitácora podía decir quién
 * entró pero no hasta cuándo estuvo dentro, que es la mitad de la pregunta.
 *
 * No invalida el token en el servidor —los JWT no se revocan sin una lista de
 * revocación— pero deja constancia de la intención de salir.
 */
exports.logout = async (req, res) => {
  try {
    await sesion.registrarSalida(req.user, req);
    res.json({ message: 'Sesión cerrada' });
  } catch (error) {
    console.error('Error en logout:', error);
    // No se devuelve error: el usuario debe poder salir siempre.
    res.json({ message: 'Sesión cerrada' });
  }
};
