// Its own setup file, listed first in vitest.config.mts, so that it runs
// before anything imports Dexie: Dexie captures the global indexedDB when its
// module loads. Inside a shared file, the import sorter would move it below
// `dexie` and break every store test.
import 'fake-indexeddb/auto'
