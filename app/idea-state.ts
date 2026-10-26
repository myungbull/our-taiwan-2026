export type IdeaVoteRow = { slotId: string; userId: string; response: 'yes' | 'no' };

export const IDEA_VOTE_SLOT = '__idea__';
export const SCHEDULE_SLOT_PREFIX = '__schedule__:';
export const SCHEDULE_USER = '__shared_schedule_selection__';

export function resolveIdeaApproval(votes: IdeaVoteRow[], createdBy: string, viewerId: string) {
  const ideaVotes = votes.filter((vote) => vote.slotId === IDEA_VOTE_SLOT && vote.userId !== SCHEDULE_USER);
  const viewerVote = ideaVotes.find((vote) => vote.userId === viewerId)?.response ?? null;
  const creatorVote = ideaVotes.find((vote) => vote.userId === createdBy)?.response ?? 'yes';
  const partnerVote = viewerId === createdBy
    ? ideaVotes.find((vote) => vote.userId !== viewerId)?.response ?? null
    : creatorVote;
  const myVote = viewerVote ?? (viewerId === createdBy ? 'yes' : null);
  return {
    votes: [
      { label: '나', response: myVote },
      { label: '동행인', response: partnerVote },
    ],
    myVote,
    approved: myVote === 'yes' && partnerVote === 'yes',
  } as const;
}

export function ideaHasTwoApprovals(votes: IdeaVoteRow[], createdBy: string) {
  const ideaVotes = votes.filter((vote) => vote.slotId === IDEA_VOTE_SLOT && vote.userId !== SCHEDULE_USER);
  const creatorVote = ideaVotes.find((vote) => vote.userId === createdBy)?.response ?? 'yes';
  return creatorVote === 'yes' && ideaVotes.some((vote) => vote.userId !== createdBy && vote.response === 'yes');
}

export function selectedScheduleSlotId(votes: IdeaVoteRow[], approved: boolean) {
  if (!approved) return null;
  const selection = votes.find((vote) => vote.userId === SCHEDULE_USER && vote.slotId.startsWith(SCHEDULE_SLOT_PREFIX) && vote.response === 'yes');
  return selection?.slotId.slice(SCHEDULE_SLOT_PREFIX.length) ?? null;
}
