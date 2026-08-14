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

export type PurchaseStatus = 'DRAFT' | 'RECEIVED' | 'CANCELLED';

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

// 11. Purchase
export interface Purchase {
  id: string;
  supplier_id: string;
  supplier?: Supplier;
  invoice_number: string;
  subtotal: number;
  tax: number;
  total: number;
  status: PurchaseStatus;
  purchase_date: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  items?: PurchaseItem[];
}

// 12. Purchase Item
export interface PurchaseItem {
  id: string;
  purchase_id: string;
  product_id: string;
  product?: Product;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  created_at: string;
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
