-- ===============================
-- Esli Cosmetics Database Schema
-- ===============================

-- Enable RLS (Row Level Security)
-- ALTER DATABASE postgres SET "app.jwt_secret" TO 'super-secret-jwt-token-with-at-least-32-characters-long';

-- ===============================
-- USERS & AUTH
-- ===============================
CREATE TABLE users (
  id uuid PRIMARY KEY,
  email varchar(255) UNIQUE NOT NULL,
  is_active boolean DEFAULT true,
  is_deleted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  last_login_at timestamptz,
  deleted_at timestamptz
);

CREATE TABLE people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name varchar(255) NOT NULL,
  last_name varchar(255),
  phone varchar(255),
  email varchar(255),
  doc_type varchar(255),
  doc_number varchar(255),
  is_deleted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz,
  metadata jsonb DEFAULT '{}'
);

-- Create branches table first (needed for employees FK)
CREATE TABLE branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(255) NOT NULL,
  code varchar(255) UNIQUE,
  address text,
  phone varchar(255),
  manager_employee_id uuid, -- Will add FK constraint later
  is_active boolean DEFAULT true,
  is_deleted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES people(id),
  user_id uuid REFERENCES users(id),
  employee_code varchar(255),
  role_title varchar(255),
  branch_id uuid REFERENCES branches(id),
  is_active boolean DEFAULT true,
  is_deleted boolean DEFAULT false,
  hired_at date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- Now add the FK constraint to branches
ALTER TABLE branches ADD CONSTRAINT fk_manager_employee 
  FOREIGN KEY (manager_employee_id) REFERENCES employees(id);

CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES people(id),
  user_id uuid REFERENCES users(id),
  external_id varchar(255),
  email varchar(255),
  phone varchar(255),
  default_billing_address_id uuid, -- Will add FK constraint later
  is_deleted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz,
  metadata jsonb DEFAULT '{}'
);

-- ===============================
-- RBAC
-- ===============================
CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key varchar(255) UNIQUE NOT NULL, -- admin, store_manager, sales_rep
  name varchar(255) NOT NULL,
  description text,
  is_deleted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key varchar(255) UNIQUE NOT NULL,
  name varchar(255),
  description text,
  is_deleted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  role_id uuid REFERENCES roles(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id),
  created_at timestamptz DEFAULT now(),
  is_deleted boolean DEFAULT false,
  deleted_at timestamptz,
  UNIQUE(user_id, role_id, branch_id)
);

CREATE TABLE role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid REFERENCES permissions(id) ON DELETE CASCADE,
  is_deleted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE(role_id, permission_id)
);

-- ===============================
-- GEOGRAPHY
-- ===============================
CREATE TABLE country (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(255),
  code varchar(255),
  is_deleted boolean DEFAULT false
);

CREATE TABLE department (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id uuid REFERENCES country(id),
  name varchar(255),
  code varchar(255),
  is_deleted boolean DEFAULT false
);

CREATE TABLE municipality (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid REFERENCES department(id),
  name varchar(255),
  is_deleted boolean DEFAULT false
);

CREATE TABLE addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid REFERENCES people(id),
  branch_id uuid REFERENCES branches(id),
  address text,
  country_id uuid REFERENCES country(id),
  department_id uuid REFERENCES department(id),
  municipality_id uuid REFERENCES municipality(id),
  postal_code varchar(255),
  geo jsonb,
  is_deleted boolean DEFAULT false, 
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- Now add the FK constraint to customers
ALTER TABLE customers ADD CONSTRAINT fk_default_billing_address 
  FOREIGN KEY (default_billing_address_id) REFERENCES addresses(id);

-- ===============================
-- STORES & LOCATIONS
-- ===============================
CREATE TABLE locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES branches(id),
  name varchar(255) NOT NULL,
  type varchar(255) NOT NULL CHECK (type IN ('branch', 'warehouse')),
  address text,
  contact varchar(255),
  is_deleted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- ===============================
-- TAXES & DISCOUNTS
-- ===============================
CREATE TABLE tax_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(255),
  code varchar(255),
  rate numeric(5,2),
  active boolean DEFAULT true,
  is_deleted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(255),
  type varchar(255),
  value numeric,
  start_date timestamptz,
  end_date timestamptz,
  applies_to text,
  active boolean DEFAULT true,
  is_deleted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- ===============================
-- CATEGORIES & PRODUCTS
-- ===============================
CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(255) NOT NULL,
  slug text UNIQUE,
  description text,
  parent_id uuid REFERENCES categories(id),
  is_active boolean DEFAULT true,
  is_deleted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku varchar(255) UNIQUE,
  barcode varchar(255) UNIQUE,
  name varchar(255) NOT NULL,
  description text,
  brand varchar(255),
  category_id uuid REFERENCES categories(id),
  tax_rate_id uuid REFERENCES tax_rates(id),
  is_active boolean DEFAULT true,
  is_deleted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz,
  metadata jsonb DEFAULT '{}'
);

