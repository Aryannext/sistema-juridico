import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { ShieldCheck, Scale } from 'lucide-react';
import { Toaster, toast } from 'sonner';

export default function TwoFactorPage() {
  const [codigo, setCodigo] = useState('');
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();
  
  const preAuthToken = location.state?.preAuthToken;

  if (!preAuthToken) {
    navigate('/login', { replace: true });
    return null;
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await api.post('/auth/2fa/verificar', { codigo, preAuthToken });
      login(response.data.user, response.data.token);
      toast.success('Autenticación exitosa');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Código inválido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center p-4 relative overflow-hidden dark">
      {/* Background decorations */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#DFB971]/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-white/5 blur-[100px] rounded-full pointer-events-none" />
      
      <Toaster richColors theme="dark" />
      
      <div className="w-full max-w-[420px] z-10 animate-fade-in">
        <div className="text-center mb-8 animate-float">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/10 mb-4 shadow-[0_0_20px_rgba(223,185,113,0.15)]">
            <Scale size={32} className="text-[#DFB971]" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-widest uppercase mb-1">
            <span className="bg-gradient-to-r from-[#DFB971] via-[#FFF1C6] to-[#DFB971] bg-clip-text text-transparent">Lexica</span>
          </h1>
        </div>

        <div className="bg-neutral-950/40 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.6)] rounded-3xl p-8 animate-scale-in">
          <div className="mb-8 text-center flex flex-col items-center">
            <ShieldCheck size={40} className="text-[#DFB971] mb-3" />
            <h2 className="text-2xl font-semibold text-white mb-2">Two-Factor Auth</h2>
            <p className="text-sm text-neutral-400">Enter the 6-digit code sent to your email</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-6">
            <div className="space-y-3">
              <label htmlFor="codigo" className="text-xs font-medium text-[#DFB971] uppercase tracking-wider text-center block">
                Security Code
              </label>
              <input 
                id="codigo" 
                type="text" 
                maxLength={6}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="000000"
                className="w-full bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:bg-white/10 focus:border-[#DFB971] transition-all rounded-xl py-4 outline-none text-center text-3xl tracking-[0.5em] font-mono text-white placeholder-neutral-700"
                required
              />
            </div>
            
            <button 
              type="submit" 
              className="w-full bg-gradient-to-r from-[#C29B4F] to-[#E5C37A] hover:from-[#E5C37A] hover:to-[#C29B4F] text-black font-semibold shadow-[0_0_15px_rgba(223,185,113,0.3)] hover:shadow-[0_0_25px_rgba(223,185,113,0.5)] transition-all duration-300 rounded-xl py-3.5 uppercase tracking-wider text-sm mt-4 flex justify-center items-center cursor-pointer" 
              disabled={loading || codigo.length < 6}
            >
              {loading ? (
                <svg className="animate-spin h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : 'Verify Identity'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
