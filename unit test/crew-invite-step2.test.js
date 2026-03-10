/**
 * ════════════════════════════════════════════════════════════════════════════
 * WANDERPLAN AI — Unit Tests: Crew Invite Step 2 Logic
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Coverage:
 *   (1) mapTripMemberStatus    — raw DB/API status → normalised frontend status
 *   (2) isTripInvitePending    — which members should be (re-)invited
 *   (3) toTripMember           — member shape normalisation
 *   (4) step2CrewPool filter   — only accepted crew members appear in Step 2
 *   (5) pendingCrewCount       — counts non-registered crew correctly
 *   (6) inviteSelectedMembers  — email_sent=false → link_only, links captured
 *
 * Run: npx jest crew-invite-step2.test.js --verbose
 */

'use strict';

// ════════════════════════════════════════════════════════════════════════════
// Inline implementations (mirrors WanderPlanLLMFlow.jsx exactly)
// ════════════════════════════════════════════════════════════════════════════

function mapTripMemberStatus(rawStatus) {
  var st = String(rawStatus || '').trim().toLowerCase();
  if (st === 'pending')  return 'invited';
  if (st === 'accepted') return 'accepted';
  if (st === 'declined' || st === 'rejected') return 'declined';
  if (st === 'owner')    return 'accepted';
  return st || 'selected';
}

function isTripInvitePending(member) {
  var st = mapTripMemberStatus(member && (member.trip_status || member.status));
  return st !== 'accepted' && st !== 'invited' && st !== 'declined' && st !== 'link_only';
}

function memberIdentity(member) {
  var em = String(member && member.email || '').trim().toLowerCase();
  if (em) return 'email:' + em;
  var id = String(member && member.id || '').trim();
  if (id) return 'id:' + id;
  return '';
}

function iniFromName(name) {
  return String(name || '').trim().charAt(0).toUpperCase() || '?';
}

function toTripMember(member, tripStatus) {
  var src = member || {};
  var email = String(src.email || '').trim().toLowerCase();
  var name  = String(src.name || email.split('@')[0] || 'Member').trim() || 'Member';
  var nextTripStatus  = mapTripMemberStatus(tripStatus || src.trip_status || 'selected');
  var nextCrewStatus  = String(src.crew_status || src.status || '').trim().toLowerCase() || 'unknown';
  return Object.assign({}, src, {
    name:        name,
    email:       email,
    ini:         src.ini  || iniFromName(name),
    color:       src.color || '#8B5CF6',
    crew_status: nextCrewStatus,
    trip_status: nextTripStatus,
    status:      nextTripStatus,
  });
}

/**
 * Simulates the step2CrewPool building logic from the wizard render function.
 * Returns { step2CrewPool, pendingCrewCount }.
 */
function buildStep2CrewPool(crew, tripMembers) {
  var step2CrewPool = [];
  var step2CrewSeen = {};

  function addStep2CrewMember(raw, tripStatusHint) {
    var m = toTripMember(raw, tripStatusHint || (raw && raw.trip_status) || (raw && raw.status) || 'selected');
    if (mapTripMemberStatus(m.trip_status || m.status) === 'declined') return;
    var key = memberIdentity(m);
    if (!key) return;
    if (step2CrewSeen[key] === undefined) {
      step2CrewSeen[key] = step2CrewPool.length;
      step2CrewPool.push(m);
      return;
    }
    var idx   = step2CrewSeen[key];
    var cur   = step2CrewPool[idx] || {};
    var curSt = mapTripMemberStatus(cur.trip_status || cur.status);
    var nextSt = mapTripMemberStatus(m.trip_status || m.status);
    var rank  = { accepted: 4, invited: 3, selected: 2, pending: 2, declined: 0 };
    var useNext = (rank[nextSt] || 1) > (rank[curSt] || 1);
    step2CrewPool[idx] = Object.assign({}, cur, m, useNext ? { trip_status: nextSt, status: nextSt } : {});
  }

  // ── Key change: only accepted crew (registered users) enter the pool ──
  var pendingCrewCount = 0;
  (crew || []).forEach(function (m) {
    var cst = String(m && m.crew_status || m && m.status || '').trim().toLowerCase();
    if (cst === 'accepted') { addStep2CrewMember(m, 'selected'); }
    else if (cst !== 'declined') { pendingCrewCount++; }
  });

  (tripMembers || []).forEach(function (m) {
    addStep2CrewMember(m, m.trip_status || m.status);
  });

  return { step2CrewPool, pendingCrewCount };
}

