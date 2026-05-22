import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
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
    <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-4">
      <Toaster richColors />
      <Card className="w-full max-w-md shadow-2xl bg-black border-neutral-800 text-white">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold tracking-tight">Autenticación de 2 Pasos</CardTitle>
          <CardDescription className="text-neutral-400">
            Ingresa el código de 6 dígitos enviado a tu correo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="codigo" className="text-neutral-300">Código de Seguridad</Label>
              <Input 
                id="codigo" 
                type="text" 
                maxLength={6}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="000000"
                className="bg-neutral-900 border-neutral-700 text-white focus-visible:ring-neutral-500 text-center text-2xl tracking-[0.5em]"
                required
              />
            </div>
            <Button type="submit" className="w-full bg-white text-black hover:bg-neutral-200" disabled={loading || codigo.length < 6}>
              {loading ? 'Verificando...' : 'Verificar Código'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
