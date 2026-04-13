/**
 * Telemetry Module — Global observability provider
 *
 * Import as global module in AppModule. TelemetryService becomes
 * injectable in any module without explicit imports.
 *
 * Usage in AppModule:
 *   imports: [TelemetryModule]
 *
 * Usage in any service:
 *   constructor(private readonly telemetry: TelemetryService) {}
 */

import { Global, Module } from '@nestjs/common';
import { TelemetryService } from './telemetry.service';

@Global()
@Module({
  providers: [TelemetryService],
  exports: [TelemetryService],
})
export class TelemetryModule {}
