// Polyfill Set operations for Node < 22 (Node 20 runner on CI environments)
if (typeof Set.prototype.union !== 'function') {
  Set.prototype.union = function <T>(other: Set<T> | Iterable<T>): Set<T> {
    const result = new Set<T>(this as Set<T>);
    for (const item of other) {
      result.add(item);
    }
    return result;
  };
}

if (typeof Set.prototype.intersection !== 'function') {
  Set.prototype.intersection = function <T>(other: Set<T> | Iterable<T>): Set<T> {
    const otherSet = other instanceof Set ? other : new Set(other);
    const result = new Set<T>();
    for (const item of this as Set<T>) {
      if (otherSet.has(item)) {
        result.add(item);
      }
    }
    return result;
  };
}

if (typeof Set.prototype.difference !== 'function') {
  Set.prototype.difference = function <T>(other: Set<T> | Iterable<T>): Set<T> {
    const otherSet = other instanceof Set ? other : new Set(other);
    const result = new Set<T>();
    for (const item of this as Set<T>) {
      if (!otherSet.has(item)) {
        result.add(item);
      }
    }
    return result;
  };
}

if (typeof Set.prototype.symmetricDifference !== 'function') {
  Set.prototype.symmetricDifference = function <T>(other: Set<T> | Iterable<T>): Set<T> {
    const otherSet = other instanceof Set ? other : new Set(other);
    const result = new Set<T>();
    for (const item of this as Set<T>) {
      if (!otherSet.has(item)) {
        result.add(item);
      }
    }
    for (const item of otherSet) {
      if (!(this as Set<T>).has(item)) {
        result.add(item);
      }
    }
    return result;
  };
}
