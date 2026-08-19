import { and, eq, lte } from "drizzle-orm";
import { db } from "./db";
import { emailSchedule, proposals, customerPreferences } from "@shared/schema";
import { sendFollowUpEmail, sendMaintenanceReminder, sendReviewRequest, sendBrandedEmail } from "./proposal-email";


function queueIfMissing(proposalId:number,type:string,scheduledFor:number) { const exists=db.select().from(emailSchedule).where(and(eq(emailSchedule.proposalId,proposalId),eq(emailSchedule.type,type))).get(); if(!exists) db.insert(emailSchedule).values({id:crypto.randomUUID(),proposalId,type,scheduledFor,status:"pending"}).run(); }
export function queueLifecycleAutomation(): void {
  const now=Math.floor(Date.now()/1000);
  for (const proposal of db.select().from(proposals).all()) {
    if (!proposal.workCompletedDate || !proposal.customerEmail) continue;
    const pref=db.select().from(customerPreferences).where(eq(customerPreferences.proposalId,proposal.id)).get();
    const completed=Math.floor(new Date(proposal.workCompletedDate).getTime()/1000);
    if (!Number.isFinite(completed)) continue;
    if (pref?.seasonalCheckins !== 0) { const due=completed+182*86400; if(due<=now) queueIfMissing(proposal.id,`seasonal_${Math.floor((now-completed)/(182*86400))}`,now); }
    const years=Number(String(proposal.warrantyTerm||"").match(/\d+/)?.[0]||0); if(years && pref?.emailReminders !== 0) { const due=completed+years*365*86400-90*86400; if(due<=now) queueIfMissing(proposal.id,"warranty_renewal",now); }
  }
}

export async function processScheduledEmails(): Promise<void> {
  queueLifecycleAutomation();
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
      else if (item.type.startsWith("seasonal_")) { await sendBrandedEmail({to:proposal.customerEmail,subject:"Time for your seasonal roof check-in?",title:"Free seasonal roof check-in",customerName:proposal.customerName,body:`<p>Hi ${proposal.customerName}, it is time for your seasonal roof check-in. Book a free inspection whenever you have a concern.</p><p><a href="https://mccurdyroofing.com">Book your inspection</a> · <a href="/api/unsubscribe/${proposal.accessToken}/seasonal_checkins">Unsubscribe</a></p>`}); result={ok:true}; }
      else if (item.type === "warranty_renewal") { await sendBrandedEmail({to:proposal.customerEmail,subject:"Your roof warranty renewal is approaching",title:"Warranty renewal reminder",customerName:proposal.customerName,body:`<p>Hi ${proposal.customerName}, your roof warranty term is approaching. Contact McCurdy to review your renewal options.</p><p><a href="/api/unsubscribe/${proposal.accessToken}/email_reminders">Unsubscribe</a></p>`}); result={ok:true}; }
      else if (item.type === "review_reminder") result = await sendReviewRequest({to:proposal.customerEmail,customerName:proposal.customerName,accessToken:proposal.accessToken});
      else result={ok:false};
      db.update(emailSchedule).set({status:result?.ok ? "sent":"failed",sentAt:now}).where(eq(emailSchedule.id,item.id)).run();
    } catch (error) { console.error("[scheduled-jobs] send failed",item.id,error); db.update(emailSchedule).set({status:"failed"}).where(eq(emailSchedule.id,item.id)).run(); }
  }
}
