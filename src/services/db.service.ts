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
import { chunkText, generateLocalEmbedding, cosineSimilarity } from '@/lib/rag-utils';
import {
  User,
  Role,
  UserAuditLog,
  UserSummary,
  Category,
  Product,
  Customer,
  RestaurantTable,
  Order,
  OrderItem,
  Payment,
  Supplier,
  Purchase,
  PurchaseStatus,
  PurchaseItem,
  GoodsReceipt,
  GoodsReceiptItem,
  PurchaseInvoice,
  PurchaseInvoiceItem,
  InvoiceStatus,
  InvoicePaymentStatus,
  SupplierStatement,
  BusinessMetrics,
  OrderStatus,
  CancellationReason,
  UserRole,
  TableStatus,
  CustomerType,
  KnowledgeDocument,
  KnowledgeChunk,
  RagSourceCitation,
  KnowledgeCategory,
  KnowledgeSourceType,
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
    { id: 'p0000000-0000-0000-0000-000000000001', supplier_id: 's0000000-0000-0000-0000-000000000001', invoice_number: 'PO-2026-001', subtotal: 1800.00, tax: 270.00, total: 2070.00, status: 'RECEIVED', purchase_date: new Date().toISOString().split('T')[0], created_by: '11111111-1111-1111-1111-111111111111', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'p0000000-0000-0000-0000-000000000002', supplier_id: 's0000000-0000-0000-0000-000000000002', invoice_number: 'PO-2026-002', subtotal: 650.00, tax: 97.50, total: 747.50, status: 'PENDING_RECEIPT', purchase_date: new Date().toISOString().split('T')[0], created_by: '22222222-2222-2222-2222-222222222222', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
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
      purchase_id: 'p0000000-0000-0000-0000-000000000001',
      product_id: 'b0000000-0000-0000-0000-000000000001',
      quantity: 25,
      received_quantity: 25,
      unit_cost: 18.00,
      total_cost: 450.00,
      created_at: new Date().toISOString(),
    },
    {
      id: 'pi000000-0000-0000-0000-000000000002',
      purchase_id: 'p0000000-0000-0000-0000-000000000001',
      product_id: 'b0000000-0000-0000-0000-000000000005',
      quantity: 10,
      received_quantity: 10,
      unit_cost: 5.00,
      total_cost: 50.00,
      created_at: new Date().toISOString(),
    },
    {
      id: 'pi000000-0000-0000-0000-000000000003',
      purchase_id: 'p0000000-0000-0000-0000-000000000002',
      product_id: 'b0000000-0000-0000-0000-000000000008',
      quantity: 50,
      received_quantity: 0,
      unit_cost: 5.00,
      total_cost: 250.00,
      created_at: new Date().toISOString(),
    },
    {
      id: 'pi000000-0000-0000-0000-000000000004',
      purchase_id: 'p0000000-0000-0000-0000-000000000002',
      product_id: 'b0000000-0000-0000-0000-000000000009',
      quantity: 40,
      received_quantity: 0,
      unit_cost: 6.50,
      total_cost: 260.00,
      created_at: new Date().toISOString(),
    },
  ];

  public goodsReceipts: GoodsReceipt[] = [
    {
      id: 'gr000000-0000-0000-0000-000000000001',
      receipt_number: 'GRN-2026-001',
      purchase_id: 'p0000000-0000-0000-0000-000000000001',
      supplier_id: 's0000000-0000-0000-0000-000000000001',
      received_by: '11111111-1111-1111-1111-111111111111',
      received_at: new Date().toISOString(),
      notes: 'Delivered in full, temperature and quality checked OK',
      created_at: new Date().toISOString(),
    }
  ];

  public goodsReceiptItems: GoodsReceiptItem[] = [
    {
      id: 'gri00000-0000-0000-0000-000000000001',
      receipt_id: 'gr000000-0000-0000-0000-000000000001',
      purchase_item_id: 'pi000000-0000-0000-0000-000000000001',
      product_id: 'b0000000-0000-0000-0000-000000000001',
      quantity_received: 25,
      unit_cost: 18.00,
      created_at: new Date().toISOString(),
    },
    {
      id: 'gri00000-0000-0000-0000-000000000002',
      receipt_id: 'gr000000-0000-0000-0000-000000000001',
      purchase_item_id: 'pi000000-0000-0000-0000-000000000002',
      product_id: 'b0000000-0000-0000-0000-000000000005',
      quantity_received: 10,
      unit_cost: 5.00,
      created_at: new Date().toISOString(),
    }
  ];

  public purchaseInvoices: PurchaseInvoice[] = [
    {
      id: 'pinv0000-0000-0000-0000-000000000001',
      invoice_number: 'PINV-2026-001',
      supplier_invoice_number: 'SUP-INV-8891',
      purchase_id: 'p0000000-0000-0000-0000-000000000001',
      receipt_id: 'gr000000-0000-0000-0000-000000000001',
      supplier_id: 's0000000-0000-0000-0000-000000000001',
      issue_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      subtotal: 1800.00,
      tax: 270.00,
      discount: 0.00,
      total: 2070.00,
      paid_amount: 2070.00,
      payment_status: 'PAID',
      status: 'POSTED',
      notes: 'Paid via bank transfer',
      created_by: '11111111-1111-1111-1111-111111111111',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  ];

  public purchaseInvoiceItems: PurchaseInvoiceItem[] = [
    {
      id: 'pii00000-0000-0000-0000-000000000001',
      invoice_id: 'pinv0000-0000-0000-0000-000000000001',
      product_id: 'b0000000-0000-0000-0000-000000000001',
      quantity: 25,
      unit_cost: 18.00,
      discount: 0.00,
      tax: 67.50,
      total_cost: 517.50,
      created_at: new Date().toISOString(),
    },
    {
      id: 'pii00000-0000-0000-0000-000000000002',
      invoice_id: 'pinv0000-0000-0000-0000-000000000001',
      product_id: 'b0000000-0000-0000-0000-000000000005',
      quantity: 10,
      unit_cost: 5.00,
      discount: 0.00,
      tax: 7.50,
      total_cost: 57.50,
      created_at: new Date().toISOString(),
    }
  ];

  public knowledgeDocuments: KnowledgeDocument[] = [
    {
      id: 'e0000000-0000-0000-0000-000000000001',
      title: 'Order Cancellation & Inventory Restoration Policy',
      description: 'Standard operating procedure for handling order cancellations and stock return.',
      category: 'CANCELLATION_REFUND',
      source_type: 'POLICY',
      source_name: 'RestoFlow SOP-OPS-001',
      content: 'Orders can be cancelled before food preparation begins or in special customer request cases. When an order is cancelled in RestoFlow: 1. A mandatory cancellation reason must be recorded (e.g., Customer Request, Item Out of Stock, Duplicate Order). 2. Inventory quantities for every order item are atomically restored to the physical stock balance immediately. 3. If payment was already collected, a formal refund workflow must be initiated. Staff must never discard cancelled food items without logging waste.',
      allowed_roles: ['ADMIN', 'MANAGER', 'CASHIER', 'STAFF'],
      chunk_count: 1,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'e0000000-0000-0000-0000-000000000002',
      title: 'Customer Payment Refund & Financial Audit Guidelines',
      description: 'Guidelines for issuing customer refunds and reconciliation.',
      category: 'CANCELLATION_REFUND',
      source_type: 'POLICY',
      source_name: 'RestoFlow SOP-FIN-002',
      content: 'Refunds are strictly permitted for orders where quality standards were unmet or billing discrepancies occurred. 1. Only Cashiers with authorization or Managers may process refunds. 2. Card and MADA payments must be refunded back to the original payment method where supported. 3. The refund transaction is recorded in the audit log and updates the payment status to REFUNDED. 4. Cash refunds require an explicit receipt signed by the manager on duty.',
      allowed_roles: ['ADMIN', 'MANAGER', 'CASHIER'],
      chunk_count: 1,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'e0000000-0000-0000-0000-000000000003',
      title: 'Inventory Thresholds & Automated Reorder Policy',
      description: 'Procedures for tracking minimum stock balances and purchase triggers.',
      category: 'INVENTORY',
      source_type: 'SOP',
      source_name: 'RestoFlow SOP-INV-003',
      content: 'Every restaurant menu item has a designated minimum stock alert threshold (default 5 units). When current stock drops to or below the minimum threshold: 1. The inventory dashboard displays a Low Stock warning badge. 2. A purchase order must be drafted to the designated supplier within 24 hours. 3. If stock reaches zero, the POS system automatically marks the product as Out of Stock to prevent unfulfillable orders. Physical stock counts must be audited weekly.',
      allowed_roles: ['ADMIN', 'MANAGER', 'STAFF'],
      chunk_count: 1,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'e0000000-0000-0000-0000-000000000004',
      title: 'Procurement & Goods Receiving Procedure',
      description: 'Receiving supplier deliveries and atomic stock incrementation.',
      category: 'PURCHASING',
      source_type: 'SOP',
      source_name: 'RestoFlow SOP-PUR-004',
      content: 'Upon supplier delivery: 1. The receiving manager must verify the delivery note against the RestoFlow Purchase Order. 2. Inspect packaging, temperature, and product quality. 3. Confirm quantities in the RestoFlow Purchases module and click Receive Stock. 4. Receiving atomically increments physical inventory stock counts and captures VAT (15%) invoice totals into purchasing cost history.',
      allowed_roles: ['ADMIN', 'MANAGER'],
      chunk_count: 1,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'e0000000-0000-0000-0000-000000000005',
      title: 'POS Cash Drawer & End-of-Day Terminal Closing SOP',
      description: 'Cashier shift handover and terminal balancing.',
      category: 'POS',
      source_type: 'SOP',
      source_name: 'RestoFlow SOP-POS-005',
      content: 'At the end of each cashier shift: 1. Reconcile physical cash drawer contents against the RestoFlow daily payment breakdown (Cash, MADA, Credit Card, Apple Pay). 2. Discrepancies greater than 20 SAR must be documented and signed by the shift supervisor. 3. The cashier must complete all open pending table tickets before terminal handover. 4. Lock the terminal screen upon departure.',
      allowed_roles: ['ADMIN', 'MANAGER', 'CASHIER'],
      chunk_count: 1,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'e0000000-0000-0000-0000-000000000006',
      title: 'Dining Hall Table Turnover & Cleanliness Standards',
      description: 'Table reservations, turnover speed, and sanitization.',
      category: 'OPERATIONS',
      source_type: 'SOP',
      source_name: 'RestoFlow SOP-TBL-006',
      content: 'Dining tables transition across four operational states: AVAILABLE, OCCUPIED, RESERVED, and CLEANING. 1. Floor staff must seat guests within 2 minutes of arrival. 2. Once guests vacate, table status must be updated to CLEANING. 3. Sanitize table surface, reset cutlery, and switch status back to AVAILABLE within 3 minutes. 4. Reserved tables must be held up to 15 minutes past reservation time.',
      allowed_roles: ['ADMIN', 'MANAGER', 'STAFF', 'CASHIER'],
      chunk_count: 1,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'e0000000-0000-0000-0000-000000000007',
      title: 'Executive Management KPI & Margin Strategy',
      description: 'Strategic guidelines for target gross margins, ticket sizes, and revenue targets.',
      category: 'MANAGEMENT',
      source_type: 'POLICY',
      source_name: 'RestoFlow SOP-MGT-007',
      content: 'Management targets a minimum gross profit margin of 60% across all food categories and 75% for beverage categories. Average Order Value (AOV) must be monitored daily on the BI Dashboard. Cancellation rates exceeding 3% require an operational review with the kitchen manager. VIP customer profiles must be greeted by the manager on duty and are eligible for 10% complimentary discounts.',
      allowed_roles: ['ADMIN', 'MANAGER'],
      chunk_count: 1,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  public knowledgeChunks: KnowledgeChunk[] = [];

  constructor() {
    this.refreshKnowledgeChunks();
  }

  public refreshKnowledgeChunks(): void {
    this.knowledgeChunks = [];
    for (const doc of this.knowledgeDocuments) {
      if (!doc.is_active) continue;
      const texts = chunkText(doc.content);
      doc.chunk_count = texts.length;
      texts.forEach((text, idx) => {
        this.knowledgeChunks.push({
          id: `chunk-${doc.id}-${idx}`,
          document_id: doc.id,
          chunk_index: idx,
          content: text,
          embedding: generateLocalEmbedding(text),
          created_at: doc.created_at,
        });
      });
    }
  }

  private orderSeq = 106;
  private receiptSeq = 102;
  private invoiceSeq = 102;

  public generateOrderNumber(): string {
    const seq = this.orderSeq++;
    return `ORD-${String(seq).padStart(6, '0')}`;
  }

  public generateReceiptNumber(): string {
    const seq = this.receiptSeq++;
    return `GRN-${String(seq).padStart(6, '0')}`;
  }

  public generateInvoiceNumber(): string {
    const seq = this.invoiceSeq++;
    return `PINV-${String(seq).padStart(6, '0')}`;
  }

  public getPurchasesWithRelations(): Purchase[] {
    return this.purchases.map(p => ({
      ...p,
      supplier: this.suppliers.find(s => s.id === p.supplier_id),
      items: this.purchaseItems
        .filter(item => item.purchase_id === p.id)
        .map(item => ({
          ...item,
          product: this.products.find(prod => prod.id === item.product_id),
        })),
    }));
  }

  public getGoodsReceiptsWithRelations(purchaseId?: string): GoodsReceipt[] {
    let list = this.goodsReceipts;
    if (purchaseId) {
      list = list.filter(gr => gr.purchase_id === purchaseId);
    }
    return list.map(gr => {
      const user = this.users.find(u => u.id === gr.received_by);
      return {
        ...gr,
        supplier: this.suppliers.find(s => s.id === gr.supplier_id),
        purchase: this.purchases.find(p => p.id === gr.purchase_id),
        receiver: user ? { id: user.id, name: user.name } : undefined,
        items: this.goodsReceiptItems
          .filter(gri => gri.receipt_id === gr.id)
          .map(gri => ({
            ...gri,
            product: this.products.find(prod => prod.id === gri.product_id),
          })),
      };
    });
  }

  public getPurchaseInvoicesWithRelations(supplierId?: string): PurchaseInvoice[] {
    let list = this.purchaseInvoices;
    if (supplierId) {
      list = list.filter(pi => pi.supplier_id === supplierId);
    }
    return list.map(pi => {
      const user = this.users.find(u => u.id === pi.created_by);
      return {
        ...pi,
        supplier: this.suppliers.find(s => s.id === pi.supplier_id),
        purchase: this.purchases.find(p => p.id === pi.purchase_id),
        receipt: this.goodsReceipts.find(gr => gr.id === pi.receipt_id),
        creator: user ? { id: user.id, name: user.name } : undefined,
        items: this.purchaseInvoiceItems
          .filter(pii => pii.invoice_id === pi.id)
          .map(pii => ({
            ...pii,
            product: this.products.find(prod => prod.id === pii.product_id),
          })),
      };
    });
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
  private goodsReceipts: CacheEntry<GoodsReceipt[]> | null = null;
  private purchaseInvoices: CacheEntry<PurchaseInvoice[]> | null = null;
  private users: CacheEntry<User[]> | null = null;
  private knowledgeDocuments: CacheEntry<KnowledgeDocument[]> | null = null;
  private analyticsBreakdown: CacheEntry<any> | null = null;
  private businessMetrics: CacheEntry<BusinessMetrics> | null = null;
  private analyticsPreset: string | null = null;
  private readonly TTL = 10000; // 10s TTL

  getUsers(): User[] | null {
    if (this.users && Date.now() - this.users.timestamp < this.TTL) {
      return this.users.data;
    }
    return null;
  }

  setUsers(data: User[]) {
    this.users = { data, timestamp: Date.now() };
  }

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

  getGoodsReceipts(): GoodsReceipt[] | null {
    if (this.goodsReceipts && Date.now() - this.goodsReceipts.timestamp < this.TTL) {
      return this.goodsReceipts.data;
    }
    return null;
  }

  setGoodsReceipts(data: GoodsReceipt[]) {
    this.goodsReceipts = { data, timestamp: Date.now() };
  }

  getPurchaseInvoices(): PurchaseInvoice[] | null {
    if (this.purchaseInvoices && Date.now() - this.purchaseInvoices.timestamp < this.TTL) {
      return this.purchaseInvoices.data;
    }
    return null;
  }

  setPurchaseInvoices(data: PurchaseInvoice[]) {
    this.purchaseInvoices = { data, timestamp: Date.now() };
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
  
  updateOrder(updatedOrder: Order) {
    if (this.orders && this.orders.data) {
      const index = this.orders.data.findIndex(o => o.id === updatedOrder.id);
      if (index !== -1) {
        this.orders.data[index] = updatedOrder;
      }
    }
  }

  invalidateSuppliers() {
    this.suppliers = null;
  }

  invalidatePurchases() {
    this.purchases = null;
  }

  invalidateGoodsReceipts() {
    this.goodsReceipts = null;
  }

  invalidatePurchaseInvoices() {
    this.purchaseInvoices = null;
  }

  getKnowledgeDocuments(): KnowledgeDocument[] | null {
    if (this.knowledgeDocuments && Date.now() - this.knowledgeDocuments.timestamp < this.TTL) {
      return this.knowledgeDocuments.data;
    }
    return null;
  }

  setKnowledgeDocuments(data: KnowledgeDocument[]) {
    this.knowledgeDocuments = { data, timestamp: Date.now() };
  }

  invalidateKnowledge() {
    this.knowledgeDocuments = null;
  }

  invalidateUsers() {
    this.users = null;
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
    this.goodsReceipts = null;
    this.purchaseInvoices = null;
    this.users = null;
    this.knowledgeDocuments = null;
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

  static getCachedGoodsReceiptsSync(): GoodsReceipt[] | null {
    return serviceCache.getGoodsReceipts();
  }

  static getCachedPurchaseInvoicesSync(): PurchaseInvoice[] | null {
    return serviceCache.getPurchaseInvoices();
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
      .select()
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

    console.log('[CustomerCreate] Supabase insert started');
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

    console.log('[CustomerCreate] Supabase response:', { error, dbData });
    console.log('[CustomerCreate] Returned data:', dbData);
    console.log('[CustomerCreate] Returned error:', error);

    if (error) {
      console.error('[CustomerCreate] Supabase createCustomer error:', error.message, error.code, error.details, error.hint);
      throw new Error(`Failed to create customer: ${error.message}`);
    }

    if (dbData) {
      console.log('[CustomerCreate] Refreshing customer cache');
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
    this.validateRolePermission(userId, ['ADMIN', 'MANAGER', 'CASHIER']);

    const { count, error: countError } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('customer_id', id);

    if (countError) {
      throw new Error(`Failed to verify customer history: ${countError.message}`);
    }

    if (count && count > 0) {
      throw new Error('[HISTORICAL_DATA] Cannot delete this customer because they have existing orders.');
    }

    const { data, error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id)
      .select();

    if (error) {
      if (error.code === '23503' || error.message.includes('foreign key constraint')) {
        throw new Error('[HISTORICAL_DATA] Cannot delete this customer because they have historical orders or transactions attached to them.');
      }
      throw new Error(`Failed to delete customer: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error('Failed to delete customer. The record may have already been removed.');
    }

    serviceCache.invalidateCustomers();
  }

  static async deactivateCustomer(userId: string | undefined, id: string): Promise<void> {
    this.validateRolePermission(userId, ['ADMIN', 'MANAGER']);

    const { error } = await supabase
      .from('customers')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      console.error('[DatabaseService] Supabase deactivateCustomer error:', error.message);
      throw new Error(`Failed to deactivate customer: ${error.message}`);
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

    try {
      const { data, error } = await supabase
        .from('products')
        .select('*, category:categories(name)')
        .order('name');
        
      if (!error && data && data.length > 0) {
        serviceCache.setProducts(data as Product[]);
        return data as Product[];
      }
    } catch (err: any) {
      console.warn('[DatabaseService] Supabase getProducts fallback to localDb:', err.message);
    }
    return localDb.products;
  }

  static async uploadProductImage(file: File): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('product-images')
      .upload(fileName, file, { upsert: false });

    if (error) {
      console.error('[DatabaseService] uploadProductImage error:', error.message);
      throw new Error(`Failed to upload image: ${error.message}`);
    }

    const { data: publicUrlData } = supabase.storage
      .from('product-images')
      .getPublicUrl(fileName);

    return publicUrlData.publicUrl;
  }

  static async deleteProductImage(imageUrl: string): Promise<void> {
    if (!imageUrl || !imageUrl.includes('product-images')) return;

    try {
      // Extract filename from URL
      const urlParts = imageUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];
      if (!fileName) return;

      const { error } = await supabase.storage
        .from('product-images')
        .remove([fileName]);

      if (error) {
        console.error('[DatabaseService] deleteProductImage error:', error.message);
      }
    } catch (err) {
      console.error('[DatabaseService] Failed to delete old image:', err);
    }
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

  static async getOrders(forceRefresh: boolean = false, statusFilter?: string): Promise<Order[]> {
    if (forceRefresh) {
      serviceCache.invalidateOrders();
    }
    
    const cached = serviceCache.getOrders();
    if (cached) {
      if (statusFilter === 'ACTIVE') return cached.filter(o => o.status !== 'CANCELLED');
      return cached;
    }

    let query = supabase
      .from('orders')
      .select('id, order_number, customer_id, table_id, user_id, order_type, status, subtotal, discount, tax, total, notes, cancelled_at, cancelled_by, cancellation_reason, stock_deducted, created_at, updated_at, customer:customers(id, name, phone), table:restaurant_tables(id, table_number), user:users!orders_user_id_fkey(id, name), items:order_items(id, order_id, product_id, quantity, unit_price, unit_cost, discount, total, product:products(id, name, sku)), payments:payments(id, order_id, payment_method, amount, status, paid_at)')
      .order('created_at', { ascending: false });

    if (statusFilter === 'ACTIVE') {
      query = query.neq('status', 'CANCELLED');
    }

    const { data, error } = await query;

    if (error) {
      console.error('[DatabaseService] Supabase getOrders error:', error.message);
      throw new Error(`Failed to load orders: ${error.message}`);
    }

    if (data) {
      // Only cache if we fetched the complete dataset to avoid poisoning the analytics cache
      if (statusFilter !== 'ACTIVE') {
        serviceCache.setOrders(data as unknown as Order[]);
      }
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
      // Opt out of full list invalidation; we will update specific orders locally
      // serviceCache.invalidateOrders();
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
      // Opt out of full list invalidation; we will update specific orders locally
      // serviceCache.invalidateOrders();
      serviceCache.invalidateAnalytics();
      return data;
    }

    throw new Error('Refund failed: No valid response from server.');
  }
  
  static updateOrderCache(updatedOrder: Order) {
    serviceCache.updateOrder(updatedOrder);
  }

  static async getSuppliers(): Promise<Supplier[]> {
    const cached = serviceCache.getSuppliers();
    if (cached) return cached;

    try {
      const { data, error } = await supabase.from('suppliers').select('*').order('name');
      if (!error && data && data.length > 0) {
        serviceCache.setSuppliers(data as Supplier[]);
        return data as Supplier[];
      }
    } catch (err: any) {
      console.warn('[DatabaseService] Supabase getSuppliers fallback to localDb:', err.message);
    }
    return localDb.suppliers;
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

    try {
      const { data, error } = await supabase
        .from('purchases')
        .select('*, supplier:suppliers(*), items:purchase_items(*, product:products(*))')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[DatabaseService] Supabase getPurchases error, using local fallback:', error.message);
        return localDb.getPurchasesWithRelations();
      }

      if (data && data.length > 0) {
        serviceCache.setPurchases(data as unknown as Purchase[]);
        return data as unknown as Purchase[];
      }
    } catch (err: any) {
      console.warn('[DatabaseService] Supabase getPurchases exception, using local fallback:', err.message);
      return localDb.getPurchasesWithRelations();
    }
    return localDb.getPurchasesWithRelations();
  }

  static async getPurchaseById(purchaseId: string): Promise<Purchase | null> {
    try {
      const { data, error } = await supabase
        .from('purchases')
        .select('*, supplier:suppliers(*), items:purchase_items(*, product:products(*))')
        .eq('id', purchaseId)
        .single();

      if (!error && data) {
        return data as unknown as Purchase;
      }
    } catch (err) {
      // Fallback
    }
    const found = localDb.getPurchasesWithRelations().find(p => p.id === purchaseId);
    return found || null;
  }

  static async createPurchase(
    userId: string | undefined,
    data: {
      supplier_id: string;
      items: Array<{ product_id: string; quantity: number; unit_cost: number }>;
      notes?: string;
      discount?: number;
      expected_delivery_date?: string;
      status?: PurchaseStatus;
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

    const discount = data.discount && data.discount > 0 ? data.discount : 0;
    const taxableAmount = Math.max(0, subtotal - discount);
    const tax = Math.round((taxableAmount * 0.15) * 100) / 100;
    const total = Math.round((taxableAmount + tax) * 100) / 100;
    const invoiceNumber = `PO-${Date.now().toString().slice(-6)}`;
    const status: PurchaseStatus = data.status || 'PENDING_RECEIPT';

    try {
      const { data: purchaseData, error: purchaseError } = await supabase
        .from('purchases')
        .insert({
          supplier_id: data.supplier_id,
          invoice_number: invoiceNumber,
          subtotal,
          discount,
          tax,
          total,
          status,
          notes: data.notes || null,
          expected_delivery_date: data.expected_delivery_date || null,
          purchase_date: new Date().toISOString().split('T')[0],
          created_by: userId!
        })
        .select('*, supplier:suppliers(*)')
        .single();

      if (!purchaseError && purchaseData) {
        const purchaseItemsToInsert = validatedItems.map(val => ({
          purchase_id: purchaseData.id,
          product_id: val.product_id,
          quantity: val.quantity,
          received_quantity: 0,
          unit_cost: val.unit_cost,
          total_cost: val.total_cost
        }));

        const { error: itemsError } = await supabase
          .from('purchase_items')
          .insert(purchaseItemsToInsert);

        if (itemsError) {
          console.error('[DatabaseService] Failed to insert purchase items into Supabase:', itemsError.message);
        } else {
          serviceCache.invalidatePurchases();
          serviceCache.invalidateAnalytics();
          return purchaseData as unknown as Purchase;
        }
      }
    } catch (err: any) {
      console.warn('[DatabaseService] Supabase createPurchase error, using localDb fallback:', err.message);
    }

    // LocalDb Fallback (atomically records PO without touching stock)
    const newPurchaseId = `p0000000-${Date.now().toString().slice(-12)}`;
    const newPurchase: Purchase = {
      id: newPurchaseId,
      supplier_id: data.supplier_id,
      invoice_number: invoiceNumber,
      subtotal,
      discount,
      tax,
      total,
      status,
      notes: data.notes,
      expected_delivery_date: data.expected_delivery_date,
      purchase_date: new Date().toISOString().split('T')[0],
      created_by: userId || '11111111-1111-1111-1111-111111111111',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: [],
    };

    const newItems: PurchaseItem[] = validatedItems.map((val, idx) => ({
      id: `pi-${Date.now()}-${idx}`,
      purchase_id: newPurchaseId,
      product_id: val.product_id,
      quantity: val.quantity,
      received_quantity: 0,
      unit_cost: val.unit_cost,
      total_cost: val.total_cost,
      created_at: new Date().toISOString(),
    }));

    localDb.purchases.unshift(newPurchase);
    localDb.purchaseItems.push(...newItems);
    newPurchase.items = newItems;
    newPurchase.supplier = localDb.suppliers.find(s => s.id === data.supplier_id);

    serviceCache.invalidatePurchases();
    serviceCache.invalidateAnalytics();
    return newPurchase;
  }

  static async createPurchaseOrder(
    userId: string | undefined,
    supplierId: string,
    invoiceNumber: string,
    items: Array<{ product_id: string; quantity: number; unit_cost: number }>,
    options?: {
      notes?: string;
      discount?: number;
      expected_delivery_date?: string;
      status?: PurchaseStatus;
    }
  ): Promise<Purchase> {
    return this.createPurchase(userId, {
      supplier_id: supplierId,
      items,
      notes: options?.notes,
      discount: options?.discount,
      expected_delivery_date: options?.expected_delivery_date,
      status: options?.status,
    });
  }

  static async cancelPurchaseOrder(userId: string | undefined, purchaseId: string, reason?: string): Promise<void> {
    this.validateRolePermission(userId, ['ADMIN', 'MANAGER']);

    // Check if PO was already received
    const po = await this.getPurchaseById(purchaseId);
    if (!po) throw new Error('Purchase order not found.');
    if (po.status === 'RECEIVED' || po.status === 'PARTIALLY_RECEIVED') {
      throw new Error('Cannot cancel a purchase order that has already been partially or fully received.');
    }

    try {
      await supabase
        .from('purchases')
        .update({ status: 'CANCELLED', notes: reason ? `${po.notes ? po.notes + ' | ' : ''}Cancelled: ${reason}` : po.notes, updated_at: new Date().toISOString() })
        .eq('id', purchaseId);
    } catch (e) {
      // Local fallback
    }

    const localIdx = localDb.purchases.findIndex(p => p.id === purchaseId);
    if (localIdx !== -1) {
      localDb.purchases[localIdx].status = 'CANCELLED';
      localDb.purchases[localIdx].updated_at = new Date().toISOString();
    }

    serviceCache.invalidatePurchases();
    serviceCache.invalidateAnalytics();
  }

  /**
   * Goods Receipts (محاضر استلام البضائع)
   */
  static async getGoodsReceipts(purchaseId?: string): Promise<GoodsReceipt[]> {
    const cached = serviceCache.getGoodsReceipts();
    if (cached && !purchaseId) return cached;

    try {
      let query = supabase
        .from('goods_receipts')
        .select('*, supplier:suppliers(*), purchase:purchases(*), receiver:users(id, name), items:goods_receipt_items(*, product:products(*))')
        .order('received_at', { ascending: false });

      if (purchaseId) {
        query = query.eq('purchase_id', purchaseId);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        if (!purchaseId) serviceCache.setGoodsReceipts(data as unknown as GoodsReceipt[]);
        return data as unknown as GoodsReceipt[];
      }
    } catch (err: any) {
      console.warn('[DatabaseService] Supabase getGoodsReceipts fallback:', err.message);
    }
    return localDb.getGoodsReceiptsWithRelations(purchaseId);
  }

  static async recordGoodsReceipt(params: {
    purchase_id: string;
    received_by?: string;
    receipt_number?: string;
    items: Array<{ purchase_item_id: string; product_id: string; quantity_received: number; unit_cost?: number }>;
    notes?: string;
  }): Promise<{ success: boolean; receipt_id: string; receipt_number: string; purchase_status: PurchaseStatus }> {
    this.validateRolePermission(params.received_by, ['ADMIN', 'MANAGER']);

    if (!params.items || params.items.length === 0) {
      throw new Error('No items specified for goods receipt.');
    }

    const receiptNumber = params.receipt_number || localDb.generateReceiptNumber();

    // 1. Try Supabase Atomic RPC
    try {
      const { data, error } = await supabase.rpc('record_goods_receipt_and_increment_stock', {
        p_purchase_id: params.purchase_id,
        p_received_by: params.received_by,
        p_receipt_number: receiptNumber,
        p_items: params.items,
        p_notes: params.notes || null,
      });

      if (!error && data && data.success) {
        serviceCache.invalidatePurchases();
        serviceCache.invalidateProducts();
        serviceCache.invalidateGoodsReceipts();
        serviceCache.invalidateAnalytics();
        return data;
      }
      if (error) {
        console.warn('[DatabaseService] RPC record_goods_receipt_and_increment_stock failed, running local atomic fallback:', error.message);
      }
    } catch (err: any) {
      console.warn('[DatabaseService] RPC call exception, running local atomic fallback:', err.message);
    }

    // 2. Local Fallback Atomic Transaction Engine
    const poIndex = localDb.purchases.findIndex(p => p.id === params.purchase_id);
    if (poIndex === -1) throw new Error('Purchase order not found.');
    const po = localDb.purchases[poIndex];

    if (po.status === 'CANCELLED') {
      throw new Error('Cannot receive goods for a cancelled purchase order.');
    }
    if (po.status === 'RECEIVED') {
      throw new Error('This purchase order has already been fully received.');
    }

    const receiptId = `gr-${Date.now()}`;
    const newReceipt: GoodsReceipt = {
      id: receiptId,
      receipt_number: receiptNumber,
      purchase_id: params.purchase_id,
      supplier_id: po.supplier_id,
      received_by: params.received_by || '11111111-1111-1111-1111-111111111111',
      received_at: new Date().toISOString(),
      notes: params.notes,
      created_at: new Date().toISOString(),
      items: [],
    };

    let anyReceived = false;
    for (const item of params.items) {
      if (item.quantity_received > 0) {
        const poItemIndex = localDb.purchaseItems.findIndex(pi => pi.id === item.purchase_item_id);
        if (poItemIndex === -1) {
          throw new Error(`Purchase item ${item.purchase_item_id} not found.`);
        }
        const poItem = localDb.purchaseItems[poItemIndex];
        const alreadyReceived = poItem.received_quantity || 0;
        const remaining = poItem.quantity - alreadyReceived;

        if (item.quantity_received > remaining) {
          throw new Error(`Received quantity (${item.quantity_received}) exceeds remaining ordered quantity (${remaining}).`);
        }

        // Increment purchase item received quantity
        poItem.received_quantity = alreadyReceived + item.quantity_received;

        // Atomically increment product stock
        const prodIndex = localDb.products.findIndex(p => p.id === item.product_id);
        if (prodIndex !== -1) {
          localDb.products[prodIndex].stock_quantity += item.quantity_received;
          if (item.unit_cost && item.unit_cost > 0) {
            localDb.products[prodIndex].cost = item.unit_cost;
          }
          localDb.products[prodIndex].updated_at = new Date().toISOString();
        }

        // Add goods receipt item record
        const grItem: GoodsReceiptItem = {
          id: `gri-${Date.now()}-${item.product_id.slice(-4)}`,
          receipt_id: receiptId,
          purchase_item_id: item.purchase_item_id,
          product_id: item.product_id,
          quantity_received: item.quantity_received,
          unit_cost: item.unit_cost || poItem.unit_cost,
          created_at: new Date().toISOString(),
        };
        localDb.goodsReceiptItems.push(grItem);
        newReceipt.items!.push(grItem);

        anyReceived = true;
      }
    }

    if (!anyReceived) {
      throw new Error('No valid positive quantity was specified to receive.');
    }

    // Determine if fully or partially received
    const poItems = localDb.purchaseItems.filter(pi => pi.purchase_id === params.purchase_id);
    const allReceived = poItems.every(pi => (pi.received_quantity || 0) >= pi.quantity);
    const newStatus: PurchaseStatus = allReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED';

    po.status = newStatus;
    po.updated_at = new Date().toISOString();
    localDb.goodsReceipts.unshift(newReceipt);

    serviceCache.invalidatePurchases();
    serviceCache.invalidateProducts();
    serviceCache.invalidateGoodsReceipts();
    serviceCache.invalidateAnalytics();

    return {
      success: true,
      receipt_id: receiptId,
      receipt_number: receiptNumber,
      purchase_status: newStatus,
    };
  }

  static async receivePurchase(purchaseId: string, receivedBy?: string) {
    this.validateRolePermission(receivedBy, ['ADMIN', 'MANAGER']);

    // Backwards-compatible receive: Receives all remaining items on the PO
    const po = await this.getPurchaseById(purchaseId);
    if (!po) throw new Error('Purchase order not found.');
    if (!po.items || po.items.length === 0) throw new Error('Purchase order contains no items to receive.');

    const itemsToReceive = po.items
      .map(item => {
        const remaining = item.quantity - (item.received_quantity || 0);
        return {
          purchase_item_id: item.id,
          product_id: item.product_id,
          quantity_received: remaining,
          unit_cost: item.unit_cost,
        };
      })
      .filter(item => item.quantity_received > 0);

    if (itemsToReceive.length === 0) {
      throw new Error('All items in this purchase order have already been received.');
    }

    return this.recordGoodsReceipt({
      purchase_id: purchaseId,
      received_by: receivedBy,
      items: itemsToReceive,
      notes: 'Full receipt completed via Quick Receive',
    });
  }

  static async receivePurchaseOrder(userId: string | undefined, purchaseId: string) {
    return this.receivePurchase(purchaseId, userId);
  }

  /**
   * Purchase Invoices (فواتير المشتريات)
   */
  static async getPurchaseInvoices(supplierId?: string): Promise<PurchaseInvoice[]> {
    const cached = serviceCache.getPurchaseInvoices();
    if (cached && !supplierId) return cached;

    try {
      let query = supabase
        .from('purchase_invoices')
        .select('*, supplier:suppliers(*), purchase:purchases(*), receipt:goods_receipts(*), creator:users(id, name), items:purchase_invoice_items(*, product:products(*))')
        .order('issue_date', { ascending: false });

      if (supplierId) {
        query = query.eq('supplier_id', supplierId);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        if (!supplierId) serviceCache.setPurchaseInvoices(data as unknown as PurchaseInvoice[]);
        return data as unknown as PurchaseInvoice[];
      }
    } catch (err: any) {
      console.warn('[DatabaseService] Supabase getPurchaseInvoices fallback:', err.message);
    }
    return localDb.getPurchaseInvoicesWithRelations(supplierId);
  }

  static async getPurchaseInvoiceById(invoiceId: string): Promise<PurchaseInvoice | null> {
    try {
      const { data, error } = await supabase
        .from('purchase_invoices')
        .select('*, supplier:suppliers(*), purchase:purchases(*), receipt:goods_receipts(*), creator:users(id, name), items:purchase_invoice_items(*, product:products(*))')
        .eq('id', invoiceId)
        .single();

      if (!error && data) {
        return data as unknown as PurchaseInvoice;
      }
    } catch (e) {
      // Fallback
    }
    const found = localDb.getPurchaseInvoicesWithRelations().find(pi => pi.id === invoiceId);
    return found || null;
  }

  static async createPurchaseInvoice(
    userId: string | undefined,
    data: {
      supplier_id: string;
      purchase_id?: string;
      receipt_id?: string;
      supplier_invoice_number?: string;
      issue_date?: string;
      due_date?: string;
      items: Array<{ product_id: string; quantity: number; unit_cost: number; discount?: number; tax?: number; total_cost?: number }>;
      discount?: number;
      notes?: string;
      status?: InvoiceStatus;
      payment_status?: InvoicePaymentStatus;
      paid_amount?: number;
    }
  ): Promise<PurchaseInvoice> {
    this.validateRolePermission(userId, ['ADMIN', 'MANAGER']);

    if (!data.items || data.items.length === 0) {
      throw new Error('Purchase invoice must contain at least one line item.');
    }

    let subtotal = 0;
    const validatedItems: Array<{
      product_id: string;
      quantity: number;
      unit_cost: number;
      discount: number;
      tax: number;
      total_cost: number;
    }> = [];

    for (const item of data.items) {
      if (item.quantity <= 0) throw new Error('Item quantity must be greater than 0.');
      if (item.unit_cost < 0) throw new Error('Unit cost cannot be negative.');

      const itemDisc = item.discount || 0;
      const baseCost = item.quantity * item.unit_cost - itemDisc;
      const itemTax = item.tax !== undefined ? item.tax : Math.round((Math.max(0, baseCost) * 0.15) * 100) / 100;
      const totalCost = item.total_cost !== undefined ? item.total_cost : Math.round((Math.max(0, baseCost) + itemTax) * 100) / 100;

      subtotal += item.quantity * item.unit_cost;
      validatedItems.push({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        discount: itemDisc,
        tax: itemTax,
        total_cost: totalCost,
      });
    }

    const overallDiscount = data.discount || 0;
    const taxableTotal = Math.max(0, subtotal - overallDiscount);
    const tax = Math.round((taxableTotal * 0.15) * 100) / 100;
    const total = Math.round((taxableTotal + tax) * 100) / 100;
    const invoiceNumber = localDb.generateInvoiceNumber();
    const issueDate = data.issue_date || new Date().toISOString().split('T')[0];
    const status: InvoiceStatus = data.status || 'POSTED';
    const paidAmount = data.paid_amount || 0;
    const paymentStatus: InvoicePaymentStatus =
      data.payment_status || (paidAmount >= total ? 'PAID' : paidAmount > 0 ? 'PARTIALLY_PAID' : 'UNPAID');

    // Supabase Insert
    try {
      const { data: invData, error: invError } = await supabase
        .from('purchase_invoices')
        .insert({
          invoice_number: invoiceNumber,
          supplier_invoice_number: data.supplier_invoice_number || null,
          purchase_id: data.purchase_id || null,
          receipt_id: data.receipt_id || null,
          supplier_id: data.supplier_id,
          issue_date: issueDate,
          due_date: data.due_date || null,
          subtotal,
          discount: overallDiscount,
          tax,
          total,
          paid_amount: paidAmount,
          payment_status: paymentStatus,
          status,
          notes: data.notes || null,
          created_by: userId!,
        })
        .select('*, supplier:suppliers(*)')
        .single();

      if (!invError && invData) {
        const itemsToInsert = validatedItems.map(item => ({
          invoice_id: invData.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_cost: item.unit_cost,
          discount: item.discount,
          tax: item.tax,
          total_cost: item.total_cost,
        }));

        const { error: itemsErr } = await supabase
          .from('purchase_invoice_items')
          .insert(itemsToInsert);

        if (!itemsErr) {
          serviceCache.invalidatePurchaseInvoices();
          serviceCache.invalidateAnalytics();
          return invData as unknown as PurchaseInvoice;
        }
      }
    } catch (err: any) {
      console.warn('[DatabaseService] Supabase createPurchaseInvoice error, using local fallback:', err.message);
    }

    // LocalDb Fallback (Crucial Rule: Does NOT re-increment inventory!)
    const localInvoiceId = `pinv-${Date.now()}`;
    const newInvoice: PurchaseInvoice = {
      id: localInvoiceId,
      invoice_number: invoiceNumber,
      supplier_invoice_number: data.supplier_invoice_number,
      purchase_id: data.purchase_id,
      receipt_id: data.receipt_id,
      supplier_id: data.supplier_id,
      issue_date: issueDate,
      due_date: data.due_date,
      subtotal,
      discount: overallDiscount,
      tax,
      total,
      paid_amount: paidAmount,
      payment_status: paymentStatus,
      status,
      notes: data.notes,
      created_by: userId || '11111111-1111-1111-1111-111111111111',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: [],
    };

    const newInvItems: PurchaseInvoiceItem[] = validatedItems.map((item, idx) => ({
      id: `pii-${Date.now()}-${idx}`,
      invoice_id: localInvoiceId,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_cost: item.unit_cost,
      discount: item.discount,
      tax: item.tax,
      total_cost: item.total_cost,
      created_at: new Date().toISOString(),
    }));

    localDb.purchaseInvoices.unshift(newInvoice);
    localDb.purchaseInvoiceItems.push(...newInvItems);
    newInvoice.items = newInvItems;
    newInvoice.supplier = localDb.suppliers.find(s => s.id === data.supplier_id);
    if (data.purchase_id) newInvoice.purchase = localDb.purchases.find(p => p.id === data.purchase_id);

    serviceCache.invalidatePurchaseInvoices();
    serviceCache.invalidateAnalytics();
    return newInvoice;
  }

  /**
   * Create Purchase Invoice directly from a PO
   * Strict Requirement: Transfers 100% of line items without loss or manual re-entry!
   */
  static async createPurchaseInvoiceFromPO(
    userId: string | undefined,
    purchaseId: string,
    supplierInvoiceNumber?: string,
    receiptId?: string
  ): Promise<PurchaseInvoice> {
    this.validateRolePermission(userId, ['ADMIN', 'MANAGER']);

    const po = await this.getPurchaseById(purchaseId);
    if (!po) throw new Error('Purchase order not found.');
    if (!po.items || po.items.length === 0) {
      throw new Error('Purchase order has no items to invoice.');
    }

    // Map 100% of purchase order items faithfully
    const invoiceItems = po.items.map(item => {
      const itemSubtotal = item.quantity * item.unit_cost;
      const itemTax = Math.round((itemSubtotal * 0.15) * 100) / 100;
      const itemTotal = Math.round((itemSubtotal + itemTax) * 100) / 100;

      return {
        product_id: item.product_id,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        discount: 0,
        tax: itemTax,
        total_cost: itemTotal,
      };
    });

    return this.createPurchaseInvoice(userId, {
      supplier_id: po.supplier_id,
      purchase_id: po.id,
      receipt_id: receiptId,
      supplier_invoice_number: supplierInvoiceNumber,
      issue_date: new Date().toISOString().split('T')[0],
      due_date: po.expected_delivery_date || undefined,
      items: invoiceItems,
      discount: po.discount || 0,
      notes: po.notes ? `Created from ${po.invoice_number} | ${po.notes}` : `Created from ${po.invoice_number}`,
      status: 'POSTED',
      payment_status: 'UNPAID',
      paid_amount: 0,
    });
  }

  static async updatePurchaseInvoice(
    userId: string | undefined,
    invoiceId: string,
    updates: {
      status?: InvoiceStatus;
      payment_status?: InvoicePaymentStatus;
      paid_amount?: number;
      notes?: string;
      supplier_invoice_number?: string;
      due_date?: string;
    }
  ): Promise<PurchaseInvoice> {
    this.validateRolePermission(userId, ['ADMIN', 'MANAGER']);

    const existing = await this.getPurchaseInvoiceById(invoiceId);
    if (!existing) throw new Error('Purchase invoice not found.');

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.status !== undefined) updatePayload.status = updates.status;
    if (updates.payment_status !== undefined) updatePayload.payment_status = updates.payment_status;
    if (updates.paid_amount !== undefined) updatePayload.paid_amount = updates.paid_amount;
    if (updates.notes !== undefined) updatePayload.notes = updates.notes;
    if (updates.supplier_invoice_number !== undefined) updatePayload.supplier_invoice_number = updates.supplier_invoice_number;
    if (updates.due_date !== undefined) updatePayload.due_date = updates.due_date;

    try {
      const { data, error } = await supabase
        .from('purchase_invoices')
        .update(updatePayload)
        .eq('id', invoiceId)
        .select('*, supplier:suppliers(*), purchase:purchases(*), items:purchase_invoice_items(*, product:products(*))')
        .single();

      if (!error && data) {
        serviceCache.invalidatePurchaseInvoices();
        serviceCache.invalidateAnalytics();
        return data as unknown as PurchaseInvoice;
      }
    } catch (e) {
      // Local fallback
    }

    const localIdx = localDb.purchaseInvoices.findIndex(pi => pi.id === invoiceId);
    if (localIdx !== -1) {
      localDb.purchaseInvoices[localIdx] = {
        ...localDb.purchaseInvoices[localIdx],
        ...updates,
        updated_at: new Date().toISOString(),
      };
      serviceCache.invalidatePurchaseInvoices();
      serviceCache.invalidateAnalytics();
      return localDb.getPurchaseInvoicesWithRelations().find(pi => pi.id === invoiceId)!;
    }

    throw new Error('Purchase invoice not found.');
  }

  static async deletePurchaseInvoice(userId: string | undefined, invoiceId: string): Promise<void> {
    this.validateRolePermission(userId, ['ADMIN', 'MANAGER']);

    const existing = await this.getPurchaseInvoiceById(invoiceId);
    if (!existing) throw new Error('Purchase invoice not found.');

    // Strict Protection Rule: Only DRAFT invoices can be deleted
    if (existing.status === 'POSTED') {
      throw new Error(
        'Cannot delete a posted purchase invoice. To reverse it, cancel the invoice instead to maintain financial audit integrity.'
      );
    }

    try {
      const { error } = await supabase
        .from('purchase_invoices')
        .delete()
        .eq('id', invoiceId);

      if (error) {
        console.warn('[DatabaseService] Supabase delete invoice error:', error.message);
      }
    } catch (e) {
      // Local fallback
    }

    localDb.purchaseInvoices = localDb.purchaseInvoices.filter(pi => pi.id !== invoiceId);
    localDb.purchaseInvoiceItems = localDb.purchaseInvoiceItems.filter(pii => pii.invoice_id !== invoiceId);

    serviceCache.invalidatePurchaseInvoices();
    serviceCache.invalidateAnalytics();
  }

  /**
   * Supplier Statement Summary (كشف حساب المورد)
   */
  static async getSupplierStatement(supplierId: string): Promise<SupplierStatement> {
    const suppliers = await this.getSuppliers();
    const supplier = suppliers.find(s => s.id === supplierId);
    if (!supplier) throw new Error('Supplier not found.');

    const [allPurchases, allReceipts, allInvoices] = await Promise.all([
      this.getPurchases(),
      this.getGoodsReceipts(),
      this.getPurchaseInvoices(supplierId),
    ]);

    const supplierPurchases = allPurchases.filter(p => p.supplier_id === supplierId);
    const supplierReceipts = allReceipts.filter(r => r.supplier_id === supplierId);
    const supplierInvoices = allInvoices.filter(i => i.supplier_id === supplierId);

    const totalOrders = supplierPurchases.length;
    const totalOrderAmount = supplierPurchases.reduce((acc, p) => acc + (p.total || 0), 0);

    const validInvoices = supplierInvoices.filter(i => i.status !== 'CANCELLED');
    const totalInvoiced = validInvoices.reduce((acc, i) => acc + (i.total || 0), 0);
    const totalPaid = validInvoices.reduce((acc, i) => acc + (i.paid_amount || 0), 0);
    const outstandingBalance = Math.round(Math.max(0, totalInvoiced - totalPaid) * 100) / 100;

    return {
      supplier,
      total_orders: totalOrders,
      total_order_amount: totalOrderAmount,
      total_invoiced: totalInvoiced,
      total_paid: totalPaid,
      outstanding_balance: outstandingBalance,
      purchases: supplierPurchases,
      invoices: supplierInvoices,
      receipts: supplierReceipts,
    };
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

  // ==========================================================================
  // USER ACCOUNT MANAGEMENT & AUDIT LOGGING SERVICE
  // ==========================================================================

  static getCachedUsersSync(): User[] | null {
    return serviceCache.getUsers();
  }

  static async getUsers(): Promise<User[]> {
    const cached = serviceCache.getUsers();
    if (cached) return cached;

    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, role_id, name, email, phone, is_active, created_at, updated_at, role:roles(id, name, description)')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        const users = data.map((u: any) => ({
          ...u,
          role: u.role || undefined,
        })) as User[];
        serviceCache.setUsers(users);
        return users;
      }

      if (error) {
        console.warn('[DatabaseService] Supabase getUsers error:', error.message);
      }
    } catch (e) {
      console.warn('[DatabaseService] Falling back to localDb.users');
    }

    return localDb.users;
  }

  static async getRoles(): Promise<Role[]> {
    try {
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .order('name');

      if (!error && data && data.length > 0) {
        return data as Role[];
      }
    } catch (e) {
      console.warn('[DatabaseService] getRoles fallback to localDb');
    }

    return localDb.roles;
  }

  static async getUserSummary(): Promise<UserSummary> {
    try {
      const { data, error } = await supabase.rpc('get_user_management_summary');
      if (!error && data) {
        return data as UserSummary;
      }
    } catch (e) {
      console.warn('[DatabaseService] get_user_management_summary fallback to calculation');
    }

    const users = await this.getUsers();
    return {
      total_users: users.length,
      active_users: users.filter(u => u.is_active).length,
      inactive_users: users.filter(u => !u.is_active).length,
      admins: users.filter(u => u.role?.name === 'ADMIN').length,
      managers: users.filter(u => u.role?.name === 'MANAGER').length,
      cashiers: users.filter(u => u.role?.name === 'CASHIER').length,
      staff: users.filter(u => u.role?.name === 'STAFF').length,
    };
  }

  static async createUser(
    actingUserRole: UserRole,
    actingUserId: string | undefined,
    payload: { name: string; email: string; password?: string; phone?: string; role_name: UserRole }
  ): Promise<User> {
    if (!['ADMIN', 'MANAGER'].includes(actingUserRole)) {
      throw new Error('Unauthorized: Only Administrators and Managers can create user accounts.');
    }

    if (actingUserRole === 'MANAGER' && !['CASHIER', 'STAFF'].includes(payload.role_name)) {
      throw new Error('Unauthorized: Managers can only create Cashier or Staff accounts.');
    }

    const trimmedEmail = payload.email.trim().toLowerCase();
    const trimmedName = payload.name.trim();

    // 1. Try Supabase Edge Function first
    try {
      const { data: edgeData, error: edgeError } = await supabase.functions.invoke('admin-users', {
        body: {
          action: 'CREATE_USER',
          payload: {
            ...payload,
            email: trimmedEmail,
            name: trimmedName,
          },
        },
      });

      if (!edgeError && edgeData?.success && edgeData?.user) {
        serviceCache.invalidateUsers();
        return edgeData.user;
      }

      if (edgeData?.error) {
        throw new Error(edgeData.error);
      }
    } catch (e: any) {
      // If it's a known business/validation error from the edge function, re-throw it
      if (e?.message && !e.message.includes('FunctionsHttpError') && !e.message.includes('Failed to send')) {
        throw e;
      }
      console.warn('[DatabaseService] Edge function invocation skipped/fallback to direct flow:', e.message);
    }

    // 2. Direct Supabase Database Flow (for standard Supabase setup)
    const roles = await this.getRoles();
    const targetRole = roles.find(r => r.name === payload.role_name);
    if (!targetRole) {
      throw new Error(`Invalid role: ${payload.role_name}`);
    }

    let authUserId: string | null = null;
    let authErrorMsg: string | null = null;
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password: payload.password || 'demo123',
        options: {
          data: { name: trimmedName },
        },
      });

      if (authError) {
        authErrorMsg = authError.message;
        console.warn('[DatabaseService] auth.signUp error:', authError.message);
      }
      if (authData?.user?.id) {
        authUserId = authData.user.id;
      }
    } catch (authEx: any) {
      authErrorMsg = authEx.message;
      console.warn('[DatabaseService] Auth registration fallback:', authEx.message);
    }

    if (!authUserId) {
      throw new Error(
        authErrorMsg 
          ? `Authentication registration failed: ${authErrorMsg}` 
          : 'Failed to create user authentication account. Please ensure the admin-users Edge Function is deployed.'
      );
    }

    const { data: insertedUser, error: insertError } = await supabase
      .from('users')
      .upsert({
        id: authUserId,
        role_id: targetRole.id,
        name: trimmedName,
        email: trimmedEmail,
        phone: payload.phone ? payload.phone.trim() : null,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .select('id, role_id, name, email, phone, is_active, created_at, updated_at, role:roles(id, name, description)')
      .single();

    if (insertError) {
      throw new Error(`Failed to create user record: ${insertError.message}`);
    }

    // Record audit log
    if (actingUserId) {
      await this.logUserAudit(actingUserId, insertedUser.id, 'USER_CREATED', {
        target_email: trimmedEmail,
        target_role: payload.role_name,
        actor_role: actingUserRole,
      });
    }

    serviceCache.invalidateUsers();
    return (insertedUser as unknown) as User;
  }

  static async updateUser(
    actingUserRole: UserRole,
    actingUserId: string | undefined,
    targetUserId: string,
    payload: { name?: string; phone?: string; role_id?: string }
  ): Promise<User> {
    if (!['ADMIN', 'MANAGER'].includes(actingUserRole)) {
      throw new Error('Unauthorized: Only Administrators and Managers can edit user accounts.');
    }

    // Fetch target user's current role
    const users = await this.getUsers();
    const targetUser = users.find(u => u.id === targetUserId);
    if (!targetUser) {
      throw new Error('User not found.');
    }

    // MANAGER restrictions
    if (actingUserRole === 'MANAGER') {
      if (['ADMIN', 'MANAGER'].includes(targetUser.role?.name || '')) {
        throw new Error('Unauthorized: Managers cannot edit Administrator or Manager accounts.');
      }
      if (targetUserId === actingUserId) {
        throw new Error('Unauthorized: Managers cannot modify their own privileges.');
      }
      if (payload.role_id) {
        const roles = await this.getRoles();
        const newRole = roles.find(r => r.id === (payload.role_id || ''));
        if (newRole && ['ADMIN', 'MANAGER'].includes(newRole.name)) {
          throw new Error('Unauthorized: Managers can only assign Cashier or Staff roles.');
        }
      }
    }

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (payload.name !== undefined) updatePayload.name = payload.name.trim();
    if (payload.phone !== undefined) updatePayload.phone = payload.phone.trim() || null;
    if (payload.role_id !== undefined) updatePayload.role_id = payload.role_id;

    const { data, error } = await supabase
      .from('users')
      .update(updatePayload)
      .eq('id', targetUserId)
      .select('id, role_id, name, email, phone, is_active, created_at, updated_at, role:roles(id, name, description)')
      .single();

    if (error) {
      throw new Error(`Failed to update user: ${error.message}`);
    }

    // Record audit log
    if (actingUserId) {
      const actionType = payload.role_id && payload.role_id !== targetUser.role_id ? 'ROLE_CHANGED' : 'PROFILE_UPDATED';
      await this.logUserAudit(actingUserId, targetUserId, actionType, {
        previous_role: targetUser.role?.name,
        new_role_id: payload.role_id,
        updated_fields: Object.keys(updatePayload),
        actor_role: actingUserRole,
      });
    }

    serviceCache.invalidateUsers();
    return (data as unknown) as User;
  }

  static async toggleUserStatus(
    actingUserRole: UserRole,
    actingUserId: string | undefined,
    targetUserId: string,
    isActive: boolean
  ): Promise<User> {
    if (!['ADMIN', 'MANAGER'].includes(actingUserRole)) {
      throw new Error('Unauthorized: Only Administrators and Managers can change account status.');
    }

    if (targetUserId === actingUserId && !isActive) {
      throw new Error('Action Denied: You cannot deactivate your own account.');
    }

    const users = await this.getUsers();
    const targetUser = users.find(u => u.id === targetUserId);
    if (!targetUser) {
      throw new Error('User not found.');
    }

    // Manager restrictions
    if (actingUserRole === 'MANAGER') {
      if (['ADMIN', 'MANAGER'].includes(targetUser.role?.name || '')) {
        throw new Error('Unauthorized: Managers cannot deactivate Administrator or Manager accounts.');
      }
      if (targetUserId === actingUserId) {
        throw new Error('Unauthorized: Managers cannot alter their own account status.');
      }
    }

    // Safeguard last active admin
    if (!isActive && targetUser.role?.name === 'ADMIN') {
      const activeAdmins = users.filter(u => u.role?.name === 'ADMIN' && u.is_active && u.id !== targetUserId);
      if (activeAdmins.length === 0) {
        throw new Error('Action Denied: Cannot deactivate the last remaining active Administrator.');
      }
    }

    const { data, error } = await supabase
      .from('users')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', targetUserId)
      .select('id, role_id, name, email, phone, is_active, created_at, updated_at, role:roles(id, name, description)')
      .single();

    if (error) {
      throw new Error(`Failed to update user status: ${error.message}`);
    }

    // Audit log
    if (actingUserId) {
      await this.logUserAudit(actingUserId, targetUserId, 'STATUS_CHANGED', {
        new_status: isActive ? 'ACTIVE' : 'INACTIVE',
        target_email: targetUser.email,
        actor_role: actingUserRole,
      });
    }

    serviceCache.invalidateUsers();
    return (data as unknown) as User;
  }

  static async sendPasswordReset(
    actingUserRole: UserRole,
    actingUserId: string | undefined,
    targetUserId: string,
    newPassword?: string
  ): Promise<{ success: boolean; message: string }> {
    if (!['ADMIN', 'MANAGER'].includes(actingUserRole)) {
      throw new Error('Unauthorized: Only Administrators and Managers can manage passwords.');
    }

    const users = await this.getUsers();
    const targetUser = users.find(u => u.id === targetUserId);
    if (!targetUser) {
      throw new Error('User not found.');
    }

    if (actingUserRole === 'MANAGER' && ['ADMIN', 'MANAGER'].includes(targetUser.role?.name || '')) {
      throw new Error('Unauthorized: Managers cannot reset passwords for Administrator or Manager accounts.');
    }

    // Try Edge Function if custom password requested
    if (newPassword) {
      try {
        const { data: edgeData, error: edgeError } = await supabase.functions.invoke('admin-users', {
          body: {
            action: 'RESET_PASSWORD',
            payload: {
              target_user_id: targetUserId,
              new_password: newPassword,
            },
          },
        });

        if (!edgeError && edgeData?.success) {
          return { success: true, message: edgeData.message || 'Password successfully updated.' };
        }
      } catch (e) {
        console.warn('[DatabaseService] Edge function reset password fallback');
      }
    }

    // Standard Supabase password recovery email
    const { error } = await supabase.auth.resetPasswordForEmail(targetUser.email, {
      redirectTo: typeof window !== 'undefined' ? `${window.location.origin}` : undefined,
    });

    if (error) {
      throw new Error(`Failed to send password reset email: ${error.message}`);
    }

    if (actingUserId) {
      await this.logUserAudit(actingUserId, targetUserId, 'PASSWORD_RESET_SENT', {
        target_email: targetUser.email,
        actor_role: actingUserRole,
      });
    }

    return {
      success: true,
      message: `Password reset email dispatched to ${targetUser.email}`,
    };
  }

  static async checkCanDeleteUser(targetUserId: string): Promise<{
    can_delete: boolean;
    reason: string;
    order_count: number;
    purchase_count: number;
    message: string;
  }> {
    try {
      const { data, error } = await supabase.rpc('check_can_delete_user', {
        target_user_id: targetUserId,
      });

      if (!error && data) {
        return data;
      }
    } catch (e) {
      console.warn('[DatabaseService] check_can_delete_user fallback to direct count');
    }

    const allUsers = await this.getUsers();
    const targetUser = allUsers.find(u => u.id === targetUserId);

    if (targetUser?.role?.name === 'ADMIN') {
      const activeAdmins = allUsers.filter(u => u.role?.name === 'ADMIN' && u.is_active);
      if (activeAdmins.length <= 1) {
        return {
          can_delete: false,
          reason: 'LAST_ADMIN',
          order_count: 0,
          purchase_count: 0,
          message: 'Cannot delete the last remaining active Administrator.',
        };
      }
    }

    // Fallback: Check order and purchase records directly
    let orderCount = 0;
    let purchaseCount = 0;
    try {
      const [orderCheck, purchaseCheck] = await Promise.all([
        supabase.from('orders').select('*', { count: 'exact', head: true }).or(`user_id.eq.${targetUserId},cancelled_by.eq.${targetUserId}`),
        supabase.from('purchases').select('*', { count: 'exact', head: true }).eq('created_by', targetUserId),
      ]);
      orderCount = orderCheck.count || 0;
      purchaseCount = purchaseCheck.count || 0;
    } catch (e) {
      // continue to local check
    }

    const localOrderCount = localDb.orders.filter(o => o.user_id === targetUserId || o.cancelled_by === targetUserId).length;
    const localPurchaseCount = localDb.purchases.filter(p => p.created_by === targetUserId).length;
    orderCount = orderCount || localOrderCount;
    purchaseCount = purchaseCount || localPurchaseCount;

    if (orderCount > 0 || purchaseCount > 0) {
      return {
        can_delete: false,
        reason: 'HISTORICAL_TRANSACTIONS',
        order_count: orderCount,
        purchase_count: purchaseCount,
        message: 'This user has linked business transactions (orders/purchases). Deactivate account instead to preserve financial history.',
      };
    }

    return {
      can_delete: true,
      reason: 'SAFE_TO_DELETE',
      order_count: 0,
      purchase_count: 0,
      message: 'User has no linked business transactions and can be safely deleted.',
    };
  }

  static async deleteUser(
    actingUserRole: UserRole,
    actingUserId: string | undefined,
    targetUserId: string
  ): Promise<void> {
    if (!['ADMIN', 'MANAGER'].includes(actingUserRole)) {
      throw new Error('Unauthorized: Only Administrators and Managers can delete user accounts.');
    }

    if (targetUserId === actingUserId) {
      throw new Error('Action Denied: You cannot delete your own account.');
    }

    const users = await this.getUsers();
    const targetUser = users.find(u => u.id === targetUserId);
    if (!targetUser) {
      throw new Error('User not found.');
    }

    if (actingUserRole === 'MANAGER' && ['ADMIN', 'MANAGER'].includes(targetUser.role?.name || '')) {
      throw new Error('Unauthorized: Managers cannot delete Administrator or Manager accounts.');
    }

    // Validate safe deletion (0 transactions)
    const safetyCheck = await this.checkCanDeleteUser(targetUserId);
    if (!safetyCheck.can_delete) {
      throw new Error(safetyCheck.message);
    }

    const { error } = await supabase.from('users').delete().eq('id', targetUserId);
    if (error) {
      throw new Error(`Failed to delete user: ${error.message}`);
    }

    if (actingUserId) {
      await this.logUserAudit(actingUserId, targetUserId, 'USER_DELETED', {
        deleted_email: targetUser.email,
        deleted_name: targetUser.name,
        actor_role: actingUserRole,
      });
    }

    serviceCache.invalidateUsers();
  }

  static async getUserAuditLogs(targetUserId?: string): Promise<UserAuditLog[]> {
    try {
      let query = supabase
        .from('user_audit_logs')
        .select('id, actor_id, target_user_id, action, details, created_at, actor:users!actor_id(name, email), target:users!target_user_id(name, email)')
        .order('created_at', { ascending: false })
        .limit(100);

      if (targetUserId) {
        query = query.eq('target_user_id', targetUserId);
      }

      const { data, error } = await query;
      if (!error && data) {
        return (data as unknown) as UserAuditLog[];
      }
    } catch (e) {
      console.warn('[DatabaseService] getUserAuditLogs query error');
    }

    return [];
  }

  private static async logUserAudit(
    actorId: string,
    targetUserId: string | null,
    action: string,
    details: Record<string, any>
  ): Promise<void> {
    try {
      await supabase.from('user_audit_logs').insert({
        actor_id: actorId,
        target_user_id: targetUserId,
        action,
        details,
      });
    } catch (e) {
      console.warn('[DatabaseService] Failed to record user audit log:', e);
    }
  }

  // --------------------------------------------------------------------------
  // KNOWLEDGE BASE & RAG SERVICE METHODS
  // --------------------------------------------------------------------------

  private static async queryWithTimeout<T>(promise: PromiseLike<T>, timeoutMs = 1500): Promise<T> {
    let timeoutHandle: any;
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutHandle = setTimeout(() => reject(new Error('Operation timeout')), timeoutMs);
    });
    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  static async getKnowledgeDocuments(userId?: string): Promise<KnowledgeDocument[]> {
    const cached = serviceCache.getKnowledgeDocuments();
    if (cached) return cached;

    try {
      const { data, error } = await this.queryWithTimeout(
        supabase
          .from('knowledge_documents')
          .select('*')
          .order('created_at', { ascending: false })
      );

      if (!error && data && data.length > 0) {
        serviceCache.setKnowledgeDocuments(data as KnowledgeDocument[]);
        return data as KnowledgeDocument[];
      }
    } catch (e) {
      console.warn('[DatabaseService] Supabase getKnowledgeDocuments fallback to localDb');
    }

    const callerRole = this.getUserRole(userId);
    let docs = [...localDb.knowledgeDocuments];
    if (callerRole !== 'ADMIN' && callerRole !== 'MANAGER' && callerRole !== 'UNAUTHENTICATED') {
      docs = docs.filter(
        d => d.is_active && (d.allowed_roles.includes(callerRole) || (d.allowed_roles as any).includes('ALL'))
      );
    }
    serviceCache.setKnowledgeDocuments(docs);
    return docs;
  }

  static async createKnowledgeDocument(
    userId: string | undefined,
    data: {
      title: string;
      description?: string;
      category: KnowledgeCategory;
      source_type: KnowledgeSourceType;
      source_name?: string;
      content: string;
      allowed_roles: UserRole[];
      is_active?: boolean;
    }
  ): Promise<KnowledgeDocument> {
    this.validateRolePermission(userId, ['ADMIN', 'MANAGER']);

    const title = data.title.trim();
    const content = data.content.trim();
    if (!title) throw new Error('Document title is required.');
    if (!content) throw new Error('Document content is required.');

    try {
      const { data: dbData, error } = await supabase
        .from('knowledge_documents')
        .insert({
          title,
          description: data.description?.trim() || '',
          category: data.category,
          source_type: data.source_type,
          source_name: data.source_name?.trim() || null,
          content,
          allowed_roles: data.allowed_roles,
          is_active: data.is_active !== undefined ? data.is_active : true,
          created_by: userId || null,
        })
        .select()
        .single();

      if (!error && dbData) {
        const chunks = chunkText(dbData.content);
        if (chunks.length > 0) {
          const chunkPayload = chunks.map((c, idx) => ({
            document_id: dbData.id,
            chunk_index: idx,
            content: c,
            embedding: generateLocalEmbedding(c),
          }));
          await supabase.from('knowledge_chunks').insert(chunkPayload);
          await supabase
            .from('knowledge_documents')
            .update({ chunk_count: chunks.length })
            .eq('id', dbData.id);
          dbData.chunk_count = chunks.length;
        }
        serviceCache.invalidateKnowledge();
        return dbData as KnowledgeDocument;
      }
    } catch (e) {
      console.warn('[DatabaseService] createKnowledgeDocument fallback to localDb:', e);
    }

    const newDoc: KnowledgeDocument = {
      id: `kd-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title,
      description: data.description?.trim() || '',
      category: data.category,
      source_type: data.source_type,
      source_name: data.source_name?.trim() || undefined,
      content,
      allowed_roles: data.allowed_roles,
      chunk_count: chunkText(content).length,
      is_active: data.is_active !== undefined ? data.is_active : true,
      created_by: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    localDb.knowledgeDocuments.unshift(newDoc);
    localDb.refreshKnowledgeChunks();
    serviceCache.invalidateKnowledge();
    return newDoc;
  }

  static async updateKnowledgeDocument(
    userId: string | undefined,
    id: string,
    updates: Partial<KnowledgeDocument>
  ): Promise<KnowledgeDocument> {
    this.validateRolePermission(userId, ['ADMIN', 'MANAGER']);

    try {
      const { data: dbData, error } = await supabase
        .from('knowledge_documents')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (!error && dbData) {
        if (updates.content) {
          await supabase.from('knowledge_chunks').delete().eq('document_id', id);
          const chunks = chunkText(updates.content);
          if (chunks.length > 0) {
            const chunkPayload = chunks.map((c, idx) => ({
              document_id: id,
              chunk_index: idx,
              content: c,
              embedding: generateLocalEmbedding(c),
            }));
            await supabase.from('knowledge_chunks').insert(chunkPayload);
            await supabase
              .from('knowledge_documents')
              .update({ chunk_count: chunks.length })
              .eq('id', id);
            dbData.chunk_count = chunks.length;
          }
        }
        serviceCache.invalidateKnowledge();
        return dbData as KnowledgeDocument;
      }
    } catch (e) {
      console.warn('[DatabaseService] updateKnowledgeDocument fallback to localDb:', e);
    }

    const idx = localDb.knowledgeDocuments.findIndex(d => d.id === id);
    if (idx === -1) {
      throw new Error('Knowledge document not found.');
    }

    localDb.knowledgeDocuments[idx] = {
      ...localDb.knowledgeDocuments[idx],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    localDb.refreshKnowledgeChunks();
    serviceCache.invalidateKnowledge();
    return localDb.knowledgeDocuments[idx];
  }

  static async deleteKnowledgeDocument(userId: string | undefined, id: string): Promise<boolean> {
    this.validateRolePermission(userId, ['ADMIN', 'MANAGER']);

    try {
      const { error } = await supabase.from('knowledge_documents').delete().eq('id', id);
      if (!error) {
        serviceCache.invalidateKnowledge();
        return true;
      }
    } catch (e) {
      console.warn('[DatabaseService] deleteKnowledgeDocument fallback to localDb:', e);
    }

    localDb.knowledgeDocuments = localDb.knowledgeDocuments.filter(d => d.id !== id);
    localDb.refreshKnowledgeChunks();
    serviceCache.invalidateKnowledge();
    return true;
  }

  static async reindexKnowledgeDocument(userId: string | undefined, id: string): Promise<boolean> {
    this.validateRolePermission(userId, ['ADMIN', 'MANAGER']);

    try {
      const { data: doc, error } = await supabase
        .from('knowledge_documents')
        .select('*')
        .eq('id', id)
        .single();

      if (!error && doc) {
        await supabase.from('knowledge_chunks').delete().eq('document_id', id);
        const chunks = chunkText(doc.content);
        if (chunks.length > 0) {
          const chunkPayload = chunks.map((c, idx) => ({
            document_id: id,
            chunk_index: idx,
            content: c,
            embedding: generateLocalEmbedding(c),
          }));
          await supabase.from('knowledge_chunks').insert(chunkPayload);
        }
        await supabase
          .from('knowledge_documents')
          .update({ chunk_count: chunks.length, updated_at: new Date().toISOString() })
          .eq('id', id);
        serviceCache.invalidateKnowledge();
        return true;
      }
    } catch (e) {
      console.warn('[DatabaseService] reindexKnowledgeDocument fallback to localDb:', e);
    }

    const doc = localDb.knowledgeDocuments.find(d => d.id === id);
    if (!doc) throw new Error('Document not found for re-indexing.');

    localDb.refreshKnowledgeChunks();
    serviceCache.invalidateKnowledge();
    return true;
  }

  static async matchKnowledgeChunks(
    queryText: string,
    callerRole: UserRole = 'STAFF',
    similarityThreshold: number = 0.35,
    matchCount: number = 4
  ): Promise<RagSourceCitation[]> {
    const queryEmbedding = generateLocalEmbedding(queryText);
    const queryTokens = queryText.toLowerCase().split(/\s+/).filter(t => t.length > 2);

    try {
      const { data, error } = await this.queryWithTimeout(
        supabase.rpc('match_knowledge_chunks', {
          query_embedding: queryEmbedding,
          match_threshold: similarityThreshold,
          match_count: matchCount,
          caller_role: callerRole,
        })
      );

      if (!error && data && Array.isArray(data) && data.length > 0) {
        return data.map((item: any) => ({
          document_id: item.document_id,
          document_title: item.document_title,
          document_category: item.document_category,
          document_source: item.document_source || 'Knowledge Base',
          chunk_index: item.chunk_index,
          content: item.content,
          snippet: item.content?.slice(0, 160),
          similarity: item.similarity,
        }));
      }
    } catch (e) {
      console.warn('[DatabaseService] match_knowledge_chunks RPC fallback to localDb');
    }

    // Local in-memory vector & semantic search fallback
    const scoredChunks: Array<{
      chunk: KnowledgeChunk;
      document: KnowledgeDocument;
      similarity: number;
    }> = [];

    for (const chunk of localDb.knowledgeChunks) {
      const doc = localDb.knowledgeDocuments.find(d => d.id === chunk.document_id);
      if (!doc || !doc.is_active) continue;

      // Role check: Admin has full access, otherwise check doc.allowed_roles
      const isRoleAllowed =
        callerRole === 'ADMIN' ||
        doc.allowed_roles.includes(callerRole) ||
        (doc.allowed_roles as any).includes('ALL');

      if (!isRoleAllowed) continue;

      let sim = cosineSimilarity(queryEmbedding, chunk.embedding || []);

      // Keyword lexical boost for Arabic and English terminology
      const chunkLower = chunk.content.toLowerCase();
      let matchCountTokens = 0;
      for (const token of queryTokens) {
        if (chunkLower.includes(token)) {
          matchCountTokens++;
        }
      }
      if (matchCountTokens > 0) {
        sim += Math.min(0.25, matchCountTokens * 0.08);
      }

      if (sim >= similarityThreshold) {
        scoredChunks.push({ chunk, document: doc, similarity: Math.min(1.0, sim) });
      }
    }

    scoredChunks.sort((a, b) => b.similarity - a.similarity);
    const topMatches = scoredChunks.slice(0, matchCount);

    return topMatches.map(m => ({
      document_id: m.document.id,
      document_title: m.document.title,
      document_category: m.document.category,
      document_source: m.document.source_name || m.document.source_type,
      chunk_index: m.chunk.chunk_index,
      content: m.chunk.content,
      snippet: m.chunk.content.slice(0, 160),
      similarity: m.similarity,
    }));
  }
}

