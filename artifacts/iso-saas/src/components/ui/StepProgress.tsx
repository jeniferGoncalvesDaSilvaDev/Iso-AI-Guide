import { Check } from "lucide-react";
import { Link } from "wouter";

export interface Step {
  number: number;
  label: string;
  description: string;
  href: string;
  status: "completed" | "current" | "upcoming";
}

interface StepProgressProps {
  steps: Step[];
}

export function StepProgress({ steps }: StepProgressProps) {
  return (
    <div className="w-full">
      <nav aria-label="Progresso">
        <ol className="flex items-center w-full">
          {steps.map((step, idx) => (
            <li
              key={step.number}
              className={`flex items-center ${idx < steps.length - 1 ? "flex-1" : ""}`}
            >
              <Link href={step.href} className="flex items-center gap-3 group">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors
                    ${step.status === "completed"
                      ? "border-primary bg-primary text-primary-foreground"
                      : step.status === "current"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-muted-foreground/30 bg-background text-muted-foreground"
                    }`}
                >
                  {step.status === "completed" ? (
                    <Check className="h-4 w-4" strokeWidth={3} />
                  ) : (
                    step.number
                  )}
                </span>
                <span className="hidden sm:flex flex-col">
                  <span
                    className={`text-xs font-semibold uppercase tracking-wide ${
                      step.status === "upcoming" ? "text-muted-foreground" : "text-foreground"
                    }`}
                  >
                    Passo {step.number}
                  </span>
                  <span
                    className={`text-sm font-medium ${
                      step.status === "current"
                        ? "text-primary"
                        : step.status === "completed"
                        ? "text-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {step.label}
                  </span>
                </span>
              </Link>

              {idx < steps.length - 1 && (
                <div className="flex-1 mx-3 sm:mx-4">
                  <div
                    className={`h-0.5 rounded-full transition-colors ${
                      step.status === "completed" ? "bg-primary" : "bg-muted-foreground/20"
                    }`}
                  />
                </div>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}

export function useWorkflowSteps(currentPath: string): Step[] {
  const steps: Array<Omit<Step, "status">> = [
    { number: 1, label: "Escolher Normas",   description: "Quais ISOs você quer?", href: "/app/normas"      },
    { number: 2, label: "Diagnóstico IA",    description: "Análise da empresa",    href: "/app/diagnostico" },
    { number: 3, label: "Gerar Documentos",  description: "Documentação completa", href: "/app/documentos"  },
  ];

  const currentIndex = steps.findIndex((s) => currentPath.startsWith(s.href));

  return steps.map((s, i) => ({
    ...s,
    status:
      i < currentIndex
        ? "completed"
        : i === currentIndex
        ? "current"
        : "upcoming",
  }));
}
