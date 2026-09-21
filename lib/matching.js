// Weighted mentor <-> mentee matching engine.
//
// Every mentor/mentee pair is scored 0-100 across five weighted criteria.
// The weights were chosen so that "has walked a similar road" (parenting
// stage experience + shared major/field) counts for more than soft
// scheduling logistics, but availability still matters because a mentor
// match that can never actually meet isn't useful.
//
//   Major / field of study alignment ........ 25 pts
//   Parenting-stage experience gap ........... 20 pts
//   Availability overlap ..................... 20 pts
//   Shared interests / support-need tags ..... 20 pts
//   Mentor capacity & life-stage relevance ... 15 pts
//                                       total  100 pts

const STAGE_ORDER = ['expecting', 'infant', 'toddler', 'preschool', 'school_age', 'teen'];

function tagSet(csv) {
  if (!csv) return new Set();
  return new Set(
    csv.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
  );
}

function jaccard(setA, setB) {
  if (setA.size === 0 || setB.size === 0) return null; // "unknown", not "zero"
  const intersection = [...setA].filter((x) => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

function scoreMajorAlignment(mentorProfile, menteeProfile) {
  const a = (mentorProfile.major || '').trim().toLowerCase();
  const b = (menteeProfile.major || '').trim().toLowerCase();
  if (!a || !b) return { score: 10, note: 'One or both majors unknown — neutral score' };
  if (a === b) return { score: 25, note: `Exact match: ${mentorProfile.major}` };
  const aWords = new Set(a.split(/\s+/));
  const bWords = new Set(b.split(/\s+/));
  const overlap = [...aWords].some((w) => bWords.has(w) && w.length > 3);
  if (overlap) return { score: 16, note: 'Related field of study' };
  return { score: 6, note: 'Different fields of study' };
}

function scoreParentingExperience(mentorProfile, menteeProfile) {
  if (mentorProfile.parenting_stage === 'multiple_stages') {
    return { score: 20, note: 'Mentor has parented through multiple stages' };
  }
  const mentorIdx = STAGE_ORDER.indexOf(mentorProfile.parenting_stage);
  const menteeIdx = STAGE_ORDER.indexOf(menteeProfile.parenting_stage);
  if (mentorIdx === -1 || menteeIdx === -1) {
    return { score: 8, note: 'Parenting stage unknown for one or both — neutral score' };
  }
  const gap = mentorIdx - menteeIdx;
  if (gap < 0) return { score: 6, note: 'Mentor is earlier in the parenting journey than mentee' };
  if (gap === 0) return { score: 12, note: 'Mentor is at the same stage — relatable, less runway' };
  if (gap <= 2) return { score: 20, note: 'Mentor is a few stages ahead — sweet spot for guidance' };
  return { score: 15, note: 'Mentor is much further along — still valuable perspective' };
}

function scoreAvailabilityOverlap(mentorProfile, menteeProfile) {
  const overlap = jaccard(tagSet(mentorProfile.availability), tagSet(menteeProfile.availability));
  if (overlap === null) return { score: 8, note: 'Availability not specified for one or both — neutral score' };
  return { score: Math.round(overlap * 20), note: `${Math.round(overlap * 100)}% schedule overlap` };
}

function scoreSharedInterests(mentorProfile, menteeProfile) {
  const overlap = jaccard(tagSet(mentorProfile.interests), tagSet(menteeProfile.interests));
  if (overlap === null) return { score: 6, note: 'Interests/support-needs not specified — neutral score' };
  return { score: Math.round(overlap * 20), note: `${Math.round(overlap * 100)}% shared interests/support needs` };
}

function scoreCapacityRelevance(mentorProfile, menteeProfile, currentMenteeCount) {
  if (!mentorProfile.accepting_mentees) {
    return { score: 0, note: 'Mentor is not currently accepting mentees' };
  }
  const capacity = mentorProfile.max_mentees ?? 3;
  if (currentMenteeCount >= capacity) {
    return { score: 0, note: 'Mentor is at capacity' };
  }
  let score = 10 + Math.round(((capacity - currentMenteeCount) / capacity) * 5);

  // Small relevance bump if the mentor's kid-age experience roughly brackets
  // the mentee's child age range — i.e. "been there recently."
  const mMin = mentorProfile.child_age_min, mMax = mentorProfile.child_age_max;
  const eMin = menteeProfile.child_age_min, eMax = menteeProfile.child_age_max;
  if (mMin != null && mMax != null && eMin != null && eMax != null) {
    const overlaps = mMax >= eMin - 2 && mMin <= eMax + 6; // mentor's experience is nearby or ahead
    if (!overlaps) score = Math.max(0, score - 3);
  }
  return { score: Math.min(15, score), note: 'Based on open mentee capacity and child-age relevance' };
}

/**
 * Score a single mentor/mentee pair.
 * @param {object} mentorProfile - row from `profiles` for the mentor
 * @param {object} menteeProfile - row from `profiles` for the mentee
 * @param {number} currentMenteeCount - how many active mentees this mentor already has
 * @returns {{score: number, breakdown: object}}
 */
function computeMatchScore(mentorProfile, menteeProfile, currentMenteeCount = 0) {
  const majorAlignment = scoreMajorAlignment(mentorProfile, menteeProfile);
  const parentingExperience = scoreParentingExperience(mentorProfile, menteeProfile);
  const availabilityOverlap = scoreAvailabilityOverlap(mentorProfile, menteeProfile);
  const sharedInterests = scoreSharedInterests(mentorProfile, menteeProfile);
  const capacityRelevance = scoreCapacityRelevance(mentorProfile, menteeProfile, currentMenteeCount);

  const breakdown = { majorAlignment, parentingExperience, availabilityOverlap, sharedInterests, capacityRelevance };
  const score = Math.round(
    majorAlignment.score +
    parentingExperience.score +
    availabilityOverlap.score +
    sharedInterests.score +
    capacityRelevance.score
  );
  return { score, breakdown };
}

module.exports = { computeMatchScore, STAGE_ORDER };
