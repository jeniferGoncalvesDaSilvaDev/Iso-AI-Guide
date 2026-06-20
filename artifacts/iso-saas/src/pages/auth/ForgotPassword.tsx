import { useState } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { AlertCircle, MailCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const forgotSchema = z.object({
  email: z.string().email("E-mail inválido"),
});

type ForgotForm = z.infer<typeof forgotSchema>;

export default function ForgotPassword() {
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const form = useForm<ForgotForm>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (data: ForgotForm) => {
    setErrorMsg("");
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erro ao enviar email");
      }
      setSent(true);
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao enviar email. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex flex-col justify-center p-4 bg-background relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-black/[0.02] bg-[size:20px_20px] pointer-events-none" />
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-md mx-auto space-y-8 relative z-10">
          <div className="flex flex-col items-center text-center space-y-2">
            <img src="/logo.png" alt="Iso AI Guide" className="h-14 mb-2" />
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Email enviado! 📧</h1>
            <p className="text-muted-foreground">
              Se o email existir, você receberá um link para redefinir sua senha em instantes.
            </p>
          </div>

          <Card className="border-border shadow-xl">
            <CardContent className="pt-6 text-center">
              <div className="flex justify-center mb-4">
                <MailCheck className="h-16 w-16 text-primary" />
              </div>
              <p className="text-muted-foreground mb-2">
                Não recebeu? Verifique sua caixa de spam ou tente novamente.
              </p>
              <Button variant="outline" className="mt-2" onClick={() => setSent(false)}>
                Tentar novamente
              </Button>
            </CardContent>
            <CardFooter className="justify-center pb-6 border-t border-border pt-6 bg-muted/20">
              <p className="text-sm text-muted-foreground">
                Lembrou sua senha?{" "}
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

  return (
    <div className="min-h-screen flex flex-col justify-center p-4 bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-grid-black/[0.02] bg-[size:20px_20px] pointer-events-none" />
      <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md mx-auto space-y-8 relative z-10">
        <div className="flex flex-col items-center text-center space-y-2">
          <Link href="/">
            <img src="/logo.png" alt="Iso AI Guide" className="h-14 mb-2 cursor-pointer" />
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Esqueceu sua senha?</h1>
          <p className="text-muted-foreground">
            Digite seu email cadastrado e enviaremos um link para redefinir sua senha.
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
                <Label htmlFor="email">Seu e-mail corporativo</Label>
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

              <Button
                type="submit"
                className="w-full h-11 mt-2 text-base font-medium"
                disabled={isLoading}
              >
                {isLoading ? "Enviando..." : "Enviar link de recuperação"}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="justify-center pb-6 border-t border-border pt-6 bg-muted/20">
            <p className="text-sm text-muted-foreground">
              Lembrou sua senha?{" "}
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
