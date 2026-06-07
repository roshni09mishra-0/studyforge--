import { el, toast } from "../shared/ui.js";
import { auth, db } from "../shared/firebase.js";
import { updateProfile } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

export async function profileView(root) {
  const user = auth.currentUser;
  if (!user) return;

  const name = el("input", { value: user.displayName || "Student" });
  const photo = el("input", { value: user.photoURL || "", placeholder: "Photo URL (optional)" });
  const saveBtn = el("button", { class: "btn primary", text: "Save profile" });

  saveBtn.addEventListener("click", async () => {
    try {
      saveBtn.disabled = true;
      await updateProfile(user, { displayName: name.value.trim() || "Student", photoURL: photo.value.trim() || null });
      await setDoc(
        doc(db, "users", user.uid),
        { displayName: user.displayName, photoURL: user.photoURL || null, updatedAt: serverTimestamp() },
        { merge: true }
      );
      toast("Saved", "Profile updated.", "success");
    } catch (e) {
      toast("Save failed", e.message || String(e), "danger");
    } finally {
      saveBtn.disabled = false;
    }
  });

  root.append(
    el("section", { class: "card", style: "grid-column: span 7" }, [
      el("h2", { text: "Profile" }),
      el("p", { text: "Manage your StudyForge AI account details." }),
      el("label", { text: "Display name" }),
      name,
      el("label", { text: "Photo URL" }),
      photo,
      el("div", { class: "actions" }, [saveBtn])
    ]),
    el("section", { class: "card", style: "grid-column: span 5" }, [
      el("h2", { text: "Account info" }),
      el("p", { text: "These values come from Firebase Authentication." }),
      el("div", { style: "color:var(--muted); font-size:13px" }, [
        el("div", { text: `Email: ${user.email || "—"}` }),
        el("div", { text: `UID: ${user.uid}` }),
        el("div", { text: `Providers: ${(user.providerData || []).map((p) => p.providerId).join(", ") || "—"}` })
      ])
    ])
  );
}

