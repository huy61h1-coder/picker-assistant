import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "picker-assistant.local";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";

  return {
    metadataBase: new URL(`${protocol}://${host}`),
    title: "Picker Assistant | Tìm vị trí sản phẩm",
    description: "Tìm line hàng và vị trí trưng bày chính xác trên line layout.",
    openGraph: {
      title: "Picker Assistant | Tìm đúng line, thấy đúng vị trí",
      description: "Tìm sản phẩm, xem line trên sơ đồ siêu thị và vị trí trưng bày trên layout.",
      images: ["/og-v2.png"],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body>{children}</body></html>;
}
