"use client";

export default function Error({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="mx-auto w-full max-w-md px-4 pt-16">
      <h1 className="page-title">Impossible d&apos;afficher cette page</h1>
      <p className="lead">Le serveur n&apos;a pas répondu. Vérifie ta connexion, puis réessaie.</p>
      <button type="button" className="btn btn-primary mt-8" onClick={() => retry()}>
        Réessayer
      </button>
    </main>
  );
}
