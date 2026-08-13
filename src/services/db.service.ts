/**
 * RestoFlow Database & RPC Service Layer (Phase 5 Customer & Table Extended)
 * 
 * Interacts directly with Supabase PostgreSQL stored procedures (RPCs)
 * and provides a fallback transactional engine for local testing.
 * 
 * Performance Optimized: Includes in-memory client-side caching & request deduplication.
 */

import { supabase } from '@/lib/supabase';
import { calculateOrderTotals, DEFAULT_VAT_RATE } from '@/config/tax.config';
import {
  User,
  Category,
  Product,
  Customer,
  RestaurantTable,
  Order,
  OrderItem,
  Payment,
  Supplier,
  Purchase,
  PurchaseItem,
  BusinessMetrics,
  OrderStatus,
  CancellationReason,
  UserRole,
  TableStatus,
  CustomerType,
} from '@/types/database.types';

// In-Memory Database Store for Local / Offline Verification
class LocalDatabaseStore {
  public roles = [
    { id: '00000000-0000-0000-0000-000000000001', name: 'ADMIN' as UserRole, description: 'System Administrator', created_at: new Date().toISOString() },
    { id: '00000000-0000-0000-0000-000000000002', name: 'MANAGER' as UserRole, description: 'Restaurant Manager', created_at: new Date().toISOString() },
    { id: '00000000-0000-0000-0000-000000000003', name: 'CASHIER' as UserRole, description: 'POS Cashier', created_at: new Date().toISOString() },
    { id: '00000000-0000-0000-0000-000000000004', name: 'STAFF' as UserRole, description: 'Floor Staff', created_at: new Date().toISOString() },
  ];

