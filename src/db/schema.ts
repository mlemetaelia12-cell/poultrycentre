import { sql } from "drizzle-orm";

import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  date,
  numeric,
  integer,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("user_role", ["owner", "manager", "cashier", "stock_attendant"]);
export const accessModeEnum = pgEnum("access_mode", ["full", "dashboard"]);
export const listingStatusEnum = pgEnum("record_status", ["active", "void", "draft"]);
export const paymentMethodEnum = pgEnum("payment_method", ["cash", "mpesa", "mixx", "airtel_money", "halopesa", "bank_transfer"]);
export const saleStatusEnum = pgEnum("sale_status", ["completed", "partial", "credit", "void"]);
export const movementTypeEnum = pgEnum("movement_type", ["purchase", "sale", "adjustment_in", "adjustment_out", "damage", "expiry", "loss", "exchange_in", "exchange_out", "void_sale"]);
export const notificationTypeEnum = pgEnum("notification_type", ["low_stock", "expiry", "expired", "overdue_debt", "cash_discrepancy", "discount", "stock_adjustment", "security", "system"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  username: varchar("username", { length: 40 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  displayName: varchar("display_name", { length: 120 }).notNull(),
  role: roleEnum("role").notNull(),
  language: varchar("language", { length: 2 }).notNull().default("en"),
  active: boolean("active").notNull().default(true),
  forcePasswordChange: boolean("force_password_change").notNull().default(false),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ usernameUq: uniqueIndex("users_username_uq").on(t.username), singleOwnerUq: uniqueIndex("users_single_owner_uq").on(t.role).where(sql`${t.role} = 'owner'`) }));

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 64 }).notNull(),
  accessMode: accessModeEnum("access_mode").notNull(),
  userAgent: text("user_agent"),
  ipHash: varchar("ip_hash", { length: 64 }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ tokenUq: uniqueIndex("sessions_token_hash_uq").on(t.tokenHash), userIdx: index("sessions_user_idx").on(t.userId) }));

export const authAttempts = pgTable("auth_attempts", {
  id: uuid("id").defaultRandom().primaryKey(),
  attemptKey: varchar("attempt_key", { length: 64 }).notNull(),
  attemptedAt: timestamp("attempted_at", { withTimezone: true }).notNull().defaultNow(),
  succeeded: boolean("succeeded").notNull().default(false),
}, (t) => ({ keyIdx: index("auth_attempts_key_time_idx").on(t.attemptKey, t.attemptedAt) }));

export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ nameUq: uniqueIndex("categories_name_uq").on(t.name) }));

export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  sku: varchar("sku", { length: 64 }).notNull(),
  barcode: varchar("barcode", { length: 80 }),
  name: varchar("name", { length: 180 }).notNull(),
  genericName: varchar("generic_name", { length: 180 }),
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
  manufacturer: varchar("manufacturer", { length: 160 }),
  activeIngredient: text("active_ingredient"),
  species: text("species"),
  formulation: text("formulation"),
  storageInstructions: text("storage_instructions"),
  registrationNumber: varchar("registration_number", { length: 100 }),
  baseUnit: varchar("base_unit", { length: 24 }).notNull().default("piece"),
  buyingPrice: numeric("buying_price", { precision: 14, scale: 2 }).notNull().default("0"),
  retailPrice: numeric("retail_price", { precision: 14, scale: 2 }).notNull().default("0"),
  wholesalePrice: numeric("wholesale_price", { precision: 14, scale: 2 }).notNull().default("0"),
  minimumPrice: numeric("minimum_price", { precision: 14, scale: 2 }).notNull().default("0"),
  reorderLevel: numeric("reorder_level", { precision: 14, scale: 3 }).notNull().default("0"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ skuUq: uniqueIndex("products_sku_uq").on(t.sku), barcodeUq: uniqueIndex("products_barcode_uq").on(t.barcode), nameIdx: index("products_name_idx").on(t.name) }));

export const unitConversions = pgTable("unit_conversions", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  unitName: varchar("unit_name", { length: 32 }).notNull(),
  baseQuantity: numeric("base_quantity", { precision: 14, scale: 3 }).notNull(),
  barcode: varchar("barcode", { length: 80 }),
  retailPrice: numeric("retail_price", { precision: 14, scale: 2 }),
  wholesalePrice: numeric("wholesale_price", { precision: 14, scale: 2 }),
}, (t) => ({ productUnitUq: uniqueIndex("unit_conversion_product_unit_uq").on(t.productId, t.unitName), barcodeUq: uniqueIndex("unit_conversions_barcode_uq").on(t.barcode).where(sql`${t.barcode} IS NOT NULL`) }));

