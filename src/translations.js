// src/translations.js
// UI string dictionary for VI/EN language switching

export const translations = {
  vi: {
    // Brand
    brandName: 'Picker Assistant',

    // Modules
    modulePog: 'POG',
    moduleLoss: 'Check Loss',
    moduleStock: 'Check Stock',
    pogWorkspace: 'Không gian POG',
    lossWorkspace: 'Không gian Check Loss',
    stockWorkspace: 'Không gian Check Stock',

    // Topbar
    searchPogPlaceholder: 'Tìm kiếm...',
    searchStockPlaceholder: 'Tìm kiếm...',
    searchLossPlaceholder: 'Tìm kiếm...',
    systemNotice: 'Thông báo hệ thống',

    // Summary strip
    linesWithData: 'Line có dữ liệu',
    totalSku: 'Tổng SKU',
    currentOpen: 'Đang mở',
    notSelected: 'Chưa chọn',
    searchResults: 'Kết quả tìm',
    savedPeriods: 'Kỳ đã lưu',
    scanningSkus: 'SKU đang quét',
    systemStock: 'Stock hệ thống',
    totalLoss: 'Tổng loss',

    // Buttons
    btnUpdatePog: 'Cập nhật POG',
    btnLogin: 'Đăng nhập',
    btnLogout: 'Đăng xuất',
    btnSettings: 'Cài đặt',
    btnSavePeriod: 'Lưu kỳ loss',
    btnExportExcel: 'Xuất Excel',
    btnResetDraft: 'Làm mới phiếu',
    btnAdd: 'Thêm',
    btnScan: 'Quét',
    btnScanBarcode: 'Quét barcode',
    btnFilter: 'Lọc tìm',
    btnClearFilter: 'Xóa lọc',
    btnSyncFromPDF: 'Đồng bộ từ PDF ngay',
    btnClose: 'Đóng',
    btnCancel: 'Hủy',
    btnSave: 'Lưu',
    btnExporting: 'Đang xuất...',
    btnSaving: 'Đang lưu...',
    btnExportExcelCurrent: 'Xuất Excel phiếu hiện tại',

    // Drawer / Shelf
    drawerLoading: 'Đang đồng bộ dữ liệu line từ máy chủ...',
    productCount: (n) => `${n} sản phẩm`,
    noShelfSelected: 'Chưa chọn khu vực nào',
    noShelfHint: 'Bấm vào một khu vực trên bản đồ để mở danh sách sản phẩm.',
    syncFromPDF: 'Đồng bộ từ PDF ngay',
    noProductData: 'Line này chưa có dữ liệu hàng hóa',
    stockUpdated: (checked, total) => `${checked}/${total} sản phẩm đã cập nhật stock`,
    savingStock: 'Đang lưu',
    stockVerified: 'Đã khớp',
    stockNotVerified: 'Chưa đối chiếu',
    stockNotChecked: 'Chưa kiểm tra tồn kho',
    stockUpdatedAt: 'Cập nhật:',
    labelLoc: 'Nhãn',
    unlabeledProduct: 'Sản phẩm chưa có tên',

    // Loss module
    lossTitle: 'Kiểm loss sản phẩm',
    lossSubtitle: 'Quét barcode, đối chiếu stock và lưu kỳ kiểm',
    lossDescription: 'Giao diện ưu tiên quét nhanh, nhập nhanh và xem lịch sử ở cùng một màn hình.',
    currentScanSheet: 'Phiếu quét hiện tại',
    currentScanHint: 'Nhập hoặc quét barcode để thêm sản phẩm, sau đó điền stock hệ thống và stock thực tế.',
    periodName: 'Tên kỳ kiểm',
    periodPlaceholder: 'VD: Kỳ kiểm loss tuần 1',
    barcodeLabel: 'Barcode / SKU / Product ID',
    barcodePlaceholder: 'Nhập mã và nhấn Enter',
    systemStockLabel: 'Hệ thống',
    actualStockLabel: 'Thực tế',
    lossLabel: 'Loss',
    lossTooltip: 'Stock hệ thống trừ stock thực tế',
    readOnlyNote: 'Đang ở chế độ xem. Đăng nhập để lưu kỳ loss dùng chung.',
    emptyLossDraft: 'Phiếu loss đang rỗng. Bắt đầu quét barcode để tạo danh sách.',
    lossHistory: 'Lịch sử các kỳ kiểm loss',
    lossHistoryHint: 'Lưu trữ các kỳ trước đó và xuất lại Excel bất cứ lúc nào.',
    noLossHistory: 'Chưa có kỳ kiểm loss nào được lưu.',
    unknownCreator: 'Không rõ người tạo',

    // Stock module
    stockTitle: 'Check stock sản phẩm',
    stockSubtitle: 'Danh sách sản phẩm (A - Z) và bộ lọc',
    stockDescription: 'Quét/gõ barcode/SKU/Product ID để lọc sản phẩm. Tồn hệ thống được lấy từ Excel và Tồn thực tế lấy từ Check Loss.',
    stockScanTitle: 'Khoanh vùng và Quét mã',
    stockScanHint: 'Khớp sản phẩm bằng barcode/sku hoặc dùng trường Tìm kiếm ở Topbar.',
    filteringBy: 'Đang lọc theo:',
    noProductFound: 'Không tìm thấy sản phẩm phù hợp. Hãy thử mã khác.',
    stockSystemCol: 'Hệ thống',
    stockActualCol: 'Thực tế',

    // Scanner
    scannerTitle: 'Quét barcode bằng camera',
    scannerHint: 'Hướng camera vào barcode của sản phẩm',
    scannerDescription: 'App sẽ tự động nhận barcode, đối chiếu với dữ liệu POG và thêm vào phiếu loss.',
    scannerStarting: 'Đang khởi động camera...',

    // AI PDF sync modal
    aiModalTitle: 'Cập nhật POG và hình line',
    aiStep1Title: 'Tải file PDF',
    aiTargetLine: 'Line đích',
    aiTargetSide: 'Mặt kệ',
    aiSideLabel: (side) => `Mặt ${side}`,
    aiUploadPrimary: (name) => name || 'Tải lên PDF planogram',
    aiUploadSecondary: 'App sẽ đọc text, tìm hình line, và map các vị trí locId ngay trên máy',
    aiStep2Title: 'Đang phân tích...',
    aiStep3Title: 'Xác nhận dữ liệu',
    aiAnalysisHint: 'Phân tích cục bộ trên máy. Nếu PDF có trang line và nhãn locId, app sẽ khoanh vị trí sản phẩm trên hình.',
    aiAnalysing: 'Đang phân tích PDF...',
    aiAnalysingDesc: 'App đang tách bảng SKU và tìm trang hình line để map vị trí sản phẩm.',
    aiSuccess: 'Phân tích thành công',
    aiFoundItems: (n) => `Tìm thấy ${n} sản phẩm hợp lệ`,
    btnAnalyse: 'Phân tích tệp tin',
    btnApply: 'Áp dụng vào line',
    btnScanAgain: 'Quét lại file',
    aiExtractedList: 'Danh sách sản phẩm trích xuất',
    aiGeneratedLine: 'và đã tạo preview line.',

    // Login
    loginTitle: 'Đăng nhập tài khoản',
    loginSubtitle: 'Vui lòng đăng nhập để cập nhật POG và chỉnh sửa tồn kho.',
    loginNoteTitle: 'Không cần đăng nhập để xem dữ liệu',
    loginNoteDesc: 'Bạn vẫn có thể xem line và tìm kiếm sản phẩm. Đăng nhập để cập nhật dữ liệu dùng chung.',
    usernameLabel: 'Tài khoản',
    passwordLabel: 'Mật khẩu',
    usernamePlaceholder: 'Nhập tên đăng nhập',
    passwordPlaceholder: 'Nhập mật khẩu',
    btnSignIn: 'Đăng nhập',
    signingIn: 'Đang xử lý...',
    loginError: 'Tên đăng nhập hoặc mật khẩu không đúng.',

    // Settings panel
    settingsTitle: 'Cài đặt',
    settingsFont: 'Font chữ',
    settingsLanguage: 'Ngôn ngữ',
    settingsTheme: 'Giao diện',
    themeDark: 'Tối',
    themeLight: 'Sáng',

    // Map panel
    mapTitle: 'Bản đồ line',
    mapHint: 'Chọn nhóm line, sau đó chạm vào mặt kệ A/B để xem chi tiết.',

    // Mobile dock
    mobileDockUpdatePog: 'Cập nhật POG',

    // Shared strings
    historyPeriodTitle: 'Kỳ kiểm loss',
    totalItems: (n) => `${n} SKU`,
    totalLossVal: (v) => `Tổng loss: ${v}`,
    btnTrash: 'Xóa khỏi phiếu',
  },

  en: {
    // Brand
    brandName: 'Picker Assistant',

    // Modules
    modulePog: 'POG',
    moduleLoss: 'Loss Check',
    moduleStock: 'Stock Check',
    pogWorkspace: 'POG Workspace',
    lossWorkspace: 'Loss Check Workspace',
    stockWorkspace: 'Stock Check Workspace',

    // Topbar
    searchPogPlaceholder: 'Search...',
    searchStockPlaceholder: 'Search...',
    searchLossPlaceholder: 'Search...',
    systemNotice: 'System notification',

    // Summary strip
    linesWithData: 'Lines with data',
    totalSku: 'Total SKU',
    currentOpen: 'Current',
    notSelected: 'None selected',
    searchResults: 'Search results',
    savedPeriods: 'Saved periods',
    scanningSkus: 'Scanning SKUs',
    systemStock: 'System stock',
    totalLoss: 'Total loss',

    // Buttons
    btnUpdatePog: 'Update POG',
    btnLogin: 'Login',
    btnLogout: 'Logout',
    btnSettings: 'Settings',
    btnSavePeriod: 'Save period',
    btnExportExcel: 'Export Excel',
    btnResetDraft: 'Reset draft',
    btnAdd: 'Add',
    btnScan: 'Scan',
    btnScanBarcode: 'Scan barcode',
    btnFilter: 'Filter',
    btnClearFilter: 'Clear filter',
    btnSyncFromPDF: 'Sync from PDF now',
    btnClose: 'Close',
    btnCancel: 'Cancel',
    btnSave: 'Save',
    btnExporting: 'Exporting...',
    btnSaving: 'Saving...',
    btnExportExcelCurrent: 'Export Excel current sheet',
    btnScan: 'Scan',

    // Drawer / Shelf
    drawerLoading: 'Syncing line data from server...',
    productCount: (n) => `${n} products`,
    noShelfSelected: 'No area selected',
    noShelfHint: 'Click on an area on the map to open the product list.',
    syncFromPDF: 'Sync from PDF now',
    noProductData: 'This line has no product data yet',
    stockUpdated: (checked, total) => `${checked}/${total} products stock updated`,
    savingStock: 'Saving',
    stockVerified: 'Matched',
    stockNotVerified: 'Not verified',
    stockNotChecked: 'Stock not checked',
    stockUpdatedAt: 'Updated:',
    labelLoc: 'Loc',
    unlabeledProduct: 'Unnamed product',

    // Loss module
    lossTitle: 'Product loss check',
    lossSubtitle: 'Scan barcode, verify stock and save period',
    lossDescription: 'Interface optimised for quick scanning, quick entry and viewing history all in one screen.',
    currentScanSheet: 'Current scan sheet',
    currentScanHint: 'Enter or scan barcode to add products, then fill in system stock and actual stock.',
    periodName: 'Period name',
    periodPlaceholder: 'E.g: Loss check week 1',
    barcodeLabel: 'Barcode / SKU / Product ID',
    barcodePlaceholder: 'Enter code and press Enter',
    systemStockLabel: 'System',
    actualStockLabel: 'Actual',
    lossLabel: 'Loss',
    lossTooltip: 'System stock minus actual stock',
    readOnlyNote: 'View-only mode. Login to save shared loss periods.',
    emptyLossDraft: 'Loss sheet is empty. Start scanning barcodes to create a list.',
    lossHistory: 'Loss period history',
    lossHistoryHint: 'Store previous periods and re-export Excel at any time.',
    noLossHistory: 'No loss periods saved yet.',
    unknownCreator: 'Unknown creator',

    // Stock module
    stockTitle: 'Product stock check',
    stockSubtitle: 'Product list (A - Z) and filters',
    stockDescription: 'Scan/type barcode/SKU/Product ID to filter products. System stock loaded from Excel, Actual stock from Loss Check.',
    stockScanTitle: 'Zone scope & Scan code',
    stockScanHint: 'Match products by barcode/sku or use the Search field in the Topbar.',
    filteringBy: 'Filtering by:',
    noProductFound: 'No matching products found. Try another code.',
    stockSystemCol: 'System',
    stockActualCol: 'Actual',

    // Scanner
    scannerTitle: 'Scan barcode with camera',
    scannerHint: 'Point camera at product barcode',
    scannerDescription: 'App will automatically detect the barcode, cross-reference with POG data and add to loss sheet.',
    scannerStarting: 'Starting camera...',

    // AI PDF sync modal
    aiModalTitle: 'Update POG and line images',
    aiStep1Title: 'Upload PDF file',
    aiTargetLine: 'Target Line',
    aiTargetSide: 'Shelf Side',
    aiSideLabel: (side) => `Side ${side}`,
    aiUploadPrimary: (name) => name || 'Upload planogram PDF',
    aiUploadSecondary: 'App will read text, find line images, and map locIds locally',
    aiStep2Title: 'Analysing...',
    aiStep3Title: 'Confirm data',
    aiAnalysisHint: 'Local analysis on device. If PDF has line pages with locId labels, app will map product positions on images.',
    aiAnalysing: 'Analysing PDF...',
    aiAnalysingDesc: 'App is extracting SKU table and finding line images to map product positions.',
    aiSuccess: 'Analysis successful',
    aiFoundItems: (n) => `Found ${n} valid products`,
    btnAnalyse: 'Analyse file',
    btnApply: 'Apply to line',
    btnScanAgain: 'Scan file again',
    aiExtractedList: 'Extracted product list',
    aiGeneratedLine: 'and generated line preview.',

    // Login
    loginTitle: 'Account Login',
    loginSubtitle: 'Please login to update POG and edit stock.',
    loginNoteTitle: 'Login not required for viewing',
    loginNoteDesc: 'You can still view lines and search products. Login to update shared data.',
    usernameLabel: 'Username',
    passwordLabel: 'Password',
    usernamePlaceholder: 'Enter username',
    passwordPlaceholder: 'Enter password',
    btnSignIn: 'Login',
    signingIn: 'Processing...',
    loginError: 'Incorrect username or password.',

    // Settings panel
    settingsTitle: 'Settings',
    settingsFont: 'Font',
    settingsLanguage: 'Language',
    settingsTheme: 'Theme',
    themeDark: 'Dark',
    themeLight: 'Light',

    // Map panel
    mapTitle: 'Line Map',
    mapHint: 'Select a line group, then tap on side A/B to see details.',

    // Mobile dock
    mobileDockUpdatePog: 'Update POG',

    // Shared strings
    historyPeriodTitle: 'Loss period',
    totalItems: (n) => `${n} SKU`,
    totalLossVal: (v) => `Total loss: ${v}`,
    btnTrash: 'Remove from sheet',
  },
};

