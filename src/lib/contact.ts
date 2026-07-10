/**
 * Course-feedback endpoint — configured as `contactEndpoint` in
 * astro.config.mjs (exposed via a Vite define). When set, lesson/test pages
 * grow a feedback button and the navbar a Contact link; when empty, the
 * feature disappears entirely.
 *
 * Feedback is a plain form POST: `subject` + `message` fields, plus
 * `sender_name`/`sender_email` fields and x-sender-* headers when the
 * visitor has a profile set (they're optional here, unlike result
 * endpoints).
 */
import { getProfile } from './profile';

export const CONTACT_ENDPOINT: string =
  (import.meta.env.PUBLIC_CONTACT_ENDPOINT as string | undefined) ?? '';

export const contactConfigured = (): boolean => CONTACT_ENDPOINT !== '';

const headerSafe = (value: string) => value.replace(/[\r\n]+/g, ' ').trim();

export async function postFeedback(subject: string, message: string): Promise<void> {
  const profile = getProfile();
  const data = new FormData();
  data.set('subject', subject);
  data.set('message', message);
  if (profile.name) data.set('sender_name', profile.name);
  if (profile.email) data.set('sender_email', profile.email);

  const headers: Record<string, string> = {};
  if (profile.name) headers['x-sender-name'] = headerSafe(profile.name);
  if (profile.email) headers['x-sender-email'] = headerSafe(profile.email);

  const response = await fetch(CONTACT_ENDPOINT, { method: 'POST', headers, body: data });
  if (!response.ok) {
    throw new Error(`endpoint responded ${response.status} ${response.statusText}`);
  }
}