  public users: User[] = [
    {
      id: '11111111-1111-1111-1111-111111111111',
      role_id: '00000000-0000-0000-0000-000000000001',
      name: 'Mohammed Hamza',
      email: 'admin@restoflow.sa',
      phone: '+966500000001',
      is_active: true,
      role: this.roles[0],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      role_id: '00000000-0000-0000-0000-000000000002',
      name: 'Ahmed Khalid',
      email: 'manager@restoflow.sa',
      phone: '+966500000002',
      is_active: true,
      role: this.roles[1],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: '33333333-3333-3333-3333-333333333333',
      role_id: '00000000-0000-0000-0000-000000000003',
      name: 'Amro Ali',
      email: 'cashier@restoflow.sa',
      phone: '+966500000003',
      is_active: true,
      role: this.roles[2],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: '44444444-4444-4444-4444-444444444444',
      role_id: '00000000-0000-0000-0000-000000000004',
      name: 'Ahmed Youssef',
      email: 'staff@restoflow.sa',
      phone: '+966500000004',
      is_active: true,
      role: this.roles[3],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  public categories: Category[] = [
    { id: 'a0000000-0000-0000-0000-000000000001', name: 'Burgers', description: 'Gourmet beef and chicken burgers', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'a0000000-0000-0000-0000-000000000002', name: 'Pizza', description: 'Artisanal stone-baked pizzas', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'a0000000-0000-0000-0000-000000000003', name: 'Drinks', description: 'Refreshing hot and cold beverages', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'a0000000-0000-0000-0000-000000000004', name: 'Desserts', description: 'Decadent sweets and pastries', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'a0000000-0000-0000-0000-000000000005', name: 'Meals', description: 'Chef signature main platters', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  ];

  public products: Product[] = [
    { id: 'b0000000-0000-0000-0000-000000000001', category_id: 'a0000000-0000-0000-0000-000000000001', name: 'Truffle Smash Burger', description: 'Double Angus patty, truffle mayo, Swiss cheese', sku: 'BRG-001', price: 45.00, cost: 18.00, stock_quantity: 35, minimum_stock: 10, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'b0000000-0000-0000-0000-000000000002', category_id: 'a0000000-0000-0000-0000-000000000001', name: 'Classic Cheese Burger', description: 'Angus beef, cheddar, special sauce, brioche', sku: 'BRG-002', price: 38.00, cost: 14.00, stock_quantity: 42, minimum_stock: 10, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'b0000000-0000-0000-0000-000000000003', category_id: 'a0000000-0000-0000-0000-000000000001', name: 'Crispy Spicy Chicken', description: 'Crispy fried chicken thigh, jalapeño slaw', sku: 'BRG-003', price: 36.00, cost: 12.50, stock_quantity: 4, minimum_stock: 10, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'b0000000-0000-0000-0000-000000000004', category_id: 'a0000000-0000-0000-0000-000000000001', name: 'Smoky BBQ Bacon Burger', description: 'Angus patty, beef bacon, smoky BBQ sauce', sku: 'BRG-004', price: 48.00, cost: 19.50, stock_quantity: 20, minimum_stock: 8, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },

    { id: 'b0000000-0000-0000-0000-000000000005', category_id: 'a0000000-0000-0000-0000-000000000002', name: 'Neapolitan Margherita', description: 'San Marzano tomato sauce, fresh mozzarella, basil', sku: 'PZA-001', price: 52.00, cost: 16.00, stock_quantity: 25, minimum_stock: 5, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'b0000000-0000-0000-0000-000000000006', category_id: 'a0000000-0000-0000-0000-000000000002', name: 'Pepperoni Feast', description: 'Double beef pepperoni, mozzarella, oregano', sku: 'PZA-002', price: 58.00, cost: 20.00, stock_quantity: 18, minimum_stock: 5, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },

    { id: 'b0000000-0000-0000-0000-000000000008', category_id: 'a0000000-0000-0000-0000-000000000003', name: 'Fresh Orange Juice', description: '100% cold pressed fresh orange juice', sku: 'DRK-001', price: 18.00, cost: 5.00, stock_quantity: 60, minimum_stock: 15, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'b0000000-0000-0000-0000-000000000009', category_id: 'a0000000-0000-0000-0000-000000000003', name: 'Spanish Iced Latte', description: 'Espresso, condensed milk, chilled milk', sku: 'DRK-002', price: 22.00, cost: 6.50, stock_quantity: 50, minimum_stock: 15, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'b0000000-0000-0000-0000-000000000010', category_id: 'a0000000-0000-0000-0000-000000000003', name: 'Classic Mojito', description: 'Fresh mint, lime juice, sparkling water', sku: 'DRK-003', price: 20.00, cost: 4.50, stock_quantity: 0, minimum_stock: 10, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },

    { id: 'b0000000-0000-0000-0000-000000000011', category_id: 'a0000000-0000-0000-0000-000000000004', name: 'Molten Chocolate Cake', description: 'Warm chocolate fondant, vanilla gelato', sku: 'DES-001', price: 32.00, cost: 10.00, stock_quantity: 15, minimum_stock: 5, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'b0000000-0000-0000-0000-000000000013', category_id: 'a0000000-0000-0000-0000-000000000005', name: 'Ribeye Steak Platter', description: '300g Prime Ribeye, truffle fries, herb butter', sku: 'MEL-001', price: 120.00, cost: 48.00, stock_quantity: 10, minimum_stock: 4, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  ];

  public customers: Customer[] = [
    { id: 'c0000000-0000-0000-0000-000000000001', name: 'Walk-in Guest', customer_type: 'GUEST', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'c0000000-0000-0000-0000-000000000002', name: 'Prince Khalid Al-Saud', phone: '+966551112233', email: 'khalid@vip.sa', customer_type: 'VIP', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'c0000000-0000-0000-0000-000000000003', name: 'Reem Al-Dossary', phone: '+966552223344', email: 'reem@gmail.com', customer_type: 'REGULAR', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  ];

  public tables: RestaurantTable[] = [
    { id: 't0000000-0000-0000-0000-000000000001', table_number: 'T-01', capacity: 2, status: 'AVAILABLE', location: 'Main Dining', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 't0000000-0000-0000-0000-000000000002', table_number: 'T-02', capacity: 2, status: 'OCCUPIED', location: 'Main Dining', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 't0000000-0000-0000-0000-000000000003', table_number: 'T-03', capacity: 4, status: 'AVAILABLE', location: 'Main Dining', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 't0000000-0000-0000-0000-000000000004', table_number: 'T-04', capacity: 4, status: 'RESERVED', location: 'Main Dining', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 't0000000-0000-0000-0000-000000000005', table_number: 'T-05', capacity: 6, status: 'AVAILABLE', location: 'Patio', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 't0000000-0000-0000-0000-000000000006', table_number: 'T-06', capacity: 8, status: 'AVAILABLE', location: 'VIP Lounge', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  ];

  public suppliers: Supplier[] = [
    { id: 's0000000-0000-0000-0000-000000000001', name: 'Al-Watania Premium Meats', phone: '+966114001111', email: 'orders@watania-meats.sa', tax_number: '310123456700003', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 's0000000-0000-0000-0000-000000000002', name: 'Fresh Produce Arabia', phone: '+966114002222', email: 'supply@freshproduce.sa', tax_number: '310234567800003', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  ];

  public purchases: Purchase[] = [
    { id: 'p0000000-0000-0000-0000-000000000001', supplier_id: 's0000000-0000-0000-0000-000000000001', invoice_number: 'INV-2026-001', subtotal: 1800.00, tax: 270.00, total: 2070.00, status: 'RECEIVED', purchase_date: new Date().toISOString().split('T')[0], created_by: '11111111-1111-1111-1111-111111111111', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'p0000000-0000-0000-0000-000000000002', supplier_id: 's0000000-0000-0000-0000-000000000002', invoice_number: 'INV-2026-002', subtotal: 650.00, tax: 97.50, total: 747.50, status: 'DRAFT', purchase_date: new Date().toISOString().split('T')[0], created_by: '22222222-2222-2222-2222-222222222222', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  ];

  public orders: Order[] = [
    {
      id: 'o0000000-0000-0000-0000-000000000001',
      order_number: 'ORD-000101',
      customer_id: 'c0000000-0000-0000-0000-000000000002',
      table_id: 't0000000-0000-0000-0000-000000000002',
      user_id: '33333333-3333-3333-3333-333333333333',
      order_type: 'DINE_IN',
      status: 'COMPLETED',
      subtotal: 142.00,
      discount: 10.00,
      tax: 19.80,
      total: 151.80,
      stock_deducted: true,
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    }
  ];

  public orderItems: OrderItem[] = [
    { id: 'oi000000-0000-0000-0000-000000000001', order_id: 'o0000000-0000-0000-0000-000000000001', product_id: 'b0000000-0000-0000-0000-000000000001', quantity: 2, unit_price: 45.00, unit_cost: 18.00, discount: 0.00, total: 90.00, created_at: new Date().toISOString() },
    { id: 'oi000000-0000-0000-0000-000000000001', order_id: 'o0000000-0000-0000-0000-000000000001', product_id: 'b0000000-0000-0000-0000-000000000005', quantity: 1, unit_price: 52.00, unit_cost: 16.00, discount: 10.00, total: 42.00, created_at: new Date().toISOString() },
  ];

  public payments: Payment[] = [
    { id: 'pay00000-0000-0000-0000-000000000001', order_id: 'o0000000-0000-0000-0000-000000000001', payment_method: 'MADA', amount: 151.80, status: 'PAID', transaction_reference: 'TXN-99887766', paid_at: new Date().toISOString(), created_at: new Date().toISOString() }
  ];

  public purchaseItems: PurchaseItem[] = [
    {
      id: 'pi000000-0000-0000-0000-000000000001',
      purchase_id: 'pur00000-0000-0000-0000-000000000001',
      product_id: 'b0000000-0000-0000-0000-000000000001',
      quantity: 25,
      unit_cost: 18.00,
      total_cost: 450.00,
      created_at: new Date().toISOString(),
    },
    {
      id: 'pi000000-0000-0000-0000-000000000002',
      purchase_id: 'pur00000-0000-0000-0000-000000000001',
      product_id: 'b0000000-0000-0000-0000-000000000005',
      quantity: 10,
      unit_cost: 5.00,
      total_cost: 50.00,
      created_at: new Date().toISOString(),
    },
  ];

  private orderSeq = 106;

  public generateOrderNumber(): string {
    const seq = this.orderSeq++;
    return `ORD-${String(seq).padStart(6, '0')}`;
  }

  public getUserRole(userId?: string): UserRole | 'UNAUTHENTICATED' {
    if (!userId) return 'UNAUTHENTICATED';
    const user = this.users.find(u => u.id === userId);
    return user?.role?.name || 'UNAUTHENTICATED';
  }
}

export const localDb = new LocalDatabaseStore();

// Client-Side In-Memory Cache Store for Immediate Sub-10ms Navigation
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class ServiceCacheStore {
  private categories: CacheEntry<Category[]> | null = null;
  private products: CacheEntry<Product[]> | null = null;
  private customers: CacheEntry<Customer[]> | null = null;
  private tables: CacheEntry<RestaurantTable[]> | null = null;
  private orders: CacheEntry<Order[]> | null = null;
  private suppliers: CacheEntry<Supplier[]> | null = null;
  private purchases: CacheEntry<Purchase[]> | null = null;
  private analyticsBreakdown: CacheEntry<any> | null = null;
  private businessMetrics: CacheEntry<BusinessMetrics> | null = null;
  private analyticsPreset: string | null = null;
  private readonly TTL = 10000; // 10s TTL

  getCategories(): Category[] | null {
    if (this.categories && Date.now() - this.categories.timestamp < this.TTL) {
      return this.categories.data;
    }
    return null;
  }

  setCategories(data: Category[]) {
    this.categories = { data, timestamp: Date.now() };
  }

  getProducts(): Product[] | null {
    if (this.products && Date.now() - this.products.timestamp < this.TTL) {
      return this.products.data;
    }
    return null;
  }

  setProducts(data: Product[]) {
    this.products = { data, timestamp: Date.now() };
  }

  getCustomers(): Customer[] | null {
    if (this.customers && Date.now() - this.customers.timestamp < this.TTL) {
      return this.customers.data;
    }
    return null;
  }

  setCustomers(data: Customer[]) {
    this.customers = { data, timestamp: Date.now() };
  }

  getTables(): RestaurantTable[] | null {
    if (this.tables && Date.now() - this.tables.timestamp < this.TTL) {
      return this.tables.data;
    }
    return null;
  }

  setTables(data: RestaurantTable[]) {
    this.tables = { data, timestamp: Date.now() };
  }

  getOrders(): Order[] | null {
    if (this.orders && Date.now() - this.orders.timestamp < this.TTL) {
      return this.orders.data;
    }
    return null;
  }

  setOrders(data: Order[]) {
    this.orders = { data, timestamp: Date.now() };
  }

  getSuppliers(): Supplier[] | null {
    if (this.suppliers && Date.now() - this.suppliers.timestamp < this.TTL) {
      return this.suppliers.data;
    }
    return null;
  }

  setSuppliers(data: Supplier[]) {
    this.suppliers = { data, timestamp: Date.now() };
  }

  getPurchases(): Purchase[] | null {
    if (this.purchases && Date.now() - this.purchases.timestamp < this.TTL) {
      return this.purchases.data;
    }
    return null;
  }

  setPurchases(data: Purchase[]) {
    this.purchases = { data, timestamp: Date.now() };
  }

  getAnalytics(preset: string): { metrics: BusinessMetrics; breakdown: any } | null {
    if (
      this.analyticsPreset === preset &&
      this.businessMetrics &&
      this.analyticsBreakdown &&
      Date.now() - this.businessMetrics.timestamp < this.TTL
    ) {
      return { metrics: this.businessMetrics.data, breakdown: this.analyticsBreakdown.data };
    }
    return null;
  }

  setAnalytics(preset: string, metrics: BusinessMetrics, breakdown: any) {
    this.analyticsPreset = preset;
    this.businessMetrics = { data: metrics, timestamp: Date.now() };
    this.analyticsBreakdown = { data: breakdown, timestamp: Date.now() };
  }

  invalidateProducts() {
    this.products = null;
  }

  invalidateCategories() {
    this.categories = null;
  }

  invalidateCustomers() {
    this.customers = null;
  }

  invalidateTables() {
    this.tables = null;
  }

  invalidateOrders() {
    this.orders = null;
  }

  invalidateSuppliers() {
    this.suppliers = null;
  }

  invalidatePurchases() {
    this.purchases = null;
  }

  invalidateAnalytics() {
    this.businessMetrics = null;
    this.analyticsBreakdown = null;
  }

  invalidateAll() {
    this.categories = null;
    this.products = null;
    this.customers = null;
    this.tables = null;
    this.orders = null;
    this.suppliers = null;
    this.purchases = null;
    this.analyticsBreakdown = null;
    this.businessMetrics = null;
    this.analyticsPreset = null;
  }
}

export const serviceCache = new ServiceCacheStore();

export class DatabaseService {
  /**
   * Synchronous Cache Getters for Instant 0ms Component State Initialization
   */
  static getCachedProductsSync(): Product[] | null {
    return serviceCache.getProducts();
  }

  static getCachedCategoriesSync(): Category[] | null {
    return serviceCache.getCategories();
  }

  static getCachedCustomersSync(): Customer[] | null {
    return serviceCache.getCustomers();
  }

  static getCachedTablesSync(): RestaurantTable[] | null {
    return serviceCache.getTables();
  }

  static getCachedOrdersSync(): Order[] | null {
    return serviceCache.getOrders();
  }

  static getCachedSuppliersSync(): Supplier[] | null {
    return serviceCache.getSuppliers();
  }

  static getCachedPurchasesSync(): Purchase[] | null {
    return serviceCache.getPurchases();
  }

  static getCachedAnalyticsSync(preset: string): { metrics: BusinessMetrics; breakdown: any } | null {
    return serviceCache.getAnalytics(preset);
  }

  static setCachedAnalyticsSync(preset: string, metrics: BusinessMetrics, breakdown: any) {
    serviceCache.setAnalytics(preset, metrics, breakdown);
  }

  static getUserRole(userId?: string): UserRole | 'UNAUTHENTICATED' {
    return localDb.getUserRole(userId);
  }

  /**
   * Helper: Validate User Role & Authentication
   */
  private static validateRolePermission(
    userId: string | undefined,
    allowedRoles: Array<UserRole>
  ): UserRole {
    if (!userId) {
      throw new Error('Unauthorized: User authentication required.');
    }
    const role = localDb.getUserRole(userId);
    if (role === 'UNAUTHENTICATED' || !allowedRoles.includes(role)) {
      throw new Error(`Unauthorized: User role "${role}" is not permitted to perform this operation.`);
    }
    return role;
  }

  // --------------------------------------------------------------------------
  // CUSTOMER MANAGEMENT SERVICE METHODS (Cached)
  // --------------------------------------------------------------------------

  static async getCustomers(): Promise<Customer[]> {
    const cached = serviceCache.getCustomers();
    if (cached) return cached;

    const { data, error } = await supabase
      .from('customers')
      .select('id, name, phone, email, customer_type, created_at, updated_at')
      .order('name');

    console.log('[Supabase Customers] data:', data);
    console.log('[Supabase Customers] error:', error);

    if (error) {
      console.error('[DatabaseService] Supabase customer query error:', error.message);
      throw new Error(error.message);
    }

    if (data) {
      serviceCache.setCustomers(data as Customer[]);
      return data as Customer[];
    }

    return [];
  }
  static async createCustomer(
    userId: string | undefined,
    data: { name: string; phone?: string; email?: string; customer_type?: CustomerType }
  ): Promise<Customer> {
    this.validateRolePermission(userId, ['ADMIN', 'MANAGER', 'CASHIER']);

    const trimmedName = data.name.trim();
    if (!trimmedName) throw new Error('Customer name is required.');

    const { data: dbData, error } = await supabase
      .from('customers')
      .insert({
        name: trimmedName,
        phone: data.phone?.trim() || null,
        email: data.email?.trim() || null,
        customer_type: data.customer_type || 'REGULAR',
      })
      .select()
      .single();

    if (error) {
      console.error('[DatabaseService] Supabase createCustomer error:', error.message);
      throw new Error(`Failed to create customer: ${error.message}`);
    }

    if (dbData) {
      serviceCache.invalidateCustomers();
      return dbData as Customer;
    }

    throw new Error('Failed to create customer: No data returned from Supabase.');
  }

  static async updateCustomer(
    userId: string | undefined,
    id: string,
    updates: Partial<Omit<Customer, 'id' | 'created_at'>>
  ): Promise<Customer> {
    this.validateRolePermission(userId, ['ADMIN', 'MANAGER', 'CASHIER']);

    if (updates.name !== undefined) {
      const trimmedName = updates.name.trim();
      if (!trimmedName) throw new Error('Customer name cannot be empty.');
    }

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.name !== undefined) updatePayload.name = updates.name.trim();
    if (updates.phone !== undefined) updatePayload.phone = updates.phone.trim() || null;
    if (updates.email !== undefined) updatePayload.email = updates.email.trim() || null;
    if (updates.customer_type !== undefined) updatePayload.customer_type = updates.customer_type;

    const { data: dbData, error } = await supabase
      .from('customers')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[DatabaseService] Supabase updateCustomer error:', error.message);
      throw new Error(`Failed to update customer: ${error.message}`);
    }

    if (dbData) {
      serviceCache.invalidateCustomers();
      return dbData as Customer;
    }

    throw new Error('Failed to update customer: No data returned from Supabase.');
  }

  static async deleteCustomer(userId: string | undefined, id: string): Promise<void> {
    this.validateRolePermission(userId, ['ADMIN', 'MANAGER']); // usually only higher roles delete

    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[DatabaseService] Supabase deleteCustomer error:', error.message);
      // Handle foreign key constraint violation (PostgreSQL code 23503)
      if (error.code === '23503' || error.message.includes('foreign key constraint')) {
        throw new Error('Cannot delete this customer because they have historical orders or transactions attached to them.');
      }
      throw new Error(`Failed to delete customer: ${error.message}`);
    }

    serviceCache.invalidateCustomers();
  }

  // --------------------------------------------------------------------------
  // RESTAURANT TABLE MANAGEMENT SERVICE METHODS (Cached)
  // --------------------------------------------------------------------------

  static async getTables(): Promise<RestaurantTable[]> {
    const cached = serviceCache.getTables();
    if (cached) return cached;

    const { data, error } = await supabase
      .from('restaurant_tables')
      .select('id, table_number, capacity, location, status, created_at, updated_at')
      .order('table_number');

    if (error) {
      console.error('[DatabaseService] Supabase getTables error:', error.message);
      throw new Error(`Failed to load tables: ${error.message}`);
    }

    if (data) {
      serviceCache.setTables(data as RestaurantTable[]);
      return data as RestaurantTable[];
    }
    return [];
  }

  static async createTable(
    userId: string | undefined,
    data: { table_number: string; capacity: number; location?: string; status?: TableStatus }
  ): Promise<RestaurantTable> {
    this.validateRolePermission(userId, ['ADMIN', 'MANAGER']);

    const trimmedNum = data.table_number.trim().toUpperCase();
    if (!trimmedNum) throw new Error('Table number is required.');
    if (data.capacity < 1) throw new Error('Table capacity must be at least 1 seat.');

    const { data: dbData, error } = await supabase
      .from('restaurant_tables')
      .insert({
        table_number: trimmedNum,
        capacity: Math.floor(Number(data.capacity)),
        location: data.location?.trim() || 'Main Dining',
        status: data.status || 'AVAILABLE'
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') throw new Error(`Table number "${trimmedNum}" already exists.`);
      throw new Error(`Failed to create table: ${error.message}`);
    }

    if (dbData) {
      serviceCache.invalidateTables();
      return dbData as RestaurantTable;
    }
    throw new Error('Failed to create table: No data returned.');
  }

  static async updateTable(
    userId: string | undefined,
    id: string,
    updates: Partial<Omit<RestaurantTable, 'id' | 'created_at'>>
  ): Promise<RestaurantTable> {
    this.validateRolePermission(userId, ['ADMIN', 'MANAGER']);

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString()
    };

    if (updates.table_number !== undefined) {
      const trimmedNum = updates.table_number.trim().toUpperCase();
      if (!trimmedNum) throw new Error('Table number cannot be empty.');
      updatePayload.table_number = trimmedNum;
    }
    if (updates.capacity !== undefined) {
      if (updates.capacity < 1) throw new Error('Capacity must be at least 1.');
      updatePayload.capacity = Math.floor(Number(updates.capacity));
    }
    if (updates.location !== undefined) updatePayload.location = updates.location.trim();
    if (updates.status !== undefined) updatePayload.status = updates.status;

    const { data: dbData, error } = await supabase
      .from('restaurant_tables')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') throw new Error(`Table number is already assigned to another table.`);
      throw new Error(`Failed to update table: ${error.message}`);
    }

    if (dbData) {
      serviceCache.invalidateTables();
      return dbData as RestaurantTable;
    }
    throw new Error('Failed to update table: No data returned.');
  }

  static async updateTableStatus(
    userId: string | undefined,
    id: string,
    newStatus: TableStatus
  ): Promise<RestaurantTable> {
    this.validateRolePermission(userId, ['ADMIN', 'MANAGER', 'CASHIER', 'STAFF']);

    const { data: dbData, error } = await supabase
      .from('restaurant_tables')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update table status: ${error.message}`);
    }

    if (dbData) {
      serviceCache.invalidateTables();
      return dbData as RestaurantTable;
    }
    throw new Error('Failed to update table status: No data returned.');
  }

  // --------------------------------------------------------------------------
  // CATEGORY & PRODUCT SERVICE METHODS (Cached)
  // --------------------------------------------------------------------------

  static async getCategories(): Promise<Category[]> {
    const cached = serviceCache.getCategories();
    if (cached) return cached;

    const { data, error } = await supabase
      .from('categories')
      .select('id, name, description, image_url, is_active, created_at, updated_at')
      .order('name');

    if (error) {
      console.error('[DatabaseService] Supabase getCategories error:', error.message);
      throw new Error(`Failed to load categories: ${error.message}`);
    }

    if (data) {
      serviceCache.setCategories(data as Category[]);
      return data as Category[];
    }
    return [];
  }

  static async createCategory(
    userId: string | undefined,
    data: { name: string; description?: string; image_url?: string; is_active?: boolean }
  ): Promise<Category> {
    this.validateRolePermission(userId, ['ADMIN', 'MANAGER']);

    const trimmedName = data.name.trim();
    if (!trimmedName) throw new Error('Category name is required.');

    const { data: dbData, error } = await supabase
      .from('categories')
      .insert({
        name: trimmedName,
        description: data.description?.trim() || '',
        image_url: data.image_url?.trim() || '',
        is_active: data.is_active !== undefined ? data.is_active : true
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') throw new Error(`Category name "${trimmedName}" already exists.`);
      throw new Error(`Failed to create category: ${error.message}`);
    }

    if (dbData) {
      serviceCache.invalidateCategories();
      return dbData as Category;
    }
    throw new Error('Failed to create category: No data returned.');
  }

  static async updateCategory(
    userId: string | undefined,
    id: string,
    updates: Partial<Omit<Category, 'id' | 'created_at'>>
  ): Promise<Category> {
    this.validateRolePermission(userId, ['ADMIN', 'MANAGER']);

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString()
    };

    if (updates.name !== undefined) {
      const trimmedName = updates.name.trim();
      if (!trimmedName) throw new Error('Category name cannot be empty.');
      updatePayload.name = trimmedName;
    }
    if (updates.description !== undefined) updatePayload.description = updates.description.trim();
    if (updates.image_url !== undefined) updatePayload.image_url = updates.image_url.trim();
    if (updates.is_active !== undefined) updatePayload.is_active = updates.is_active;

    const { data: dbData, error } = await supabase
      .from('categories')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') throw new Error(`Category name is already taken.`);
      throw new Error(`Failed to update category: ${error.message}`);
    }

    if (dbData) {
      serviceCache.invalidateCategories();
      return dbData as Category;
    }
    throw new Error('Failed to update category: No data returned.');
  }

  static async toggleCategoryStatus(userId: string | undefined, id: string): Promise<Category> {
    this.validateRolePermission(userId, ['ADMIN', 'MANAGER']);

    // First fetch current status
    const { data: current, error: fetchErr } = await supabase
      .from('categories')
      .select('is_active')
      .eq('id', id)
      .single();
      
    if (fetchErr) throw new Error(`Failed to fetch category status: ${fetchErr.message}`);

    const { data: dbData, error } = await supabase
      .from('categories')
      .update({ is_active: !current.is_active, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to toggle category status: ${error.message}`);
    }

    if (dbData) {
      serviceCache.invalidateCategories();
      return dbData as Category;
    }
    throw new Error('Failed to toggle category status: No data returned.');
  }

  static async getProducts(): Promise<Product[]> {
    const cached = serviceCache.getProducts();
    if (cached) return cached;

    const { data, error } = await supabase
      .from('products')
      .select('*, category:categories(name)')
      .order('name');
      
    if (error) {
      console.error('[DatabaseService] Supabase getProducts error:', error.message);
      throw new Error(`Failed to load products: ${error.message}`);
    }

    if (data) {
      serviceCache.setProducts(data as Product[]);
      return data as Product[];
    }
    return [];
  }

  static async createProduct(
    userId: string | undefined,
    data: {
      category_id: string;
      name: string;
      sku: string;
      description?: string;
      price: number;
      cost: number;
      stock_quantity: number;
      minimum_stock: number;
      image_url?: string;
      is_active?: boolean;
    }
  ): Promise<Product> {
    this.validateRolePermission(userId, ['ADMIN', 'MANAGER']);

    const trimmedName = data.name.trim();
    const trimmedSku = data.sku.trim().toUpperCase();

    if (!trimmedName) throw new Error('Product name is required.');
    if (!trimmedSku) throw new Error('Product SKU is required.');
    if (!data.category_id) throw new Error('Category is required.');

    if (data.price < 0) throw new Error('Product price must be greater than or equal to 0.');
    if (data.cost < 0) throw new Error('Product cost must be greater than or equal to 0.');
    if (data.stock_quantity < 0) throw new Error('Stock quantity cannot be negative.');
    if (data.minimum_stock < 0) throw new Error('Minimum stock threshold cannot be negative.');

    const { data: dbData, error } = await supabase
      .from('products')
      .insert({
        category_id: data.category_id,
        name: trimmedName,
        sku: trimmedSku,
        description: data.description?.trim() || '',
        price: Number(data.price),
        cost: Number(data.cost),
        stock_quantity: Math.floor(Number(data.stock_quantity)),
        minimum_stock: Math.floor(Number(data.minimum_stock)),
        image_url: data.image_url?.trim() || '',
        is_active: data.is_active !== undefined ? data.is_active : true
      })
      .select('*, category:categories(name)')
      .single();

    if (error) {
      if (error.code === '23505') throw new Error(`SKU "${trimmedSku}" is already assigned to another product.`);
      if (error.code === '23503') throw new Error(`Selected category does not exist.`);
      throw new Error(`Failed to create product: ${error.message}`);
    }

    if (dbData) {
      serviceCache.invalidateProducts();
      return dbData as Product;
    }
    throw new Error('Failed to create product: No data returned.');
  }

  static async updateProduct(
    userId: string | undefined,
    id: string,
    updates: Partial<Omit<Product, 'id' | 'created_at'>>
  ): Promise<Product> {
    this.validateRolePermission(userId, ['ADMIN', 'MANAGER']);

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString()
    };

    if (updates.name !== undefined) {
      const trimmedName = updates.name.trim();
      if (!trimmedName) throw new Error('Product name cannot be empty.');
      updatePayload.name = trimmedName;
    }
    if (updates.sku !== undefined) {
      const trimmedSku = updates.sku.trim().toUpperCase();
      if (!trimmedSku) throw new Error('SKU cannot be empty.');
      updatePayload.sku = trimmedSku;
    }
    if (updates.category_id !== undefined) updatePayload.category_id = updates.category_id;
    if (updates.price !== undefined) {
      if (updates.price < 0) throw new Error('Price cannot be negative.');
      updatePayload.price = Number(updates.price);
    }
    if (updates.cost !== undefined) {
      if (updates.cost < 0) throw new Error('Cost cannot be negative.');
      updatePayload.cost = Number(updates.cost);
    }
    if (updates.stock_quantity !== undefined) {
      if (updates.stock_quantity < 0) throw new Error('Stock quantity cannot be negative.');
      updatePayload.stock_quantity = Math.floor(Number(updates.stock_quantity));
    }
    if (updates.minimum_stock !== undefined) {
      if (updates.minimum_stock < 0) throw new Error('Minimum stock threshold cannot be negative.');
      updatePayload.minimum_stock = Math.floor(Number(updates.minimum_stock));
    }
    if (updates.description !== undefined) updatePayload.description = updates.description.trim();
    if (updates.image_url !== undefined) updatePayload.image_url = updates.image_url.trim();
    if (updates.is_active !== undefined) updatePayload.is_active = updates.is_active;

    const { data: dbData, error } = await supabase
      .from('products')
      .update(updatePayload)
      .eq('id', id)
      .select('*, category:categories(name)')
      .single();

    if (error) {
      if (error.code === '23505') throw new Error(`SKU is already taken by another product.`);
      if (error.code === '23503') throw new Error(`Category not found.`);
      throw new Error(`Failed to update product: ${error.message}`);
    }

    if (dbData) {
      serviceCache.invalidateProducts();
      return dbData as Product;
    }
    throw new Error('Failed to update product: No data returned.');
  }

  static async toggleProductStatus(userId: string | undefined, id: string): Promise<Product> {
    this.validateRolePermission(userId, ['ADMIN', 'MANAGER']);

    const { data: current, error: fetchErr } = await supabase
      .from('products')
      .select('is_active')
      .eq('id', id)
      .single();

    if (fetchErr) throw new Error(`Failed to fetch product status: ${fetchErr.message}`);

    const { data: dbData, error } = await supabase
      .from('products')
      .update({ is_active: !current.is_active, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*, category:categories(name)')
      .single();

    if (error) {
      throw new Error(`Failed to toggle product status: ${error.message}`);
    }

    if (dbData) {
      serviceCache.invalidateProducts();
      return dbData as Product;
    }
    throw new Error('Failed to toggle product status: No data returned.');
  }

  // --------------------------------------------------------------------------
  // EXISTING TRANSACTIONAL RPC METHODS
  // --------------------------------------------------------------------------

  static async modifyProduct(userId: string | undefined, productId: string, updates: Partial<Product>) {
    return this.updateProduct(userId, productId, updates);
  }

  static async modifySupplier(userId: string | undefined, supplierId: string, updates: Partial<Supplier>) {
    this.validateRolePermission(userId, ['ADMIN', 'MANAGER']);
    const supplier = localDb.suppliers.find(s => s.id === supplierId);
    if (!supplier) throw new Error('Supplier not found.');
    Object.assign(supplier, updates, { updated_at: new Date().toISOString() });
    const { data, error } = await supabase
      .from('suppliers')
      .update(updates)
      .eq('id', supplierId)
      .select()
      .single();
    if (error) throw new Error(`Failed to update supplier: ${error.message}`);
    return { success: true, supplier: data };
  }

  /**
   * Atomic POS Checkout Execution
   */
  static async executeCheckout(params: {
    user_id?: string;
    customer_id?: string;
    table_id?: string;
    order_type: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
    items: Array<{ product_id: string; quantity: number; discount?: number; notes?: string }>;
    payments: Array<{ payment_method: 'CASH' | 'CARD' | 'MADA' | 'APPLE_PAY' | 'OTHER'; amount: number; transaction_reference?: string }>;
    discount?: number;
    notes?: string;
  }) {
    this.validateRolePermission(params.user_id, ['ADMIN', 'MANAGER', 'CASHIER', 'STAFF']);

    if (!params.items || params.items.length === 0) {
      throw new Error('Order checkout failed: Order must contain at least one item.');
    }
    if (!params.payments || params.payments.length === 0) {
      throw new Error('Order checkout failed: At least one valid payment is required.');
    }

    const { data, error } = await supabase.rpc('execute_pos_checkout', {
      p_user_id: params.user_id,
      p_customer_id: params.customer_id || null,
      p_table_id: params.table_id || null,
      p_order_type: params.order_type,
      p_items: params.items,
      p_payments: params.payments,
      p_discount: params.discount || 0,
      p_notes: params.notes || null,
      p_vat_rate: DEFAULT_VAT_RATE,
    });

    if (error) {
      console.error('[DatabaseService] Supabase execute_pos_checkout failed:', error.message);
      throw new Error(`Order checkout failed: ${error.message}`);
    }

    if (data && data.success) {
      serviceCache.invalidateOrders();
      serviceCache.invalidateProducts();
      serviceCache.invalidateTables();
      serviceCache.invalidateAnalytics();
      return data;
    }
    
    throw new Error('Order checkout failed: No valid response from server.');
  }

  static async getOrders(): Promise<Order[]> {
    const cached = serviceCache.getOrders();
    if (cached) return cached;

    const { data, error } = await supabase
      .from('orders')
      .select('id, order_number, customer_id, table_id, user_id, order_type, status, subtotal, discount, tax, total, notes, cancelled_at, cancelled_by, cancellation_reason, stock_deducted, created_at, updated_at, customer:customers(id, name, phone), table:restaurant_tables(id, table_number), user:users!orders_user_id_fkey(id, name), items:order_items(id, order_id, product_id, quantity, unit_price, unit_cost, discount, total, product:products(id, name, sku)), payments:payments(id, order_id, payment_method, amount, status, paid_at)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[DatabaseService] Supabase getOrders error:', error.message);
      throw new Error(`Failed to load orders: ${error.message}`);
    }

    if (data) {
      serviceCache.setOrders(data as unknown as Order[]);
      return data as unknown as Order[];
    }
    return [];
  }

  static async getOrderDetails(orderId: string): Promise<Order> {
    const { data, error } = await supabase
      .from('orders')
      .select('id, order_number, customer_id, table_id, user_id, order_type, status, subtotal, discount, tax, total, notes, cancelled_at, cancelled_by, cancellation_reason, stock_deducted, created_at, updated_at, customer:customers(id, name, phone), table:restaurant_tables(id, table_number), user:users!orders_user_id_fkey(id, name), items:order_items(id, order_id, product_id, quantity, unit_price, unit_cost, discount, total, product:products(id, name, sku)), payments:payments(id, order_id, payment_method, amount, status, paid_at)')
      .eq('id', orderId)
      .single();

    if (error) {
      console.error('[DatabaseService] Supabase getOrderDetails error:', error.message);
      throw new Error(`Failed to load order details: ${error.message}`);
    }

    if (data) {
      return data as unknown as Order;
    }
    throw new Error('Order not found.');
  }

  static async cancelOrder(orderId: string, cancelledBy: string | undefined, reason: CancellationReason) {
    this.validateRolePermission(cancelledBy, ['ADMIN', 'MANAGER', 'CASHIER']);

    if (!reason || !['CUSTOMER_REQUEST', 'OUT_OF_STOCK', 'DUPLICATE_ORDER', 'WRONG_ORDER', 'OTHER'].includes(reason)) {
      throw new Error('Cancellation failed: Valid cancellation reason required.');
    }

    const { data, error } = await supabase.rpc('cancel_order_and_restore_stock', {
      p_order_id: orderId,
      p_cancelled_by: cancelledBy,
      p_reason: reason,
    });

    if (error) {
      throw new Error(`Cancellation failed: ${error.message}`);
    }

    if (data && data.success) {
      serviceCache.invalidateOrders();
      serviceCache.invalidateProducts();
      serviceCache.invalidateAnalytics();
      return data;
    }
    
    throw new Error('Cancellation failed: No valid response from server.');
  }

  static async advanceOrderStatus(orderId: string, newStatus: OrderStatus, userId?: string) {
    this.validateRolePermission(userId, ['ADMIN', 'MANAGER', 'CASHIER', 'STAFF']);

    const { data, error } = await supabase.rpc('advance_order_status', {
      p_order_id: orderId,
      p_new_status: newStatus,
    });

    if (error) {
      throw new Error(`Order status update failed: ${error.message}`);
    }

    if (data && data.success) {
      serviceCache.invalidateOrders();
      serviceCache.invalidateAnalytics();
      return data;
    }

    throw new Error('Order status update failed: No valid response from server.');
  }

  static async refundCompletedPayment(orderId: string, refundedBy?: string) {
    this.validateRolePermission(refundedBy, ['ADMIN', 'MANAGER']);

    const { data, error } = await supabase.rpc('refund_completed_payment', {
      p_order_id: orderId,
      p_refunded_by: refundedBy,
    });

    if (error) {
      throw new Error(`Refund failed: ${error.message}`);
    }

    if (data && data.success) {
      serviceCache.invalidateOrders();
      serviceCache.invalidateAnalytics();
      return data;
    }

    throw new Error('Refund failed: No valid response from server.');
  }

  static async getSuppliers(): Promise<Supplier[]> {
    const cached = serviceCache.getSuppliers();
    if (cached) return cached;

    const { data, error } = await supabase.from('suppliers').select('*').order('name');
    if (error) {
      console.error('[DatabaseService] Supabase getSuppliers error:', error.message);
      throw new Error(error.message);
    }
    if (data) {
      serviceCache.setSuppliers(data as Supplier[]);
      return data as Supplier[];
    }
    return [];
  }

  static async createSupplier(
    userId: string | undefined,
    data: { name: string; phone?: string; email?: string; address?: string; tax_number?: string }
  ): Promise<Supplier> {
    this.validateRolePermission(userId, ['ADMIN', 'MANAGER']);

    const trimmedName = data.name.trim();
    if (!trimmedName) throw new Error('Supplier name is required.');

    const { data: dbData, error } = await supabase
      .from('suppliers')
      .insert({
        name: trimmedName,
        phone: data.phone?.trim() || null,
        email: data.email?.trim() || null,
        address: data.address?.trim() || null,
        tax_number: data.tax_number?.trim() || null,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      console.error('[DatabaseService] Supabase createSupplier error:', error.message);
      throw new Error(`Failed to create supplier: ${error.message}`);
    }

    if (dbData) {
      serviceCache.invalidateSuppliers();
      return dbData as Supplier;
    }

    throw new Error('Failed to create supplier: No data returned from Supabase.');
  }

  static async updateSupplier(
    userId: string | undefined,
    id: string,
    updates: Partial<Omit<Supplier, 'id' | 'created_at'>>
  ): Promise<Supplier> {
    this.validateRolePermission(userId, ['ADMIN', 'MANAGER']);

    if (updates.name !== undefined) {
      const trimmed = updates.name.trim();
      if (!trimmed) throw new Error('Supplier name cannot be empty.');
    }

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString()
    };
    if (updates.name !== undefined) updatePayload.name = updates.name.trim();
    if (updates.phone !== undefined) updatePayload.phone = updates.phone?.trim() || null;
    if (updates.email !== undefined) updatePayload.email = updates.email?.trim() || null;
    if (updates.address !== undefined) updatePayload.address = updates.address?.trim() || null;
    if (updates.tax_number !== undefined) updatePayload.tax_number = updates.tax_number?.trim() || null;
    if (updates.is_active !== undefined) updatePayload.is_active = updates.is_active;

    const { data: dbData, error } = await supabase
      .from('suppliers')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[DatabaseService] Supabase updateSupplier error:', error.message);
      throw new Error(`Failed to update supplier: ${error.message}`);
    }

    if (dbData) {
      serviceCache.invalidateSuppliers();
      return dbData as Supplier;
    }

    throw new Error('Failed to update supplier: No data returned from Supabase.');
  }

  static async deleteSupplier(userId: string | undefined, id: string): Promise<void> {
    this.validateRolePermission(userId, ['ADMIN', 'MANAGER']);

    const { error } = await supabase
      .from('suppliers')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[DatabaseService] Supabase deleteSupplier error:', error.message);
      if (error.code === '23503' || error.message.includes('foreign key constraint')) {
        throw new Error('Cannot delete this supplier because they are associated with existing purchase records.');
      }
      throw new Error(`Failed to delete supplier: ${error.message}`);
    }

    serviceCache.invalidateSuppliers();
  }

