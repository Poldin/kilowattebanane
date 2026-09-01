import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SignupProvider } from "@/components/SignupForm";
import { unsubscribeByToken } from "@/lib/subscribers";

const TOKEN_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function messageFor(status: string) {
  if (status === "ok") {
    return "Iscrizione annullata. Non ti arriveranno altre mail da noi.";
  }
  if (status === "gia-annullata") {
    return "Iscrizione già annullata. Non ti arriveranno altre mail da noi.";
  }
  if (status === "errore") {
    return "Non è stato possibile annullare l'iscrizione. Riprova dal link in fondo alla mail.";
  }
  return "Questo link non è valido. Usa il link Annulla iscrizione in fondo a una mail.";
}

export default async function UnsubscribePage({
  searchParams,
}: PageProps<"/disiscriviti">) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token.trim() : "";
  const preset = typeof params.stato === "string" ? params.stato : "";

  let status = preset;
  if (!status && token) {
    if (!TOKEN_RE.test(token)) {
      status = "link-non-valido";
    } else {
      try {
        const result = await unsubscribeByToken(token);
        status = result.ok
          ? result.already
            ? "gia-annullata"
            : "ok"
          : "link-non-valido";
      } catch {
        status = "errore";
      }
    }
  }
  if (!status) status = "link-non-valido";

  return (
    <SignupProvider>
      <div className="flex min-h-full flex-1 flex-col bg-background font-sans text-foreground">
        <Header />
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-16">
          <h1 className="text-2xl font-semibold tracking-tight">
            Iscrizione
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            {messageFor(status)}
          </p>
        </main>
        <Footer />
      </div>
    </SignupProvider>
  );
}
