/**
 * Billing (one-time credit packs)
 */
import { functions } from "./firebase.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-functions.js";

const getCreditsFn = httpsCallable(functions, "getCredits");
const checkoutFn = httpsCallable(functions, "createCheckoutSession");

export async function getCreditsBalance() {
  const res = await getCreditsFn({});
  return Number(res.data?.balance || 0);
}

export async function startCheckout(pack) {
  const res = await checkoutFn({ pack });
  const url = res.data?.url;
  if (!url) throw new Error("No checkout URL returned.");
  window.location.href = url;
}

