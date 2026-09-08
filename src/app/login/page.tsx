import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { AuthError } from "next-auth";

async function loginAction(formData: FormData) {
  "use server";
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const callbackUrl = String(formData.get("callbackUrl") ?? "/");

  try {
    await signIn("credentials", {
      username,
      password,
      redirectTo: callbackUrl,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(`/login?error=1&callbackUrl=${encodeURIComponent(callbackUrl)}`);
    }
    throw error;
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const params = await searchParams;
  const callbackUrl = params.callbackUrl ?? "/";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-serif text-4xl tracking-wide text-verde-900" style={{ letterSpacing: "0.05em" }}>
            veragua
          </h1>
          <div className="mx-auto mt-2 mb-3 h-px w-10 bg-dorado-400" />
          <p className="text-sm text-tierra-600">Operaciones internas</p>
        </div>

        <form action={loginAction} className="card space-y-4">
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          {params.error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              Usuario o contraseña incorrectos.
            </div>
          )}
          <div>
            <label className="label" htmlFor="username">Usuario</label>
            <input
              id="username"
              name="username"
              type="text"
              required
              autoFocus
              autoCapitalize="none"
              className="input"
              placeholder="admin"
            />
          </div>
          <div>
            <label className="label" htmlFor="password">Contraseña</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="input"
              placeholder="••••••••"
            />
          </div>
          <button type="submit" className="btn-primary w-full">
            Ingresar
          </button>
        </form>
      </div>
    </div>
  );
}
