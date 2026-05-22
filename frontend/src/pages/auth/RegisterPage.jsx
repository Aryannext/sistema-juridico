import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api/axios';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
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
    <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-4">
      <Toaster richColors />
      <Card className="w-full max-w-lg shadow-2xl bg-black border-neutral-800 text-white mt-10 mb-10">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold tracking-tight">Crea tu cuenta en SGPA</CardTitle>
          <CardDescription className="text-neutral-400">Selecciona tu perfil para comenzar</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <Button 
              type="button"
              variant={tipo === 'INDEPENDIENTE' ? 'default' : 'outline'}
              className={`w-full ${tipo === 'INDEPENDIENTE' ? 'bg-white text-black hover:bg-neutral-200' : 'text-neutral-400 border-neutral-700 hover:text-white'}`}
              onClick={() => setTipo('INDEPENDIENTE')}
            >
              Abogado Independiente
            </Button>
            <Button 
              type="button"
              variant={tipo === 'CONSULTORIO' ? 'default' : 'outline'}
              className={`w-full ${tipo === 'CONSULTORIO' ? 'bg-white text-black hover:bg-neutral-200' : 'text-neutral-400 border-neutral-700 hover:text-white'}`}
              onClick={() => setTipo('CONSULTORIO')}
            >
              Consultorio Jurídico
            </Button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            
            {tipo === 'CONSULTORIO' && (
              <div className="space-y-2">
                <Label htmlFor="nombre_consultorio" className="text-neutral-300">Nombre del Consultorio *</Label>
                <Input 
                  id="nombre_consultorio" 
                  className="bg-neutral-900 border-neutral-700 text-white"
                  {...register('nombre_consultorio', { required: tipo === 'CONSULTORIO' ? 'El nombre es requerido' : false })}
                />
                {errors.nombre_consultorio && <p className="text-red-400 text-sm">{errors.nombre_consultorio.message}</p>}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="nombre_admin" className="text-neutral-300">Nombre Completo del Administrador *</Label>
              <Input 
                id="nombre_admin" 
                className="bg-neutral-900 border-neutral-700 text-white"
                {...register('nombre_admin', { required: 'El nombre es requerido' })}
              />
              {errors.nombre_admin && <p className="text-red-400 text-sm">{errors.nombre_admin.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-neutral-300">Correo Electrónico *</Label>
              <Input 
                id="email" 
                type="email" 
                className="bg-neutral-900 border-neutral-700 text-white"
                {...register('email', { required: 'El correo es requerido' })}
              />
              {errors.email && <p className="text-red-400 text-sm">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-neutral-300">Contraseña *</Label>
              <Input 
                id="password" 
                type="password" 
                className="bg-neutral-900 border-neutral-700 text-white"
                {...register('password', { 
                  required: 'La contraseña es requerida',
                  minLength: { value: 8, message: 'Debe tener al menos 8 caracteres' },
                  pattern: {
                    value: /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
                    message: 'Debe contener al menos una mayúscula, un número y un caracter especial'
                  }
                })}
              />
              {errors.password && <p className="text-red-400 text-sm">{errors.password.message}</p>}
            </div>

            {tipo === 'CONSULTORIO' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nit" className="text-neutral-300">NIT (Opcional)</Label>
                  <Input id="nit" className="bg-neutral-900 border-neutral-700 text-white" {...register('nit')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefono" className="text-neutral-300">Teléfono (Opcional)</Label>
                  <Input id="telefono" className="bg-neutral-900 border-neutral-700 text-white" {...register('telefono')} />
                </div>
              </div>
            )}

            <Button type="submit" className="w-full bg-white text-black hover:bg-neutral-200 mt-6" disabled={loading}>
              {loading ? 'Registrando...' : 'Completar Registro'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center border-t border-neutral-800 pt-6">
          <div className="text-sm text-neutral-400">
            ¿Ya tienes una cuenta?{' '}
            <Link to="/login" className="text-blue-400 hover:underline">
              Inicia sesión aquí
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
