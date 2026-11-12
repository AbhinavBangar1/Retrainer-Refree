export interface SettlementExplanationParams {
  contractTitle: string;
  agencyName: string;
  clientName: string;
  siteUrl: string;
  targetUptimePct: number;
  actualUptimePct: number;
  downtimeMinutes: number;
  maintenanceMinutes: number;
  totalMonitoredMinutes: number;
  creditTierApplied: string;
  creditPct: number;
  originalFee: number;
  creditAmount: number;
  amountOwed: number;
  currency: string;
  paypalAction: "CAPTURE" | "VOID" | "REFUND";
  paypalTransactionId: string;
  incidentCount: number;
}

export class AIExplainer {
  private geminiKey: string;
  private openAiKey: string;

  constructor() {
    this.geminiKey = process.env.GEMINI_API_KEY || "";
    this.openAiKey = process.env.OPENAI_API_KEY || "";
  }

  /**
   * Generates a plain-English explanation strictly based on pre-computed numbers.
   * HARD RULE: The LLM receives computed numbers only. It never calculates amounts.
   */
  public async generateSettlementExplanation(params: SettlementExplanationParams): Promise<string> {
    const prompt = `You are the Retainer Referee settlement auditor.
Write a concise, transparent, 2-to-3 paragraph plain-English executive summary for the monthly SLA settlement statement.

STRICT RULE:
You MUST NOT calculate, alter, or negotiate any financial amounts or percentages.
Use ONLY the exact pre-computed figures provided below:

- Contract: "${params.contractTitle}"
- Agency: ${params.agencyName}
- Client: ${params.clientName}
- Target Website: ${params.siteUrl}
- Agreed SLA Uptime Target: ${params.targetUptimePct}%
- Actual Monitored Uptime: ${params.actualUptimePct}%
- Monitored Duration: ${params.totalMonitoredMinutes} minutes
- Scheduled Maintenance (Excluded): ${params.maintenanceMinutes} minutes
- Unscheduled Downtime: ${params.downtimeMinutes} minutes across ${params.incidentCount} incident(s)
- Applicable Credit Tier: ${params.creditTierApplied} (${params.creditPct}% credit)
- Retainer Authorized Fee: $${params.originalFee.toFixed(2)} ${params.currency}
- Credit Deducted: $${params.creditAmount.toFixed(2)} ${params.currency}
- Net Final Amount Settled: $${params.amountOwed.toFixed(2)} ${params.currency}
- PayPal Action: ${params.paypalAction} (ID: ${params.paypalTransactionId})

Tone: Objective, authoritative, professional, and clear. Explain whether the SLA was met or what credit was triggered, reassure both parties that the contract self-enforced automatically without tickets or disputes, and cite the PayPal transaction details.`;

    try {
      if (this.geminiKey) {
        return await this.callGemini(prompt);
      }
      if (this.openAiKey) {
        return await this.callOpenAI(prompt);
      }
    } catch (err: any) {
      console.warn("⚠️ [AI Explainer] External LLM failed, using deterministic summary generator:", err.message);
    }

    return this.generateDeterministicSummary(params);
  }

  private async callGemini(prompt: string): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.geminiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2 }
      })
    });

    if (!res.ok) {
      throw new Error(`Gemini API error: ${res.statusText}`);
    }

    const data = await res.json() as any;
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
  }

  private async callOpenAI(prompt: string): Promise<string> {
    const url = "https://api.openai.com/v1/chat/completions";
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.openAiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2
      })
    });

    if (!res.ok) {
      throw new Error(`OpenAI API error: ${res.statusText}`);
    }

    const data = await res.json() as any;
    return data.choices?.[0]?.message?.content?.trim() || "";
  }

  /**
   * High-fidelity deterministic summary generator used offline or when LLM key is absent
   */
  public generateDeterministicSummary(params: SettlementExplanationParams): string {
    const isFullUptime = params.creditPct === 0;

    if (isFullUptime) {
      return (
        `During the billing period, Retainer Referee monitored ${params.siteUrl} for a total of ${params.totalMonitoredMinutes} minutes ` +
        `and recorded an actual uptime of ${params.actualUptimePct}%, successfully satisfying the contractual SLA target of ${params.targetUptimePct}%. ` +
        `${params.maintenanceMinutes > 0 ? `A total of ${params.maintenanceMinutes} minutes of approved maintenance were excluded from downtime calculations. ` : ""}` +
        `Because the SLA commitment was fully honored, 0% credit was incurred, and the full monthly retainer fee of ` +
        `$${params.originalFee.toFixed(2)} ${params.currency} was captured via PayPal (Transaction ID: ${params.paypalTransactionId}) with final capture. ` +
        `No dispute was opened, and both ${params.agencyName} and ${params.clientName} received automatic settlement.`
      );
    }

    return (
      `During this billing cycle, Retainer Referee recorded an actual uptime of ${params.actualUptimePct}% for ${params.siteUrl}, ` +
      `falling below the contractual SLA target of ${params.targetUptimePct}%. A total of ${params.downtimeMinutes} minutes of unscheduled downtime ` +
      `occurred across ${params.incidentCount} incident(s)${params.maintenanceMinutes > 0 ? ` (${params.maintenanceMinutes} minutes of scheduled maintenance were excluded)` : ""}. ` +
      `Pursuant to the contract's agreed credit tiers (${params.creditTierApplied}), an automatic ${params.creditPct}% SLA credit of ` +
      `$${params.creditAmount.toFixed(2)} ${params.currency} was applied immediately without requiring support tickets or claims. ` +
      `Accordingly, PayPal captured only the earned fee of $${params.amountOwed.toFixed(2)} ${params.currency} ` +
      `(Transaction ID: ${params.paypalTransactionId}, final_capture: true), returning the remaining authorized hold of ` +
      `$${params.creditAmount.toFixed(2)} back to ${params.clientName}.`
    );
  }
}

export const aiExplainer = new AIExplainer();
