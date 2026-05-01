# Graph Report - F:\projects\rajneesh\cronix  (2026-05-01)

## Corpus Check
- 68 files · ~143,155 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 654 nodes · 1491 edges · 33 communities detected
- Extraction: 74% EXTRACTED · 26% INFERRED · 0% AMBIGUOUS · INFERRED: 384 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]

## God Nodes (most connected - your core abstractions)
1. `run()` - 72 edges
2. `all()` - 57 edges
3. `get()` - 35 edges
4. `el()` - 34 edges
5. `render()` - 32 edges
6. `validationError()` - 21 edges
7. `escapeHtml()` - 19 edges
8. `findById()` - 19 edges
9. `loadConfig()` - 18 edges
10. `notFoundError()` - 18 edges

## Surprising Connections (you probably didn't know these)
- `scanSoftware()` --calls--> `scanPackages()`  [INFERRED]
  F:\projects\rajneesh\cronix\public\js\app.js → F:\projects\rajneesh\cronix\src\services\softwareService.js
- `processS3ThumbBatch()` --calls--> `all()`  [INFERRED]
  F:\projects\rajneesh\cronix\public\js\app.js → F:\projects\rajneesh\cronix\src\db\database.js
- `get()` --calls--> `explainCommand()`  [INFERRED]
  F:\projects\rajneesh\cronix\src\db\database.js → F:\projects\rajneesh\cronix\src\services\commandIntelService.js
- `all()` --calls--> `listAwsConnections()`  [INFERRED]
  F:\projects\rajneesh\cronix\src\db\database.js → F:\projects\rajneesh\cronix\src\services\awsService.js
- `all()` --calls--> `getHistory()`  [INFERRED]
  F:\projects\rajneesh\cronix\src\db\database.js → F:\projects\rajneesh\cronix\src\services\commandIntelService.js

## Communities

### Community 0 - "Community 0"
Cohesion: 0.03
Nodes (129): activateNav(), applyGlobalSearchSelection(), applyTerminalSuggestion(), awsConnectionsHtml(), awsServicePageHtml(), bindGlobalEvents(), bindViewEvents(), bootstrap() (+121 more)

### Community 1 - "Community 1"
Cohesion: 0.04
Nodes (60): refreshData(), jsonParseSafe(), checkDnsMonitor(), createDnsMonitor(), deleteDnsMonitor(), listDnsMonitors(), runDnsLookup(), createEnvVar() (+52 more)

