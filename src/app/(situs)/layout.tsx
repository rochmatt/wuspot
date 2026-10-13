import Script from "next/script";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";

export default function SitusLayout({ children }: LayoutProps<"/">) {
  const adClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  return (
    <>
      <Header />
      <main id="isi" tabIndex={-1} style={{ outline: "none" }}>
        {children}
      </main>
      <Footer />
      {adClient ? (
        <Script
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(adClient)}`}
          strategy="afterInteractive"
          crossOrigin="anonymous"
        />
      ) : null}
    </>
  );
}
