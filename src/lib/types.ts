export type ActivityStatus = "planejado" | "em_andamento" | "concluido";

export interface Activity {
  id: string;
  title: string;
  description: string | null;
  status: ActivityStatus;
  date: string;
  created_at: string;
}

export type PaymentCategory =
  | "material"
  | "mao_de_obra"
  | "projeto"
  | "equipamento"
  | "outros";

export interface Payment {
  id: string;
  description: string;
  amount: number;
  category: PaymentCategory;
  supplier: string | null;
  date: string;
  receipt_path: string | null;
  activity_id: string | null;
  created_at: string;
}

export type DocumentCategory =
  | "contrato"
  | "nota_fiscal"
  | "projeto"
  | "alvara"
  | "outros";

export interface Doc {
  id: string;
  name: string;
  category: DocumentCategory;
  file_path: string;
  activity_id: string | null;
  date: string;
  created_at: string;
}

export interface Photo {
  id: string;
  description: string | null;
  photo_path: string;
  activity_id: string | null;
  date: string;
  created_at: string;
}

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  estimated_price: number | null;
  done: boolean;
  activity_id: string | null;
  created_at: string;
}

export const STATUS_LABELS: Record<ActivityStatus, string> = {
  planejado: "Planejado",
  em_andamento: "Em andamento",
  concluido: "Concluído",
};

export const CATEGORY_LABELS: Record<PaymentCategory, string> = {
  material: "Material",
  mao_de_obra: "Mão de obra",
  projeto: "Projeto",
  equipamento: "Equipamento",
  outros: "Outros",
};

export const DOC_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  contrato: "Contrato",
  nota_fiscal: "Nota fiscal",
  projeto: "Projeto",
  alvara: "Alvará",
  outros: "Outros",
};
