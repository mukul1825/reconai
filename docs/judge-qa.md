# Judge Q&A Prep

25 questions, answered against what was actually built and actually happened during this build — including real bugs found and fixed, not a hypothetical clean narrative. Where a question has a genuinely uncertain or limited answer, that's stated plainly rather than talked around.

---

**1. Why does this need AI, not just SQL joins?**
Exact and fuzzy joins on order ID, UTR, and amount handle roughly 80% of matches deterministically — no AI needed there. The LLM earns its place only on the unresolved tail: turning a raw numeric diff into a plain-English explanation a human can act on quickly. A pure join can tell you *that* two numbers don't match; it can't tell a finance analyst *why* in a sentence.

**2. Why an agent and not a script?**
The OBSERVE → PLAN → VERIFY → ESCALATE shape (see `decisionPolicy.js`) is what makes it safe to run unattended: every order reaches one of four explicit outcomes, and the ones requiring judgment are escalated, not silently skipped. A script has no such branching or escalation logic by default.

**3. What happens if the AI is wrong?**
Two separate answers, because two different things can be "wrong." If the *matching* logic is wrong, it's a real bug — caught by `evaluate.js`, currently 100% precision on the labeled dataset. If the *LLM's explanation* is wrong or nonsensical, it has zero effect on the outcome — `recommended_action`, `confidence`, and `requires_human_approval` are never derived from the LLM's output, only its prose is. This is unit-tested directly: `tests/explainException.test.js` mocks a response where the LLM tries to embed fake decision fields in its text, and confirms the real decision policy's values win regardless.

**4. What's the baseline?**
Exact-match-only reconciliation with no fuzzy or split logic — this is what a naive SQL join achieves. Against the labeled dataset, that baseline resolves 73% of orders (exact + duplicate categories). The full pipeline resolves 80% automatically and correctly classifies 100% of orders by category, including the 20% correctly held for human review.

**5. What's the false-positive cost?**
An incorrect auto-resolve would misstate a merchant's books — a real cost, not an abstract one. This is why fuzzy matches, no matter how confident, are structurally capped below the auto-resolve threshold (0.85 max vs. 0.90 required) — an inferred match can never look as certain as a verified one, by design, not by luck.

**6. Why Razorpay specifically?**
Settlement reconciliation is a universal, recurring cost for any Razorpay merchant with real volume — the track brief names this exact bottleneck directly. The settlement schema (`entity_id`, `settlement_id`, `settlement_utr`, `credit`) is aligned to Razorpay's real documented API terminology, not invented (see `docs/razorpay-schema-notes.md`).

**7. What did you personally build?**
All of it, solo — schema design, the three-stage matching engine, the confidence-scoring math, the decision policy, the LLM integration (including diagnosing and fixing two real production issues: a deprecated Groq model and a reasoning-token starvation bug), the full frontend, deployment, and the evaluation script.

**8. How does this scale?**
The matching engine is pure functions over arrays — no architectural blocker to larger batches. The known current bottleneck is sequential per-order database writes in `runMatchingPipeline.js` (~1-2s/order on a cold connection), which is fine at hackathon batch sizes and explicitly named in the README's Limitations as the first thing to fix before scaling batch size meaningfully — batching the writes or moving to a queue, not a redesign.

**9. How do you prevent duplicate actions?**
Idempotency is keyed by `orderId + paymentId` at the transaction level, and every resolution is a database state transition (`pending_review` → `resolved`/`rejected`), not a re-triggerable side effect — resolving the same match twice is a no-op after the first, enforced with a `MATCH_ALREADY_RESOLVED` API error.

**10. How do you handle API failure?**
This isn't hypothetical — it happened during the build. Groq deprecated the model this project originally used (`llama-3.1-8b-instant`, deprecated June 17 2026) mid-build. The system never went down: the deterministic template fallback in `explainException.js` took over silently, the batch kept processing, and the only symptom was less-varied explanation text — caught via an added debug log, not a crash. That's the fallback design doing exactly its job under real conditions, not just in a mocked test.

**11. How did you generate your dataset?**
`data/generate_data.py`, seeded (default seed 42) for full reproducibility. Five categories at fixed proportions matching real reconciliation failure modes: exact (70%), fee-reporting gaps (15%), split settlements (7%), delayed/not-yet-landed settlements (5%), duplicate bank entries (3%) — each with stored ground truth for evaluation.

