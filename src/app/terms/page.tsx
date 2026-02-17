import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms of Service for MyGang.ai, the AI-powered group chat application operated by Altcorp.",
  alternates: { canonical: "/terms" },
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

export default function TermsOfServicePage() {
  return (
    <main className="min-h-dvh bg-background text-foreground px-4 sm:px-6 py-10 pt-[calc(env(safe-area-inset-top)+2.5rem)] pb-[calc(env(safe-area-inset-bottom)+2.5rem)]">
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
                src="/logo.png"
                alt="MyGang.ai logo"
                width={48}
                height={48}
                className="rounded-xl"
                priority
              />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
                Terms of Service
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                MyGang.ai, operated by Altcorp
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            <strong>Last Updated:</strong> February 18, 2026
          </p>
        </header>

        {/* body */}
        <div className="rounded-2xl border border-border/50 bg-muted/40 p-5 sm:p-8">
          <p className="text-muted-foreground leading-relaxed mb-6">
            Welcome to <strong className="text-foreground">MyGang.ai</strong>{" "}
            (&ldquo;Service&rdquo;, &ldquo;Platform&rdquo;, &ldquo;Application&rdquo;,
            or &ldquo;App&rdquo;), an AI-powered group chat application owned
            and operated by{" "}
            <strong className="text-foreground">
              Altcorp
            </strong>{" "}
            (&ldquo;Company&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or
            &ldquo;our&rdquo;). These Terms of Service (&ldquo;Terms&rdquo;,
            &ldquo;Agreement&rdquo;) govern your access to and use of the
            MyGang.ai website, applications, APIs, and all related services.
            Please read these Terms carefully before using our Service.
          </p>

          {/* -------------------------------------------------- */}
          {/* 1 */}
          {/* -------------------------------------------------- */}
          <Section id="acceptance" number={1} title="Acceptance of Terms">
            <p>
              By accessing, browsing, or using MyGang.ai in any manner, you
              (&ldquo;User&rdquo;, &ldquo;you&rdquo;, or &ldquo;your&rdquo;)
              acknowledge that you have read, understood, and agree to be bound
              by these Terms and our{" "}
              <Link href="/privacy" className="underline text-foreground hover:text-foreground/80">
                Privacy Policy
              </Link>
              , which is incorporated herein by reference. If you do not agree to
              these Terms, you must immediately cease all use of the Service.
            </p>
            <p>
              Your continued use of the Service following the posting of any
              changes to these Terms constitutes acceptance of those changes.
            </p>
          </Section>

          {/* -------------------------------------------------- */}
          {/* 2 */}
          {/* -------------------------------------------------- */}
          <Section id="eligibility" number={2} title="Eligibility">
            <p>
              You must be at least <strong className="text-foreground">13 years of age</strong> to
              use this Service. If you are between 13 and 18 years of age (or the
              age of legal majority in your jurisdiction), you may only use the
              Service with the consent and supervision of a parent or legal
              guardian who agrees to be bound by these Terms.
            </p>
            <p>
              By using the Service, you represent and warrant that you meet the
              applicable age requirements and have the legal capacity to enter
              into this Agreement. If you are using the Service on behalf of an
              organization, you represent that you have the authority to bind
              that organization to these Terms.
            </p>
            <p>
              We reserve the right to request proof of age or parental consent at
              any time and to suspend or terminate accounts that do not comply
              with this section.
            </p>
          </Section>

          {/* -------------------------------------------------- */}
          {/* 3 */}
          {/* -------------------------------------------------- */}
          <Section
            id="account"
            number={3}
            title="Account Registration and Security"
          >
            <p>
              To access certain features of the Service, you must create an
              account. You may register using an email address and password, or
              through third-party authentication providers such as Google OAuth.
              You agree to provide accurate, current, and complete information
              during registration and to keep your account information
              up-to-date.
            </p>
            <p>
              You are solely responsible for maintaining the confidentiality of
              your account credentials and for all activities that occur under
              your account, whether or not authorized by you. You agree to
              notify us immediately at{" "}
              <a
                href="mailto:pashaseenainc@gmail.com"
                className="underline text-foreground hover:text-foreground/80"
              >
                pashaseenainc@gmail.com
              </a>{" "}
              of any unauthorized use of your account or any other breach of
              security.
            </p>
            <p>
              We will not be liable for any loss or damage arising from your
              failure to protect your account credentials. We reserve the right
              to suspend, disable, or delete your account at our sole discretion,
              with or without notice, for any reason including but not limited to
              a violation of these Terms.
            </p>
          </Section>

          {/* -------------------------------------------------- */}
          {/* 4 */}
          {/* -------------------------------------------------- */}
          <Section
            id="service-description"
            number={4}
            title="Description of Service"
          >
            <p>
              MyGang.ai is an AI-powered group chat application that allows
              users to interact with artificially generated personas
              (&ldquo;AI Personas&rdquo;, &ldquo;AI Characters&rdquo;, or
              &ldquo;Gang Members&rdquo;). Users select AI personas to form a
              personalized &ldquo;gang&rdquo; and engage in group conversations
              with those personas.
            </p>
            <p>
              <strong className="text-foreground">
                AI Personas are not real people.
              </strong>{" "}
              They are fictional characters whose responses are generated by
              third-party artificial intelligence models and large language
              models (&ldquo;AI Models&rdquo;). Any resemblance to real persons,
              living or dead, is purely coincidental. AI Personas do not have
              consciousness, emotions, intentions, or agency.
            </p>
            <p>
              The Service is provided for entertainment, informational, and
              creative purposes only. The responses generated by AI Personas
              should not be relied upon for any purpose requiring accuracy,
              professional judgment, or factual correctness.
            </p>
          </Section>

          {/* -------------------------------------------------- */}
          {/* 5 */}
          {/* -------------------------------------------------- */}
          <Section
            id="ai-content"
            number={5}
            title="AI-Generated Content Disclaimers"
          >
            <p>
              All content generated by AI Personas on MyGang.ai is produced by
              automated AI systems and is <strong className="text-foreground">not</strong> reviewed,
              verified, endorsed, or guaranteed by Altcorp. You acknowledge and
              agree that:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li>
                AI-generated content may be <strong className="text-foreground">inaccurate,
                incomplete, misleading, offensive, or entirely fabricated</strong>.
                AI Models can and do produce false information presented with
                apparent confidence (&ldquo;hallucinations&rdquo;).
              </li>
              <li>
                AI-generated content does <strong className="text-foreground">NOT</strong> constitute
                professional advice of any kind, including but not limited to
                medical advice, legal advice, financial advice, tax advice,
                therapeutic or psychological counseling, or any other
                professional service.
              </li>
              <li>
                You must <strong className="text-foreground">not</strong> rely on AI-generated
                content as a substitute for consultation with qualified
                professionals. If you require medical, legal, financial, or
                other professional assistance, you should consult a licensed
                professional in the applicable field.
              </li>
              <li>
                AI Personas are fictional characters. Their stated
                &ldquo;opinions&rdquo;, &ldquo;beliefs&rdquo;,
                &ldquo;recommendations&rdquo;, and &ldquo;knowledge&rdquo; are
                algorithmically generated outputs and do not reflect the views,
                opinions, or endorsements of Altcorp or its affiliates.
              </li>
              <li>
                Altcorp makes no representation or warranty regarding the
                accuracy, reliability, completeness, or timeliness of any
                AI-generated content.
              </li>
              <li>
                Any actions you take based on AI-generated content are at your
                own risk. Altcorp shall not be liable for any damages or losses
                resulting from your reliance on AI-generated content.
              </li>
            </ul>
          </Section>

          {/* -------------------------------------------------- */}
          {/* 6 */}
          {/* -------------------------------------------------- */}
          <Section
            id="acceptable-use"
            number={6}
            title="Acceptable Use Policy"
          >
            <p>
              You agree to use the Service only for lawful purposes and in
              accordance with these Terms. You shall not:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li>
                Use the Service for any illegal, harmful, fraudulent,
                discriminatory, or otherwise objectionable purpose.
              </li>
              <li>
                Attempt to elicit, &ldquo;jailbreak&rdquo;, or otherwise
                manipulate AI Personas into generating content that is illegal,
                harmful, threatening, abusive, harassing, defamatory, obscene,
                sexually exploitative (including any content involving minors),
                or otherwise objectionable.
              </li>
              <li>
                Use the Service to generate spam, phishing content,
                misinformation, disinformation, malware, or any content intended
                to deceive or harm others.
              </li>
              <li>
                Impersonate any person or entity, or falsely represent your
                affiliation with any person or entity.
              </li>
              <li>
                Interfere with, disrupt, or place an undue burden on the
                Service, its servers, or its networks, including through
                denial-of-service attacks, automated scraping, or unauthorized
                API access.
              </li>
              <li>
                Attempt to gain unauthorized access to any portion of the
                Service, other accounts, computer systems, or networks connected
                to the Service.
              </li>
              <li>
                Reverse engineer, decompile, disassemble, or otherwise attempt
                to derive the source code or underlying algorithms of the
                Service.
              </li>
              <li>
                Use the Service to develop, train, or improve a competing AI
                product or service, or to systematically collect or harvest data
                from the Service.
              </li>
              <li>
                Violate any applicable local, state, national, or international
                law or regulation.
              </li>
              <li>
                Use the Service in any manner that could damage, disable,
                overburden, or impair the Service.
              </li>
            </ul>
            <p>
              We reserve the right to investigate and take appropriate action
              against any violations of this section, including without
              limitation removing content, suspending or terminating accounts,
              and reporting violations to law enforcement authorities.
            </p>
          </Section>

          {/* -------------------------------------------------- */}
          {/* 7 */}
          {/* -------------------------------------------------- */}
          <Section
            id="intellectual-property"
            number={7}
            title="Intellectual Property"
          >
            <p>
              The Service, including but not limited to its design, software,
              code, text, graphics, logos, icons, images, audio, video, data
              compilations, user interface, AI Persona names and
              characterizations, and all other content and materials
              (collectively, &ldquo;Altcorp Materials&rdquo;), are the
              exclusive property of Altcorp or its licensors and are protected
              by copyright, trademark, patent, trade secret, and other
              intellectual property laws.
            </p>
            <p>
              You are granted a limited, non-exclusive, non-transferable,
              revocable license to access and use the Service for your personal,
              non-commercial use, subject to these Terms. This license does not
              include the right to: (a) modify, reproduce, distribute, or
              create derivative works based on the Service; (b) sell, resell, or
              commercially exploit the Service; or (c) use data mining, robots,
              or similar data gathering or extraction methods.
            </p>
            <p>
              <strong className="text-foreground">
                AI-Generated Content Ownership:
              </strong>{" "}
              As between you and Altcorp, Altcorp retains all right, title, and
              interest in the AI Models, algorithms, and systems used to
              generate content. To the extent that AI-generated content may be
              subject to intellectual property protection under applicable law,
              you acknowledge that the ownership and rights to such content may
              be uncertain and subject to evolving legal standards. Altcorp
              makes no representations regarding your ownership rights in
              AI-generated content and expressly disclaims any obligation to
              assign or transfer such rights. You may not claim that
              AI-generated content represents human-authored original work.
            </p>
          </Section>

          {/* -------------------------------------------------- */}
          {/* 8 */}
          {/* -------------------------------------------------- */}
          <Section id="user-content" number={8} title="User Content and Data">
            <p>
              &ldquo;User Content&rdquo; means any text, messages, images,
              data, or other content that you submit, post, or transmit through
              the Service, including your chat messages and inputs to AI
              Personas.
            </p>
            <p>
              You retain ownership of your User Content to the extent you hold
              rights therein. By submitting User Content to the Service, you
              grant Altcorp a worldwide, non-exclusive, royalty-free,
              sublicensable, and transferable license to use, reproduce, modify,
              adapt, publish, translate, distribute, and display your User
              Content solely for the purposes of operating, improving, and
              providing the Service, including for AI model improvement and
              safety research.
            </p>
            <p>
              You represent and warrant that you own or have the necessary
              rights and permissions to submit your User Content and to grant
              the license described above, and that your User Content does not
              violate any third party&apos;s rights or any applicable law.
            </p>
            <p>
              We may, but are not obligated to, monitor, review, or remove User
              Content at our sole discretion, for any reason or no reason, with
              or without notice.
            </p>
          </Section>

          {/* -------------------------------------------------- */}
          {/* 9 */}
          {/* -------------------------------------------------- */}
          <Section id="privacy" number={9} title="Privacy">
            <p>
              Your use of the Service is also governed by our{" "}
              <Link href="/privacy" className="underline text-foreground hover:text-foreground/80">
                Privacy Policy
              </Link>
              , which describes how we collect, use, store, and share your
              personal information. By using the Service, you consent to the
              collection and use of your information as described in the Privacy
              Policy.
            </p>
            <p>
              We use third-party services including Supabase for authentication
              and data storage, and Google OAuth for social login. Your use of
              these third-party services is subject to their respective terms
              and privacy policies.
            </p>
            <p>
              Your chat messages and interactions with AI Personas may be
              stored, processed, and transmitted to third-party AI model
              providers to generate responses. While we implement reasonable
              security measures, we cannot guarantee absolute security of your
              data. You should not share sensitive personal information,
              financial data, passwords, or other confidential information
              through the Service.
            </p>
          </Section>

          {/* -------------------------------------------------- */}
          {/* 10 */}
          {/* -------------------------------------------------- */}
          <Section
            id="warranties"
            number={10}
            title="Disclaimers of Warranties"
          >
            <p className="uppercase font-semibold text-foreground text-sm tracking-wide">
              THE SERVICE IS PROVIDED ON AN &ldquo;AS IS&rdquo; AND &ldquo;AS
              AVAILABLE&rdquo; BASIS, WITHOUT ANY WARRANTIES OF ANY KIND,
              EITHER EXPRESS OR IMPLIED.
            </p>
            <p>
              TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, ALTCORP
              EXPRESSLY DISCLAIMS ALL WARRANTIES, WHETHER EXPRESS, IMPLIED,
              STATUTORY, OR OTHERWISE, INCLUDING BUT NOT LIMITED TO:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li>
                IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
                PURPOSE, TITLE, AND NON-INFRINGEMENT.
              </li>
              <li>
                ANY WARRANTY THAT THE SERVICE WILL BE UNINTERRUPTED, TIMELY,
                SECURE, ERROR-FREE, OR FREE OF VIRUSES OR OTHER HARMFUL
                COMPONENTS.
              </li>
              <li>
                ANY WARRANTY REGARDING THE ACCURACY, RELIABILITY, COMPLETENESS,
                OR QUALITY OF ANY CONTENT, INCLUDING AI-GENERATED CONTENT.
              </li>
              <li>
                ANY WARRANTY THAT THE SERVICE WILL MEET YOUR REQUIREMENTS OR
                EXPECTATIONS.
              </li>
              <li>
                ANY WARRANTY ARISING FROM COURSE OF DEALING, COURSE OF
                PERFORMANCE, OR USAGE OF TRADE.
              </li>
            </ul>
            <p>
              YOU ACKNOWLEDGE THAT YOU USE THE SERVICE AT YOUR SOLE RISK. NO
              ADVICE OR INFORMATION, WHETHER ORAL OR WRITTEN, OBTAINED BY YOU
              FROM ALTCORP OR THROUGH THE SERVICE SHALL CREATE ANY WARRANTY NOT
              EXPRESSLY STATED IN THESE TERMS.
            </p>
          </Section>

          {/* -------------------------------------------------- */}
          {/* 11 */}
          {/* -------------------------------------------------- */}
          <Section
            id="liability"
            number={11}
            title="Limitation of Liability"
          >
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT
              SHALL ALTCORP, ITS DIRECTORS, OFFICERS, EMPLOYEES, AGENTS,
              AFFILIATES, SUBSIDIARIES, LICENSORS, OR SERVICE PROVIDERS
              (COLLECTIVELY, THE &ldquo;ALTCORP PARTIES&rdquo;) BE LIABLE FOR
              ANY:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li>
                INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, PUNITIVE, OR
                EXEMPLARY DAMAGES.
              </li>
              <li>
                LOSS OF PROFITS, REVENUE, DATA, BUSINESS OPPORTUNITIES,
                GOODWILL, OR ANTICIPATED SAVINGS.
              </li>
              <li>
                DAMAGES ARISING FROM YOUR USE OF OR INABILITY TO USE THE
                SERVICE.
              </li>
              <li>
                DAMAGES ARISING FROM ANY AI-GENERATED CONTENT, INCLUDING
                CONTENT THAT IS INACCURATE, OFFENSIVE, OR HARMFUL.
              </li>
              <li>
                DAMAGES ARISING FROM UNAUTHORIZED ACCESS TO OR ALTERATION OF
                YOUR DATA OR TRANSMISSIONS.
              </li>
              <li>
                DAMAGES ARISING FROM CONDUCT OF ANY THIRD PARTY ON THE SERVICE.
              </li>
            </ul>
            <p>
              IN NO EVENT SHALL THE AGGREGATE LIABILITY OF THE ALTCORP PARTIES
              EXCEED THE GREATER OF: (A) THE TOTAL AMOUNT YOU HAVE PAID TO
              ALTCORP FOR THE SERVICE IN THE TWELVE (12) MONTHS PRECEDING THE
              EVENT GIVING RISE TO THE CLAIM; OR (B) ONE HUNDRED UNITED STATES
              DOLLARS (USD $100.00).
            </p>
            <p>
              THE LIMITATIONS IN THIS SECTION APPLY REGARDLESS OF THE THEORY OF
              LIABILITY, WHETHER BASED ON WARRANTY, CONTRACT, TORT (INCLUDING
              NEGLIGENCE), STRICT LIABILITY, OR ANY OTHER LEGAL THEORY, AND
              EVEN IF THE ALTCORP PARTIES HAVE BEEN ADVISED OF THE POSSIBILITY
              OF SUCH DAMAGES.
            </p>
            <p>
              SOME JURISDICTIONS DO NOT ALLOW THE EXCLUSION OR LIMITATION OF
              CERTAIN DAMAGES. IN SUCH JURISDICTIONS, OUR LIABILITY SHALL BE
              LIMITED TO THE FULLEST EXTENT PERMITTED BY LAW.
            </p>
          </Section>

          {/* -------------------------------------------------- */}
          {/* 12 */}
          {/* -------------------------------------------------- */}
          <Section id="indemnification" number={12} title="Indemnification">
            <p>
              You agree to indemnify, defend, and hold harmless the Altcorp
              Parties from and against any and all claims, demands, actions,
              liabilities, damages, losses, costs, and expenses (including
              reasonable attorneys&apos; fees and court costs) arising out of or
              relating to:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li>Your use of, or inability to use, the Service.</li>
              <li>Your violation of these Terms.</li>
              <li>
                Your violation of any applicable law, rule, or regulation.
              </li>
              <li>
                Your User Content or any content you submit through the
                Service.
              </li>
              <li>
                Your violation of any third party&apos;s rights, including
                intellectual property, privacy, or publicity rights.
              </li>
              <li>
                Any claim that your use of the Service caused damage to a third
                party.
              </li>
              <li>
                Any reliance you place on AI-generated content provided through
                the Service.
              </li>
            </ul>
            <p>
              This indemnification obligation shall survive the termination of
              these Terms and your use of the Service.
            </p>
          </Section>

          {/* -------------------------------------------------- */}
          {/* 13 */}
          {/* -------------------------------------------------- */}
          <Section
            id="modifications"
            number={13}
            title="Service Modifications and Termination"
          >
            <p>
              We reserve the right, at our sole discretion, to modify, suspend,
              discontinue, or terminate the Service (or any part thereof) at any
              time, with or without notice, for any reason. This includes the
              right to:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li>
                Add, remove, or modify AI Personas, features, or
                functionalities.
              </li>
              <li>
                Change the pricing, subscription plans, or availability of the
                Service.
              </li>
              <li>
                Impose limits on certain features or restrict access to parts or
                all of the Service.
              </li>
              <li>
                Suspend or terminate your account for any reason, including
                violation of these Terms, suspicious activity, extended periods
                of inactivity, or at our sole discretion.
              </li>
            </ul>
            <p>
              We shall not be liable to you or any third party for any
              modification, suspension, or discontinuation of the Service.
              Upon termination, your right to use the Service will immediately
              cease. Sections of these Terms that by their nature should survive
              termination shall survive, including but not limited to
              intellectual property provisions, disclaimers, limitations of
              liability, and indemnification.
            </p>
          </Section>

          {/* -------------------------------------------------- */}
          {/* 14 */}
          {/* -------------------------------------------------- */}
          <Section id="force-majeure" number={14} title="Force Majeure">
            <p>
              Altcorp shall not be liable for any failure or delay in performing
              its obligations under these Terms where such failure or delay
              results from circumstances beyond its reasonable control,
              including but not limited to: acts of God, natural disasters,
              pandemics, epidemics, war, terrorism, riots, embargoes,
              government actions or orders, cyberattacks, power outages,
              telecommunications failures, internet disruptions, third-party
              service provider outages (including AI model providers, cloud
              infrastructure, or authentication services), labor disputes,
              fires, floods, earthquakes, or other force majeure events.
            </p>
          </Section>

          {/* -------------------------------------------------- */}
          {/* 15 */}
          {/* -------------------------------------------------- */}
          <Section id="governing-law" number={15} title="Governing Law">
            <p>
              These Terms and any dispute arising out of or relating to them
              shall be governed by and construed in accordance with the laws of
              the jurisdiction in which Altcorp is incorporated or maintains its
              principal place of business, without regard to its conflict of
              law provisions.
            </p>
            <p>
              You agree that any legal action or proceeding relating to these
              Terms shall be brought exclusively in the courts located in the
              jurisdiction referenced above, and you consent to the personal
              jurisdiction of such courts.
            </p>
          </Section>

          {/* -------------------------------------------------- */}
          {/* 16 */}
          {/* -------------------------------------------------- */}
          <Section
            id="dispute-resolution"
            number={16}
            title="Dispute Resolution"
          >
            <p>
              <strong className="text-foreground">
                Informal Resolution:
              </strong>{" "}
              Before initiating any formal proceedings, you agree to first
              contact us at{" "}
              <a
                href="mailto:pashaseenainc@gmail.com"
                className="underline text-foreground hover:text-foreground/80"
              >
                pashaseenainc@gmail.com
              </a>{" "}
              and attempt to resolve the dispute informally for at least thirty
              (30) days.
            </p>
            <p>
              <strong className="text-foreground">
                Binding Arbitration:
              </strong>{" "}
              If informal resolution is unsuccessful, any dispute, controversy,
              or claim arising out of or relating to these Terms or the Service
              shall be resolved through binding arbitration administered in
              accordance with the rules of a recognized arbitration body in the
              jurisdiction of Altcorp&apos;s principal place of business. The
              arbitration shall be conducted in English. The arbitrator&apos;s
              decision shall be final and binding.
            </p>
            <p>
              <strong className="text-foreground">
                Class Action Waiver:
              </strong>{" "}
              TO THE FULLEST EXTENT PERMITTED BY LAW, YOU AGREE THAT ANY
              DISPUTE RESOLUTION PROCEEDINGS WILL BE CONDUCTED ONLY ON AN
              INDIVIDUAL BASIS AND NOT IN A CLASS, CONSOLIDATED, OR
              REPRESENTATIVE ACTION. You waive any right to participate in a
              class action lawsuit or class-wide arbitration against Altcorp.
            </p>
            <p>
              <strong className="text-foreground">
                Exceptions:
              </strong>{" "}
              Notwithstanding the above, either party may seek injunctive or
              other equitable relief in any court of competent jurisdiction to
              prevent the actual or threatened infringement, misappropriation,
              or violation of intellectual property rights.
            </p>
          </Section>

          {/* -------------------------------------------------- */}
          {/* 17 */}
          {/* -------------------------------------------------- */}
          <Section id="severability" number={17} title="Severability">
            <p>
              If any provision of these Terms is held to be invalid, illegal, or
              unenforceable by a court of competent jurisdiction, the remaining
              provisions shall remain in full force and effect. The invalid or
              unenforceable provision shall be modified to the minimum extent
              necessary to make it valid, legal, and enforceable while
              preserving its original intent as closely as possible.
            </p>
          </Section>

          {/* -------------------------------------------------- */}
          {/* 18 */}
          {/* -------------------------------------------------- */}
          <Section
            id="entire-agreement"
            number={18}
            title="Entire Agreement"
          >
            <p>
              These Terms, together with the Privacy Policy and any other legal
              notices, policies, or agreements published by Altcorp on the
              Service, constitute the entire agreement between you and Altcorp
              regarding your use of the Service. These Terms supersede all prior
              or contemporaneous communications, proposals, and
              representations, whether oral or written, between you and Altcorp
              with respect to the Service.
            </p>
            <p>
              No waiver of any term or condition of these Terms shall be deemed
              a further or continuing waiver of such term or condition or a
              waiver of any other term or condition. Our failure to exercise or
              enforce any right or provision of these Terms shall not constitute
              a waiver of such right or provision.
            </p>
          </Section>

          {/* -------------------------------------------------- */}
          {/* 19 */}
          {/* -------------------------------------------------- */}
          <Section
            id="uptime"
            number={19}
            title="No Guarantee of Uptime or Service Continuity"
          >
            <p>
              We do not guarantee that the Service will be available at all
              times or without interruption. The Service may experience
              downtime due to maintenance, updates, server failures,
              third-party service disruptions (including AI model provider
              outages), or other causes beyond our control.
            </p>
            <p>
              We make no commitment to any particular uptime percentage,
              service level agreement (SLA), or response time. We shall not be
              liable for any loss, damage, or inconvenience caused by any
              downtime, interruption, or unavailability of the Service.
            </p>
            <p>
              We reserve the right to perform scheduled or unscheduled
              maintenance at any time without prior notice.
            </p>
          </Section>

          {/* -------------------------------------------------- */}
          {/* 20 */}
          {/* -------------------------------------------------- */}
          <Section
            id="refusal"
            number={20}
            title="Right to Refuse Service"
          >
            <p>
              Altcorp reserves the absolute right to refuse, suspend, or
              terminate service to any individual or entity, for any reason or
              no reason, at any time, with or without notice. This includes but
              is not limited to users who:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li>Violate these Terms or any applicable policies.</li>
              <li>
                Engage in abusive, fraudulent, or harmful behavior.
              </li>
              <li>
                Pose a risk to the security, integrity, or availability of the
                Service.
              </li>
              <li>
                Are located in jurisdictions where provision of the Service
                would violate applicable laws or sanctions.
              </li>
              <li>
                Have previously had their accounts terminated or suspended.
              </li>
            </ul>
          </Section>

          {/* -------------------------------------------------- */}
          {/* 21 */}
          {/* -------------------------------------------------- */}
          <Section
            id="modification-of-terms"
            number={21}
            title="Modification of Terms"
          >
            <p>
              We reserve the right to modify, amend, or update these Terms at
              any time, at our sole discretion. When we make changes, we will
              update the &ldquo;Last Updated&rdquo; date at the top of this
              page. We may, but are not obligated to, notify you of material
              changes through the Service interface, by email, or by other
              reasonable means.
            </p>
            <p>
              Your continued use of the Service after the effective date of any
              changes constitutes your acceptance of the modified Terms. If you
              do not agree to the modified Terms, you must stop using the
              Service and delete your account.
            </p>
            <p>
              It is your responsibility to review these Terms periodically for
              changes.
            </p>
          </Section>

          {/* -------------------------------------------------- */}
          {/* 22 */}
          {/* -------------------------------------------------- */}
          <Section id="contact" number={22} title="Contact Information">
            <p>
              If you have any questions, concerns, or complaints regarding
              these Terms or the Service, please contact us at:
            </p>
            <div className="rounded-xl border border-border/50 bg-background/50 p-4 space-y-2 text-sm">
              <p>
                <strong className="text-foreground">Altcorp</strong>
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
              <p>
                Support:{" "}
                <a
                  href="mailto:pashaseenainc@gmail.com"
                  className="underline text-foreground hover:text-foreground/80"
                >
                  pashaseenainc@gmail.com
                </a>
              </p>
              <p>
                Administration:{" "}
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
