import { and, eq, lte } from "drizzle-orm";
import { db } from "./db";
import { emailSchedule, proposals } from "@shared/schema";
import { sendFollowUpEmail, sendMaintenanceReminder, sendReviewRequest } from "./proposal-email";

export async function processScheduledEmails(): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const pending = db.select().from(emailSchedule).where(and(eq(emailSchedule.status,"pending"), lte(emailSchedule.scheduledFor,now))).all();
  for (const item of pending) {
    const proposal = db.select().from(proposals).where(eq(proposals.id,item.proposalId)).get();
    if (!proposal?.customerEmail) { db.update(emailSchedule).set({status:"failed"}).where(eq(emailSchedule.id,item.id)).run(); continue; }
    try {
      let result: { ok?: boolean } | void;
      if (/^day(1|3|7|14)$/.test(item.type)) result = await sendFollowUpEmail({to:proposal.customerEmail,customerName:proposal.customerName,accessToken:proposal.accessToken,day:Number(item.type.slice(3)) as 1|3|7|14});
      else if (/^maintenance_y(1|3|5|10)$/.test(item.type)) { await sendMaintenanceReminder({toEmail:proposal.customerEmail,customerName:proposal.customerName,companyName:proposal.companyName,proposalNumber:proposal.proposalNumber,accessToken:proposal.accessToken,yearsSinceCompletion:Number(item.type.replace("maintenance_y","")),systemType:proposal.systemType}); result={ok:true}; }
      else if (item.type === "review_request") result = await sendReviewRequest({to:proposal.customerEmail,customerName:proposal.customerName,accessToken:proposal.accessToken});
      else result={ok:false};
      db.update(emailSchedule).set({status:result?.ok ? "sent":"failed",sentAt:now}).where(eq(emailSchedule.id,item.id)).run();
    } catch (error) { console.error("[scheduled-jobs] send failed",item.id,error); db.update(emailSchedule).set({status:"failed"}).where(eq(emailSchedule.id,item.id)).run(); }
  }
}
