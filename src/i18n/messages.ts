export type Locale = "en" | "sw";

const messages = {
  en: {
    dashboard: "Dashboard", ai: "AI Workspace", products: "Products", categories: "Categories", inventory: "Inventory", sales: "Sales & POS", exchanges: "Exceptional exchanges", purchases: "Purchases", customers: "Customers", debts: "Customer debts", expenses: "Expenses", reports: "Reports", staff: "Staff & access", notifications: "Notifications", audit: "Audit log", settings: "Settings", receipts: "Receipts",
    overview: "Business overview", welcome: "Here is what is happening at your shop today.", todaySales: "Today's sales", todayProfit: "Today's net profit", monthSales: "Monthly sales", monthProfit: "Monthly net profit", expensesMonth: "Monthly expenses", outstandingDebts: "Customer debts", stockValue: "Stock valuation", lowStock: "Low stock", expiry: "Expiring soon", expired: "Expired products", bestSellers: "Best-selling products", recentActivity: "Recent activity", importantNotices: "Important notifications",
    salesHistory: "Sales History", backToPos: "Back to POS", reviewSales: "Review every sale and the products recorded in each transaction.", fromDate: "From date", toDate: "To date", searchSales: "Search receipt, customer, cashier or product", applyFilters: "Apply filters", today: "Today", productsSold: "Products sold", saleTotal: "Sale total", amountPaid: "Amount paid", outstanding: "Outstanding", saleType: "Sale type", viewSaleDetails: "View sale details", noSalesFound: "No sales found for these filters.", tryDateRange: "Try another date range or clear the search.", previous: "Previous", next: "Next", recordedActions: "Recorded actions", searchEvents: "Search events", actionType: "Action type", allActions: "All actions", allUsers: "All users", clear: "Clear", noAuditEvents: "No audit events match these filters.", details: "Details", businessProtection: "Business data protection", readOnlyAI: "Business assistant · Read-only", mobileReadOnly: "Owner mobile dashboard · Read only", desktopRequired: "Use a desktop or laptop to manage the business.", search: "Search", add: "Add", save: "Save", cancel: "Cancel", signOut: "Sign out", english: "English", swahili: "Kiswahili", noRecords: "No records yet.", accessDenied: "You do not have permission to view this section.",
  },
  sw: {
    dashboard: "Muhtasari", ai: "Msaidizi AI", products: "Bidhaa", categories: "Makundi ya bidhaa", inventory: "Stoo", sales: "Mauzo na POS", exchanges: "Mabadilishano maalum", purchases: "Manunuzi", customers: "Wateja", debts: "Madeni ya wateja", expenses: "Matumizi", reports: "Ripoti", staff: "Wafanyakazi na ruhusa", notifications: "Taarifa", audit: "Historia ya vitendo", settings: "Mipangilio", receipts: "Risiti",
    overview: "Muhtasari wa biashara", welcome: "Huu hapa ni muonekano wa shughuli za duka lako leo.", todaySales: "Mauzo ya leo", todayProfit: "Faida halisi ya leo", monthSales: "Mauzo ya mwezi", monthProfit: "Faida halisi ya mwezi", expensesMonth: "Matumizi ya mwezi", outstandingDebts: "Madeni ya wateja", stockValue: "Thamani ya stoo", lowStock: "Bidhaa zinazoelekea kuisha", expiry: "Zinazokaribia ku-expire", expired: "Bidhaa zilizo-expire", bestSellers: "Bidhaa zinazouzwa zaidi", recentActivity: "Shughuli za hivi karibuni", importantNotices: "Taarifa muhimu",
    salesHistory: "Historia ya mauzo", backToPos: "Rudi POS", reviewSales: "Kagua kila mauzo na bidhaa zilizorekodiwa katika muamala husika.", fromDate: "Kuanzia tarehe", toDate: "Hadi tarehe", searchSales: "Tafuta risiti, mteja, mhudumu au bidhaa", applyFilters: "Tumia vichujio", today: "Leo", productsSold: "Bidhaa zilizouzwa", saleTotal: "Jumla ya mauzo", amountPaid: "Kiasi kilicholipwa", outstanding: "Salio", saleType: "Aina ya mauzo", viewSaleDetails: "Angalia maelezo ya mauzo", noSalesFound: "Hakuna mauzo yaliyopatikana kwa vichujio hivi.", tryDateRange: "Jaribu kipindi kingine au futa utafutaji.", previous: "Iliyotangulia", next: "Inayofuata", recordedActions: "Vitendo vilivyorekodiwa", searchEvents: "Tafuta vitendo", actionType: "Aina ya kitendo", allActions: "Vitendo vyote", allUsers: "Watumiaji wote", clear: "Futa vichujio", noAuditEvents: "Hakuna tukio linalolingana na vichujio hivi.", details: "Maelezo", businessProtection: "Ulinzi wa taarifa za biashara", readOnlyAI: "Msaidizi wa biashara · Kusoma tu", mobileReadOnly: "Dashboard ya mmiliki kwenye simu · Kusoma tu", desktopRequired: "Tumia desktop au laptop kusimamia biashara.", search: "Tafuta", add: "Ongeza", save: "Hifadhi", cancel: "Ghairi", signOut: "Toka", english: "English", swahili: "Kiswahili", noRecords: "Hakuna taarifa bado.", accessDenied: "Huna ruhusa ya kuona sehemu hii.",
  },
} satisfies Record<Locale, Record<string, string>>;

export function t(locale: Locale, key: keyof typeof messages.en): string {
  return messages[locale][key] ?? messages.en[key];
}

export async function getLocale(): Promise<Locale> {
  const { cookies } = await import("next/headers");
  const cookieValue = (await cookies()).get("pc_locale")?.value;
  if (cookieValue === "sw" || cookieValue === "en") return cookieValue;
  const { getSession } = await import("@/lib/auth");
  const session = await getSession();
  return session?.language === "sw" ? "sw" : "en";
}
