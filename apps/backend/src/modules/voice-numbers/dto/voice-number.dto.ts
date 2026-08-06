// =====================================================
// 📞 VOICE NUMBER DTOs — ADR-018
// =====================================================

import { IsOptional, IsString, Length, Matches, Max, Min, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SearchVoiceNumbersDto {
  @ApiProperty({ description: 'ISO 3166-1 alpha-2 country code', example: 'BR' })
  @IsString()
  @Length(2, 2, { message: 'countryCode must be exactly 2 letters (ISO 3166-1 alpha-2)' })
  @Matches(/^[A-Za-z]{2}$/, { message: 'countryCode must contain letters only' })
  countryCode!: string;

  @ApiPropertyOptional({ description: 'Local area code to filter by', example: '16' })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{1,5}$/, { message: 'areaCode must be 1 to 5 digits' })
  areaCode?: string;

  @ApiPropertyOptional({ description: 'How many results to return', example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50) // a human picks from this list; beyond 50 it is noise, and Twilio charges latency
  limit?: number;
}

export class ProvisionVoiceNumberDto {
  @ApiProperty({ description: 'Number to buy, in E.164', example: '+551623980155' })
  @IsString()
  // E.164 is not cosmetic here: it is the exact format Twilio sends in the inbound `To`
  // webhook parameter, and Company.voicePhoneNumber is the lookup key for tenant resolution
  // (ADR-018 §2.2). A number stored in any other shape silently stops matching inbound calls.
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message: 'phoneNumber must be E.164 format (e.g. +551623980155)',
  })
  phoneNumber!: string;
}
