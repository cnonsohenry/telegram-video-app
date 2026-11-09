import axios from "axios";

/**
 * Twenty CRM Integration Service for NaijaHomemade
 * 
 * Synchronizes:
 * 1. Contacts (Fans, Subscribers, Creators) -> Twenty CRM People
 * 2. Revenue / Purchases (VIP Subs, Tips, Upgrades) -> Twenty CRM Opportunities (Deals)
 * 3. Creator KYC Verification Requests -> Twenty CRM Screening Pipeline
 * 
 * Fully non-blocking: API calls run asynchronously in the background
 * to ensure zero latency impact on user transactions or browsing.
 */

class CrmService {
  constructor() {
    this.reloadConfig();
    this.timeout = 8000;
  }

  /**
   * Reload configuration dynamically from process.env
   */
  reloadConfig() {
    this.enabled = process.env.CRM_ENABLED === "true";
    this.apiUrl = (process.env.CRM_API_URL || "https://crm.codedloud.com/rest").replace(/\/+$/, "");
    this.apiKey = process.env.CRM_API_KEY || "";
  }

  /**
   * Get HTTP headers for Twenty CRM REST requests
   */
  getHeaders() {
    return {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${this.apiKey}`
    };
  }

  /**
   * Helper to execute CRM API requests safely without throwing unhandled exceptions
   */
  async _request(method, path, data = null, params = null) {
    if (!this.enabled) {
      return null;
    }

    if (!this.apiKey) {
      console.warn("[CRM-WARN] CRM is enabled but CRM_API_KEY is not configured.");
      return null;
    }

    const url = `${this.apiUrl}${path.startsWith("/") ? path : `/${path}`}`;
    try {
      const config = {
        method,
        url,
        headers: this.getHeaders(),
        timeout: this.timeout
      };
      if (params) {
        config.params = params;
      }
      if (data && method.toUpperCase() !== "GET") {
        config.data = data;
      }
      const response = await axios(config);
      return response.data;
    } catch (err) {
      const errMsg = err.response?.data?.message || err.response?.data?.error || err.message;
      console.error(`[CRM-ERROR] ${method.toUpperCase()} ${path} failed:`, errMsg);
      return null;
    }
  }

  /**
   * 1. Synchronize User / Creator into Twenty CRM Person
   * @param {Object} user - User record from app_users
   */
  async syncContact(user) {
    if (!this.enabled || !user || !user.email) return;

    // Run in background (fire-and-forget)
    setImmediate(async () => {
      try {
        const email = String(user.email).trim().toLowerCase();
        // Ignore internal telegram dummy emails
        if (email.endsWith("@internal.naijahomemade.com")) return;

        const username = user.username || "user";
        const displayName = user.display_name || username;
        const roleLabel = user.is_creator ? "Creator" : (user.is_premium ? "VIP Member" : "Fan");

        // Format names nicely
        const nameParts = displayName.split(" ");
        const firstName = nameParts[0] || username;
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : `(@${username})`;

        const personPayload = {
          name: {
            firstName: firstName.substring(0, 50),
            lastName: `${lastName} [${roleLabel}]`.substring(0, 50)
          },
          emails: {
            primaryEmail: email
          },
          jobTitle: roleLabel,
          avatarUrl: user.avatar_url && !user.avatar_url.includes("default-avatar") ? user.avatar_url : undefined
        };

        // Check if Person already exists in Twenty CRM
        const searchRes = await this._request("GET", "/people", null, {
          filter: `emails.primaryEmail[eq]:${email}`,
          limit: 1
        });
        const existingPerson = searchRes?.data?.people?.[0];

        if (existingPerson?.id) {
          // Update existing contact
          await this._request("PATCH", `/people/${existingPerson.id}`, personPayload);
          console.log(`[CRM] Updated contact in Twenty: ${email} (${roleLabel})`);
        } else {
          // Create new contact
          await this._request("POST", "/people", personPayload);
          console.log(`[CRM] Created new contact in Twenty: ${email} (${roleLabel})`);
        }
      } catch (err) {
        console.error("[CRM-SYNC-CONTACT-ERROR]", err.message);
      }
    });
  }

  /**
   * 2. Record Revenue / Deal in Twenty CRM Opportunities
   * @param {Object} deal - Transaction details
   */
  async recordDeal({
    app_user_id,
    user_email,
    username,
    amount_usd,
    transaction_type = "creator_sub",
    creator_username = "platform",
    order_id
  }) {
    if (!this.enabled) return;

    setImmediate(async () => {
      try {
        const amountNum = Number(amount_usd) || 0;
        // Twenty stores amounts in micros (e.g. $25.00 -> 25,000,000 micros)
        const amountMicros = Math.round(amountNum * 1000000);

        let dealTitle = "";
        if (transaction_type === "creator_sub") {
          dealTitle = `VIP Sub: @${username || app_user_id} -> @${creator_username}`;
        } else if (transaction_type === "creator_tip") {
          dealTitle = `Tip: @${username || app_user_id} -> @${creator_username}`;
        } else {
          dealTitle = `Platform VIP Upgrade: @${username || app_user_id}`;
        }

        // Optional: link to existing person in Twenty CRM
        let pointOfContactId = undefined;
        if (user_email) {
          const searchRes = await this._request("GET", "/people", null, {
            filter: `emails.primaryEmail[eq]:${user_email.trim().toLowerCase()}`,
            limit: 1
          });
          pointOfContactId = searchRes?.data?.people?.[0]?.id || undefined;
        }

        const opportunityPayload = {
          name: dealTitle,
          amount: {
            amountMicros,
            currencyCode: "USD"
          },
          stage: "CUSTOMER", // Completed/Won deal
          pointOfContactId
        };

        const res = await this._request("POST", "/opportunities", opportunityPayload);
        if (res) {
          console.log(`[CRM] Logged opportunity in Twenty: "${dealTitle}" ($${amountNum})`);
        }
      } catch (err) {
        console.error("[CRM-RECORD-DEAL-ERROR]", err.message);
      }
    });
  }

  /**
   * 3. Record Creator KYC Verification Request in Twenty CRM Pipeline
   * @param {Object} kycData - KYC submission data
   */
  async recordKycSubmission({ username, email, displayName, id_type, user_id }) {
    if (!this.enabled) return;

    setImmediate(async () => {
      try {
        let pointOfContactId = undefined;
        if (email) {
          const searchRes = await this._request("GET", "/people", null, {
            filter: `emails.primaryEmail[eq]:${email.trim().toLowerCase()}`,
            limit: 1
          });
          pointOfContactId = searchRes?.data?.people?.[0]?.id || undefined;
        }

        const opportunityPayload = {
          name: `KYC Review: @${username} (${id_type || 'ID'})`,
          stage: "SCREENING", // Pipeline stage for pending verification
          pointOfContactId
        };

        await this._request("POST", "/opportunities", opportunityPayload);
        console.log(`[CRM] Created KYC Screening Opportunity for Creator @${username}`);
      } catch (err) {
        console.error("[CRM-RECORD-KYC-ERROR]", err.message);
      }
    });
  }

  /**
   * 4. Record Churned / Expired Subscription
   */
  async recordChurn({ username, email, creator_username }) {
    if (!this.enabled) return;

    setImmediate(async () => {
      try {
        console.log(`[CRM] Subscription expired: @${username} from creator @${creator_username}`);
      } catch (err) {
        console.error("[CRM-RECORD-CHURN-ERROR]", err.message);
      }
    });
  }
}

export const crmService = new CrmService();
export default crmService;
