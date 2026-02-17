"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { useState } from "react";

export default function ConvexClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const convexUrl =
    process.env.NEXT_PUBLIC_CONVEX_URL ?? "https://placeholder.convex.cloud";

  const [client] = useState(() => new ConvexReactClient(convexUrl));

  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