CREATE TABLE product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  sku varchar(255) UNIQUE,
  barcode text UNIQUE,
  name varchar(255),
  price numeric(12,2) NOT NULL,
  retail_price numeric(12,2),
  cost_price numeric(12,2),
  minimum_stock integer,
  maximum_stock integer,
  attributes jsonb,
  is_active boolean DEFAULT true,
  is_deleted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- ===============================
-- SUPPLIERS
-- ===============================
CREATE TABLE suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(255) NOT NULL,
  contact_name varchar(255),
  phone varchar(255),
  email varchar(255),
  address varchar(255),
  is_deleted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz,
  metadata jsonb DEFAULT '{}'
);

CREATE TABLE product_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id),
  supplier_id uuid REFERENCES suppliers(id),
  supplier_sku varchar(255),
  lead_time_days int,
  is_deleted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE(product_id, supplier_id)
);

-- ===============================
-- INVENTORY (SOFT DELETE NOT APPLIED, IMMUTABLE HISTORY)
-- ===============================
CREATE TABLE stock_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_variant_id uuid REFERENCES product_variants(id),
  product_id uuid REFERENCES products(id),
  location_id uuid REFERENCES locations(id),
  quantity numeric DEFAULT 0,
  reserved numeric DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(product_variant_id, location_id)
);

CREATE TABLE stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_variant_id uuid REFERENCES product_variants(id),
  product_id uuid REFERENCES products(id),
  from_location_id uuid REFERENCES locations(id),
  to_location_id uuid REFERENCES locations(id),
  movement_type varchar(255) NOT NULL CHECK (movement_type IN ('purchase', 'sale', 'adjustment', 'transfer', 'damage', 'return', 'restock')),
  quantity numeric NOT NULL,
  reference varchar(255),
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  note text,
  metadata jsonb DEFAULT '{}'
);

-- ===============================
-- PURCHASE ORDERS
-- ===============================
CREATE TABLE purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid REFERENCES suppliers(id),
  branch_id uuid REFERENCES branches(id),
  status varchar(255),
  expected_date date,
  is_deleted boolean DEFAULT false,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz,
  total numeric(12,2)
);

CREATE TABLE purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_variant_id uuid REFERENCES product_variants(id),
  quantity integer,
  unit_cost numeric(12,2),
  line_total numeric(12,2)
);

-- ===============================
-- POS & SALES
-- ===============================
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number varchar(255) UNIQUE,
  customer_id uuid REFERENCES customers(id),
  branch_id uuid REFERENCES branches(id),
  location_id uuid REFERENCES locations(id),
  employee_id uuid REFERENCES employees(id),
  status varchar(255),
  total_amount numeric(12,2),
  subtotal numeric(12,2),
  taxes numeric(12,2),
  created_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'
);

CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  product_variant_id uuid REFERENCES product_variants(id),
  product_id uuid REFERENCES products(id),
  quantity integer,
  unit_price numeric(12,2),
  discount_amount numeric(12,2),
  tax_amount numeric(12,2),
  line_total numeric(12,2)
);

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id),
  payment_type varchar(255),
  provider varchar(255),
  amount numeric(12,2),
  transaction_reference varchar(255),
  paid_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES users(id)
);

-- ===============================
-- NOTIFICATIONS & AUDIT
-- ===============================
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  channel varchar(255),
  title varchar(255),
  body varchar(255),
  payload jsonb,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES users(id),
  action varchar(255),
  table_name varchar(255),
  record_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE import_export_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type varchar(255),
  entity varchar(255),
  status varchar(255),
  file_url text,
  started_at timestamptz,
  finished_at timestamptz,
  created_by uuid REFERENCES users(id),
  metadata jsonb
);

-- ===============================
-- INDEXES FOR PERFORMANCE
-- ===============================

-- Users and People
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_is_deleted ON users(is_deleted);
CREATE INDEX idx_people_email ON people(email);
CREATE INDEX idx_people_is_deleted ON people(is_deleted);

-- Products and Categories
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_is_deleted ON products(is_deleted);
CREATE INDEX idx_product_variants_product ON product_variants(product_id);
CREATE INDEX idx_product_variants_sku ON product_variants(sku);
CREATE INDEX idx_product_variants_barcode ON product_variants(barcode);
CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_categories_is_deleted ON categories(is_deleted);

-- Orders and Sales
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_branch ON orders(branch_id);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);
CREATE INDEX idx_order_items_variant ON order_items(product_variant_id);

-- Inventory
CREATE INDEX idx_stock_levels_product_variant ON stock_levels(product_variant_id);
CREATE INDEX idx_stock_levels_location ON stock_levels(location_id);
CREATE INDEX idx_stock_movements_product_variant ON stock_movements(product_variant_id);
CREATE INDEX idx_stock_movements_location_from ON stock_movements(from_location_id);
CREATE INDEX idx_stock_movements_location_to ON stock_movements(to_location_id);
CREATE INDEX idx_stock_movements_created_at ON stock_movements(created_at);

-- RBAC
CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role_id);
CREATE INDEX idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission ON role_permissions(permission_id);
