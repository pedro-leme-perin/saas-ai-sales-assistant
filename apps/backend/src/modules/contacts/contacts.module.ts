// =============================================
// 📄 CONTACTS MODULE (Session 50)
// =============================================

import { Module } from '@nestjs/common';

import { CustomFieldsModule } from '@modules/custom-fields/custom-fields.module';

import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';

@Module({
  imports: [CustomFieldsModule],
  controllers: [ContactsController],
  providers: [ContactsService],
  exports: [ContactsService],
})
export class ContactsModule {}
