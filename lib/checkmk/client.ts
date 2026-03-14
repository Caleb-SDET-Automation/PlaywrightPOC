/**
 * CheckMK Pro REST API Client
 * Submits passive check results and manages hosts/services.
 */
import axios, { AxiosInstance } from 'axios';

export type CheckMKState = 0 | 1 | 2 | 3; // OK | WARN | CRIT | UNKNOWN

export interface PassiveCheckResult {
  hostName:    string;
  serviceName: string;
  state:       CheckMKState;
  output:      string;
  perfData?:   string;
}

export interface CheckMKClientOptions {
  url:      string;  // e.g. https://checkmk.example.com
  site:     string;  // e.g. monitoring
  username: string;
  secret:   string;
}

export class CheckMKClient {
  private http: AxiosInstance;
  private baseUrl: string;

  constructor(private opts: CheckMKClientOptions) {
    this.baseUrl = `${opts.url}/${opts.site}/check_mk/api/1.0`;
    this.http = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bearer ${opts.username} ${opts.secret}`,
        Accept:        'application/json',
        'Content-Type':'application/json',
      },
      timeout: 15_000,
    });
  }

  /**
   * Submit a single passive check result via CheckMK REST API.
   */
  async submitPassiveCheck(result: PassiveCheckResult): Promise<void> {
    const output = result.perfData
      ? `${result.output} | ${result.perfData}`
      : result.output;

    await this.http.post('/domain-types/service/actions/set_passive_check_result/invoke', {
      host_name:    result.hostName,
      service_name: result.serviceName,
      state:        result.state,
      output,
    });
  }

  /**
   * Submit multiple results in parallel (up to concurrency limit).
   */
  async submitBatch(
    results: PassiveCheckResult[],
    concurrency = 5,
  ): Promise<SubmitBatchResult> {
    const errors: Array<{ result: PassiveCheckResult; error: string }> = [];
    const succeeded: PassiveCheckResult[] = [];

    // Process in chunks
    for (let i = 0; i < results.length; i += concurrency) {
      const chunk = results.slice(i, i + concurrency);
      await Promise.all(
        chunk.map(async r => {
          try {
            await this.submitPassiveCheck(r);
            succeeded.push(r);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            errors.push({ result: r, error: msg });
          }
        }),
      );
    }

    return { succeeded, errors };
  }

  /**
   * Ensure a monitoring host exists in CheckMK; create if not.
   */
  async ensureHostExists(hostName: string, folder = '/synthetic-monitoring'): Promise<void> {
    try {
      await this.http.get(`/objects/host_config/${hostName}`);
      // Host exists
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        await this.http.post('/domain-types/host_config/collections/all', {
          host_name: hostName,
          folder,
          attributes: {
            alias:    `Playwright Synthetic Monitor - ${hostName}`,
            tag_criticality: 'prod',
          },
        });
        await this.activateChanges();
      } else {
        throw err;
      }
    }
  }

  /**
   * Acknowledge a service problem programmatically.
   */
  async acknowledgeService(
    hostName: string,
    serviceName: string,
    comment = 'Auto-acknowledged by Playwright monitoring',
  ): Promise<void> {
    await this.http.post(
      '/domain-types/acknowledge/collections/service',
      {
        acknowledge_type: 'service',
        host_name:         hostName,
        service_description: serviceName,
        comment,
        sticky:   true,
        notify:   false,
        persistent: false,
      },
    );
  }

  /**
   * Activate pending changes in CheckMK.
   */
  async activateChanges(): Promise<void> {
    await this.http.post('/domain-types/activation_run/actions/activate-changes/invoke', {
      force_foreign_changes: false,
      redirect: false,
      sites: [this.opts.site],
    });
  }

  /**
   * Get current service state for a host.
   */
  async getServiceState(hostName: string, serviceName: string): Promise<CheckMKState | null> {
    try {
      const resp = await this.http.get(
        `/objects/service/${hostName}/${encodeURIComponent(serviceName)}`,
      );
      return resp.data?.extensions?.state ?? null;
    } catch {
      return null;
    }
  }

  static fromEnv(): CheckMKClient {
    return new CheckMKClient({
      url:      process.env.CHECKMK_URL      || '',
      site:     process.env.CHECKMK_SITE     || 'monitoring',
      username: process.env.CHECKMK_USERNAME || 'automation',
      secret:   process.env.CHECKMK_SECRET   || '',
    });
  }
}

export interface SubmitBatchResult {
  succeeded: PassiveCheckResult[];
  errors:    Array<{ result: PassiveCheckResult; error: string }>;
}
