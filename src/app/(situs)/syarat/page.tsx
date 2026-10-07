import { StaticPageView, staticMetadata } from "@/components/StaticPageView";
import { SYARAT } from "@/content/pages";

export const metadata = staticMetadata(SYARAT);

export default function Page() {
  return <StaticPageView page={SYARAT} />;
}
