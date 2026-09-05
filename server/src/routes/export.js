/**
 * Export routes — generates downloadable reports.
 *
 * WHY THIS EXISTS
 * -------------------------------------------------------------------------
 * The problem statement requires "evidence-based decision-making for
 * policymakers and administrators." Officials need to generate reports for
 * superiors, court submissions, and policy briefings. This route provides
 * simple text-based exports that can be printed or saved as PDF from the
 * browser's print dialog.
 *
 * The exports are deliberately text-based (not binary PDF) so they work
 * without additional dependencies and can be printed to PDF from any browser.
 */

import { Router } from 'express';
import { requireRole } from '../access/requireRole.js';
import { ROLES } from '../access/roles.js';
import { store } from '../store/memoryStore.js';

export const exportRouter = Router();

// Both counsellors and admins can export, but they see different data.
exportRouter.use(requireRole(ROLES.COUNSELLOR, ROLES.ADMIN));

/**
 * GET /api/export/case/:caseId — generate a case summary report.
 *
 * Returns a plain-text report suitable for printing or saving as PDF.
 */
exportRouter.get('/case/:caseId', (req, res) => {
  const { caseId } = req.params;
  const caseRecord = store.getCase(caseId);
  if (!caseRecord) {
    return res.status(404).json({ error: 'Case not found.' });
  }

  const history = store.getHistory(caseId);
  const latest = store.getLatestAssessment(caseId);

  const lines = [
    '═══════════════════════════════════════════════════════════════',
    '  CASE SUMMARY REPORT',
    '  Ministry of Social Justice & Empowerment',
    '  SC/ST (Prevention of Atrocities) Act, 1989',
    '═══════════════════════════════════════════════════════════════',
    '',
    `Case ID:           ${caseRecord.caseId}`,
    `Pseudonym:         ${caseRecord.pseudonym}`,
    `District:          ${caseRecord.district}`,
    `State:             ${caseRecord.state}`,
    `Case Stage:        ${caseRecord.caseStage}`,
    `Months Registered: ${caseRecord.monthsSinceRegistration}`,
    `Priority Tags:     ${caseRecord.priorityTags.join(', ')}`,
    `Preferred Language: ${caseRecord.preferredLocale === 'hi' ? 'Hindi' : 'English'}`,
    '',
    `Report Generated:  ${new Date().toISOString().split('T')[0]}`,
    '',
    '───────────────────────────────────────────────────────────────',
    '  CURRENT STATUS',
    '───────────────────────────────────────────────────────────────',
    '',
  ];

  if (latest) {
    lines.push(
      `Distress Score:    ${latest.score} (${latest.band})`,
      `Trend:             ${latest.trend.direction} (${latest.trend.slope?.toFixed(1)} points/check-in)`,
      `Escalated:         ${latest.escalation.triggered ? 'YES' : 'No'}`,
    );

    if (latest.escalation.triggered) {
      lines.push(
        '  Trigger Reasons:',
        ...latest.escalation.triggerReasons.map((r) => `    - ${r.label}`),
      );
    }

    if (latest.emotions?.emotions?.length > 0) {
      lines.push(
        '',
        '  Detected Emotions:',
        ...latest.emotions.emotions.map((e) => `    - ${e.label} (${Math.round(e.intensity * 100)}%)`),
      );
    }

    if (latest.prediction?.predicted) {
      lines.push(
        '',
        '  Trend Prediction:',
        `    Estimated escalation in ~${latest.prediction.estimatedDaysToThreshold} days`,
        `    Confidence: ${latest.prediction.confidence}`,
      );
    }

    lines.push(
      '',
      '  Recommended Interventions:',
      ...latest.interventions.map((i) => `    - [${i.urgency}] ${i.label}: ${i.description.slice(0, 80)}`),
    );
  }

  lines.push(
    '',
    '───────────────────────────────────────────────────────────────',
    '  CHECK-IN HISTORY',
    '───────────────────────────────────────────────────────────────',
    '',
  );

  for (const c of history) {
    const date = new Date(c.occurredAt).toLocaleDateString();
    const status = c.status === 'missed' ? 'MISSED' : `${c.wordCount} words`;
    lines.push(`  #${c.sequence} — ${date} (${c.channel}, ${c.locale}) — ${status}`);
    if (c.turns.length > 0) {
      for (const t of c.turns) {
        const prefix = t.speaker === 'system' ? '    Service: ' : '    Person:  ';
        lines.push(`${prefix}${t.text.slice(0, 100)}`);
      }
    }
    if (c.signals?.length > 0) {
      lines.push(`    Signals: ${c.signals.join(', ')}`);
    }
    lines.push('');
  }

  lines.push(
    '───────────────────────────────────────────────────────────────',
    '  CONFIDENTIAL — For official use only',
    '  This report contains pseudonymous case data.',
    '  Do not share outside authorized channels.',
    '───────────────────────────────────────────────────────────────',
  );

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="case-${caseId}-report.txt"`);
  res.send(lines.join('\n'));
});

/**
 * GET /api/export/national — generate a national overview report.
 *
 * Admin-only. Returns aggregate statistics in text format.
 */
exportRouter.get('/national', requireRole(ROLES.ADMIN), (req, res) => {
  const inputs = store.aggregateInputs();

  const bandCounts = {};
  for (const r of inputs) {
    bandCounts[r.band] = (bandCounts[r.band] ?? 0) + 1;
  }

  const escalatedCount = inputs.filter((r) => r.escalated).length;
  const risingCount = inputs.filter((r) => r.trendDirection === 'rising').length;

  const lines = [
    '═══════════════════════════════════════════════════════════════',
    '  NATIONAL MONITORING OVERVIEW',
    '  Ministry of Social Justice & Empowerment',
    '  SC/ST (Prevention of Atrocities) Act, 1989',
    '═══════════════════════════════════════════════════════════════',
    '',
    `Report Date:  ${new Date().toISOString().split('T')[0]}`,
    `Total Cases:  ${inputs.length}`,
    '',
    '───────────────────────────────────────────────────────────────',
    '  RISK DISTRIBUTION',
    '───────────────────────────────────────────────────────────────',
    '',
    `  Low:       ${bandCounts.low ?? 0}`,
    `  Moderate:  ${bandCounts.moderate ?? 0}`,
    `  Elevated:  ${bandCounts.elevated ?? 0}`,
    `  High:      ${bandCounts.high ?? 0}`,
    '',
    '───────────────────────────────────────────────────────────────',
    '  KEY METRICS',
    '───────────────────────────────────────────────────────────────',
    '',
    `  Active Alerts:      ${escalatedCount}`,
    `  Rising Trends:      ${risingCount}`,
    `  Escalation Rate:    ${inputs.length > 0 ? Math.round((escalatedCount / inputs.length) * 100) : 0}%`,
    '',
    '───────────────────────────────────────────────────────────────',
    '  GEOGRAPHIC BREAKDOWN',
    '───────────────────────────────────────────────────────────────',
    '',
  ];

  // Group by state
  const byState = {};
  for (const r of inputs) {
    if (!byState[r.state]) byState[r.state] = { total: 0, escalated: 0 };
    byState[r.state].total++;
    if (r.escalated) byState[r.state].escalated++;
  }

  for (const [state, data] of Object.entries(byState)) {
    lines.push(`  ${state}: ${data.total} cases (${data.escalated} alerts)`);
  }

  lines.push(
    '',
    '───────────────────────────────────────────────────────────────',
    '  CONFIDENTIAL — For official use only',
    '  This report contains anonymised aggregate data only.',
    '  Individual case data is never included.',
    '───────────────────────────────────────────────────────────────',
  );

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="national-overview-report.txt"');
  res.send(lines.join('\n'));
});
