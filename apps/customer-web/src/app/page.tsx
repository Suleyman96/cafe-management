import { redirect } from "next/navigation";

export default function HomePage() {
  // Redirect to table page if accessed directly
  // In production, this would show an error or landing page
  redirect("/table/demo");
}


