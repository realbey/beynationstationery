/* =====================================================================
   Bilingual dictionary: English (en) + Kiswahili (sw)
   Format: [key, English, Kiswahili]
   t(key) -> text in current language (falls back to English, then the key)
   updateLanguage(lang) -> re-labels every [data-i18n] / [data-i18n-ph] element
   ===================================================================== */
const TRANSLATIONS = [
  // ---- navigation ----
  ['nav_dashboard', 'Dashboard', 'Dashibodi'], ['nav_pos', 'Quick Sales (POS)', 'Mauzo ya Haraka (POS)'], ['nav_products', 'Products & Stock', 'Bidhaa & Hisa'],
  ['nav_purchases', 'Purchases', 'Manunuzi'], ['nav_suppliers', 'Suppliers', 'Wasambazaji'], ['nav_sales', 'Sales History', 'Historia ya Mauzo'],
  ['nav_customers', 'Customers', 'Wateja'], ['nav_expenses', 'Expenses', 'Matumizi'], ['nav_budgets', 'Budgets', 'Bajeti'],
  ['nav_finance', 'Profit & Loss', 'Faida & Hasara (P&L)'], ['nav_reports', 'Reports', 'Ripoti'], ['nav_audit', 'Audit Trail', 'Kumbukumbu za Ukaguzi'], ['nav_settings', 'Settings', 'Mipangilio'],
  // ---- login ----
  ['login', 'Login', 'Ingia'], ['logout', 'Logout', 'Toka'], ['email', 'Email', 'Barua Pepe'], ['password', 'Password', 'Nywila'],
  ['welcomeBack', 'Welcome Back', 'Karibu Tena'], ['welcome', 'Welcome back', 'Karibu tena'], ['loginSub', 'Sign in to your business account', 'Ingia kwenye akaunti ya biashara'],
  ['tagline', 'Complete Business Management System', 'Mfumo Kamili wa Usimamizi wa Biashara'],
  ['f1', 'Quick Sales (POS)', 'Mauzo ya Haraka (POS)'], ['f2', 'Product & Stock Management', 'Usimamizi wa Bidhaa & Hisa'], ['f3', 'Business Expenses', 'Matumizi ya Biashara'], ['f4', 'Profit & Loss Reports', 'Ripoti ya Faida & Hasara (P&L)'],
  // ---- common ----
  ['action', 'Action', 'Kitendo'], ['active', 'Active', 'Inapatikana'], ['inactive', 'Inactive', 'Haitumiki'], ['add', 'Add', 'Ongeza'], ['all', 'All', 'Zote'],
  ['allCategories', 'All categories', 'Kategoria zote'], ['allModules', 'All modules', 'Sehemu zote'], ['allStatus', 'All statuses', 'Hali zote'], ['allTime', 'All time', 'Tangu mwanzo'],
  ['amount', 'Amount', 'Kiasi'], ['address', 'Address', 'Anwani'], ['balance', 'Balance', 'Salio'], ['cancel', 'Cancel', 'Ghairi'], ['close', 'Close', 'Funga'], ['confirm', 'Confirm', 'Thibitisha'],
  ['confirmDelete', 'Delete this item?', 'Futa kipengee hiki?'], ['company', 'Company', 'Kampuni'], ['date', 'Date', 'Tarehe'], ['description', 'Description', 'Maelezo'], ['details', 'Details', 'Maelezo zaidi'],
  ['from', 'From', 'Kuanzia'], ['to', 'To', 'Hadi'], ['in', 'In', 'Ndani'], ['out', 'Out', 'Nje'], ['items', 'items', 'vipengee'], ['module', 'Module', 'Sehemu'], ['name', 'Name', 'Jina'],
  ['net', 'Net', 'Jumla'], ['noData', 'Nothing here yet', 'Hakuna data bado'], ['notes', 'Notes', 'Maelezo ya ziada'], ['number', 'Number', 'Namba'], ['phone', 'Phone', 'Simu'],
  ['qty', 'Qty', 'Idadi'], ['reason', 'Reason', 'Sababu'], ['remove', 'Remove', 'Ondoa'], ['retry', 'Retry', 'Jaribu tena'], ['rows', 'rows', 'safu'], ['save', 'Save', 'Hifadhi'], ['saved', 'Saved', 'Imehifadhiwa'],
  ['search', 'Search', 'Tafuta'], ['status', 'Status', 'Hali'], ['total', 'Total', 'Jumla'], ['type', 'Type', 'Aina'], ['user', 'User', 'Mtumiaji'], ['method', 'Method', 'Njia'], ['period', 'Period', 'Kipindi'],
  ['before', 'Before', 'Kabla'], ['after', 'After', 'Baada'], ['line', 'Line', 'Mstari'], ['problems', 'Problems', 'Matatizo'], ['exportCsv', 'Export CSV', 'Pakua CSV'], ['print', 'Print', 'Chapisha'],
  ['errDuplicate', 'That value already exists (duplicate SKU, barcode or name)', 'Thamani hiyo tayari ipo (SKU, barcode au jina limejirudia)'],
  ['errInUse', 'Cannot delete: it is used elsewhere', 'Haiwezi kufutwa: inatumika sehemu nyingine'],
  ['errPermission', 'You do not have permission for this action', 'Huna ruhusa ya kufanya kitendo hiki'],
  // ---- roles / payment methods / periods ----
  ['role_ADMIN', 'Admin / Owner', 'Admin / Mmiliki'], ['role_MANAGER', 'Manager', 'Meneja'], ['role_CASHIER', 'Cashier', 'Keshia'], ['role_STOREKEEPER', 'Storekeeper', 'Mtunza Stoo'],
  ['pm_CASH', 'Cash', 'Taslimu'], ['pm_MPESA', 'M-Pesa', 'M-Pesa'], ['pm_AIRTEL_MONEY', 'Airtel Money', 'Airtel Money'], ['pm_TIGO_PESA', 'Tigo Pesa (Mixx)', 'Tigo Pesa (Mixx)'], ['pm_BANK', 'Bank', 'Benki'], ['pm_OTHER', 'Other', 'Nyingine'],
  ['r_today', 'Today', 'Leo'], ['r_yesterday', 'Yesterday', 'Jana'], ['r_week', 'This week', 'Wiki hii'], ['r_month', 'This month', 'Mwezi huu'], ['r_year', 'This year', 'Mwaka huu'], ['r_custom', 'Custom dates', 'Chagua tarehe'],
  ['st_PAID', 'Paid', 'Imelipwa'], ['st_PARTIAL', 'Part paid', 'Imelipwa nusu'], ['st_CREDIT', 'Credit', 'Mkopo'], ['st_UNPAID', 'Unpaid', 'Haijalipwa'],
  ['u_Piece', 'Piece', 'Kipande'], ['u_Box', 'Box', 'Boksi'], ['u_Packet', 'Packet', 'Pakiti'], ['u_Ream', 'Ream', 'Rimu'], ['u_Carton', 'Carton', 'Katoni'], ['u_Bottle', 'Bottle', 'Chupa'], ['u_Dozen', 'Dozen', 'Dazeni'], ['u_Set', 'Set', 'Seti'], ['u_Other', 'Other', 'Nyingine'],
  ['ct_RETAIL', 'Retail', 'Rejareja'], ['ct_WHOLESALE', 'Wholesale', 'Jumla'], ['ct_SCHOOL', 'School', 'Shule'], ['ct_OFFICE', 'Office', 'Ofisi'],
  ['mv_ADJUSTMENT', 'Adjustment', 'Marekebisho'], ['mv_DAMAGE', 'Damaged / lost', 'Imeharibika / imepotea'],
  ['tt_SALE', 'Sale', 'Mauzo'], ['tt_PURCHASE', 'Purchase', 'Manunuzi'], ['tt_EXPENSE', 'Expense', 'Matumizi'], ['tt_CUSTOMER_PAYMENT', 'Customer payment', 'Malipo ya mteja'],
  ['tt_SUPPLIER_PAYMENT', 'Supplier payment', 'Malipo kwa msambazaji'], ['tt_OTHER_INCOME', 'Other income', 'Mapato mengine'], ['tt_OTHER_EXPENSE', 'Other expense', 'Matumizi mengine'], ['tt_REFUND', 'Refund', 'Marejesho'],
  ['ec_Rent', 'Rent', 'Kodi ya pango'], ['ec_Salaries', 'Salaries', 'Mishahara'], ['ec_Electricity', 'Electricity', 'Umeme'], ['ec_Water', 'Water', 'Maji'], ['ec_Transport', 'Transport', 'Usafiri'],
  ['ec_Internet', 'Internet & airtime', 'Intaneti & muda wa maongezi'], ['ec_Tax', 'Tax', 'Kodi'], ['ec_Repairs', 'Repairs', 'Matengenezo'], ['ec_Marketing', 'Marketing', 'Matangazo'], ['ec_Supplies', 'Supplies', 'Vifaa'], ['ec_Other', 'Other', 'Nyingine'],
  ['bp_WEEKLY', 'Weekly', 'Wiki'], ['bp_MONTHLY', 'Monthly', 'Mwezi'], ['bp_YEARLY', 'Yearly', 'Mwaka'], ['bp_CUSTOM', 'Custom', 'Maalum'],
  ['mod_sales', 'Sales', 'Mauzo'], ['mod_products', 'Products', 'Bidhaa'], ['mod_customers', 'Customers', 'Wateja'], ['mod_suppliers', 'Suppliers', 'Wasambazaji'], ['mod_purchases', 'Purchases', 'Manunuzi'],
  ['mod_expenses', 'Expenses', 'Matumizi'], ['mod_budgets', 'Budgets', 'Bajeti'], ['mod_categories', 'Categories', 'Kategoria'], ['mod_business_settings', 'Settings', 'Mipangilio'],
  ['rep_sales', 'Sales', 'Mauzo'], ['rep_inventory', 'Inventory', 'Bidhaa & Hisa'], ['rep_expenses', 'Expenses', 'Matumizi'], ['rep_pnl', 'Profit & Loss', 'Faida & Hasara'], ['rep_performance', 'Best & slow sellers', 'Zinazouzwa vizuri & polepole'], ['rep_closing', 'Daily closing', 'Kufunga siku'],
  // ---- dashboard ----
  ['salesToday', 'Sales today', 'Mauzo leo'], ['salesWord', 'sales', 'mauzo'], ['revenue', 'Revenue', 'Mapato'], ['netProfit', 'Net profit', 'Faida halisi'], ['grossProfit', 'Gross profit', 'Faida ghafi'],
  ['custCredit', 'Customer credit', 'Madeni ya wateja'], ['todaySales', "Today's sales", 'Mauzo ya leo'], ['weekSales', 'This week', 'Wiki hii'], ['monthSales', 'This month', 'Mwezi huu'], ['cashBalance', 'Cash balance', 'Salio la fedha'],
  ['selectedPeriod', 'Selected period', 'Kipindi kilichochaguliwa'], ['refunds', 'Refunds', 'Marejesho'], ['margin', 'Margin', 'Faida (%)'], ['expenses', 'Expenses', 'Matumizi'], ['afterExpenses', 'After expenses', 'Baada ya matumizi'],
  ['supplierDue', 'Owed to suppliers', 'Deni kwa wasambazaji'], ['stockHealth', 'Stock health', 'Afya ya hisa'], ['lowStock', 'Low stock', 'Hisa ndogo'], ['outStock', 'Out of stock', 'Imeisha'], ['stockValue', 'Stock value', 'Thamani ya hisa'],
  ['revVsExp', 'Revenue vs expenses', 'Mapato dhidi ya matumizi'], ['byCategory', 'By category', 'Kwa kategoria'], ['uncategorised', 'Uncategorised', 'Bila kategoria'], ['salesTrend', 'Sales trend', 'Mwelekeo wa mauzo'],
  ['topProducts', 'Top products', 'Bidhaa zinazoongoza'], ['noSales', 'No sales yet', 'Hakuna mauzo bado'], ['lowStockAlerts', 'Low-stock alerts', 'Tahadhari za hisa ndogo'], ['minimum', 'Minimum', 'Kiwango cha chini'],
  ['stockOk', 'All products have enough stock', 'Bidhaa zote zina hisa ya kutosha'], ['quickActions', 'Quick actions', 'Njia za haraka'], ['stock', 'Stock', 'Hisa'],
  // ---- POS ----
  ['searchScan', 'Search product or scan barcode', 'Tafuta bidhaa au skani barcode'], ['cart', 'Cart', 'Kikapu'], ['cartEmpty', 'Cart is empty', 'Kikapu ni tupu'], ['customer', 'Customer', 'Mteja'],
  ['walkIn', 'Walk-in customer', 'Mteja wa kawaida'], ['discount', 'Discount', 'Punguzo'], ['addTax', 'Add tax', 'Ongeza kodi'], ['tax', 'Tax', 'Kodi'], ['subtotal', 'Subtotal', 'Jumla ndogo'],
  ['pay', 'Pay', 'Lipa'], ['clearCart', 'Clear cart', 'Futa kikapu'], ['notFound', 'Product not found', 'Bidhaa haipatikani'], ['stockLimit', 'Not enough stock', 'Hisa haitoshi'],
  ['refineSearch', 'Showing the first 60 — refine your search', 'Zinaonyeshwa 60 za kwanza — boresha utafutaji'], ['payment', 'Payment', 'Malipo'], ['reference', 'Reference', 'Kumbukumbu'],
  ['addMethod', 'Add payment method', 'Ongeza njia ya malipo'], ['sellOnCredit', 'Sell on credit', 'Uza kwa mkopo'], ['paid', 'Paid', 'Imelipwa'], ['creditBalance', 'Credit balance', 'Deni'],
  ['overpaid', 'Overpaid', 'Imezidi'], ['creditNeedsCustomer', 'Select a customer to sell on credit', 'Chagua mteja ili kuuza kwa mkopo'], ['creditTo', 'Credit to', 'Deni kwa'],
  ['cashReceived', 'Cash received', 'Fedha taslimu zilizopokelewa'], ['change', 'Change', 'Chenji'], ['confirmSale', 'Confirm sale', 'Thibitisha mauzo'], ['saleDone', 'Sale completed', 'Mauzo yamekamilika'],
  ['receipt', 'Receipt', 'Risiti'], ['cashier', 'Cashier', 'Keshia'], ['voided', 'Voided', 'Imebatilishwa'],
  // ---- products ----
  ['addProduct', 'Add product', 'Ongeza bidhaa'], ['editProduct', 'Edit product', 'Hariri bidhaa'], ['importCsv', 'Import CSV', 'Leta CSV'], ['categories', 'Categories', 'Kategoria'], ['category', 'Category', 'Kategoria'],
  ['categoryName', 'Category name', 'Jina la kategoria'], ['buyPrice', 'Buying price', 'Bei ya kununua'], ['price', 'Price', 'Bei'], ['barcode', 'Barcode', 'Barcode'], ['supplier', 'Supplier', 'Msambazaji'], ['unit', 'Unit', 'Kipimo'],
  ['openingStock', 'Opening stock', 'Hisa ya kuanzia'], ['autoIfEmpty', 'Auto if empty', 'Otomatiki ukiacha wazi'], ['sellBelowCost', 'The selling price is below the buying price. Save anyway?', 'Bei ya kuuza iko chini ya bei ya kununua. Hifadhi hata hivyo?'],
  ['adjustStock', 'Adjust stock', 'Rekebisha hisa'], ['qtyChange', 'Quantity change', 'Mabadiliko ya idadi'], ['qtyZero', 'Quantity cannot be zero', 'Idadi haiwezi kuwa sifuri'],
  ['adjustHint', 'Use + to add stock and − to remove. Damaged always removes stock.', 'Tumia + kuongeza hisa na − kupunguza. Iliyoharibika hupunguza hisa kila mara.'],
  ['importHelp', 'Columns: name and selling_price are required; sku, barcode, category, buying_price, stock, minimum_stock, unit, description are optional.', 'Safu: name na selling_price ni lazima; sku, barcode, category, buying_price, stock, minimum_stock, unit, description si lazima.'],
  ['downloadTemplate', 'Download template', 'Pakua kiolezo'], ['fileTooBig', 'File is too large (max 5 MB)', 'Faili ni kubwa mno (kiwango 5 MB)'], ['csvEmpty', 'The file has no data rows', 'Faili halina data'],
  ['csvHeaders', 'Missing columns: name and selling_price are required', 'Safu zinazohitajika hazipo: name na selling_price'], ['rowsReady', 'rows ready', 'safu tayari'], ['rowsErrors', 'rows with errors', 'safu zenye makosa'],
  ['importNow', 'Import', 'Leta sasa'], ['imported', 'products imported', 'bidhaa zimeletwa'],
  ['e_name', 'name missing', 'jina halipo'], ['e_sell', 'invalid selling price', 'bei ya kuuza si sahihi'], ['e_buy', 'invalid buying price', 'bei ya kununua si sahihi'], ['e_stock', 'invalid stock', 'hisa si sahihi'],
  ['e_min', 'invalid minimum stock', 'hisa ya chini si sahihi'], ['e_unit', 'unknown unit', 'kipimo hakijulikani'], ['e_dupSku', 'duplicate SKU', 'SKU imejirudia'], ['e_dupBc', 'duplicate barcode', 'barcode imejirudia'],
  // ---- sales history ----
  ['searchReceipt', 'Search receipt or customer', 'Tafuta risiti au mteja'], ['return', 'Return', 'Rudisha'], ['void', 'Void', 'Batilisha'], ['product', 'Product', 'Bidhaa'], ['sold', 'Sold', 'Imeuzwa'],
  ['alreadyReturned', 'Already returned', 'Tayari imerudishwa'], ['returnQty', 'Return qty', 'Idadi ya kurudisha'], ['refundMethod', 'Refund method', 'Njia ya kurejesha pesa'],
  ['returnHint', 'Stock is restored. For credit customers the refund first reduces their debt; the rest is paid back.', 'Hisa hurudishwa. Kwa wateja wa mkopo, kiasi hupunguza deni kwanza; kilichobaki hurejeshwa.'],
  ['nothingToReturn', 'Enter a quantity to return', 'Weka idadi ya kurudisha'], ['returned', 'Returned', 'Imerudishwa'], ['offsetDebt', 'settled against debt', 'imekatwa kwenye deni'],
  ['voidWarn', 'This reverses the stock and the payments. It cannot be undone.', 'Hii hurudisha hisa na malipo. Haiwezi kutenduliwa.'], ['voidDone', 'Sale voided', 'Mauzo yamebatilishwa'],
  // ---- customers / suppliers / purchases ----
  ['addCustomer', 'Add customer', 'Ongeza mteja'], ['editCustomer', 'Edit customer', 'Hariri mteja'], ['creditLimit', 'Credit limit', 'Kikomo cha deni'], ['limitHint', '0 = no limit', '0 = hakuna kikomo'],
  ['owes', 'Owes', 'Anadaiwa'], ['receivePayment', 'Receive payment', 'Pokea malipo'], ['statement', 'Statement', 'Taarifa'], ['payments', 'Payments', 'Malipo'],
  ['addSupplier', 'Add supplier', 'Ongeza msambazaji'], ['editSupplier', 'Edit supplier', 'Hariri msambazaji'], ['balanceDue', 'Balance due', 'Deni linalodaiwa'], ['paySupplier', 'Pay supplier', 'Lipa msambazaji'], ['ledger', 'Ledger', 'Leja'],
  ['newPurchase', 'New purchase', 'Manunuzi mapya'], ['po', 'Purchase order', 'Oda ya manunuzi'], ['addLine', 'Add item', 'Ongeza bidhaa'], ['paidNow', 'Paid now', 'Imelipwa sasa'], ['addProductsFirst', 'Add products first', 'Ongeza bidhaa kwanza'],
  ['invalidLines', 'Check quantities and prices', 'Angalia idadi na bei'],
  ['purchaseHint', "Stock increases and the buying price updates to the new price. Unpaid amounts are added to the supplier's balance.", 'Hisa huongezeka na bei ya kununua husasishwa. Kiasi ambacho hakijalipwa huongezwa kwenye deni la msambazaji.'],
  // ---- expenses / budgets ----
  ['addExpense', 'Add expense', 'Ongeza matumizi'], ['chooseOrType', 'Choose or type', 'Chagua au andika'], ['expenseHint', 'Recorded expenses reduce your cash balance automatically.', 'Matumizi yaliyorekodiwa hupunguza salio la fedha moja kwa moja.'],
  ['addBudget', 'Add budget', 'Ongeza bajeti'], ['editBudget', 'Edit budget', 'Hariri bajeti'], ['budgetAmount', 'Budget amount', 'Kiasi cha bajeti'], ['noBudgets', 'No budgets yet', 'Hakuna bajeti bado'],
  ['budgetHint', 'Spending is counted from recorded expenses in the same category and period.', 'Matumizi huhesabiwa kutoka kwa matumizi yaliyorekodiwa kwenye kategoria na kipindi hicho.'],
  ['overBudget', 'Over budget by', 'Umevuka bajeti kwa'], ['nearBudget', 'Approaching the budget limit', 'Unakaribia kikomo cha bajeti'], ['remaining', 'Remaining', 'Kilichobaki'], ['badDates', 'End date must not be before start date', 'Tarehe ya mwisho isiwe kabla ya ya kuanza'],
  // ---- finance / reports ----
  ['pnl', 'Profit & Loss', 'Faida & Hasara'], ['cashFlow', 'Cash flow', 'Mtiririko wa fedha'], ['salesAfterDiscount', 'Sales (after discounts)', 'Mauzo (baada ya punguzo)'], ['netRevenue', 'Net revenue', 'Mapato halisi'],
  ['cogs', 'Cost of goods sold', 'Gharama ya bidhaa zilizouzwa'], ['opex', 'Operating expenses', 'Gharama za uendeshaji'], ['avgSale', 'Average sale', 'Wastani wa mauzo'], ['discounts', 'Discounts given', 'Punguzo lililotolewa'],
  ['taxCollected', 'Tax collected', 'Kodi iliyokusanywa'], ['cashIn', 'Cash in', 'Fedha zilizoingia'], ['cashOut', 'Cash out', 'Fedha zilizotoka'], ['openingBalance', 'Opening balance', 'Salio la kufungua'],
  ['closingBalance', 'Closing balance', 'Salio la kufunga'], ['showingLast', 'Showing last', 'Inaonyesha za mwisho'], ['showingFirst', 'Showing first', 'Inaonyesha za kwanza'], ['exportForAll', 'export CSV for the full list', 'pakua CSV kupata orodha kamili'],
  ['byPayment', 'By payment method', 'Kwa njia ya malipo'], ['byCashier', 'By cashier', 'Kwa keshia'], ['onlyLow', 'Only low stock', 'Hisa ndogo tu'], ['retailValue', 'Retail value', 'Thamani ya rejareja'],
  ['potentialProfit', 'Potential profit', 'Faida inayotarajiwa'], ['products', 'Products', 'Bidhaa'], ['bestSellers', 'Best sellers', 'Zinazouzwa zaidi'], ['slowMovers', 'Slow movers', 'Zinazouzwa polepole'],
  ['slowHint', 'In stock but not sold in this period', 'Ziko stoo lakini hazijauzwa kwenye kipindi hiki'], ['tiedUp', 'Money tied up', 'Mtaji uliokwama'],
  ['expectedCash', 'Expected cash in drawer', 'Fedha taslimu zinazotarajiwa'], ['countedCash', 'Counted cash', 'Fedha zilizohesabiwa'], ['difference', 'Difference', 'Tofauti'],
  // ---- settings / audit ----
  ['business', 'Business', 'Biashara'], ['businessName', 'Business name', 'Jina la biashara'], ['currency', 'Currency', 'Sarafu'], ['taxRate', 'Default tax rate', 'Kiwango cha kodi'], ['receiptFooter', 'Receipt footer', 'Ujumbe wa chini wa risiti'],
  ['logo', 'Logo', 'Nembo'], ['imgHint', 'PNG, JPG or WebP, up to 2 MB', 'PNG, JPG au WebP, hadi MB 2'], ['imgSize', 'Image is larger than 2 MB', 'Picha ni kubwa kuliko MB 2'], ['imgType', 'Use a PNG, JPG or WebP image', 'Tumia picha ya PNG, JPG au WebP'],
  ['myProfile', 'My profile', 'Wasifu wangu'], ['avatar', 'Profile photo', 'Picha ya wasifu'], ['backup', 'Backup', 'Hifadhi nakala'], ['exportAll', 'Export everything', 'Pakua kila kitu'], ['backupDone', 'Backup finished', 'Nakala imekamilika'],
  ['backupHint', 'Download your data as CSV files (one per table). Keep them somewhere safe.', 'Pakua data yako kama mafaili ya CSV (faili moja kwa kila jedwali). Yahifadhi mahali salama.']
];
const I18N = { en: {}, sw: {} };
TRANSLATIONS.forEach(([k, en, sw]) => { I18N.en[k] = en; I18N.sw[k] = sw; });

let LANG = 'sw';
try { LANG = localStorage.getItem('lang') || 'sw'; } catch (e) { /* storage may be blocked */ }
if (!I18N[LANG]) LANG = 'sw';
const t = k => (I18N[LANG] && I18N[LANG][k]) || I18N.en[k] || k;
function updateLanguage(l) {
  LANG = I18N[l] ? l : 'sw';
  try { localStorage.setItem('lang', LANG); } catch (e) { /* ignore */ }
  document.documentElement.lang = LANG;
  document.querySelectorAll('[data-i18n]').forEach(e => { e.textContent = t(e.dataset.i18n); });
  document.querySelectorAll('[data-i18n-ph]').forEach(e => { e.placeholder = t(e.dataset.i18nPh); });
}
