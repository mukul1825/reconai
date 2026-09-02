import { Link } from "react-router-dom";
import { ArrowRight, GitBranch, ShieldCheck, ScrollText } from "lucide-react";
import ConfidenceBar from "../components/ConfidenceBar";
import { MatchTypeBadge, ActionBadge } from "../components/Badges";
import { isAuthed } from "../api/client";

/**
 * The entry point - what a recruiter actually sees first, before any auth
 * wall. The preview panel below renders the SAME ConfidenceBar/badge
 * components used on the real Exceptions page with sample data, not a
 * screenshot or a hand-drawn mockup. That's deliberate: it's an honest
 * preview (what you see is literally the real UI), and it costs nothing
 * extra to build since nothing here needed designing from scratch.
 */

const SAMPLE_ROWS = [
  { matchType: "exact", confidence: 1.0, action: "auto_resolve", note: "Order 00042 — ₹4,860 settled, UTR matched" },
  { matchType: "fuzzy", confidence: 0.85, action: "flag_for_review", note: "Order 00017 — ₹216.88 gap, fee not netted in report" },
  { matchType: "split", confidence: 0.95, action: "auto_resolve", note: "Order 00058 — settled across 2 records, reconciled" },
];

const VALUE_PROPS = [
  {
    icon: GitBranch,
    title: "Matches, not guesses",
    body: "Exact, fuzzy, and split-settlement matching — each with an explicit confidence score, never a black box.",
  },
  {
    icon: ShieldCheck,
    title: "Nothing auto-approves blindly",
    body: "A confidence ceiling keeps inferred matches from ever outranking verified ones. High-value orders always reach a human.",
  },
  {
    icon: ScrollText,
    title: "Every decision, logged",
    body: "Auto-resolved or human-reviewed, every match writes a timestamped, reproducible audit entry.",
  },
];

export default function LandingPage() {
  const destination = isAuthed() ? "/upload" : "/login";

  return (
    <div className="min-h-screen bg-paper">
      <header className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
        <span className="font-semibold text-[15px] tracking-tight">ReconAI</span>
        <Link
          to={destination}
          className="text-sm font-medium text-subtle hover:text-ink transition-colors"
        >
          {isAuthed() ? "Go to app" : "Sign in"}
        </Link>
      </header>

      <main className="max-w-5xl mx-auto px-6 pt-10 pb-20">
        <div className="max-w-2xl">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-ink leading-tight">
            Reconciliation your finance team can actually trust.
          </h1>
          <p className="text-base text-subtle mt-4 leading-relaxed">
            ReconAI matches your bank statement, settlement report, and ledger — resolves what it's
            confident about, explains what it isn't, and leaves nothing unaccounted for.
          </p>
          <div className="flex items-center gap-3 mt-7">
            <Link
              to={destination}
              className="inline-flex items-center gap-1.5 bg-accent hover:bg-accent-hover text-white text-sm font-medium px-4 py-2.5 rounded transition-colors"
            >
              Get started <ArrowRight size={15} />
            </Link>
            <span className="text-xs text-subtle">No credit card. Test-mode data only.</span>
          </div>
        </div>

        {/* Live preview panel - real components, sample data */}
        <div className="mt-14 bg-surface border border-line rounded-lg overflow-hidden max-w-3xl">
          <div className="px-4 py-2.5 border-b border-line bg-paper">
            <p className="text-xs font-medium text-subtle">Exceptions — sample</p>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {SAMPLE_ROWS.map((row, i) => (
                <tr key={i} className={i !== SAMPLE_ROWS.length - 1 ? "border-b border-line" : ""}>
                  <td className="px-4 py-3 w-24">
                    <MatchTypeBadge type={row.matchType} />
                  </td>
                  <td className="px-4 py-3 w-32">
                    <ConfidenceBar value={row.confidence} size="small" />
                  </td>
                  <td className="px-4 py-3 w-44">
                    <ActionBadge action={row.action} />
                  </td>
                  <td className="px-4 py-3 text-subtle">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid sm:grid-cols-3 gap-6 mt-16 max-w-3xl">
          {VALUE_PROPS.map(({ icon: Icon, title, body }) => (
            <div key={title}>
              <Icon size={18} className="text-accent" strokeWidth={2} />
              <p className="text-sm font-medium text-ink mt-2.5">{title}</p>
              <p className="text-sm text-subtle mt-1 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
