import type {
  ActivityEvent,
  ChangeOrder,
  ProjectTimeline,
  Proposal,
  Referral,
  UpgradeAddon,
} from "@shared/schema";

/**
 * Shape exposed to a customer who has opened a proposal by its access token.
 * The token is a credential, so it must never be reflected in a response.
 */
export function toPublicProposal(proposal: Proposal) {
  const {
    accessToken: _accessToken,
    privateNotes: _privateNotes,
    customerSignature: _customerSignature,
    signedByName: _signedByName,
    signedByTitle: _signedByTitle,
    lastSentAt: _lastSentAt,
    lastSentTo: _lastSentTo,
    sendCount: _sendCount,
    aiRoofAnalysis: _aiRoofAnalysis,
    aiAnalysisReviewedBy: _aiAnalysisReviewedBy,
    ...publicProposal
  } = proposal;

  return publicProposal;
}

/**
 * Admin routes are authenticated and intentionally retain the complete record.
 * Keeping this explicit makes the privilege boundary clear at call sites.
 */
export function toAdminProposal(proposal: Proposal): Proposal {
  return proposal;
}

/**
 * Public activity data must not disclose request metadata that can identify or
 * fingerprint the customer.
 */
export function toPublicActivity(activity: ActivityEvent) {
  const {
    ipAddress: _ipAddress,
    userAgent: _userAgent,
    ...publicActivity
  } = activity;

  return publicActivity;
}

export function toPublicChangeOrder(changeOrder: ChangeOrder) {
  const {
    customerSignature: _customerSignature,
    signedByName: _signedByName,
    sentAt: _sentAt,
    proposalId: _proposalId,
    ...publicChangeOrder
  } = changeOrder;

  return publicChangeOrder;
}

export function toPublicAddon(addon: UpgradeAddon) {
  const {
    proposalId: _proposalId,
    createdAt: _createdAt,
    ...publicAddon
  } = addon;

  return publicAddon;
}

export function toPublicTimelineItem(item: ProjectTimeline) {
  const {
    proposalId: _proposalId,
    createdAt: _createdAt,
    ...publicTimelineItem
  } = item;
  // Older field captures appended internal crew notes to captions; never show those to customers.
  const caption = publicTimelineItem.caption ? publicTimelineItem.caption.replace(/\s*·\s*Note:[\s\S]*$/, "").trim() || null : null;
  return { ...publicTimelineItem, caption };
}

export function toPublicReferral(referral: Referral) {
  const {
    referrerProposalId: _referrerProposalId,
    referrerEmail: _referrerEmail,
    refereeEmail: _refereeEmail,
    refereePhone: _refereePhone,
    refereeAddress: _refereeAddress,
    ...publicReferral
  } = referral;

  return publicReferral;
}
