import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

const CONFIG_KEY = 'FIRSTFLUSH_CONFIG';

export function canUseDynamo() {
  return Boolean(process.env.AWS_REGION && process.env.DDB_APP_TABLE);
}

export function createDynamoPersistenceAdapter() {
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION }));
  const tableName = process.env.DDB_APP_TABLE;

  return {
    mode: 'dynamodb',
    async read() {
      const response = await client.send(new GetCommand({
        TableName: tableName,
        Key: { pk: CONFIG_KEY, sk: CONFIG_KEY }
      }));
      if (response.Item?.payload) {
        return response.Item.payload;
      }
      return {
        locations: [],
        observations: [],
        actions: [],
        meta: { lastUpdated: null, initializedAt: null, mode: 'dynamodb' }
      };
    },
    async write(data) {
      const payload = {
        ...data,
        meta: {
          ...(data.meta || {}),
          mode: 'dynamodb',
          lastUpdated: new Date().toISOString()
        }
      };
      await client.send(new PutCommand({
        TableName: tableName,
        Item: { pk: CONFIG_KEY, sk: CONFIG_KEY, payload }
      }));
      return payload;
    },
    async reset() {
      return this.write({ locations: [], observations: [], actions: [], meta: { initializedAt: new Date().toISOString() } });
    }
  };
}
