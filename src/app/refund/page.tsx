import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy",
  description:
    "Refund and Cancellation Policy for MyGang.ai, the AI-powered group chat application operated by Altcorp.",
  alternates: { canonical: "/refund" },
};

/* ---------- helpers ---------- */

function Section({
  id,
  number,
  title,
  children,
}: {
  id: string;
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-xl font-bold mt-10 mb-3 text-foreground">
        {number}. {title}
      </h2>
      <div className="space-y-3 text-muted-foreground leading-relaxed">
        {children}
      </div>
    </section>
  );
}

/* ---------- page ---------- */

export default function RefundPolicyPage() {
  return (
    <main id="main-content" className="min-h-dvh bg-background text-foreground px-4 sm:px-6 py-10 pt-[calc(env(safe-area-inset-top)+2.5rem)] pb-[calc(env(safe-area-inset-bottom)+2.5rem)]">
      <div className="max-w-3xl mx-auto">
        {/* back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <span aria-hidden>&larr;</span> Back to Home
        </Link>

        {/* header */}
        <header className="mb-10">
          <div className="flex items-center gap-4 mb-4">
            <div className="animate-spin [animation-duration:12s]">
              <Image
                src="/logo.webp"
                alt="MyGang.ai logo"
                width={48}
                height={48}
                className="rounded-xl"
                priority
              />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
                Refund &amp; Cancellation Policy
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                MyGang.ai, operated by Altcorp
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            <strong>Last Updated:</strong> March 10, 2026
          </p>
        </header>

        {/* body */}
        <div className="rounded-2xl border border-border/50 bg-muted/40 p-5 sm:p-8">
          <p className="text-muted-foreground leading-relaxed mb-6">
            This Refund &amp; Cancellation Policy applies to all paid
            subscription plans offered on{" "}
            <strong className="text-foreground">MyGang.ai</strong>, operated by{" "}
            <strong className="text-foreground">Altcorp</strong>. Please read
            this policy carefully before purchasing a subscription.
          </p>

          {/* -------------------------------------------------- */}
          {/* 1 */}
          {/* -------------------------------------------------- */}
          <Section id="cancellation" number={1} title="Cancellation">
            <p>
              You may cancel your subscription at any time through your account
              settings or by contacting us at{" "}
              <a
                href="mailto:support@mygang.ai"
                className="underline text-foreground hover:text-foreground/80"
              >
                support@mygang.ai
              </a>
              . Upon cancellation, your subscription benefits will continue
              until the end of your current billing period. After that, your
              account will revert to the Free tier.
            </p>
            <p>
              Cancellation takes effect at the end of the current billing
              cycle. You will not be charged for any subsequent billing periods
              after cancellation.
            </p>
          </Section>

          {/* -------------------------------------------------- */}
          {/* 2 */}
          {/* -------------------------------------------------- */}
          <Section id="refund-policy" number={2} title="Refund Policy">
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li>
                <strong className="text-foreground">No prorated refunds:</strong>{" "}
                We do not provide prorated refunds for any unused portion of a
                billing period. If you cancel mid-cycle, you retain access
                until the end of that period but will not receive a partial
                refund.
              </li>
              <li>
                <strong className="text-foreground">No change-of-mind refunds:</strong>{" "}
                As MyGang.ai is a digital subscription service, we do not
                offer refunds for change of mind once a subscription period
                has begun.
              </li>
              <li>
                <strong className="text-foreground">Discretionary refunds:</strong>{" "}
                Refunds may be issued at Altcorp&apos;s sole discretion in
                cases of verified service defects or technical issues that
                prevented you from using the Service during your billing
                period.
              </li>
            </ul>
          </Section>

          {/* -------------------------------------------------- */}
          {/* 3 */}
          {/* -------------------------------------------------- */}
          <Section id="cooling-off" number={3} title="7-Day Cooling-Off Period">
            <p>
              First-time subscribers are entitled to a{" "}
              <strong className="text-foreground">7-day cooling-off period</strong>{" "}
              from the date of their initial subscription purchase. If you are
              unsatisfied with the Service for any reason during this period,
              you may request a full refund by contacting us at{" "}
              <a
                href="mailto:support@mygang.ai"
                className="underline text-foreground hover:text-foreground/80"
              >
                support@mygang.ai
              </a>
              .
            </p>
            <p>
              This cooling-off period applies only to your first subscription
              purchase on MyGang.ai and does not apply to renewals,
              resubscriptions, or plan upgrades.
            </p>
          </Section>

          {/* -------------------------------------------------- */}
          {/* 4 */}
          {/* -------------------------------------------------- */}
          <Section id="how-to-request" number={4} title="How to Request a Refund">
            <p>
              To request a refund, please contact us at{" "}
              <a
                href="mailto:support@mygang.ai"
                className="underline text-foreground hover:text-foreground/80"
              >
                support@mygang.ai
              </a>{" "}
              with the following information:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li>Your registered email address</li>
              <li>Date of purchase</li>
              <li>Reason for the refund request</li>
              <li>Any relevant screenshots or details of technical issues (if applicable)</li>
            </ul>
          </Section>

          {/* -------------------------------------------------- */}
          {/* 5 */}
          {/* -------------------------------------------------- */}
          <Section id="processing" number={5} title="Refund Processing">
            <p>
              All refund requests are reviewed and processed within{" "}
              <strong className="text-foreground">5&ndash;7 business days</strong>{" "}
              of receipt. Approved refunds will be issued to the{" "}
              <strong className="text-foreground">original payment method</strong>{" "}
              used for the purchase. Depending on your payment provider, it may
              take additional time for the refund to appear in your account.
            </p>
          </Section>

          {/* -------------------------------------------------- */}
          {/* 6 */}
          {/* -------------------------------------------------- */}
          <Section id="payment-processor" number={6} title="Payment Processor">
            <p>
              All payments for MyGang.ai subscriptions are processed through{" "}
              <strong className="text-foreground">Dodo Payments</strong>. Refunds
              are subject to Dodo Payments&apos; processing timelines and
              policies in addition to this policy.
            </p>
          </Section>

          {/* -------------------------------------------------- */}
          {/* 7 */}
          {/* -------------------------------------------------- */}
          <Section id="contact" number={7} title="Contact Us">
            <p>
              If you have any questions about this Refund &amp; Cancellation
              Policy, please contact us:
            </p>
            <div className="rounded-xl border border-border/50 bg-background/50 p-4 space-y-2 text-sm">
              <p>
                <strong className="text-foreground">Altcorp</strong>
              </p>
              <p>
                Refund Requests &amp; Support:{" "}
                <a
                  href="mailto:support@mygang.ai"
                  className="underline text-foreground hover:text-foreground/80"
                >
                  support@mygang.ai
                </a>
              </p>
              <p>
                General Inquiries:{" "}
                <a
                  href="mailto:pashaseenainc@gmail.com"
                  className="underline text-foreground hover:text-foreground/80"
                >
                  pashaseenainc@gmail.com
                </a>
              </p>
            </div>
          </Section>

          {/* -------------------------------------------------- */}
          {/* footer */}
          {/* -------------------------------------------------- */}
          <hr className="border-border/50 my-10" />
          <p className="text-xs text-muted-foreground text-center">
            &copy; {new Date().getFullYear()} Altcorp. All rights reserved.
            MyGang.ai and the MyGang logo are trademarks of Altcorp.
          </p>
        </div>
      </div>
    </main>
  );
}
