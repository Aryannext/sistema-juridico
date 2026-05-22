const prisma = require('../../config/prisma');
const { hashPassword, comparePassword } = require('../../utils/bcrypt');
const { signToken, generateOTP, generateVerificationToken } = require('../../utils/jwt');
const { sendEmail } = require('../../config/mailer');

const LOCK_TIME = 30 * 60 * 1000; // 30 minutes in ms
const MAX_ATTEMPTS = 5;

exports.registro = async (req, res) => {
  try {
    const { tipo, nombre_tenant, razon_social, nit, telefono, ciudad, email, password, nombre_admin } = req.body;

    // Validate if email already exists
    const existingUser = await prisma.usuario.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'El correo ya está registrado' });
    }

    const hashedPassword = await hashPassword(password);
    const tokenVerificacion = generateVerificationToken();

    // Perform inside a transaction
    const result = await prisma.$transaction(async (tx) => {
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
      const isAutoVerify = process.env.DEV_AUTO_VERIFY === 'true';
      const usuario = await tx.usuario.create({
        data: {
          tenant_id: tenant.id_tenant,
          nombre: nombre_admin,
          email,
          password_hash: hashedPassword,
          rol: 'ADMINISTRADOR',
          activo: isAutoVerify, // Active if auto-verify is enabled, else inactive until verified
          token_verificacion: isAutoVerify ? null : tokenVerificacion
        }
      });

      return { tenant, usuario };
    });

    const isAutoVerify = process.env.DEV_AUTO_VERIFY === 'true';
    const verificationUrl = `http://localhost:5173/verificacion?token=${tokenVerificacion}`;

    console.log('\n=========================================');
    console.log('DEV LOCAL REGISTRATION LOG:');
    console.log('Auto-Verify active:', isAutoVerify);
    console.log('Verification URL:', verificationUrl);
    console.log('=========================================\n');

    if (!isAutoVerify) {
      // Send verification email only if not auto-verified
      await sendEmail({
        to: email,
        subject: 'Verifica tu cuenta en SGPA',
        html: `<h1>Bienvenido a SGPA</h1>
               <p>Por favor verifica tu cuenta haciendo clic en el enlace:</p>
               <a href="${verificationUrl}">Verificar Cuenta</a>`
      });
    }

    res.status(201).json({
      message: isAutoVerify 
        ? 'Registro exitoso. Tu cuenta ha sido auto-verificada para desarrollo local.'
        : 'Registro exitoso. Revisa tu correo para verificar la cuenta.'
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

    if (!user) {
      return res.status(400).json({ error: 'Token inválido o expirado' });
    }

    await prisma.usuario.update({
      where: { id_usuario: user.id_usuario },
      data: {
        activo: true,
        token_verificacion: null
      }
    });

    res.json({ message: 'Cuenta verificada exitosamente. Ya puedes iniciar sesión.' });
  } catch (error) {
    res.status(500).json({ error: 'Error verificando cuenta' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.usuario.findUnique({ where: { email } });

    if (!user) {
      // Generic error
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Check if locked
    if (user.bloqueado_hasta && user.bloqueado_hasta > new Date()) {
      return res.status(403).json({ error: `Cuenta bloqueada temporalmente. Intenta nuevamente más tarde.` });
    }

    const isValid = await comparePassword(password, user.password_hash);

    if (!isValid) {
      const attempts = user.intentos_fallidos + 1;
      let updateData = { intentos_fallidos: attempts };
      
      if (attempts >= MAX_ATTEMPTS) {
        updateData.bloqueado_hasta = new Date(Date.now() + LOCK_TIME);
        // Could also send email to notify lock
      }

      await prisma.usuario.update({
        where: { id_usuario: user.id_usuario },
        data: updateData
      });

      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    if (!user.activo) {
      return res.status(403).json({ error: 'Cuenta inactiva. Verifica tu correo o contacta al administrador.' });
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

      console.log('\n=========================================');
      console.log('DEV LOCAL 2FA CODE LOG:');
      console.log('User:', user.email);
      console.log('2FA OTP Code:', otp);
      console.log('=========================================\n');

      try {
        await sendEmail({
          to: user.email,
          subject: 'Código de verificación SGPA',
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
    } catch(err) {
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
        create_at: true
      }
    });

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error obteniendo el perfil del usuario' });
  }
};
