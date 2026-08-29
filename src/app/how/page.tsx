import type { Metadata } from "next";

import { HowView } from "@/components/layout/how-view";

export const metadata: Metadata = {
  title: "How it works",
  description: "The model behind the projections, and what it cannot do.",
};

export default function HowPage() {
  return <HowView />;
}
