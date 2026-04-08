const fs = require('fs');

const file = 'src/App2.jsx';
let content = fs.readFileSync(file, 'utf8');

// Map of unaccented → accented Vietnamese strings (in JSX string contexts only)
const replacements = [
  // Toast messages
  ["'Khong tim thay san pham cho ma", "'Không tìm thấy sản phẩm cho mã"],
  ["'Khong co du lieu de xuat Excel.'", "'Không có dữ liệu để xuất Excel.'"],
  ["`Da xuat file ${fileName}.`", "`Đã xuất file ${fileName}.`"],
  ["'Khong the xuat file Excel.'", "'Không thể xuất file Excel.'"],
  ["'Vui long dang nhap de luu ky kiem loss dung chung.'", "'Vui lòng đăng nhập để lưu kỳ kiểm loss dùng chung.'"],
  ["'K? ki?m loss dang rong. Hay quet barcode truoc khi luu.'", "'Kỳ kiểm loss đang rỗng. Hãy quét barcode trước khi lưu.'"],
  ["'Kỳ kiểm loss đang rỗng. Hãy quét barcode trước khi lưu.'", "'Kỳ kiểm loss đang rỗng. Hãy quét barcode trước khi lưu.'"], // already correct
  ["`Da luu ky ${periodName}: ${nextAudit.itemCount} SKU, tong loss ${nextAudit.totalLossQuantity}.`", "`Đã lưu kỳ ${periodName}: ${nextAudit.itemCount} SKU, tổng loss ${nextAudit.totalLossQuantity}.`"],
  ["'Khong luu duoc ky kiem loss.'", "'Không lưu được kỳ kiểm loss.'"],
  ["`Da ${sourceLabel} ${matched.name || matched.sku || matched.barcode || 'san pham'} thanh cong.`", "`Đã ${sourceLabel} ${matched.name || matched.sku || matched.barcode || 'sản phẩm'} thành công.`"],
  ["'Vui long nhap barcode hoac SKU truoc khi quet.'", "'Vui lòng nhập barcode hoặc SKU trước khi quét.'"],
  ["'Thiet bi/trinh duyet nay khong ho tro camera barcode.'", "'Thiết bị/trình duyệt này không hỗ trợ camera barcode.'"],
  ["'Camera dang bi chan. Hay cap quyen camera trong trinh duyet.'", "'Camera đang bị chặn. Hãy cấp quyền camera trong trình duyệt.'"],
  ["'Khong ket noi duoc kho du lieu dung chung.'", "'Không kết nối được kho dữ liệu dùng chung.'"],

  // Excel export fields
  ["{ field: 'Ky kiem', value:", "{ field: 'Kỳ kiểm', value:"],
  ["{ field: 'Nguoi tao',", "{ field: 'Người tạo',"],
  ["{ field: 'Thoi gian', value:", "{ field: 'Thời gian', value:"],
  ["{ field: 'Tong SKU', value:", "{ field: 'Tổng SKU', value:"],
  ["{ field: 'Tong stock he thong',", "{ field: 'Tổng stock hệ thống',"],
  ["{ field: 'Tong stock thuc te',", "{ field: 'Tổng stock thực tế',"],

  // JSX text
  ["{selectedCount} san pham da cap nhat stock", "{selectedCount} sản phẩm đã cập nhật stock"],
  ["Cap nhat: {formatStockCheckedAt", "Cập nhật: {formatStockCheckedAt"],
  [">Dang luu<", ">Đang lưu<"],
  ["Line nay chua co du lieu hang hoa", "Line này chưa có dữ liệu hàng hóa"],
  [">Huong camera vao barcode cua san pham<", ">Hướng camera vào barcode của sản phẩm<"],
  ["App se tu dong nhan barcode, doi chieu voi du lieu POG va them vao phieu loss.", "App sẽ tự động nhận barcode, đối chiếu với dữ liệu POG và thêm vào phiếu loss."],
  [">Dang khoi dong camera...<", ">Đang khởi động camera...<"],
  ["Phan tich cuc bo tren may. Neu PDF co trang line va nhan locId, app se khoanh vi tri", "Phân tích cục bộ trên máy. Nếu PDF có trang line và nhãn locId, app sẽ khoanh vị trí"],
  [">Dang phan tich PDF...<", ">Đang phân tích PDF...<"],
  ["App dang tach bang SKU va tim trang hinh line de map vi tri san pham.", "App đang tách bảng SKU và tìm trang hình line để map vị trí sản phẩm."],
  ["Tim thay {extractedData.length} san pham hop le", "Tìm thấy {extractedData.length} sản phẩm hợp lệ"],
];

let changeCount = 0;
for (const [from, to] of replacements) {
  if (from === to) continue;
  if (content.includes(from)) {
    content = content.split(from).join(to);
    changeCount++;
    console.log(`✅ Fixed: "${from.substring(0, 60)}"`);
  } else {
    console.log(`⚠️  NOT FOUND: "${from.substring(0, 60)}"`);
  }
}

fs.writeFileSync(file, content, 'utf8');
console.log(`\nDone. ${changeCount} replacements made.`);
