# Graph Report - /Volumes/F/projects/rajneesh/oggo  (2026-04-21)

## Corpus Check
- 57 files · ~122,325 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 544 nodes · 1239 edges · 38 communities detected
- Extraction: 76% EXTRACTED · 24% INFERRED · 0% AMBIGUOUS · INFERRED: 296 edges (avg confidence: 0.8)
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
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]

## God Nodes (most connected - your core abstractions)
1. `run()` - 64 edges
2. `all()` - 51 edges
3. `render()` - 32 edges
4. `el()` - 31 edges
5. `get()` - 31 edges
6. `loadConfig()` - 18 edges
7. `runOnTarget()` - 17 edges
8. `escapeHtml()` - 16 edges
9. `bindViewEvents()` - 16 edges
10. `validationError()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `scanSoftware()` --calls--> `scanPackages()`  [INFERRED]
  /Volumes/F/projects/rajneesh/oggo/public/js/app.js → /Volumes/F/projects/rajneesh/oggo/src/services/softwareService.js
- `processS3ThumbBatch()` --calls--> `all()`  [INFERRED]
  /Volumes/F/projects/rajneesh/oggo/public/js/app.js → /Volumes/F/projects/rajneesh/oggo/src/db/database.js
- `all()` --calls--> `findAll()`  [INFERRED]
  /Volumes/F/projects/rajneesh/oggo/src/db/database.js → /Volumes/F/projects/rajneesh/oggo/src/db/repositories/workspaceRepository.js
- `all()` --calls--> `listConnections()`  [INFERRED]
  /Volumes/F/projects/rajneesh/oggo/src/db/database.js → /Volumes/F/projects/rajneesh/oggo/src/services/s3Service.js
- `all()` --calls--> `listAwsConnections()`  [INFERRED]
  /Volumes/F/projects/rajneesh/oggo/src/db/database.js → /Volumes/F/projects/rajneesh/oggo/src/services/awsService.js

## Communities

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (52): refreshData(), jsonParseSafe(), checkDnsMonitor(), createDnsMonitor(), deleteDnsMonitor(), listDnsMonitors(), runDnsLookup(), createEnvVar() (+44 more)

### Community 1 - "Community 1"
Cohesion: 0.09
Nodes (39): AppError, notFoundError(), validationError(), createCategory(), createSavedCommand(), markUsed(), normalizeScope(), updateSavedCommand() (+31 more)

### Community 2 - "Community 2"
Cohesion: 0.13
Nodes (38): loadSavedCommands(), all(), listCategories(), listSavedCommands(), listAll(), commandForOperation(), detectManagers(), executePackageOperation() (+30 more)

### Community 3 - "Community 3"
Cohesion: 0.1
Nodes (33): apiAuthMiddleware(), deepMerge(), ensureFirstRunPaths(), getConfigFilePath(), loadConfig(), saveConfig(), createMysqlPool(), getSchemaStatements() (+25 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (19): card(), dashboardHtml(), detectMonacoLanguage(), ensureMonacoLoaded(), formatS3Modified(), getFilteredPackages(), jobsHtml(), mountGuiMonacoEditor() (+11 more)

### Community 5 - "Community 5"
Cohesion: 0.09
Nodes (32): down(), safeExec(), up(), collectServiceConfig(), addSnippet(), buildCommandIndex(), deleteSnippet(), downloadAndCacheTldrPages() (+24 more)

### Community 6 - "Community 6"
Cohesion: 0.15
Nodes (31): loadAwsServiceData(), buildCredentials(), clientConfig(), getAwsConnectionById(), listAwsConnections(), listCloudWatchLogGroups(), listEc2Instances(), listLambdaFunctions() (+23 more)

### Community 7 - "Community 7"
Cohesion: 0.12
Nodes (27): activateNav(), applyGlobalSearchSelection(), closeGlobalSearch(), closePackagePanels(), el(), field(), flattenGroupedSearchResults(), getAwsContextItems() (+19 more)

### Community 8 - "Community 8"
Cohesion: 0.1
Nodes (26): awsConnectionsHtml(), awsServicePageHtml(), bindViewEvents(), classifyOutputLine(), dnsMonitorHtml(), envVarsHtml(), fetchMissingPackageDescriptions(), fileToBase64() (+18 more)

### Community 9 - "Community 9"
Cohesion: 0.15
Nodes (19): migrateLegacyWorkspaceS3(), migrateLegacyWorkspaceServiceRows(), migrateWorkspaceDefaults(), parseJson(), renameIfExists(), safeExec(), tableExists(), up() (+11 more)

### Community 10 - "Community 10"
Cohesion: 0.15
Nodes (19): recordTerminalHistory(), fromCallback(), getSftp(), listDirectory(), readFile(), resolveRemotePath(), writeFile(), writeFileViaSftp() (+11 more)

### Community 11 - "Community 11"
Cohesion: 0.18
Nodes (16): deleteJobSchedules(), executeJob(), readSystemCrontab(), reloadAllJobs(), removeJobFromSystemCrontab(), runJobNow(), scheduleJob(), syncJobToSystemCrontab() (+8 more)

### Community 12 - "Community 12"
Cohesion: 0.13
Nodes (19): buildUpdateConfirmHtml(), escapeHtml(), escapeRegex(), highlightSearch(), openWorkspaceServiceModal(), packageCounts(), packageKey(), packageRowStateClass() (+11 more)

### Community 13 - "Community 13"
Cohesion: 0.19
Nodes (14): ensureS3PresignedUrl(), formatBytes(), getFileExt(), getFileNameFromKey(), getS3FileCategory(), getS3GridSizeClass(), getS3PresignExpirySeconds(), getS3StorageClassSummary() (+6 more)

### Community 14 - "Community 14"
Cohesion: 0.33
Nodes (2): humanizeCron(), CronBuilder

### Community 15 - "Community 15"
Cohesion: 0.22
Nodes (10): bindGlobalEvents(), bootstrap(), configureSoftwareAutoScan(), connectTerminal(), explainLastTerminalCommand(), loadActiveTerminalGuiTab(), maybeRunSoftwareAutoScan(), performGlobalSearch() (+2 more)

### Community 16 - "Community 16"
Cohesion: 0.33
Nodes (8): buildFuse(), ensureTldrCache(), getCommand(), initializeTldrIndex(), isSubsequence(), normalizeToken(), searchCommands(), shouldUpdate()

### Community 17 - "Community 17"
Cohesion: 0.39
Nodes (7): buildSearchIndex(), ensureSearchIndex(), getSearchIndex(), groupSearchResults(), normalizeString(), scoreItem(), searchIndex()

### Community 18 - "Community 18"
Cohesion: 0.36
Nodes (4): escapeHtml(), formatCountSummary(), renderWorkspaceCard(), renderWorkspaceDetailPage()

### Community 19 - "Community 19"
Cohesion: 0.47
Nodes (6): applyTerminalSuggestion(), handleTerminalTabSuggestion(), hideTerminalSuggestions(), renderTerminalSuggestionsBox(), showTerminalExamplesHint(), showTerminalSuggestions()

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

### Community 33 - "Community 33"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "Community 34"
Cohesion: 1.0
Nodes (0): 

### Community 35 - "Community 35"
Cohesion: 1.0
Nodes (0): 

### Community 36 - "Community 36"
Cohesion: 1.0
Nodes (0): 

### Community 37 - "Community 37"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **Thin community `Community 20`** (2 nodes): `errorHandler()`, `error-handler.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 21`** (2 nodes): `asyncHandler()`, `async-handler.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 22`** (2 nodes): `toBoolInt()`, `jobs.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 23`** (1 nodes): `cronix.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 24`** (1 nodes): `theme.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 25`** (1 nodes): `api.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 26`** (1 nodes): `aws.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (1 nodes): `keys.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (1 nodes): `terminal.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (1 nodes): `s3.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (1 nodes): `workspaces.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (1 nodes): `logs.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (1 nodes): `devtools.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (1 nodes): `dashboard.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (1 nodes): `saved-commands.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (1 nodes): `search.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (1 nodes): `settings.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (1 nodes): `devToolsService.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `get()` connect `Community 5` to `Community 0`, `Community 1`, `Community 2`, `Community 3`, `Community 6`, `Community 9`, `Community 10`, `Community 11`, `Community 16`?**
  _High betweenness centrality (0.228) - this node is a cross-community bridge._
- **Why does `all()` connect `Community 2` to `Community 0`, `Community 1`, `Community 4`, `Community 5`, `Community 6`, `Community 8`, `Community 9`, `Community 11`, `Community 16`, `Community 17`?**
  _High betweenness centrality (0.227) - this node is a cross-community bridge._
- **Why does `run()` connect `Community 0` to `Community 1`, `Community 2`, `Community 4`, `Community 5`, `Community 6`, `Community 9`, `Community 10`, `Community 11`?**
  _High betweenness centrality (0.194) - this node is a cross-community bridge._
- **Are the 53 inferred relationships involving `run()` (e.g. with `migrateLegacyWorkspaceS3()` and `migrateLegacyWorkspaceServiceRows()`) actually correct?**
  _`run()` has 53 INFERRED edges - model-reasoned connections that need verification._
- **Are the 48 inferred relationships involving `all()` (e.g. with `refreshData()` and `fetchMissingPackageDescriptions()`) actually correct?**
  _`all()` has 48 INFERRED edges - model-reasoned connections that need verification._
- **Are the 27 inferred relationships involving `get()` (e.g. with `collectServiceConfig()` and `init()`) actually correct?**
  _`get()` has 27 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._