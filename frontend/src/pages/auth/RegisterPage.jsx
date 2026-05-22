import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api/axios';
import { User, Building2, Lock, Mail, Scale, Phone, FileText } from 'lucide-react';
import { Toaster, toast } from 'sonner';

export default function RegisterPage() {
  const [tipo, setTipo] = useState('INDEPENDIENTE');
  const { register, handleSubmit, formState: { errors } } = useForm();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const payload = {
        ...data,
        tipo,
        nombre_tenant: tipo === 'INDEPENDIENTE' ? data.nombre_admin : data.nombre_consultorio
      };
      
      const response = await api.post('/auth/registro', payload);
      toast.success(response.data.message);
      
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al registrarse');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#0a0a0c] dark">
      <Toaster richColors theme="dark" />

      {/* Left side: Background Image */}
      <div className="hidden lg:flex w-1/2 relative items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src="/sgpa-bg.png" alt="Legal background" className="object-cover w-full h-full opacity-50" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0c] via-black/40 to-transparent"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] via-transparent to-transparent"></div>
        </div>
        <div className="relative z-10 p-12 text-center animate-fade-in">
          <div className="inline-flex items-center justify-center p-5 rounded-3xl bg-neutral-950/40 backdrop-blur-xl border border-white/10 mb-6 shadow-[0_0_30px_rgba(223,185,113,0.15)]">
            <Scale size={72} className="text-[#DFB971]" />
          </div>
          <h1 className="text-7xl font-extrabold tracking-widest uppercase mb-4 drop-shadow-2xl">
            <span className="bg-gradient-to-r from-[#DFB971] via-[#FFF1C6] to-[#DFB971] bg-clip-text text-transparent">SGPA</span>
          </h1>
          <p className="text-sm tracking-[0.4em] text-[#DFB971] uppercase font-bold drop-shadow-lg">Sistema de Gestión de Procesos</p>
        </div>
      </div>

      {/* Right side: Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 relative overflow-y-auto overflow-x-hidden custom-scrollbar">
        {/* Background decorations for mobile/right side */}
        <div className="fixed top-[-10%] right-[-10%] w-[60%] h-[60%] bg-[#DFB971]/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="fixed bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-white/5 blur-[100px] rounded-full pointer-events-none" />
        
        <div className="w-full max-w-[600px] z-10 animate-fade-in my-8">
          {/* Mobile Brand */}
          <div className="text-center mb-8 lg:hidden animate-float" style={{ animationDuration: '8s' }}>
            <div className="inline-flex items-center justify-center p-2.5 rounded-2xl bg-white/5 border border-white/10 mb-3 shadow-[0_0_20px_rgba(223,185,113,0.1)]">
              <Scale size={28} className="text-[#DFB971]" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-widest uppercase mb-1">
              <span className="bg-gradient-to-r from-[#DFB971] via-[#FFF1C6] to-[#DFB971] bg-clip-text text-transparent">SGPA</span>
            </h1>
          </div>

          <div className="bg-neutral-950/40 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.6)] rounded-3xl p-8 animate-scale-in">
            <div className="mb-8 text-center">
              <h2 className="text-2xl font-semibold text-white mb-2">Create an Account</h2>
              <p className="text-sm text-neutral-400">Select your profile type to join SGPA</p>
            </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <button 
              type="button"
              className={`flex flex-col items-center justify-center gap-3 p-4 rounded-2xl transition-all duration-300 border cursor-pointer ${
                tipo === 'INDEPENDIENTE' 
                  ? 'bg-white/10 border-[#DFB971] shadow-[0_0_15px_rgba(223,185,113,0.15)] text-[#DFB971]' 
                  : 'bg-transparent border-white/10 text-neutral-500 hover:text-white hover:bg-white/5'
              }`}
              onClick={() => setTipo('INDEPENDIENTE')}
            >
              <User size={28} />
              <span className="text-sm font-semibold uppercase tracking-wider">Independent</span>
            </button>
            <button 
              type="button"
              className={`flex flex-col items-center justify-center gap-3 p-4 rounded-2xl transition-all duration-300 border cursor-pointer ${
                tipo === 'CONSULTORIO' 
                  ? 'bg-white/10 border-[#DFB971] shadow-[0_0_15px_rgba(223,185,113,0.15)] text-[#DFB971]' 
                  : 'bg-transparent border-white/10 text-neutral-500 hover:text-white hover:bg-white/5'
              }`}
              onClick={() => setTipo('CONSULTORIO')}
            >
              <Building2 size={28} />
              <span className="text-sm font-semibold uppercase tracking-wider">Firm / Office</span>
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" autoComplete="off">
            {tipo === 'CONSULTORIO' && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-[#DFB971] uppercase tracking-wider">
                  Firm Name *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Building2 size={18} className="text-neutral-500" />
                  </div>
                  <input 
                    className="w-full bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:bg-white/10 focus:border-[#DFB971] transition-all rounded-xl pl-10 pr-4 py-3 outline-none"
                    placeholder="Enter the firm's name"
                    {...register('nombre_consultorio', { required: tipo === 'CONSULTORIO' ? 'El nombre es requerido' : false })}
                  />
                </div>
                {errors.nombre_consultorio && <p className="text-red-400 text-xs mt-1">{errors.nombre_consultorio.message}</p>}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-medium text-[#DFB971] uppercase tracking-wider">
                Full Name (Admin) *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <User size={18} className="text-neutral-500" />
                </div>
                <input 
                  className="w-full bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:bg-white/10 focus:border-[#DFB971] transition-all rounded-xl pl-10 pr-4 py-3 outline-none"
                  placeholder="Enter admin full name"
                  {...register('nombre_admin', { required: 'El nombre es requerido' })}
                />
              </div>
              {errors.nombre_admin && <p className="text-red-400 text-xs mt-1">{errors.nombre_admin.message}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-xs font-medium text-[#DFB971] uppercase tracking-wider">
                  Email Address *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Mail size={18} className="text-neutral-500" />
                  </div>
                  <input 
                    type="email" 
                    className="w-full bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:bg-white/10 focus:border-[#DFB971] transition-all rounded-xl pl-10 pr-4 py-3 outline-none"
                    placeholder="name@example.com"
                    {...register('email', { required: 'El correo es requerido' })}
                  />
                </div>
                {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-[#DFB971] uppercase tracking-wider">
                  Password *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock size={18} className="text-neutral-500" />
                  </div>
                  <input 
                    type="password" 
                    autoComplete="new-password"
                    className="w-full bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:bg-white/10 focus:border-[#DFB971] transition-all rounded-xl pl-10 pr-4 py-3 outline-none font-mono"
                    placeholder="••••••••"
                    {...register('password', { 
                      required: 'La contraseña es requerida',
                      minLength: { value: 8, message: 'Debe tener al menos 8 caracteres' },
                      pattern: {
                        value: /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
                        message: 'Falta mayúscula, número o especial'
                      }
                    })}
                  />
                </div>
                {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
              </div>
            </div>

            {tipo === 'CONSULTORIO' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-[#DFB971] uppercase tracking-wider">
                    Tax ID (NIT) <span className="text-neutral-500 normal-case">- Optional</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <FileText size={18} className="text-neutral-500" />
                    </div>
                    <input 
                      className="w-full bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:bg-white/10 focus:border-[#DFB971] transition-all rounded-xl pl-10 pr-4 py-3 outline-none"
                      placeholder="900.123.456-7"
                      {...register('nit')} 
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-[#DFB971] uppercase tracking-wider">
                    Phone <span className="text-neutral-500 normal-case">- Optional</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Phone size={18} className="text-neutral-500" />
                    </div>
                    <input 
                      className="w-full bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:bg-white/10 focus:border-[#DFB971] transition-all rounded-xl pl-10 pr-4 py-3 outline-none"
                      placeholder="+1 234 567 890"
                      {...register('telefono')} 
                    />
                  </div>
                </div>
              </div>
            )}

            <button 
              type="submit" 
              className="w-full bg-gradient-to-r from-[#C29B4F] to-[#E5C37A] hover:from-[#E5C37A] hover:to-[#C29B4F] text-black font-semibold shadow-[0_0_15px_rgba(223,185,113,0.3)] hover:shadow-[0_0_25px_rgba(223,185,113,0.5)] transition-all duration-300 rounded-xl py-3.5 uppercase tracking-wider text-sm mt-6 flex justify-center items-center cursor-pointer" 
              disabled={loading}
            >
              {loading ? (
                <svg className="animate-spin h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : 'Complete Registration'}
            </button>
          </form>

          </div>
          <div className="mt-8 text-center text-sm text-neutral-400">
            Already have an account?{' '}
            <Link to="/login" className="text-[#DFB971] hover:text-white transition-colors font-medium">
              Sign In Here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
