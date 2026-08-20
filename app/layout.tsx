import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "picker-assistant.local";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";

  return {
    metadataBase: new URL(`${protocol}://${host}`),
    title: "AEON SmartOps | Tìm vị trí sản phẩm",
    description: "Tìm line hàng, vị trí trưng bày, tồn kho và thông tin vận hành sản phẩm.",
    openGraph: {
      title: "AEON SmartOps | Tìm đúng line, thấy đúng vị trí",
      description: "Tìm sản phẩm theo tên, SKU hoặc barcode và xem đúng vị trí trên line layout.",
      images: ["/og-smartops.png"],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body>{children}</body></html>;
}
