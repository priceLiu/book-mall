import { VisualLabThemeClient } from "./visual-lab-theme-client";

import "./visual-lab.css";

export default function VisualLabLayout({ children }: { children: React.ReactNode }) {
  return <VisualLabThemeClient>{children}</VisualLabThemeClient>;
}