export const suppliers = pgTable("suppliers", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 180 }).notNull(),
  contactPerson: varchar("contact_person", { length: 120 }),
  phone: varchar("phone", { length: 32 }),
  email: varchar("email", { length: 180 }),
  address: text("address"),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const customers = pgTable("customers", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 180 }).notNull(),
  phone: varchar("phone", { length: 32 }),
  location: varchar("location", { length: 180 }),
  customerType: varchar("customer_type", { length: 24 }).notNull().default("retail"),
  creditLimit: numeric("credit_limit", { precision: 14, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ nameIdx: index("customers_name_idx").on(t.name), phoneIdx: index("customers_phone_idx").on(t.phone) }));

export const purchases = pgTable("purchases", {
  id: uuid("id").defaultRandom().primaryKey(),
  reference: varchar("reference", { length: 40 }).notNull(),
  supplierId: uuid("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
  invoiceNumber: varchar("invoice_number", { length: 100 }),
  purchasedAt: timestamp("purchased_at", { withTimezone: true }).notNull().defaultNow(),
  subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull(),
  notes: text("notes"),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ referenceUq: uniqueIndex("purchases_reference_uq").on(t.reference) }));

export const purchasePayments = pgTable("purchase_payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  purchaseId: uuid("purchase_id").notNull().references(() => purchases.id, { onDelete: "restrict" }),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  method: paymentMethodEnum("method").notNull(),
  reference: varchar("reference", { length: 120 }),
  paidBy: uuid("paid_by").notNull().references(() => users.id),
  paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
});

export const purchaseItems = pgTable("purchase_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  purchaseId: uuid("purchase_id").notNull().references(() => purchases.id, { onDelete: "restrict" }),
  productId: uuid("product_id").notNull().references(() => products.id),
  batchNumber: varchar("batch_number", { length: 100 }).notNull(),
  expiryDate: date("expiry_date").notNull(),
  quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
  unitCost: numeric("unit_cost", { precision: 14, scale: 2 }).notNull(),
  lineTotal: numeric("line_total", { precision: 14, scale: 2 }).notNull(),
});

export const batches = pgTable("batches", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id").notNull().references(() => products.id),
  batchNumber: varchar("batch_number", { length: 100 }).notNull(),
  expiryDate: date("expiry_date").notNull(),
  quantityReceived: numeric("quantity_received", { precision: 14, scale: 3 }).notNull(),
  quantityRemaining: numeric("quantity_remaining", { precision: 14, scale: 3 }).notNull(),
  unitCost: numeric("unit_cost", { precision: 14, scale: 2 }).notNull(),
  purchaseId: uuid("purchase_id").references(() => purchases.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ productExpiryIdx: index("batches_product_expiry_idx").on(t.productId, t.expiryDate) }));

export const sales = pgTable("sales", {
  id: uuid("id").defaultRandom().primaryKey(),
  receiptNumber: varchar("receipt_number", { length: 40 }).notNull(),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
  saleType: varchar("sale_type", { length: 16 }).notNull().default("retail"),
  subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull(),
  discount: numeric("discount", { precision: 14, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 14, scale: 2 }).notNull(),
  amountPaid: numeric("amount_paid", { precision: 14, scale: 2 }).notNull().default("0"),
  balanceDue: numeric("balance_due", { precision: 14, scale: 2 }).notNull().default("0"),
  status: saleStatusEnum("status").notNull().default("completed"),
  notes: text("notes"),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ receiptUq: uniqueIndex("sales_receipt_number_uq").on(t.receiptNumber), createdIdx: index("sales_created_at_idx").on(t.createdAt) }));

