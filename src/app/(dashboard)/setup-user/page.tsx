"use client";

import { useEffect, useState } from "react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

export default function SetupUserPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState<"loading" | "success" | "error" | "unauthorized">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function assignRole() {
      if (!user) return;
      if (user.role !== "admin") {
        setStatus("unauthorized");
        return;
      }

      try {
        const uid = "x2e7FOc250Np75w7t7voNROnn8H2";
        const email = "carmencitapinto@gmail.com";
        const role = "colaboradora";

        const docRef = doc(db, "roles_usuarios", uid);
        await setDoc(docRef, {
          uid,
          email,
          role,
          name: "Carmencita Pinto", // Optional default name
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true });

        setStatus("success");
      } catch (err: any) {
        console.error(err);
        setErrorMsg(err.message || "Error al asignar el rol");
        setStatus("error");
      }
    }

    if (user) {
      assignRole();
    }
  }, [user]);

  return (
    <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
      {status === "loading" && (
        <>
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <h2 className="text-xl font-bold">Asignando rol a Carmencita...</h2>
        </>
      )}
      {status === "success" && (
        <>
          <CheckCircle className="h-16 w-16 text-green-500" />
          <h2 className="text-2xl font-bold text-green-600">¡Rol Asignado Exitosamente!</h2>
          <p className="text-muted-foreground">La cuenta carmencitapinto@gmail.com ya tiene el rol 'colaboradora'. Ya puedes cerrar esta página.</p>
        </>
      )}
      {status === "error" && (
        <>
          <XCircle className="h-16 w-16 text-red-500" />
          <h2 className="text-2xl font-bold text-red-600">Error</h2>
          <p className="text-muted-foreground">{errorMsg}</p>
        </>
      )}
      {status === "unauthorized" && (
        <>
          <XCircle className="h-16 w-16 text-orange-500" />
          <h2 className="text-2xl font-bold text-orange-600">No autorizado</h2>
          <p className="text-muted-foreground">Debes ser administrador para ejecutar esto.</p>
        </>
      )}
    </div>
  );
}
