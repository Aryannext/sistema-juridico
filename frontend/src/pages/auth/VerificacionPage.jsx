import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Toaster, toast } from 'sonner';
import { CheckCircle2, XCircle } from 'lucide-react';

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
    <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-4">
      <Toaster richColors />
      <Card className="w-full max-w-md shadow-2xl bg-black border-neutral-800 text-white text-center py-8">
        <CardHeader>
          <div className="flex justify-center mb-4">
            {status === 'verifying' && <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>}
            {status === 'success' && <CheckCircle2 className="h-16 w-16 text-green-500" />}
            {status === 'error' && <XCircle className="h-16 w-16 text-red-500" />}
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            {status === 'verifying' && 'Verificando cuenta...'}
            {status === 'success' && '¡Cuenta verificada!'}
            {status === 'error' && 'Error de verificación'}
          </CardTitle>
          <CardDescription className="text-neutral-400 mt-2">
            {status === 'verifying' && 'Por favor espera unos segundos.'}
            {status === 'success' && 'Tu correo ha sido confirmado exitosamente. Ya puedes acceder al sistema.'}
            {status === 'error' && 'El enlace puede haber expirado o es inválido.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="mt-4">
          {status !== 'verifying' && (
            <Button 
              className="w-full bg-white text-black hover:bg-neutral-200"
              onClick={() => navigate('/login')}
            >
              Ir a Iniciar Sesión
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
