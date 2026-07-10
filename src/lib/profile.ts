/**
 * The visitor's optional profile — a display name and email kept in
 * localStorage. Collected (optionally) during onboarding and editable in
 * Settings. Both values are required before a quiz/test with a
 * `result_endpoint` can be submitted, because they identify the sender to
 * whoever marks the results (sent as x-sender-name / x-sender-email headers).
 */
export const NAME_KEY = 'learn-anywhere-name';
export const EMAIL_KEY = 'learn-anywhere-email';

export interface Profile {
  name: string;
  email: string;
}

export function getProfile(): Profile {
  if (typeof localStorage === 'undefined') return { name: '', email: '' };
  return {
    name: localStorage.getItem(NAME_KEY) ?? '',
    email: localStorage.getItem(EMAIL_KEY) ?? '',
  };
}

export function setProfile(profile: Profile): void {
  const store = (key: string, value: string) => {
    const clean = value.trim();
    if (clean) localStorage.setItem(key, clean);
    else localStorage.removeItem(key);
  };
  store(NAME_KEY, profile.name);
  store(EMAIL_KEY, profile.email);
}

/** True when both fields are set — the gate for result-endpoint forms. */
export function profileComplete(profile: Profile = getProfile()): boolean {
  return profile.name.trim() !== '' && profile.email.trim() !== '';
}
