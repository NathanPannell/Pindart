const RECENT_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

function timestamp(value) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

export function arrangeRepositories(repositories, activity = {}, now = Date.now()) {
  const recent = [];
  const updated = [];
  for (const repo of repositories) {
    const record = activity[String(repo.id)] || {};
    const lastInteraction = Math.max(record.lastSelectedAt || 0, record.lastSubmittedAt || 0);
    const item = { ...repo, interactions: (record.selections || 0) + (record.submissions || 0) * 3 };
    if (lastInteraction > 0 && now - lastInteraction <= RECENT_WINDOW_MS) {
      recent.push({ ...item, lastInteraction });
    } else {
      updated.push(item);
    }
  }
  recent.sort((a, b) =>
    b.lastInteraction - a.lastInteraction ||
    b.interactions - a.interactions ||
    a.full_name.localeCompare(b.full_name));
  updated.sort((a, b) =>
    timestamp(b.updated_at) - timestamp(a.updated_at) ||
    a.full_name.localeCompare(b.full_name));
  return { recent, updated };
}

export function searchRepositories(repositories, query) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return repositories;
  return repositories.filter(repo => terms.every(term => repo.full_name.toLocaleLowerCase().includes(term)));
}