  static async getPurchases(): Promise<Purchase[]> {
    const cached = serviceCache.getPurchases();
    if (cached) return cached;

    const { data, error } = await supabase
      .from('purchases')
      .select('*, supplier:suppliers(*), items:purchase_items(*, product:products(*))')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[DatabaseService] Supabase getPurchases error:', error.message);
      throw new Error(`Failed to load purchases: ${error.message}`);
    }

    if (data) {
      serviceCache.setPurchases(data as unknown as Purchase[]);
      return data as unknown as Purchase[];
    }
    return [];
  }

  static async createPurchase(
    userId: string | undefined,
    data: {
      supplier_id: string;
      items: Array<{ product_id: string; quantity: number; unit_cost: number }>;
    }
  ): Promise<Purchase> {
    this.validateRolePermission(userId, ['ADMIN', 'MANAGER']);

    if (!data.items || data.items.length === 0) {
      throw new Error('Purchase order must contain at least one product.');
    }

    let subtotal = 0;
    const validatedItems: Array<{ product_id: string; quantity: number; unit_cost: number; total_cost: number }> = [];

    for (const item of data.items) {
      if (item.quantity <= 0) throw new Error('Quantity must be greater than 0.');
      if (item.unit_cost < 0) throw new Error('Unit cost cannot be negative.');

      const total_cost = item.quantity * item.unit_cost;
      subtotal += total_cost;
      validatedItems.push({ product_id: item.product_id, quantity: item.quantity, unit_cost: item.unit_cost, total_cost });
    }

    const tax = Math.round((subtotal * 0.15) * 100) / 100;
    const total = Math.round((subtotal + tax) * 100) / 100;
    const invoiceNumber = `PO-${Date.now().toString().slice(-6)}`;

    const { data: purchaseData, error: purchaseError } = await supabase
      .from('purchases')
      .insert({
        supplier_id: data.supplier_id,
        invoice_number: invoiceNumber,
        subtotal,
        tax,
        total,
        status: 'DRAFT',
        purchase_date: new Date().toISOString().split('T')[0],
        created_by: userId!
      })
      .select('*, supplier:suppliers(*)')
      .single();

    if (purchaseError) {
      if (purchaseError.code === '23503') throw new Error('Selected supplier not found.');
      throw new Error(`Failed to create purchase: ${purchaseError.message}`);
    }

    const purchaseItemsToInsert = validatedItems.map(val => ({
      purchase_id: purchaseData.id,
      product_id: val.product_id,
      quantity: val.quantity,
      unit_cost: val.unit_cost,
      total_cost: val.total_cost
    }));

    const { error: itemsError } = await supabase
      .from('purchase_items')
      .insert(purchaseItemsToInsert);

    if (itemsError) {
      // In a real application, you'd want to rollback the purchase creation here or use an RPC
      console.error('[DatabaseService] Failed to insert purchase items:', itemsError.message);
      throw new Error(`Failed to create purchase items: ${itemsError.message}`);
    }

    serviceCache.invalidatePurchases();
    serviceCache.invalidateAnalytics();
    return purchaseData as unknown as Purchase;
  }

  static async receivePurchase(purchaseId: string, receivedBy?: string) {
    this.validateRolePermission(receivedBy, ['ADMIN', 'MANAGER']);

    const { data, error } = await supabase.rpc('receive_purchase_and_increment_stock', {
      p_purchase_id: purchaseId,
      p_received_by: receivedBy,
    });

    if (error) {
      throw new Error(`Purchase receiving failed: ${error.message}`);
    }

    if (data && data.success) {
      serviceCache.invalidatePurchases();
      serviceCache.invalidateProducts();
      serviceCache.invalidateAnalytics();
      return data;
    }

    throw new Error('Purchase receiving failed: No valid response from server.');
  }

  static async getBusinessMetrics(
    userId?: string,
    startDate?: string,
    endDate?: string
  ): Promise<BusinessMetrics> {
    this.validateRolePermission(userId, ['ADMIN', 'MANAGER']);

    try {
      const { data, error } = await supabase.rpc('get_business_metrics', {
        p_start_date: startDate || null,
        p_end_date: endDate || null,
      });

      if (!error && data) {
        return data as unknown as BusinessMetrics;
      }
    } catch (e) {
      console.warn('[DatabaseService] Supabase getBusinessMetrics fallback.');
    }

    const allOrders = await this.getOrders();
    const products = await this.getProducts();
    let orders = allOrders;

    if (startDate) {
      const startMs = new Date(startDate).getTime();
      orders = orders.filter(o => new Date(o.created_at).getTime() >= startMs);
    }
    if (endDate) {
      const endMs = new Date(endDate).getTime();
      orders = orders.filter(o => new Date(o.created_at).getTime() <= endMs);
    }

    const completedOrders = orders.filter(o => o.status === 'COMPLETED');
    const cancelledOrders = orders.filter(o => o.status === 'CANCELLED');
    const totalOrderCount = orders.length;

    let totalRevenue = 0;
    let grossProfit = 0;
    const productSalesMap: Record<string, { name: string; quantity: number }> = {};

    for (const order of completedOrders) {
      const payment = order.payments?.find(p => p.status === 'PAID');
      if (payment) {
        totalRevenue += order.total;

        order.items?.forEach(item => {
          grossProfit += (item.unit_price - item.unit_cost) * item.quantity;

          const prodName = item.product?.name || 'Unknown Product';
          if (!productSalesMap[prodName]) {
            productSalesMap[prodName] = { name: prodName, quantity: 0 };
          }
          productSalesMap[prodName].quantity += item.quantity;
        });
      }
    }

    const sortedProducts = Object.values(productSalesMap).sort((a, b) => b.quantity - a.quantity);
    const topProductName = sortedProducts.length > 0 ? sortedProducts[0].name : 'Truffle Smash Burger';

    const completedCount = completedOrders.length;
    const aov = completedCount > 0 ? totalRevenue / completedCount : 0;
    const cancellationRate = totalOrderCount > 0 ? (cancelledOrders.length / totalOrderCount) * 100 : 0;

    const lowStockCount = products.filter(p => p.is_active && p.stock_quantity <= p.minimum_stock).length;

    return {
      total_revenue: Math.round(totalRevenue * 100) / 100,
      completed_orders_count: completedCount,
      average_order_value: Math.round(aov * 100) / 100,
      cancelled_orders_count: cancelledOrders.length,
      cancellation_rate: Math.round(cancellationRate * 100) / 100,
      gross_profit: Math.round(grossProfit * 100) / 100,
      top_selling_product_name: topProductName,
      inventory_low_stock_count: lowStockCount,
    };
  }
  static async getAnalyticsBreakdown(
    userId?: string,
    startDate?: string,
    endDate?: string
  ) {
    this.validateRolePermission(userId, ['ADMIN', 'MANAGER']);

    const allOrders = await this.getOrders();
    const products = await this.getProducts();
    const categories = await this.getCategories();

    let orders = allOrders;
    if (startDate) {
      const startMs = new Date(startDate).getTime();
      orders = orders.filter(o => new Date(o.created_at).getTime() >= startMs);
    }
    if (endDate) {
      const endMs = new Date(endDate).getTime();
      orders = orders.filter(o => new Date(o.created_at).getTime() <= endMs);
    }

    // 1. Status Breakdown
    const statusCounts: Record<string, number> = {
      PENDING: 0,
      CONFIRMED: 0,
      PREPARING: 0,
      READY: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };
    orders.forEach(o => {
      if (statusCounts[o.status] !== undefined) statusCounts[o.status]++;
    });

    // 2. Cancellation Reasons
    const reasonCounts: Record<string, number> = {
      CUSTOMER_REQUEST: 0,
      OUT_OF_STOCK: 0,
      DUPLICATE_ORDER: 0,
      WRONG_ORDER: 0,
      OTHER: 0,
    };
    orders.filter(o => o.status === 'CANCELLED').forEach(o => {
      const r = o.cancellation_reason || 'OTHER';
      if (reasonCounts[r] !== undefined) reasonCounts[r]++;
      else reasonCounts['OTHER']++;
    });

    // 3. Product Performance
    const productStats: Record<string, { product_name: string; quantity: number; revenue: number }> = {};
    orders.filter(o => o.status === 'COMPLETED').forEach(o => {
      const payment = o.payments?.find(p => p.status === 'PAID');
      if (payment) {
        o.items?.forEach(item => {
          const name = item.product?.name || 'Unknown Product';
          if (!productStats[name]) {
            productStats[name] = { product_name: name, quantity: 0, revenue: 0 };
          }
          productStats[name].quantity += item.quantity;
          productStats[name].revenue += item.total;
        });
      }
    });

    const topProducts = Object.values(productStats).sort((a, b) => b.quantity - a.quantity).slice(0, 5);

    // 4. Inventory Health
    const inventoryHealth = products.map(p => ({
      product_name: p.name,
      sku: p.sku,
      stock_quantity: p.stock_quantity,
      minimum_stock: p.minimum_stock,
      status: p.stock_quantity <= 0 ? ('OUT' as const) : p.stock_quantity <= p.minimum_stock ? ('LOW' as const) : ('NORMAL' as const),
    }));

    // 5. Category Performance Breakdown
    const categoryStats: Record<string, { category_name: string; revenue: number; quantity: number }> = {};
    orders.filter(o => o.status === 'COMPLETED').forEach(o => {
      const payment = o.payments?.find(p => p.status === 'PAID');
      if (payment) {
        o.items?.forEach(item => {
          const prod = products.find(p => p.id === item.product_id);
          const cat = prod ? categories.find(c => c.id === prod.category_id) : null;
          const catName = cat ? cat.name : 'General';
          if (!categoryStats[catName]) {
            categoryStats[catName] = { category_name: catName, revenue: 0, quantity: 0 };
          }
          categoryStats[catName].revenue += item.total;
          categoryStats[catName].quantity += item.quantity;
        });
      }
    });

    // 6. Payment Methods Breakdown
    const paymentStats: Record<string, { method: string; amount: number; count: number }> = {
      CASH: { method: 'CASH', amount: 0, count: 0 },
      CARD: { method: 'CARD', amount: 0, count: 0 },
      MADA: { method: 'MADA', amount: 0, count: 0 },
      APPLE_PAY: { method: 'APPLE_PAY', amount: 0, count: 0 },
      OTHER: { method: 'OTHER', amount: 0, count: 0 },
    };
    orders.filter(o => o.status === 'COMPLETED').forEach(o => {
      const payments = o.payments?.filter(p => p.status === 'PAID') || [];
      payments.forEach(p => {
        const m = paymentStats[p.payment_method] ? p.payment_method : 'OTHER';
        paymentStats[m].amount += p.amount;
        paymentStats[m].count += 1;
      });
    });

    // 7. Revenue & Gross Profit Time Series Trend
    const dailyTrendMap: Record<string, { date: string; revenue: number; profit: number; orders: number }> = {};
    orders.forEach(o => {
      const dateStr = new Date(o.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!dailyTrendMap[dateStr]) {
        dailyTrendMap[dateStr] = { date: dateStr, revenue: 0, profit: 0, orders: 0 };
      }
      if (o.status === 'COMPLETED') {
        const payment = o.payments?.find(p => p.status === 'PAID');
        if (payment) {
          dailyTrendMap[dateStr].revenue += o.total;
          dailyTrendMap[dateStr].orders += 1;
          o.items?.forEach(item => {
            dailyTrendMap[dateStr].profit += (item.unit_price - item.unit_cost) * item.quantity;
          });
        }
      }
    });

    return {
      status_breakdown: Object.entries(statusCounts).map(([status, count]) => ({ status, count })),
      cancellation_reasons: Object.entries(reasonCounts).map(([reason, count]) => ({ reason, count })),
      top_products: topProducts,
      inventory_health: inventoryHealth,
      category_performance: Object.values(categoryStats),
      payment_methods: Object.values(paymentStats),
      revenue_profit_trend: Object.values(dailyTrendMap),
    };
  }
}