export const FONT_OPTIONS = [
  { name: 'Arial', family: 'Arial', isSystem: true },
  { name: 'Times New Roman', family: 'Times New Roman', isSystem: true },
  { name: 'Montserrat', family: 'Montserrat', isSystem: false },
  { name: 'Nunito', family: 'Nunito', isSystem: false },
  { name: 'Playfair Display', family: 'Playfair Display', isSystem: false },
  { name: 'Be Vietnam Pro', family: 'Be Vietnam Pro', isSystem: false },
  { name: 'Manrope', family: 'Manrope', isSystem: false },
  { name: 'Mulish', family: 'Mulish', isSystem: false },
  { name: 'Barlow', family: 'Barlow', isSystem: false },
  { name: 'Unbounded', family: 'Unbounded', isSystem: false },
  { name: 'Phù Dú', family: 'Phu Du', isSystem: false },
  { name: 'Raleway', family: 'Raleway', isSystem: false },
  { name: 'Quicksand', family: 'Quicksand', isSystem: false },
  { name: 'Inter', family: 'Inter', isSystem: false },
  { name: 'Cormorant', family: 'Cormorant', isSystem: false },
  { name: 'Fraunces', family: 'Fraunces', isSystem: false },
  { name: 'IBM Plex Sans', family: 'IBM Plex Sans', isSystem: false },
];
