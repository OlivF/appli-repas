// Messages en français pour les codes d'erreur de Supabase Auth.
export function authErrorMessage(code: string | undefined): string {
  switch (code) {
    case "invalid_credentials":
      return "Email ou mot de passe incorrect.";
    case "user_already_exists":
    case "email_exists":
      return "Un compte existe déjà avec cet email : connecte-toi.";
    case "weak_password":
      return "Choisis un mot de passe d'au moins 6 caractères.";
    case "email_address_invalid":
    case "validation_failed":
      return "Cet email n'est pas valide.";
    case "email_not_confirmed":
      return "Confirme d'abord ton email avec le lien reçu.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Trop de tentatives. Réessaie dans quelques minutes.";
    case "signup_disabled":
      return "Les inscriptions sont fermées pour le moment.";
    default:
      return "Connexion impossible pour le moment. Réessaie dans un instant.";
  }
}
