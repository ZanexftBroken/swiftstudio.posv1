export type Language = "en" | "my";

export const translations = {
  en: {
    // General
    storeName: "Store Name",
    username: "Username",
    password: "Password",
    login: "Log In",
    loggingIn: "Logging in...",
    logout: "Log Out",
    cancel: "Cancel",
    save: "Save",
    saving: "Saving...",
    add: "Add",
    delete: "Delete",
    edit: "Edit",
    search: "Search product...",
    settings: "Settings",
    back: "Back",
    clear: "Clear",
    ok: "OK",
    success: "Success",
    error: "Error",
    loading: "Loading...",
    
    // Login Screen
    loginTitle: "Swift POS",
    loginSubtitle: "Enterprise Management",
    loginErr: "Login failed. Please check your credentials.",
    loginPlaceholder: "Login username...",
    passwordPlaceholder: "Password...",
    licenseExpired: "Your license key has expired. Please contact support.",
    
    // Header
    workspace: "Swift Workspace",
    systemSettings: "System Settings",
    
    // Dashboard Stats
    todaySales: "Today's Sales",
    codPending: "Pending COD",
    totalCustomers: "Total Customers",
    quickOps: "Quick Operations",
    otherSecs: "Other Sections",
    newSale: "New Sale (POS)",
    salesRecords: "Sales Records",
    purchasedItems: "Purchased Items",
    codTracking: "COD Tracking",
    products: "Products",
    salesSummary: "Sales Summary",
    generalExpenses: "General Expenses",
    staffPayroll: "Staff Payroll",
    customersList: "Customers List",
    suppliers: "Suppliers",
    stockAdjust: "Stock Adjustment",
    staffAttendance: "Staff Shift Logs",
    aiAnalyst: "AI Business Analyst",
    posBannerTitle: "Are you ready?",
    posBannerSub: "Open POS and enter customer orders.",
    posBannerBtn: "Open POS",
    
    // Products Inventory View
    addProduct: "Add New Product",
    category: "Category",
    barcodeSku: "Barcode / SKU",
    costPrice: "Cost Price",
    retailPrice: "Retail Price",
    wholesalePrice: "Wholesale Price",
    stockQty: "Stock Quantity",
    lowThreshold: "Low Stock Alert Limit",
    allCategories: "All",
    searchPlaceholder: "Search by product name...",
    lowStockLabel: "Low Stock",
    retailLabel: "Retail",
    stockLabel: "Stock",
    
    // Reports View
    netProfit: "Net Profit",
    totalRevenue: "Total Revenue",
    totalCost: "Total Cost",
    paymentMethod: "Payment Method",
    
    // Modals
    addCustomer: "Register New Customer",
    customerName: "Name *",
    customerPhone: "Phone Number",
    customersListLabel: "Customers Directory",
    noDebt: "No Debt",
    clearDebt: "Clear Debt",
    debtLeft: "Ks Debt Left",
    supplierName: "Supplier Name...",
    supplierDebt: "Ks Debt Left",
    shiftsClock: "Staff Attendance Logs",
    shiftsClockIn: "Clock In",
    shiftsClockInSuccess: "Clock In successful.",
    shiftsClockOut: "Clock Out",
    shiftsClockOutSuccess: "Clock Out successful.",
    shiftsNoLogs: "No shift logs recorded.",
    voucherHistory: "Voucher Sales History",
    deleteVoucherConfirm: "Are you sure you want to delete this voucher?",
    
    // Finance Manager
    expense: "Expenses",
    payroll: "Payroll",
    purchases: "Purchases",
    financeDescPlaceholder: "Description...",
    financeDescStaffPlaceholder: "Staff Name...",
    financeDescItemPlaceholder: "Purchased Item...",
    financeAmountPlaceholder: "Amount (Ks)",
    financeAddBtn: "Add Item",
    deleteConfirm: "Are you sure you want to delete this item?",
    
    // Stock Adjust Modal
    selectProduct: "Select Product...",
    newQuantity: "New Quantity...",
    adjustBtn: "Adjust",
    adjustSuccess: "New stock quantity updated successfully.",
    
    // Low Stock Alert Modal
    lowStockTitle: "Low Stock Alerts",
    itemsLeft: "items left",
    noLowStock: "No low stock products.",
    
    // Theme Selector
    themeLabel: "System UI Theme",
    
    // Registration
    signUp: "Sign Up",
    signingUp: "Signing up...",
    noAccount: "Don't have an account? Sign Up",
    haveAccount: "Already have an account? Log In",
    registerTitle: "Create Store Account",
    registerSuccess: "Account registered successfully!"
  },
  my: {
    // General
    storeName: "ဆိုင်အမည်",
    username: "အသုံးပြုသူအမည်",
    password: "လျှို့ဝှက်နံပါတ်",
    login: "ဝင်ရောက်မည်",
    loggingIn: "ခေတ္တစောင့်ဆိုင်းပါ...",
    logout: "ထွက်မည်",
    cancel: "ပယ်ဖျက်မည်",
    save: "သိမ်းဆည်းမည်",
    saving: "သိမ်းဆည်းနေပါသည်...",
    add: "ပေါင်းထည့်မည်",
    delete: "ဖျက်မည်",
    edit: "ပြင်ဆင်မည်",
    search: "ကုန်ပစ္စည်း ရှာရန်...",
    settings: "ဆက်တင်များ",
    back: "နောက်သို့",
    clear: "ရှင်းလင်းမည်",
    ok: "အိုကေ",
    success: "အောင်မြင်ပါသည်",
    error: "အမှားအယွင်းရှိပါသည်",
    loading: "လုပ်ဆောင်နေပါသည်...",
    
    // Login Screen
    loginTitle: "Swift POS",
    loginSubtitle: "စီးပွားရေးလုပ်ငန်း စီမံခန့်ခွဲမှုစနစ်",
    loginErr: "လော့ဂ်အင် အဆင်မပြေပါ။ အကောင့်အချက်အလက်များကို ပြန်စစ်ပါ။",
    loginPlaceholder: "လော့ဂ်အင်အမည်...",
    passwordPlaceholder: "လျှို့ဝှက်နံပါတ်...",
    licenseExpired: "လိုင်စင်သက်တမ်း ကုန်ဆုံးသွားပါပြီ။ ကျေးဇူးပြု၍ ဆက်သွယ်ပါ။",
    
    // Header
    workspace: "Swift Workspace",
    systemSettings: "စနစ် ဆက်တင်များ",
    
    // Dashboard Stats
    todaySales: "ယနေ့ရောင်းရငွေ",
    codPending: "COD ကောက်ခံရန်",
    totalCustomers: "ဝယ်ယူသူစုစုပေါင်း",
    quickOps: "အဓိက လုပ်ငန်းစဉ်များ",
    otherSecs: "အခြား ကဏ္ဍများ",
    newSale: "အရောင်းဖွင့်မည် (POS)",
    salesRecords: "အရောင်းမှတ်တမ်းများ",
    purchasedItems: "ဝယ်ယူထားသည့်ပစ္စည်းများ",
    codTracking: "COD လိုက်လံစောင့်ကြည့်ခြင်း",
    products: "ကုန်ပစ္စည်းများ",
    salesSummary: "ရောင်းအားအကျဉ်း",
    generalExpenses: "အထွေထွေအသုံးစရိတ်",
    staffPayroll: "ဝန်ထမ်းလစာပေးမှု",
    customersList: "ဝယ်ယူသူစာရင်း",
    suppliers: "ဆပ်ပလိုင်ယာများ",
    stockAdjust: "စတော့ချိန်ညှိမှု",
    staffAttendance: "ဝန်ထမ်းအဝင်အထွက်",
    aiAnalyst: "AI Business Analyst",
    posBannerTitle: "အဆင်သင့်ဖြစ်ပြီလား?",
    posBannerSub: "ငွေကောက်ခံစနစ် (POS) ကိုဖွင့်ပြီး အော်ဒါများတင်သွင်းပါ။",
    posBannerBtn: "အရောင်းကောင်တာ ဖွင့်မည်",
    
    // Products Inventory View
    addProduct: "ကုန်ပစ္စည်းအသစ် ထည့်မည်",
    category: "အုပ်စု",
    barcodeSku: "Barcode / SKU",
    costPrice: "ရင်းဈေး",
    retailPrice: "လက်လီဈေး *",
    wholesalePrice: "လက်ကားဈေး",
    stockQty: "စတော့အရေအတွက် *",
    lowThreshold: "စတော့အချက်ပေးစနစ် ကန့်သတ်ချက်",
    allCategories: "အားလုံး",
    searchPlaceholder: "ကုန်ပစ္စည်း ရှာရန်...",
    lowStockLabel: "စတော့နည်းနေသည်",
    retailLabel: "လက်လီ",
    stockLabel: "လက်ကျန်",
    
    // Reports View
    netProfit: "အသားတင် အမြတ် (Net Profit)",
    totalRevenue: "စုစုပေါင်းရောင်းရငွေ",
    totalCost: "စုစုပေါင်းကုန်ကျစရိတ်",
    paymentMethod: "ငွေပေးချေမှုပုံစံ",
    
    // Modals
    addCustomer: "ဝယ်သူအသစ်မှတ်ပုံတင်မည်",
    customerName: "အမည် *",
    customerPhone: "ဖုန်းနံပါတ်",
    customersListLabel: "ဝယ်သူများစာရင်း",
    noDebt: "ကြွေးမရှိပါ",
    clearDebt: "အကြေဆပ်",
    debtLeft: "Ks ကျန်",
    supplierName: "ဆပ်ပလိုင်ယာအမည်...",
    supplierDebt: "Ks ကြွေးကျန်",
    shiftsClock: "ဝန်ထမ်းအဝင်အထွက်",
    shiftsClockIn: "Clock In (အလုပ်ဝင်)",
    shiftsClockInSuccess: "Clock In အောင်မြင်ပါသည်။",
    shiftsClockOut: "Clock Out (အလုပ်ထွက်)",
    shiftsClockOutSuccess: "Clock Out အောင်မြင်ပါသည်။",
    shiftsNoLogs: "အလုပ်ဆင်းမှတ်တမ်းမရှိပါ။",
    voucherHistory: "ဘောက်ချာမှတ်တမ်းစာရင်း",
    deleteVoucherConfirm: "ဘောက်ချာဖျက်ပစ်ရန် သေချာပါသလား?",
    
    // Finance Manager
    expense: "စရိတ် (Expenses)",
    payroll: "လစာပေးချေမှု (Payroll)",
    purchases: "ကုန်ပစ္စည်းဝယ်ယူမှု (Purchases)",
    financeDescPlaceholder: "အကြောင်းအရာ...",
    financeDescStaffPlaceholder: "ဝန်ထမ်းအမည်...",
    financeDescItemPlaceholder: "ဝယ်ယူသည့်ပစ္စည်း...",
    financeAmountPlaceholder: "ပမာဏ (Ks)",
    financeAddBtn: "ပေါင်းမည်",
    deleteConfirm: "အချက်အလက်ကို ဖျက်ပစ်ပါမည်လား?",
    
    // Stock Adjust Modal
    selectProduct: "ကုန်ပစ္စည်း ရွေးချယ်ပါ...",
    newQuantity: "အရေအတွက်အသစ်...",
    adjustBtn: "ပြင်မည်",
    adjustSuccess: "စတော့အသစ် သတ်မှတ်ပြီးပါပြီ။",
    
    // Low Stock Alert Modal
    lowStockTitle: "လက်ကျန်နည်းသောပစ္စည်းများ",
    itemsLeft: "ခုကျန်",
    noLowStock: "လက်ကျန်နည်းသောပစ္စည်း မရှိပါ။",
    
    // Theme Selector
    themeLabel: "စနစ် UI သီးမ် (System UI Theme)",
    
    // Registration
    signUp: "အကောင့်ဖွင့်မည်",
    signingUp: "အကောင့်ဖွင့်နေပါသည်...",
    noAccount: "အကောင့်မရှိသေးပါက အသစ်ဖွင့်ရန်",
    haveAccount: "အကောင့်ရှိပြီးသားဖြစ်ပါက ဝင်ရောက်ရန်",
    registerTitle: "ဆိုင်အကောင့်အသစ်ဖွင့်မည်",
    registerSuccess: "အကောင့်အသစ် ဖွင့်လှစ်ခြင်း အောင်မြင်ပါသည်။"
  }
};
