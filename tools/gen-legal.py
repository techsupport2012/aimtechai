#!/usr/bin/env python3
"""Generate 8 full-length legal/policy pages for AIM Tech AI."""
import os, pathlib, datetime

OUT_DIR = pathlib.Path(__file__).parent.parent / 'public'
TODAY = datetime.date.today().strftime('%B %d, %Y')

PAGES = [
    ("privacy", "Privacy Policy", "How AIM Tech AI collects, uses, and safeguards your information — GDPR, CCPA, and global best practices.",
     """
<h2>1. Information We Collect</h2>
<p>We collect information to provide and improve our services. Categories include:</p>
<h3>1.1 Personal Information</h3>
<ul><li>Full name</li><li>Email address</li><li>Phone number</li><li>Business details (if provided)</li></ul>
<h3>1.2 Booking & Service Data</h3>
<ul><li>Appointment details</li><li>Preferences and service requests</li><li>Communication history</li></ul>
<h3>1.3 Technical & Usage Data</h3>
<ul><li>IP address</li><li>Browser type and version</li><li>Device information</li><li>Pages visited and time spent</li><li>Referral sources</li></ul>
<h3>1.4 Authentication Data</h3>
<ul><li>Login credentials (encrypted)</li><li>Session cookies</li></ul>

<h2>2. How We Use Your Information</h2>
<ul>
<li>Deliver and operate our services</li>
<li>Process bookings and client requests</li>
<li>Improve user experience and performance</li>
<li>Communicate updates, support, and offers</li>
<li>Analyze traffic and behavior trends</li>
<li>Detect, prevent, and respond to fraud or abuse</li>
</ul>

<h2>3. Legal Basis for Processing</h2>
<ul><li>User consent</li><li>Contractual necessity</li><li>Legitimate business interests</li><li>Legal obligations</li></ul>

<h2>4. Data Sharing and Disclosure</h2>
<p>We do not sell personal data. We may share data with:</p>
<ul><li>Trusted service providers (hosting, analytics)</li><li>Internal systems and authorized personnel</li><li>Legal authorities when required</li></ul>

<h2>5. Cookies and Tracking Technologies</h2>
<p>We use cookies and similar technologies to maintain session functionality, analyze usage patterns, and improve performance. You can disable cookies through your browser settings, but some features may not function properly. See our <a href="/cookies">Cookie Policy</a>.</p>

<h2>6. Data Security</h2>
<p>We implement reasonable technical and organizational safeguards, including encrypted authentication systems, access control restrictions, and secure data storage practices. However, no system is completely secure.</p>

<h2>7. Data Retention</h2>
<p>We retain data only as long as necessary to provide services, comply with legal obligations, and resolve disputes.</p>

<h2>8. Your Rights</h2>
<p>Depending on your jurisdiction, you may request access to your data, request correction or deletion, object to processing, or withdraw consent. Submit requests via <a href="/book">our contact page</a>.</p>

<h2>9. Children's Privacy</h2>
<p>Our services are not intended for individuals under 13 years of age. We do not knowingly collect such data.</p>

<h2>10. International Data Transfers</h2>
<p>Data may be processed in different jurisdictions depending on infrastructure providers.</p>

<h2>11. Updates to This Policy</h2>
<p>We may update this Privacy Policy periodically. Continued use of the platform indicates acceptance.</p>

<h2>12. Contact Information</h2>
<p>Email: <a href="mailto:info@aimtechai.com">info@aimtechai.com</a> &bull; Company: AIM Tech AI LLC, Beverly Hills, California.</p>
"""),

    ("terms", "Terms of Use", "The terms governing your use of AIM Tech AI — services, bookings, AI-generated content, and user responsibilities.",
     """
<h2>1. Acceptance of Terms</h2>
<p>By using this platform, you confirm that you are at least 18 years old (or have legal consent) and agree to comply with all applicable laws.</p>

<h2>2. Description of Services</h2>
<p>AIM Tech AI provides AI-powered content and automation tools, website and CMS functionality, and booking and client management systems.</p>

<h2>3. User Responsibilities</h2>
<p>You agree NOT to:</p>
<ul><li>Use the platform for illegal purposes</li><li>Attempt unauthorized access</li><li>Disrupt system functionality</li><li>Upload malicious or harmful content</li></ul>

<h2>4. Account Security</h2>
<p>You are responsible for maintaining confidentiality of your account and for all activities under it.</p>

<h2>5. Intellectual Property</h2>
<p>All platform content, systems, and materials are owned by AIM Tech AI. You may not copy or redistribute content, reverse engineer the system, or use materials without permission.</p>

<h2>6. AI-Generated Content</h2>
<p>Our platform uses AI systems. You acknowledge outputs may contain errors or inaccuracies and that you are responsible for verifying critical information. See our <a href="/ai-policy">AI Policy</a>.</p>

<h2>7. Bookings and Services</h2>
<p>All bookings are subject to availability and may be rescheduled or canceled under certain conditions. See our <a href="/refund">Refund Policy</a>.</p>

<h2>8. Payments</h2>
<p>All payments must be completed before service delivery and are subject to refund policies.</p>

<h2>9. Limitation of Liability</h2>
<p>We are not liable for indirect or incidental damages, loss of business, revenue, or data, or reliance on AI-generated outputs.</p>

<h2>10. Termination</h2>
<p>We may suspend or terminate access for violations of these Terms.</p>

<h2>11. Governing Law</h2>
<p>These Terms are governed by the laws of the United States and the State of California.</p>

<h2>12. Changes to Terms</h2>
<p>We may update these Terms at any time. Continued use constitutes acceptance.</p>

<h2>Contact</h2>
<p>Email: <a href="mailto:info@aimtechai.com">info@aimtechai.com</a></p>
"""),

    ("cookies", "Cookie Policy", "How AIM Tech AI uses cookies and similar technologies across our platform.",
     """
<h2>1. What Are Cookies?</h2>
<p>Cookies are small text files stored on your device to improve functionality and user experience.</p>

<h2>2. Types of Cookies We Use</h2>
<h3>Essential Cookies</h3>
<p>Required for core functionality including login and session management.</p>
<h3>Analytics Cookies</h3>
<p>Used to understand how users interact with the site. Helps us improve the product.</p>
<h3>Performance Cookies</h3>
<p>Improve speed and performance through caching and optimization signals.</p>

<h2>3. Third-Party Cookies</h2>
<p>We may use third-party services such as analytics providers (Google Analytics, etc.). Each third party has its own privacy policy.</p>

<h2>4. Managing Cookies</h2>
<p>You can disable cookies in your browser settings or clear stored cookies at any time. Some features may not function without essential cookies.</p>

<h2>5. Consent</h2>
<p>By using our site, you consent to our use of cookies as described in this policy. See our <a href="/privacy">Privacy Policy</a> for full details on data handling.</p>

<h2>Contact</h2>
<p>Email: <a href="mailto:info@aimtechai.com">info@aimtechai.com</a></p>
"""),

    ("disclaimer", "Disclaimer", "General disclaimer on information, AI-generated content, external links, and use at your own risk.",
     """
<p>All information provided by AIM Tech AI is for general informational purposes only.</p>

<h2>1. No Guarantees</h2>
<p>We do not guarantee accuracy of information, business results, or performance outcomes. Every engagement is scoped individually.</p>

<h2>2. AI Limitations</h2>
<p>AI-generated outputs may be incomplete or incorrect and should not replace professional advice. Always verify critical outputs.</p>

<h2>3. External Links</h2>
<p>We are not responsible for third-party content linked from this site.</p>

<h2>4. Use at Your Own Risk</h2>
<p>All usage is at your own discretion and risk.</p>

<h2>Contact</h2>
<p>Email: <a href="mailto:info@aimtechai.com">info@aimtechai.com</a></p>
"""),

    ("aup", "Acceptable Use Policy", "What is and isn't allowed on the AIM Tech AI platform.",
     """
<p>Users must use the platform responsibly. This Acceptable Use Policy ("AUP") defines what is prohibited.</p>

<h2>Prohibited Activities</h2>
<ul>
<li>Illegal actions under any applicable jurisdiction</li>
<li>Harassment or abuse of any individual or group</li>
<li>Unauthorized access attempts against our systems or third-party systems via our platform</li>
<li>Malware distribution</li>
<li>Data scraping without explicit permission</li>
<li>Circumventing rate limits, auth, or other technical controls</li>
<li>Using the platform to develop competing services</li>
</ul>

<h2>Enforcement</h2>
<p>Violations may result in account suspension, termination, and/or legal action. We reserve the right to investigate suspected violations and cooperate with law enforcement when required.</p>

<h2>Reporting Violations</h2>
<p>Report suspected violations to <a href="mailto:info@aimtechai.com">info@aimtechai.com</a>.</p>
"""),

    ("refund", "Refund & Cancellation Policy", "Booking cancellation windows, refund eligibility, and processing timelines.",
     """
<h2>1. Cancellations</h2>
<p>Bookings may be canceled up to 24 hours before the scheduled time without penalty. Cancellations inside that window may forfeit any deposit.</p>

<h2>2. Refunds</h2>
<p>Refunds are subject to service type and are not guaranteed for completed digital services.</p>

<h2>3. Non-Refundable Services</h2>
<ul><li>Completed work and delivered deliverables</li><li>Custom AI-generated outputs</li><li>Consulting time already rendered</li></ul>

<h2>4. Processing Time</h2>
<p>Approved refunds may take 7-14 business days to process depending on payment method and issuing bank.</p>

<h2>5. How to Request</h2>
<p>Refund requests: email <a href="mailto:info@aimtechai.com">info@aimtechai.com</a> with your booking reference and reason.</p>
"""),

    ("ai-policy", "AI Usage & Transparency Policy", "How AIM Tech AI uses artificial intelligence, its limitations, and your responsibilities.",
     """
<h2>1. AI Integration</h2>
<p>We use AI to generate content, automate processes, and assist decision-making across our platform and client engagements.</p>

<h2>2. Limitations</h2>
<p>AI systems are not perfect and may produce incorrect, biased, or outdated outputs. Do not rely on AI outputs for high-stakes decisions without human review.</p>

<h2>3. User Responsibility</h2>
<p>Users must verify outputs and use discretion. You are responsible for any action you take based on AI-assisted output.</p>

<h2>4. Ethical Use</h2>
<p>AI must not be used for harmful activities, illegal profiling, discrimination, or generation of deceptive content. See our <a href="/aup">Acceptable Use Policy</a>.</p>

<h2>5. Data Handling in AI Systems</h2>
<p>Prompts, inputs, and interaction logs may be processed by AI models (including third-party providers). See our <a href="/privacy">Privacy Policy</a> for data handling.</p>

<h2>6. Disclosure</h2>
<p>Content generated with AI assistance is marked where appropriate. We disclose AI involvement on public-facing content per emerging best practices.</p>

<h2>Contact</h2>
<p>Email: <a href="mailto:info@aimtechai.com">info@aimtechai.com</a></p>
"""),

    ("security", "Security Policy", "How AIM Tech AI protects customer data, handles vulnerabilities, and responds to incidents.",
     """
<h2>1. Our Commitment</h2>
<p>We prioritize protecting your data and maintaining the integrity of our systems.</p>

<h2>2. Measures</h2>
<ul>
<li>Encrypted authentication systems</li>
<li>Access control with least-privilege principles</li>
<li>Encryption at rest and in transit for sensitive data</li>
<li>Regular security reviews and dependency scanning</li>
<li>Incident response procedures with blameless post-mortems</li>
</ul>

<h2>3. Limitations</h2>
<p>No system is fully secure. We continuously invest in controls but cannot guarantee perfect security.</p>

<h2>4. Reporting Vulnerabilities</h2>
<p>If you believe you have discovered a security vulnerability, report it confidentially to <a href="mailto:security@aimtechai.com">security@aimtechai.com</a>. Do not exploit the issue beyond what is necessary to demonstrate it. We commit to acknowledging reports within 48 business hours.</p>

<h2>5. Safe Harbor</h2>
<p>Good-faith security research conducted within the scope of this policy is authorized and we will not pursue legal action for such research.</p>

<h2>Contact</h2>
<p>Email: <a href="mailto:security@aimtechai.com">security@aimtechai.com</a></p>
"""),
]

