"use server";

import "server-only";
import argon2 from "argon2";
import { randomUUID } from "node:crypto";
import { and, asc, count, eq, gt, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import {
  authAttempts, auditLogs, batches, businessSettings, cashierShifts, categories, customers, debtTransactions, operationRequests,
  expenses, notifications, paymentAllocations, payments, products, purchaseItems, purchasePayments, purchases, saleItems, sales, sessions,
  quarantinedStock, stockMovements, suppliers, unitConversions, users, exchanges,
} from "@/db/schema";
import { createSession, isMobileUserAgent, requestMeta, SESSION_COOKIE, sha256 } from "./auth";
import { requirePermission, requireUser } from "./auth";
import { safeNumber, safeText, todayDateTz } from "./format";
import { calculateExpectedCash, toCents } from "./finance";
import type { PaymentMethod, Role } from "./types";
import { cookies } from "next/headers";

export type ActionState = { error?: string; success?: string };

const paymentMethods = ["cash", "mpesa", "mixx", "airtel_money", "halopesa", "bank_transfer"] as const;
const usernameSchema = z.string().trim().min(3).max(40).regex(/^[a-zA-Z0-9._-]+$/, "Use letters, numbers, dot, dash or underscore.").transform((value) => value.toLowerCase());
const uuidSchema = z.string().uuid();
const idempotencyKeySchema = z.string().uuid();
const moneySchema = z.coerce.number().finite().min(0).max(9999999999);

async function writeAudit(actorId: string, action: string, entityType: string, entityId: string | null, details: Record<string, unknown> = {}) {
  const meta = await requestMeta();
  await getDb().insert(auditLogs).values({ actorId, action, entityType, entityId, details, ipHash: sha256(meta.ip) });
}

function parseJson<T>(value: FormDataEntryValue | null, schema: z.ZodType<T>): T {
  if (typeof value !== "string") throw new Error("Invalid form data.");
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new Error("Invalid form data."); }
  return schema.parse(parsed);
}

export async function loginAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.object({ username: usernameSchema, password: z.string().min(1).max(200) }).safeParse({
    username: formData.get("username"), password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Enter a valid username and password." };
  const meta = await requestMeta();
  const key = sha256(`${parsed.data.username.toLowerCase()}|${meta.ip}`);
  const db = getDb();
  const cutoff = new Date(Date.now() - 15 * 60 * 1000);
  await db.delete(authAttempts).where(lt(authAttempts.attemptedAt, new Date(Date.now() - 24 * 60 * 60 * 1000)));
  const recent = await db.select({ value: count() }).from(authAttempts).where(and(eq(authAttempts.attemptKey, key), gte(authAttempts.attemptedAt, cutoff), eq(authAttempts.succeeded, false)));
  if ((recent[0]?.value ?? 0) >= 8) return { error: "Too many attempts. Wait 15 minutes before trying again." };

  const found = await db.select().from(users).where(eq(users.username, parsed.data.username)).limit(1);
  const account = found[0];
  const valid = account?.active ? await argon2.verify(account.passwordHash, parsed.data.password).catch(() => false) : false;
  await db.insert(authAttempts).values({ attemptKey: key, succeeded: valid });
  if (!account || !valid) return { error: "Username or password is incorrect." };

  const mobile = isMobileUserAgent(meta.userAgent);
  if (mobile && account.role !== "owner") return { error: "Staff accounts can only sign in from the shop desktop or laptop." };
  const accessMode = mobile ? "dashboard" : "full";
  await createSession(account.id, accessMode, meta.userAgent, meta.ip);
  await db.update(users).set({ lastLoginAt: new Date(), updatedAt: new Date() }).where(eq(users.id, account.id));
  await db.insert(auditLogs).values({ actorId: account.id, action: "auth.login", entityType: "session", details: { accessMode, userAgent: meta.userAgent.slice(0, 300) }, ipHash: sha256(meta.ip) });
  redirect("/dashboard");
}

export async function logoutAction() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) await getDb().delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

