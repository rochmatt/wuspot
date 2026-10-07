import { StaticPageView, staticMetadata } from "@/components/StaticPageView";
import { PRIVASI } from "@/content/pages";

export const metadata = staticMetadata(PRIVASI);

export default function Page() {
  return <StaticPageView page={PRIVASI} />;
}