### Community 2 - "Community 2"
Cohesion: 0.08
Nodes (53): AppError, notFoundError(), validationError(), decryptValue(), encryptValue(), updateSavedCommand(), mapServerPayload(), syncServerVaultLink() (+45 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (39): down(), safeExec(), up(), migrateLegacyWorkspaceS3(), migrateLegacyWorkspaceServiceRows(), migrateWorkspaceDefaults(), parseJson(), renameIfExists() (+31 more)

### Community 4 - "Community 4"
Cohesion: 0.1
Nodes (46): all(), commandForOperation(), detectManagers(), executePackageOperation(), fetchCVEs(), fetchVersions(), getManagerPath(), getManagerVersion() (+38 more)

### Community 5 - "Community 5"
Cohesion: 0.09
Nodes (37): apiAuthMiddleware(), deepMerge(), ensureFirstRunPaths(), getConfigFilePath(), loadConfig(), saveConfig(), getRuntimeInfo(), isPidAlive() (+29 more)

### Community 6 - "Community 6"
Cohesion: 0.09
Nodes (38): clearApiKey(), getAiSettings(), upsertAiSettings(), recordTerminalHistory(), fromCallback(), getSftp(), listDirectory(), readFile() (+30 more)

### Community 7 - "Community 7"
Cohesion: 0.15
Nodes (30): loadAwsServiceData(), buildCredentials(), clientConfig(), getAwsConnectionById(), listAwsConnections(), listCloudWatchLogGroups(), listEc2Instances(), listLambdaFunctions() (+22 more)

### Community 8 - "Community 8"
Cohesion: 0.15
Nodes (18): applyFilter(), awsRegionTuples(), bind(), ensureAwsRegions(), ensureServiceCount(), esc(), filters(), markSecret() (+10 more)

### Community 9 - "Community 9"
Cohesion: 0.18
Nodes (16): deleteJobSchedules(), executeJob(), readSystemCrontab(), reloadAllJobs(), removeJobFromSystemCrontab(), runJobNow(), scheduleJob(), syncJobToSystemCrontab() (+8 more)

### Community 10 - "Community 10"
Cohesion: 0.16
Nodes (15): addSnippet(), buildCommandIndex(), deleteSnippet(), downloadAndCacheTldrPages(), ensureCommandSeedData(), ensureTldrDatabaseReady(), explainCommand(), getHistory() (+7 more)

### Community 11 - "Community 11"
Cohesion: 0.21
Nodes (12): buildConnectConfig(), decrypt(), executeRemoteCommand(), fingerprintFromHostKey(), getEncryptKey(), getRemoteCrontab(), getServerStatus(), parseCrontab() (+4 more)

### Community 12 - "Community 12"
Cohesion: 0.33
Nodes (2): humanizeCron(), CronBuilder

### Community 13 - "Community 13"
Cohesion: 0.33
Nodes (8): buildFuse(), ensureTldrCache(), getCommand(), initializeTldrIndex(), isSubsequence(), normalizeToken(), searchCommands(), shouldUpdate()

### Community 14 - "Community 14"
Cohesion: 0.36
Nodes (4): escapeHtml(), formatCountSummary(), renderWorkspaceCard(), renderWorkspaceDetailPage()

### Community 15 - "Community 15"
Cohesion: 1.0
Nodes (0): 

### Community 16 - "Community 16"
Cohesion: 1.0
Nodes (0): 

### Community 17 - "Community 17"
Cohesion: 1.0
Nodes (0): 

### Community 18 - "Community 18"
Cohesion: 1.0
Nodes (0): 

### Community 19 - "Community 19"
Cohesion: 1.0
Nodes (0): 

### Community 20 - "Community 20"
Cohesion: 1.0
Nodes (0): 

### Community 21 - "Community 21"
Cohesion: 1.0
Nodes (0): 

### Community 22 - "Community 22"
Cohesion: 1.0
Nodes (0): 

### Community 23 - "Community 23"
Cohesion: 1.0
Nodes (0): 

### Community 24 - "Community 24"
Cohesion: 1.0
Nodes (0): 

### Community 25 - "Community 25"
Cohesion: 1.0
Nodes (0): 

### Community 26 - "Community 26"
Cohesion: 1.0
Nodes (0): 

### Community 27 - "Community 27"
Cohesion: 1.0
Nodes (0): 

### Community 28 - "Community 28"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "Community 29"
Cohesion: 1.0
Nodes (0): 

### Community 30 - "Community 30"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "Community 31"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Community 32"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **Thin community `Community 15`** (2 nodes): `errorHandler()`, `error-handler.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 16`** (2 nodes): `jobs.js`, `toBoolInt()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 17`** (2 nodes): `asyncHandler()`, `async-handler.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 18`** (1 nodes): `cronix.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 19`** (1 nodes): `api.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 20`** (1 nodes): `theme.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 21`** (1 nodes): `aws.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 22`** (1 nodes): `dashboard.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 23`** (1 nodes): `devtools.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 24`** (1 nodes): `keys.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 25`** (1 nodes): `logs.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 26`** (1 nodes): `s3.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (1 nodes): `saved-commands.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (1 nodes): `search.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (1 nodes): `settings.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (1 nodes): `terminal.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (1 nodes): `workspaces.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (1 nodes): `devToolsService.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `all()` connect `Community 4` to `Community 0`, `Community 1`, `Community 2`, `Community 3`, `Community 5`, `Community 7`, `Community 8`, `Community 9`, `Community 10`, `Community 13`?**
  _High betweenness centrality (0.238) - this node is a cross-community bridge._
- **Why does `get()` connect `Community 3` to `Community 1`, `Community 2`, `Community 4`, `Community 5`, `Community 6`, `Community 7`, `Community 9`, `Community 10`, `Community 11`, `Community 13`?**
  _High betweenness centrality (0.216) - this node is a cross-community bridge._
- **Why does `run()` connect `Community 1` to `Community 2`, `Community 3`, `Community 4`, `Community 6`, `Community 7`, `Community 9`, `Community 10`, `Community 11`?**
  _High betweenness centrality (0.196) - this node is a cross-community bridge._
- **Are the 61 inferred relationships involving `run()` (e.g. with `migrateLegacyWorkspaceS3()` and `migrateLegacyWorkspaceServiceRows()`) actually correct?**
  _`run()` has 61 INFERRED edges - model-reasoned connections that need verification._
- **Are the 54 inferred relationships involving `all()` (e.g. with `refreshData()` and `fetchMissingPackageDescriptions()`) actually correct?**
  _`all()` has 54 INFERRED edges - model-reasoned connections that need verification._
- **Are the 31 inferred relationships involving `get()` (e.g. with `collectServiceConfig()` and `init()`) actually correct?**
  _`get()` has 31 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.03 - nodes in this community are weakly interconnected._