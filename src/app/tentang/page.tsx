import { StaticPageView, staticMetadata } from "@/components/StaticPageView";
import { TENTANG } from "@/content/pages";

export const metadata = staticMetadata(TENTANG);

export default function Page() {
  return <StaticPageView page={TENTANG} />;
}
