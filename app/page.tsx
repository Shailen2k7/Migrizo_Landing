import { redirect } from "next/navigation";

// The only public page right now is the paid-traffic landing page.
export default function Home() {
  redirect("/global-talent-visa-assessment");
}
