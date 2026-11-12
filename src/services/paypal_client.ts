import crypto from "node:crypto";

export interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  isSimulator: boolean;
}

export interface PayPalOrderResponse {
  id: string;
  status: "CREATED" | "SAVED" | "APPROVED" | "VOIDED" | "COMPLETED" | "PAYER_ACTION_REQUIRED";
  intent: "AUTHORIZE";
  links: Array<{ href: string; rel: string; method: string }>;
  create_time?: string;
}

export interface PayPalAuthorizeResponse {
  id: string; // Order ID
  status: "COMPLETED" | "PENDING";
  authorization_id: string;
  authorized_amount: number;
  currency: string;
  expiration_time: string;
  honor_period_expires: string; // 3 days from auth
  raw_response: any;
}

export interface PayPalCaptureResponse {
  id: string; // Capture ID
  status: "COMPLETED" | "PENDING" | "DECLINED" | "FAILED";
  amount: number;
  currency: string;
  final_capture: boolean;
  create_time: string;
  raw_response: any;
}

export interface PayPalVoidResponse {
  id: string; // Authorization ID
  status: "VOIDED";
  voided_at: string;
}

export interface PayPalRefundResponse {
  id: string; // Refund ID
  status: "COMPLETED" | "PENDING";
  amount: number;
  currency: string;
  create_time: string;
}

export class PayPalClient {
  private config: PayPalConfig;
  private cachedToken: { token: string; expiresAt: number } | null = null;

  constructor() {
    const clientId = process.env.PAYPAL_CLIENT_ID || "";
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET || "";
    const isExplicitSimulator = process.env.PAYPAL_SIMULATOR === "true";
    const hasKeys = Boolean(clientId && clientSecret && !clientId.includes("your_client_id"));

    this.config = {
      clientId,
      clientSecret,
      baseUrl: process.env.PAYPAL_BASE_URL || "https://api-m.sandbox.paypal.com",
      isSimulator: isExplicitSimulator || !hasKeys
    };

    if (this.config.isSimulator) {
      console.log("ℹ️ [PayPal] Running in Sandbox Simulator Mode (Realistic offline PayPal Orders & Payments API v2)");
    } else {
      console.log("🔒 [PayPal] Running in LIVE PayPal Sandbox Mode (https://api-m.sandbox.paypal.com)");
    }
  }

  public isSimulator(): boolean {
    return this.config.isSimulator;
  }

