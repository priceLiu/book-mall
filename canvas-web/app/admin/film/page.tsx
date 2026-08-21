import type { Metadata } from "next";
import { FilmAdminClient } from "./film-admin-client";

export const metadata: Metadata = {
  title: "影视作品",
};

export default function AdminFilmPage() {
  return <FilmAdminClient />;
}
