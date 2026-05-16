
import { redirect } from "next/navigation";

export default function Home() {
  // Redirección directa al dashboard operativo
  redirect("/dashboard");
}
