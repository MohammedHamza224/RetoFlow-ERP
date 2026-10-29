// Core Database Entity Definitions for RestoFlow

export type UserRole = 'ADMIN' | 'MANAGER' | 'CASHIER' | 'STAFF';

export type CustomerType = 'GUEST' | 'REGULAR' | 'VIP';

export type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED';

export type OrderType = 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';

export type CancellationReason = 
  | 'CUSTOMER_REQUEST'
  | 'OUT_OF_STOCK'
  | 'DUPLICATE_ORDER'
  | 'WRONG_ORDER'
  | 'OTHER';

export type PaymentMethod = 'CASH' | 'CARD' | 'MADA' | 'APPLE_PAY' | 'OTHER';

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

export type PurchaseStatus = 
  | 'DRAFT' 
  | 'APPROVED' 
  | 'PENDING_RECEIPT' 
  | 'PARTIALLY_RECEIVED' 
  | 'RECEIVED' 
  | 'CANCELLED';

export type InvoiceStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';

export type InvoicePaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';

// 1. Role
export interface Role {
  id: string;
  name: UserRole;
  description?: string;
  created_at: string;
}

// 2. User
export interface User {
  id: string;
  role_id: string;
  role?: Role;
  name: string;
  email: string;
  phone?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// 3. Category
export interface Category {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// 4. Product
export interface Product {
  id: string;
  category_id: string;
  category?: Category;
  name: string;
  description?: string;
  sku: string;
  price: number;
  cost: number;
  stock_quantity: number;
  minimum_stock: number;
  image_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// 5. Customer
export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  customer_type: CustomerType;
  is_active?: boolean;
  created_at: string;
  updated_at: string;
}

// 6. Restaurant Table
export interface RestaurantTable {
  id: string;
  table_number: string;
  capacity: number;
  status: TableStatus;
  location: string;
  created_at: string;
  updated_at: string;
}

// 7. Order
export interface Order {
  id: string;
  order_number: string; // Business format: ORD-000001
  customer_id?: string;
  customer?: Customer;
  table_id?: string;
  table?: RestaurantTable;
  user_id: string;
  user?: User;
  order_type: OrderType;
  status: OrderStatus;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  notes?: string;
  cancelled_at?: string;
  cancelled_by?: string;
  cancellation_reason?: CancellationReason;
  stock_deducted: boolean;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
  payments?: Payment[];
}

// 8. Order Item
export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product?: Product;
  quantity: number;
  unit_price: number; // Snapshot price at sale
  unit_cost: number;  // Snapshot cost at sale for historical profit calculations
  discount: number;
  total: number;
  notes?: string;
  created_at: string;
}

// 9. Payment
export interface Payment {
  id: string;
  order_id: string;
  payment_method: PaymentMethod;
  amount: number;
  status: PaymentStatus;
  transaction_reference?: string;
  paid_at: string;
  created_at: string;
}

// 10. Supplier
export interface Supplier {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  tax_number?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// 11. Purchase (Purchase Order)
export interface Purchase {
  id: string;
  supplier_id: string;
  supplier?: Supplier;
  invoice_number: string;
  subtotal: number;
  discount?: number;
  tax: number;
  total: number;
  status: PurchaseStatus;
  notes?: string;
  expected_delivery_date?: string;
  purchase_date: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  items?: PurchaseItem[];
  goods_receipts?: GoodsReceipt[];
  invoices?: PurchaseInvoice[];
}

// 12. Purchase Item (PO Line Item)
export interface PurchaseItem {
  id: string;
  purchase_id: string;
  product_id: string;
  product?: Product;
  quantity: number;
  received_quantity?: number;
  unit_cost: number;
  total_cost: number;
  created_at: string;
}

// 12a. Goods Receipt (محضر استلام بضاعة)
export interface GoodsReceipt {
  id: string;
  receipt_number: string;
  purchase_id: string;
  purchase?: Purchase;
  supplier_id: string;
  supplier?: Supplier;
  received_by: string;
  receiver?: { id: string; name: string };
  received_at: string;
  notes?: string;
  created_at: string;
  items?: GoodsReceiptItem[];
}

// 12b. Goods Receipt Item (صنف محضر استلام)
export interface GoodsReceiptItem {
  id: string;
  receipt_id: string;
  purchase_item_id: string;
  product_id: string;
  product?: Product;
  quantity_received: number;
  unit_cost: number;
  created_at: string;
}

// 12c. Purchase Invoice (فاتورة مشتريات)
export interface PurchaseInvoice {
  id: string;
  invoice_number: string;
  supplier_invoice_number?: string;
  purchase_id?: string;
  purchase?: Purchase;
  receipt_id?: string;
  receipt?: GoodsReceipt;
  supplier_id: string;
  supplier?: Supplier;
  issue_date: string;
  due_date?: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paid_amount: number;
  payment_status: InvoicePaymentStatus;
  status: InvoiceStatus;
  notes?: string;
  created_by: string;
  creator?: { id: string; name: string };
  created_at: string;
  updated_at: string;
  items?: PurchaseInvoiceItem[];
}

// 12d. Purchase Invoice Item (صنف فاتورة مشتريات)
export interface PurchaseInvoiceItem {
  id: string;
  invoice_id: string;
  product_id: string;
  product?: Product;
  quantity: number;
  unit_cost: number;
  discount: number;
  tax: number;
  total_cost: number;
  created_at: string;
}

// 12e. Supplier Statement Summary (كشف حساب المورد)
export interface SupplierStatement {
  supplier: Supplier;
  total_orders: number;
  total_order_amount: number;
  total_invoiced: number;
  total_paid: number;
  outstanding_balance: number;
  purchases: Purchase[];
  invoices: PurchaseInvoice[];
  receipts: GoodsReceipt[];
}

// Business Metrics Aggregate Interface
export interface BusinessMetrics {
  total_revenue: number;
  completed_orders_count: number;
  average_order_value: number;
  cancelled_orders_count: number;
  cancellation_rate: number;
  gross_profit: number;
  top_selling_product_name: string;
  inventory_low_stock_count: number;
}

// 13. User Audit Log
export interface UserAuditLog {
  id: string;
  actor_id: string;
  actor?: { name: string; email?: string };
  target_user_id?: string;
  target?: { name: string; email?: string };
  action: 'USER_CREATED' | 'ROLE_CHANGED' | 'STATUS_CHANGED' | 'PROFILE_UPDATED' | 'PASSWORD_RESET_SENT' | 'USER_DELETED';
  details?: Record<string, any>;
  created_at: string;
}

// 14. User Summary Aggregate
export interface UserSummary {
  total_users: number;
  active_users: number;
  inactive_users: number;
  admins: number;
  managers: number;
  cashiers: number;
  staff: number;
  caller_role?: string;
}

// 15. Knowledge Base & RAG Types
export type KnowledgeCategory =
  | 'OPERATIONS'
  | 'INVENTORY'
  | 'PURCHASING'
  | 'POS'
  | 'MANAGEMENT'
  | 'CANCELLATION_REFUND'
  | 'HR'
  | 'GENERAL';

export type KnowledgeSourceType =
  | 'MANUAL_TEXT'
  | 'POLICY'
  | 'SOP'
  | 'FAQ'
  | 'CSV'
  | 'PDF'
  | 'DOCX';

export interface KnowledgeDocument {
  id: string;
  title: string;
  description?: string;
  category: KnowledgeCategory;
  source_type: KnowledgeSourceType;
  source_name?: string;
  content: string;
  allowed_roles: UserRole[];
  chunk_count: number;
  is_active: boolean;
  metadata?: Record<string, any>;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeChunk {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  embedding?: number[];
  metadata?: Record<string, any>;
  created_at: string;
}

export interface RagSourceCitation {
  document_id: string;
  document_title: string;
  document_category: KnowledgeCategory;
  document_source?: string;
  chunk_index?: number;
  content: string;
  snippet?: string;
  similarity: number;
}

export interface RagQueryResponse {
  answer: string;
  sources: RagSourceCitation[];
  ragUsed: boolean;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  latencyMs?: number;
  metricsSnapshot?: BusinessMetrics;
}

