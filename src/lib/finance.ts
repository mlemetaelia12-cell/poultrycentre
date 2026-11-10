/** Financial helpers shared by dashboards, reports and cash reconciliation. */
export function calculateProfitMetrics(netSales: number, costOfGoodsSold: number, operatingExpenses: number) {
  const grossProfit = netSales - costOfGoodsSold;
  return { grossProfit, netProfit: grossProfit - operatingExpenses };
}

export function calculateExpectedCash(openingFloat: number, cashCollections: number, cashExpenses: number, supplierCashPayments: number) {
  return openingFloat + cashCollections - cashExpenses - supplierCashPayments;
}

export function toCents(value: number): number {
  if (!Number.isFinite(value)) throw new Error("Money amount must be a finite number.");
  return Math.round((value + Number.EPSILON) * 100);
}
