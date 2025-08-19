import { Module } from '@nestjs/common';
import { ElasticsearchModule } from '@nestjs/elasticsearch';

const nodeUrl = 'http://localhost:9200';
console.log('[DEBUG] Registering ES client with node:', nodeUrl);

@Module({
  imports: [
    ElasticsearchModule.register({
      node: nodeUrl,
    }),
  ],
  exports: [ElasticsearchModule],
})
export class CustomElasticsearchModule {}
