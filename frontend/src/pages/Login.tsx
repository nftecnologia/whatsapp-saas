import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading } = useAuthStore();

  const from = location.state?.from?.pathname || '/';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      await login(data.email, data.password);
      toast.success('Login realizado com sucesso!');
      navigate(from, { replace: true });
    } catch (error) {
      // Error is already handled by the API service
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">WhatsApp SaaS</h1>
            <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">
              Faça login na sua conta
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Ou{' '}
              <Link
                to="/register"
                className="font-medium text-blue-600 hover:text-blue-500"
              >
                crie uma conta gratuita
              </Link>
            </p>
          </div>

          <div className="mt-8">
            <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
              <Input
                {...register('email')}
                type="email"
                label="Email"
                placeholder="seu@email.com"
                error={errors.email?.message}
                autoComplete="email"
              />

              <Input
                {...register('password')}
                type="password"
                label="Senha"
                placeholder="••••••••"
                error={errors.password?.message}
                autoComplete="current-password"
              />

              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <a
                    href="#"
                    className="font-medium text-blue-600 hover:text-blue-500"
                  >
                    Esqueceu sua senha?
                  </a>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                loading={isLoading}
              >
                Entrar
              </Button>
            </form>
          </div>
        </div>
      </div>
      <div className="hidden lg:block relative w-0 flex-1">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-purple-700">
          <div className="absolute inset-0 bg-black opacity-20"></div>
          <div className="relative flex items-center justify-center h-full">
            <div className="text-center text-white">
              <h3 className="text-3xl font-bold">
                Gerencie suas campanhas de WhatsApp
              </h3>
              <p className="mt-4 text-xl opacity-90">
                Plataforma completa para envio de mensagens em massa
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}