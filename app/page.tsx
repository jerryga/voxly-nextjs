import { redirect } from "next/navigation";

export default function Home() {
  // Server-side redirect to the dashboard page so the app root is the dashboard
  redirect("/dashboard");
}