TEMPLATE = '''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title} | AIM Tech AI</title>
  <meta name="description" content="{description}">
  <link rel="canonical" href="https://aimtechai.com/{slug}">
  <meta property="og:title" content="{title} | AIM Tech AI">
  <meta property="og:description" content="{description}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://aimtechai.com/{slug}">
  <meta name="twitter:card" content="summary">
  <meta name="robots" content="index, follow">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/styles.css">
  <link rel="stylesheet" href="/css/blog.css">
<script>/* theme-init */const t=localStorage.getItem("theme");if(t)document.documentElement.setAttribute("data-theme",t);</script>
</head>
<body>
  <div class="noise-overlay"></div>

  <!-- NAV -->
  <nav id="navbar">
    <a href="/" class="nav-logo"><img class="logo-dark" src="/assets/aim_transparent_logo.png" alt="AIM Tech AI" style="height:38px;width:auto;display:block;"><img class="logo-light" src="/assets/black_aim_transparent_logo.png" alt="AIM Tech AI" style="height:38px;width:auto;display:none;"></a>
    <ul class="nav-links" id="nav-links">
      <li><a href="/#services" data-scramble>Services</a></li>
      <li><a href="/about" data-scramble>About</a></li>
      <li><a href="/portfolio" data-scramble>Portfolio</a></li>
      <li><a href="/blog" data-scramble>Blog</a></li>
      <li><a href="/#values" data-scramble>Values</a></li>
      <li><a href="/#contact" data-scramble>Contact</a></li>
    </ul>
    <div class="nav-actions">
      <button class="theme-toggle" id="theme-toggle" aria-label="Toggle light/dark mode">
        <span class="theme-toggle-icon" id="theme-icon">&#127769;</span>
      </button>
      <a href="/book" class="nav-cta gradient-btn" style="--gfrom:#0FC1B7;--gto:#0A9B92;" aria-label="Book a Call"><span class="gbtn-glow"></span><span class="gbtn-bg"></span><span class="gbtn-icon">&#128197;</span><span class="gbtn-label">Book a Call</span></a>
    </div>
    <div class="mobile-toggle" id="mobile-toggle">
      <span></span><span></span><span></span>
    </div>
  </nav>

  <div class="content">
  <div class="content blog-article-page">

    <!-- PAGE HERO -->
    <div class="page-hero">
      <div class="breadcrumb"><a href="/">Home</a> &rsaquo; <a href="/privacy">Legal</a> &rsaquo; {title}</div>
      <h1>{title}</h1>
      <p class="hero-sub" style="opacity:1;transform:none;">Last Updated: {today}</p>
    </div>

    <div class="glow-divider"></div>

    <!-- ARTICLE -->
    <section style="max-width:1300px;margin:0 auto;">
      <a href="/" style="color:var(--clr-accent);text-decoration:none;font-size:0.9rem;display:inline-block;margin-bottom:2rem;">&larr; Back to Home</a>

      <div style="max-width:800px;margin:0 auto;background:linear-gradient(135deg,rgba(255,255,255,0.18),rgba(255,255,255,0.08));backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,0.22);border-radius:20px;padding:3rem;box-shadow:0 8px 32px rgba(0,0,0,0.25);">

        <article style="color:var(--clr-text-dim);font-weight:300;font-size:0.95rem;line-height:1.8;">
          <p style="font-size:1.02rem;color:var(--clr-text);margin-bottom:1.4rem;">{description}</p>

          {body}

        </article>
      </div>
    </section>

    <div class="glow-divider"></div>

  </div>
  </div><!-- .content -->

  <footer id="footer" style="padding-top:4rem;">
    <div style="max-width:1200px;margin:0 auto;display:grid;grid-template-columns:1fr 2fr;gap:4rem;text-align:left;padding:0 2rem;">
      <div>
        <div class="footer-logo"><img class="logo-dark" src="/assets/aim_transparent_logo.png" alt="AIM Tech AI" style="height:44px;width:auto;display:block;"><img class="logo-light" src="/assets/black_aim_transparent_logo.png" alt="AIM Tech AI" style="height:44px;width:auto;display:none;"></div>
        <p style="color:var(--clr-text-dim);font-size:0.85rem;font-weight:300;line-height:1.8;margin-top:1rem;">Enhancing the efficiency of software development through transparency, integrity, and partnership.</p>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:2rem;">
        <div>
          <small style="font-family:var(--font-mono);font-size:0.65rem;letter-spacing:3px;text-transform:uppercase;color:var(--clr-text-dim);">Services</small>
          <ul class="footer-links" style="flex-direction:column;justify-content:flex-start;gap:0.8rem;margin-top:1rem;">
            <li><a href="/ai">AI &amp; ML</a></li>
            <li><a href="/consulting">Consulting</a></li>
            <li><a href="/ui-ux">UI/UX Design</a></li>
            <li><a href="/cloud">Cloud</a></li>
            <li><a href="/qa">QA &amp; Testing</a></li>
          </ul>
        </div>
        <div>
          <small style="font-family:var(--font-mono);font-size:0.65rem;letter-spacing:3px;text-transform:uppercase;color:var(--clr-text-dim);">Legal</small>
          <ul class="footer-links" style="flex-direction:column;justify-content:flex-start;gap:0.8rem;margin-top:1rem;">
            <li><a href="/privacy">Privacy Policy</a></li>
            <li><a href="/terms">Terms of Use</a></li>
            <li><a href="/cookies">Cookie Policy</a></li>
            <li><a href="/ai-policy">AI Policy</a></li>
            <li><a href="/security">Security</a></li>
          </ul>
        </div>
        <div>
          <small style="font-family:var(--font-mono);font-size:0.65rem;letter-spacing:3px;text-transform:uppercase;color:var(--clr-text-dim);">Contact</small>
          <ul class="footer-links" style="flex-direction:column;justify-content:flex-start;gap:0.8rem;margin-top:1rem;">
            <li><a href="tel:+13104218638">(310) 421-8638</a></li>
            <li><a href="/book">Book a Call</a></li>
          </ul>
        </div>
      </div>
    </div>
    <div style="border-top:1px solid var(--clr-border);margin-top:3rem;padding-top:2rem;text-align:center;">
      <p>&copy; 2026 AIM Tech AI LLC. All rights reserved. Beverly Hills, California.</p>
    </div>
  </footer>

  <script type="module">
    import {{ initUI }} from '/js/ui.js';
    initUI();
  </script>
  <script src="/js/cookie-consent.js" defer></script>
</body>
</html>
'''

def styled_body(body):
    """Add inline styles to H2/H3/p/ul so legal pages match blog-article styling."""
    out = body
    out = out.replace('<h2>', '<h2 style="color:var(--clr-text);margin-top:2rem;">')
    out = out.replace('<h3>', '<h3 style="color:var(--clr-text);margin-top:1.3rem;">')
    return out

def main():
    for slug, title, description, body in PAGES:
        html = TEMPLATE.format(
            slug=slug, title=title, description=description,
            today=TODAY, body=styled_body(body.strip())
        )
        out = OUT_DIR / f'{slug}.html'
        out.write_text(html, encoding='utf-8')
        print(f'wrote {out.relative_to(OUT_DIR.parent)}')

if __name__ == '__main__':
    main()
