import { Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { CreateContactDto, UpdateContactDto } from "./contact.dto";
import { DynamoRepository, type TenantRecord } from "../dynamo/dynamo.repository";

type ContactRecord = TenantRecord & {
  id: string;
  entityType: "CONTACT";
  name: string;
  email?: string;
  phone?: string;
  type: string;
  status: string;
  company?: string;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class ContactsService {
  constructor(private readonly repository: DynamoRepository) {}

  list(tenantId: string): Promise<TenantRecord[]> {
    return this.repository.queryByEntity(tenantId, "CONTACT");
  }

  async get(tenantId: string, id: string): Promise<TenantRecord> {
    const contact = await this.repository.get(tenantId, `CONTACT#${id}`);
    if (!contact) throw new NotFoundException("No se encontró el contacto.");
    return contact;
  }

  async create(tenantId: string, actorId: string, input: CreateContactDto): Promise<ContactRecord> {
    const now = new Date().toISOString();
    const id = randomUUID();
    const contact: ContactRecord = {
      ...input,
      id,
      entityType: "CONTACT",
      tenantId,
      entityKey: `CONTACT#${id}`,
      status: "nuevo",
      createdAt: now,
      updatedAt: now,
    };
    const audit: TenantRecord = {
      tenantId,
      entityKey: `AUDIT#${now}#${randomUUID()}`,
      actorId,
      action: "CONTACT_CREATED",
      entityType: "CONTACT",
      entityId: contact.id,
      occurredAt: now,
      result: "SUCCESS",
    };
    await this.repository.transactWrite([
      { Put: { TableName: this.repository.tableName, Item: contact } },
      { Put: { TableName: this.repository.tableName, Item: audit } },
    ]);
    return contact;
  }

  async update(tenantId: string, actorId: string, id: string, input: UpdateContactDto): Promise<TenantRecord> {
    await this.get(tenantId, id);
    const now = new Date().toISOString();
    return this.repository.updateWithAudit(
      tenantId,
      `CONTACT#${id}`,
      { ...input, updatedAt: now },
      {
        tenantId,
        entityKey: `AUDIT#${now}#${randomUUID()}`,
        actorId,
        action: "CONTACT_UPDATED",
        entityType: "CONTACT",
        entityId: id,
        occurredAt: now,
        result: "SUCCESS",
      },
    );
  }

  async deactivate(tenantId: string, actorId: string, id: string): Promise<void> {
    await this.update(tenantId, actorId, id, { status: "inactivo" });
  }
}