export async function setLanguageAction(formData: FormData) {
  const actor = await requireUser();
  const language = formData.get("language");
  if (language !== "en" && language !== "sw") return;
  await getDb().update(users).set({ language, updatedAt: new Date() }).where(eq(users.id, actor.id));
  (await cookies()).set("pc_locale", language, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/");
}

const productInput = z.object({
  sku: z.string().trim().min(2).max(64), barcode: z.string().trim().max(80).optional().default(""),
  name: z.string().trim().min(2).max(180), genericName: z.string().trim().max(180).optional().default(""),
  categoryId: z.string().optional().default(""), manufacturer: z.string().trim().max(160).optional().default(""),
  activeIngredient: z.string().trim().max(2000).optional().default(""), species: z.string().trim().max(500).optional().default(""),
  formulation: z.string().trim().max(1000).optional().default(""), storageInstructions: z.string().trim().max(1000).optional().default(""),
  registrationNumber: z.string().trim().max(100).optional().default(""), baseUnit: z.string().trim().min(1).max(24),
  buyingPrice: moneySchema, retailPrice: moneySchema, wholesalePrice: moneySchema, minimumPrice: moneySchema, reorderLevel: z.coerce.number().min(0).max(999999999),
  conversions: z.array(z.object({ unitName: z.string().min(1).max(32), baseQuantity: z.number().positive().max(100000), barcode: z.string().max(80).optional(), retailPrice: z.number().min(0).optional(), wholesalePrice: z.number().min(0).optional() })).max(20).default([]),
});

export async function createProductAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requirePermission("products:write", true);
  const rawConversions = formData.get("conversions");
  let conversions: unknown = [];
  try { conversions = typeof rawConversions === "string" ? JSON.parse(rawConversions || "[]") : []; } catch { return { error: "Unit conversion data is invalid." }; }
  const parsed = productInput.safeParse({
    sku: formData.get("sku"), barcode: safeText(formData.get("barcode"), 80), name: formData.get("name"), genericName: safeText(formData.get("genericName"), 180),
    categoryId: safeText(formData.get("categoryId"), 36), manufacturer: safeText(formData.get("manufacturer"), 160), activeIngredient: safeText(formData.get("activeIngredient"), 2000),
    species: safeText(formData.get("species"), 500), formulation: safeText(formData.get("formulation"), 1000), storageInstructions: safeText(formData.get("storageInstructions"), 1000),
    registrationNumber: safeText(formData.get("registrationNumber"), 100), baseUnit: formData.get("baseUnit"),
    buyingPrice: formData.get("buyingPrice"), retailPrice: formData.get("retailPrice"), wholesalePrice: formData.get("wholesalePrice"),
    minimumPrice: formData.get("minimumPrice"), reorderLevel: formData.get("reorderLevel"), conversions,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the product details." };
  const value = parsed.data;
  if (value.minimumPrice > value.retailPrice || value.minimumPrice > value.wholesalePrice) return { error: "Minimum selling price cannot be higher than the retail or wholesale price." };
  const db = getDb();
  if (value.categoryId && !uuidSchema.safeParse(value.categoryId).success) return { error: "Select a valid product category." };
  const unitNames = value.conversions.map((item) => item.unitName.trim().toLowerCase());
  if (new Set(unitNames).size !== unitNames.length) return { error: "Each product conversion unit must have a unique name." };
  if (unitNames.includes(value.baseUnit.trim().toLowerCase())) return { error: "The base stock unit must not be repeated as a conversion unit." };
  const conversionBarcodes = value.conversions.map((item) => item.barcode?.trim()).filter((item): item is string => Boolean(item));
  if (new Set(conversionBarcodes).size !== conversionBarcodes.length) return { error: "Each unit barcode must be unique." };
  try {
    const meta = await requestMeta();
    await db.transaction(async (tx) => {
      const inserted = await tx.insert(products).values({
        sku: value.sku, barcode: value.barcode || null, name: value.name, genericName: value.genericName || null,
        categoryId: value.categoryId || null,
        manufacturer: value.manufacturer || null, activeIngredient: value.activeIngredient || null, species: value.species || null,
        formulation: value.formulation || null, storageInstructions: value.storageInstructions || null, registrationNumber: value.registrationNumber || null,
        baseUnit: value.baseUnit, buyingPrice: value.buyingPrice.toFixed(2), retailPrice: value.retailPrice.toFixed(2),
        wholesalePrice: value.wholesalePrice.toFixed(2), minimumPrice: value.minimumPrice.toFixed(2), reorderLevel: value.reorderLevel.toFixed(3),
      }).returning({ id: products.id });
      const productId = inserted[0].id;
      if (value.conversions.length) await tx.insert(unitConversions).values(value.conversions.map((item) => ({
        productId, unitName: item.unitName.trim(), baseQuantity: item.baseQuantity.toFixed(3), barcode: item.barcode?.trim() || null,
        retailPrice: item.retailPrice === undefined ? null : (toCents(item.retailPrice) / 100).toFixed(2), wholesalePrice: item.wholesalePrice === undefined ? null : (toCents(item.wholesalePrice) / 100).toFixed(2),
      })));
      await tx.insert(auditLogs).values({ actorId: actor.id, action: "product.create", entityType: "product", entityId: productId, details: { sku: value.sku, name: value.name }, ipHash: sha256(meta.ip) });
    });
    revalidatePath("/products"); revalidatePath("/inventory");
    return { success: "Product created successfully." };
  } catch (error) {
    if (String(error).includes("products_sku_uq")) return { error: "That SKU is already in use." };
    if (String(error).includes("products_barcode_uq")) return { error: "That barcode is already assigned to another product." };
    return { error: "Could not save the product. Check that its data is valid and try again." };
  }
}

export async function createCustomerAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requirePermission("customers:write", true);
  const parsed = z.object({ name: z.string().trim().min(2).max(180), phone: z.string().trim().max(32), location: z.string().trim().max(180), customerType: z.enum(["retail", "wholesale"]).default("retail"), creditLimit: moneySchema, notes: z.string().max(1000) }).safeParse({
    name: formData.get("name"), phone: safeText(formData.get("phone"), 32), location: safeText(formData.get("location"), 180),
    customerType: formData.get("customerType") || "retail", creditLimit: formData.get("creditLimit") || 0, notes: safeText(formData.get("notes"), 1000),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check customer details." };
  if (actor.role === "cashier" && parsed.data.creditLimit > 0) return { error: "Only the owner or manager can approve a customer credit limit." };
  const db = getDb();
  const meta = await requestMeta();
  try {
    await db.transaction(async (tx) => {
      const [created] = await tx.insert(customers).values({ ...parsed.data, phone: parsed.data.phone || null, location: parsed.data.location || null, notes: parsed.data.notes || null, creditLimit: (toCents(parsed.data.creditLimit) / 100).toFixed(2) }).returning({ id: customers.id });
      await tx.insert(auditLogs).values({ actorId: actor.id, action: "customer.create", entityType: "customer", entityId: created.id, details: { name: parsed.data.name }, ipHash: sha256(meta.ip) });
    });
    revalidatePath("/customers"); return { success: "Customer added." };
  } catch { return { error: "Could not add the customer. Check the details and try again." }; }
}

export async function createSupplierAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requirePermission("purchases:write", true);
  const parsed = z.object({ name: z.string().trim().min(2).max(180), contactPerson: z.string().max(120), phone: z.string().max(32), email: z.string().max(180), address: z.string().max(1000) }).safeParse({
    name: formData.get("name"), contactPerson: safeText(formData.get("contactPerson"), 120), phone: safeText(formData.get("phone"), 32), email: safeText(formData.get("email"), 180), address: safeText(formData.get("address"), 1000),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check supplier details." };
  const db = getDb();
  const meta = await requestMeta();
  try {
    await db.transaction(async (tx) => {
      const [created] = await tx.insert(suppliers).values({ ...parsed.data, contactPerson: parsed.data.contactPerson || null, phone: parsed.data.phone || null, email: parsed.data.email || null, address: parsed.data.address || null }).returning({ id: suppliers.id });
      await tx.insert(auditLogs).values({ actorId: actor.id, action: "supplier.create", entityType: "supplier", entityId: created.id, details: { name: parsed.data.name }, ipHash: sha256(meta.ip) });
    });
    revalidatePath("/purchases"); return { success: "Supplier added." };
  } catch { return { error: "Could not add the supplier. Check the details and try again." }; }
}

const purchaseLineSchema = z.array(z.object({ productId: uuidSchema, batchNumber: z.string().trim().min(1).max(100), expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), quantity: z.number().positive().max(1000000), unitCost: z.number().min(0).max(999999999) })).min(1).max(100);

export async function receivePurchaseAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requirePermission("purchases:write", true);
  const idempotencyKey = safeText(formData.get("idempotencyKey"), 36);
  if (!idempotencyKeySchema.safeParse(idempotencyKey).success) return { error: "Refresh the page before receiving this purchase." };
  let lines: z.infer<typeof purchaseLineSchema>;
  try { lines = parseJson(formData.get("items"), purchaseLineSchema); } catch (error) { return { error: error instanceof Error ? error.message : "Purchase items are invalid." }; }
  const supplierId = safeText(formData.get("supplierId"), 36);
  const purchaseMethod = paymentMethods.find((method) => method === formData.get("paymentMethod"));
  if (!purchaseMethod) return { error: "Select how this supplier purchase was paid." };
  const paymentReference = safeText(formData.get("paymentReference"), 120);
  if (supplierId && !uuidSchema.safeParse(supplierId).success) return { error: "Select a valid supplier." };
  for (const line of lines) if (line.expiryDate < todayDateTz()) return { error: "Expired stock cannot be received as sellable inventory." };
  const db = getDb();
  const totalCents = lines.reduce((sum, item) => sum + toCents(item.quantity * item.unitCost), 0);
  const invoiceNumber = safeText(formData.get("invoiceNumber"), 100);
  const notes = safeText(formData.get("notes"), 1000);
  const fingerprint = sha256(JSON.stringify({ actorId: actor.id, supplierId, invoiceNumber, notes, paymentMethod: purchaseMethod, paymentReference, lines }));
  try {
    const operation = await db.transaction(async (tx) => {
      const [claim] = await tx.insert(operationRequests).values({ actorId: actor.id, scope: "purchase.receive", idempotencyKey, fingerprint }).onConflictDoNothing().returning({ id: operationRequests.id });
      if (!claim) {
        const [prior] = await tx.select().from(operationRequests).where(and(eq(operationRequests.actorId, actor.id), eq(operationRequests.scope, "purchase.receive"), eq(operationRequests.idempotencyKey, idempotencyKey))).for("update").limit(1);
        if (!prior || prior.fingerprint !== fingerprint) throw new Error("This purchase submission key was already used for different details. Refresh and review the purchase.");
        if (!prior.entityId) throw new Error("This purchase is already being processed. Check purchase history before retrying.");
        return { duplicate: true as const, entityId: prior.entityId };
      }
      const reference = `PUR-${todayDateTz().replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
      const [purchase] = await tx.insert(purchases).values({ reference, supplierId: supplierId || null, invoiceNumber: invoiceNumber || null, subtotal: (totalCents / 100).toFixed(2), notes: notes || null, createdBy: actor.id }).returning({ id: purchases.id });
      await tx.insert(purchasePayments).values({ purchaseId: purchase.id, amount: (totalCents / 100).toFixed(2), method: purchaseMethod, reference: paymentReference || null, paidBy: actor.id });
      for (const line of lines) {
        const product = await tx.select({ id: products.id }).from(products).where(and(eq(products.id, line.productId), eq(products.active, true))).limit(1);
        if (!product.length) throw new Error("A selected product is no longer active.");
        const lineCents = toCents(line.quantity * line.unitCost);
        const [batch] = await tx.insert(batches).values({ productId: line.productId, batchNumber: line.batchNumber, expiryDate: line.expiryDate, quantityReceived: line.quantity.toFixed(3), quantityRemaining: line.quantity.toFixed(3), unitCost: (toCents(line.unitCost) / 100).toFixed(2), purchaseId: purchase.id }).returning({ id: batches.id });
        await tx.insert(purchaseItems).values({ purchaseId: purchase.id, productId: line.productId, batchNumber: line.batchNumber, expiryDate: line.expiryDate, quantity: line.quantity.toFixed(3), unitCost: (toCents(line.unitCost) / 100).toFixed(2), lineTotal: (lineCents / 100).toFixed(2) });
        await tx.insert(stockMovements).values({ productId: line.productId, batchId: batch.id, movementType: "purchase", quantity: line.quantity.toFixed(3), referenceType: "purchase", referenceId: purchase.id, actorId: actor.id, reason: "Stock received" });
      }
      await tx.insert(auditLogs).values({ actorId: actor.id, action: "purchase.receive", entityType: "purchase", entityId: purchase.id, details: { reference, lineCount: lines.length, total: (totalCents / 100).toFixed(2) } });
      await tx.update(operationRequests).set({ entityType: "purchase", entityId: purchase.id }).where(eq(operationRequests.id, claim.id));
      return { duplicate: false as const, entityId: purchase.id };
    });
    revalidatePath("/inventory"); revalidatePath("/purchases"); revalidatePath("/dashboard");
    return { success: operation.duplicate ? "This purchase was already received. No duplicate stock was added." : "Purchase received and stock batches created." };
  } catch (error) { return { error: error instanceof Error ? error.message : "Unable to receive this purchase." }; }
}

const saleLineSchema = z.array(z.object({ productId: uuidSchema, quantity: z.number().positive().max(100000), unitName: z.string().min(1).max(32), unitPrice: z.number().positive().max(999999999) })).min(1).max(100);
const salePaymentsSchema = z.array(z.object({ method: z.enum(paymentMethods), amount: z.number().positive().max(999999999), reference: z.string().max(120).optional() })).max(10);

export async function createSaleAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requirePermission("sales:write", true);
  const idempotencyKey = safeText(formData.get("idempotencyKey"), 36);
  if (!idempotencyKeySchema.safeParse(idempotencyKey).success) return { error: "Refresh the sales page before completing this sale." };
  let lines: z.infer<typeof saleLineSchema>;
  let paymentLines: z.infer<typeof salePaymentsSchema>;
  try {
    lines = parseJson(formData.get("items"), saleLineSchema);
    paymentLines = parseJson(formData.get("payments"), salePaymentsSchema);
  } catch (error) { return { error: error instanceof Error ? error.message : "Sale details are invalid." }; }
  const customerId = safeText(formData.get("customerId"), 36);
  if (customerId && !uuidSchema.safeParse(customerId).success) return { error: "Select a valid customer." };
  const dueDate = safeText(formData.get("dueDate"), 10);
  if (dueDate && (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || new Date(`${dueDate}T00:00:00Z`).toISOString().slice(0, 10) !== dueDate || dueDate < todayDateTz())) return { error: "Choose a valid credit due date that is today or later." };
  const saleType = formData.get("saleType") === "wholesale" ? "wholesale" : "retail";
  const discount = safeNumber(formData.get("discount"), 0);
  if (discount < 0 || discount > 999999999) return { error: "Discount amount is invalid." };
  if (discount > 0 && actor.role !== "owner" && actor.role !== "manager") return { error: "Only an owner or manager can approve a sale discount." };
  const notes = safeText(formData.get("notes"), 1000);
  const fingerprint = sha256(JSON.stringify({ actorId: actor.id, lines, paymentLines, customerId, dueDate, saleType, discount, notes }));

  try {
    const operation = await getDb().transaction(async (tx) => {
      const [claim] = await tx.insert(operationRequests).values({ actorId: actor.id, scope: "sale.create", idempotencyKey, fingerprint }).onConflictDoNothing().returning({ id: operationRequests.id });
      if (!claim) {
        const [prior] = await tx.select().from(operationRequests).where(and(eq(operationRequests.actorId, actor.id), eq(operationRequests.scope, "sale.create"), eq(operationRequests.idempotencyKey, idempotencyKey))).for("update").limit(1);
        if (!prior || prior.fingerprint !== fingerprint) throw new Error("This sale submission key was already used for different details. Refresh and review the basket.");
        if (!prior.entityId) throw new Error("This sale is already being processed. Check Sales History before retrying.");
        return { duplicate: true as const, entityId: prior.entityId };
      }
      if (actor.role === "cashier") {
        const [openShift] = await tx.select({ id: cashierShifts.id }).from(cashierShifts)
          .where(and(eq(cashierShifts.userId, actor.id), isNull(cashierShifts.closedAt))).for("update").limit(1);
        if (!openShift) throw new Error("Open your cashier shift before processing a sale.");
      }
      const saleCalc: Array<{ productId: string; unitName: string; quantity: number; baseQuantity: number; unitPrice: number; lineCents: number; discountCents: number; maxDiscountCents: number }> = [];
      let subtotalCents = 0;
      for (const line of lines) {
        const [product] = await tx.select().from(products).where(and(eq(products.id, line.productId), eq(products.active, true))).limit(1);
        if (!product) throw new Error("A product in this sale is unavailable.");
        let conversionFactor = 1;
        let configuredPrice = saleType === "wholesale" ? Number(product.wholesalePrice) : Number(product.retailPrice);
        if (line.unitName !== product.baseUnit) {
          const [conversion] = await tx.select().from(unitConversions).where(and(eq(unitConversions.productId, product.id), eq(unitConversions.unitName, line.unitName))).limit(1);
          if (!conversion) throw new Error(`Unit '${line.unitName}' is not configured for ${product.name}.`);
          conversionFactor = Number(conversion.baseQuantity);
          const convertedPrice = saleType === "wholesale" ? conversion.wholesalePrice : conversion.retailPrice;
          configuredPrice = convertedPrice !== null ? Number(convertedPrice) : configuredPrice * conversionFactor;
        }
        const baseQuantity = line.quantity * conversionFactor;
        if (!Number.isFinite(baseQuantity) || baseQuantity <= 0) throw new Error("A sale quantity is invalid.");
        const price = line.unitPrice;
        const minimumUnitPrice = Number(product.minimumPrice) * conversionFactor;
        if (price + 0.000001 < minimumUnitPrice) throw new Error(`The price for ${product.name} is below its minimum selling price for ${line.unitName}.`);
        // The server uses the configured price, not a client-supplied price.
        if (Math.abs(price - configuredPrice) > 0.005) throw new Error(`The price for ${product.name} has changed. Refresh the product list and try again.`);
        const lineCents = toCents(line.quantity * configuredPrice);
        const maxDiscountCents = Math.max(0, Math.floor((configuredPrice - minimumUnitPrice) * line.quantity * 100 + 0.000001));
        saleCalc.push({ productId: product.id, unitName: line.unitName, quantity: line.quantity, baseQuantity, unitPrice: configuredPrice, lineCents, discountCents: 0, maxDiscountCents });
        subtotalCents += lineCents;
      }
      const requiredByProduct = new Map<string, number>();
      for (const line of saleCalc) requiredByProduct.set(line.productId, (requiredByProduct.get(line.productId) ?? 0) + line.baseQuantity);
      for (const [productId, requiredQuantity] of requiredByProduct) {
        const [product] = await tx.select({ name: products.name }).from(products).where(eq(products.id, productId)).limit(1);
        const batchesAvailable = await tx.select().from(batches).where(and(eq(batches.productId, productId), gt(batches.quantityRemaining, "0"), gte(batches.expiryDate, todayDateTz()))).orderBy(asc(batches.expiryDate)).for("update");
        const totalAvailable = batchesAvailable.reduce((sum, batch) => sum + Number(batch.quantityRemaining), 0);
        if (totalAvailable + 0.000001 < requiredQuantity) throw new Error(`Insufficient unexpired stock for ${product?.name ?? "a selected product"}. Available: ${totalAvailable}.`);
      }
      const discountCents = toCents(discount);
      const maxDiscountCents = saleCalc.reduce((sum, line) => sum + line.maxDiscountCents, 0);
      if (discountCents > maxDiscountCents) throw new Error("The discount would take one or more products below the configured minimum selling price.");
      let discountAllocated = 0;
      const eligibleDiscountLines = saleCalc.filter((line) => line.maxDiscountCents > 0);
      for (const line of eligibleDiscountLines) {
        line.discountCents = Math.min(line.maxDiscountCents, Math.floor(discountCents * line.maxDiscountCents / maxDiscountCents));
        discountAllocated += line.discountCents;
      }
      let discountRemainder = discountCents - discountAllocated;
      for (const line of eligibleDiscountLines) {
        if (discountRemainder <= 0) break;
        const room = line.maxDiscountCents - line.discountCents;
        const add = Math.min(room, discountRemainder);
        line.discountCents += add;
        discountRemainder -= add;
      }
      if (discountRemainder !== 0) throw new Error("The discount could not be allocated safely. Reduce it and try again.");
      const totalCents = subtotalCents - discountCents;
      if (totalCents <= 0) throw new Error("Sale total must be greater than zero.");
      const paidCents = paymentLines.reduce((sum, item) => sum + toCents(item.amount), 0);
      if (paidCents > totalCents) throw new Error("Payment total cannot be greater than the sale total.");
      const dueCents = totalCents - paidCents;
      if (dueCents > 0 && !customerId) throw new Error("Select a customer before completing a credit or partially paid sale.");
      if (dueCents > 0 && customerId) {
        const [customer] = await tx.select().from(customers).where(and(eq(customers.id, customerId), eq(customers.active, true))).for("update").limit(1);
        if (!customer) throw new Error("The selected customer is unavailable.");
        const debtRows = await tx.select({ balance: sql<string>`COALESCE(SUM(CASE WHEN ${debtTransactions.transactionType} = 'debit' THEN ${debtTransactions.amount} WHEN ${debtTransactions.transactionType} = 'credit' THEN -${debtTransactions.amount} ELSE 0 END), 0)` }).from(debtTransactions).where(eq(debtTransactions.customerId, customerId));
        const currentDebt = Number(debtRows[0]?.balance ?? 0);
        if (Number(customer.creditLimit) <= 0 || currentDebt + dueCents / 100 > Number(customer.creditLimit)) throw new Error("This sale would exceed the customer's credit limit.");
      }
      const receiptNumber = `PC-${todayDateTz().replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
      const [sale] = await tx.insert(sales).values({
        receiptNumber, customerId: customerId || null, saleType, subtotal: (subtotalCents / 100).toFixed(2), discount: (discountCents / 100).toFixed(2),
        total: (totalCents / 100).toFixed(2), amountPaid: (paidCents / 100).toFixed(2), balanceDue: (dueCents / 100).toFixed(2),
        status: dueCents === 0 ? "completed" : paidCents === 0 ? "credit" : "partial", notes: notes || null, createdBy: actor.id,
      }).returning({ id: sales.id });

      for (const line of saleCalc) {
        let remaining = line.baseQuantity;
        const available = await tx.select().from(batches).where(and(eq(batches.productId, line.productId), gt(batches.quantityRemaining, "0"), gte(batches.expiryDate, todayDateTz()))).orderBy(asc(batches.expiryDate)).for("update");
        let remainingLineCents = line.lineCents;
        let remainingDiscountCents = line.discountCents;
        for (const batch of available) {
          if (remaining <= 0.000001) break;
          const take = Math.min(remaining, Number(batch.quantityRemaining));
          const isFinalAllocation = remaining - take <= 0.000001;
          const left = Math.max(0, Number(batch.quantityRemaining) - take);
          await tx.update(batches).set({ quantityRemaining: left.toFixed(3) }).where(eq(batches.id, batch.id));
          const lineFraction = take / line.baseQuantity;
          const grossLineCents = isFinalAllocation ? remainingLineCents : Math.min(remainingLineCents, Math.round(line.lineCents * lineFraction));
          const discountShareCents = isFinalAllocation ? remainingDiscountCents : Math.min(remainingDiscountCents, Math.round(line.discountCents * lineFraction));
          await tx.insert(saleItems).values({ saleId: sale.id, productId: line.productId, batchId: batch.id, unitName: line.unitName, quantity: (line.quantity * lineFraction).toFixed(3), baseQuantity: take.toFixed(3), unitPrice: (toCents(line.unitPrice) / 100).toFixed(2), unitCost: batch.unitCost, lineTotal: (grossLineCents / 100).toFixed(2), discountAmount: (discountShareCents / 100).toFixed(2) });
          await tx.insert(stockMovements).values({ productId: line.productId, batchId: batch.id, movementType: "sale", quantity: (-take).toFixed(3), referenceType: "sale", referenceId: sale.id, actorId: actor.id, reason: `Receipt ${receiptNumber}` });
          remainingLineCents -= grossLineCents;
          remainingDiscountCents -= discountShareCents;
          remaining -= take;
        }
      }
      for (const payment of paymentLines) {
        const [paymentRow] = await tx.insert(payments).values({ saleId: sale.id, customerId: customerId || null, amount: (toCents(payment.amount) / 100).toFixed(2), method: payment.method as PaymentMethod, reference: payment.reference || null, paymentType: "sale", receivedBy: actor.id }).returning({ id: payments.id });
        await tx.insert(paymentAllocations).values({ paymentId: paymentRow.id, saleId: sale.id, amount: (toCents(payment.amount) / 100).toFixed(2) });
      }
      if (dueCents > 0 && customerId) await tx.insert(debtTransactions).values({ customerId, saleId: sale.id, transactionType: "debit", amount: (dueCents / 100).toFixed(2), dueDate: dueDate || null, createdBy: actor.id, notes: `Balance from ${receiptNumber}` });
      await tx.insert(auditLogs).values({ actorId: actor.id, action: "sale.create", entityType: "sale", entityId: sale.id, details: { receiptNumber, total: totalCents / 100, paid: paidCents / 100, due: dueCents / 100 } });
      await tx.update(operationRequests).set({ entityType: "sale", entityId: sale.id }).where(eq(operationRequests.id, claim.id));
      return { duplicate: false as const, entityId: sale.id };
    });
    revalidatePath("/sales"); revalidatePath("/sales/history"); revalidatePath("/inventory"); revalidatePath("/debts"); revalidatePath("/dashboard"); revalidatePath("/reports");
    return { success: operation.duplicate ? "This sale was already completed. No second sale was created." : "Sale completed. Open Receipts to print or save a copy." };
  } catch (error) { return { error: error instanceof Error ? error.message : "Sale could not be completed." }; }
}

export async function voidUnpaidCreditSaleAction(formData: FormData) {
  const actor = await requirePermission("sales:write", true);
  if (actor.role !== "owner" && actor.role !== "manager") throw new Error("Only an owner or manager can approve a sale cancellation.");
  const saleId = safeText(formData.get("saleId"), 36);
  const reason = safeText(formData.get("reason"), 500);
  if (!uuidSchema.safeParse(saleId).success || reason.length < 5) throw new Error("A valid sale and cancellation reason are required.");
  try {
    await getDb().transaction(async (tx) => {
      const [sale] = await tx.select().from(sales).where(eq(sales.id, saleId)).for("update").limit(1);
      if (!sale || sale.status === "void") throw new Error("Sale not found or already cancelled.");
      if (sale.status !== "credit" || Number(sale.amountPaid) > 0.005 || Number(sale.balanceDue) <= 0) {
        throw new Error("Only a completely unpaid credit sale can be cancelled here. Paid or partially paid sales require owner review and an exceptional exchange/refund workflow.");
      }
      const items = await tx.select().from(saleItems).where(eq(saleItems.saleId, sale.id));
      for (const item of items) {
        const [batch] = await tx.select().from(batches).where(eq(batches.id, item.batchId)).for("update").limit(1);
        if (!batch) throw new Error("An original stock batch is missing. Sale was not cancelled.");
        await tx.update(batches).set({ quantityRemaining: (Number(batch.quantityRemaining) + Number(item.baseQuantity)).toFixed(3) }).where(eq(batches.id, batch.id));
        await tx.insert(stockMovements).values({ productId: item.productId, batchId: item.batchId, movementType: "void_sale", quantity: Number(item.baseQuantity).toFixed(3), referenceType: "sale_void", referenceId: sale.id, actorId: actor.id, reason: `Restored from approved cancellation: ${reason}` });
      }
      if (sale.customerId && Number(sale.balanceDue) > 0) {
        await tx.insert(debtTransactions).values({ customerId: sale.customerId, saleId: sale.id, transactionType: "credit", amount: sale.balanceDue, notes: `Reversal of cancelled credit sale ${sale.receiptNumber}: ${reason}`, createdBy: actor.id });
      }
      await tx.update(sales).set({ status: "void", balanceDue: "0.00" }).where(eq(sales.id, sale.id));
      await tx.insert(auditLogs).values({ actorId: actor.id, action: "sale.void", entityType: "sale", entityId: sale.id, details: { receiptNumber: sale.receiptNumber, reason, restoredLineCount: items.length } });
      await tx.insert(notifications).values({ type: "security", title: "Credit sale cancelled", message: `${sale.receiptNumber} was cancelled by ${actor.displayName}. Reason: ${reason}`, recordType: "sale", recordId: sale.id });
    });
    revalidatePath("/sales"); revalidatePath("/inventory"); revalidatePath("/debts"); revalidatePath("/dashboard"); revalidatePath("/reports"); revalidatePath("/notifications");
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Sale could not be cancelled.");
  }
}

export async function recordDebtPaymentAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requirePermission("debts:write", true);
  const idempotencyKey = safeText(formData.get("idempotencyKey"), 36);
  if (!idempotencyKeySchema.safeParse(idempotencyKey).success) return { error: "Refresh the page before recording this payment." };
  const parsed = z.object({ customerId: uuidSchema, amount: z.coerce.number().positive().max(999999999), method: z.enum(paymentMethods), reference: z.string().max(120) }).safeParse({
    customerId: formData.get("customerId"), amount: formData.get("amount"), method: formData.get("method"), reference: safeText(formData.get("reference"), 120),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check repayment details." };
  const repaymentCents = toCents(parsed.data.amount);
  if (repaymentCents <= 0) return { error: "Repayment must be at least TSh 0.01." };
  const fingerprint = sha256(JSON.stringify({ actorId: actor.id, ...parsed.data }));
  try {
    const operation = await getDb().transaction(async (tx) => {
      const [claim] = await tx.insert(operationRequests).values({ actorId: actor.id, scope: "debt.repayment", idempotencyKey, fingerprint }).onConflictDoNothing().returning({ id: operationRequests.id });
      if (!claim) {
        const [prior] = await tx.select().from(operationRequests).where(and(eq(operationRequests.actorId, actor.id), eq(operationRequests.scope, "debt.repayment"), eq(operationRequests.idempotencyKey, idempotencyKey))).for("update").limit(1);
        if (!prior || prior.fingerprint !== fingerprint) throw new Error("This payment submission key was already used for different details. Refresh and review the payment.");
        if (!prior.entityId) throw new Error("This payment is already being processed. Check payment history before retrying.");
        return { duplicate: true as const, entityId: prior.entityId };
      }
      const rows = await tx.select().from(sales).where(and(eq(sales.customerId, parsed.data.customerId), gt(sales.balanceDue, "0"), inArray(sales.status, ["partial", "credit"]))).orderBy(asc(sales.createdAt)).for("update");
      const creditRows = await tx.select({ value: sql<string>`COALESCE(SUM(CASE WHEN ${debtTransactions.transactionType} = 'debit' THEN ${debtTransactions.amount} WHEN ${debtTransactions.transactionType} = 'credit' THEN -${debtTransactions.amount} ELSE 0 END), 0)` }).from(debtTransactions).where(eq(debtTransactions.customerId, parsed.data.customerId));
      const outstandingCents = toCents(Number(creditRows[0]?.value ?? 0));
      if (repaymentCents > outstandingCents) throw new Error("Repayment cannot be greater than the customer's outstanding balance.");
      let remainingCents = repaymentCents;
      const allocations: Array<{ saleId: string; amount: string }> = [];
      for (const sale of rows) {
        if (remainingCents <= 0) break;
        const dueCents = Math.round(Number(sale.balanceDue) * 100);
        const applyCents = Math.min(dueCents, remainingCents);
        const newDue = (dueCents - applyCents) / 100;
        const newPaid = Number(sale.amountPaid) + applyCents / 100;
        await tx.update(sales).set({ balanceDue: newDue.toFixed(2), amountPaid: newPaid.toFixed(2), status: newDue <= 0 ? "completed" : "partial" }).where(eq(sales.id, sale.id));
        allocations.push({ saleId: sale.id, amount: (applyCents / 100).toFixed(2) });
        remainingCents -= applyCents;
      }
      if (remainingCents > 0) throw new Error("The customer's open sale balances could not be fully matched. Contact the owner before recording this payment.");
      const [paymentRow] = await tx.insert(payments).values({ customerId: parsed.data.customerId, amount: (repaymentCents / 100).toFixed(2), method: parsed.data.method, reference: parsed.data.reference || null, paymentType: "debt_repayment", receivedBy: actor.id }).returning({ id: payments.id });
      if (allocations.length) await tx.insert(paymentAllocations).values(allocations.map((allocation) => ({ paymentId: paymentRow.id, saleId: allocation.saleId, amount: allocation.amount })));
      await tx.insert(debtTransactions).values({ customerId: parsed.data.customerId, transactionType: "credit", amount: (repaymentCents / 100).toFixed(2), createdBy: actor.id, notes: "Customer debt repayment" });
      await tx.insert(auditLogs).values({ actorId: actor.id, action: "debt.repayment", entityType: "customer", entityId: parsed.data.customerId, details: { amount: parsed.data.amount, method: parsed.data.method } });
      await tx.update(operationRequests).set({ entityType: "payment", entityId: paymentRow.id }).where(eq(operationRequests.id, claim.id));
      return { duplicate: false as const, entityId: paymentRow.id };
    });
    revalidatePath("/debts"); revalidatePath("/customers"); revalidatePath("/dashboard"); revalidatePath("/reports");
    return { success: operation.duplicate ? "This debt payment was already recorded. No duplicate payment was created." : "Customer repayment recorded." };
  } catch (error) { return { error: error instanceof Error ? error.message : "Could not record repayment." }; }
}

export async function createExpenseAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requirePermission("expenses:write", true);
  const idempotencyKey = safeText(formData.get("idempotencyKey"), 36);
  if (!idempotencyKeySchema.safeParse(idempotencyKey).success) return { error: "Refresh the page before recording this expense." };
  const parsed = z.object({ category: z.enum(["Rent", "Salary", "Transport", "Electricity", "Internet", "Food", "Other"]), description: z.string().trim().min(2).max(1000), amount: z.coerce.number().positive().max(999999999), method: z.enum(paymentMethods), reference: z.string().max(120) }).safeParse({
    category: formData.get("category"), description: formData.get("description"), amount: formData.get("amount"), method: formData.get("method"), reference: safeText(formData.get("reference"), 120),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check expense details." };
  const db = getDb();
  const meta = await requestMeta();
  const fingerprint = sha256(JSON.stringify({ actorId: actor.id, ...parsed.data }));
  try {
    const operation = await db.transaction(async (tx) => {
      const [claim] = await tx.insert(operationRequests).values({ actorId: actor.id, scope: "expense.create", idempotencyKey, fingerprint }).onConflictDoNothing().returning({ id: operationRequests.id });
      if (!claim) {
        const [prior] = await tx.select().from(operationRequests).where(and(eq(operationRequests.actorId, actor.id), eq(operationRequests.scope, "expense.create"), eq(operationRequests.idempotencyKey, idempotencyKey))).for("update").limit(1);
        if (!prior || prior.fingerprint !== fingerprint) throw new Error("This expense submission key was already used for different details. Refresh and review the expense.");
        if (!prior.entityId) throw new Error("This expense is already being processed. Check expense history before retrying.");
        return { duplicate: true as const, entityId: prior.entityId };
      }
      const [row] = await tx.insert(expenses).values({ ...parsed.data, amount: (toCents(parsed.data.amount) / 100).toFixed(2), reference: parsed.data.reference || null, createdBy: actor.id }).returning({ id: expenses.id });
      await tx.insert(auditLogs).values({ actorId: actor.id, action: "expense.create", entityType: "expense", entityId: row.id, details: { amount: parsed.data.amount, category: parsed.data.category }, ipHash: sha256(meta.ip) });
      await tx.update(operationRequests).set({ entityType: "expense", entityId: row.id }).where(eq(operationRequests.id, claim.id));
      return { duplicate: false as const, entityId: row.id };
    });
    revalidatePath("/expenses"); revalidatePath("/dashboard"); revalidatePath("/reports");
    return { success: operation.duplicate ? "This expense was already recorded. No duplicate expense was created." : "Expense recorded." };
  } catch { return { error: "Could not record this expense. Refresh and try again." }; }
}

export async function createStaffAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requirePermission("staff:write", true);
  const parsed = z.object({ username: usernameSchema, displayName: z.string().trim().min(2).max(120), password: z.string().min(12).max(200), role: z.enum(["manager", "cashier", "stock_attendant"]) }).safeParse({
    username: formData.get("username"), displayName: formData.get("displayName"), password: formData.get("password"), role: formData.get("role"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check staff account details." };
  try {
    const passwordHash = await argon2.hash(parsed.data.password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
    const db = getDb();
    const meta = await requestMeta();
    await db.transaction(async (tx) => {
      const [created] = await tx.insert(users).values({ username: parsed.data.username, displayName: parsed.data.displayName, passwordHash, role: parsed.data.role as Role, forcePasswordChange: true }).returning({ id: users.id });
      await tx.insert(auditLogs).values({ actorId: actor.id, action: "staff.create", entityType: "user", entityId: created.id, details: { username: parsed.data.username, role: parsed.data.role }, ipHash: sha256(meta.ip) });
    });
    revalidatePath("/staff"); return { success: "Staff account created. Ask the staff member to change the temporary password at first sign-in." };
  } catch (error) { return { error: String(error).includes("users_username_uq") ? "That username is already taken." : "Could not create the staff account." }; }
}

export async function adjustStockAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requirePermission("inventory:write", true);
  const parsed = z.object({ productId: uuidSchema, batchId: uuidSchema, direction: z.enum(["in", "out"]), reasonType: z.enum(["count_correction", "damage", "expiry", "loss", "other"]), quantity: z.coerce.number().positive().max(1000000), reason: z.string().trim().min(5).max(500) }).safeParse({
    productId: formData.get("productId"), batchId: formData.get("batchId"), direction: formData.get("direction"), reasonType: formData.get("reasonType") || "other", quantity: formData.get("quantity"), reason: formData.get("reason"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check stock adjustment details." };
  if (parsed.data.direction === "out" && actor.role !== "owner" && actor.role !== "manager") return { error: "Only an owner or manager can approve stock removal adjustments." };
  try {
    await getDb().transaction(async (tx) => {
      const [batch] = await tx.select().from(batches).where(and(eq(batches.id, parsed.data.batchId), eq(batches.productId, parsed.data.productId))).for("update").limit(1);
      if (!batch) throw new Error("Selected batch was not found.");
      const current = Number(batch.quantityRemaining);
      const next = parsed.data.direction === "in" ? current + parsed.data.quantity : current - parsed.data.quantity;
      if (next < -0.000001) throw new Error("Adjustment cannot make stock negative.");
      await tx.update(batches).set({ quantityRemaining: Math.max(0, next).toFixed(3) }).where(eq(batches.id, batch.id));
      const movement = parsed.data.direction === "in" ? "adjustment_in" : parsed.data.reasonType === "damage" ? "damage" : parsed.data.reasonType === "expiry" ? "expiry" : parsed.data.reasonType === "loss" ? "loss" : "adjustment_out";
      await tx.insert(stockMovements).values({ productId: batch.productId, batchId: batch.id, movementType: movement, quantity: (parsed.data.direction === "in" ? parsed.data.quantity : -parsed.data.quantity).toFixed(3), reason: parsed.data.reason, actorId: actor.id });
      await tx.insert(auditLogs).values({ actorId: actor.id, action: "inventory.adjust", entityType: "batch", entityId: batch.id, details: { direction: parsed.data.direction, reasonType: parsed.data.reasonType, quantity: parsed.data.quantity, reason: parsed.data.reason } });
      await tx.insert(notifications).values({ type: "stock_adjustment", title: "Stock adjustment recorded", message: `${parsed.data.quantity} units adjusted: ${parsed.data.reason}`, recordType: "batch", recordId: batch.id });
    });
    revalidatePath("/inventory"); revalidatePath("/dashboard"); revalidatePath("/notifications");
    return { success: "Stock adjustment recorded." };
  } catch (error) { return { error: error instanceof Error ? error.message : "Stock adjustment failed." }; }
}

export async function markNotificationReadAction(formData: FormData) {
  const actor = await requirePermission("notifications:write", true);
  const id = safeText(formData.get("id"), 36);
  if (!uuidSchema.safeParse(id).success) return;
  await getDb().update(notifications).set({ readAt: new Date() }).where(eq(notifications.id, id));
  await writeAudit(actor.id, "notification.read", "notification", id);
  revalidatePath("/notifications");
}

export async function markAllNotificationsReadAction() {
  const actor = await requirePermission("notifications:write", true);
  await getDb().update(notifications).set({ readAt: new Date() }).where(isNull(notifications.readAt));
  await writeAudit(actor.id, "notification.read_all", "notification", null);
  revalidatePath("/notifications");
}

export async function updateBusinessSettingsAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requirePermission("settings:write", true);
  if (actor.role !== "owner") return { error: "Only the owner can change business and tax settings." };
  const parsed = z.object({ businessName: z.string().trim().min(2).max(160), phone: z.string().max(32), address: z.string().max(1000), tin: z.string().max(40), vatRegistered: z.enum(["yes", "no"]), vatRate: z.coerce.number().min(0).max(100).optional() }).safeParse({
    businessName: formData.get("businessName"), phone: safeText(formData.get("phone"), 32), address: safeText(formData.get("address"), 1000), tin: safeText(formData.get("tin"), 40),
    vatRegistered: formData.get("vatRegistered"), vatRate: formData.get("vatRate") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check settings." };
  // Tax is intentionally not calculated until the business's TRA registration status and applicable treatment are verified.
  const db = getDb();
  const meta = await requestMeta();
  await db.transaction(async (tx) => {
    await tx.update(businessSettings).set({ businessName: parsed.data.businessName, phone: parsed.data.phone || null, address: parsed.data.address || null, tin: parsed.data.tin || null, vatRegistered: parsed.data.vatRegistered === "yes", vatRate: parsed.data.vatRegistered === "yes" && parsed.data.vatRate !== undefined ? parsed.data.vatRate.toFixed(2) : null, updatedAt: new Date() }).where(eq(businessSettings.id, 1));
    await tx.insert(auditLogs).values({ actorId: actor.id, action: "settings.update", entityType: "business_settings", details: { taxConfigured: parsed.data.vatRegistered === "yes" }, ipHash: sha256(meta.ip) });
  });
  revalidatePath("/settings"); revalidatePath("/dashboard"); return { success: "Business settings saved. Confirm tax configuration with TRA or your accountant before applying tax to sales." };
}

export async function openShiftAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requirePermission("shifts:write", true);
  const openingCash = safeNumber(formData.get("openingCash"), -1);
  if (openingCash < 0) return { error: "Opening cash must be zero or more." };
  const db = getDb();
  const meta = await requestMeta();
  try {
    await db.transaction(async (tx) => {
      const existing = await tx.select({ id: cashierShifts.id }).from(cashierShifts)
        .where(and(eq(cashierShifts.userId, actor.id), isNull(cashierShifts.closedAt))).limit(1);
      if (existing.length) throw new Error("SHIFT_ALREADY_OPEN");
      const [shift] = await tx.insert(cashierShifts).values({ userId: actor.id, openingCash: (toCents(openingCash) / 100).toFixed(2) }).returning({ id: cashierShifts.id });
      await tx.insert(auditLogs).values({ actorId: actor.id, action: "shift.open", entityType: "cashier_shift", entityId: shift.id, details: { openingCash }, ipHash: sha256(meta.ip) });
    });
    revalidatePath("/sales");
    return { success: "Cashier shift opened." };
  } catch (error) {
    if (String(error).includes("SHIFT_ALREADY_OPEN") || String(error).includes("cashier_shifts_one_open_per_user_uq")) return { error: "You already have an open cashier shift." };
    return { error: "Unable to open cashier shift. Refresh and try again." };
  }
}

export async function closeShiftAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requirePermission("shifts:write", true);
  const countedCash = safeNumber(formData.get("countedCash"), -1);
  if (countedCash < 0) return { error: "Counted cash must be zero or more." };
  const meta = await requestMeta();
  try {
    const result = await getDb().transaction(async (tx) => {
      const [shift] = await tx.select().from(cashierShifts)
        .where(and(eq(cashierShifts.userId, actor.id), isNull(cashierShifts.closedAt))).for("update").limit(1);
      if (!shift) throw new Error("You do not have an open shift.");
      const rows = await tx.select({ amount: sql<string>`COALESCE(SUM(${payments.amount}), 0)` }).from(payments)
        .where(and(eq(payments.receivedBy, actor.id), eq(payments.method, "cash"), gte(payments.createdAt, shift.openedAt)));
      const expenseRows = await tx.select({ amount: sql<string>`COALESCE(SUM(${expenses.amount}), 0)` }).from(expenses)
        .where(and(eq(expenses.createdBy, actor.id), eq(expenses.method, "cash"), gte(expenses.createdAt, shift.openedAt)));
      const supplierRows = await tx.select({ amount: sql<string>`COALESCE(SUM(${purchasePayments.amount}), 0)` }).from(purchasePayments)
        .where(and(eq(purchasePayments.paidBy, actor.id), eq(purchasePayments.method, "cash"), gte(purchasePayments.paidAt, shift.openedAt)));
      const expectedCash = calculateExpectedCash(Number(shift.openingCash), Number(rows[0]?.amount ?? 0), Number(expenseRows[0]?.amount ?? 0), Number(supplierRows[0]?.amount ?? 0));
      const discrepancy = countedCash - expectedCash;
      await tx.update(cashierShifts).set({ closedAt: new Date(), expectedCash: expectedCash.toFixed(2), countedCash: (toCents(countedCash) / 100).toFixed(2), discrepancy: discrepancy.toFixed(2), notes: safeText(formData.get("notes"), 500) || null })
        .where(and(eq(cashierShifts.id, shift.id), isNull(cashierShifts.closedAt)));
      await tx.insert(auditLogs).values({ actorId: actor.id, action: "shift.close", entityType: "cashier_shift", entityId: shift.id, details: { expectedCash, countedCash, discrepancy }, ipHash: sha256(meta.ip) });
      if (Math.abs(discrepancy) >= 1) await tx.insert(notifications).values({ type: "cash_discrepancy", title: "Cashier shift discrepancy", message: `${actor.displayName} closed a shift with a ${discrepancy.toFixed(2)} TZS cash difference.`, recordType: "cashier_shift", recordId: shift.id });
      return { expectedCash, discrepancy };
    });
    revalidatePath("/sales");
    revalidatePath("/notifications");
    return { success: `Cashier shift closed. Expected cash: TSh ${result.expectedCash.toFixed(2)}; difference: TSh ${result.discrepancy.toFixed(2)}.` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to close cashier shift. Refresh and try again." };
  }
}

export async function changePasswordAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireUser();
  const meta = await requestMeta();
  if (actor.accessMode !== "full" || isMobileUserAgent(meta.userAgent)) return { error: "Use a desktop or laptop to change this account password." };
  const parsed = z.object({ currentPassword: z.string().min(1).max(200), newPassword: z.string().min(12).max(200), confirmPassword: z.string().min(12).max(200) }).safeParse({
    currentPassword: formData.get("currentPassword"), newPassword: formData.get("newPassword"), confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check password details." };
  if (parsed.data.newPassword !== parsed.data.confirmPassword) return { error: "New passwords do not match." };
  if (parsed.data.currentPassword === parsed.data.newPassword) return { error: "Choose a password different from the current one." };
  const [account] = await getDb().select().from(users).where(eq(users.id, actor.id)).limit(1);
  if (!account || !await argon2.verify(account.passwordHash, parsed.data.currentPassword).catch(() => false)) return { error: "Current password is incorrect." };
  const passwordHash = await argon2.hash(parsed.data.newPassword, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  await getDb().update(users).set({ passwordHash, forcePasswordChange: false, updatedAt: new Date() }).where(eq(users.id, actor.id));
  await getDb().delete(sessions).where(eq(sessions.userId, actor.id));
  await writeAudit(actor.id, "auth.password_change", "user", actor.id);
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

export async function createExchangeAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requirePermission("sales:write", true);
  if (actor.role !== "owner" && actor.role !== "manager") return { error: "Only the owner or manager can approve an exceptional exchange." };
  const parsed = z.object({ originalSaleItemId: uuidSchema, replacementProductId: uuidSchema, quantity: z.coerce.number().positive().max(1000000), replacementQuantity: z.coerce.number().positive().max(1000000), reason: z.string().trim().min(5).max(500), paymentMethod: z.enum(paymentMethods) }).safeParse({
    originalSaleItemId: formData.get("originalSaleItemId"), replacementProductId: formData.get("replacementProductId"), quantity: formData.get("quantity"), replacementQuantity: formData.get("replacementQuantity"), reason: formData.get("reason"), paymentMethod: formData.get("paymentMethod"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check exchange details." };
  try {
    await getDb().transaction(async (tx) => {
      const [original] = await tx.select({ item: saleItems, sale: sales }).from(saleItems).innerJoin(sales, eq(sales.id, saleItems.saleId)).where(eq(saleItems.id, parsed.data.originalSaleItemId)).for("update").limit(1);
      if (!original || original.sale.status === "void") throw new Error("Original sale line was not found or has been voided.");
      if (Number(original.sale.balanceDue) > 0.005) throw new Error("Settle the original sale balance before processing an exceptional exchange.");
      const previous = await tx.select({ value: sql<string>`COALESCE(SUM(${exchanges.quantity}), 0)` }).from(exchanges).where(eq(exchanges.originalSaleItemId, original.item.id));
      const remaining = Number(original.item.baseQuantity) - Number(previous[0]?.value ?? 0);
      if (parsed.data.quantity - 0.000001 > remaining) throw new Error(`Only ${Math.max(0, remaining).toFixed(3)} base units remain eligible for exchange.`);
      const [replacement] = await tx.select().from(products).where(and(eq(products.id, parsed.data.replacementProductId), eq(products.active, true))).limit(1);
      if (!replacement) throw new Error("Replacement product is unavailable.");
      const unitPrice = original.sale.saleType === "wholesale" ? Number(replacement.wholesalePrice) : Number(replacement.retailPrice);
      if (unitPrice < Number(replacement.minimumPrice)) throw new Error("Replacement price is below its minimum selling price.");
      const originalNetLine = Number(original.item.lineTotal) - Number(original.item.discountAmount);
      const originalValueCents = Math.round((originalNetLine / Number(original.item.baseQuantity)) * parsed.data.quantity * 100);
      const replacementValueCents = Math.round(unitPrice * parsed.data.replacementQuantity * 100);
      const differenceCents = replacementValueCents - originalValueCents;
      const available = await tx.select().from(batches).where(and(eq(batches.productId, replacement.id), gt(batches.quantityRemaining, "0"), gte(batches.expiryDate, todayDateTz()))).orderBy(asc(batches.expiryDate)).for("update");
      const availableQuantity = available.reduce((sum, batch) => sum + Number(batch.quantityRemaining), 0);
      if (availableQuantity + 0.000001 < parsed.data.replacementQuantity) throw new Error(`Insufficient unexpired stock for ${replacement.name}. Available: ${availableQuantity}.`);
      const [exchange] = await tx.insert(exchanges).values({ originalSaleId: original.sale.id, originalSaleItemId: original.item.id, originalBatchId: original.item.batchId, originalProductId: original.item.productId, replacementProductId: replacement.id, quantity: parsed.data.quantity.toFixed(3), replacementQuantity: parsed.data.replacementQuantity.toFixed(3), priceDifference: (differenceCents / 100).toFixed(2), reason: parsed.data.reason, approvedBy: actor.id, inspected: false }).returning({ id: exchanges.id });
      await tx.insert(quarantinedStock).values({ exchangeId: exchange.id, productId: original.item.productId, originalBatchId: original.item.batchId, quantity: parsed.data.quantity.toFixed(3), reason: parsed.data.reason });
      let remainingReplacement = parsed.data.replacementQuantity;
      for (const batch of available) {
        if (remainingReplacement <= 0.000001) break;
        const take = Math.min(remainingReplacement, Number(batch.quantityRemaining));
        await tx.update(batches).set({ quantityRemaining: (Number(batch.quantityRemaining) - take).toFixed(3) }).where(eq(batches.id, batch.id));
        await tx.insert(stockMovements).values({ productId: replacement.id, batchId: batch.id, movementType: "exchange_out", quantity: (-take).toFixed(3), referenceType: "exchange", referenceId: exchange.id, actorId: actor.id, reason: `Replacement for exchange ${exchange.id}` });
        remainingReplacement -= take;
      }
      if (differenceCents !== 0) await tx.insert(payments).values({ saleId: original.sale.id, customerId: original.sale.customerId, amount: (differenceCents / 100).toFixed(2), method: parsed.data.paymentMethod, paymentType: differenceCents > 0 ? "exchange_difference" : "refund", reference: `Exchange ${exchange.id}`, receivedBy: actor.id });
      await tx.insert(notifications).values({ type: "stock_adjustment", title: "Exceptional exchange approved", message: `Exchange ${exchange.id} has been recorded. Returned medicine is quarantined and has not been returned to sellable stock.`, recordType: "exchange", recordId: exchange.id });
      await tx.insert(auditLogs).values({ actorId: actor.id, action: "exchange.approve", entityType: "exchange", entityId: exchange.id, details: { originalSaleId: original.sale.id, originalProductId: original.item.productId, replacementProductId: replacement.id, returnedQuantity: parsed.data.quantity, replacementQuantity: parsed.data.replacementQuantity, priceDifference: differenceCents / 100 } });
    });
    revalidatePath("/exchanges"); revalidatePath("/inventory"); revalidatePath("/sales"); revalidatePath("/notifications"); revalidatePath("/dashboard");
    return { success: "Exceptional exchange recorded. Returned medicine is in quarantine and was not added to sellable stock." };
  } catch (error) { return { error: error instanceof Error ? error.message : "Exchange could not be recorded." }; }
}

export async function resolveQuarantineAction(formData: FormData) {
  const actor = await requirePermission("settings:write", true);
  if (actor.role !== "owner") return;
  const id = safeText(formData.get("id"), 36);
  const notes = safeText(formData.get("notes"), 500);
  if (!uuidSchema.safeParse(id).success || notes.length < 5) return;
  const db = getDb();
  const meta = await requestMeta();
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(quarantinedStock).where(eq(quarantinedStock.id, id)).for("update").limit(1);
    if (!row || row.status !== "pending_inspection") return;
    await tx.update(quarantinedStock).set({ status: "disposed", resolutionNotes: notes, resolvedBy: actor.id, resolvedAt: new Date() }).where(eq(quarantinedStock.id, id));
    await tx.update(exchanges).set({ inspected: true }).where(eq(exchanges.id, row.exchangeId));
    await tx.insert(auditLogs).values({ actorId: actor.id, action: "quarantine.dispose", entityType: "quarantined_stock", entityId: id, details: { notes }, ipHash: sha256(meta.ip) });
  });
  revalidatePath("/exchanges"); revalidatePath("/audit");
}

export async function updateProductPricingAction(formData: FormData) {
  const actor = await requirePermission("products:write", true);
  if (actor.role !== "owner" && actor.role !== "manager") throw new Error("Only an owner or manager can change product pricing.");
  const id = safeText(formData.get("productId"), 36);
  const parsed = z.object({ buyingPrice: moneySchema, retailPrice: moneySchema, wholesalePrice: moneySchema, minimumPrice: moneySchema, reorderLevel: z.coerce.number().min(0).max(999999999) }).safeParse({
    buyingPrice: formData.get("buyingPrice"), retailPrice: formData.get("retailPrice"), wholesalePrice: formData.get("wholesalePrice"), minimumPrice: formData.get("minimumPrice"), reorderLevel: formData.get("reorderLevel"),
  });
  if (!uuidSchema.safeParse(id).success || !parsed.success) return;
  if (parsed.data.minimumPrice > parsed.data.retailPrice || parsed.data.minimumPrice > parsed.data.wholesalePrice) return;
  const meta = await requestMeta();
  await getDb().transaction(async (tx) => {
    const [before] = await tx.select({ sku: products.sku }).from(products).where(eq(products.id, id)).for("update").limit(1);
    if (!before) return;
    await tx.update(products).set({ buyingPrice: (toCents(parsed.data.buyingPrice) / 100).toFixed(2), retailPrice: (toCents(parsed.data.retailPrice) / 100).toFixed(2), wholesalePrice: (toCents(parsed.data.wholesalePrice) / 100).toFixed(2), minimumPrice: (toCents(parsed.data.minimumPrice) / 100).toFixed(2), reorderLevel: parsed.data.reorderLevel.toFixed(3), updatedAt: new Date() }).where(eq(products.id, id));
    await tx.insert(auditLogs).values({ actorId: actor.id, action: "product.prices_update", entityType: "product", entityId: id, details: { sku: before.sku, ...parsed.data }, ipHash: sha256(meta.ip) });
  });
  revalidatePath("/products"); revalidatePath("/dashboard");
}

export async function setProductActiveAction(formData: FormData) {
  const actor = await requirePermission("products:write", true);
  if (actor.role !== "owner" && actor.role !== "manager") throw new Error("Only an owner or manager can activate or deactivate products.");
  const id = safeText(formData.get("productId"), 36);
  const active = formData.get("active") === "true";
  if (!uuidSchema.safeParse(id).success) return;
  const meta = await requestMeta();
  await getDb().transaction(async (tx) => {
    const [row] = await tx.update(products).set({ active, updatedAt: new Date() }).where(eq(products.id, id)).returning({ id: products.id });
    if (row) await tx.insert(auditLogs).values({ actorId: actor.id, action: active ? "product.activate" : "product.deactivate", entityType: "product", entityId: id, ipHash: sha256(meta.ip) });
  });
  revalidatePath("/products"); revalidatePath("/sales");
}

export async function createCategoryAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requirePermission("settings:write", true);
  const parsed = z.object({ name: z.string().trim().min(2).max(100), description: z.string().max(500) }).safeParse({ name: formData.get("name"), description: safeText(formData.get("description"), 500) });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check category details." };
  try {
    const db = getDb();
    const meta = await requestMeta();
    await db.transaction(async (tx) => {
      const [row] = await tx.insert(categories).values({ name: parsed.data.name, description: parsed.data.description || null }).returning({ id: categories.id });
      await tx.insert(auditLogs).values({ actorId: actor.id, action: "category.create", entityType: "category", entityId: row.id, details: { name: parsed.data.name }, ipHash: sha256(meta.ip) });
    });
    revalidatePath("/categories"); revalidatePath("/products"); return { success: "Category added." };
  } catch { return { error: "Category name is already in use." }; }
}

export async function setCategoryActiveAction(formData: FormData) {
  const actor = await requirePermission("settings:write", true);
  const id = safeText(formData.get("categoryId"), 36);
  const active = formData.get("active") === "true";
  if (!uuidSchema.safeParse(id).success) return;
  const meta = await requestMeta();
  await getDb().transaction(async (tx) => {
    const [row] = await tx.update(categories).set({ active }).where(eq(categories.id, id)).returning({ id: categories.id });
    if (row) await tx.insert(auditLogs).values({ actorId: actor.id, action: active ? "category.activate" : "category.deactivate", entityType: "category", entityId: id, ipHash: sha256(meta.ip) });
  });
  revalidatePath("/categories"); revalidatePath("/products");
}

export async function setStaffActiveAction(formData: FormData) {
  const actor = await requirePermission("staff:write", true);
  const id = safeText(formData.get("userId"), 36);
  const active = formData.get("active") === "true";
  if (!uuidSchema.safeParse(id).success || id === actor.id) return;
  const meta = await requestMeta();
  await getDb().transaction(async (tx) => {
    const [target] = await tx.select({ role: users.role }).from(users).where(eq(users.id, id)).for("update").limit(1);
    if (!target || target.role === "owner") return;
    await tx.update(users).set({ active, updatedAt: new Date() }).where(eq(users.id, id));
    if (!active) await tx.delete(sessions).where(eq(sessions.userId, id));
    await tx.insert(auditLogs).values({ actorId: actor.id, action: active ? "staff.activate" : "staff.deactivate", entityType: "user", entityId: id, ipHash: sha256(meta.ip) });
  });
  revalidatePath("/staff");
}
