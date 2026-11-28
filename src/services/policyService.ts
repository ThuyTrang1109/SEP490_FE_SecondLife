import { request } from './apiClient';

export type PolicyType = 'TERMS_OF_SERVICE';

export interface PolicyVersionDto {
  id: string;
  policyType: PolicyType;
  title: string;
  version: string;
  contentMarkdown: string;
  contentHash: string;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  requiresReacceptance: boolean;
  publishedAt: string | null;
  effectiveAt: string | null;
  updatedAt: string | null;
}

export interface PolicyVersionSummaryDto {
  id: string;
  policyType: PolicyType;
  title: string;
  version: string;
  contentHash: string;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  requiresReacceptance: boolean;
  publishedAt: string | null;
  effectiveAt: string | null;
  updatedAt: string | null;
}

export interface PolicyAcceptanceStatusDto {
  policyType: PolicyType;
  activePolicyVersionId: string;
  activeVersion: string;
  activeTitle: string;
  publishedAt: string | null;
  effectiveAt: string | null;
  requiresAcceptance: boolean;
  acceptedCurrentVersion: boolean;
  acceptedAt: string | null;
  lastConfirmedAt: string | null;
  lastAcceptedVersion: string | null;
  lastAcceptedAt: string | null;
}

let cachedCurrentPolicy: PolicyVersionDto | null = null;
let cachedAtMs = 0;
const CACHE_TTL_MS = 60_000;

export const policyService = {
  async getCurrentPolicy(forceRefresh = false, type: PolicyType = 'TERMS_OF_SERVICE'): Promise<PolicyVersionDto> {
    if (!forceRefresh && cachedCurrentPolicy && cachedCurrentPolicy.policyType === type && Date.now() - cachedAtMs < CACHE_TTL_MS) {
      return cachedCurrentPolicy;
    }
    const res = await request<PolicyVersionDto>(`/v1/policies/current?type=${encodeURIComponent(type)}`, {
      method: 'GET',
      requiresAuth: false,
    });
    cachedCurrentPolicy = res.data;
    cachedAtMs = Date.now();
    return res.data;
  },

  clearCache(): void {
    cachedCurrentPolicy = null;
    cachedAtMs = 0;
  },

  async getPolicyVersion(versionId: string): Promise<PolicyVersionDto> {
    const res = await request<PolicyVersionDto>(`/v1/policies/versions/${encodeURIComponent(versionId)}`, {
      method: 'GET',
      requiresAuth: false,
    });
    return res.data;
  },

  async listPublishedVersions(type: PolicyType = 'TERMS_OF_SERVICE'): Promise<PolicyVersionSummaryDto[]> {
    const res = await request<PolicyVersionSummaryDto[]>(`/v1/policies/versions?type=${encodeURIComponent(type)}`, {
      method: 'GET',
      requiresAuth: false,
    });
    return res.data || [];
  },

  async getAcceptanceStatus(type: PolicyType = 'TERMS_OF_SERVICE'): Promise<PolicyAcceptanceStatusDto> {
    const res = await request<PolicyAcceptanceStatusDto>(
      `/v1/policies/acceptance/status?type=${encodeURIComponent(type)}`,
      {
        method: 'GET',
        requiresAuth: true,
      }
    );
    return res.data;
  },

  async acceptPolicy(
    policyVersionId: string,
    context: 'POLICY_UPDATE' | 'LOGIN' | 'REGISTER' | 'GOOGLE_LOGIN' = 'POLICY_UPDATE'
  ): Promise<PolicyAcceptanceStatusDto> {
    const res = await request<PolicyAcceptanceStatusDto>('/v1/policies/acceptance', {
      method: 'POST',
      body: JSON.stringify({
        policyVersionId,
        accepted: true,
        source: 'WEB',
        context,
      }),
      requiresAuth: true,
    });
    return res.data;
  },
};
