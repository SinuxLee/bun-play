import assert from 'assert'
import { LRUCache } from 'lru-cache'

const options = {
  max: 500,

  // for use with tracking overall storage size
  maxSize: 5000,
  sizeCalculation: (value, key) => {
    return 1
  },

  // for use when you need to clean up something when objects
  // are evicted from the cache
  dispose: (value, key, reason) => {
    // freeFromMemoryOrWhatever(value)
  },

  // for use when you need to know that an item is being inserted
  // note that this does NOT allow you to prevent the insertion,
  // it just allows you to know about it.
  onInsert: (value, key, reason) => {
    // logInsertionOrWhatever(key, value)
  },

  // how long to live in ms
  ttl: 1000 * 60 * 5,

  // return stale items before removing from cache?
  allowStale: false,

  updateAgeOnGet: false,
  updateAgeOnHas: false,

  // async method to use for cache.fetch(), for
  // stale-while-revalidate type of behavior
  fetchMethod: async (key, staleValue, { options, signal, context }) => {},
}

const cache = new LRUCache(options)

cache.set('key', 'value')
cache.get('key') // "value"

// non-string keys ARE fully supported
// but note that it must be THE SAME object, not
// just a JSON-equivalent object.
var someObject = { a: 1 }
cache.set(someObject, 'a value')
// Object keys are not toString()-ed
cache.set('[object Object]', 'a different value')
assert.equal(cache.get(someObject), 'a value')
// A similar object with same keys/values won't work,
// because it's a different object identity
assert.equal(cache.get({ a: 1 }), undefined)

cache.clear() // empty the cache