export const saleItems = pgTable("sale_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  saleId: uuid("sale_id").notNull().references(() => sales.id, { onDelete: "restrict" }),
  productId: uuid("product_id").notNull().references(() => products.id),
  batchId: uuid("batch_id").notNull().references(() => batches.id),
  unitName: varchar("unit_name", { length: 32 }).notNull(),
  quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
  baseQuantity: numeric("base_quantity", { precision: 14, scale: 3 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
  unitCost: numeric("unit_cost", { precision: 14, scale: 2 }).notNull(),
  lineTotal: numeric("line_total", { precision: 14, scale: 2 }).notNull(),
  discountAmount: numeric("discount_amount", { precision: 14, scale: 2 }).notNull().default("0"),
});

export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  saleId: uuid("sale_id").references(() => sales.id, { onDelete: "restrict" }),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  method: paymentMethodEnum("method").notNull(),
  reference: varchar("reference", { length: 120 }),
  paymentType: varchar("payment_type", { length: 24 }).notNull().default("sale"),
  receivedBy: uuid("received_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ customerIdx: index("payments_customer_idx").on(t.customerId), createdIdx: index("payments_created_at_idx").on(t.createdAt) }));

export const paymentAllocations = pgTable("payment_allocations", {
  id: uuid("id").defaultRandom().primaryKey(),
  paymentId: uuid("payment_id").notNull().references(() => payments.id, { onDelete: "restrict" }),
  saleId: uuid("sale_id").notNull().references(() => sales.id, { onDelete: "restrict" }),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const expenses = pgTable("expenses", {
  id: uuid("id").defaultRandom().primaryKey(),
  category: varchar("category", { length: 40 }).notNull(),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  method: paymentMethodEnum("method").notNull(),
  reference: varchar("reference", { length: 120 }),
  spentAt: timestamp("spent_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const debtTransactions = pgTable("debt_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerId: uuid("customer_id").notNull().references(() => customers.id),
  saleId: uuid("sale_id").references(() => sales.id),
  transactionType: varchar("transaction_type", { length: 24 }).notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  dueDate: date("due_date"),
  notes: text("notes"),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const stockMovements = pgTable("stock_movements", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id").notNull().references(() => products.id),
  batchId: uuid("batch_id").references(() => batches.id),
  movementType: movementTypeEnum("movement_type").notNull(),
  quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
  referenceType: varchar("reference_type", { length: 40 }),
  referenceId: uuid("reference_id"),
  reason: text("reason"),
  actorId: uuid("actor_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ productIdx: index("stock_movements_product_created_idx").on(t.productId, t.createdAt) }));

export const cashierShifts = pgTable("cashier_shifts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  openingCash: numeric("opening_cash", { precision: 14, scale: 2 }).notNull().default("0"),
  expectedCash: numeric("expected_cash", { precision: 14, scale: 2 }),
  countedCash: numeric("counted_cash", { precision: 14, scale: 2 }),
  discrepancy: numeric("discrepancy", { precision: 14, scale: 2 }),
  notes: text("notes"),
}, (t) => ({ oneOpenShiftUq: uniqueIndex("cashier_shifts_one_open_per_user_uq").on(t.userId).where(sql`${t.closedAt} IS NULL`) }));

export const exchanges = pgTable("exchanges", {
  id: uuid("id").defaultRandom().primaryKey(),
  originalSaleId: uuid("original_sale_id").notNull().references(() => sales.id),
  originalSaleItemId: uuid("original_sale_item_id").notNull().references(() => saleItems.id),
  originalBatchId: uuid("original_batch_id").notNull().references(() => batches.id),
  originalProductId: uuid("original_product_id").notNull().references(() => products.id),
  replacementProductId: uuid("replacement_product_id").notNull().references(() => products.id),
  quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
  replacementQuantity: numeric("replacement_quantity", { precision: 14, scale: 3 }).notNull(),
  priceDifference: numeric("price_difference", { precision: 14, scale: 2 }).notNull().default("0"),
  reason: text("reason").notNull(),
  approvedBy: uuid("approved_by").notNull().references(() => users.id),
  inspected: boolean("inspected").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const quarantinedStock = pgTable("quarantined_stock", {
  id: uuid("id").defaultRandom().primaryKey(),
  exchangeId: uuid("exchange_id").notNull().references(() => exchanges.id, { onDelete: "restrict" }),
  productId: uuid("product_id").notNull().references(() => products.id),
  originalBatchId: uuid("original_batch_id").notNull().references(() => batches.id),
  quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
  reason: text("reason").notNull(),
  status: varchar("status", { length: 30 }).notNull().default("pending_inspection"),
  resolutionNotes: text("resolution_notes"),
  resolvedBy: uuid("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: notificationTypeEnum("type").notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  message: text("message").notNull(),
  recordType: varchar("record_type", { length: 40 }),
  recordId: uuid("record_id"),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
  action: varchar("action", { length: 100 }).notNull(),
  entityType: varchar("entity_type", { length: 60 }).notNull(),
  entityId: uuid("entity_id"),
  details: jsonb("details"),
  ipHash: varchar("ip_hash", { length: 64 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ actorIdx: index("audit_logs_actor_created_idx").on(t.actorId, t.createdAt) }));

export const businessSettings = pgTable("business_settings", {
  id: integer("id").primaryKey().default(1),
  businessName: varchar("business_name", { length: 160 }).notNull().default("POULTRY CENTRE"),
  phone: varchar("phone", { length: 32 }),
  address: text("address"),
  tin: varchar("tin", { length: 40 }),
  vatRegistered: boolean("vat_registered").notNull().default(false),
  vatRate: numeric("vat_rate", { precision: 5, scale: 2 }),
  currency: varchar("currency", { length: 3 }).notNull().default("TZS"),
  timezone: varchar("timezone", { length: 80 }).notNull().default("Africa/Dar_es_Salaam"),
  defaultLanguage: varchar("default_language", { length: 2 }).notNull().default("en"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const taxRecords = pgTable("tax_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  saleId: uuid("sale_id").notNull().references(() => sales.id),
  taxType: varchar("tax_type", { length: 40 }).notNull(),
  rate: numeric("rate", { precision: 5, scale: 2 }).notNull(),
  taxableAmount: numeric("taxable_amount", { precision: 14, scale: 2 }).notNull(),
  taxAmount: numeric("tax_amount", { precision: 14, scale: 2 }).notNull(),
  fiscalReference: varchar("fiscal_reference", { length: 120 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
