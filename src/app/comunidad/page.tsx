/**
 * /comunidad — old workshop link. The student flow now lives at /estudiantes
 * (account + downloads + guide); redirect so links already shared keep working.
 */
import { redirect } from "next/navigation";

export default function ComunidadPage() {
  redirect("/estudiantes");
}
