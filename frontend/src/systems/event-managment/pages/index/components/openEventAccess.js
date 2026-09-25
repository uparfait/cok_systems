import axios from "axios";

/**
 * What happens when somebody clicks an event card.
 *
 * Three ways in, tried in order, and the page never says which one it is
 * using:
 *
 *   1. an access token already kept for this event - go straight in
 *   2. a signed-in organizer or co-organizer - the server recognises them
 *      from their session and hands the token over, no email needed
 *   3. anyone else - ask for an email, as before
 *
 * Step 2 is silent by design. It is one request that either works or
 * politely does not, and the fallback is the same screen a member of the
 * public sees, so nothing about who organizes what is revealed by
 * clicking around.
 */
export async function openEventAccess(eventSpecialId) {
  if (!eventSpecialId) return false;

  try {
    if (localStorage.getItem(`event_access_${eventSpecialId}`)) return true;
  } catch (error) {
    // Storage can be unavailable in a private window; carry on and ask.
  }

  // No session means there is nothing for the server to recognise, so the
  // request is not worth making.
  let session = null;
  try {
    session = localStorage.getItem("accessToken");
  } catch (error) {
    session = null;
  }
  if (!session) return false;

  try {
    const response = await axios.post(
      "/cok/api/v1/event-access/auto-token",
      { eventSpecialId },
      { headers: { Authorization: `Bearer ${session}` } },
    );
    const token = response?.data?.success ? response.data.data?.accessToken : null;
    if (!token) return false;
    localStorage.setItem(`event_access_${eventSpecialId}`, token);
    return true;
  } catch (error) {
    // Anything at all goes wrong: fall back to asking for an email.
    return false;
  }
}

export default openEventAccess;
