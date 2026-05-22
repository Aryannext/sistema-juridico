import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { Toaster, toast } from 'sonner';
import { CheckCircle2, XCircle, Scale } from 'lucide-react';

export default function VerificacionPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState('verifying');
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      setStatus('error');
      return;
    }

    const verify = async () => {
      try {
        await api.get(`/auth/verificar/${token}`);
        setStatus('success');
      } catch (error) {
        setStatus('error');
        toast.error(error.response?.data?.error || 'Token inválido');
      }
    };

    verify();
  }, [token]);

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

        <div className="bg-neutral-950/40 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.6)] rounded-3xl p-8 animate-scale-in text-center">
          <div className="flex justify-center mb-6">
            {status === 'verifying' && (
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[#DFB971]"></div>
            )}
            {status === 'success' && <CheckCircle2 className="h-16 w-16 text-green-400" />}
            {status === 'error' && <XCircle className="h-16 w-16 text-red-500" />}
          </div>
          
          <h2 className="text-2xl font-semibold text-white mb-3 tracking-wide">
            {status === 'verifying' && 'Verifying Account...'}
            {status === 'success' && 'Account Verified!'}
            {status === 'error' && 'Verification Failed'}
          </h2>
          
          <p className="text-sm text-neutral-400 mb-8">
            {status === 'verifying' && 'Please wait while we confirm your credentials.'}
            {status === 'success' && 'Your email has been confirmed successfully. You can now securely access the system.'}
            {status === 'error' && 'The verification link may have expired or is invalid. Please try registering again or contact support.'}
          </p>
          
          {status !== 'verifying' && (
            <button 
              className="w-full bg-gradient-to-r from-[#C29B4F] to-[#E5C37A] hover:from-[#E5C37A] hover:to-[#C29B4F] text-black font-semibold shadow-[0_0_15px_rgba(223,185,113,0.3)] hover:shadow-[0_0_25px_rgba(223,185,113,0.5)] transition-all duration-300 rounded-xl py-3.5 uppercase tracking-wider text-sm flex justify-center items-center cursor-pointer"
              onClick={() => navigate('/login')}
            >
              Return to Login
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
