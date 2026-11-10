import { and, asc, desc, eq, gt, gte, inArray, lt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  auditLogs,
  batches,
  customers,
  debtTransactions,
  expenses,
  exchanges,
  notifications,
  products,
  saleItems,
  sales,
  users,
} from "@/db/schema";
import type { Role } from "./types";
import { calculateProfitMetrics } from "./finance";

function dateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Dar_es_Salaam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function localBoundary(date: string): Date {
  return new Date(`${date}T00:00:00+03:00`);
}

export async function getDashboardData(role: Role, userId: string) {
  const db = getDb();
  const now = new Date();
  const today = dateKey(now);
  const month = today.slice(0, 7);
  const todayStart = localBoundary(today);
  const tomorrowStart = new Date(
    todayStart.getTime() + 24 * 60 * 60 * 1000,
  );
  const monthStart = localBoundary(`${month}-01`);
  const endWindow = new Date(
    todayStart.getTime() + 90 * 24 * 60 * 60 * 1000,
  );
  const lastSevenStart = new Date(
    todayStart.getTime() - 6 * 24 * 60 * 60 * 1000,
  );

  /*
   * Exchange profit effect:
   *
   * Price difference received/paid during the exchange,
   * minus the cost of the product that left the inventory.
   *
   * Table aliases are used explicitly inside the subquery to prevent
   * PostgreSQL from treating "id" or "batch_id" as ambiguous columns.
   */
  const exchangeEffectExpression = sql<string>`
    COALESCE(
      SUM(
        ${exchanges.priceDifference} -
        COALESCE(
          (
            SELECT SUM((-1 * sm."quantity") * b."unit_cost")
            FROM "stock_movements" AS sm
            INNER JOIN "batches" AS b
              ON b."id" = sm."batch_id"
            WHERE sm."reference_type" = 'exchange'
              AND sm."reference_id" = "exchanges"."id"
              AND sm."movement_type" = 'exchange_out'
          ),
          0
        )
      ),
      0
    )
  `;

  const [
    todaySales,
    todayExchangeRevenue,
    monthSales,
    monthExchangeRevenue,
    todayProfit,
    todayExchangeEffect,
    todayExpenses,
    monthProfit,
    monthExchangeEffect,
    monthExpenses,
    debts,
    stockValue,
    lowStockProducts,
    expiryBatches,
    expiredBatches,
    overdueDebts,
    bestSellers,
    activity,
    notices,
    dailySales,
    dailyExchangeRevenue,
    dailyProfit,
    dailyExchangeEffect,
  ] = await Promise.all([
    db
      .select({
        value: sql<string>`COALESCE(SUM(${sales.total}), 0)`,
      })
      .from(sales)
      .where(
        and(
          gte(sales.createdAt, todayStart),
          lt(sales.createdAt, tomorrowStart),
          sql`${sales.status} <> 'void'`,
        ),
      ),

    db
      .select({
        value: sql<string>`COALESCE(SUM(${exchanges.priceDifference}), 0)`,
      })
      .from(exchanges)
      .where(
        and(
          gte(exchanges.createdAt, todayStart),
          lt(exchanges.createdAt, tomorrowStart),
        ),
      ),

    db
      .select({
        value: sql<string>`COALESCE(SUM(${sales.total}), 0)`,
      })
      .from(sales)
      .where(
        and(
          gte(sales.createdAt, monthStart),
          lt(sales.createdAt, tomorrowStart),
          sql`${sales.status} <> 'void'`,
        ),
      ),

    db
      .select({
        value: sql<string>`COALESCE(SUM(${exchanges.priceDifference}), 0)`,
      })
      .from(exchanges)
      .where(
        and(
          gte(exchanges.createdAt, monthStart),
          lt(exchanges.createdAt, tomorrowStart),
        ),
      ),

    db
      .select({
        value: sql<string>`
          COALESCE(
            SUM(
              ${saleItems.lineTotal} -
              ${saleItems.discountAmount} -
              (${saleItems.baseQuantity} * ${saleItems.unitCost})
            ),
            0
          )
        `,
      })
      .from(saleItems)
      .innerJoin(sales, eq(sales.id, saleItems.saleId))
      .where(
        and(
          gte(sales.createdAt, todayStart),
          lt(sales.createdAt, tomorrowStart),
          sql`${sales.status} <> 'void'`,
        ),
      ),

    db
      .select({
        value: exchangeEffectExpression,
      })
      .from(exchanges)
      .where(
        and(
          gte(exchanges.createdAt, todayStart),
          lt(exchanges.createdAt, tomorrowStart),
        ),
      ),

    db
      .select({
        value: sql<string>`COALESCE(SUM(${expenses.amount}), 0)`,
      })
      .from(expenses)
      .where(
        and(
          gte(expenses.spentAt, todayStart),
          lt(expenses.spentAt, tomorrowStart),
        ),
      ),

    db
      .select({
        value: sql<string>`
          COALESCE(
            SUM(
              ${saleItems.lineTotal} -
              ${saleItems.discountAmount} -
              (${saleItems.baseQuantity} * ${saleItems.unitCost})
            ),
            0
          )
        `,
      })
      .from(saleItems)
      .innerJoin(sales, eq(sales.id, saleItems.saleId))
      .where(
        and(
          gte(sales.createdAt, monthStart),
          lt(sales.createdAt, tomorrowStart),
          sql`${sales.status} <> 'void'`,
        ),
      ),

    db
      .select({
        value: exchangeEffectExpression,
      })
      .from(exchanges)
      .where(
        and(
          gte(exchanges.createdAt, monthStart),
          lt(exchanges.createdAt, tomorrowStart),
        ),
      ),

    db
      .select({
        value: sql<string>`COALESCE(SUM(${expenses.amount}), 0)`,
      })
      .from(expenses)
      .where(
        and(
          gte(expenses.spentAt, monthStart),
          lt(expenses.spentAt, tomorrowStart),
        ),
      ),

    db
      .select({
        value: sql<string>`
          COALESCE(
            SUM(
              CASE
                WHEN ${debtTransactions.transactionType} = 'debit'
                  THEN ${debtTransactions.amount}
                WHEN ${debtTransactions.transactionType} = 'credit'
                  THEN -${debtTransactions.amount}
                ELSE 0
              END
            ),
            0
          )
        `,
      })
      .from(debtTransactions),

    db
      .select({
        value: sql<string>`
          COALESCE(
            SUM(${batches.quantityRemaining} * ${batches.unitCost}),
            0
          )
        `,
      })
      .from(batches)
      .where(gt(batches.quantityRemaining, "0")),

    db
      .select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        reorder: products.reorderLevel,
        stock: sql<string>`COALESCE(SUM(${batches.quantityRemaining}), 0)`,
      })
      .from(products)
      .leftJoin(
        batches,
        and(
          eq(batches.productId, products.id),
          gte(batches.expiryDate, today),
        ),
      )
      .where(eq(products.active, true))
      .groupBy(products.id)
      .having(
        sql`COALESCE(SUM(${batches.quantityRemaining}), 0) <= ${products.reorderLevel}`,
      )
      .orderBy(asc(products.name))
      .limit(10),

    db
      .select({
        id: batches.id,
        productName: products.name,
        batchNumber: batches.batchNumber,
        expiryDate: batches.expiryDate,
        quantity: batches.quantityRemaining,
      })
      .from(batches)
      .innerJoin(products, eq(products.id, batches.productId))
      .where(
        and(
          gte(batches.expiryDate, today),
          lt(batches.expiryDate, dateKey(endWindow)),
          gt(batches.quantityRemaining, "0"),
        ),
      )
      .orderBy(asc(batches.expiryDate))
      .limit(10),

    db
      .select({
        id: batches.id,
        productName: products.name,
        batchNumber: batches.batchNumber,
        expiryDate: batches.expiryDate,
        quantity: batches.quantityRemaining,
      })
      .from(batches)
      .innerJoin(products, eq(products.id, batches.productId))
      .where(
        and(
          lt(batches.expiryDate, today),
          gt(batches.quantityRemaining, "0"),
        ),
      )
      .orderBy(asc(batches.expiryDate))
      .limit(10),

    db
      .select({
        receipt: sales.receiptNumber,
        customer: customers.name,
        dueDate: debtTransactions.dueDate,
        balance: sales.balanceDue,
      })
      .from(sales)
      .innerJoin(customers, eq(customers.id, sales.customerId))
      .innerJoin(
        debtTransactions,
        and(
          eq(debtTransactions.saleId, sales.id),
          eq(debtTransactions.transactionType, "debit"),
        ),
      )
      .where(
        and(
          gt(sales.balanceDue, "0"),
          inArray(sales.status, ["partial", "credit"]),
          lt(debtTransactions.dueDate, today),
        ),
      )
      .orderBy(asc(debtTransactions.dueDate))
      .limit(10),

    db
      .select({
        name: products.name,
        quantity: sql<string>`SUM(${saleItems.baseQuantity})`,
        revenue: sql<string>`
          SUM(${saleItems.lineTotal} - ${saleItems.discountAmount})
        `,
      })
      .from(saleItems)
      .innerJoin(sales, eq(sales.id, saleItems.saleId))
      .innerJoin(products, eq(products.id, saleItems.productId))
      .where(
        and(
          gte(sales.createdAt, monthStart),
          lt(sales.createdAt, tomorrowStart),
          sql`${sales.status} <> 'void'`,
        ),
      )
      .groupBy(products.id)
      .orderBy(desc(sql`SUM(${saleItems.baseQuantity})`))
      .limit(5),

    db
      .select({
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        createdAt: auditLogs.createdAt,
        actor: users.displayName,
      })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.actorId))
      .where(
        role === "owner" || role === "manager"
          ? undefined
          : eq(auditLogs.actorId, userId),
      )
      .orderBy(desc(auditLogs.createdAt))
      .limit(8),

    db
      .select()
      .from(notifications)
      .where(sql`${notifications.readAt} IS NULL`)
      .orderBy(desc(notifications.createdAt))
      .limit(8),

    db
      .select({
        day: sql<string>`
          to_char(
            ${sales.createdAt} AT TIME ZONE 'Africa/Dar_es_Salaam',
            'YYYY-MM-DD'
          )
        `,
        value: sql<string>`COALESCE(SUM(${sales.total}), 0)`,
      })
      .from(sales)
      .where(
        and(
          gte(sales.createdAt, lastSevenStart),
          lt(sales.createdAt, tomorrowStart),
          sql`${sales.status} <> 'void'`,
        ),
      )
      .groupBy(
        sql`
          to_char(
            ${sales.createdAt} AT TIME ZONE 'Africa/Dar_es_Salaam',
            'YYYY-MM-DD'
          )
        `,
      )
      .orderBy(
        asc(
          sql`
            to_char(
              ${sales.createdAt} AT TIME ZONE 'Africa/Dar_es_Salaam',
              'YYYY-MM-DD'
            )
          `,
        ),
      ),

    db
      .select({
        day: sql<string>`
          to_char(
            ${exchanges.createdAt} AT TIME ZONE 'Africa/Dar_es_Salaam',
            'YYYY-MM-DD'
          )
        `,
        value: sql<string>`
          COALESCE(SUM(${exchanges.priceDifference}), 0)
        `,
      })
      .from(exchanges)
      .where(
        and(
          gte(exchanges.createdAt, lastSevenStart),
          lt(exchanges.createdAt, tomorrowStart),
        ),
      )
      .groupBy(
        sql`
          to_char(
            ${exchanges.createdAt} AT TIME ZONE 'Africa/Dar_es_Salaam',
            'YYYY-MM-DD'
          )
        `,
      )
      .orderBy(
        asc(
          sql`
            to_char(
              ${exchanges.createdAt} AT TIME ZONE 'Africa/Dar_es_Salaam',
              'YYYY-MM-DD'
            )
          `,
        ),
      ),

    db
      .select({
        day: sql<string>`
          to_char(
            ${sales.createdAt} AT TIME ZONE 'Africa/Dar_es_Salaam',
            'YYYY-MM-DD'
          )
        `,
        value: sql<string>`
          COALESCE(
            SUM(
              ${saleItems.lineTotal} -
              ${saleItems.discountAmount} -
              (${saleItems.baseQuantity} * ${saleItems.unitCost})
            ),
            0
          )
        `,
      })
      .from(saleItems)
      .innerJoin(sales, eq(sales.id, saleItems.saleId))
      .where(
        and(
          gte(sales.createdAt, lastSevenStart),
          lt(sales.createdAt, tomorrowStart),
          sql`${sales.status} <> 'void'`,
        ),
      )
      .groupBy(
        sql`
          to_char(
            ${sales.createdAt} AT TIME ZONE 'Africa/Dar_es_Salaam',
            'YYYY-MM-DD'
          )
        `,
      )
      .orderBy(
        asc(
          sql`
            to_char(
              ${sales.createdAt} AT TIME ZONE 'Africa/Dar_es_Salaam',
              'YYYY-MM-DD'
            )
          `,
        ),
      ),

    db
      .select({
        day: sql<string>`
          to_char(
            ${exchanges.createdAt} AT TIME ZONE 'Africa/Dar_es_Salaam',
            'YYYY-MM-DD'
          )
        `,
        value: exchangeEffectExpression,
      })
      .from(exchanges)
      .where(
        and(
          gte(exchanges.createdAt, lastSevenStart),
          lt(exchanges.createdAt, tomorrowStart),
        ),
      )
      .groupBy(
        sql`
          to_char(
            ${exchanges.createdAt} AT TIME ZONE 'Africa/Dar_es_Salaam',
            'YYYY-MM-DD'
          )
        `,
      )
      .orderBy(
        asc(
          sql`
            to_char(
              ${exchanges.createdAt} AT TIME ZONE 'Africa/Dar_es_Salaam',
              'YYYY-MM-DD'
            )
          `,
        ),
      ),
  ]);

  const todayMetrics = calculateProfitMetrics(
    Number(todayProfit[0]?.value ?? 0) +
      Number(todayExchangeEffect[0]?.value ?? 0),
    0,
    Number(todayExpenses[0]?.value ?? 0),
  );

  const monthMetrics = calculateProfitMetrics(
    Number(monthProfit[0]?.value ?? 0) +
      Number(monthExchangeEffect[0]?.value ?? 0),
    0,
    Number(monthExpenses[0]?.value ?? 0),
  );

  const monthOperatingExpenses = Number(monthExpenses[0]?.value ?? 0);

  return {
    todaySales:
      Number(todaySales[0]?.value ?? 0) +
      Number(todayExchangeRevenue[0]?.value ?? 0),

    monthSales:
      Number(monthSales[0]?.value ?? 0) +
      Number(monthExchangeRevenue[0]?.value ?? 0),

    todayProfit: todayMetrics.netProfit,
    monthNetProfit: monthMetrics.netProfit,
    monthExpenses: monthOperatingExpenses,
    todayExpenses: Number(todayExpenses[0]?.value ?? 0),

    debts: Number(debts[0]?.value ?? 0),
    stockValue: Number(stockValue[0]?.value ?? 0),

    lowStockProducts,
    expiryBatches,
    expiredBatches,
    overdueDebts,
    bestSellers,
    activity,
    notices,

    chart: Array.from({ length: 7 }, (_, index) => {
      const key = dateKey(
        new Date(
          lastSevenStart.getTime() +
            index * 24 * 60 * 60 * 1000,
        ),
      );

      return {
        day: key.slice(5),

        sales:
          Number(
            dailySales.find((row) => row.day === key)?.value ?? 0,
          ) +
          Number(
            dailyExchangeRevenue.find((row) => row.day === key)?.value ??
              0,
          ),

        profit:
          Number(
            dailyProfit.find((row) => row.day === key)?.value ?? 0,
          ) +
          Number(
            dailyExchangeEffect.find((row) => row.day === key)?.value ??
              0,
          ),
      };
    }),

    showFinancials: role === "owner" || role === "manager",
    showSales: role !== "stock_attendant",
    generatedAt: now,
  };
}