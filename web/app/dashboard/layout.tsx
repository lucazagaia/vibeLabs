import { Suspense } from "react";
import "@copilotkit/react-core/v2/styles.css";

import { Providers } from "../providers";

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    // Cache Components (Next 16): CopilotKit calls crypto.randomUUID() while rendering, which must run
    // at request time, not in the prerendered shell. Suspense moves it out of the shell.
    <Suspense fallback={null}>
      <Providers>{children}</Providers>
    </Suspense>
  );
}
