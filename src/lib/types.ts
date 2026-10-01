export type ActivityStatus = "planejado" | "em_andamento" | "concluido";

export interface Activity {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  status: ActivityStatus;
  date: string;
  planned_start: string | null;
  planned_end: string | null;
  created_at: string;
}

export type PaymentCategory =
  | "material"
  | "mao_de_obra"
  | "projeto"
  | "equipamento"
  | "documentacao"
  | "outros";

export interface Payment {
  id: string;
  organization_id: string;
  description: string;
  amount: number;
  category: PaymentCategory;
  supplier: string | null;
  account: string | null;
  account_id: string | null;
  date: string;
  receipt_path: string | null;
  invoice_path: string | null;
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
  organization_id: string;
  name: string;
  category: DocumentCategory;
  file_path: string;
  activity_id: string | null;
  folder_id: string | null;
  date: string;
  created_at: string;
}

export interface Folder {
  id: string;
  organization_id: string;
  name: string;
  created_at: string;
}

export interface Budget {
  id: string;
  organization_id: string;
  category: PaymentCategory | null;
  activity_id: string | null;
  amount: number;
  created_at: string;
}

export interface Account {
  id: string;
  organization_id: string;
  name: string;
  active: boolean;
  created_at: string;
}

export type InstallmentStatus = "pendente" | "pago";

export interface Installment {
  id: string;
  organization_id: string;
  description: string;
  amount: number;
  category: PaymentCategory;
  supplier: string | null;
  account: string | null;
  account_id: string | null;
  due_date: string;
  activity_id: string | null;
  status: InstallmentStatus;
  paid_payment_id: string | null;
  created_at: string;
}

export interface Photo {
  id: string;
  organization_id: string;
  description: string | null;
  photo_path: string;
  activity_id: string | null;
  date: string;
  created_at: string;
}

export interface ShoppingItem {
  id: string;
  organization_id: string;
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
  documentacao: "Documentação e taxas",
  outros: "Outros",
};

export const DOC_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  contrato: "Contrato",
  nota_fiscal: "Nota fiscal",
  projeto: "Projeto",
  alvara: "Alvará",
  outros: "Outros",
};

// ---------------------------------------------------------------------------
// Diário de Obra (RDO)
// ---------------------------------------------------------------------------

export type WeatherCondition = "sol" | "parcial" | "nublado" | "chuva" | "chuva_forte";
export type ReportStatus = "rascunho" | "finalizado";

export interface DailyReport {
  id: string;
  organization_id: string;
  report_number: number;
  report_date: string;
  weather_morning: WeatherCondition | null;
  weather_afternoon: WeatherCondition | null;
  workable_morning: boolean;
  workable_afternoon: boolean;
  temp_min: number | null;
  temp_max: number | null;
  rain_mm: number | null;
  work_start: string | null;
  work_end: string | null;
  summary: string | null;
  notes: string | null;
  status: ReportStatus;
  signed_by: string | null;
  finalized_at: string | null;
  created_at: string;
}

export interface ReportLabor {
  id: string;
  organization_id: string;
  report_id: string;
  role: string;
  quantity: number;
  note: string | null;
  created_at: string;
}

export interface ReportEquipment {
  id: string;
  organization_id: string;
  report_id: string;
  name: string;
  quantity: number;
  note: string | null;
  created_at: string;
}

export type ReportActivityStatus = "iniciada" | "em_andamento" | "concluida" | "paralisada";

export interface ReportActivity {
  id: string;
  organization_id: string;
  report_id: string;
  activity_id: string | null;
  description: string;
  status: ReportActivityStatus;
  progress: number;
  created_at: string;
}

export type OccurrenceType =
  | "clima"
  | "atraso"
  | "acidente"
  | "visita"
  | "entrega"
  | "nao_conformidade"
  | "paralisacao"
  | "outros";

export interface ReportOccurrence {
  id: string;
  organization_id: string;
  report_id: string;
  type: OccurrenceType;
  description: string;
  is_pending: boolean;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
}

export interface ReportMaterial {
  id: string;
  organization_id: string;
  report_id: string;
  name: string;
  quantity: string | null;
  supplier: string | null;
  created_at: string;
}

export const WEATHER_LABELS: Record<WeatherCondition, string> = {
  sol: "Sol",
  parcial: "Parcialmente nublado",
  nublado: "Nublado",
  chuva: "Chuva",
  chuva_forte: "Chuva forte",
};

export const REPORT_ACTIVITY_STATUS_LABELS: Record<ReportActivityStatus, string> = {
  iniciada: "Iniciada",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  paralisada: "Paralisada",
};

export const OCCURRENCE_TYPE_LABELS: Record<OccurrenceType, string> = {
  clima: "Clima",
  atraso: "Atraso",
  acidente: "Acidente / segurança",
  visita: "Visita técnica",
  entrega: "Entrega de material",
  nao_conformidade: "Não conformidade",
  paralisacao: "Paralisação",
  outros: "Outros",
};

// ---------------------------------------------------------------------------
// Orçamentos de compra (cotação com vários fornecedores)
// ---------------------------------------------------------------------------

export type QuotationStatus = "aberto" | "fechado" | "cancelado";

export const QUOTATION_STATUS_LABELS: Record<QuotationStatus, string> = {
  aberto: "Em cotação",
  fechado: "Fornecedor escolhido",
  cancelado: "Cancelado",
};

export interface Quotation {
  id: string;
  organization_id: string;
  title: string;
  category: PaymentCategory;
  activity_id: string | null;
  notes: string | null;
  status: QuotationStatus;
  chosen_supplier_id: string | null;
  installment_id: string | null;
  created_at: string;
}

export interface QuotationItem {
  id: string;
  organization_id: string;
  quotation_id: string;
  description: string;
  quantity: number;
  unit: string | null;
  position: number;
}

export interface QuotationSupplier {
  id: string;
  organization_id: string;
  quotation_id: string;
  name: string;
  freight: number;
  payment_terms: string | null;
  delivery_time: string | null;
  notes: string | null;
  position: number;
  discount_type: "valor" | "percentual";
  discount_value: number;
  subtotal_override: number | null;
  total_override: number | null;
  payment_method: string | null;
  installments_count: number;
}

export interface QuotationPrice {
  id: string;
  organization_id: string;
  quotation_id: string;
  supplier_id: string;
  item_id: string;
  unit_price: number;
  line_total_override: number | null;
}

export interface QuotationAttachment {
  id: string;
  organization_id: string;
  quotation_id: string;
  supplier_id: string | null;
  name: string;
  file_path: string;
  created_at: string;
}
