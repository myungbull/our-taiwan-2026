import assert from 'node:assert/strict';
import test from 'node:test';
import {
  IDEA_VOTE_SLOT,
  SCHEDULE_SLOT_PREFIX,
  SCHEDULE_USER,
  ideaHasTwoApprovals,
  resolveIdeaApproval,
  selectedScheduleSlotId,
} from '../app/idea-state.ts';

const author = 'traveler-a';
const companion = 'traveler-b';
const ideaId = 'sample';
const candidate = 'slot-2026-11-20';
const row = (userId, response) => ({ ideaId, slotId: IDEA_VOTE_SLOT, userId, response });

test('posting an idea counts as the author approval but leaves it out of the waiting list', () => {
  const authorView = resolveIdeaApproval([], author, author);
  const companionView = resolveIdeaApproval([], author, companion);
  assert.equal(authorView.myVote, 'yes');
  assert.equal(authorView.approved, false);
  assert.equal(companionView.myVote, null);
  assert.equal(companionView.votes[1].response, 'yes');
  assert.equal(companionView.approved, false);
});

test('the companion approval is what moves an idea into the shared waiting list', () => {
  const votes = [row(companion, 'yes')];
  assert.equal(resolveIdeaApproval(votes, author, author).approved, true);
  assert.equal(resolveIdeaApproval(votes, author, companion).approved, true);
  assert.equal(ideaHasTwoApprovals(votes, author), true);
});

test('turning either approval off removes agreement and makes any old schedule selection inactive', () => {
  const approvedVotes = [row(author, 'yes'), row(companion, 'yes')];
  const selection = { ideaId, slotId: `${SCHEDULE_SLOT_PREFIX}${candidate}`, userId: SCHEDULE_USER, response: 'yes' };
  const rows = [...approvedVotes, selection];
  assert.equal(selectedScheduleSlotId(rows, true), candidate);

  const turnedOff = [...rows.filter((vote) => vote.userId !== author), row(author, 'no')];
  assert.equal(ideaHasTwoApprovals(turnedOff, author), false);
  assert.equal(selectedScheduleSlotId(turnedOff, false), null);
});

test('a schedule selection alone never approves an idea; an explicit final choice is required', () => {
  const selected = { ideaId, slotId: `${SCHEDULE_SLOT_PREFIX}${candidate}`, userId: SCHEDULE_USER, response: 'yes' };
  const rows = [row(companion, 'yes'), selected];
  assert.equal(resolveIdeaApproval([row(companion, 'yes')], author, companion).approved, true);
  assert.equal(selectedScheduleSlotId(rows, false), null);
  assert.equal(selectedScheduleSlotId(rows, true), candidate);
  assert.equal(selectedScheduleSlotId(rows.filter((vote) => vote.userId !== SCHEDULE_USER), true), null);
});
