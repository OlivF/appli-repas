// Construit un FormData comme celui qu'envoie un formulaire HTML.
export function formData(fields: Record<string, string | string[]>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    for (const item of Array.isArray(value) ? value : [value]) data.append(key, item);
  }
  return data;
}

export const PAUL = "11111111-1111-4111-8111-111111111111";
export const LEA = "22222222-2222-4222-8222-222222222222";
export const TOM = "33333333-3333-4333-8333-333333333333";