/**
 * Simulates the invite loop from inviteSelectedMembersToTrip.
 * `apiFn` receives (email) and returns a mock API response object.
 */
async function simulateInviteLoop(members, apiFn) {
  var statusByEmail  = {};
  var newInviteLinks = {};
  var sent = 0;
  var failed = [];
  var skipped = 0;

  for (var i = 0; i < members.length; i++) {
    var m     = members[i] || {};
    var email = String(m.email || '').trim().toLowerCase();
    if (!email) { failed.push((m.name || 'member ' + (i + 1)) + ': missing email'); continue; }

    var currentStatus = mapTripMemberStatus(m.trip_status || m.status);
    if (currentStatus === 'accepted' || currentStatus === 'invited' || currentStatus === 'link_only') {
      skipped++;
      continue;
    }

    try {
      var ir = await apiFn(email);
      var emailWasSent   = !!(ir && ir.email_sent);
      var mappedStatus   = emailWasSent ? mapTripMemberStatus(ir && ir.status) : 'link_only';
      statusByEmail[email] = mappedStatus;
      if (!emailWasSent && ir && ir.accept_link) {
        newInviteLinks[email] = {
          accept_link: String(ir.accept_link),
          reject_link: String(ir.reject_link || ''),
        };
      }
      sent++;
    } catch (e) {
      failed.push(email + ': ' + String((e && e.message) || 'invite failed'));
    }
  }

  return { statusByEmail, newInviteLinks, sent, failed, skipped };
}

// ════════════════════════════════════════════════════════════════════════════
// (1) mapTripMemberStatus
// ════════════════════════════════════════════════════════════════════════════