**12. What are the limitations?**
Stated directly in the README, not hidden: synthetic (not real merchant) data; a simplified settlement-batching model (one order across multiple legs, rather than Razorpay's more common many-orders-per-batch pattern); sequential per-order database writes; no live Razorpay API integration (Test-Mode-shaped CSV instead).

**13. Why should Razorpay hire you?**
Not just "I can call an LLM API" — the evidence is in how bugs were found and fixed: a wrong test assertion caught by actually running the test, not assuming it passed; a deprecated model diagnosed with a dated, cited source, not a guess; a real data-plumbing gap (a computed value never reaching the LLM) traced end-to-end and fixed at the source, not patched with a better prompt. That's the habit of verifying rather than assuming, visible throughout the commit history.

**14. What would you build with another 30 days?**
A real Razorpay Settlement API pull instead of a CSV upload; `settlement_id` as the true batch key to match Razorpay's actual many-orders-per-settlement pattern; a background job queue for larger batches; multi-tenant support.

**15. Why is this better than existing solutions?**
Most visible alternatives in this space are either fully manual (spreadsheets) or a black-box "AI reconciliation" claim with no visible reasoning. This system's differentiator is that every automated decision is explainable and audited — the confidence score shown to a user is the literal number the decision policy used, not a cosmetic percentage.

**16. How would this become a production product?**
Real Razorpay API integration first (removing the CSV-upload simplification), then the settlement-batching model correction, then background processing for scale — in that order, because each of those is a scoped, well-understood engineering task, not a research problem.

**17. What's the hardest part you got wrong and had to fix?**
A real data-plumbing bug: the fuzzy matcher computed a genuine gap amount but only embedded it in a display string, never passed it as structured data. The LLM correctly noticed the gap value was missing from its input and started narrating that absence ("no gap amount was calculated") back to the user — technically accurate, operationally embarrassing. Traced through three files (`fuzzyMatch.js` → `matchAll.js` → `runMatchingPipeline.js`) and fixed by threading the real value through, verified against live output before and after.

**18. Why `evaluate.js` and not `evaluate.py`?**
The entire matching engine is JavaScript; a Python evaluation script would need to shell out to Node (or vice versa) to actually exercise the real matching logic, adding a cross-language failure point for zero benefit. Documented explicitly in the README as a disclosed, reasoned deviation from the original plan — the same category of decision as choosing MongoDB over a relational database on Day 1.

**19. How confident are you in the 100% evaluation numbers, really?**
Confident in what they actually claim, and explicit about what they don't. They prove the engine correctly implements its own design — every documented category caught with zero false positives/negatives, verified across two different seeds and sample sizes with identical results, not one lucky run. They are not a claim about generalizing to real-world discrepancy patterns beyond the five modeled categories. Both halves of that answer are in the README.

**20. What's your confidence threshold reasoning — why 0.90 for auto-resolve?**
A round, defensible, conservative starting point, documented as a named constant in `decisionPolicy.js` rather than a hidden magic number — explicitly not claimed as tuned against real operational cost data, since none exists yet for a hackathon project. The important property isn't the exact number, it's that fuzzy matches are structurally capped below it regardless of where it's set.

**21. What happens with a genuinely ambiguous case your system has never seen?**
It falls through to `flag_for_review` — the deliberate safe default in the decision policy when nothing else applies. The system doesn't have a "confidently wrong" failure mode by design; low confidence always routes to a human rather than guessing.

**22. Did you test this on a real device, or just a browser resize?**
Both, and they disagreed once. A browser-resize check missed that the sidebar had no responsive behavior at all; a real phone screenshot showed it consuming roughly half the screen width. Fixed by replacing the fixed sidebar with a horizontal nav bar below the `sm` breakpoint, then re-verified on the same physical device.

**23. What's your test coverage actually cover?**
23 unit tests across 5 suites: exact/fuzzy/split matching logic, the decision policy's four branches (including the override case — high confidence but high value still escalates), and the LLM agent layer (including a mocked timeout using a real `AbortController`, and a test proving the LLM can't override decision fields even when it tries to). Not covered: end-to-end integration tests against a live database — those were run manually and verified via screenshots at each major milestone instead.

**24. What was the single riskiest technical decision, in hindsight?**
Keeping the matching engine as pure, DB-agnostic functions from Day 1. It paid for itself directly: a Day 6 settlement-schema realignment to match Razorpay's real field names required changing exactly one file (`parseCsv.js`) — the matching logic itself didn't know or care that the column names had changed underneath it.

**25. If a merchant's data is messier than your five categories, what breaks?**
Anything not matching one of the five modeled patterns falls into `flag_for_review` via the safe-default path (see Q21) — it doesn't crash or misresolve, but it also doesn't get the specific, helpful explanation a modeled category gets. That's a real, named limitation: the system's explanatory quality is currently scoped to known failure modes, not fully general.
