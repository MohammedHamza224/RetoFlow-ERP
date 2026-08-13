# RestoFlow Database Architecture & Security Documentation

This document describes the database schema, Row Level Security (RLS) policies, atomic PostgreSQL stored procedures (RPCs), state machine rules, and business metrics definitions for **RestoFlow**.

---

## 1. Approved 12-Table Schema Scope

The ERD strictly contains the 12 approved core entities:

1. **`roles`**: System user roles (`ADMIN`, `MANAGER`, `CASHIER`, `STAFF`).
2. **`users`**: User profiles linked to Supabase Auth UUIDs with role references.
3. **`categories`**: Menu categories (Burgers, Pizza, Drinks, Desserts, Meals).
4. **`products`**: Products with SKU, price, cost, stock, minimum stock, and soft-deactivation (`is_active`).
5. **`customers`**: Customer directory (`GUEST`, `REGULAR`, `VIP`).
6. **`restaurant_tables`**: Visual dining floor tables (`AVAILABLE`, `OCCUPIED`, `RESERVED`).
7. **`orders`**: Orders with human-readable business order number (`ORD-000001`), status, and `stock_deducted` flag.
8. **`order_items`**: Order line items capturing snapshot `unit_price` AND historical `unit_cost`.
9. **`payments`**: Payment records (`CASH`, `CARD`, `MADA`, `APPLE_PAY`, `OTHER`) supporting split payments and `REFUNDED` status.
10. **`suppliers`**: Supplier directory with tax numbers.
11. **`purchases`**: Purchase orders (`DRAFT`, `RECEIVED`, `CANCELLED`).
12. **`purchase_items`**: Purchase line items with unit costs.

---

## 2. Order Number & Historical Cost Capture

- **Sequence-Generated Order Number**: Generated via PostgreSQL sequence `order_number_seq`:
  `ORD-000001`, `ORD-000002`, `ORD-000003`... Primary key remains UUID.
- **Historical Cost Capture**: `order_items.unit_cost DECIMAL(10,2)` captures the exact product cost at the time of sale.
  $$\text{Historical Gross Profit} = \sum (\text{unit\_price} - \text{unit\_cost}) \times \text{quantity}$$

---

## 3. Atomic PostgreSQL RPC Functions

### 1. `execute_pos_checkout(...)`
Executes POS checkout inside a single database transaction:
- Validates user role and order items.
- Row-locks products using `SELECT ... FOR UPDATE` to prevent race conditions.
- Validates stock availability (`stock_quantity >= requested_quantity`).
- Calculates Subtotal, Discount, configurable VAT (15%), and Total.
- Validates that total payments equal order total.
- Inserts `orders`, line items (capturing `unit_cost`), and `payments` (`PAID`).
- Deducts stock and sets `stock_deducted = true`.
- If any step fails, entire transaction rolls back cleanly.

### 2. `cancel_order_and_restore_stock(...)`
Executes order cancellation:
- Blocks cancellation on `COMPLETED` orders.
- Requires valid cancellation reason.
- Restores exact stock quantities **only if** `stock_deducted = true`.
- Flips `stock_deducted = false`.
- Idempotent: repeated cancellation calls do not restore stock twice.

### 3. `advance_order_status(...)`
Enforces strict state transitions:
$$\text{PENDING} \longrightarrow \text{CONFIRMED} \longrightarrow \text{PREPARING} \longrightarrow \text{READY} \longrightarrow \text{COMPLETED}$$
- Illegal forward or backward jumps (e.g. `PENDING -> READY` or `COMPLETED -> CANCELLED`) are rejected.

### 4. `refund_completed_payment(...)`
For `COMPLETED` orders needing financial reversal:
- Updates payment status to `REFUNDED`.
- Preserves original order transaction history intact.

### 5. `receive_purchase_and_increment_stock(...)`
Executes purchase receiving:
- Transitions purchase status `DRAFT -> RECEIVED`.
- Atomically increments product stock (`stock_quantity = stock_quantity + quantity`).
- Prevents receiving a purchase twice.

### 6. `get_business_metrics(...)`
Centralized Business Metrics engine:
- Total Revenue (excluding `REFUNDED` payments).
- Completed Orders count & Average Order Value (AOV).
- Cancellation Rate.
- Gross Profit using historical `unit_cost` snapshot.
- Top selling product & Low stock count.

---

## 4. Role-Based Access Control (RLS Matrix)

| Table | ADMIN | MANAGER | CASHIER | STAFF |
| :--- | :---: | :---: | :---: | :---: |
| `roles` / `users` | Full | Read-Only | Read-Only | Read-Only |
| `categories` / `products` | Full | Full | Read-Only | Read-Only |
| `customers` / `restaurant_tables` | Full | Full | Full | Full |
| `orders` / `order_items` | Full | Full | Full | Full |
| `payments` (Create) | Full | Full | Full | Blocked |
| `payments` (Refund) | Full | Full | Blocked | Blocked |
| `suppliers` / `purchases` | Full | Full | Blocked | Blocked |
