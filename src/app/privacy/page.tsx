import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Privacy Policy for MyGang.ai, learn how we collect, use, and protect your data.",
  alternates: {
    canonical: "/privacy",
  },
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-dvh bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border/50 bg-muted/20 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            &larr; Back to Home
          </Link>
          <div className="flex items-center gap-2">
            <div className="animate-spin-slow">
              <Image
                src="/logo.png"
                alt="MyGang.ai"
                width={28}
                height={28}
                className="object-contain"
              />
            </div>
            <span className="text-sm font-semibold">MyGang.ai</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <article className="max-w-4xl mx-auto px-6 py-12 pb-24">
        {/* Title Block */}
        <header className="mb-12">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
            Legal
          </p>
          <h1 className="text-4xl font-black tracking-tight mb-3">
            Privacy Policy
          </h1>
          <p className="text-muted-foreground text-sm">
            Last Updated: February 18, 2026
          </p>
          <p className="text-muted-foreground text-sm mt-1">
            Effective Date: February 18, 2026
          </p>
        </header>

        <div className="space-y-10 text-[15px] leading-relaxed text-foreground/90">
          {/* 1. Introduction */}
          <Section id="introduction" title="1. Introduction">
            <p>
              Welcome to <strong>MyGang.ai</strong> (the &ldquo;Service&rdquo;,
              &ldquo;Platform&rdquo;, &ldquo;Application&rdquo;, or
              &ldquo;App&rdquo;), operated by <strong>Altcorp</strong>{" "}
              (&ldquo;Company&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or
              &ldquo;our&rdquo;). This Privacy Policy describes how we collect,
              use, disclose, and safeguard your information when you access or
              use our web application at{" "}
              <a
                href="https://mygang.ai"
                className="text-primary underline underline-offset-2 hover:text-primary/80"
              >
                https://mygang.ai
              </a>{" "}
              and any related services, features, or content (collectively, the
              &ldquo;Service&rdquo;).
            </p>
            <p>
              MyGang.ai is an AI-powered group chat application where users
              interact with artificial intelligence personas in a simulated
              group chat environment. By using the Service, you acknowledge that
              your messages and interactions are processed by AI systems, and
              you consent to the data practices described in this Privacy
              Policy.
            </p>
            <p>
              <strong>
                Please read this Privacy Policy carefully. By accessing or
                using the Service, you agree to the collection, use, and
                disclosure of your information as described herein. If you do
                not agree with the terms of this Privacy Policy, you must not
                access or use the Service.
              </strong>
            </p>
          </Section>

          {/* 2. Information We Collect */}
          <Section id="information-we-collect" title="2. Information We Collect">
            <SubSection title="2.1 Information You Provide Directly">
              <p>
                When you create an account, interact with the Service, or
                contact us, we may collect the following categories of personal
                information:
              </p>
              <ul className="list-disc pl-6 space-y-1.5 mt-3">
                <li>
                  <strong>Account Information:</strong> Email address, username,
                  display name, and password (hashed and salted; we never store
                  plaintext passwords).
                </li>
                <li>
                  <strong>Authentication Data:</strong> Information received
                  through third-party single sign-on providers (e.g., Google
                  OAuth), including your name, email address, and profile
                  picture URL, as permitted by your OAuth provider settings.
                </li>
                <li>
                  <strong>Chat Messages:</strong> All text messages you send
                  within the Service, including messages directed at AI personas
                  and any content shared in group chat sessions.
                </li>
                <li>
                  <strong>User Preferences and Settings:</strong> Gang
                  configurations, persona preferences, custom character names,
                  theme settings, and other customization choices you make
                  within the Application.
                </li>
                <li>
                  <strong>Support Communications:</strong> Information you
                  provide when contacting our support team, including email
                  correspondence and any attachments.
                </li>
              </ul>
            </SubSection>

            <SubSection title="2.2 Information Generated Through Use">
              <p>
                As you interact with the Service, we automatically generate and
                store certain derived data:
              </p>
              <ul className="list-disc pl-6 space-y-1.5 mt-3">
                <li>
                  <strong>User Memories:</strong> The Service extracts and
                  stores contextual memories from your conversations to improve
                  AI persona responses and provide a more personalized
                  experience. These memories are derived summaries and extracted
                  facts, not verbatim copies of your messages.
                </li>
                <li>
                  <strong>Embeddings:</strong> We generate and store vector
                  embeddings (mathematical representations) of your
                  interactions to enable semantic search and contextual
                  retrieval for improved AI responses.
                </li>
                <li>
                  <strong>Chat History:</strong> Complete records of your
                  conversations with AI personas, including timestamps, message
                  ordering, and session metadata.
                </li>
              </ul>
            </SubSection>

            <SubSection title="2.3 Information Collected Automatically">
              <p>
                When you access the Service, we may automatically collect
                certain technical and usage information:
              </p>
              <ul className="list-disc pl-6 space-y-1.5 mt-3">
                <li>
                  <strong>Device and Browser Information:</strong> Browser type
                  and version, operating system, device type, screen resolution,
                  and language preferences.
                </li>
                <li>
                  <strong>Usage Data:</strong> Pages visited, features used,
                  session duration, click patterns, and interaction frequency.
                </li>
                <li>
                  <strong>Network Information:</strong> IP address, approximate
                  geolocation (city/country level), referring URL, and internet
                  service provider.
                </li>
                <li>
                  <strong>Analytics Data:</strong> We use analytics tools to
                  collect aggregated data about how users interact with the
                  Service, including feature usage patterns, error rates, and
                  performance metrics.
                </li>
              </ul>
            </SubSection>
          </Section>

          {/* 3. How We Use Your Information */}
          <Section
            id="how-we-use-your-information"
            title="3. How We Use Your Information"
          >
            <p>
              We use the information we collect for the following purposes:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 mt-3">
              <li>
                <strong>Service Delivery:</strong> To provide, maintain, and
                operate the core functionality of MyGang.ai, including
                generating AI persona responses to your messages.
              </li>
              <li>
                <strong>Personalization:</strong> To customize your experience,
                including maintaining conversation context through user
                memories and embeddings, and remembering your persona and gang
                preferences.
              </li>
              <li>
                <strong>Authentication and Security:</strong> To verify your
                identity, manage your account, prevent fraud, and protect
                against unauthorized access.
              </li>
              <li>
                <strong>Service Improvement:</strong> To analyze usage patterns,
                diagnose technical issues, develop new features, and improve the
                overall quality of the Service.
              </li>
              <li>
                <strong>Communications:</strong> To respond to your support
                inquiries, send service-related notices, and, where permitted,
                inform you about updates or changes to the Service.
              </li>
              <li>
                <strong>Legal Compliance:</strong> To comply with applicable
                laws, regulations, legal processes, or enforceable governmental
                requests.
              </li>
              <li>
                <strong>Safety and Integrity:</strong> To detect and prevent
                abuse, fraud, spam, and violations of our terms of service.
              </li>
            </ul>
          </Section>

          {/* 4. Third-Party AI Processing */}
          <Section
            id="third-party-ai-processing"
            title="4. Third-Party AI Processing Disclosure"
          >
            <p>
              <strong>
                This is an important disclosure regarding how your data is
                processed.
              </strong>
            </p>
            <p>
              MyGang.ai relies on third-party artificial intelligence providers
              to generate AI persona responses. When you send a message in the
              Service, the following occurs:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 mt-3">
              <li>
                Your message content, along with relevant conversation context
                (including prior messages in the session and extracted user
                memories), is transmitted to third-party AI model providers,
                including but not limited to <strong>OpenRouter</strong> and{" "}
                <strong>Google (Gemini)</strong>, for the purpose of generating
                AI persona responses.
              </li>
              <li>
                These third-party providers process your data in accordance
                with their own privacy policies and data processing agreements.
                We encourage you to review their respective privacy policies.
              </li>
              <li>
                We select AI providers that offer commercially reasonable data
                protection practices, but we cannot guarantee how third-party
                providers handle data once transmitted to their systems.
              </li>
              <li>
                AI providers may use data transmitted to them for their own
                purposes, including model improvement, subject to their
                respective terms of service and privacy policies. We endeavor
                to use API configurations that minimize such secondary usage
                where available.
              </li>
            </ul>
            <p>
              <strong>
                By using the Service, you expressly acknowledge and consent to
                your messages and associated context being transmitted to and
                processed by third-party AI providers. Do not share sensitive
                personal information, financial details, health information, or
                any data you would not want processed by third-party AI systems.
              </strong>
            </p>
          </Section>

          {/* 5. Cookies and Local Storage */}
          <Section
            id="cookies-and-local-storage"
            title="5. Cookies, Local Storage, and Similar Technologies"
          >
            <p>We use the following technologies to operate the Service:</p>
            <ul className="list-disc pl-6 space-y-1.5 mt-3">
              <li>
                <strong>Cookies:</strong> Small data files stored on your
                device that help us maintain your session, remember your
                preferences, and provide security features. Essential cookies
                are required for the Service to function. We may also use
                analytics cookies to understand usage patterns.
              </li>
              <li>
                <strong>Local Storage:</strong> We use browser local storage to
                cache user preferences, theme settings, session tokens, and
                certain application state to improve performance and user
                experience.
              </li>
              <li>
                <strong>Session Tokens:</strong> Authentication tokens stored
                in your browser to maintain your logged-in session. These
                tokens are managed by our authentication provider (Supabase
                Auth).
              </li>
            </ul>
            <p>
              You may configure your browser to reject cookies or clear local
              storage. However, doing so may impair or prevent your ability to
              use certain features of the Service, including maintaining a
              logged-in session.
            </p>
          </Section>

          {/* 6. Data Sharing and Disclosure */}
          <Section
            id="data-sharing"
            title="6. Data Sharing and Disclosure"
          >
            <p>
              We do not sell your personal information. We may share your
              information in the following limited circumstances:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 mt-3">
              <li>
                <strong>Third-Party AI Providers:</strong> As described in
                Section 4, your message content and conversation context are
                transmitted to AI providers for response generation.
              </li>
              <li>
                <strong>Infrastructure and Service Providers:</strong> We use
                third-party services for hosting (Vercel), database and
                authentication (Supabase), and analytics. These providers
                access your data solely to perform services on our behalf and
                are contractually obligated to protect your information.
              </li>
              <li>
                <strong>Authentication Providers:</strong> If you choose to
                sign in via Google OAuth, certain account information is shared
                between Google and the Service as part of the authentication
                process.
              </li>
              <li>
                <strong>Legal Requirements:</strong> We may disclose your
                information if required to do so by law, regulation, legal
                process, or governmental request, or when we believe in good
                faith that disclosure is necessary to protect our rights,
                protect your safety or the safety of others, investigate fraud,
                or respond to a law enforcement request.
              </li>
              <li>
                <strong>Business Transfers:</strong> In the event of a merger,
                acquisition, reorganization, bankruptcy, or other sale of all
                or a portion of our assets, your personal information may be
                transferred as part of that transaction.
              </li>
              <li>
                <strong>With Your Consent:</strong> We may share your
                information for any other purpose disclosed to you at the time
                we collect the information or pursuant to your consent.
              </li>
            </ul>
          </Section>

          {/* 7. Data Retention and Deletion */}
          <Section
            id="data-retention"
            title="7. Data Retention and Deletion"
          >
            <p>
              We retain your personal information for as long as your account
              is active or as needed to provide you with the Service. Specific
              retention practices include:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 mt-3">
              <li>
                <strong>Account Data:</strong> Retained for the duration of
                your account and deleted upon account deletion, subject to
                legal retention requirements.
              </li>
              <li>
                <strong>Chat History and Memories:</strong> Retained for the
                duration of your account. You may delete individual
                conversations or memories within the Service. Upon account
                deletion, all associated chat history and memories are
                permanently deleted.
              </li>
              <li>
                <strong>Embeddings:</strong> Deleted when the associated
                content or account is deleted.
              </li>
              <li>
                <strong>Analytics Data:</strong> Aggregated and anonymized
                analytics data may be retained indefinitely for statistical
                purposes, even after account deletion.
              </li>
              <li>
                <strong>Backup Copies:</strong> Deleted copies of your data
                may persist in our backup systems for a reasonable period (up
                to 90 days) after deletion, after which they are permanently
                purged.
              </li>
            </ul>
            <p>
              <strong>Account Deletion:</strong> You may request deletion of
              your account and all associated personal data at any time by
              using the account deletion feature within the Service or by
              contacting us at{" "}
              <a
                href="mailto:pashaseenainc@gmail.com"
                className="text-primary underline underline-offset-2 hover:text-primary/80"
              >
                pashaseenainc@gmail.com
              </a>
              . We will process deletion requests within thirty (30) days,
              subject to any legal obligations requiring us to retain certain
              data.
            </p>
            <p>
              Please note that data previously transmitted to third-party AI
              providers (as described in Section 4) is subject to those
              providers&rsquo; own retention and deletion policies and may not
              be deletable by us.
            </p>
          </Section>

          {/* 8. Data Security */}
          <Section id="data-security" title="8. Data Security">
            <p>
              We implement commercially reasonable administrative, technical,
              and physical security measures designed to protect your personal
              information from unauthorized access, disclosure, alteration, and
              destruction. These measures include:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 mt-3">
              <li>
                Encryption of data in transit using TLS/SSL protocols.
              </li>
              <li>
                Encryption of sensitive data at rest, including password
                hashing using industry-standard algorithms.
              </li>
              <li>
                Row-level security (RLS) policies enforced at the database
                level to ensure users can only access their own data.
              </li>
              <li>
                Secure authentication mechanisms, including OAuth 2.0
                integration and secure session token management.
              </li>
              <li>
                Regular security assessments and monitoring of our
                infrastructure.
              </li>
            </ul>
            <p>
              <strong>
                However, no method of transmission over the Internet or method
                of electronic storage is 100% secure. While we strive to use
                commercially acceptable means to protect your personal
                information, we cannot guarantee its absolute security. You use
                the Service at your own risk.
              </strong>
            </p>
          </Section>

          {/* 9. Children's Privacy */}
          <Section id="childrens-privacy" title="9. Children&rsquo;s Privacy">
            <p>
              The Service is not directed to, and we do not knowingly collect
              personal information from, children. The minimum age to use the
              Service is:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 mt-3">
              <li>
                <strong>United States:</strong> 13 years of age (in compliance
                with the Children&rsquo;s Online Privacy Protection Act,
                &ldquo;COPPA&rdquo;).
              </li>
              <li>
                <strong>European Economic Area:</strong> 16 years of age (or
                the applicable minimum age in your member state under the
                GDPR, which may be as low as 13 in certain jurisdictions).
              </li>
              <li>
                <strong>All Other Jurisdictions:</strong> The greater of 13
                years of age or the minimum age required by applicable local
                law.
              </li>
            </ul>
            <p>
              If we learn that we have collected personal information from a
              child below the applicable minimum age without verifiable
              parental consent, we will take steps to delete that information
              as quickly as possible. If you believe that a child has provided
              us with personal information, please contact us at{" "}
              <a
                href="mailto:pashaseenainc@gmail.com"
                className="text-primary underline underline-offset-2 hover:text-primary/80"
              >
                pashaseenainc@gmail.com
              </a>
              .
            </p>
          </Section>

          {/* 10. International Data Transfers */}
          <Section
            id="international-transfers"
            title="10. International Data Transfers"
          >
            <p>
              MyGang.ai is operated from infrastructure that may be located in
              the United States and other countries. If you access the Service
              from outside the United States, please be aware that your
              information may be transferred to, stored, and processed in the
              United States or other jurisdictions where our service providers
              operate.
            </p>
            <p>
              These jurisdictions may have data protection laws that are
              different from (and potentially less protective than) the laws of
              your home jurisdiction. By using the Service, you consent to the
              transfer of your information to jurisdictions outside your
              country of residence, including the United States.
            </p>
            <p>
              Where required by applicable law (including the GDPR), we rely
              on appropriate legal mechanisms for international data transfers,
              such as Standard Contractual Clauses (SCCs), adequacy decisions,
              or your explicit consent.
            </p>
          </Section>

          {/* 11. AI-Generated Content Disclaimer */}
          <Section
            id="ai-content-disclaimer"
            title="11. AI-Generated Content Disclaimer"
          >
            <p>
              <strong>
                The following disclaimers are material terms of your use of the
                Service:
              </strong>
            </p>
            <ul className="list-disc pl-6 space-y-1.5 mt-3">
              <li>
                All responses generated by AI personas within the Service are
                produced by artificial intelligence models and{" "}
                <strong>
                  do not represent the views, opinions, or statements of
                  Altcorp or any of its affiliates, employees, or agents
                </strong>
                .
              </li>
              <li>
                AI-generated content may be{" "}
                <strong>
                  inaccurate, incomplete, misleading, offensive, or otherwise
                  objectionable
                </strong>
                . AI personas are fictional characters and their outputs should
                not be relied upon for any factual, legal, medical, financial,
                or professional advice.
              </li>
              <li>
                We make{" "}
                <strong>
                  no representations or warranties, express or implied
                </strong>
                , regarding the accuracy, reliability, completeness, or
                suitability of any AI-generated content for any purpose.
              </li>
              <li>
                You acknowledge that AI-generated content is provided{" "}
                <strong>&ldquo;as is&rdquo;</strong> and that you use such
                content at your own risk.
              </li>
              <li>
                <strong>User-Generated Content:</strong> You are solely
                responsible for any content you submit to the Service. You must
                not submit content that is unlawful, infringing, defamatory,
                threatening, or otherwise objectionable. We reserve the right
                to remove any user-generated content that violates our terms.
              </li>
            </ul>
          </Section>

          {/* 12. Limitation of Liability */}
          <Section
            id="limitation-of-liability"
            title="12. Limitation of Liability"
          >
            <p>
              <strong>
                TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW:
              </strong>
            </p>
            <ul className="list-disc pl-6 space-y-3 mt-3">
              <li>
                ALTCORP, ITS OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, AND
                AFFILIATES SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL,
                SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT
                LIMITED TO LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER
                INTANGIBLE LOSSES, ARISING OUT OF OR IN CONNECTION WITH YOUR
                USE OF OR INABILITY TO USE THE SERVICE, ANY AI-GENERATED
                CONTENT, OR ANY CONDUCT OR CONTENT OF ANY THIRD PARTY ON THE
                SERVICE.
              </li>
              <li>
                WE DO NOT GUARANTEE THAT THE SERVICE WILL BE AVAILABLE AT ALL
                TIMES, UNINTERRUPTED, SECURE, OR ERROR-FREE. THE SERVICE IS
                PROVIDED ON AN &ldquo;AS IS&rdquo; AND &ldquo;AS
                AVAILABLE&rdquo; BASIS WITHOUT WARRANTIES OF ANY KIND, WHETHER
                EXPRESS OR IMPLIED.
              </li>
              <li>
                OUR TOTAL AGGREGATE LIABILITY FOR ANY CLAIMS ARISING UNDER OR
                IN CONNECTION WITH THIS PRIVACY POLICY OR YOUR USE OF THE
                SERVICE SHALL NOT EXCEED THE GREATER OF (A) THE AMOUNT YOU
                HAVE PAID TO US IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM,
                OR (B) ONE HUNDRED U.S. DOLLARS (USD $100.00).
              </li>
              <li>
                WE SHALL NOT BE LIABLE FOR ANY LOSS OR DAMAGE ARISING FROM YOUR
                FAILURE TO MAINTAIN THE CONFIDENTIALITY OF YOUR ACCOUNT
                CREDENTIALS, OR FROM ANY UNAUTHORIZED ACCESS TO YOUR ACCOUNT.
              </li>
            </ul>
          </Section>

          {/* 13. Service Availability */}
          <Section
            id="service-availability"
            title="13. Service Availability"
          >
            <p>
              We do not guarantee that the Service will be available at any
              particular time or that access will be continuous, uninterrupted,
              or error-free. We reserve the right to modify, suspend, or
              discontinue the Service (or any part thereof) at any time, with
              or without notice, and without liability to you.
            </p>
            <p>
              The Service depends on third-party infrastructure, including AI
              model providers, hosting services, and authentication systems.
              Outages, degradations, or changes to any of these third-party
              services may affect the availability or functionality of the
              Service, and we shall not be liable for any such disruptions.
            </p>
          </Section>

          {/* 14. GDPR */}
          <Section
            id="gdpr"
            title="14. Your Rights Under the General Data Protection Regulation (GDPR)"
          >
            <p>
              If you are located in the European Economic Area (EEA), the
              United Kingdom, or Switzerland, you have certain rights under
              applicable data protection legislation, including:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 mt-3">
              <li>
                <strong>Right of Access:</strong> You have the right to request
                a copy of the personal data we hold about you.
              </li>
              <li>
                <strong>Right to Rectification:</strong> You have the right to
                request correction of inaccurate or incomplete personal data.
              </li>
              <li>
                <strong>Right to Erasure:</strong> You have the right to
                request deletion of your personal data, subject to certain
                legal exceptions.
              </li>
              <li>
                <strong>Right to Restrict Processing:</strong> You have the
                right to request that we restrict the processing of your
                personal data in certain circumstances.
              </li>
              <li>
                <strong>Right to Data Portability:</strong> You have the right
                to receive your personal data in a structured, commonly used,
                and machine-readable format.
              </li>
              <li>
                <strong>Right to Object:</strong> You have the right to object
                to the processing of your personal data for certain purposes,
                including direct marketing.
              </li>
              <li>
                <strong>Right to Withdraw Consent:</strong> Where processing
                is based on your consent, you have the right to withdraw that
                consent at any time without affecting the lawfulness of
                processing carried out prior to withdrawal.
              </li>
              <li>
                <strong>Right to Lodge a Complaint:</strong> You have the right
                to lodge a complaint with a supervisory authority in the EEA
                member state of your habitual residence, place of work, or
                place of the alleged infringement.
              </li>
            </ul>
            <p>
              <strong>Legal Bases for Processing:</strong> We process your
              personal data on the following legal bases: (a) your consent; (b)
              performance of a contract (i.e., providing the Service to you);
              (c) compliance with legal obligations; and (d) our legitimate
              interests (e.g., improving the Service, preventing fraud),
              balanced against your rights and freedoms.
            </p>
            <p>
              To exercise any of these rights, please contact us at{" "}
              <a
                href="mailto:pashaseenainc@gmail.com"
                className="text-primary underline underline-offset-2 hover:text-primary/80"
              >
                pashaseenainc@gmail.com
              </a>
              . We will respond to your request within thirty (30) days, or as
              required by applicable law.
            </p>
          </Section>

          {/* 15. CCPA */}
          <Section
            id="ccpa"
            title="15. Your Rights Under the California Consumer Privacy Act (CCPA)"
          >
            <p>
              If you are a California resident, you have the following rights
              under the California Consumer Privacy Act (as amended by the
              California Privacy Rights Act, &ldquo;CPRA&rdquo;):
            </p>
            <ul className="list-disc pl-6 space-y-1.5 mt-3">
              <li>
                <strong>Right to Know:</strong> You have the right to request
                disclosure of the categories and specific pieces of personal
                information we have collected about you, the categories of
                sources, the business purposes for collection, and the
                categories of third parties with whom we share your personal
                information.
              </li>
              <li>
                <strong>Right to Delete:</strong> You have the right to request
                deletion of your personal information, subject to certain
                exceptions.
              </li>
              <li>
                <strong>Right to Correct:</strong> You have the right to
                request correction of inaccurate personal information.
              </li>
              <li>
                <strong>Right to Opt-Out of Sale:</strong> We do not sell your
                personal information. If this practice changes, we will provide
                you with a clear opt-out mechanism.
              </li>
              <li>
                <strong>Right to Non-Discrimination:</strong> We will not
                discriminate against you for exercising any of your CCPA
                rights.
              </li>
            </ul>
            <p>
              <strong>Categories of Personal Information Collected:</strong>{" "}
              Identifiers (email, username, IP address); internet or electronic
              network activity information (usage data, chat messages);
              inferences drawn from the foregoing (user memories, embeddings).
            </p>
            <p>
              To exercise your CCPA rights, please contact us at{" "}
              <a
                href="mailto:pashaseenainc@gmail.com"
                className="text-primary underline underline-offset-2 hover:text-primary/80"
              >
                pashaseenainc@gmail.com
              </a>{" "}
              or{" "}
              <a
                href="mailto:pashaseenainc@gmail.com"
                className="text-primary underline underline-offset-2 hover:text-primary/80"
              >
                pashaseenainc@gmail.com
              </a>
              . We will verify your identity before processing your request and
              respond within forty-five (45) days as required by law.
            </p>
          </Section>

          {/* 16. Changes to This Policy */}
          <Section
            id="changes-to-policy"
            title="16. Changes to This Privacy Policy"
          >
            <p>
              We reserve the right to update or modify this Privacy Policy at
              any time at our sole discretion. When we make material changes,
              we will:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 mt-3">
              <li>
                Update the &ldquo;Last Updated&rdquo; date at the top of this
                page.
              </li>
              <li>
                Make reasonable efforts to notify you of material changes,
                which may include posting a notice within the Service, sending
                an email to the address associated with your account, or other
                means we deem appropriate.
              </li>
            </ul>
            <p>
              Your continued use of the Service following the posting of
              changes constitutes your acceptance of such changes. We encourage
              you to review this Privacy Policy periodically for any updates. If
              you do not agree with the revised Privacy Policy, your sole
              remedy is to discontinue use of the Service and delete your
              account.
            </p>
          </Section>

          {/* 17. Third-Party Links */}
          <Section
            id="third-party-links"
            title="17. Third-Party Links and Services"
          >
            <p>
              The Service may contain links to third-party websites, services,
              or resources that are not owned or controlled by us. We are not
              responsible for the privacy practices, content, or security of
              any third-party sites or services. This Privacy Policy applies
              solely to information collected through the Service. We encourage
              you to review the privacy policies of any third-party services
              you access.
            </p>
          </Section>

          {/* 18. Do Not Track */}
          <Section
            id="do-not-track"
            title="18. Do Not Track Signals"
          >
            <p>
              Some browsers transmit &ldquo;Do Not Track&rdquo; (DNT) signals
              to websites. Because there is no universally accepted standard
              for how to respond to DNT signals, we do not currently respond to
              DNT browser signals. We will update this Privacy Policy if and
              when we adopt a standard for responding to DNT signals.
            </p>
          </Section>

          {/* 19. Governing Law */}
          <Section id="governing-law" title="19. Governing Law">
            <p>
              This Privacy Policy and any disputes arising out of or related to
              it or the Service shall be governed by and construed in
              accordance with the laws of the jurisdiction in which Altcorp is
              organized, without regard to conflict of law principles. Any
              legal action or proceeding arising under this Privacy Policy
              shall be brought exclusively in the courts of competent
              jurisdiction in that location, and you hereby irrevocably consent
              to the personal jurisdiction and venue therein.
            </p>
          </Section>

          {/* 20. Severability */}
          <Section id="severability" title="20. Severability">
            <p>
              If any provision of this Privacy Policy is held to be invalid,
              illegal, or unenforceable by a court of competent jurisdiction,
              that provision shall be enforced to the maximum extent
              permissible, and the remaining provisions of this Privacy Policy
              shall remain in full force and effect.
            </p>
          </Section>

          {/* 21. Contact */}
          <Section id="contact" title="21. Contact Information">
            <p>
              If you have any questions, concerns, or requests regarding this
              Privacy Policy or our data practices, please contact us:
            </p>
            <div className="mt-4 rounded-2xl border border-border/50 bg-muted/40 p-6 space-y-3">
              <p>
                <strong>Altcorp</strong>
                <br />
                Operating as MyGang.ai
              </p>
              <p>
                <strong>General Inquiries:</strong>{" "}
                <a
                  href="mailto:pashaseenainc@gmail.com"
                  className="text-primary underline underline-offset-2 hover:text-primary/80"
                >
                  pashaseenainc@gmail.com
                </a>
              </p>
              <p>
                <strong>Support &amp; Data Requests:</strong>{" "}
                <a
                  href="mailto:pashaseenainc@gmail.com"
                  className="text-primary underline underline-offset-2 hover:text-primary/80"
                >
                  pashaseenainc@gmail.com
                </a>
              </p>
              <p className="text-sm text-muted-foreground">
                We endeavor to respond to all inquiries within thirty (30)
                business days.
              </p>
            </div>
          </Section>

          {/* Closing */}
          <div className="mt-16 pt-8 border-t border-border/50">
            <p className="text-sm text-muted-foreground text-center">
              &copy; 2026 Altcorp. All rights reserved.
              <br />
              MyGang.ai is a product of Altcorp.
            </p>
          </div>
        </div>
      </article>
    </main>
  );
}

/* ──────────────── Sub-components ──────────────── */

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="text-xl font-bold tracking-tight mb-4">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function SubSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6">
      <h3 className="text-base font-semibold mb-3">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