  /**
   * Fetch OAuth2 access token from PayPal sandbox
   */
  private async getAccessToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.cachedToken.expiresAt - 60000) {
      return this.cachedToken.token;
    }

    const auth = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString("base64");
    const response = await fetch(`${this.config.baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials"
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`PayPal OAuth2 Error (${response.status}): ${errText}`);
    }

    const data = await response.json() as any;
    this.cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in * 1000)
    };
    return this.cachedToken.token;
  }

  /**
   * 1. Create PayPal Orders v2 with intent AUTHORIZE
   * Holds the client's monthly retainer fee without capturing.
   */
  public async createAuthorizationOrder(params: {
    contractId: string;
    title: string;
    fee: number;
    currency: string;
    returnUrl?: string;
    cancelUrl?: string;
  }): Promise<PayPalOrderResponse> {
    const { contractId, title, fee, currency } = params;
    const formattedFee = fee.toFixed(2);

    if (this.config.isSimulator) {
      const orderId = `ORD-SANDBOX-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
      return {
        id: orderId,
        status: "CREATED",
        intent: "AUTHORIZE",
        links: [
          {
            href: `https://www.sandbox.paypal.com/checkoutnow?token=${orderId}`,
            rel: "approve",
            method: "GET"
          },
          {
            href: `/api/contracts/${contractId}/authorize`,
            rel: "authorize",
            method: "POST"
          }
        ],
        create_time: new Date().toISOString()
      };
    }

    const token = await this.getAccessToken();
    const payload = {
      intent: "AUTHORIZE",
      purchase_units: [
        {
          reference_id: `contract_${contractId}`,
          description: `Retainer Referee Hold: ${title}`,
          amount: {
            currency_code: currency,
            value: formattedFee
          }
        }
      ],
      application_context: {
        brand_name: "Retainer Referee",
        user_action: "CONTINUE",
        return_url: params.returnUrl || `http://localhost:3000/client/approved?contract_id=${contractId}`,
        cancel_url: params.cancelUrl || `http://localhost:3000/client/cancelled?contract_id=${contractId}`
      }
    };

    const response = await fetch(`${this.config.baseUrl}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`PayPal Create Order Error (${response.status}): ${errText}`);
    }

    return (await response.json()) as PayPalOrderResponse;
  }

  /**
   * 2. Authorize the approved Order (Orders v2 Authorize)
   * Locks the authorized funds.
   * Documentation verification:
   * - Honor period: 3 days (guaranteed funds)
   * - Validity window: 29 days (max capture window)
   */
  public async authorizeOrder(orderId: string): Promise<PayPalAuthorizeResponse> {
    const now = new Date();
    // 3-day honor period
    const honorPeriodExpires = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
    // 29-day validity window
    const validityWindowExpires = new Date(now.getTime() + 29 * 24 * 60 * 60 * 1000).toISOString();

    if (this.config.isSimulator) {
      const authId = `AUTH-${crypto.randomBytes(7).toString("hex").toUpperCase()}`;
      return {
        id: orderId,
        status: "COMPLETED",
        authorization_id: authId,
        authorized_amount: 1500.00, // will be matched to contract
        currency: "USD",
        expiration_time: validityWindowExpires,
        honor_period_expires: honorPeriodExpires,
        raw_response: {
          id: orderId,
          status: "COMPLETED",
          payment_source: { paypal: { email_address: "client-sandbox@retainerreferee.com" } },
          purchase_units: [{
            payments: {
              authorizations: [{
                id: authId,
                status: "CREATED",
                amount: { currency_code: "USD", value: "1500.00" },
                seller_protection: { status: "ELIGIBLE" },
                expiration_time: validityWindowExpires
              }]
            }
          }]
        }
      };
    }

    const token = await this.getAccessToken();
    const response = await fetch(`${this.config.baseUrl}/v2/checkout/orders/${orderId}/authorize`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`PayPal Authorize Order Error (${response.status}): ${errText}`);
    }

    const data = await response.json() as any;
    const authObj = data.purchase_units?.[0]?.payments?.authorizations?.[0];

    if (!authObj || !authObj.id) {
      throw new Error(`No authorization object returned by PayPal: ${JSON.stringify(data)}`);
    }

    return {
      id: orderId,
      status: data.status,
      authorization_id: authObj.id,
      authorized_amount: parseFloat(authObj.amount?.value || "0"),
      currency: authObj.amount?.currency_code || "USD",
      expiration_time: authObj.expiration_time || validityWindowExpires,
      honor_period_expires: honorPeriodExpires,
      raw_response: data
    };
  }

  /**
   * 3. Capture Authorization (Payments v2 Capture)
   * Captures only the earned amount (fee minus credit) with final_capture: true.
   */
  public async captureAuthorization(params: {
    authorizationId: string;
    amount: number;
    currency: string;
    isFinalCapture?: boolean;
    note?: string;
  }): Promise<PayPalCaptureResponse> {
    const { authorizationId, amount, currency, isFinalCapture = true, note } = params;
    const formattedAmount = amount.toFixed(2);

    if (this.config.isSimulator) {
      const captureId = `CAP-${crypto.randomBytes(7).toString("hex").toUpperCase()}`;
      return {
        id: captureId,
        status: "COMPLETED",
        amount,
        currency,
        final_capture: isFinalCapture,
        create_time: new Date().toISOString(),
        raw_response: {
          id: captureId,
          status: "COMPLETED",
          amount: { currency_code: currency, value: formattedAmount },
          final_capture: isFinalCapture,
          seller_receivable_breakdown: {
            gross_amount: { currency_code: currency, value: formattedAmount },
            paypal_fee: { currency_code: currency, value: (amount * 0.029 + 0.30).toFixed(2) },
            net_amount: { currency_code: currency, value: (amount * (1 - 0.029) - 0.30).toFixed(2) }
          }
        }
      };
    }

    const token = await this.getAccessToken();
    const payload = {
      amount: {
        currency_code: currency,
        value: formattedAmount
      },
      is_final_capture: isFinalCapture,
      note_to_payer: note || "Retainer Referee SLA settlement payout"
    };

    const response = await fetch(`${this.config.baseUrl}/v2/payments/authorizations/${authorizationId}/capture`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`PayPal Capture Error (${response.status}): ${errText}`);
    }

    const data = await response.json() as any;
    return {
      id: data.id,
      status: data.status,
      amount: parseFloat(data.amount?.value || formattedAmount),
      currency: data.amount?.currency_code || currency,
      final_capture: data.final_capture ?? isFinalCapture,
      create_time: data.create_time || new Date().toISOString(),
      raw_response: data
    };
  }

  /**
   * 4. Void Authorization (Payments v2 Void)
   * Invoked when amount_owed === 0 (e.g. 100% credit penalty applied).
   */
  public async voidAuthorization(authorizationId: string): Promise<PayPalVoidResponse> {
    if (this.config.isSimulator) {
      return {
        id: authorizationId,
        status: "VOIDED",
        voided_at: new Date().toISOString()
      };
    }

    const token = await this.getAccessToken();
    const response = await fetch(`${this.config.baseUrl}/v2/payments/authorizations/${authorizationId}/void`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    // 204 No Content is standard for void
    if (response.status === 204 || response.ok) {
      return {
        id: authorizationId,
        status: "VOIDED",
        voided_at: new Date().toISOString()
      };
    }

    const errText = await response.text();
    throw new Error(`PayPal Void Error (${response.status}): ${errText}`);
  }

  /**
   * 5. Refund Capture (Payments v2 Refund)
   * Invoked if partial refund is required after capture.
   */
  public async refundCapture(params: {
    captureId: string;
    amount: number;
    currency: string;
    note?: string;
  }): Promise<PayPalRefundResponse> {
    const { captureId, amount, currency, note } = params;
    const formattedAmount = amount.toFixed(2);

    if (this.config.isSimulator) {
      const refundId = `REF-${crypto.randomBytes(7).toString("hex").toUpperCase()}`;
      return {
        id: refundId,
        status: "COMPLETED",
        amount,
        currency,
        create_time: new Date().toISOString()
      };
    }

    const token = await this.getAccessToken();
    const payload = {
      amount: {
        currency_code: currency,
        value: formattedAmount
      },
      note_to_payer: note || "Retainer Referee partial adjustment refund"
    };

    const response = await fetch(`${this.config.baseUrl}/v2/payments/captures/${captureId}/refund`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`PayPal Refund Error (${response.status}): ${errText}`);
    }

    const data = await response.json() as any;
    return {
      id: data.id,
      status: data.status,
      amount: parseFloat(data.amount?.value || formattedAmount),
      currency: data.amount?.currency_code || currency,
      create_time: data.create_time || new Date().toISOString()
    };
  }
}

export const paypalClient = new PayPalClient();
