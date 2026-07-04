/* DataOfInsta — client-side privacy self-audit questionnaire
   No scraping, no network calls, no external APIs.
*/

(function(){
  const $ = (sel) => document.querySelector(sel);
  const form = $('#auditForm');
  const resetBtn = $('#resetBtn');
  const reportBody = $('#reportBody');
  const riskLabel = $('#riskLabel');
  const securityScoreEl = $('#securityScore');
  const exposureText = $('#exposureText');
  const threatsList = $('#threatsList');
  const actionsList = $('#actionsList');
  const downloadBtn = $('#downloadBtn');
  const printBtn = $('#printBtn');

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  // Each question returns a value 1..3 depending on perceived risk posture.
  // Higher = worse.
  const weight = {
    // Exposure / identity linkage (q1..q5)
    q1: 8, q2: 10, q3: 6, q4: 9, q5: 7,
    // Security controls (q6..q12)
    q6: 12, q7: 8, q8: 12, q9: 12, q10: 7, q11: 6, q12: 6,
    // Social engineering readiness (q13..q16)
    q13: 10, q14: 7, q15: 6, q16: 6
  };

  const meta = {
    q1: { k: 'Exposure', label: 'Public/private' },
    q2: { k: 'Exposure', label: 'Personal identifiers in bio' },
    q3: { k: 'Exposure', label: 'Identity-linking links' },
    q4: { k: 'Exposure', label: 'Location sharing breadth' },
    q5: { k: 'Exposure', label: 'Routine inference risk' },

    q6: { k: 'Security', label: '2FA enabled' },
    q7: { k: 'Security', label: '2FA strength' },
    q8: { k: 'Security', label: 'Unique password' },
    q9: { k: 'Security', label: 'Email recovery hardened' },
    q10:{ k: 'Security', label: 'Login alerts' },
    q11:{ k: 'Hygiene', label: 'Sessions/devices reviewed' },
    q12:{ k: 'Hygiene', label: 'Connected apps reviewed' },

    q13:{ k: 'Social', label: 'Recent phishing-like DMs' },
    q14:{ k: 'Social', label: 'Caution with DM links/apps' },
    q15:{ k: 'Social', label: 'Impersonation response plan' },
    q16:{ k: 'Social', label: 'Trusted-contact awareness' }
  };

  function getAnswers(){
    const data = {};
    const inputs = form.querySelectorAll('input[type="radio"]:checked');
    if (inputs.length === 0) return null;
    for (const input of form.querySelectorAll('input[type="radio"]')){
      if (input.checked){
        const name = input.name;
        data[name] = parseInt(input.value, 10);
      }
    }
    // Ensure all required answered (q1..q16)
    for (let i=1;i<=16;i++){
      const key = 'q'+i;
      if (!data[key]) return null;
    }
    return data;
  }

  function computeRisk(answers){
    let total = 0;
    let max = 0;
    for (const [k,v] of Object.entries(answers)){
      const w = weight[k] || 0;
      total += v * w;
      max += 3 * w;
    }
    const ratio = total / max; // 0..1 (but weighted by 1..3)
    // Convert to risk score 0..100 (higher = worse)
    const riskScore = Math.round(ratio * 100);

    let level = 'Low';
    if (riskScore >= 66) level = 'High';
    else if (riskScore >= 40) level = 'Medium';

    // Security score displayed (higher better). invert.
    const securityScore = 100 - riskScore;

    return { riskScore, securityScore, level };
  }

  function summarizeExposure(answers){
    const parts = [];

    const publicYes = answers.q1 === 3;
    parts.push(`- Account visibility: ${publicYes ? 'Public or broadly visible' : 'Restricted visibility'}.`);

    const identifiers = answers.q2 >= 3;
    parts.push(`- Bio identifiers: ${identifiers ? 'Includes personal identifiers (higher impersonation/social-engineering risk)' : 'Mostly generic / no obvious identifiers'}.`);

    const links = answers.q3 >= 2;
    parts.push(`- Identity-linking links: ${links ? 'Multiple/strong links that can tie accounts together' : 'Fewer or weaker links'}.`);

    const locationBroad = answers.q4 >= 3;
    parts.push(`- Location sharing breadth: ${locationBroad ? 'Broadly shared' : 'Limited sharing / close audience'}.`);

    const routine = answers.q5 >= 3;
    parts.push(`- Routine inference risk: ${routine ? 'Highlights/recent content may reveal consistent routines' : 'Patterns are varied / less inferable'}.`);

    return `Based on your selections, your estimated exposure signals are:
${parts.join('\n')}`;
  }

  function threatsFor(answers, riskLevel){
    const threats = [];

    // Impersonation readiness / identity stitching
    const impersonationRisk = (answers.q2 >= 3 ? 2 : 0) + (answers.q3 >= 2 ? 2 : 0) + (answers.q1 === 3 ? 1 : 0);
    if (impersonationRisk >= 3 || riskLevel !== 'Low'){
      threats.push({
        title: 'Impersonation / catfishing',
        note: 'Your public signals could help an impersonator look credible and target you.'
      });
    } else {
      threats.push({
        title: 'Impersonation / catfishing',
        note: 'Lower likelihood based on reduced identity cues, but still possible.'
      });
    }

    // Phishing/social engineering
    const phishingRisk = (answers.q13 >= 2 ? 2 : 0) + (answers.q14 >= 2 ? 2 : 0) + (answers.q2 >= 3 ? 1 : 0);
    if (phishingRisk >= 3 || riskLevel === 'High'){
      threats.push({
        title: 'Phishing & “security verification” scams',
        note: 'Your behavior/settings suggest you could be more likely to fall for urgent-login or DM-link prompts.'
      });
    } else {
      threats.push({
        title: 'Phishing & “security verification” scams',
        note: 'You appear cautious; remain vigilant and avoid “verify” links.'
      });
    }

    // Credential/session hijack
    const sessionRisk = (answers.q6 === 3 ? 3 : 0) + (answers.q7 >= 2 ? 1 : 0) + (answers.q8 === 3 ? 2 : 0) + (answers.q9 === 3 ? 2 : 0);
    if (sessionRisk >= 5 || riskLevel === 'High'){
      threats.push({
        title: 'Session hijack / credential compromise',
        note: 'Weighed toward gaps in 2FA strength, password uniqueness, and/or email recovery security.'
      });
    } else {
      threats.push({
        title: 'Session hijack / credential compromise',
        note: 'Mitigations appear present; still review sessions/devices occasionally.'
      });
    }

    // Social engineering using public data
    const socialEngineeringRisk = (answers.q4 >= 3 ? 2 : 0) + (answers.q5 >= 3 ? 2 : 0) + (answers.q16 === 3 ? 2 : 0);
    if (socialEngineeringRisk >= 4 || riskLevel !== 'Low'){
      threats.push({
        title: 'Social engineering using personal details',
        note: 'Public routines/location/story audience could be used to craft believable messages.'
      });
    } else {
      threats.push({
        title: 'Social engineering using personal details',
        note: 'Lower inferred leverage from your visible patterns.'
      });
    }

    // Order by a rough perceived severity
    return threats;
  }

  function buildActions(answers, level){
    // Create a prioritized checklist using which areas look weak.
    const items = [];

    // High impact controls
    if (answers.q6 === 3){
      items.push({
        pri: 'High',
        text: 'Enable 2FA (prefer authenticator app or security key; avoid SMS if possible).'
      });
    } else if (answers.q7 >= 2){
      items.push({
        pri: 'High',
        text: 'Strengthen 2FA method (switch from SMS/weaker options to authenticator app/security key).'
      });
    }

    if (answers.q8 === 3){
      items.push({
        pri: 'High',
        text: 'Use a unique, strong password for Instagram (via a password manager).'
      });
    }

    if (answers.q9 === 3){
      items.push({
        pri: 'High',
        text: 'Harden your email recovery account (strong password + 2FA).'
      });
    }

    if (answers.q10 === 3){
      items.push({
        pri: 'Medium',
        text: 'Enable login alerts / suspicious-activity notifications so you can respond quickly.'
      });
    }

    // Privacy hardening
    if (answers.q2 >= 3 || answers.q3 >= 2){
      items.push({
        pri: 'Medium',
        text: 'Reduce identifying info in your bio and limit identity-linking links (keep it generic or remove strong ties).'
      });
    }

    if (answers.q4 >= 3){
      items.push({
        pri: 'Medium',
        text: 'Limit broad location sharing (use close-audience controls / reduce frequent location tags).'
      });
    }

    if (answers.q5 >= 3){
      items.push({
        pri: 'Medium',
        text: 'Adjust story/highlights to avoid revealing routines (mix content cadence or hide sensitive patterns).'
      });
    }

    // Session/app hygiene
    if (answers.q11 >= 2){
      items.push({
        pri: 'Medium',
        text: 'Review active sessions/devices; remove anything you don’t recognize.'
      });
    }

    if (answers.q12 >= 2){
      items.push({
        pri: 'Medium',
        text: 'Remove old/unused connected apps; keep only apps you trust.'
      });
    }

    // Social engineering defenses
    if (answers.q13 >= 2){
      items.push({
        pri: 'High',
        text: 'Treat “security verification” DMs/links as scams until confirmed via official in-app paths.'
      });
    } else {
      items.push({
        pri: 'Low',
        text: 'Stay cautious with DM links; when in doubt, navigate via the app/official settings (not the DM link).'
      });
    }

    if (answers.q14 >= 2){
      items.push({
        pri: 'High',
        text: 'Improve link/app hygiene: avoid viewer apps, link shorteners, and suspicious URLs from DMs.'
      });
    }

    if (answers.q15 === 3){
      items.push({
        pri: 'Medium',
        text: 'Create an impersonation response plan: preserve evidence, report quickly, and warn trusted contacts.'
      });
    }

    if (answers.q16 === 3){
      items.push({
        pri: 'Low',
        text: 'Brief trusted contacts: ignore urgent requests coming from your account; verify via known channels.'
      });
    }

    // De-duplicate and cap
    const uniq = new Map();
    for (const it of items){
      if (!uniq.has(it.text)) uniq.set(it.text, it);
    }
    const list = Array.from(uniq.values());

    // Sort by priority
    const priRank = { High: 0, Medium: 1, Low: 2 };
    list.sort((a,b) => priRank[a.pri] - priRank[b.pri]);

    // For Low risk, keep it shorter
    const cap = level === 'High' ? 10 : level === 'Medium' ? 9 : 7;
    return list.slice(0, cap);
  }

  function badgeClass(pri){
    if (pri === 'High') return 'danger';
    if (pri === 'Medium') return 'warn';
    return 'ok';
  }

  function buildThreatList(threats){
    threatsList.innerHTML = '';
    for (const t of threats){
      const li = document.createElement('li');
      li.innerHTML = `<strong>${escapeHtml(t.title)}:</strong> ${escapeHtml(t.note)}`;
      threatsList.appendChild(li);
    }
  }

  function escapeHtml(str){
    return String(str)
      .replaceAll('&','&amp;')
      .replaceAll('<','<')
      .replaceAll('>','>')
      .replaceAll('"','"')
      .replaceAll("'",'&#039;');
  }

  function renderActions(list){
    actionsList.innerHTML = '';
    for (const it of list){
      const div = document.createElement('div');
      div.className = 'actionItem';
      div.innerHTML = `
        <div class="title">
          <span class="badge ${badgeClass(it.pri)}">${escapeHtml(it.pri)} priority</span>
        </div>
        <div class="prose" style="margin-top:6px">${escapeHtml(it.text)}</div>
      `;
      actionsList.appendChild(div);
    }
  }

  function scoreToRiskLabel(level){
    if (level === 'High') return { text: 'High', color: 'var(--danger)' };
    if (level === 'Medium') return { text: 'Medium', color: 'var(--warn)' };
    return { text: 'Low', color: 'var(--ok)' };
  }

  function makeReportText({level, securityScore, exposure, threats, actions}){
    const now = new Date();
    const stamp = now.toISOString().slice(0,19).replace('T',' ');

    const lines = [];
    lines.push('DataOfInsta — Instagram Privacy Self-Audit Report');
    lines.push(`Generated: ${stamp}`);
    lines.push('');
    lines.push(`Risk level: ${level}`);
    lines.push(`Security score (higher is better): ${securityScore}/100`);
    lines.push('');

    lines.push('A) Exposure Estimate');
    lines.push(exposure);
    lines.push('');

    lines.push('B) Threats Considered (self-audit framing)');
    for (const t of threats){
      lines.push(`- ${t.title}: ${t.note}`);
    }
    lines.push('');

    lines.push('C) Prioritized action checklist');
    for (const a of actions){
      lines.push(`- [${a.pri}] ${a.text}`);
    }
    lines.push('');

    lines.push('Ethics & scope');
    lines.push('This report is a self-audit tool only. It does not scrape Instagram, does not automate fetching data, and does not attempt access to accounts.');
    lines.push('');

    return lines.join('\n');
  }

  let lastReport = null;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const answers = getAnswers();
    if (!answers){
      alert('Please answer all questions (1–16).');
      return;
    }

    const { riskScore, securityScore, level } = computeRisk(answers);
    const label = scoreToRiskLabel(level);

    const exposure = summarizeExposure(answers);
    const threats = threatsFor(answers, level);
    const actions = buildActions(answers, level);

    riskLabel.textContent = `${label.text} (${riskScore}/100 worst-case posture)`;
    riskLabel.style.color = label.color;
    securityScoreEl.textContent = `${securityScore}/100`;

    exposureText.textContent = exposure;
    buildThreatList(threats);
    renderActions(actions);

    reportBody.hidden = false;

    lastReport = makeReportText({ level, securityScore, exposure, threats, actions });

    // Smooth scroll into view
    document.querySelector('#report').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  resetBtn.addEventListener('click', () => {
    form.reset();
    reportBody.hidden = true;
    lastReport = null;
    riskLabel.textContent = '—';
    securityScoreEl.textContent = '—';
    exposureText.textContent = '—';
    threatsList.innerHTML = '';
    actionsList.innerHTML = '';
  });

  downloadBtn.addEventListener('click', () => {
    if (!lastReport){
      alert('Generate the report first.');
      return;
    }
    const blob = new Blob([lastReport], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'DataOfInsta-report.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  printBtn.addEventListener('click', () => {
    window.print();
  });
})();

