/**
 * cloudfunctions/initKnowledgeEmbeddings/index.js
 *
 * 四册 Part 3：知识库 Embedding 集合初始化
 *
 * 功能：
 *   1. 创建 knowledge_embeddings 集合
 *   2. 加载所有知识条目
 *   3. 调用 embedding API 生成向量
 *   4. 写入数据库
 *
 * 部署后首次运行即可。
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 注意：common/ 模块依赖 knowledge/ 目录的相对路径
// 云函数中 __dirname = cloudfunctions/initKnowledgeEmbeddings/
// 所以 ../../knowledge/ 可访问知识条目
const { loadAllKnowledge, getCategoryStats } = require('./lib/knowledgeRetriever.js')
const { embedBatch, EMBEDDING_CONFIG } = require('./lib/embeddingService.js')

const BATCH_SIZE = 20

exports.main = async (event, context) => {
  const { action = 'init', batchSize = BATCH_SIZE } = event

  const collection = db.collection('knowledge_embeddings')

  try {
    await collection.get()
  } catch (e) {
    // 集合不存在 → 自动创建（写入一条即创建）
    await collection.add({
      data: {
        knowledgeId: '__init__',
        embedding: [],
        createdAt: Date.now(),
        _placeholder: true,
      },
    })
  }

  if (action === 'stats') {
    const all = loadAllKnowledge()
    const stats = getCategoryStats()
    const dbCount = await collection.where({ _placeholder: undefined }).count()
    return {
      code: 0,
      data: { total: all.length, stats, embedded: dbCount.total },
    }
  }

  if (action === 'clear') {
    const res = await collection.get()
    for (const doc of res.data) {
      await collection.doc(doc._id).remove()
    }
    return { code: 0, message: '已清空所有 embedding' }
  }

  // init — 全量构建
  const all = loadAllKnowledge()
  console.log(`[initKnowledgeEmbeddings] 加载 ${all.length} 条知识`)

  let embedded = 0, skipped = 0, failed = 0

  for (let i = 0; i < all.length; i += batchSize) {
    const batch = all.slice(i, i + batchSize)
    const texts = batch.map(e => `${e.title || ''} ${e.summary || ''} ${e.coreRule || ''}`)

    try {
      const embeddings = await embedBatch(texts)

      for (let j = 0; j < batch.length; j++) {
        const entry = batch[j]
        const embedding = embeddings[j]

        if (!embedding || !embedding.length) {
          failed++
          continue
        }

        // Upsert: 检查是否已存在
        const existing = await collection.where({ knowledgeId: entry.knowledgeId }).get()
        if (existing.data.length > 0) {
          await collection.doc(existing.data[0]._id).update({
            data: {
              embedding,
              title: entry.title,
              category: entry.category,
              updatedAt: Date.now(),
              _dim: embedding.length,
            },
          })
          skipped++
        } else {
          await collection.add({
            data: {
              knowledgeId: entry.knowledgeId,
              category: entry.category,
              title: entry.title,
              embedding,
              _dim: embedding.length,
              createdAt: Date.now(),
            },
          })
          embedded++
        }
      }
    } catch (e) {
      console.error(`[Batch ${i}~${i + batchSize}] 失败:`, e.message)
      failed += batch.length
    }
  }

  return {
    code: 0,
    data: {
      total: all.length,
      embedded,
      skipped,
      failed,
      model: EMBEDDING_CONFIG.model,
      message: embedded > 0 ? 'Embedding 初始化完成' : '⚠️ 使用本地模拟 embedding（未配置 API Key）',
    },
  }
}
