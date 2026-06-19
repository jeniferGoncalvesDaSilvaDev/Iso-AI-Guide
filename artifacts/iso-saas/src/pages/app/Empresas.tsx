import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { 
  useGetCompany, 
  useUpdateCompany, 
  getGetCompanyQueryKey,
  getListDiagnosticsQueryKey
} from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Save, Building } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const companySchema = z.object({
  name: z.string().min(2, "Nome é obrigatório"),
  sector: z.string().min(2, "Setor é obrigatório"),
  size: z.enum(["micro", "pequena", "media", "grande"]),
  activity: z.string().optional(),
  description: z.string().optional(),
  cnpj: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

type CompanyForm = z.infer<typeof companySchema>;

export default function Empresas() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [initialized, setInitialized] = useState(false);

  const { data: company, isLoading } = useGetCompany(user?.companyId || "", {
    query: {
      enabled: !!user?.companyId,
      queryKey: user?.companyId ? getGetCompanyQueryKey(user.companyId) : ["company"]
    }
  });

  const updateMutation = useUpdateCompany();

  const form = useForm<CompanyForm>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: "",
      sector: "",
      size: "pequena",
      activity: "",
      description: "",
      cnpj: "",
      phone: "",
      address: "",
    },
  });

  if (company && !initialized) {
    form.reset({
      name: company.name,
      sector: company.sector,
      size: company.size,
      activity: company.activity || "",
      description: company.description || "",
      cnpj: company.cnpj || "",
      phone: company.phone || "",
      address: company.address || "",
    });
    setInitialized(true);
  }

  const onSubmit = (data: CompanyForm) => {
    if (!user?.companyId) return;

    updateMutation.mutate(
      { id: user.companyId, data },
      {
        onSuccess: () => {
          toast.success("Dados da empresa atualizados! Regenerando diagnóstico...");
          queryClient.invalidateQueries({ queryKey: getGetCompanyQueryKey(user.companyId!) });
          queryClient.invalidateQueries({ queryKey: getListDiagnosticsQueryKey({ companyId: user.companyId! }) });
          setLocation("/app/diagnostico");
        },
        onError: () => toast.error("Erro ao atualizar dados.")
      }
    );
  };

  if (!user?.companyId) {
    return <div className="p-8 text-center text-muted-foreground">Você não possui uma empresa vinculada.</div>;
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Minha Empresa</h1>
        <p className="text-muted-foreground mt-2">
          Gerencie o perfil da sua organização. Estes dados alimentam a IA para gerar documentos precisos.
        </p>
      </div>

      <Card>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-lg">
                <Building className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>Perfil Organizacional</CardTitle>
                <CardDescription>Informações básicas sobre o seu negócio.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome / Razão Social <span className="text-destructive">*</span></Label>
                    <Input id="name" {...form.register("name")} />
                    {form.formState.errors.name && <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cnpj">CNPJ</Label>
                    <Input id="cnpj" {...form.register("cnpj")} placeholder="00.000.000/0000-00" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sector">Setor de Atuação <span className="text-destructive">*</span></Label>
                    <Input id="sector" {...form.register("sector")} placeholder="Ex: Tecnologia, Indústria, Saúde" />
                    {form.formState.errors.sector && <p className="text-sm text-destructive">{form.formState.errors.sector.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Porte da Empresa <span className="text-destructive">*</span></Label>
                    <Select onValueChange={(v) => form.setValue("size", v as any)} defaultValue={form.getValues("size")}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o porte" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="micro">Microempresa</SelectItem>
                        <SelectItem value="pequena">Pequena Empresa</SelectItem>
                        <SelectItem value="media">Média Empresa</SelectItem>
                        <SelectItem value="grande">Grande Empresa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="activity">Atividade Principal</Label>
                  <Input id="activity" {...form.register("activity")} placeholder="Descreva brevemente o que sua empresa faz" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição Detalhada do Negócio</Label>
                  <Textarea 
                    id="description" 
                    {...form.register("description")} 
                    className="h-32"
                    placeholder="Conte-nos mais sobre seus processos, clientes e como vocês operam. Isso ajuda a IA a ser mais precisa."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input id="phone" {...form.register("phone")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Endereço Principal</Label>
                    <Input id="address" {...form.register("address")} />
                  </div>
                </div>
              </>
            )}
          </CardContent>
          <CardFooter className="flex justify-end border-t border-border pt-6 bg-muted/20">
            <Button type="submit" disabled={updateMutation.isPending || isLoading}>
              <Save className="mr-2 h-4 w-4" />
              {updateMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
