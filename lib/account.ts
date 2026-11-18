// Initiale du compte pour son avatar : la première lettre de l'email, en majuscule.
// Les comptes ne sont reliés à aucun membre du foyer : l'email est tout ce qu'on a.
export function accountInitial(email: string | undefined): string {
  const first = email?.trim().match(/\p{L}|\p{N}/u)?.[0];
  return first ? first.toLocaleUpperCase("fr") : "?";
}
