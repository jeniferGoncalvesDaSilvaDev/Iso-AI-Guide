import { db, standardsTable } from "@workspace/db";
import { logger } from "./lib/logger";

const ISO_STANDARDS = [
  {
    code: "ISO 9001:2015",
    name: "Sistema de Gestão da Qualidade",
    description: "A norma mais reconhecida mundialmente para sistemas de gestão da qualidade. Ajuda a garantir que produtos e serviços atendam consistentemente aos requisitos do cliente e que a qualidade seja continuamente melhorada.",
    category: "Gestão da Qualidade",
    benefits: [
      "Aumento da satisfação do cliente",
      "Melhoria contínua dos processos",
      "Redução de custos operacionais",
      "Maior credibilidade no mercado"
    ],
    applicableSectors: [
      "Indústria", "Serviços", "Comércio", "Saúde", "Educação", "Tecnologia", "Construção Civil"
    ]
  },
  {
    code: "ISO 14001:2015",
    name: "Sistema de Gestão Ambiental",
    description: "Define requisitos para um sistema de gestão ambiental que ajuda organizações a melhorar seu desempenho ambiental, cumprir obrigações e alcançar objetivos ambientais.",
    category: "Gestão Ambiental",
    benefits: [
      "Redução do impacto ambiental",
      "Conformidade com legislação ambiental",
      "Economia de recursos naturais",
      "Melhoria da imagem corporativa"
    ],
    applicableSectors: [
      "Indústria", "Construção Civil", "Mineração", "Agronegócio", "Transporte", "Energia"
    ]
  },
  {
    code: "ISO 45001:2018",
    name: "Sistema de Gestão de Saúde e Segurança Ocupacional",
    description: "Estabelece requisitos para um sistema de gestão de saúde e segurança ocupacional, ajudando a reduzir lesões, doenças e acidentes no trabalho.",
    category: "Saúde e Segurança",
    benefits: [
      "Redução de acidentes de trabalho",
      "Ambiente de trabalho mais seguro",
      "Conformidade com requisitos legais",
      "Redução de afastamentos"
    ],
    applicableSectors: [
      "Indústria", "Construção Civil", "Mineração", "Saúde", "Transporte", "Energia"
    ]
  },
  {
    code: "ISO 22000:2018",
    name: "Sistema de Gestão de Segurança de Alimentos",
    description: "Define requisitos para um sistema de gestão de segurança de alimentos para organizações em toda a cadeia alimentar.",
    category: "Segurança de Alimentos",
    benefits: [
      "Alimentos mais seguros para o consumidor",
      "Conformidade com regulamentações",
      "Rastreabilidade aprimorada",
      "Acesso a novos mercados"
    ],
    applicableSectors: [
      "Alimentício", "Bebidas", "Agronegócio", "Logística", "Hotelaria", "Restaurantes"
    ]
  },
  {
    code: "ISO 27001:2022",
    name: "Sistema de Gestão de Segurança da Informação",
    description: "Especifica requisitos para estabelecer, implementar, manter e melhorar um sistema de gestão de segurança da informação, protegendo dados e informações sensíveis.",
    category: "Segurança da Informação",
    benefits: [
      "Proteção de dados sensíveis",
      "Conformidade com LGPD",
      "Prevenção de vazamentos",
      "Confiança de clientes e parceiros"
    ],
    applicableSectors: [
      "Tecnologia", "Finanças", "Saúde", "Telecomunicações", "Governo", "E-commerce"
    ]
  },
  {
    code: "ISO 37001:2016",
    name: "Sistema de Gestão Antissuborno",
    description: "Fornece requisitos e orientações para estabelecer, implementar e melhorar um sistema de gestão antissuborno, ajudando a prevenir, detectar e responder ao suborno.",
    category: "Compliance",
    benefits: [
      "Prevenção de corrupção",
      "Conformidade com legislação",
      "Maior transparência",
      "Confiança de stakeholders"
    ],
    applicableSectors: [
      "Governo", "Indústria", "Serviços", "Construção Civil", "Finanças", "Saúde"
    ]
  },
  {
    code: "ISO 50001:2018",
    name: "Sistema de Gestão de Energia",
    description: "Ajuda organizações a estabelecer sistemas e processos necessários para melhorar o desempenho energético, incluindo eficiência, uso e consumo de energia.",
    category: "Gestão de Energia",
    benefits: [
      "Redução de custos com energia",
      "Eficiência energética",
      "Redução de emissões",
      "Conformidade com regulamentações"
    ],
    applicableSectors: [
      "Indústria", "Energia", "Construção Civil", "Transporte", "Comércio", "Serviços"
    ]
  }
];

export async function seedStandards(): Promise<void> {
  const existing = await db.select({ code: standardsTable.code }).from(standardsTable);

  if (existing.length > 0) {
    logger.info({ count: existing.length }, "Standards already seeded, skipping");
    return;
  }

  logger.info("Seeding ISO standards...");

  for (const standard of ISO_STANDARDS) {
    await db.insert(standardsTable).values({
      code: standard.code,
      name: standard.name,
      description: standard.description,
      category: standard.category,
      benefits: standard.benefits,
      applicableSectors: standard.applicableSectors,
    });
  }

  logger.info({ count: ISO_STANDARDS.length }, "Standards seeded successfully");
}
