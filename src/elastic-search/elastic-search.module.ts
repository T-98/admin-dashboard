import { Module, Logger } from '@nestjs/common';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { Client } from '@elastic/elasticsearch';

const logger = new Logger('ElasticsearchModule');

async function waitForElasticsearchWithRetries(
  node: string,
  retries = 5,
  delay = 1000,
): Promise<void> {
  const client = new Client({ node });

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      logger.log(`🔄 [Attempt ${attempt}] Pinging Elasticsearch at ${node}...`);
      await client.cluster.health({ wait_for_status: 'yellow', timeout: '5s' });
      logger.log('✅ Elasticsearch is ready!');
      return;
    } catch (error) {
      logger.warn(`⚠️ Elasticsearch not ready: ${error}`);
      if (attempt < retries) {
        const backoff = delay * 2 ** (attempt - 1);
        logger.log(`⏳ Retrying in ${backoff / 1000}s...`);
        await new Promise((res) => setTimeout(res, backoff));
      } else {
        logger.error(
          '❌ Failed to connect to Elasticsearch after maximum retries.',
        );
      }
    }
  }
}

@Module({
  imports: [
    ElasticsearchModule.registerAsync({
      useFactory: async () => {
        const node = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
        await waitForElasticsearchWithRetries(node);
        return { node };
      },
    }),
  ],
  exports: [ElasticsearchModule],
})
export class CustomElasticsearchModule {}