describe('mapTripMemberStatus', () => {
  test('pending  → invited  (DB "pending" means invite was sent)', () => {
    expect(mapTripMemberStatus('pending')).toBe('invited');
  });

  test('accepted → accepted', () => {
    expect(mapTripMemberStatus('accepted')).toBe('accepted');
  });

  test('owner    → accepted (trip creator is always accepted)', () => {
    expect(mapTripMemberStatus('owner')).toBe('accepted');
  });

  test('declined → declined', () => {
    expect(mapTripMemberStatus('declined')).toBe('declined');
  });

  test('rejected → declined (alias)', () => {
    expect(mapTripMemberStatus('rejected')).toBe('declined');
  });

  test('selected → selected (freshly toggled, not yet invited)', () => {
    expect(mapTripMemberStatus('selected')).toBe('selected');
  });

  test('link_only → link_only (invite stored, email not sent)', () => {
    expect(mapTripMemberStatus('link_only')).toBe('link_only');
  });

  test('empty string → "selected" (default fallback)', () => {
    expect(mapTripMemberStatus('')).toBe('selected');
  });

  test('null / undefined → "selected" (safe fallback)', () => {
    expect(mapTripMemberStatus(null)).toBe('selected');
    expect(mapTripMemberStatus(undefined)).toBe('selected');
  });

  test('case-insensitive: "PENDING" → invited', () => {
    expect(mapTripMemberStatus('PENDING')).toBe('invited');
    expect(mapTripMemberStatus('Accepted')).toBe('accepted');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// (2) isTripInvitePending
// ════════════════════════════════════════════════════════════════════════════

describe('isTripInvitePending', () => {
  function make(status) {
    return { email: 'x@x.com', trip_status: status, status };
  }

  test('selected  → true  (needs an invite)', () => {
    expect(isTripInvitePending(make('selected'))).toBe(true);
  });

  test('invited   → false (already invited, do not re-send)', () => {
    expect(isTripInvitePending(make('invited'))).toBe(false);
  });

  test('pending   → false (backend "pending" maps to "invited")', () => {
    expect(isTripInvitePending(make('pending'))).toBe(false);
  });

  test('accepted  → false (already on the trip)', () => {
    expect(isTripInvitePending(make('accepted'))).toBe(false);
  });

  test('declined  → false (explicitly rejected, respect their choice)', () => {
    expect(isTripInvitePending(make('declined'))).toBe(false);
  });

  test('link_only → false (invite in DB, do not retry — organiser shares the link manually)', () => {
    expect(isTripInvitePending(make('link_only'))).toBe(false);
  });

  test('falls back to status field when trip_status is absent', () => {
    expect(isTripInvitePending({ email: 'y@y.com', status: 'selected' })).toBe(true);
    expect(isTripInvitePending({ email: 'y@y.com', status: 'invited'  })).toBe(false);
  });

  test('null / undefined member → false (never treat falsy as pending)', () => {
    expect(isTripInvitePending(null)).toBe(false);
    expect(isTripInvitePending(undefined)).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// (3) toTripMember
// ════════════════════════════════════════════════════════════════════════════

describe('toTripMember', () => {
  test('normalises email to lowercase', () => {
    const m = toTripMember({ email: 'Alice@Example.COM' }, 'selected');
    expect(m.email).toBe('alice@example.com');
  });

  test('derives name from email when name is absent', () => {
    const m = toTripMember({ email: 'bob@test.com' }, 'selected');
    expect(m.name).toBe('bob');
  });

  test('maps trip status through mapTripMemberStatus', () => {
    const m = toTripMember({ email: 'c@c.com' }, 'pending');
    expect(m.trip_status).toBe('invited');
    expect(m.status).toBe('invited');
  });

  test('sets status and trip_status to the same normalised value', () => {
    const m = toTripMember({ email: 'd@d.com' }, 'accepted');
    expect(m.trip_status).toBe('accepted');
    expect(m.status).toBe('accepted');
  });

  test('preserves crew_status separately from trip_status', () => {
    const m = toTripMember({ email: 'e@e.com', crew_status: 'accepted' }, 'selected');
    expect(m.crew_status).toBe('accepted');
    expect(m.trip_status).toBe('selected');
  });

  test('generates ini from name', () => {
    const m = toTripMember({ email: 'frank@test.com', name: 'Frank' }, 'selected');
    expect(m.ini).toBe('F');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// (4) step2CrewPool — filtering: only accepted (registered) crew members
// ════════════════════════════════════════════════════════════════════════════

describe('step2CrewPool filtering', () => {
  const acceptedAlice = { email: 'alice@test.com', name: 'Alice', crew_status: 'accepted' };
  const pendingBob    = { email: 'bob@test.com',   name: 'Bob',   crew_status: 'pending'  };
  const linkOnlyCarol = { email: 'carol@test.com', name: 'Carol', crew_status: 'link_only' };
  const declinedDave  = { email: 'dave@test.com',  name: 'Dave',  crew_status: 'declined' };
  const acceptedEve   = { email: 'eve@test.com',   name: 'Eve',   crew_status: 'accepted' };

  test('only accepted crew members appear in the pool', () => {
    const { step2CrewPool } = buildStep2CrewPool(
      [acceptedAlice, pendingBob, linkOnlyCarol, declinedDave, acceptedEve],
      []
    );
    const emails = step2CrewPool.map(m => m.email);
    expect(emails).toContain('alice@test.com');
    expect(emails).toContain('eve@test.com');
    expect(emails).not.toContain('bob@test.com');
    expect(emails).not.toContain('carol@test.com');
    expect(emails).not.toContain('dave@test.com');
  });

  test('pool is empty when no crew members are registered', () => {
    const { step2CrewPool } = buildStep2CrewPool([pendingBob, linkOnlyCarol], []);
    expect(step2CrewPool).toHaveLength(0);
  });

  test('pool is empty when crew list is empty', () => {
    const { step2CrewPool } = buildStep2CrewPool([], []);
    expect(step2CrewPool).toHaveLength(0);
  });

  test('pool is empty when crew list is null/undefined', () => {
    const { step2CrewPool: p1 } = buildStep2CrewPool(null, []);
    const { step2CrewPool: p2 } = buildStep2CrewPool(undefined, []);
    expect(p1).toHaveLength(0);
    expect(p2).toHaveLength(0);
  });

  test('accepted crew member already in trip members keeps higher-priority status', () => {
    // Alice is accepted crew AND already accepted the trip invite
    const tripMember = { email: 'alice@test.com', name: 'Alice', trip_status: 'accepted' };
    const { step2CrewPool } = buildStep2CrewPool([acceptedAlice], [tripMember]);
    const alice = step2CrewPool.find(m => m.email === 'alice@test.com');
    expect(alice).toBeDefined();
    expect(alice.trip_status).toBe('accepted');
  });

  test('declined trip members are excluded from pool even if crew status is accepted', () => {
    const tripMember = { email: 'alice@test.com', trip_status: 'declined' };
    const { step2CrewPool } = buildStep2CrewPool([acceptedAlice], [tripMember]);
    const alice = step2CrewPool.find(m => m.email === 'alice@test.com');
    expect(alice).toBeUndefined();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// (5) pendingCrewCount
// ════════════════════════════════════════════════════════════════════════════

describe('pendingCrewCount', () => {
  test('counts pending and link_only crew (not yet registered / awaiting signup)', () => {
    const crew = [
      { email: 'a@a.com', crew_status: 'accepted'  },
      { email: 'b@b.com', crew_status: 'pending'   },
      { email: 'c@c.com', crew_status: 'link_only' },
      { email: 'd@d.com', crew_status: 'declined'  },
    ];
    const { pendingCrewCount } = buildStep2CrewPool(crew, []);
    // b and c count; a is accepted (registered); d is declined (excluded)
    expect(pendingCrewCount).toBe(2);
  });

  test('zero when all crew are accepted', () => {
    const crew = [
      { email: 'a@a.com', crew_status: 'accepted' },
      { email: 'b@b.com', crew_status: 'accepted' },
    ];
    const { pendingCrewCount } = buildStep2CrewPool(crew, []);
    expect(pendingCrewCount).toBe(0);
  });

  test('zero when crew list is empty', () => {
    const { pendingCrewCount } = buildStep2CrewPool([], []);
    expect(pendingCrewCount).toBe(0);
  });

  test('does not count declined crew in pending count', () => {
    const crew = [{ email: 'a@a.com', crew_status: 'declined' }];
    const { pendingCrewCount } = buildStep2CrewPool(crew, []);
    expect(pendingCrewCount).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// (6) inviteSelectedMembersToTrip — email_sent handling
// ════════════════════════════════════════════════════════════════════════════

describe('invite loop — email_sent handling', () => {
  const ACCEPT = 'https://app.wanderplan.ai/?join_trip_id=trip-1&trip_invite_action=accept';
  const REJECT  = 'https://app.wanderplan.ai/?join_trip_id=trip-1&trip_invite_action=reject';

  test('email_sent=true  → status becomes "invited", no link stored', async () => {
    const apiFn = jest.fn().mockResolvedValue({
      status: 'pending',
      email_sent: true,
      accept_link: ACCEPT,
      reject_link: REJECT,
    });
    const members = [{ email: 'bob@test.com', trip_status: 'selected' }];
    const result = await simulateInviteLoop(members, apiFn);

    expect(result.statusByEmail['bob@test.com']).toBe('invited');
    expect(result.newInviteLinks['bob@test.com']).toBeUndefined();
    expect(result.sent).toBe(1);
  });

  test('email_sent=false → status becomes "link_only", accept/reject links stored', async () => {
    const apiFn = jest.fn().mockResolvedValue({
      status: 'pending',
      email_sent: false,
      accept_link: ACCEPT,
      reject_link: REJECT,
    });
    const members = [{ email: 'carol@test.com', trip_status: 'selected' }];
    const result = await simulateInviteLoop(members, apiFn);

    expect(result.statusByEmail['carol@test.com']).toBe('link_only');
    expect(result.newInviteLinks['carol@test.com']).toEqual({
      accept_link: ACCEPT,
      reject_link: REJECT,
    });
    expect(result.sent).toBe(1);
  });

  test('email_sent=false with no accept_link → link_only status but nothing stored', async () => {
    const apiFn = jest.fn().mockResolvedValue({
      status: 'pending',
      email_sent: false,
      accept_link: '',
      reject_link: '',
    });
    const members = [{ email: 'dave@test.com', trip_status: 'selected' }];
    const result = await simulateInviteLoop(members, apiFn);

    expect(result.statusByEmail['dave@test.com']).toBe('link_only');
    expect(result.newInviteLinks['dave@test.com']).toBeUndefined();
  });

  test('already-invited member is skipped (not re-sent)', async () => {
    const apiFn = jest.fn();
    const members = [{ email: 'eve@test.com', trip_status: 'invited' }];
    const result = await simulateInviteLoop(members, apiFn);

    expect(apiFn).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
    expect(result.sent).toBe(0);
  });

  test('link_only member is skipped (do not retry — organiser shares manually)', async () => {
    const apiFn = jest.fn();
    const members = [{ email: 'frank@test.com', trip_status: 'link_only' }];
    const result = await simulateInviteLoop(members, apiFn);

    expect(apiFn).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
  });

  test('already-accepted member is skipped', async () => {
    const apiFn = jest.fn();
    const members = [{ email: 'alice@test.com', trip_status: 'accepted' }];
    const result = await simulateInviteLoop(members, apiFn);

    expect(apiFn).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
  });

  test('member with missing email is added to failed list', async () => {
    const apiFn = jest.fn();
    const members = [{ name: 'No Email Person', trip_status: 'selected' }];
    const result = await simulateInviteLoop(members, apiFn);

    expect(apiFn).not.toHaveBeenCalled();
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]).toMatch(/missing email/i);
  });

  test('API error adds to failed list, does not crash the loop', async () => {
    const apiFn = jest.fn().mockRejectedValue(new Error('User not found'));
    const members = [{ email: 'ghost@test.com', trip_status: 'selected' }];
    const result = await simulateInviteLoop(members, apiFn);

    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]).toMatch(/User not found/);
    expect(result.sent).toBe(0);
  });

  test('mixed batch: sends to eligible, skips ineligible, captures link_only correctly', async () => {
    const apiFn = jest.fn().mockImplementation(async (email) => {
      if (email === 'new@test.com') {
        return { status: 'pending', email_sent: true, accept_link: ACCEPT, reject_link: REJECT };
      }
      if (email === 'nosmtp@test.com') {
        return { status: 'pending', email_sent: false, accept_link: ACCEPT, reject_link: REJECT };
      }
      throw new Error('User not found');
    });

    const members = [
      { email: 'new@test.com',      trip_status: 'selected'  },  // → invited
      { email: 'nosmtp@test.com',   trip_status: 'selected'  },  // → link_only
      { email: 'already@test.com',  trip_status: 'invited'   },  // → skipped
      { email: 'accepted@test.com', trip_status: 'accepted'  },  // → skipped
      { email: 'linkonly@test.com', trip_status: 'link_only' },  // → skipped
    ];

    const result = await simulateInviteLoop(members, apiFn);

    expect(apiFn).toHaveBeenCalledTimes(2);
    expect(result.sent).toBe(2);
    expect(result.skipped).toBe(3);
    expect(result.statusByEmail['new@test.com']).toBe('invited');
    expect(result.statusByEmail['nosmtp@test.com']).toBe('link_only');
    expect(result.newInviteLinks['nosmtp@test.com']).toEqual({
      accept_link: ACCEPT,
      reject_link: REJECT,
    });
    expect(result.newInviteLinks['new@test.com']).toBeUndefined();
  });
});
