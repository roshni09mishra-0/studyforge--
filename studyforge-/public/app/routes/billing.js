import { el, toast } from "../shared/ui.js";
import { getCreditsBalance, startCheckout } from "../shared/billing.js";

export async function billingView(root) {
  const balanceEl = el("div", { class: "value", text: "—" });

  const packs = [
    { id: "pack_small", name: "Starter", credits: 25, desc: "Great for short summaries and quizzes." },
    { id: "pack_medium", name: "Boost", credits: 60, desc: "Balanced plan for regular studying." },
    { id: "pack_large", name: "Pro", credits: 150, desc: "Best value for heavy exam prep." }
  ];

  const cards = el("div", { class: "grid" }, packs.map((p) => {
    return el("section", { class: "card", style: "grid-column: span 4" }, [
      el("h2", { text: `${p.name} Pack` }),
      el("div", { class: "stat" }, [
        el("div", {}, [
          el("div", { class: "value", text: `${p.credits}` }),
          el("div", { class: "label", text: "credits" })
        ]),
        el("span", { class: "badge", text: "One-time" })
      ]),
      el("p", { text: p.desc }),
      el("div", { class: "actions" }, [
        el("button", {
          class: "btn primary",
          text: "Buy credits",
          onclick: async () => {
            try {
              await startCheckout(p.id);
            } catch (e) {
              toast("Checkout failed", e.message || String(e), "danger");
            }
          }
        })
      ])
    ]);
  }));

  root.append(
    el("section", { class: "card", style: "grid-column: span 12" }, [
      el("h2", { text: "Billing & Credits" }),
      el("p", { text: "Credits are used for AI generations (summaries, quizzes, flashcards, study plans)." }),
      el("div", { class: "stat", style: "margin-top:10px" }, [
        el("div", {}, [
          el("div", { class: "label", text: "Current balance" }),
          balanceEl
        ]),
        el("button", {
          class: "btn",
          text: "Refresh",
          onclick: async () => {
            balanceEl.textContent = String(await getCreditsBalance());
            toast("Updated", "Credits refreshed.", "success");
          }
        })
      ])
    ]),
    cards
  );

  // Handle return from Stripe
  const url = new URL(window.location.href);
  if (url.searchParams.get("success") === "1") {
    toast("Payment successful", "Your credits will appear shortly (webhook).", "success");
  }
  if (url.searchParams.get("canceled") === "1") {
    toast("Payment canceled", "No charges were made.", "warning");
  }

  balanceEl.textContent = String(await getCreditsBalance());
}

