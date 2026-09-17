export function renderPrOpenOrUpdateReport(output, report) {
  output.step('PR open-or-update report');
  output.info(`PR number: ${report.prNumber}`);
  output.info(`PR URL: ${report.prUrl}`);
  output.info(`${report.reviewLink.label}: ${report.reviewLink.url}`);
  output.info(`Next workflow: ${report.nextStep}`);
  output.info(`Branch: ${report.branch}`);
  output.info(`Action: ${report.action}`);
  if (report.observation) output.warning(report.observation);
}

export function renderMergePrReport(output, report) {
  output.step('PR merge report');
  if (report.repository) output.info(`Repository: ${report.repository}`);
  output.info(`PR number: ${report.prNumber}`);
  output.info(`PR URL: ${report.prUrl}`);
  if (report.baseBranch) output.info(`Base branch: ${report.baseBranch}`);
  if (report.observedPrHead)
    output.info(`Observed PR head: ${report.observedPrHead}`);
  if (report.observedPrState)
    output.info(`Observed PR state: ${report.observedPrState}`);
  output.info(`Merge status: ${report.mergeStatus}`);
  if (report.mergeMode) output.info(`Merge mode: ${report.mergeMode}`);
}
