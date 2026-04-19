import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { WebhookEvent } from '@prisma/client';

export class CreateWebhookDto {
  @IsUrl({ require_protocol: true, require_tld: false }, { message: 'url must be a valid http(s) URL' })
  @MaxLength(2048)
  url!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsEnum(WebhookEvent, { each: true })
  events!: WebhookEvent[];
}
