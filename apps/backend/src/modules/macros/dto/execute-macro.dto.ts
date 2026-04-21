// =============================================
// 📄 ExecuteMacroDto (Session 56)
// =============================================

import { IsUUID } from 'class-validator';

export class ExecuteMacroDto {
  @IsUUID()
  chatId!: string;
}
