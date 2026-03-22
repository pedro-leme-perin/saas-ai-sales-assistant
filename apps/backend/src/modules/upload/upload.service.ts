// =====================================================
// 📤 UPLOAD SERVICE — Cloudflare R2 (S3-compatible)
// =====================================================
// Presigned URL pattern: backend generates signed URL,
// frontend uploads directly to R2, no proxy needed.
// =====================================================

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, createHash } from 'crypto';

interface PresignedUrlResult {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  expiresIn: number;
}

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/svg+xml',
];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly accountId: string;
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly bucketName: string;
  private readonly publicUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.accountId = this.configService.get<string>('R2_ACCOUNT_ID') || '';
    this.accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID') || '';
    this.secretAccessKey = this.configService.get<string>('R2_SECRET_ACCESS_KEY') || '';
    this.bucketName = this.configService.get<string>('R2_BUCKET_NAME') || 'salesai-uploads';
    this.publicUrl =
      this.configService.get<string>('R2_PUBLIC_URL') ||
      `https://${this.bucketName}.${this.accountId}.r2.cloudflarestorage.com`;
  }

  /**
   * Generate presigned URL for direct upload from frontend
   */
  async generatePresignedUrl(params: {
    companyId: string;
    fileName: string;
    contentType: string;
    category: 'logos' | 'avatars' | 'attachments';
  }): Promise<PresignedUrlResult> {
    const { companyId, fileName, contentType, category } = params;

    // Validate content type
    if (!ALLOWED_MIME_TYPES.includes(contentType)) {
      throw new BadRequestException(
        `Invalid content type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }

    // Sanitize filename
    const ext = fileName.split('.').pop()?.toLowerCase() || 'png';
    const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'svg'].includes(ext) ? ext : 'png';
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 8);
    const key = `${category}/${companyId}/${timestamp}_${random}.${safeExt}`;

    if (!this.accessKeyId || !this.secretAccessKey) {
      this.logger.warn('R2 credentials not configured — returning mock presigned URL');
      return {
        uploadUrl: `${this.publicUrl}/${key}?mock=true`,
        publicUrl: `${this.publicUrl}/${key}`,
        key,
        expiresIn: 3600,
      };
    }

    // Generate S3-compatible presigned PUT URL
    const expiresIn = 3600; // 1 hour
    const endpoint = `https://${this.accountId}.r2.cloudflarestorage.com`;
    const uploadUrl = await this.generateS3PresignedPut({
      endpoint,
      bucket: this.bucketName,
      key,
      contentType,
      expiresIn,
    });

    return {
      uploadUrl,
      publicUrl: `${this.publicUrl}/${key}`,
      key,
      expiresIn,
    };
  }

  /**
   * Validate that an uploaded file URL belongs to our bucket
   */
  isValidUploadUrl(url: string): boolean {
    if (!url) return false;
    try {
      const parsed = new URL(url);
      return (
        parsed.hostname.includes('r2.cloudflarestorage.com') ||
        parsed.hostname.includes(this.bucketName) ||
        url.startsWith(this.publicUrl)
      );
    } catch {
      return false;
    }
  }

  /**
   * Generate AWS S3 V4 presigned PUT URL
   * Compatible with Cloudflare R2
   */
  private async generateS3PresignedPut(params: {
    endpoint: string;
    bucket: string;
    key: string;
    contentType: string;
    expiresIn: number;
  }): Promise<string> {
    const { endpoint, bucket, key, contentType, expiresIn } = params;
    const now = new Date();
    const dateStamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 8);
    const amzDate = `${dateStamp}T${now.toISOString().replace(/[-:T]/g, '').slice(8, 14)}Z`;
    const region = 'auto';
    const service = 's3';
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

    const host = new URL(endpoint).host;
    const canonicalUri = `/${bucket}/${key}`;

    const queryParams = new URLSearchParams({
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': `${this.accessKeyId}/${credentialScope}`,
      'X-Amz-Date': amzDate,
      'X-Amz-Expires': expiresIn.toString(),
      'X-Amz-SignedHeaders': 'content-type;host',
    });

    const canonicalQueryString = [...queryParams.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');

    const canonicalHeaders = `content-type:${contentType}\nhost:${host}\n`;
    const signedHeaders = 'content-type;host';

    const canonicalRequest = [
      'PUT',
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      'UNSIGNED-PAYLOAD',
    ].join('\n');

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      this.sha256(canonicalRequest),
    ].join('\n');

    const signingKey = this.getSignatureKey(
      this.secretAccessKey,
      dateStamp,
      region,
      service,
    );
    const signature = this.hmacHex(signingKey, stringToSign);

    return `${endpoint}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
  }

  private sha256(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }

  private hmac(key: Buffer | string, data: string): Buffer {
    return createHmac('sha256', key).update(data).digest();
  }

  private hmacHex(key: Buffer | string, data: string): string {
    return createHmac('sha256', key).update(data).digest('hex');
  }

  private getSignatureKey(
    secretKey: string,
    dateStamp: string,
    region: string,
    service: string,
  ): Buffer {
    const kDate = this.hmac(`AWS4${secretKey}`, dateStamp);
    const kRegion = this.hmac(kDate, region);
    const kService = this.hmac(kRegion, service);
    return this.hmac(kService, 'aws4_request');
  }
}
