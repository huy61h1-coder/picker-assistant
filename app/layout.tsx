import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    metadataBase: new URL("https://picker-assistant-dashboard-huy.huy61h1.chatgpt.site"),
    title: "AEON SmartOps | Tìm vị trí sản phẩm",
    description: "Tìm line hàng, vị trí trưng bày, tồn kho và thông tin vận hành sản phẩm.",
    openGraph: {
      title: "AEON SmartOps | Tìm đúng line, thấy đúng vị trí",
      description: "Tìm sản phẩm theo tên, SKU hoặc barcode và xem đúng vị trí trên line layout.",
      images: ["/og-smartops.png"],
    },
    twitter: {
      card: "summary_large_image",
      title: "AEON SmartOps | Tìm đúng line, thấy đúng vị trí",
      description: "Tìm sản phẩm theo tên, SKU hoặc barcode và xem đúng vị trí trên line layout.",
      images: ["/og-smartops.png"],
    },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body>{children}</body></html>;
}
