const prisma = require('../../config/prisma');
const { hashPassword, comparePassword } = require('../../utils/bcrypt');
const { signToken, generateOTP, generateVerificationToken } = require('../../utils/jwt');
const { sendEmail } = require('../../config/mailer');
const { validarPassword } = require('../../utils/password');

exports.registro = async (req, res) => {
  try {
    const { tipo, nombre_tenant, razon_social, nit, telefono, ciudad, email, password, nombre_admin } = req.body;

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
    const { email, password } = req.body;

    const user = await prisma.usuario.findUnique({
      where: { email },
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

      if (lockMinutes > 0) {
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
    
    // Todo: Record audit login
    
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
