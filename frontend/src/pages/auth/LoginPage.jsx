import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import { Toaster, toast } from 'sonner';

export default function LoginPage() {
  const { register, handleSubmit, formState: { errors } } = useForm();
  const [loading, setLoading] = useState(false);
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
    <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-4">
      <Toaster richColors />
      <Card className="w-full max-w-md shadow-2xl bg-black border-neutral-800 text-white">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold tracking-tight">Bienvenido a SGPA</CardTitle>
          <CardDescription className="text-neutral-400">Ingresa tus credenciales para acceder</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-neutral-300">Correo Electrónico</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="usuario@ejemplo.com"
                className="bg-neutral-900 border-neutral-700 text-white focus-visible:ring-neutral-500"
                {...register('email', { required: 'El correo es requerido' })}
              />
              {errors.email && <p className="text-red-400 text-sm">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-neutral-300">Contraseña</Label>
                <Link to="#" className="text-sm font-medium text-blue-400 hover:text-blue-300">
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <Input 
                id="password" 
                type="password" 
                className="bg-neutral-900 border-neutral-700 text-white focus-visible:ring-neutral-500"
                {...register('password', { required: 'La contraseña es requerida' })}
              />
              {errors.password && <p className="text-red-400 text-sm">{errors.password.message}</p>}
            </div>
            <Button type="submit" className="w-full bg-white text-black hover:bg-neutral-200" disabled={loading}>
              {loading ? 'Iniciando...' : 'Iniciar Sesión'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4 text-center">
          <div className="text-sm text-neutral-400">
            ¿No tienes un consultorio registrado?{' '}
            <Link to="/registro" className="text-blue-400 hover:underline">
              Regístrate aquí
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
