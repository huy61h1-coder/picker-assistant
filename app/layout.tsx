import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "picker-assistant.local";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";

  return {
    metadataBase: new URL(`${protocol}://${host}`),
    title: "Picker Assistant | Trung tâm điều hành",
    description: "Giao diện quản lý dữ liệu Picker Assistant.",
    openGraph: {
      title: "Picker Assistant | Trung tâm điều hành",
      description: "Dữ liệu kho, sơ đồ quầy và tài khoản trong một màn hình.",
      images: ["/og.png"],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body>{children}</body></html>;
}
