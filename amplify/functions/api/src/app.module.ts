import { Module } from "@nestjs/common";
import { ContactsController } from "./contacts/contacts.controller";
import { ContactsService } from "./contacts/contacts.service";
import { DynamoRepository } from "./dynamo/dynamo.repository";

@Module({
  controllers: [ContactsController],
  providers: [
    DynamoRepository,
    {
      provide: ContactsService,
      useFactory: (repository: DynamoRepository) => new ContactsService(repository),
      inject: [DynamoRepository],
    },
  ],
})
export class AppModule {}
