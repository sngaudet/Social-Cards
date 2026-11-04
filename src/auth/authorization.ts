import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "../../firebaseConfig";

const sync = httpsCallable(getFunctions(app, "us-central1"), "auth_syncSession");
export async function refreshServerAuthorization(): Promise<void> {
  await sync({});
}
