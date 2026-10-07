import { KompresPdfPage, kompresMetadata } from "@/components/kompres/KompresPdfPage";

const SLUG = "kompres-pdf";

export const metadata = kompresMetadata(SLUG);

export default function Page() {
  return <KompresPdfPage slug={SLUG} />;
}
