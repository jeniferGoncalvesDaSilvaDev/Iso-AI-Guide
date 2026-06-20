import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const { login: authenticate } = useAuth();
  const loginMutation = useLogin();
  const [errorMsg, setErrorMsg] = useState("");

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = (data: LoginForm) => {
    setErrorMsg("");
    loginMutation.mutate({ data }, {
      onSuccess: (res) => {
        authenticate(res.accessToken, res.user);
      },
      onError: (err) => {
        setErrorMsg(err.data?.error || "Ocorreu um erro ao fazer login. Verifique suas credenciais.");
      }
    });
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8">
          <div className="flex flex-col items-center text-center space-y-2">
            <img src="/logo.png" alt="Certifyr" className="h-14 mb-2" />
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Bem-vindo de volta</h1>
            <p className="text-muted-foreground">
              Acesse sua conta para continuar sua jornada de certificação.
            </p>
          </div>

          <Card className="border-border shadow-lg">
            <CardContent className="pt-6">
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {errorMsg && (
                  <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{errorMsg}</AlertDescription>
                  </Alert>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail corporativo</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="voce@empresa.com.br" 
                    {...form.register("email")}
                    className={form.formState.errors.email ? "border-destructive" : ""}
                  />
                  {form.formState.errors.email && (
                    <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Senha</Label>
                    <Link href="/esqueci-senha" className="text-sm text-primary hover:underline">Esqueceu a senha?</Link>
                  </div>
                  <Input 
                    id="password" 
                    type="password" 
                    placeholder="••••••••" 
                    {...form.register("password")}
                    className={form.formState.errors.password ? "border-destructive" : ""}
                  />
                  {form.formState.errors.password && (
                    <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
                  )}
                </div>

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? "Entrando..." : "Entrar na plataforma"}
                </Button>
              </form>
            </CardContent>
            <CardFooter className="justify-center pb-6 border-t border-border pt-6">
              <p className="text-sm text-muted-foreground">
                Ainda não tem uma conta?{" "}
                <Link href="/cadastro" className="text-primary font-medium hover:underline">
                  Comece agora
                </Link>
              </p>
            </CardFooter>
          </Card>
        </div>
      </div>
      
      <div className="hidden md:flex flex-col justify-center p-12 bg-primary/5 border-l border-border relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-black/[0.02] bg-[size:20px_20px]" />
        <div className="relative z-10 max-w-lg mx-auto">
          <h2 className="text-4xl font-bold text-foreground mb-6 leading-tight">
            A certificação ISO não precisa ser um fardo.
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Nossa IA transforma processos complexos em passos simples, claros e acionáveis. Reduza o tempo de certificação em até 60%.
          </p>
          <div className="space-y-4">
            {[
              "Consultoria especializada 24/7",
              "Geração de documentos em minutos",
              "Linguagem simples e direta",
              "Conformidade garantida"
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-3 bg-background/60 p-4 rounded-lg border border-border/50 backdrop-blur-sm shadow-sm">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                </div>
                <span className="font-medium text-foreground">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
