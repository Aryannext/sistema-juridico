import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { Lock, Mail, Eye, EyeOff, Scale } from 'lucide-react';
import { Toaster, toast } from 'sonner';

export default function LoginPage() {
  const { register, handleSubmit, formState: { errors } } = useForm();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const response = await api.post('/auth/login', data);
      
      if (response.data.require2FA) {
        toast.info('Verificación de dos pasos requerida');
        navigate('/2fa', { state: { preAuthToken: response.data.preAuthToken } });
      } else {
        login(response.data.user, response.data.token);
        toast.success('Inicio de sesión exitoso');
        navigate('/dashboard');
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al iniciar sesión');
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
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Background decorations for mobile/right side */}
        <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-[#DFB971]/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-white/5 blur-[100px] rounded-full pointer-events-none" />
        
        <div className="w-full max-w-[420px] z-10 animate-fade-in">
          {/* Mobile Brand */}
          <div className="text-center mb-8 lg:hidden animate-float">
            <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/10 mb-4 shadow-[0_0_20px_rgba(223,185,113,0.15)]">
              <Scale size={32} className="text-[#DFB971]" />
            </div>
            <h1 className="text-4xl font-extrabold tracking-widest uppercase mb-1">
              <span className="bg-gradient-to-r from-[#DFB971] via-[#FFF1C6] to-[#DFB971] bg-clip-text text-transparent">SGPA</span>
            </h1>
            <p className="text-xs tracking-[0.2em] text-neutral-400 uppercase">Legal System</p>
          </div>

          <div className="bg-neutral-950/40 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.6)] rounded-3xl p-8 animate-scale-in">
            <div className="mb-8 text-center">
              <h2 className="text-2xl font-semibold text-white mb-2">Welcome to SGPA</h2>
              <p className="text-sm text-neutral-400">Secure Portal for Legal Professionals</p>
            </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="email" className="text-xs font-medium text-[#DFB971] uppercase tracking-wider">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail size={18} className="text-neutral-500" />
                </div>
                <input 
                  id="email" 
                  type="email" 
                  placeholder="Enter your email"
                  autoComplete="off"
                  className="w-full bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:bg-white/10 focus:border-[#DFB971] transition-all rounded-xl pl-10 pr-4 py-3 outline-none"
                  {...register('email', { required: 'El correo es requerido' })}
                />
              </div>
              {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-xs font-medium text-[#DFB971] uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock size={18} className="text-neutral-500" />
                </div>
                <input 
                  id="password" 
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="w-full bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:bg-white/10 focus:border-[#DFB971] transition-all rounded-xl pl-10 pr-12 py-3 outline-none tracking-widest font-mono"
                  {...register('password', { required: 'La contraseña es requerida' })}
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-neutral-500 hover:text-white transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <div className="flex items-center justify-end">
              <Link to="#" className="text-xs font-medium text-neutral-400 hover:text-[#DFB971] transition-colors">
                Forgot Password?
              </Link>
            </div>

            <button 
              type="submit" 
              className="w-full bg-gradient-to-r from-[#C29B4F] to-[#E5C37A] hover:from-[#E5C37A] hover:to-[#C29B4F] text-black font-semibold shadow-[0_0_15px_rgba(223,185,113,0.3)] hover:shadow-[0_0_25px_rgba(223,185,113,0.5)] transition-all duration-300 rounded-xl py-3.5 uppercase tracking-wider text-sm mt-4 flex justify-center items-center cursor-pointer" 
              disabled={loading}
            >
              {loading ? (
                <svg className="animate-spin h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : 'Sign In'}
            </button>
          </form>

          </div>
          <div className="mt-8 text-center text-sm text-neutral-400">
            New User?{' '}
            <Link to="/registro" className="text-[#DFB971] hover:text-white transition-colors font-medium">
              Register Now
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

