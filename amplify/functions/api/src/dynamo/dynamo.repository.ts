import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";

export type TenantRecord = {
  tenantId: string;
  entityKey: string;
  [key: string]: unknown;
};

@Injectable()
export class DynamoRepository {
  readonly tableName: string;
  private readonly client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

  constructor() {
    const tableName = process.env.TABLE_NAME;
    if (!tableName) {
      throw new InternalServerErrorException("TABLE_NAME no está configurado.");
    }
    this.tableName = tableName;
  }

  async queryByEntity(tenantId: string, entityType: string): Promise<TenantRecord[]> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "tenantId = :tenantId AND begins_with(entityKey, :entityPrefix)",
        ExpressionAttributeValues: {
          ":tenantId": tenantId,
          ":entityPrefix": `${entityType}#`,
        },
      }),
    );
    return (result.Items ?? []) as TenantRecord[];
  }

  async get(tenantId: string, entityKey: string): Promise<TenantRecord | undefined> {
    const result = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { tenantId, entityKey },
        ConsistentRead: true,
      }),
    );
    return result.Item as TenantRecord | undefined;
  }

  async transactWrite(items: ConstructorParameters<typeof TransactWriteCommand>[0]["TransactItems"]): Promise<void> {
    await this.client.send(
      new TransactWriteCommand({
        TransactItems: items,
      }),
    );
  }

  async updateWithAudit(
    tenantId: string,
    entityKey: string,
    fields: Record<string, unknown>,
    audit: TenantRecord,
  ): Promise<TenantRecord> {
    const names: Record<string, string> = {};
    const values: Record<string, unknown> = {};
    const updates = Object.entries(fields).map(([key, value], index) => {
      names[`#field${index}`] = key;
      values[`:value${index}`] = value;
      return `#field${index} = :value${index}`;
    });

    await this.client.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: this.tableName,
              Key: { tenantId, entityKey },
              UpdateExpression: `SET ${updates.join(", ")}`,
              ConditionExpression: "attribute_exists(tenantId) AND attribute_exists(entityKey)",
              ExpressionAttributeNames: names,
              ExpressionAttributeValues: values,
            },
          },
          {
            Put: {
              TableName: this.tableName,
              Item: audit,
            },
          },
        ],
      }),
    );
    const updated = await this.get(tenantId, entityKey);
    if (!updated) {
      throw new InternalServerErrorException("No se pudo recuperar el contacto actualizado.");
    }
    return updated;
  }
}
