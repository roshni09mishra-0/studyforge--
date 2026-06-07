import { el, toast } from "../shared/ui.js";
import { aiGenerateStudyPlan } from "../shared/api.js";
import { saveResource } from "../shared/library.js";

export async function plannerView(root) {
  const examDate = el("input", { type: "date" });
  const subjects = el("input", { placeholder: "Subjects (comma separated)" });
  const hours = el("input", { type: "number", min: "0.5", step: "0.5", value: "2" });
  const prefs = el("textarea", { placeholder: "Preferences (optional): weak topics, breaks, weekends, etc." });

  const genBtn = el("button", { class: "btn primary", text: "Generate plan" });
  const saveBtn = el("button", { class: "btn", text: "Save plan" });

  const output = el("div", { class: "card", style: "grid-column: span 12" }, [
    el("h2", { text: "Plan" }),
    el("p", { text: "Your timetable will appear here." })
  ]);

  let latestPlan = null;

  genBtn.addEventListener("click", async () => {
    try {
      if (!examDate.value) return toast("Missing exam date", "Select an exam date.", "warning");
      const subs = subjects.value.split(",").map((s) => s.trim()).filter(Boolean);
      if (!subs.length) return toast("Missing subjects", "Enter at least one subject.", "warning");
      const h = Number(hours.value);
      if (!h || h <= 0) return toast("Invalid hours", "Enter available hours per day.", "warning");

      genBtn.disabled = true;
      genBtn.textContent = "Generating…";
      latestPlan = await aiGenerateStudyPlan({
        examDate: examDate.value,
        subjects: subs,
        availableHoursPerDay: h,
        preferences: prefs.value || ""
      });
      renderPlan(output, latestPlan);
      toast("Done", "Study plan generated.", "success");
    } catch (e) {
      toast("AI error", e.message || String(e), "danger");
    } finally {
      genBtn.disabled = false;
      genBtn.textContent = "Generate plan";
    }
  });

  saveBtn.addEventListener("click", async () => {
    try {
      if (!latestPlan) return toast("Nothing to save", "Generate a plan first.", "warning");
      const id = await saveResource({
        type: "plan",
        title: latestPlan.title || "Study plan",
        subjects: latestPlan.subjects || [],
        payload: latestPlan
      });
      toast("Saved", `Plan saved to library (id: ${id}).`, "success");
    } catch (e) {
      toast("Save failed", e.message || String(e), "danger");
    }
  });

  root.append(
    el("section", { class: "card", style: "grid-column: span 12" }, [
      el("h2", { text: "AI Study Planner" }),
      el("p", { text: "Enter exam details and let AI generate a personalized timetable." }),
      el("div", { class: "row" }, [
        el("div", {}, [el("label", { text: "Exam date" }), examDate]),
        el("div", {}, [el("label", { text: "Available hours / day" }), hours]),
        el("div", {}, [el("label", { text: "Subjects" }), subjects])
      ]),
      el("label", { text: "Preferences" }),
      prefs,
      el("div", { class: "actions" }, [genBtn, saveBtn])
    ]),
    output
  );
}

function renderPlan(container, plan) {
  // Replace content except header.
  container.innerHTML = "";
  container.append(
    el("h2", { text: plan.title || "Study plan" }),
    el("p", { text: `Exam: ${plan.examDate} • Hours/day: ${plan.availableHoursPerDay} • Subjects: ${(plan.subjects || []).join(", ")}` })
  );

  if (plan.tips?.length) {
    container.append(el("div", { class: "card", style: "padding:12px; margin-top:10px" }, [
      el("h2", { text: "Tips" }),
      el("p", { text: plan.tips.join(" • ") })
    ]));
  }

  if (!plan.days?.length) {
    container.append(el("p", { text: "No schedule returned." }));
    return;
  }

  const table = el("table", {}, [
    el("thead", {}, [el("tr", {}, [
      el("th", { text: "Date" }),
      el("th", { text: "Focus" }),
      el("th", { text: "Tasks" }),
      el("th", { text: "Hours" })
    ])]),
    el("tbody")
  ]);

  const tbody = table.querySelector("tbody");
  plan.days.forEach((d) => {
    tbody.append(el("tr", {}, [
      el("td", { text: d.date }),
      el("td", { text: d.subject }),
      el("td", { text: (d.tasks || []).join("; ") }),
      el("td", { text: String(d.hours) })
    ]));
  });
  container.append(table);
}

