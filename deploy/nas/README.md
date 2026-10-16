# QNAP NAS 部署

当前应用由 Node.js 服务提供网页、共享词库和图片 OCR，端口仍为 `3093`。

NAS 目录：`/share/CACHEDEV1_DATA/Container/word-match`

部署目录结构：

```text
word-match/
├── Dockerfile
├── package.json
├── server.mjs
├── dist/
└── deploy/nas/
    ├── compose.yml
    └── data/             # 持久词库，不随重建删除
```

在项目根目录执行：

```sh
mkdir -p deploy/nas/data
cp deploy/nas/.env.example deploy/nas/.env
# 编辑 .env，设置至少 10 位的 WORD_MATCH_ADMIN_TOKEN
/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker compose \
  --env-file deploy/nas/.env \
  -f deploy/nas/compose.yml up -d --build --force-recreate
```

验证：

```sh
/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker inspect \
  --format '{{.State.Status}} {{.State.Health.Status}}' word-match
curl -fsS http://127.0.0.1:3093/api/health
curl -fsS http://127.0.0.1:3093/api/library
```

局域网地址：`http://192.168.50.251:3093/`

`deploy/nas/data/library.json` 是当前共享词库，服务每次修改前会自动保留一份 `library.previous.json`。

上传图片、导入、删除和恢复词库时，页面会要求输入 `.env` 中的管理密码；同一浏览器验证成功后会记住该密码。
