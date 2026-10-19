"use client";

import { CopilotKit } from "@copilotkit/react-core/v2";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    // The Inspector (AG-UI event viewer) is a dev tool: on in `npm run dev`, off in production builds.
    <CopilotKit runtimeUrl="/api/copilotkit" enableInspector={process.env.NODE_ENV !== "production"}>
      {children}
    </CopilotKit>
  );
}
