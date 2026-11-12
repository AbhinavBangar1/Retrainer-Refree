import { ContractExtraction, ContractExtractionSchema } from "../types";

const SYSTEM_PROMPT = `You are Retainer Referee's contract extraction AI.
Your job is to read unstructured retainer proposals, emails, or chat threads and extract structured contract terms into strict JSON.

CRITICAL RULES:
1. Return ONLY a valid JSON object matching the requested schema. No markdown formatting, no backticks, no commentary.
2. The schema must include:
   - title: string
   - agency_name: string
   - client_name: string
   - client_email: string
   - site_url: string (must be valid http/https URL)
   - fee: number (monthly fee amount, positive)
   - currency: string (3-letter code, e.g. "USD")
   - uptime_target: number (e.g. 99.9)
   - measurement_window: string (e.g. "5 minutes (demo mode)" or "Monthly")
   - billing_period_minutes: number (default to 5 for demo mode unless explicitly specified)
   - credit_tiers: array of objects with:
       min_uptime: number (e.g. 99.5)
       max_uptime: number (e.g. 99.9)
       credit_pct: number (e.g. 10 for 10% credit)
   - maintenance_windows: array of objects with:
       day_of_week: string (optional, e.g. "Sunday")
       start_time: string ("HH:MM")
       end_time: string ("HH:MM")
       timezone: string (e.g. "UTC")
       description: string (optional)
   - exclusions: array of strings (e.g. ["DDoS attacks", "Client-side code changes"])
3. If specific fields are missing in the text, extrapolate reasonable retainer defaults (e.g. fee: 1500, currency: "USD", uptime_target: 99.9, billing_period_minutes: 5).
`;

export class LLMExtractor {
  private geminiKey: string;
  private openAiKey: string;

  constructor() {
    this.geminiKey = process.env.GEMINI_API_KEY || "";
    this.openAiKey = process.env.OPENAI_API_KEY || "";
  }

  /**
   * Main extract method with schema validation and retry loop
   */
  public async extractContractTerms(rawText: string, maxRetries: number = 3): Promise<{
    data: ContractExtraction;
    attempts: number;
    rawLlmOutput: string;
  }> {
    let attempt = 0;
    let lastError = "";
    let lastRawOutput = "";

    while (attempt < maxRetries) {
      attempt++;
      try {
        const prompt = attempt === 1
          ? `Extract retainer contract terms from the following text into strict JSON:\n\n${rawText}`
          : `Your previous JSON output failed validation with the following error:\n${lastError}\n\nPlease fix these issues and re-extract from the original text:\n\n${rawText}\n\nReturn ONLY the fixed valid JSON.`;

        const rawJsonString = await this.callLLM(prompt);
        lastRawOutput = rawJsonString;

        // Clean any code fences if present
        const cleaned = rawJsonString
          .replace(/```json/gi, "")
          .replace(/```/g, "")
          .trim();

        const parsedJson = JSON.parse(cleaned);

        // Validate strictly with Zod schema
        const validation = ContractExtractionSchema.safeParse(parsedJson);
        if (validation.success) {
          return {
            data: validation.data,
            attempts: attempt,
            rawLlmOutput: lastRawOutput
          };
        } else {
          lastError = JSON.stringify(validation.error.format(), null, 2);
          console.warn(`⚠️ [LLM Extractor] Attempt ${attempt} failed validation: ${lastError}`);
        }
      } catch (err: any) {
        lastError = err.message || String(err);
        console.warn(`⚠️ [LLM Extractor] Attempt ${attempt} error: ${lastError}`);
      }
    }

    // Fallback: If all LLM calls fail or no API key, use deterministic fallback extractor
    console.log("ℹ️ [LLM Extractor] Using deterministic schema fallback parser for reliable contract onboarding");
    const fallback = this.heuristicFallbackExtractor(rawText);
    return {
      data: fallback,
      attempts: attempt,
      rawLlmOutput: JSON.stringify(fallback, null, 2)
    };
  }

  private async callLLM(prompt: string): Promise<string> {
    if (this.geminiKey) {
      return this.callGemini(prompt);
    }
    if (this.openAiKey) {
      return this.callOpenAI(prompt);
    }
    // Deterministic simulation when keys are absent
    return JSON.stringify(this.heuristicFallbackExtractor(prompt), null, 2);
  }

  private async callGemini(prompt: string): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.geminiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          response_mime_type: "application/json",
          temperature: 0.1
        }
      })
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini API error (${res.status}): ${err}`);
    }

    const data = await res.json() as any;
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
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
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1
      })
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI API error (${res.status}): ${err}`);
    }

    const data = await res.json() as any;
    return data.choices?.[0]?.message?.content || "{}";
  }

  /**
   * Deterministic pattern extractor for offline/demo operation
   */
  public heuristicFallbackExtractor(text: string): ContractExtraction {
    // Extract fee
    const feeMatch = text.match(/\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(?:\/mo|per month|\/month|monthly|fee)?/i);
    let fee = 1500;
    if (feeMatch && feeMatch[1]) {
      const parsed = parseFloat(feeMatch[1].replace(/,/g, ""));
      if (!isNaN(parsed) && parsed > 0) fee = parsed;
    }

    // Extract site URL
    const urlMatch = text.match(/https?:\/\/[^\s"'<>]+/i);
    const site_url = urlMatch ? urlMatch[0] : "https://client-ecommerce-store.com";

    // Extract client email
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const client_email = emailMatch ? emailMatch[0] : "billing@clientstore.com";

    // Extract uptime target
    const uptimeMatch = text.match(/(9\d(?:\.\d+)?)\s*%\s*(?:uptime|SLA)/i);
    const uptime_target = uptimeMatch ? parseFloat(uptimeMatch[1]) : 99.9;

    // Extract client / agency name
    const agencyMatch = text.match(/agency[:\s]+([A-Za-z0-9\s&]+?)(?:,|\.|\n|$)/i);
    const clientMatch = text.match(/client[:\s]+([A-Za-z0-9\s&]+?)(?:,|\.|\n|$)/i);

    const agency_name = agencyMatch ? agencyMatch[1].trim() : "Apex Web Studio";
    const client_name = clientMatch ? clientMatch[1].trim() : "Nordic Craft Goods";

    return {
      title: `${client_name} Maintenance & SLA Retainer`,
      agency_name,
      client_name,
      client_email,
      site_url,
      fee,
      currency: "USD",
      uptime_target,
      measurement_window: "5 minutes (demo mode)",
      billing_period_minutes: 5,
      credit_tiers: [
        { min_uptime: 99.5, max_uptime: 99.9, credit_pct: 10 },
        { min_uptime: 0, max_uptime: 99.5, credit_pct: 30 }
      ],
      maintenance_windows: [
        {
          day_of_week: "Sunday",
          start_time: "02:00",
          end_time: "04:00",
          timezone: "UTC",
          description: "Routine server maintenance & security updates"
        }
      ],
      exclusions: [
        "Agreed scheduled maintenance windows",
        "Upstream DNS or registrar outages (e.g. Cloudflare / AWS global outage)",
        "Client unauthorized repository commits or DNS modifications"
      ]
    };
  }
}

export const llmExtractor = new LLMExtractor();
