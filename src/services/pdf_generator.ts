import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import { ContractRecord, IncidentRecord } from "../types";
import { SettlementComputation } from "./settle_engine";

const STATEMENTS_DIR = path.resolve(process.cwd(), "data", "statements");
if (!fs.existsSync(STATEMENTS_DIR)) {
  fs.mkdirSync(STATEMENTS_DIR, { recursive: true });
}

export interface StatementPdfParams {
  settlementId: string;
  contract: ContractRecord;
  math: SettlementComputation;
  paypalAction: "CAPTURE" | "VOID" | "REFUND";
  paypalTransactionId: string;
  aiExplanation: string;
  incidents: IncidentRecord[];
  probesCount: number;
}

export interface ClaimPackPdfParams {
  claimId: string;
  vendorName: string;
  siteUrl: string;
  monthlyFee: number;
  currency: string;
  period: string;
  actualUptime: number;
  targetUptime: number;
  totalDowntimeMinutes: number;
  tierApplied: string;
  creditPct: number;
  creditOwed: number;
  logHash: string;
  probeRegion: string;
  incidents: {
    time_label: string;
    duration_minutes: number;
    reason: string;
    status_code: number;
  }[];
  claimLetter: string;
}

export class PDFGenerator {
  public async generateStatement(params: StatementPdfParams): Promise<string> {
    const filename = `${params.contract.id}_settlement_${Date.now()}.pdf`;
    const outputPath = path.join(STATEMENTS_DIR, filename);

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 40, size: "A4" });
        const writeStream = fs.createWriteStream(outputPath);

        doc.pipe(writeStream);

        // Header / Brand
        doc
          .rect(0, 0, 595.28, 80)
          .fill("#0F172A"); // Dark Slate Blue

        doc
          .fillColor("#FFFFFF")
          .fontSize(20)
          .font("Helvetica-Bold")
          .text("RETAINER REFEREE", 40, 25);

        doc
          .fillColor("#38BDF8") // Sky blue
          .fontSize(10)
          .font("Helvetica")
          .text("AUTOMATIC SLA ENFORCEMENT & PAYPAL SETTLEMENT STATEMENT", 40, 50);

        doc
          .fillColor("#94A3B8")
          .fontSize(9)
          .text(`Statement ID: ${params.settlementId}`, 360, 30, { align: "right" })
          .text(`Generated: ${new Date().toUTCString()}`, 360, 45, { align: "right" });

        doc.moveDown(4);

        // Parties & Metadata
        doc.fillColor("#0F172A").fontSize(12).font("Helvetica-Bold").text("CONTRACT OVERVIEW");
        doc.strokeColor("#E2E8F0").lineWidth(1).moveTo(40, 115).lineTo(555, 115).stroke();

        doc.font("Helvetica").fontSize(10).fillColor("#334155");
        const metaTop = 125;
        doc.text(`Contract Title:`, 40, metaTop);
        doc.font("Helvetica-Bold").text(`${params.contract.title}`, 140, metaTop);

        doc.font("Helvetica").text(`Target Website:`, 40, metaTop + 18);
        doc.font("Helvetica-Bold").fillColor("#2563EB").text(`${params.contract.site_url}`, 140, metaTop + 18);

        doc.font("Helvetica").fillColor("#334155").text(`Agency (Vendor):`, 40, metaTop + 36);
        doc.font("Helvetica-Bold").text(`${params.contract.agency_name}`, 140, metaTop + 36);

        doc.font("Helvetica").text(`Client:`, 320, metaTop + 36);
        doc.font("Helvetica-Bold").text(`${params.contract.client_name} (${params.contract.client_email})`, 370, metaTop + 36);

        // SLA Performance Box
        const perfTop = metaTop + 65;
        doc.fillColor("#0F172A").fontSize(12).font("Helvetica-Bold").text("SLA PERFORMANCE AUDIT", 40, perfTop);
        doc.strokeColor("#E2E8F0").lineWidth(1).moveTo(40, perfTop + 15).lineTo(555, perfTop + 15).stroke();

        // 4 metric cards
        const cardY = perfTop + 25;
        const cardWidth = 120;
        const cardHeight = 50;

        const metrics = [
          { label: "Target SLA", val: `${params.math.targetUptimePct}%` },
          { 
            label: "Actual Uptime", 
            val: `${params.math.actualUptimePct}%`,
            color: params.math.actualUptimePct >= params.math.targetUptimePct ? "#16A34A" : "#DC2626" 
          },
          { label: "Monitored Time", val: `${params.math.totalMonitoredMinutes} min` },
          { label: "Downtime Recorded", val: `${params.math.downtimeMinutes} min` }
        ];

        metrics.forEach((m, idx) => {
          const x = 40 + idx * (cardWidth + 12);
          doc.rect(x, cardY, cardWidth, cardHeight).fillAndStroke("#F8FAFC", "#E2E8F0");
          doc.fillColor("#64748B").fontSize(8).font("Helvetica").text(m.label, x + 8, cardY + 10);
          doc.fillColor(m.color || "#0F172A").fontSize(14).font("Helvetica-Bold").text(m.val, x + 8, cardY + 24);
        });

        // Downtime Incidents Table
        let currentY = cardY + cardHeight + 25;
        doc.fillColor("#0F172A").fontSize(12).font("Helvetica-Bold").text("DOWNTIME TIMELINE & INCIDENTS", 40, currentY);
        doc.strokeColor("#E2E8F0").lineWidth(1).moveTo(40, currentY + 15).lineTo(555, currentY + 15).stroke();

        currentY += 22;
        if (params.incidents.length === 0) {
          doc.rect(40, currentY, 515, 30).fillAndStroke("#F0FDF4", "#BBF7D0");
          doc.fillColor("#166534").fontSize(9).font("Helvetica").text("Zero downtime incidents recorded. 100% continuous uptime achieved during the evaluation window.", 55, currentY + 10);
          currentY += 45;
        } else {
          // Table Header
          doc.rect(40, currentY, 515, 20).fill("#F1F5F9");
          doc.fillColor("#475569").fontSize(8).font("Helvetica-Bold");
          doc.text("INCIDENT ID", 50, currentY + 6);
          doc.text("START TIME (UTC)", 140, currentY + 6);
          doc.text("END TIME (UTC)", 250, currentY + 6);
          doc.text("DURATION", 360, currentY + 6);
          doc.text("ROOT CAUSE", 430, currentY + 6);
          currentY += 22;

          params.incidents.slice(0, 5).forEach((inc) => {
            doc.fillColor("#334155").fontSize(8).font("Helvetica");
            doc.text(inc.id, 50, currentY);
            doc.text(new Date(inc.start_time).toISOString().replace("T", " ").substring(0, 19), 140, currentY);
            doc.text(inc.end_time ? new Date(inc.end_time).toISOString().replace("T", " ").substring(0, 19) : "Ongoing", 250, currentY);
            doc.text(`${inc.duration_seconds || 60}s`, 360, currentY);
            doc.text(inc.reason.substring(0, 22), 430, currentY);
            currentY += 16;
          });
          currentY += 15;
        }

        // Financial Settlement & The Math (Hard Rule: Code Math)
        doc.fillColor("#0F172A").fontSize(12).font("Helvetica-Bold").text("FINANCIAL SETTLEMENT MATH (STRICT CODE-DETERMINED)", 40, currentY);
        doc.strokeColor("#E2E8F0").lineWidth(1).moveTo(40, currentY + 15).lineTo(555, currentY + 15).stroke();
        currentY += 22;

        const mathBoxY = currentY;
        doc.rect(40, mathBoxY, 515, 80).fillAndStroke("#F8FAFC", "#CBD5E1");

        doc.fillColor("#334155").fontSize(9).font("Helvetica");
        doc.text("Agreed Monthly Retainer Hold:", 55, mathBoxY + 12);
        doc.text("Applied SLA Credit Tier:", 55, mathBoxY + 28);
        doc.text("Automatic Credit Amount (Refunded to Client):", 55, mathBoxY + 44);
        doc.font("Helvetica-Bold").text("Net Payout Captured to Agency (Vendor):", 55, mathBoxY + 60);

        const cur = params.contract.currency;
        doc.font("Helvetica").text(`$${params.math.originalFee.toFixed(2)} ${cur}`, 380, mathBoxY + 12, { align: "right", width: 160 });
        doc.text(`${params.math.creditPct}% Credit (${params.math.matchedTier ? `${params.math.matchedTier.min_uptime}-${params.math.matchedTier.max_uptime}%` : "No Penalty"})`, 380, mathBoxY + 28, { align: "right", width: 160 });
        doc.fillColor("#DC2626").text(`- $${params.math.creditAmount.toFixed(2)} ${cur}`, 380, mathBoxY + 44, { align: "right", width: 160 });
        doc.fillColor("#16A34A").font("Helvetica-Bold").fontSize(11).text(`$${params.math.amountOwed.toFixed(2)} ${cur}`, 380, mathBoxY + 58, { align: "right", width: 160 });

        currentY += 95;

        // PayPal Audit Trail
        doc.fillColor("#0F172A").fontSize(12).font("Helvetica-Bold").text("PAYPAL SANDBOX TRANSACTION AUDIT", 40, currentY);
        doc.strokeColor("#E2E8F0").lineWidth(1).moveTo(40, currentY + 15).lineTo(555, currentY + 15).stroke();
        currentY += 22;

        doc.fillColor("#475569").fontSize(9).font("Helvetica");
        doc.text(`PayPal Order ID: ${params.contract.paypal_order_id || "N/A"}`, 40, currentY);
        doc.text(`Authorization ID: ${params.contract.paypal_authorization_id || "N/A"}`, 280, currentY);
        currentY += 16;
        doc.text(`Settlement Action: ${params.paypalAction} (final_capture: true)`, 40, currentY);
        doc.text(`Transaction ID: ${params.paypalTransactionId}`, 280, currentY);
        currentY += 16;
        doc.text(`Authorization Rules: 3-Day Guaranteed Honor Period, 29-Day Total Validity Window`, 40, currentY);
        currentY += 25;

        // Plain-English AI Explanation
        doc.fillColor("#0F172A").fontSize(12).font("Helvetica-Bold").text("EXECUTIVE SUMMARY (AI AUDIT NARRATIVE)", 40, currentY);
        doc.strokeColor("#E2E8F0").lineWidth(1).moveTo(40, currentY + 15).lineTo(555, currentY + 15).stroke();
        currentY += 22;

        doc.rect(40, currentY, 515, 80).fillAndStroke("#F1F5F9", "#E2E8F0");
        doc
          .fillColor("#1E293B")
          .fontSize(8.5)
          .font("Helvetica")
          .text(params.aiExplanation, 52, currentY + 10, {
            width: 490,
            lineGap: 3
          });

        // Footer
        doc
          .fillColor("#94A3B8")
          .fontSize(8)
          .text("Generated automatically by Retainer Referee. Enforcing contracts with code and PayPal authorizations.", 40, 780, { align: "center", width: 515 });

        doc.end();

        writeStream.on("finish", () => {
          resolve(outputPath);
        });

        writeStream.on("error", (err) => {
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  public async generateClaimPack(params: ClaimPackPdfParams): Promise<string> {
    const filename = `claim_${params.claimId}_${Date.now()}.pdf`;
    const outputPath = path.join(STATEMENTS_DIR, filename);

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 40, size: "A4" });
        const writeStream = fs.createWriteStream(outputPath);

        doc.pipe(writeStream);

        // Header / Brand Banner
        doc
          .rect(0, 0, 595.28, 80)
          .fill("#141414"); // Ink Black

        doc
          .fillColor("#FFF7E3") // Warm Canvas
          .fontSize(18)
          .font("Helvetica-Bold")
          .text("RETAINER REFEREE — CLAIM PACK", 40, 24);

        doc
          .fillColor("#E05345") // Coral Red
          .fontSize(9)
          .font("Helvetica")
          .text("CUSTOMER EVIDENCE MODE • SELF-RECORDED UPTIME AUDIT", 40, 48);

        doc
          .fillColor("#94A3B8")
          .fontSize(9)
          .text(`Claim ID: ${params.claimId}`, 360, 25, { align: "right" })
          .text(`Generated: ${new Date().toUTCString()}`, 360, 40, { align: "right" });

        doc.moveDown(4);

        // Vendor & Target Summary
        doc.fillColor("#141414").fontSize(13).font("Helvetica-Bold").text("1. VENDOR & AUDIT SUMMARY", 40, 100);
        doc.moveTo(40, 116).lineTo(555, 116).strokeColor("#E2E8F0").stroke();

        let y = 126;
        doc.fontSize(9).font("Helvetica-Bold").fillColor("#64748B");
        doc.text("Vendor:", 40, y);
        doc.text("Monitored URL:", 200, y);
        doc.text("Monthly Fee:", 420, y);

        y += 14;
        doc.fontSize(10).font("Helvetica").fillColor("#0F172A");
        doc.text(params.vendorName, 40, y);
        doc.text(params.siteUrl, 200, y);
        doc.text(`$${params.monthlyFee.toFixed(2)} ${params.currency}`, 420, y);

        y += 24;
        doc.fontSize(9).font("Helvetica-Bold").fillColor("#64748B");
        doc.text("Target Uptime:", 40, y);
        doc.text("Recorded Uptime:", 200, y);
        doc.text("Total Outage Time:", 420, y);

        y += 14;
        doc.fontSize(10).font("Helvetica").fillColor("#0F172A");
        doc.text(`${params.targetUptime}%`, 40, y);
        doc.text(`${params.actualUptime}%`, 200, y);
        doc.text(`${params.totalDowntimeMinutes} minutes`, 420, y);

        // Evidence Incidents
        y += 30;
        doc.fillColor("#141414").fontSize(13).font("Helvetica-Bold").text("2. INCIDENT TIMELINE & PROBE EVIDENCE", 40, y);
        y += 16;
        doc.moveTo(40, y).lineTo(555, y).strokeColor("#E2E8F0").stroke();

        y += 10;
        doc.fontSize(9).font("Helvetica-Bold").fillColor("#64748B");
        doc.text("Incident Timestamp", 40, y);
        doc.text("Duration", 200, y);
        doc.text("Failure Reason", 320, y);
        doc.text("HTTP Status", 460, y);

        y += 14;
        doc.moveTo(40, y).lineTo(555, y).strokeColor("#E2E8F0").stroke();

        for (const inc of params.incidents) {
          y += 10;
          doc.fontSize(9).font("Helvetica").fillColor("#0F172A");
          doc.text(inc.time_label, 40, y);
          doc.text(`${inc.duration_minutes} min`, 200, y);
          doc.text(inc.reason, 320, y);
          doc.text(inc.status_code ? String(inc.status_code) : "Failed", 460, y);
        }

        // Settlement Math & Tier
        y += 30;
        doc.fillColor("#141414").fontSize(13).font("Helvetica-Bold").text("3. SLA TIER & CREDIT DETERMINATION", 40, y);
        y += 16;
        doc.moveTo(40, y).lineTo(555, y).strokeColor("#E2E8F0").stroke();

        y += 12;
        doc
          .rect(40, y, 515, 60)
          .fill("#F8FAFC")
          .strokeColor("#E2E8F0")
          .stroke();

        doc.fillColor("#0F172A").fontSize(10).font("Helvetica");
        doc.text(`Applied Tier: ${params.tierApplied}`, 55, y + 14);
        doc.text(`Credit Percentage: ${params.creditPct}%`, 55, y + 32);

        doc.font("Helvetica-Bold").fontSize(12).fillColor("#E05345");
        doc.text(`Credit Owed: $${params.creditOwed.toFixed(2)} ${params.currency}`, 340, y + 22, { align: "right", width: 200 });

        // Claim Letter Draft
        y += 80;
        doc.fillColor("#141414").fontSize(13).font("Helvetica-Bold").text("4. CLAIM LETTER DRAFT", 40, y);
        y += 16;
        doc.moveTo(40, y).lineTo(555, y).strokeColor("#E2E8F0").stroke();

        y += 10;
        doc
          .rect(40, y, 515, 80)
          .fill("#FFFDF5")
          .strokeColor("#E2E8F0")
          .stroke();

        doc.fillColor("#334155").fontSize(9.5).font("Helvetica-Oblique");
        doc.text(params.claimLetter, 55, y + 12, { width: 485, lineGap: 3 });

        // Cryptographic Verification & Probe Hash
        y += 100;
        doc.fillColor("#141414").fontSize(13).font("Helvetica-Bold").text("5. CRYPTOGRAPHIC PROBE VERIFICATION", 40, y);
        y += 16;
        doc.moveTo(40, y).lineTo(555, y).strokeColor("#E2E8F0").stroke();

        y += 10;
        doc.fontSize(8.5).font("Helvetica-Bold").fillColor("#64748B");
        doc.text("Probe Region:", 40, y);
        doc.font("Helvetica").fillColor("#0F172A").text(params.probeRegion, 120, y);

        y += 14;
        doc.font("Helvetica-Bold").fillColor("#64748B").text("SHA-256 Hash:", 40, y);
        doc.font("Courier").fillColor("#0F172A").text(params.logHash, 120, y);

        // Legal Notice & Disclosure
        doc
          .fillColor("#94A3B8")
          .fontSize(8)
          .font("Helvetica")
          .text(
            "DISCLOSURE: Self-recorded evidence, a claim and not a guarantee. Letter and figures computed strictly by Retainer Referee code engine.",
            40,
            775,
            { align: "center", width: 515 }
          );

        doc.end();

        writeStream.on("finish", () => {
          resolve(outputPath);
        });

        writeStream.on("error", (err) => {
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }
}

export const pdfGenerator = new PDFGenerator();
