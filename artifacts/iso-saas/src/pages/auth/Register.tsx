import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRegister } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const registerSchema = z.object({
  name: z.string().min(2, "O nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("E-mail corporativo inválido"),
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres"),
  companyName: z.string().min(2, "Nome da empresa é obrigatório"),
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function Register() {
  const [, setLocation] = useLocation();
  const { login: authenticate } = useAuth();
  const registerMutation = useRegister();
  const [errorMsg, setErrorMsg] = useState("");

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      companyName: "",
    },
  });

  const onSubmit = (data: RegisterForm) => {
    setErrorMsg("");
    registerMutation.mutate({ data }, {
      onSuccess: (res) => {
        authenticate(res.accessToken, res.user);
      },
      onError: (err) => {
        setErrorMsg(err.data?.error || "Ocorreu um erro ao criar sua conta. Tente novamente.");
      }
    });
  };

  return (
    <div className="min-h-screen flex flex-col justify-center p-4 bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-grid-black/[0.02] bg-[size:20px_20px] pointer-events-none" />
      <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md mx-auto space-y-8 relative z-10">
        <div className="flex flex-col items-center text-center space-y-2">
          <Link href="/">
            <img src="/logo.png" alt="Certifyr" className="h-14 mb-2 cursor-pointer" />
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Comece sua jornada</h1>
          <p className="text-muted-foreground">
            Crie sua conta e deixe nossa IA guiar sua empresa rumo à certificação ISO.
          </p>
        </div>

        <Card className="border-border shadow-xl">
          <CardContent className="pt-6">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {errorMsg && (
                <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{errorMsg}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="name">Seu nome completo</Label>
                <Input 
                  id="name" 
                  placeholder="João Silva" 
                  {...form.register("name")}
                  className={form.formState.errors.name ? "border-destructive" : ""}
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyName">Nome da sua empresa</Label>
                <Input 
                  id="companyName" 
                  placeholder="Acme Consultoria" 
                  {...form.register("companyName")}
                  className={form.formState.errors.companyName ? "border-destructive" : ""}
                />
                {form.formState.errors.companyName && (
                  <p className="text-sm text-destructive">{form.formState.errors.companyName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">E-mail corporativo</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="joao@acme.com.br" 
                  {...form.register("email")}
                  className={form.formState.errors.email ? "border-destructive" : ""}
                />
                {form.formState.errors.email && (
                  <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Crie uma senha segura</Label>
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
                className="w-full h-11 mt-2 text-base font-medium" 
                disabled={registerMutation.isPending}
              >
                {registerMutation.isPending ? "Criando conta..." : "Criar conta e começar"}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="justify-center pb-6 border-t border-border pt-6 bg-muted/20">
            <p className="text-sm text-muted-foreground">
              Já possui uma conta?{" "}
              <Link href="/" className="text-primary font-medium hover:underline">
                Faça login
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
