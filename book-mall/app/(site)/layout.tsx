import { Navbar } from "@/components/layout/navbar";

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      <div className="pt-4 md:pt-5">{children}</div>
    </>
  );
}
