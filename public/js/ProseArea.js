var ProseArea = (function (exports) {
  'use strict';

  // ::- Persistent data structure representing an ordered mapping from
  // strings to values, with some convenient update methods.
  function OrderedMap(content) {
    this.content = content;
  }

  OrderedMap.prototype = {
    constructor: OrderedMap,
    find: function (key) {
      for (var i = 0; i < this.content.length; i += 2) if (this.content[i] === key) return i;

      return -1;
    },
    // :: (string) → ?any
    // Retrieve the value stored under `key`, or return undefined when
    // no such key exists.
    get: function (key) {
      var found = this.find(key);
      return found == -1 ? undefined : this.content[found + 1];
    },
    // :: (string, any, ?string) → OrderedMap
    // Create a new map by replacing the value of `key` with a new
    // value, or adding a binding to the end of the map. If `newKey` is
    // given, the key of the binding will be replaced with that key.
    update: function (key, value, newKey) {
      var self = newKey && newKey != key ? this.remove(newKey) : this;
      var found = self.find(key),
          content = self.content.slice();

      if (found == -1) {
        content.push(newKey || key, value);
      } else {
        content[found + 1] = value;
        if (newKey) content[found] = newKey;
      }

      return new OrderedMap(content);
    },
    // :: (string) → OrderedMap
    // Return a map with the given key removed, if it existed.
    remove: function (key) {
      var found = this.find(key);
      if (found == -1) return this;
      var content = this.content.slice();
      content.splice(found, 2);
      return new OrderedMap(content);
    },
    // :: (string, any) → OrderedMap
    // Add a new key to the start of the map.
    addToStart: function (key, value) {
      return new OrderedMap([key, value].concat(this.remove(key).content));
    },
    // :: (string, any) → OrderedMap
    // Add a new key to the end of the map.
    addToEnd: function (key, value) {
      var content = this.remove(key).content.slice();
      content.push(key, value);
      return new OrderedMap(content);
    },
    // :: (string, string, any) → OrderedMap
    // Add a key after the given key. If `place` is not found, the new
    // key is added to the end.
    addBefore: function (place, key, value) {
      var without = this.remove(key),
          content = without.content.slice();
      var found = without.find(place);
      content.splice(found == -1 ? content.length : found, 0, key, value);
      return new OrderedMap(content);
    },
    // :: ((key: string, value: any))
    // Call the given function for each key/value pair in the map, in
    // order.
    forEach: function (f) {
      for (var i = 0; i < this.content.length; i += 2) f(this.content[i], this.content[i + 1]);
    },
    // :: (union<Object, OrderedMap>) → OrderedMap
    // Create a new map by prepending the keys in this map that don't
    // appear in `map` before the keys in `map`.
    prepend: function (map) {
      map = OrderedMap.from(map);
      if (!map.size) return this;
      return new OrderedMap(map.content.concat(this.subtract(map).content));
    },
    // :: (union<Object, OrderedMap>) → OrderedMap
    // Create a new map by appending the keys in this map that don't
    // appear in `map` after the keys in `map`.
    append: function (map) {
      map = OrderedMap.from(map);
      if (!map.size) return this;
      return new OrderedMap(this.subtract(map).content.concat(map.content));
    },
    // :: (union<Object, OrderedMap>) → OrderedMap
    // Create a map containing all the keys in this map that don't
    // appear in `map`.
    subtract: function (map) {
      var result = this;
      map = OrderedMap.from(map);

      for (var i = 0; i < map.content.length; i += 2) result = result.remove(map.content[i]);

      return result;
    },

    // :: number
    // The amount of keys in this map.
    get size() {
      return this.content.length >> 1;
    }

  }; // :: (?union<Object, OrderedMap>) → OrderedMap
  // Return a map with the given content. If null, create an empty
  // map. If given an ordered map, return that map itself. If given an
  // object, create a map from the object's properties.

  OrderedMap.from = function (value) {
    if (value instanceof OrderedMap) return value;
    var content = [];
    if (value) for (var prop in value) content.push(prop, value[prop]);
    return new OrderedMap(content);
  };

  var orderedmap = OrderedMap;

  function findDiffStart(a, b, pos) {
    for (var i = 0;; i++) {
      if (i == a.childCount || i == b.childCount) {
        return a.childCount == b.childCount ? null : pos;
      }

      var childA = a.child(i),
          childB = b.child(i);

      if (childA == childB) {
        pos += childA.nodeSize;
        continue;
      }

      if (!childA.sameMarkup(childB)) {
        return pos;
      }

      if (childA.isText && childA.text != childB.text) {
        for (var j = 0; childA.text[j] == childB.text[j]; j++) {
          pos++;
        }

        return pos;
      }

      if (childA.content.size || childB.content.size) {
        var inner = findDiffStart(childA.content, childB.content, pos + 1);

        if (inner != null) {
          return inner;
        }
      }

      pos += childA.nodeSize;
    }
  }

  function findDiffEnd(a, b, posA, posB) {
    for (var iA = a.childCount, iB = b.childCount;;) {
      if (iA == 0 || iB == 0) {
        return iA == iB ? null : {
          a: posA,
          b: posB
        };
      }

      var childA = a.child(--iA),
          childB = b.child(--iB),
          size = childA.nodeSize;

      if (childA == childB) {
        posA -= size;
        posB -= size;
        continue;
      }

      if (!childA.sameMarkup(childB)) {
        return {
          a: posA,
          b: posB
        };
      }

      if (childA.isText && childA.text != childB.text) {
        var same = 0,
            minSize = Math.min(childA.text.length, childB.text.length);

        while (same < minSize && childA.text[childA.text.length - same - 1] == childB.text[childB.text.length - same - 1]) {
          same++;
          posA--;
          posB--;
        }

        return {
          a: posA,
          b: posB
        };
      }

      if (childA.content.size || childB.content.size) {
        var inner = findDiffEnd(childA.content, childB.content, posA - 1, posB - 1);

        if (inner) {
          return inner;
        }
      }

      posA -= size;
      posB -= size;
    }
  } // ::- A fragment represents a node's collection of child nodes.
  //
  // Like nodes, fragments are persistent data structures, and you
  // should not mutate them or their content. Rather, you create new
  // instances whenever needed. The API tries to make this easy.


  var Fragment = function Fragment(content, size) {
    this.content = content; // :: number
    // The size of the fragment, which is the total of the size of its
    // content nodes.

    this.size = size || 0;

    if (size == null) {
      for (var i = 0; i < content.length; i++) {
        this.size += content[i].nodeSize;
      }
    }
  };

  var prototypeAccessors = {
    firstChild: {
      configurable: true
    },
    lastChild: {
      configurable: true
    },
    childCount: {
      configurable: true
    }
  }; // :: (number, number, (node: Node, start: number, parent: Node, index: number) → ?bool, ?number)
  // Invoke a callback for all descendant nodes between the given two
  // positions (relative to start of this fragment). Doesn't descend
  // into a node when the callback returns `false`.

  Fragment.prototype.nodesBetween = function nodesBetween(from, to, f, nodeStart, parent) {
    if (nodeStart === void 0) nodeStart = 0;

    for (var i = 0, pos = 0; pos < to; i++) {
      var child = this.content[i],
          end = pos + child.nodeSize;

      if (end > from && f(child, nodeStart + pos, parent, i) !== false && child.content.size) {
        var start = pos + 1;
        child.nodesBetween(Math.max(0, from - start), Math.min(child.content.size, to - start), f, nodeStart + start);
      }

      pos = end;
    }
  }; // :: ((node: Node, pos: number, parent: Node) → ?bool)
  // Call the given callback for every descendant node. The callback
  // may return `false` to prevent traversal of a given node's children.


  Fragment.prototype.descendants = function descendants(f) {
    this.nodesBetween(0, this.size, f);
  }; // : (number, number, ?string, ?string) → string


  Fragment.prototype.textBetween = function textBetween(from, to, blockSeparator, leafText) {
    var text = "",
        separated = true;
    this.nodesBetween(from, to, function (node, pos) {
      if (node.isText) {
        text += node.text.slice(Math.max(from, pos) - pos, to - pos);
        separated = !blockSeparator;
      } else if (node.isLeaf && leafText) {
        text += leafText;
        separated = !blockSeparator;
      } else if (!separated && node.isBlock) {
        text += blockSeparator;
        separated = true;
      }
    }, 0);
    return text;
  }; // :: (Fragment) → Fragment
  // Create a new fragment containing the combined content of this
  // fragment and the other.


  Fragment.prototype.append = function append(other) {
    if (!other.size) {
      return this;
    }

    if (!this.size) {
      return other;
    }

    var last = this.lastChild,
        first = other.firstChild,
        content = this.content.slice(),
        i = 0;

    if (last.isText && last.sameMarkup(first)) {
      content[content.length - 1] = last.withText(last.text + first.text);
      i = 1;
    }

    for (; i < other.content.length; i++) {
      content.push(other.content[i]);
    }

    return new Fragment(content, this.size + other.size);
  }; // :: (number, ?number) → Fragment
  // Cut out the sub-fragment between the two given positions.


  Fragment.prototype.cut = function cut(from, to) {
    if (to == null) {
      to = this.size;
    }

    if (from == 0 && to == this.size) {
      return this;
    }

    var result = [],
        size = 0;

    if (to > from) {
      for (var i = 0, pos = 0; pos < to; i++) {
        var child = this.content[i],
            end = pos + child.nodeSize;

        if (end > from) {
          if (pos < from || end > to) {
            if (child.isText) {
              child = child.cut(Math.max(0, from - pos), Math.min(child.text.length, to - pos));
            } else {
              child = child.cut(Math.max(0, from - pos - 1), Math.min(child.content.size, to - pos - 1));
            }
          }

          result.push(child);
          size += child.nodeSize;
        }

        pos = end;
      }
    }

    return new Fragment(result, size);
  };

  Fragment.prototype.cutByIndex = function cutByIndex(from, to) {
    if (from == to) {
      return Fragment.empty;
    }

    if (from == 0 && to == this.content.length) {
      return this;
    }

    return new Fragment(this.content.slice(from, to));
  }; // :: (number, Node) → Fragment
  // Create a new fragment in which the node at the given index is
  // replaced by the given node.


  Fragment.prototype.replaceChild = function replaceChild(index, node) {
    var current = this.content[index];

    if (current == node) {
      return this;
    }

    var copy = this.content.slice();
    var size = this.size + node.nodeSize - current.nodeSize;
    copy[index] = node;
    return new Fragment(copy, size);
  }; // : (Node) → Fragment
  // Create a new fragment by prepending the given node to this
  // fragment.


  Fragment.prototype.addToStart = function addToStart(node) {
    return new Fragment([node].concat(this.content), this.size + node.nodeSize);
  }; // : (Node) → Fragment
  // Create a new fragment by appending the given node to this
  // fragment.


  Fragment.prototype.addToEnd = function addToEnd(node) {
    return new Fragment(this.content.concat(node), this.size + node.nodeSize);
  }; // :: (Fragment) → bool
  // Compare this fragment to another one.


  Fragment.prototype.eq = function eq(other) {
    if (this.content.length != other.content.length) {
      return false;
    }

    for (var i = 0; i < this.content.length; i++) {
      if (!this.content[i].eq(other.content[i])) {
        return false;
      }
    }

    return true;
  }; // :: ?Node
  // The first child of the fragment, or `null` if it is empty.


  prototypeAccessors.firstChild.get = function () {
    return this.content.length ? this.content[0] : null;
  }; // :: ?Node
  // The last child of the fragment, or `null` if it is empty.


  prototypeAccessors.lastChild.get = function () {
    return this.content.length ? this.content[this.content.length - 1] : null;
  }; // :: number
  // The number of child nodes in this fragment.


  prototypeAccessors.childCount.get = function () {
    return this.content.length;
  }; // :: (number) → Node
  // Get the child node at the given index. Raise an error when the
  // index is out of range.


  Fragment.prototype.child = function child(index) {
    var found = this.content[index];

    if (!found) {
      throw new RangeError("Index " + index + " out of range for " + this);
    }

    return found;
  }; // :: (number) → ?Node
  // Get the child node at the given index, if it exists.


  Fragment.prototype.maybeChild = function maybeChild(index) {
    return this.content[index];
  }; // :: ((node: Node, offset: number, index: number))
  // Call `f` for every child node, passing the node, its offset
  // into this parent node, and its index.


  Fragment.prototype.forEach = function forEach(f) {
    for (var i = 0, p = 0; i < this.content.length; i++) {
      var child = this.content[i];
      f(child, p, i);
      p += child.nodeSize;
    }
  }; // :: (Fragment) → ?number
  // Find the first position at which this fragment and another
  // fragment differ, or `null` if they are the same.


  Fragment.prototype.findDiffStart = function findDiffStart$1(other, pos) {
    if (pos === void 0) pos = 0;
    return findDiffStart(this, other, pos);
  }; // :: (Fragment) → ?{a: number, b: number}
  // Find the first position, searching from the end, at which this
  // fragment and the given fragment differ, or `null` if they are the
  // same. Since this position will not be the same in both nodes, an
  // object with two separate positions is returned.


  Fragment.prototype.findDiffEnd = function findDiffEnd$1(other, pos, otherPos) {
    if (pos === void 0) pos = this.size;
    if (otherPos === void 0) otherPos = other.size;
    return findDiffEnd(this, other, pos, otherPos);
  }; // : (number, ?number) → {index: number, offset: number}
  // Find the index and inner offset corresponding to a given relative
  // position in this fragment. The result object will be reused
  // (overwritten) the next time the function is called. (Not public.)


  Fragment.prototype.findIndex = function findIndex(pos, round) {
    if (round === void 0) round = -1;

    if (pos == 0) {
      return retIndex(0, pos);
    }

    if (pos == this.size) {
      return retIndex(this.content.length, pos);
    }

    if (pos > this.size || pos < 0) {
      throw new RangeError("Position " + pos + " outside of fragment (" + this + ")");
    }

    for (var i = 0, curPos = 0;; i++) {
      var cur = this.child(i),
          end = curPos + cur.nodeSize;

      if (end >= pos) {
        if (end == pos || round > 0) {
          return retIndex(i + 1, end);
        }

        return retIndex(i, curPos);
      }

      curPos = end;
    }
  }; // :: () → string
  // Return a debugging string that describes this fragment.


  Fragment.prototype.toString = function toString() {
    return "<" + this.toStringInner() + ">";
  };

  Fragment.prototype.toStringInner = function toStringInner() {
    return this.content.join(", ");
  }; // :: () → ?Object
  // Create a JSON-serializeable representation of this fragment.


  Fragment.prototype.toJSON = function toJSON() {
    return this.content.length ? this.content.map(function (n) {
      return n.toJSON();
    }) : null;
  }; // :: (Schema, ?Object) → Fragment
  // Deserialize a fragment from its JSON representation.


  Fragment.fromJSON = function fromJSON(schema, value) {
    if (!value) {
      return Fragment.empty;
    }

    if (!Array.isArray(value)) {
      throw new RangeError("Invalid input for Fragment.fromJSON");
    }

    return new Fragment(value.map(schema.nodeFromJSON));
  }; // :: ([Node]) → Fragment
  // Build a fragment from an array of nodes. Ensures that adjacent
  // text nodes with the same marks are joined together.


  Fragment.fromArray = function fromArray(array) {
    if (!array.length) {
      return Fragment.empty;
    }

    var joined,
        size = 0;

    for (var i = 0; i < array.length; i++) {
      var node = array[i];
      size += node.nodeSize;

      if (i && node.isText && array[i - 1].sameMarkup(node)) {
        if (!joined) {
          joined = array.slice(0, i);
        }

        joined[joined.length - 1] = node.withText(joined[joined.length - 1].text + node.text);
      } else if (joined) {
        joined.push(node);
      }
    }

    return new Fragment(joined || array, size);
  }; // :: (?union<Fragment, Node, [Node]>) → Fragment
  // Create a fragment from something that can be interpreted as a set
  // of nodes. For `null`, it returns the empty fragment. For a
  // fragment, the fragment itself. For a node or array of nodes, a
  // fragment containing those nodes.


  Fragment.from = function from(nodes) {
    if (!nodes) {
      return Fragment.empty;
    }

    if (nodes instanceof Fragment) {
      return nodes;
    }

    if (Array.isArray(nodes)) {
      return this.fromArray(nodes);
    }

    if (nodes.attrs) {
      return new Fragment([nodes], nodes.nodeSize);
    }

    throw new RangeError("Can not convert " + nodes + " to a Fragment" + (nodes.nodesBetween ? " (looks like multiple versions of prosemirror-model were loaded)" : ""));
  };

  Object.defineProperties(Fragment.prototype, prototypeAccessors);
  var found = {
    index: 0,
    offset: 0
  };

  function retIndex(index, offset) {
    found.index = index;
    found.offset = offset;
    return found;
  } // :: Fragment
  // An empty fragment. Intended to be reused whenever a node doesn't
  // contain anything (rather than allocating a new empty fragment for
  // each leaf node).


  Fragment.empty = new Fragment([], 0);

  function compareDeep(a, b) {
    if (a === b) {
      return true;
    }

    if (!(a && typeof a == "object") || !(b && typeof b == "object")) {
      return false;
    }

    var array = Array.isArray(a);

    if (Array.isArray(b) != array) {
      return false;
    }

    if (array) {
      if (a.length != b.length) {
        return false;
      }

      for (var i = 0; i < a.length; i++) {
        if (!compareDeep(a[i], b[i])) {
          return false;
        }
      }
    } else {
      for (var p in a) {
        if (!(p in b) || !compareDeep(a[p], b[p])) {
          return false;
        }
      }

      for (var p$1 in b) {
        if (!(p$1 in a)) {
          return false;
        }
      }
    }

    return true;
  } // ::- A mark is a piece of information that can be attached to a node,
  // such as it being emphasized, in code font, or a link. It has a type
  // and optionally a set of attributes that provide further information
  // (such as the target of the link). Marks are created through a
  // `Schema`, which controls which types exist and which
  // attributes they have.


  var Mark = function Mark(type, attrs) {
    // :: MarkType
    // The type of this mark.
    this.type = type; // :: Object
    // The attributes associated with this mark.

    this.attrs = attrs;
  }; // :: ([Mark]) → [Mark]
  // Given a set of marks, create a new set which contains this one as
  // well, in the right position. If this mark is already in the set,
  // the set itself is returned. If any marks that are set to be
  // [exclusive](#model.MarkSpec.excludes) with this mark are present,
  // those are replaced by this one.


  Mark.prototype.addToSet = function addToSet(set) {
    var copy,
        placed = false;

    for (var i = 0; i < set.length; i++) {
      var other = set[i];

      if (this.eq(other)) {
        return set;
      }

      if (this.type.excludes(other.type)) {
        if (!copy) {
          copy = set.slice(0, i);
        }
      } else if (other.type.excludes(this.type)) {
        return set;
      } else {
        if (!placed && other.type.rank > this.type.rank) {
          if (!copy) {
            copy = set.slice(0, i);
          }

          copy.push(this);
          placed = true;
        }

        if (copy) {
          copy.push(other);
        }
      }
    }

    if (!copy) {
      copy = set.slice();
    }

    if (!placed) {
      copy.push(this);
    }

    return copy;
  }; // :: ([Mark]) → [Mark]
  // Remove this mark from the given set, returning a new set. If this
  // mark is not in the set, the set itself is returned.


  Mark.prototype.removeFromSet = function removeFromSet(set) {
    for (var i = 0; i < set.length; i++) {
      if (this.eq(set[i])) {
        return set.slice(0, i).concat(set.slice(i + 1));
      }
    }

    return set;
  }; // :: ([Mark]) → bool
  // Test whether this mark is in the given set of marks.


  Mark.prototype.isInSet = function isInSet(set) {
    for (var i = 0; i < set.length; i++) {
      if (this.eq(set[i])) {
        return true;
      }
    }

    return false;
  }; // :: (Mark) → bool
  // Test whether this mark has the same type and attributes as
  // another mark.


  Mark.prototype.eq = function eq(other) {
    return this == other || this.type == other.type && compareDeep(this.attrs, other.attrs);
  }; // :: () → Object
  // Convert this mark to a JSON-serializeable representation.


  Mark.prototype.toJSON = function toJSON() {
    var obj = {
      type: this.type.name
    };

    for (var _ in this.attrs) {
      obj.attrs = this.attrs;
      break;
    }

    return obj;
  }; // :: (Schema, Object) → Mark


  Mark.fromJSON = function fromJSON(schema, json) {
    if (!json) {
      throw new RangeError("Invalid input for Mark.fromJSON");
    }

    var type = schema.marks[json.type];

    if (!type) {
      throw new RangeError("There is no mark type " + json.type + " in this schema");
    }

    return type.create(json.attrs);
  }; // :: ([Mark], [Mark]) → bool
  // Test whether two sets of marks are identical.


  Mark.sameSet = function sameSet(a, b) {
    if (a == b) {
      return true;
    }

    if (a.length != b.length) {
      return false;
    }

    for (var i = 0; i < a.length; i++) {
      if (!a[i].eq(b[i])) {
        return false;
      }
    }

    return true;
  }; // :: (?union<Mark, [Mark]>) → [Mark]
  // Create a properly sorted mark set from null, a single mark, or an
  // unsorted array of marks.


  Mark.setFrom = function setFrom(marks) {
    if (!marks || marks.length == 0) {
      return Mark.none;
    }

    if (marks instanceof Mark) {
      return [marks];
    }

    var copy = marks.slice();
    copy.sort(function (a, b) {
      return a.type.rank - b.type.rank;
    });
    return copy;
  }; // :: [Mark] The empty set of marks.


  Mark.none = []; // ReplaceError:: class extends Error
  // Error type raised by [`Node.replace`](#model.Node.replace) when
  // given an invalid replacement.

  function ReplaceError(message) {
    var err = Error.call(this, message);
    err.__proto__ = ReplaceError.prototype;
    return err;
  }

  ReplaceError.prototype = Object.create(Error.prototype);
  ReplaceError.prototype.constructor = ReplaceError;
  ReplaceError.prototype.name = "ReplaceError"; // ::- A slice represents a piece cut out of a larger document. It
  // stores not only a fragment, but also the depth up to which nodes on
  // both side are ‘open’ (cut through).

  var Slice = function Slice(content, openStart, openEnd) {
    // :: Fragment The slice's content.
    this.content = content; // :: number The open depth at the start.

    this.openStart = openStart; // :: number The open depth at the end.

    this.openEnd = openEnd;
  };

  var prototypeAccessors$1 = {
    size: {
      configurable: true
    }
  }; // :: number
  // The size this slice would add when inserted into a document.

  prototypeAccessors$1.size.get = function () {
    return this.content.size - this.openStart - this.openEnd;
  };

  Slice.prototype.insertAt = function insertAt(pos, fragment) {
    var content = insertInto(this.content, pos + this.openStart, fragment, null);
    return content && new Slice(content, this.openStart, this.openEnd);
  };

  Slice.prototype.removeBetween = function removeBetween(from, to) {
    return new Slice(removeRange(this.content, from + this.openStart, to + this.openStart), this.openStart, this.openEnd);
  }; // :: (Slice) → bool
  // Tests whether this slice is equal to another slice.


  Slice.prototype.eq = function eq(other) {
    return this.content.eq(other.content) && this.openStart == other.openStart && this.openEnd == other.openEnd;
  };

  Slice.prototype.toString = function toString() {
    return this.content + "(" + this.openStart + "," + this.openEnd + ")";
  }; // :: () → ?Object
  // Convert a slice to a JSON-serializable representation.


  Slice.prototype.toJSON = function toJSON() {
    if (!this.content.size) {
      return null;
    }

    var json = {
      content: this.content.toJSON()
    };

    if (this.openStart > 0) {
      json.openStart = this.openStart;
    }

    if (this.openEnd > 0) {
      json.openEnd = this.openEnd;
    }

    return json;
  }; // :: (Schema, ?Object) → Slice
  // Deserialize a slice from its JSON representation.


  Slice.fromJSON = function fromJSON(schema, json) {
    if (!json) {
      return Slice.empty;
    }

    var openStart = json.openStart || 0,
        openEnd = json.openEnd || 0;

    if (typeof openStart != "number" || typeof openEnd != "number") {
      throw new RangeError("Invalid input for Slice.fromJSON");
    }

    return new Slice(Fragment.fromJSON(schema, json.content), json.openStart || 0, json.openEnd || 0);
  }; // :: (Fragment, ?bool) → Slice
  // Create a slice from a fragment by taking the maximum possible
  // open value on both side of the fragment.


  Slice.maxOpen = function maxOpen(fragment, openIsolating) {
    if (openIsolating === void 0) openIsolating = true;
    var openStart = 0,
        openEnd = 0;

    for (var n = fragment.firstChild; n && !n.isLeaf && (openIsolating || !n.type.spec.isolating); n = n.firstChild) {
      openStart++;
    }

    for (var n$1 = fragment.lastChild; n$1 && !n$1.isLeaf && (openIsolating || !n$1.type.spec.isolating); n$1 = n$1.lastChild) {
      openEnd++;
    }

    return new Slice(fragment, openStart, openEnd);
  };

  Object.defineProperties(Slice.prototype, prototypeAccessors$1);

  function removeRange(content, from, to) {
    var ref = content.findIndex(from);
    var index = ref.index;
    var offset = ref.offset;
    var child = content.maybeChild(index);
    var ref$1 = content.findIndex(to);
    var indexTo = ref$1.index;
    var offsetTo = ref$1.offset;

    if (offset == from || child.isText) {
      if (offsetTo != to && !content.child(indexTo).isText) {
        throw new RangeError("Removing non-flat range");
      }

      return content.cut(0, from).append(content.cut(to));
    }

    if (index != indexTo) {
      throw new RangeError("Removing non-flat range");
    }

    return content.replaceChild(index, child.copy(removeRange(child.content, from - offset - 1, to - offset - 1)));
  }

  function insertInto(content, dist, insert, parent) {
    var ref = content.findIndex(dist);
    var index = ref.index;
    var offset = ref.offset;
    var child = content.maybeChild(index);

    if (offset == dist || child.isText) {
      if (parent && !parent.canReplace(index, index, insert)) {
        return null;
      }

      return content.cut(0, dist).append(insert).append(content.cut(dist));
    }

    var inner = insertInto(child.content, dist - offset - 1, insert);
    return inner && content.replaceChild(index, child.copy(inner));
  } // :: Slice
  // The empty slice.


  Slice.empty = new Slice(Fragment.empty, 0, 0);

  function replace($from, $to, slice) {
    if (slice.openStart > $from.depth) {
      throw new ReplaceError("Inserted content deeper than insertion position");
    }

    if ($from.depth - slice.openStart != $to.depth - slice.openEnd) {
      throw new ReplaceError("Inconsistent open depths");
    }

    return replaceOuter($from, $to, slice, 0);
  }

  function replaceOuter($from, $to, slice, depth) {
    var index = $from.index(depth),
        node = $from.node(depth);

    if (index == $to.index(depth) && depth < $from.depth - slice.openStart) {
      var inner = replaceOuter($from, $to, slice, depth + 1);
      return node.copy(node.content.replaceChild(index, inner));
    } else if (!slice.content.size) {
      return close(node, replaceTwoWay($from, $to, depth));
    } else if (!slice.openStart && !slice.openEnd && $from.depth == depth && $to.depth == depth) {
      // Simple, flat case
      var parent = $from.parent,
          content = parent.content;
      return close(parent, content.cut(0, $from.parentOffset).append(slice.content).append(content.cut($to.parentOffset)));
    } else {
      var ref = prepareSliceForReplace(slice, $from);
      var start = ref.start;
      var end = ref.end;
      return close(node, replaceThreeWay($from, start, end, $to, depth));
    }
  }

  function checkJoin(main, sub) {
    if (!sub.type.compatibleContent(main.type)) {
      throw new ReplaceError("Cannot join " + sub.type.name + " onto " + main.type.name);
    }
  }

  function joinable($before, $after, depth) {
    var node = $before.node(depth);
    checkJoin(node, $after.node(depth));
    return node;
  }

  function addNode(child, target) {
    var last = target.length - 1;

    if (last >= 0 && child.isText && child.sameMarkup(target[last])) {
      target[last] = child.withText(target[last].text + child.text);
    } else {
      target.push(child);
    }
  }

  function addRange($start, $end, depth, target) {
    var node = ($end || $start).node(depth);
    var startIndex = 0,
        endIndex = $end ? $end.index(depth) : node.childCount;

    if ($start) {
      startIndex = $start.index(depth);

      if ($start.depth > depth) {
        startIndex++;
      } else if ($start.textOffset) {
        addNode($start.nodeAfter, target);
        startIndex++;
      }
    }

    for (var i = startIndex; i < endIndex; i++) {
      addNode(node.child(i), target);
    }

    if ($end && $end.depth == depth && $end.textOffset) {
      addNode($end.nodeBefore, target);
    }
  }

  function close(node, content) {
    if (!node.type.validContent(content)) {
      throw new ReplaceError("Invalid content for node " + node.type.name);
    }

    return node.copy(content);
  }

  function replaceThreeWay($from, $start, $end, $to, depth) {
    var openStart = $from.depth > depth && joinable($from, $start, depth + 1);
    var openEnd = $to.depth > depth && joinable($end, $to, depth + 1);
    var content = [];
    addRange(null, $from, depth, content);

    if (openStart && openEnd && $start.index(depth) == $end.index(depth)) {
      checkJoin(openStart, openEnd);
      addNode(close(openStart, replaceThreeWay($from, $start, $end, $to, depth + 1)), content);
    } else {
      if (openStart) {
        addNode(close(openStart, replaceTwoWay($from, $start, depth + 1)), content);
      }

      addRange($start, $end, depth, content);

      if (openEnd) {
        addNode(close(openEnd, replaceTwoWay($end, $to, depth + 1)), content);
      }
    }

    addRange($to, null, depth, content);
    return new Fragment(content);
  }

  function replaceTwoWay($from, $to, depth) {
    var content = [];
    addRange(null, $from, depth, content);

    if ($from.depth > depth) {
      var type = joinable($from, $to, depth + 1);
      addNode(close(type, replaceTwoWay($from, $to, depth + 1)), content);
    }

    addRange($to, null, depth, content);
    return new Fragment(content);
  }

  function prepareSliceForReplace(slice, $along) {
    var extra = $along.depth - slice.openStart,
        parent = $along.node(extra);
    var node = parent.copy(slice.content);

    for (var i = extra - 1; i >= 0; i--) {
      node = $along.node(i).copy(Fragment.from(node));
    }

    return {
      start: node.resolveNoCache(slice.openStart + extra),
      end: node.resolveNoCache(node.content.size - slice.openEnd - extra)
    };
  } // ::- You can [_resolve_](#model.Node.resolve) a position to get more
  // information about it. Objects of this class represent such a
  // resolved position, providing various pieces of context information,
  // and some helper methods.
  //
  // Throughout this interface, methods that take an optional `depth`
  // parameter will interpret undefined as `this.depth` and negative
  // numbers as `this.depth + value`.


  var ResolvedPos = function ResolvedPos(pos, path, parentOffset) {
    // :: number The position that was resolved.
    this.pos = pos;
    this.path = path; // :: number
    // The number of levels the parent node is from the root. If this
    // position points directly into the root node, it is 0. If it
    // points into a top-level paragraph, 1, and so on.

    this.depth = path.length / 3 - 1; // :: number The offset this position has into its parent node.

    this.parentOffset = parentOffset;
  };

  var prototypeAccessors$2 = {
    parent: {
      configurable: true
    },
    doc: {
      configurable: true
    },
    textOffset: {
      configurable: true
    },
    nodeAfter: {
      configurable: true
    },
    nodeBefore: {
      configurable: true
    }
  };

  ResolvedPos.prototype.resolveDepth = function resolveDepth(val) {
    if (val == null) {
      return this.depth;
    }

    if (val < 0) {
      return this.depth + val;
    }

    return val;
  }; // :: Node
  // The parent node that the position points into. Note that even if
  // a position points into a text node, that node is not considered
  // the parent—text nodes are ‘flat’ in this model, and have no content.


  prototypeAccessors$2.parent.get = function () {
    return this.node(this.depth);
  }; // :: Node
  // The root node in which the position was resolved.


  prototypeAccessors$2.doc.get = function () {
    return this.node(0);
  }; // :: (?number) → Node
  // The ancestor node at the given level. `p.node(p.depth)` is the
  // same as `p.parent`.


  ResolvedPos.prototype.node = function node(depth) {
    return this.path[this.resolveDepth(depth) * 3];
  }; // :: (?number) → number
  // The index into the ancestor at the given level. If this points at
  // the 3rd node in the 2nd paragraph on the top level, for example,
  // `p.index(0)` is 1 and `p.index(1)` is 2.


  ResolvedPos.prototype.index = function index(depth) {
    return this.path[this.resolveDepth(depth) * 3 + 1];
  }; // :: (?number) → number
  // The index pointing after this position into the ancestor at the
  // given level.


  ResolvedPos.prototype.indexAfter = function indexAfter(depth) {
    depth = this.resolveDepth(depth);
    return this.index(depth) + (depth == this.depth && !this.textOffset ? 0 : 1);
  }; // :: (?number) → number
  // The (absolute) position at the start of the node at the given
  // level.


  ResolvedPos.prototype.start = function start(depth) {
    depth = this.resolveDepth(depth);
    return depth == 0 ? 0 : this.path[depth * 3 - 1] + 1;
  }; // :: (?number) → number
  // The (absolute) position at the end of the node at the given
  // level.


  ResolvedPos.prototype.end = function end(depth) {
    depth = this.resolveDepth(depth);
    return this.start(depth) + this.node(depth).content.size;
  }; // :: (?number) → number
  // The (absolute) position directly before the wrapping node at the
  // given level, or, when `depth` is `this.depth + 1`, the original
  // position.


  ResolvedPos.prototype.before = function before(depth) {
    depth = this.resolveDepth(depth);

    if (!depth) {
      throw new RangeError("There is no position before the top-level node");
    }

    return depth == this.depth + 1 ? this.pos : this.path[depth * 3 - 1];
  }; // :: (?number) → number
  // The (absolute) position directly after the wrapping node at the
  // given level, or the original position when `depth` is `this.depth + 1`.


  ResolvedPos.prototype.after = function after(depth) {
    depth = this.resolveDepth(depth);

    if (!depth) {
      throw new RangeError("There is no position after the top-level node");
    }

    return depth == this.depth + 1 ? this.pos : this.path[depth * 3 - 1] + this.path[depth * 3].nodeSize;
  }; // :: number
  // When this position points into a text node, this returns the
  // distance between the position and the start of the text node.
  // Will be zero for positions that point between nodes.


  prototypeAccessors$2.textOffset.get = function () {
    return this.pos - this.path[this.path.length - 1];
  }; // :: ?Node
  // Get the node directly after the position, if any. If the position
  // points into a text node, only the part of that node after the
  // position is returned.


  prototypeAccessors$2.nodeAfter.get = function () {
    var parent = this.parent,
        index = this.index(this.depth);

    if (index == parent.childCount) {
      return null;
    }

    var dOff = this.pos - this.path[this.path.length - 1],
        child = parent.child(index);
    return dOff ? parent.child(index).cut(dOff) : child;
  }; // :: ?Node
  // Get the node directly before the position, if any. If the
  // position points into a text node, only the part of that node
  // before the position is returned.


  prototypeAccessors$2.nodeBefore.get = function () {
    var index = this.index(this.depth);
    var dOff = this.pos - this.path[this.path.length - 1];

    if (dOff) {
      return this.parent.child(index).cut(0, dOff);
    }

    return index == 0 ? null : this.parent.child(index - 1);
  }; // :: () → [Mark]
  // Get the marks at this position, factoring in the surrounding
  // marks' [`inclusive`](#model.MarkSpec.inclusive) property. If the
  // position is at the start of a non-empty node, the marks of the
  // node after it (if any) are returned.


  ResolvedPos.prototype.marks = function marks() {
    var parent = this.parent,
        index = this.index(); // In an empty parent, return the empty array

    if (parent.content.size == 0) {
      return Mark.none;
    } // When inside a text node, just return the text node's marks


    if (this.textOffset) {
      return parent.child(index).marks;
    }

    var main = parent.maybeChild(index - 1),
        other = parent.maybeChild(index); // If the `after` flag is true of there is no node before, make
    // the node after this position the main reference.

    if (!main) {
      var tmp = main;
      main = other;
      other = tmp;
    } // Use all marks in the main node, except those that have
    // `inclusive` set to false and are not present in the other node.


    var marks = main.marks;

    for (var i = 0; i < marks.length; i++) {
      if (marks[i].type.spec.inclusive === false && (!other || !marks[i].isInSet(other.marks))) {
        marks = marks[i--].removeFromSet(marks);
      }
    }

    return marks;
  }; // :: (ResolvedPos) → ?[Mark]
  // Get the marks after the current position, if any, except those
  // that are non-inclusive and not present at position `$end`. This
  // is mostly useful for getting the set of marks to preserve after a
  // deletion. Will return `null` if this position is at the end of
  // its parent node or its parent node isn't a textblock (in which
  // case no marks should be preserved).


  ResolvedPos.prototype.marksAcross = function marksAcross($end) {
    var after = this.parent.maybeChild(this.index());

    if (!after || !after.isInline) {
      return null;
    }

    var marks = after.marks,
        next = $end.parent.maybeChild($end.index());

    for (var i = 0; i < marks.length; i++) {
      if (marks[i].type.spec.inclusive === false && (!next || !marks[i].isInSet(next.marks))) {
        marks = marks[i--].removeFromSet(marks);
      }
    }

    return marks;
  }; // :: (number) → number
  // The depth up to which this position and the given (non-resolved)
  // position share the same parent nodes.


  ResolvedPos.prototype.sharedDepth = function sharedDepth(pos) {
    for (var depth = this.depth; depth > 0; depth--) {
      if (this.start(depth) <= pos && this.end(depth) >= pos) {
        return depth;
      }
    }

    return 0;
  }; // :: (?ResolvedPos, ?(Node) → bool) → ?NodeRange
  // Returns a range based on the place where this position and the
  // given position diverge around block content. If both point into
  // the same textblock, for example, a range around that textblock
  // will be returned. If they point into different blocks, the range
  // around those blocks in their shared ancestor is returned. You can
  // pass in an optional predicate that will be called with a parent
  // node to see if a range into that parent is acceptable.


  ResolvedPos.prototype.blockRange = function blockRange(other, pred) {
    if (other === void 0) other = this;

    if (other.pos < this.pos) {
      return other.blockRange(this);
    }

    for (var d = this.depth - (this.parent.inlineContent || this.pos == other.pos ? 1 : 0); d >= 0; d--) {
      if (other.pos <= this.end(d) && (!pred || pred(this.node(d)))) {
        return new NodeRange(this, other, d);
      }
    }
  }; // :: (ResolvedPos) → bool
  // Query whether the given position shares the same parent node.


  ResolvedPos.prototype.sameParent = function sameParent(other) {
    return this.pos - this.parentOffset == other.pos - other.parentOffset;
  }; // :: (ResolvedPos) → ResolvedPos
  // Return the greater of this and the given position.


  ResolvedPos.prototype.max = function max(other) {
    return other.pos > this.pos ? other : this;
  }; // :: (ResolvedPos) → ResolvedPos
  // Return the smaller of this and the given position.


  ResolvedPos.prototype.min = function min(other) {
    return other.pos < this.pos ? other : this;
  };

  ResolvedPos.prototype.toString = function toString() {
    var str = "";

    for (var i = 1; i <= this.depth; i++) {
      str += (str ? "/" : "") + this.node(i).type.name + "_" + this.index(i - 1);
    }

    return str + ":" + this.parentOffset;
  };

  ResolvedPos.resolve = function resolve(doc, pos) {
    if (!(pos >= 0 && pos <= doc.content.size)) {
      throw new RangeError("Position " + pos + " out of range");
    }

    var path = [];
    var start = 0,
        parentOffset = pos;

    for (var node = doc;;) {
      var ref = node.content.findIndex(parentOffset);
      var index = ref.index;
      var offset = ref.offset;
      var rem = parentOffset - offset;
      path.push(node, index, start + offset);

      if (!rem) {
        break;
      }

      node = node.child(index);

      if (node.isText) {
        break;
      }

      parentOffset = rem - 1;
      start += offset + 1;
    }

    return new ResolvedPos(pos, path, parentOffset);
  };

  ResolvedPos.resolveCached = function resolveCached(doc, pos) {
    for (var i = 0; i < resolveCache.length; i++) {
      var cached = resolveCache[i];

      if (cached.pos == pos && cached.doc == doc) {
        return cached;
      }
    }

    var result = resolveCache[resolveCachePos] = ResolvedPos.resolve(doc, pos);
    resolveCachePos = (resolveCachePos + 1) % resolveCacheSize;
    return result;
  };

  Object.defineProperties(ResolvedPos.prototype, prototypeAccessors$2);
  var resolveCache = [],
      resolveCachePos = 0,
      resolveCacheSize = 12; // ::- Represents a flat range of content, i.e. one that starts and
  // ends in the same node.

  var NodeRange = function NodeRange($from, $to, depth) {
    // :: ResolvedPos A resolved position along the start of the
    // content. May have a `depth` greater than this object's `depth`
    // property, since these are the positions that were used to
    // compute the range, not re-resolved positions directly at its
    // boundaries.
    this.$from = $from; // :: ResolvedPos A position along the end of the content. See
    // caveat for [`$from`](#model.NodeRange.$from).

    this.$to = $to; // :: number The depth of the node that this range points into.

    this.depth = depth;
  };

  var prototypeAccessors$1$1 = {
    start: {
      configurable: true
    },
    end: {
      configurable: true
    },
    parent: {
      configurable: true
    },
    startIndex: {
      configurable: true
    },
    endIndex: {
      configurable: true
    }
  }; // :: number The position at the start of the range.

  prototypeAccessors$1$1.start.get = function () {
    return this.$from.before(this.depth + 1);
  }; // :: number The position at the end of the range.


  prototypeAccessors$1$1.end.get = function () {
    return this.$to.after(this.depth + 1);
  }; // :: Node The parent node that the range points into.


  prototypeAccessors$1$1.parent.get = function () {
    return this.$from.node(this.depth);
  }; // :: number The start index of the range in the parent node.


  prototypeAccessors$1$1.startIndex.get = function () {
    return this.$from.index(this.depth);
  }; // :: number The end index of the range in the parent node.


  prototypeAccessors$1$1.endIndex.get = function () {
    return this.$to.indexAfter(this.depth);
  };

  Object.defineProperties(NodeRange.prototype, prototypeAccessors$1$1);
  var emptyAttrs = Object.create(null); // ::- This class represents a node in the tree that makes up a
  // ProseMirror document. So a document is an instance of `Node`, with
  // children that are also instances of `Node`.
  //
  // Nodes are persistent data structures. Instead of changing them, you
  // create new ones with the content you want. Old ones keep pointing
  // at the old document shape. This is made cheaper by sharing
  // structure between the old and new data as much as possible, which a
  // tree shape like this (without back pointers) makes easy.
  //
  // **Do not** directly mutate the properties of a `Node` object. See
  // [the guide](/docs/guide/#doc) for more information.

  var Node$1 = function Node(type, attrs, content, marks) {
    // :: NodeType
    // The type of node that this is.
    this.type = type; // :: Object
    // An object mapping attribute names to values. The kind of
    // attributes allowed and required are
    // [determined](#model.NodeSpec.attrs) by the node type.

    this.attrs = attrs; // :: Fragment
    // A container holding the node's children.

    this.content = content || Fragment.empty; // :: [Mark]
    // The marks (things like whether it is emphasized or part of a
    // link) applied to this node.

    this.marks = marks || Mark.none;
  };

  var prototypeAccessors$3 = {
    nodeSize: {
      configurable: true
    },
    childCount: {
      configurable: true
    },
    textContent: {
      configurable: true
    },
    firstChild: {
      configurable: true
    },
    lastChild: {
      configurable: true
    },
    isBlock: {
      configurable: true
    },
    isTextblock: {
      configurable: true
    },
    inlineContent: {
      configurable: true
    },
    isInline: {
      configurable: true
    },
    isText: {
      configurable: true
    },
    isLeaf: {
      configurable: true
    },
    isAtom: {
      configurable: true
    }
  }; // text:: ?string
  // For text nodes, this contains the node's text content.
  // :: number
  // The size of this node, as defined by the integer-based [indexing
  // scheme](/docs/guide/#doc.indexing). For text nodes, this is the
  // amount of characters. For other leaf nodes, it is one. For
  // non-leaf nodes, it is the size of the content plus two (the start
  // and end token).

  prototypeAccessors$3.nodeSize.get = function () {
    return this.isLeaf ? 1 : 2 + this.content.size;
  }; // :: number
  // The number of children that the node has.


  prototypeAccessors$3.childCount.get = function () {
    return this.content.childCount;
  }; // :: (number) → Node
  // Get the child node at the given index. Raises an error when the
  // index is out of range.


  Node$1.prototype.child = function child(index) {
    return this.content.child(index);
  }; // :: (number) → ?Node
  // Get the child node at the given index, if it exists.


  Node$1.prototype.maybeChild = function maybeChild(index) {
    return this.content.maybeChild(index);
  }; // :: ((node: Node, offset: number, index: number))
  // Call `f` for every child node, passing the node, its offset
  // into this parent node, and its index.


  Node$1.prototype.forEach = function forEach(f) {
    this.content.forEach(f);
  }; // :: (number, number, (node: Node, pos: number, parent: Node, index: number) → ?bool, ?number)
  // Invoke a callback for all descendant nodes recursively between
  // the given two positions that are relative to start of this node's
  // content. The callback is invoked with the node, its
  // parent-relative position, its parent node, and its child index.
  // When the callback returns false for a given node, that node's
  // children will not be recursed over. The last parameter can be
  // used to specify a starting position to count from.


  Node$1.prototype.nodesBetween = function nodesBetween(from, to, f, startPos) {
    if (startPos === void 0) startPos = 0;
    this.content.nodesBetween(from, to, f, startPos, this);
  }; // :: ((node: Node, pos: number, parent: Node) → ?bool)
  // Call the given callback for every descendant node. Doesn't
  // descend into a node when the callback returns `false`.


  Node$1.prototype.descendants = function descendants(f) {
    this.nodesBetween(0, this.content.size, f);
  }; // :: string
  // Concatenates all the text nodes found in this fragment and its
  // children.


  prototypeAccessors$3.textContent.get = function () {
    return this.textBetween(0, this.content.size, "");
  }; // :: (number, number, ?string, ?string) → string
  // Get all text between positions `from` and `to`. When
  // `blockSeparator` is given, it will be inserted whenever a new
  // block node is started. When `leafText` is given, it'll be
  // inserted for every non-text leaf node encountered.


  Node$1.prototype.textBetween = function textBetween(from, to, blockSeparator, leafText) {
    return this.content.textBetween(from, to, blockSeparator, leafText);
  }; // :: ?Node
  // Returns this node's first child, or `null` if there are no
  // children.


  prototypeAccessors$3.firstChild.get = function () {
    return this.content.firstChild;
  }; // :: ?Node
  // Returns this node's last child, or `null` if there are no
  // children.


  prototypeAccessors$3.lastChild.get = function () {
    return this.content.lastChild;
  }; // :: (Node) → bool
  // Test whether two nodes represent the same piece of document.


  Node$1.prototype.eq = function eq(other) {
    return this == other || this.sameMarkup(other) && this.content.eq(other.content);
  }; // :: (Node) → bool
  // Compare the markup (type, attributes, and marks) of this node to
  // those of another. Returns `true` if both have the same markup.


  Node$1.prototype.sameMarkup = function sameMarkup(other) {
    return this.hasMarkup(other.type, other.attrs, other.marks);
  }; // :: (NodeType, ?Object, ?[Mark]) → bool
  // Check whether this node's markup correspond to the given type,
  // attributes, and marks.


  Node$1.prototype.hasMarkup = function hasMarkup(type, attrs, marks) {
    return this.type == type && compareDeep(this.attrs, attrs || type.defaultAttrs || emptyAttrs) && Mark.sameSet(this.marks, marks || Mark.none);
  }; // :: (?Fragment) → Node
  // Create a new node with the same markup as this node, containing
  // the given content (or empty, if no content is given).


  Node$1.prototype.copy = function copy(content) {
    if (content === void 0) content = null;

    if (content == this.content) {
      return this;
    }

    return new this.constructor(this.type, this.attrs, content, this.marks);
  }; // :: ([Mark]) → Node
  // Create a copy of this node, with the given set of marks instead
  // of the node's own marks.


  Node$1.prototype.mark = function mark(marks) {
    return marks == this.marks ? this : new this.constructor(this.type, this.attrs, this.content, marks);
  }; // :: (number, ?number) → Node
  // Create a copy of this node with only the content between the
  // given positions. If `to` is not given, it defaults to the end of
  // the node.


  Node$1.prototype.cut = function cut(from, to) {
    if (from == 0 && to == this.content.size) {
      return this;
    }

    return this.copy(this.content.cut(from, to));
  }; // :: (number, ?number) → Slice
  // Cut out the part of the document between the given positions, and
  // return it as a `Slice` object.


  Node$1.prototype.slice = function slice(from, to, includeParents) {
    if (to === void 0) to = this.content.size;
    if (includeParents === void 0) includeParents = false;

    if (from == to) {
      return Slice.empty;
    }

    var $from = this.resolve(from),
        $to = this.resolve(to);
    var depth = includeParents ? 0 : $from.sharedDepth(to);
    var start = $from.start(depth),
        node = $from.node(depth);
    var content = node.content.cut($from.pos - start, $to.pos - start);
    return new Slice(content, $from.depth - depth, $to.depth - depth);
  }; // :: (number, number, Slice) → Node
  // Replace the part of the document between the given positions with
  // the given slice. The slice must 'fit', meaning its open sides
  // must be able to connect to the surrounding content, and its
  // content nodes must be valid children for the node they are placed
  // into. If any of this is violated, an error of type
  // [`ReplaceError`](#model.ReplaceError) is thrown.


  Node$1.prototype.replace = function replace$1(from, to, slice) {
    return replace(this.resolve(from), this.resolve(to), slice);
  }; // :: (number) → ?Node
  // Find the node directly after the given position.


  Node$1.prototype.nodeAt = function nodeAt(pos) {
    for (var node = this;;) {
      var ref = node.content.findIndex(pos);
      var index = ref.index;
      var offset = ref.offset;
      node = node.maybeChild(index);

      if (!node) {
        return null;
      }

      if (offset == pos || node.isText) {
        return node;
      }

      pos -= offset + 1;
    }
  }; // :: (number) → {node: ?Node, index: number, offset: number}
  // Find the (direct) child node after the given offset, if any,
  // and return it along with its index and offset relative to this
  // node.


  Node$1.prototype.childAfter = function childAfter(pos) {
    var ref = this.content.findIndex(pos);
    var index = ref.index;
    var offset = ref.offset;
    return {
      node: this.content.maybeChild(index),
      index: index,
      offset: offset
    };
  }; // :: (number) → {node: ?Node, index: number, offset: number}
  // Find the (direct) child node before the given offset, if any,
  // and return it along with its index and offset relative to this
  // node.


  Node$1.prototype.childBefore = function childBefore(pos) {
    if (pos == 0) {
      return {
        node: null,
        index: 0,
        offset: 0
      };
    }

    var ref = this.content.findIndex(pos);
    var index = ref.index;
    var offset = ref.offset;

    if (offset < pos) {
      return {
        node: this.content.child(index),
        index: index,
        offset: offset
      };
    }

    var node = this.content.child(index - 1);
    return {
      node: node,
      index: index - 1,
      offset: offset - node.nodeSize
    };
  }; // :: (number) → ResolvedPos
  // Resolve the given position in the document, returning an
  // [object](#model.ResolvedPos) with information about its context.


  Node$1.prototype.resolve = function resolve(pos) {
    return ResolvedPos.resolveCached(this, pos);
  };

  Node$1.prototype.resolveNoCache = function resolveNoCache(pos) {
    return ResolvedPos.resolve(this, pos);
  }; // :: (number, number, MarkType) → bool
  // Test whether a mark of the given type occurs in this document
  // between the two given positions.


  Node$1.prototype.rangeHasMark = function rangeHasMark(from, to, type) {
    var found = false;

    if (to > from) {
      this.nodesBetween(from, to, function (node) {
        if (type.isInSet(node.marks)) {
          found = true;
        }

        return !found;
      });
    }

    return found;
  }; // :: bool
  // True when this is a block (non-inline node)


  prototypeAccessors$3.isBlock.get = function () {
    return this.type.isBlock;
  }; // :: bool
  // True when this is a textblock node, a block node with inline
  // content.


  prototypeAccessors$3.isTextblock.get = function () {
    return this.type.isTextblock;
  }; // :: bool
  // True when this node allows inline content.


  prototypeAccessors$3.inlineContent.get = function () {
    return this.type.inlineContent;
  }; // :: bool
  // True when this is an inline node (a text node or a node that can
  // appear among text).


  prototypeAccessors$3.isInline.get = function () {
    return this.type.isInline;
  }; // :: bool
  // True when this is a text node.


  prototypeAccessors$3.isText.get = function () {
    return this.type.isText;
  }; // :: bool
  // True when this is a leaf node.


  prototypeAccessors$3.isLeaf.get = function () {
    return this.type.isLeaf;
  }; // :: bool
  // True when this is an atom, i.e. when it does not have directly
  // editable content. This is usually the same as `isLeaf`, but can
  // be configured with the [`atom` property](#model.NodeSpec.atom) on
  // a node's spec (typically used when the node is displayed as an
  // uneditable [node view](#view.NodeView)).


  prototypeAccessors$3.isAtom.get = function () {
    return this.type.isAtom;
  }; // :: () → string
  // Return a string representation of this node for debugging
  // purposes.


  Node$1.prototype.toString = function toString() {
    if (this.type.spec.toDebugString) {
      return this.type.spec.toDebugString(this);
    }

    var name = this.type.name;

    if (this.content.size) {
      name += "(" + this.content.toStringInner() + ")";
    }

    return wrapMarks(this.marks, name);
  }; // :: (number) → ContentMatch
  // Get the content match in this node at the given index.


  Node$1.prototype.contentMatchAt = function contentMatchAt(index) {
    var match = this.type.contentMatch.matchFragment(this.content, 0, index);

    if (!match) {
      throw new Error("Called contentMatchAt on a node with invalid content");
    }

    return match;
  }; // :: (number, number, ?Fragment, ?number, ?number) → bool
  // Test whether replacing the range between `from` and `to` (by
  // child index) with the given replacement fragment (which defaults
  // to the empty fragment) would leave the node's content valid. You
  // can optionally pass `start` and `end` indices into the
  // replacement fragment.


  Node$1.prototype.canReplace = function canReplace(from, to, replacement, start, end) {
    if (replacement === void 0) replacement = Fragment.empty;
    if (start === void 0) start = 0;
    if (end === void 0) end = replacement.childCount;
    var one = this.contentMatchAt(from).matchFragment(replacement, start, end);
    var two = one && one.matchFragment(this.content, to);

    if (!two || !two.validEnd) {
      return false;
    }

    for (var i = start; i < end; i++) {
      if (!this.type.allowsMarks(replacement.child(i).marks)) {
        return false;
      }
    }

    return true;
  }; // :: (number, number, NodeType, ?[Mark]) → bool
  // Test whether replacing the range `from` to `to` (by index) with a
  // node of the given type would leave the node's content valid.


  Node$1.prototype.canReplaceWith = function canReplaceWith(from, to, type, marks) {
    if (marks && !this.type.allowsMarks(marks)) {
      return false;
    }

    var start = this.contentMatchAt(from).matchType(type);
    var end = start && start.matchFragment(this.content, to);
    return end ? end.validEnd : false;
  }; // :: (Node) → bool
  // Test whether the given node's content could be appended to this
  // node. If that node is empty, this will only return true if there
  // is at least one node type that can appear in both nodes (to avoid
  // merging completely incompatible nodes).


  Node$1.prototype.canAppend = function canAppend(other) {
    if (other.content.size) {
      return this.canReplace(this.childCount, this.childCount, other.content);
    } else {
      return this.type.compatibleContent(other.type);
    }
  }; // Unused. Left for backwards compatibility.


  Node$1.prototype.defaultContentType = function defaultContentType(at) {
    return this.contentMatchAt(at).defaultType;
  }; // :: ()
  // Check whether this node and its descendants conform to the
  // schema, and raise error when they do not.


  Node$1.prototype.check = function check() {
    if (!this.type.validContent(this.content)) {
      throw new RangeError("Invalid content for node " + this.type.name + ": " + this.content.toString().slice(0, 50));
    }

    this.content.forEach(function (node) {
      return node.check();
    });
  }; // :: () → Object
  // Return a JSON-serializeable representation of this node.


  Node$1.prototype.toJSON = function toJSON() {
    var obj = {
      type: this.type.name
    };

    for (var _ in this.attrs) {
      obj.attrs = this.attrs;
      break;
    }

    if (this.content.size) {
      obj.content = this.content.toJSON();
    }

    if (this.marks.length) {
      obj.marks = this.marks.map(function (n) {
        return n.toJSON();
      });
    }

    return obj;
  }; // :: (Schema, Object) → Node
  // Deserialize a node from its JSON representation.


  Node$1.fromJSON = function fromJSON(schema, json) {
    if (!json) {
      throw new RangeError("Invalid input for Node.fromJSON");
    }

    var marks = null;

    if (json.marks) {
      if (!Array.isArray(json.marks)) {
        throw new RangeError("Invalid mark data for Node.fromJSON");
      }

      marks = json.marks.map(schema.markFromJSON);
    }

    if (json.type == "text") {
      if (typeof json.text != "string") {
        throw new RangeError("Invalid text node in JSON");
      }

      return schema.text(json.text, marks);
    }

    var content = Fragment.fromJSON(schema, json.content);
    return schema.nodeType(json.type).create(json.attrs, content, marks);
  };

  Object.defineProperties(Node$1.prototype, prototypeAccessors$3);

  var TextNode =
  /*@__PURE__*/
  function (Node) {
    function TextNode(type, attrs, content, marks) {
      Node.call(this, type, attrs, null, marks);

      if (!content) {
        throw new RangeError("Empty text nodes are not allowed");
      }

      this.text = content;
    }

    if (Node) TextNode.__proto__ = Node;
    TextNode.prototype = Object.create(Node && Node.prototype);
    TextNode.prototype.constructor = TextNode;
    var prototypeAccessors$1 = {
      textContent: {
        configurable: true
      },
      nodeSize: {
        configurable: true
      }
    };

    TextNode.prototype.toString = function toString() {
      if (this.type.spec.toDebugString) {
        return this.type.spec.toDebugString(this);
      }

      return wrapMarks(this.marks, JSON.stringify(this.text));
    };

    prototypeAccessors$1.textContent.get = function () {
      return this.text;
    };

    TextNode.prototype.textBetween = function textBetween(from, to) {
      return this.text.slice(from, to);
    };

    prototypeAccessors$1.nodeSize.get = function () {
      return this.text.length;
    };

    TextNode.prototype.mark = function mark(marks) {
      return marks == this.marks ? this : new TextNode(this.type, this.attrs, this.text, marks);
    };

    TextNode.prototype.withText = function withText(text) {
      if (text == this.text) {
        return this;
      }

      return new TextNode(this.type, this.attrs, text, this.marks);
    };

    TextNode.prototype.cut = function cut(from, to) {
      if (from === void 0) from = 0;
      if (to === void 0) to = this.text.length;

      if (from == 0 && to == this.text.length) {
        return this;
      }

      return this.withText(this.text.slice(from, to));
    };

    TextNode.prototype.eq = function eq(other) {
      return this.sameMarkup(other) && this.text == other.text;
    };

    TextNode.prototype.toJSON = function toJSON() {
      var base = Node.prototype.toJSON.call(this);
      base.text = this.text;
      return base;
    };

    Object.defineProperties(TextNode.prototype, prototypeAccessors$1);
    return TextNode;
  }(Node$1);

  function wrapMarks(marks, str) {
    for (var i = marks.length - 1; i >= 0; i--) {
      str = marks[i].type.name + "(" + str + ")";
    }

    return str;
  } // ::- Instances of this class represent a match state of a node
  // type's [content expression](#model.NodeSpec.content), and can be
  // used to find out whether further content matches here, and whether
  // a given position is a valid end of the node.


  var ContentMatch = function ContentMatch(validEnd) {
    // :: bool
    // True when this match state represents a valid end of the node.
    this.validEnd = validEnd;
    this.next = [];
    this.wrapCache = [];
  };

  var prototypeAccessors$4 = {
    inlineContent: {
      configurable: true
    },
    defaultType: {
      configurable: true
    },
    edgeCount: {
      configurable: true
    }
  };

  ContentMatch.parse = function parse(string, nodeTypes) {
    var stream = new TokenStream(string, nodeTypes);

    if (stream.next == null) {
      return ContentMatch.empty;
    }

    var expr = parseExpr(stream);

    if (stream.next) {
      stream.err("Unexpected trailing text");
    }

    var match = dfa(nfa(expr));
    checkForDeadEnds(match, stream);
    return match;
  }; // :: (NodeType) → ?ContentMatch
  // Match a node type, returning a match after that node if
  // successful.


  ContentMatch.prototype.matchType = function matchType(type) {
    for (var i = 0; i < this.next.length; i += 2) {
      if (this.next[i] == type) {
        return this.next[i + 1];
      }
    }

    return null;
  }; // :: (Fragment, ?number, ?number) → ?ContentMatch
  // Try to match a fragment. Returns the resulting match when
  // successful.


  ContentMatch.prototype.matchFragment = function matchFragment(frag, start, end) {
    if (start === void 0) start = 0;
    if (end === void 0) end = frag.childCount;
    var cur = this;

    for (var i = start; cur && i < end; i++) {
      cur = cur.matchType(frag.child(i).type);
    }

    return cur;
  };

  prototypeAccessors$4.inlineContent.get = function () {
    var first = this.next[0];
    return first ? first.isInline : false;
  }; // :: ?NodeType
  // Get the first matching node type at this match position that can
  // be generated.


  prototypeAccessors$4.defaultType.get = function () {
    for (var i = 0; i < this.next.length; i += 2) {
      var type = this.next[i];

      if (!(type.isText || type.hasRequiredAttrs())) {
        return type;
      }
    }
  };

  ContentMatch.prototype.compatible = function compatible(other) {
    for (var i = 0; i < this.next.length; i += 2) {
      for (var j = 0; j < other.next.length; j += 2) {
        if (this.next[i] == other.next[j]) {
          return true;
        }
      }
    }

    return false;
  }; // :: (Fragment, bool, ?number) → ?Fragment
  // Try to match the given fragment, and if that fails, see if it can
  // be made to match by inserting nodes in front of it. When
  // successful, return a fragment of inserted nodes (which may be
  // empty if nothing had to be inserted). When `toEnd` is true, only
  // return a fragment if the resulting match goes to the end of the
  // content expression.


  ContentMatch.prototype.fillBefore = function fillBefore(after, toEnd, startIndex) {
    if (toEnd === void 0) toEnd = false;
    if (startIndex === void 0) startIndex = 0;
    var seen = [this];

    function search(match, types) {
      var finished = match.matchFragment(after, startIndex);

      if (finished && (!toEnd || finished.validEnd)) {
        return Fragment.from(types.map(function (tp) {
          return tp.createAndFill();
        }));
      }

      for (var i = 0; i < match.next.length; i += 2) {
        var type = match.next[i],
            next = match.next[i + 1];

        if (!(type.isText || type.hasRequiredAttrs()) && seen.indexOf(next) == -1) {
          seen.push(next);
          var found = search(next, types.concat(type));

          if (found) {
            return found;
          }
        }
      }
    }

    return search(this, []);
  }; // :: (NodeType) → ?[NodeType]
  // Find a set of wrapping node types that would allow a node of the
  // given type to appear at this position. The result may be empty
  // (when it fits directly) and will be null when no such wrapping
  // exists.


  ContentMatch.prototype.findWrapping = function findWrapping(target) {
    for (var i = 0; i < this.wrapCache.length; i += 2) {
      if (this.wrapCache[i] == target) {
        return this.wrapCache[i + 1];
      }
    }

    var computed = this.computeWrapping(target);
    this.wrapCache.push(target, computed);
    return computed;
  };

  ContentMatch.prototype.computeWrapping = function computeWrapping(target) {
    var seen = Object.create(null),
        active = [{
      match: this,
      type: null,
      via: null
    }];

    while (active.length) {
      var current = active.shift(),
          match = current.match;

      if (match.matchType(target)) {
        var result = [];

        for (var obj = current; obj.type; obj = obj.via) {
          result.push(obj.type);
        }

        return result.reverse();
      }

      for (var i = 0; i < match.next.length; i += 2) {
        var type = match.next[i];

        if (!type.isLeaf && !type.hasRequiredAttrs() && !(type.name in seen) && (!current.type || match.next[i + 1].validEnd)) {
          active.push({
            match: type.contentMatch,
            type: type,
            via: current
          });
          seen[type.name] = true;
        }
      }
    }
  }; // :: number
  // The number of outgoing edges this node has in the finite
  // automaton that describes the content expression.


  prototypeAccessors$4.edgeCount.get = function () {
    return this.next.length >> 1;
  }; // :: (number) → {type: NodeType, next: ContentMatch}
  // Get the _n_​th outgoing edge from this node in the finite
  // automaton that describes the content expression.


  ContentMatch.prototype.edge = function edge(n) {
    var i = n << 1;

    if (i >= this.next.length) {
      throw new RangeError("There's no " + n + "th edge in this content match");
    }

    return {
      type: this.next[i],
      next: this.next[i + 1]
    };
  };

  ContentMatch.prototype.toString = function toString() {
    var seen = [];

    function scan(m) {
      seen.push(m);

      for (var i = 1; i < m.next.length; i += 2) {
        if (seen.indexOf(m.next[i]) == -1) {
          scan(m.next[i]);
        }
      }
    }

    scan(this);
    return seen.map(function (m, i) {
      var out = i + (m.validEnd ? "*" : " ") + " ";

      for (var i$1 = 0; i$1 < m.next.length; i$1 += 2) {
        out += (i$1 ? ", " : "") + m.next[i$1].name + "->" + seen.indexOf(m.next[i$1 + 1]);
      }

      return out;
    }).join("\n");
  };

  Object.defineProperties(ContentMatch.prototype, prototypeAccessors$4);
  ContentMatch.empty = new ContentMatch(true);

  var TokenStream = function TokenStream(string, nodeTypes) {
    this.string = string;
    this.nodeTypes = nodeTypes;
    this.inline = null;
    this.pos = 0;
    this.tokens = string.split(/\s*(?=\b|\W|$)/);

    if (this.tokens[this.tokens.length - 1] == "") {
      this.tokens.pop();
    }

    if (this.tokens[0] == "") {
      this.tokens.unshift();
    }
  };

  var prototypeAccessors$1$2 = {
    next: {
      configurable: true
    }
  };

  prototypeAccessors$1$2.next.get = function () {
    return this.tokens[this.pos];
  };

  TokenStream.prototype.eat = function eat(tok) {
    return this.next == tok && (this.pos++ || true);
  };

  TokenStream.prototype.err = function err(str) {
    throw new SyntaxError(str + " (in content expression '" + this.string + "')");
  };

  Object.defineProperties(TokenStream.prototype, prototypeAccessors$1$2);

  function parseExpr(stream) {
    var exprs = [];

    do {
      exprs.push(parseExprSeq(stream));
    } while (stream.eat("|"));

    return exprs.length == 1 ? exprs[0] : {
      type: "choice",
      exprs: exprs
    };
  }

  function parseExprSeq(stream) {
    var exprs = [];

    do {
      exprs.push(parseExprSubscript(stream));
    } while (stream.next && stream.next != ")" && stream.next != "|");

    return exprs.length == 1 ? exprs[0] : {
      type: "seq",
      exprs: exprs
    };
  }

  function parseExprSubscript(stream) {
    var expr = parseExprAtom(stream);

    for (;;) {
      if (stream.eat("+")) {
        expr = {
          type: "plus",
          expr: expr
        };
      } else if (stream.eat("*")) {
        expr = {
          type: "star",
          expr: expr
        };
      } else if (stream.eat("?")) {
        expr = {
          type: "opt",
          expr: expr
        };
      } else if (stream.eat("{")) {
        expr = parseExprRange(stream, expr);
      } else {
        break;
      }
    }

    return expr;
  }

  function parseNum(stream) {
    if (/\D/.test(stream.next)) {
      stream.err("Expected number, got '" + stream.next + "'");
    }

    var result = Number(stream.next);
    stream.pos++;
    return result;
  }

  function parseExprRange(stream, expr) {
    var min = parseNum(stream),
        max = min;

    if (stream.eat(",")) {
      if (stream.next != "}") {
        max = parseNum(stream);
      } else {
        max = -1;
      }
    }

    if (!stream.eat("}")) {
      stream.err("Unclosed braced range");
    }

    return {
      type: "range",
      min: min,
      max: max,
      expr: expr
    };
  }

  function resolveName(stream, name) {
    var types = stream.nodeTypes,
        type = types[name];

    if (type) {
      return [type];
    }

    var result = [];

    for (var typeName in types) {
      var type$1 = types[typeName];

      if (type$1.groups.indexOf(name) > -1) {
        result.push(type$1);
      }
    }

    if (result.length == 0) {
      stream.err("No node type or group '" + name + "' found");
    }

    return result;
  }

  function parseExprAtom(stream) {
    if (stream.eat("(")) {
      var expr = parseExpr(stream);

      if (!stream.eat(")")) {
        stream.err("Missing closing paren");
      }

      return expr;
    } else if (!/\W/.test(stream.next)) {
      var exprs = resolveName(stream, stream.next).map(function (type) {
        if (stream.inline == null) {
          stream.inline = type.isInline;
        } else if (stream.inline != type.isInline) {
          stream.err("Mixing inline and block content");
        }

        return {
          type: "name",
          value: type
        };
      });
      stream.pos++;
      return exprs.length == 1 ? exprs[0] : {
        type: "choice",
        exprs: exprs
      };
    } else {
      stream.err("Unexpected token '" + stream.next + "'");
    }
  } // The code below helps compile a regular-expression-like language
  // into a deterministic finite automaton. For a good introduction to
  // these concepts, see https://swtch.com/~rsc/regexp/regexp1.html
  // : (Object) → [[{term: ?any, to: number}]]
  // Construct an NFA from an expression as returned by the parser. The
  // NFA is represented as an array of states, which are themselves
  // arrays of edges, which are `{term, to}` objects. The first state is
  // the entry state and the last node is the success state.
  //
  // Note that unlike typical NFAs, the edge ordering in this one is
  // significant, in that it is used to contruct filler content when
  // necessary.


  function nfa(expr) {
    var nfa = [[]];
    connect(compile(expr, 0), node());
    return nfa;

    function node() {
      return nfa.push([]) - 1;
    }

    function edge(from, to, term) {
      var edge = {
        term: term,
        to: to
      };
      nfa[from].push(edge);
      return edge;
    }

    function connect(edges, to) {
      edges.forEach(function (edge) {
        return edge.to = to;
      });
    }

    function compile(expr, from) {
      if (expr.type == "choice") {
        return expr.exprs.reduce(function (out, expr) {
          return out.concat(compile(expr, from));
        }, []);
      } else if (expr.type == "seq") {
        for (var i = 0;; i++) {
          var next = compile(expr.exprs[i], from);

          if (i == expr.exprs.length - 1) {
            return next;
          }

          connect(next, from = node());
        }
      } else if (expr.type == "star") {
        var loop = node();
        edge(from, loop);
        connect(compile(expr.expr, loop), loop);
        return [edge(loop)];
      } else if (expr.type == "plus") {
        var loop$1 = node();
        connect(compile(expr.expr, from), loop$1);
        connect(compile(expr.expr, loop$1), loop$1);
        return [edge(loop$1)];
      } else if (expr.type == "opt") {
        return [edge(from)].concat(compile(expr.expr, from));
      } else if (expr.type == "range") {
        var cur = from;

        for (var i$1 = 0; i$1 < expr.min; i$1++) {
          var next$1 = node();
          connect(compile(expr.expr, cur), next$1);
          cur = next$1;
        }

        if (expr.max == -1) {
          connect(compile(expr.expr, cur), cur);
        } else {
          for (var i$2 = expr.min; i$2 < expr.max; i$2++) {
            var next$2 = node();
            edge(cur, next$2);
            connect(compile(expr.expr, cur), next$2);
            cur = next$2;
          }
        }

        return [edge(cur)];
      } else if (expr.type == "name") {
        return [edge(from, null, expr.value)];
      }
    }
  }

  function cmp(a, b) {
    return b - a;
  } // Get the set of nodes reachable by null edges from `node`. Omit
  // nodes with only a single null-out-edge, since they may lead to
  // needless duplicated nodes.


  function nullFrom(nfa, node) {
    var result = [];
    scan(node);
    return result.sort(cmp);

    function scan(node) {
      var edges = nfa[node];

      if (edges.length == 1 && !edges[0].term) {
        return scan(edges[0].to);
      }

      result.push(node);

      for (var i = 0; i < edges.length; i++) {
        var ref = edges[i];
        var term = ref.term;
        var to = ref.to;

        if (!term && result.indexOf(to) == -1) {
          scan(to);
        }
      }
    }
  } // : ([[{term: ?any, to: number}]]) → ContentMatch
  // Compiles an NFA as produced by `nfa` into a DFA, modeled as a set
  // of state objects (`ContentMatch` instances) with transitions
  // between them.


  function dfa(nfa) {
    var labeled = Object.create(null);
    return explore(nullFrom(nfa, 0));

    function explore(states) {
      var out = [];
      states.forEach(function (node) {
        nfa[node].forEach(function (ref) {
          var term = ref.term;
          var to = ref.to;

          if (!term) {
            return;
          }

          var known = out.indexOf(term),
              set = known > -1 && out[known + 1];
          nullFrom(nfa, to).forEach(function (node) {
            if (!set) {
              out.push(term, set = []);
            }

            if (set.indexOf(node) == -1) {
              set.push(node);
            }
          });
        });
      });
      var state = labeled[states.join(",")] = new ContentMatch(states.indexOf(nfa.length - 1) > -1);

      for (var i = 0; i < out.length; i += 2) {
        var states$1 = out[i + 1].sort(cmp);
        state.next.push(out[i], labeled[states$1.join(",")] || explore(states$1));
      }

      return state;
    }
  }

  function checkForDeadEnds(match, stream) {
    for (var i = 0, work = [match]; i < work.length; i++) {
      var state = work[i],
          dead = !state.validEnd,
          nodes = [];

      for (var j = 0; j < state.next.length; j += 2) {
        var node = state.next[j],
            next = state.next[j + 1];
        nodes.push(node.name);

        if (dead && !(node.isText || node.hasRequiredAttrs())) {
          dead = false;
        }

        if (work.indexOf(next) == -1) {
          work.push(next);
        }
      }

      if (dead) {
        stream.err("Only non-generatable nodes (" + nodes.join(", ") + ") in a required position");
      }
    }
  } // For node types where all attrs have a default value (or which don't
  // have any attributes), build up a single reusable default attribute
  // object, and use it for all nodes that don't specify specific
  // attributes.


  function defaultAttrs(attrs) {
    var defaults = Object.create(null);

    for (var attrName in attrs) {
      var attr = attrs[attrName];

      if (!attr.hasDefault) {
        return null;
      }

      defaults[attrName] = attr.default;
    }

    return defaults;
  }

  function computeAttrs(attrs, value) {
    var built = Object.create(null);

    for (var name in attrs) {
      var given = value && value[name];

      if (given === undefined) {
        var attr = attrs[name];

        if (attr.hasDefault) {
          given = attr.default;
        } else {
          throw new RangeError("No value supplied for attribute " + name);
        }
      }

      built[name] = given;
    }

    return built;
  }

  function initAttrs(attrs) {
    var result = Object.create(null);

    if (attrs) {
      for (var name in attrs) {
        result[name] = new Attribute(attrs[name]);
      }
    }

    return result;
  } // ::- Node types are objects allocated once per `Schema` and used to
  // [tag](#model.Node.type) `Node` instances. They contain information
  // about the node type, such as its name and what kind of node it
  // represents.


  var NodeType = function NodeType(name, schema, spec) {
    // :: string
    // The name the node type has in this schema.
    this.name = name; // :: Schema
    // A link back to the `Schema` the node type belongs to.

    this.schema = schema; // :: NodeSpec
    // The spec that this type is based on

    this.spec = spec;
    this.groups = spec.group ? spec.group.split(" ") : [];
    this.attrs = initAttrs(spec.attrs);
    this.defaultAttrs = defaultAttrs(this.attrs); // :: ContentMatch
    // The starting match of the node type's content expression.

    this.contentMatch = null; // : ?[MarkType]
    // The set of marks allowed in this node. `null` means all marks
    // are allowed.

    this.markSet = null; // :: bool
    // True if this node type has inline content.

    this.inlineContent = null; // :: bool
    // True if this is a block type

    this.isBlock = !(spec.inline || name == "text"); // :: bool
    // True if this is the text node type.

    this.isText = name == "text";
  };

  var prototypeAccessors$5 = {
    isInline: {
      configurable: true
    },
    isTextblock: {
      configurable: true
    },
    isLeaf: {
      configurable: true
    },
    isAtom: {
      configurable: true
    }
  }; // :: bool
  // True if this is an inline type.

  prototypeAccessors$5.isInline.get = function () {
    return !this.isBlock;
  }; // :: bool
  // True if this is a textblock type, a block that contains inline
  // content.


  prototypeAccessors$5.isTextblock.get = function () {
    return this.isBlock && this.inlineContent;
  }; // :: bool
  // True for node types that allow no content.


  prototypeAccessors$5.isLeaf.get = function () {
    return this.contentMatch == ContentMatch.empty;
  }; // :: bool
  // True when this node is an atom, i.e. when it does not have
  // directly editable content.


  prototypeAccessors$5.isAtom.get = function () {
    return this.isLeaf || this.spec.atom;
  };

  NodeType.prototype.hasRequiredAttrs = function hasRequiredAttrs(ignore) {
    for (var n in this.attrs) {
      if (this.attrs[n].isRequired && (!ignore || !(n in ignore))) {
        return true;
      }
    }

    return false;
  };

  NodeType.prototype.compatibleContent = function compatibleContent(other) {
    return this == other || this.contentMatch.compatible(other.contentMatch);
  };

  NodeType.prototype.computeAttrs = function computeAttrs$1(attrs) {
    if (!attrs && this.defaultAttrs) {
      return this.defaultAttrs;
    } else {
      return computeAttrs(this.attrs, attrs);
    }
  }; // :: (?Object, ?union<Fragment, Node, [Node]>, ?[Mark]) → Node
  // Create a `Node` of this type. The given attributes are
  // checked and defaulted (you can pass `null` to use the type's
  // defaults entirely, if no required attributes exist). `content`
  // may be a `Fragment`, a node, an array of nodes, or
  // `null`. Similarly `marks` may be `null` to default to the empty
  // set of marks.


  NodeType.prototype.create = function create(attrs, content, marks) {
    if (this.isText) {
      throw new Error("NodeType.create can't construct text nodes");
    }

    return new Node$1(this, this.computeAttrs(attrs), Fragment.from(content), Mark.setFrom(marks));
  }; // :: (?Object, ?union<Fragment, Node, [Node]>, ?[Mark]) → Node
  // Like [`create`](#model.NodeType.create), but check the given content
  // against the node type's content restrictions, and throw an error
  // if it doesn't match.


  NodeType.prototype.createChecked = function createChecked(attrs, content, marks) {
    content = Fragment.from(content);

    if (!this.validContent(content)) {
      throw new RangeError("Invalid content for node " + this.name);
    }

    return new Node$1(this, this.computeAttrs(attrs), content, Mark.setFrom(marks));
  }; // :: (?Object, ?union<Fragment, Node, [Node]>, ?[Mark]) → ?Node
  // Like [`create`](#model.NodeType.create), but see if it is necessary to
  // add nodes to the start or end of the given fragment to make it
  // fit the node. If no fitting wrapping can be found, return null.
  // Note that, due to the fact that required nodes can always be
  // created, this will always succeed if you pass null or
  // `Fragment.empty` as content.


  NodeType.prototype.createAndFill = function createAndFill(attrs, content, marks) {
    attrs = this.computeAttrs(attrs);
    content = Fragment.from(content);

    if (content.size) {
      var before = this.contentMatch.fillBefore(content);

      if (!before) {
        return null;
      }

      content = before.append(content);
    }

    var after = this.contentMatch.matchFragment(content).fillBefore(Fragment.empty, true);

    if (!after) {
      return null;
    }

    return new Node$1(this, attrs, content.append(after), Mark.setFrom(marks));
  }; // :: (Fragment) → bool
  // Returns true if the given fragment is valid content for this node
  // type with the given attributes.


  NodeType.prototype.validContent = function validContent(content) {
    var result = this.contentMatch.matchFragment(content);

    if (!result || !result.validEnd) {
      return false;
    }

    for (var i = 0; i < content.childCount; i++) {
      if (!this.allowsMarks(content.child(i).marks)) {
        return false;
      }
    }

    return true;
  }; // :: (MarkType) → bool
  // Check whether the given mark type is allowed in this node.


  NodeType.prototype.allowsMarkType = function allowsMarkType(markType) {
    return this.markSet == null || this.markSet.indexOf(markType) > -1;
  }; // :: ([Mark]) → bool
  // Test whether the given set of marks are allowed in this node.


  NodeType.prototype.allowsMarks = function allowsMarks(marks) {
    if (this.markSet == null) {
      return true;
    }

    for (var i = 0; i < marks.length; i++) {
      if (!this.allowsMarkType(marks[i].type)) {
        return false;
      }
    }

    return true;
  }; // :: ([Mark]) → [Mark]
  // Removes the marks that are not allowed in this node from the given set.


  NodeType.prototype.allowedMarks = function allowedMarks(marks) {
    if (this.markSet == null) {
      return marks;
    }

    var copy;

    for (var i = 0; i < marks.length; i++) {
      if (!this.allowsMarkType(marks[i].type)) {
        if (!copy) {
          copy = marks.slice(0, i);
        }
      } else if (copy) {
        copy.push(marks[i]);
      }
    }

    return !copy ? marks : copy.length ? copy : Mark.empty;
  };

  NodeType.compile = function compile(nodes, schema) {
    var result = Object.create(null);
    nodes.forEach(function (name, spec) {
      return result[name] = new NodeType(name, schema, spec);
    });
    var topType = schema.spec.topNode || "doc";

    if (!result[topType]) {
      throw new RangeError("Schema is missing its top node type ('" + topType + "')");
    }

    if (!result.text) {
      throw new RangeError("Every schema needs a 'text' type");
    }

    for (var _ in result.text.attrs) {
      throw new RangeError("The text node type should not have attributes");
    }

    return result;
  };

  Object.defineProperties(NodeType.prototype, prototypeAccessors$5); // Attribute descriptors

  var Attribute = function Attribute(options) {
    this.hasDefault = Object.prototype.hasOwnProperty.call(options, "default");
    this.default = options.default;
  };

  var prototypeAccessors$1$3 = {
    isRequired: {
      configurable: true
    }
  };

  prototypeAccessors$1$3.isRequired.get = function () {
    return !this.hasDefault;
  };

  Object.defineProperties(Attribute.prototype, prototypeAccessors$1$3); // Marks
  // ::- Like nodes, marks (which are associated with nodes to signify
  // things like emphasis or being part of a link) are
  // [tagged](#model.Mark.type) with type objects, which are
  // instantiated once per `Schema`.

  var MarkType = function MarkType(name, rank, schema, spec) {
    // :: string
    // The name of the mark type.
    this.name = name; // :: Schema
    // The schema that this mark type instance is part of.

    this.schema = schema; // :: MarkSpec
    // The spec on which the type is based.

    this.spec = spec;
    this.attrs = initAttrs(spec.attrs);
    this.rank = rank;
    this.excluded = null;
    var defaults = defaultAttrs(this.attrs);
    this.instance = defaults && new Mark(this, defaults);
  }; // :: (?Object) → Mark
  // Create a mark of this type. `attrs` may be `null` or an object
  // containing only some of the mark's attributes. The others, if
  // they have defaults, will be added.


  MarkType.prototype.create = function create(attrs) {
    if (!attrs && this.instance) {
      return this.instance;
    }

    return new Mark(this, computeAttrs(this.attrs, attrs));
  };

  MarkType.compile = function compile(marks, schema) {
    var result = Object.create(null),
        rank = 0;
    marks.forEach(function (name, spec) {
      return result[name] = new MarkType(name, rank++, schema, spec);
    });
    return result;
  }; // :: ([Mark]) → [Mark]
  // When there is a mark of this type in the given set, a new set
  // without it is returned. Otherwise, the input set is returned.


  MarkType.prototype.removeFromSet = function removeFromSet(set) {
    for (var i = 0; i < set.length; i++) {
      if (set[i].type == this) {
        return set.slice(0, i).concat(set.slice(i + 1));
      }
    }

    return set;
  }; // :: ([Mark]) → ?Mark
  // Tests whether there is a mark of this type in the given set.


  MarkType.prototype.isInSet = function isInSet(set) {
    for (var i = 0; i < set.length; i++) {
      if (set[i].type == this) {
        return set[i];
      }
    }
  }; // :: (MarkType) → bool
  // Queries whether a given mark type is
  // [excluded](#model.MarkSpec.excludes) by this one.


  MarkType.prototype.excludes = function excludes(other) {
    return this.excluded.indexOf(other) > -1;
  }; // SchemaSpec:: interface
  // An object describing a schema, as passed to the [`Schema`](#model.Schema)
  // constructor.
  //
  //   nodes:: union<Object<NodeSpec>, OrderedMap<NodeSpec>>
  //   The node types in this schema. Maps names to
  //   [`NodeSpec`](#model.NodeSpec) objects that describe the node type
  //   associated with that name. Their order is significant—it
  //   determines which [parse rules](#model.NodeSpec.parseDOM) take
  //   precedence by default, and which nodes come first in a given
  //   [group](#model.NodeSpec.group).
  //
  //   marks:: ?union<Object<MarkSpec>, OrderedMap<MarkSpec>>
  //   The mark types that exist in this schema. The order in which they
  //   are provided determines the order in which [mark
  //   sets](#model.Mark.addToSet) are sorted and in which [parse
  //   rules](#model.MarkSpec.parseDOM) are tried.
  //
  //   topNode:: ?string
  //   The name of the default top-level node for the schema. Defaults
  //   to `"doc"`.
  // NodeSpec:: interface
  //
  //   content:: ?string
  //   The content expression for this node, as described in the [schema
  //   guide](/docs/guide/#schema.content_expressions). When not given,
  //   the node does not allow any content.
  //
  //   marks:: ?string
  //   The marks that are allowed inside of this node. May be a
  //   space-separated string referring to mark names or groups, `"_"`
  //   to explicitly allow all marks, or `""` to disallow marks. When
  //   not given, nodes with inline content default to allowing all
  //   marks, other nodes default to not allowing marks.
  //
  //   group:: ?string
  //   The group or space-separated groups to which this node belongs,
  //   which can be referred to in the content expressions for the
  //   schema.
  //
  //   inline:: ?bool
  //   Should be set to true for inline nodes. (Implied for text nodes.)
  //
  //   atom:: ?bool
  //   Can be set to true to indicate that, though this isn't a [leaf
  //   node](#model.NodeType.isLeaf), it doesn't have directly editable
  //   content and should be treated as a single unit in the view.
  //
  //   attrs:: ?Object<AttributeSpec>
  //   The attributes that nodes of this type get.
  //
  //   selectable:: ?bool
  //   Controls whether nodes of this type can be selected as a [node
  //   selection](#state.NodeSelection). Defaults to true for non-text
  //   nodes.
  //
  //   draggable:: ?bool
  //   Determines whether nodes of this type can be dragged without
  //   being selected. Defaults to false.
  //
  //   code:: ?bool
  //   Can be used to indicate that this node contains code, which
  //   causes some commands to behave differently.
  //
  //   defining:: ?bool
  //   Determines whether this node is considered an important parent
  //   node during replace operations (such as paste). Non-defining (the
  //   default) nodes get dropped when their entire content is replaced,
  //   whereas defining nodes persist and wrap the inserted content.
  //   Likewise, in _inserted_ content the defining parents of the
  //   content are preserved when possible. Typically,
  //   non-default-paragraph textblock types, and possibly list items,
  //   are marked as defining.
  //
  //   isolating:: ?bool
  //   When enabled (default is false), the sides of nodes of this type
  //   count as boundaries that regular editing operations, like
  //   backspacing or lifting, won't cross. An example of a node that
  //   should probably have this enabled is a table cell.
  //
  //   toDOM:: ?(node: Node) → DOMOutputSpec
  //   Defines the default way a node of this type should be serialized
  //   to DOM/HTML (as used by
  //   [`DOMSerializer.fromSchema`](#model.DOMSerializer^fromSchema)).
  //   Should return a DOM node or an [array
  //   structure](#model.DOMOutputSpec) that describes one, with an
  //   optional number zero (“hole”) in it to indicate where the node's
  //   content should be inserted.
  //
  //   For text nodes, the default is to create a text DOM node. Though
  //   it is possible to create a serializer where text is rendered
  //   differently, this is not supported inside the editor, so you
  //   shouldn't override that in your text node spec.
  //
  //   parseDOM:: ?[ParseRule]
  //   Associates DOM parser information with this node, which can be
  //   used by [`DOMParser.fromSchema`](#model.DOMParser^fromSchema) to
  //   automatically derive a parser. The `node` field in the rules is
  //   implied (the name of this node will be filled in automatically).
  //   If you supply your own parser, you do not need to also specify
  //   parsing rules in your schema.
  //
  //   toDebugString:: ?(node: Node) -> string
  //   Defines the default way a node of this type should be serialized
  //   to a string representation for debugging (e.g. in error messages).
  // MarkSpec:: interface
  //
  //   attrs:: ?Object<AttributeSpec>
  //   The attributes that marks of this type get.
  //
  //   inclusive:: ?bool
  //   Whether this mark should be active when the cursor is positioned
  //   at its end (or at its start when that is also the start of the
  //   parent node). Defaults to true.
  //
  //   excludes:: ?string
  //   Determines which other marks this mark can coexist with. Should
  //   be a space-separated strings naming other marks or groups of marks.
  //   When a mark is [added](#model.Mark.addToSet) to a set, all marks
  //   that it excludes are removed in the process. If the set contains
  //   any mark that excludes the new mark but is not, itself, excluded
  //   by the new mark, the mark can not be added an the set. You can
  //   use the value `"_"` to indicate that the mark excludes all
  //   marks in the schema.
  //
  //   Defaults to only being exclusive with marks of the same type. You
  //   can set it to an empty string (or any string not containing the
  //   mark's own name) to allow multiple marks of a given type to
  //   coexist (as long as they have different attributes).
  //
  //   group:: ?string
  //   The group or space-separated groups to which this mark belongs.
  //
  //   spanning:: ?bool
  //   Determines whether marks of this type can span multiple adjacent
  //   nodes when serialized to DOM/HTML. Defaults to true.
  //
  //   toDOM:: ?(mark: Mark, inline: bool) → DOMOutputSpec
  //   Defines the default way marks of this type should be serialized
  //   to DOM/HTML. When the resulting spec contains a hole, that is
  //   where the marked content is placed. Otherwise, it is appended to
  //   the top node.
  //
  //   parseDOM:: ?[ParseRule]
  //   Associates DOM parser information with this mark (see the
  //   corresponding [node spec field](#model.NodeSpec.parseDOM)). The
  //   `mark` field in the rules is implied.
  // AttributeSpec:: interface
  //
  // Used to [define](#model.NodeSpec.attrs) attributes on nodes or
  // marks.
  //
  //   default:: ?any
  //   The default value for this attribute, to use when no explicit
  //   value is provided. Attributes that have no default must be
  //   provided whenever a node or mark of a type that has them is
  //   created.
  // ::- A document schema. Holds [node](#model.NodeType) and [mark
  // type](#model.MarkType) objects for the nodes and marks that may
  // occur in conforming documents, and provides functionality for
  // creating and deserializing such documents.


  var Schema = function Schema(spec) {
    // :: SchemaSpec
    // The [spec](#model.SchemaSpec) on which the schema is based,
    // with the added guarantee that its `nodes` and `marks`
    // properties are
    // [`OrderedMap`](https://github.com/marijnh/orderedmap) instances
    // (not raw objects).
    this.spec = {};

    for (var prop in spec) {
      this.spec[prop] = spec[prop];
    }

    this.spec.nodes = orderedmap.from(spec.nodes);
    this.spec.marks = orderedmap.from(spec.marks); // :: Object<NodeType>
    // An object mapping the schema's node names to node type objects.

    this.nodes = NodeType.compile(this.spec.nodes, this); // :: Object<MarkType>
    // A map from mark names to mark type objects.

    this.marks = MarkType.compile(this.spec.marks, this);
    var contentExprCache = Object.create(null);

    for (var prop$1 in this.nodes) {
      if (prop$1 in this.marks) {
        throw new RangeError(prop$1 + " can not be both a node and a mark");
      }

      var type = this.nodes[prop$1],
          contentExpr = type.spec.content || "",
          markExpr = type.spec.marks;
      type.contentMatch = contentExprCache[contentExpr] || (contentExprCache[contentExpr] = ContentMatch.parse(contentExpr, this.nodes));
      type.inlineContent = type.contentMatch.inlineContent;
      type.markSet = markExpr == "_" ? null : markExpr ? gatherMarks(this, markExpr.split(" ")) : markExpr == "" || !type.inlineContent ? [] : null;
    }

    for (var prop$2 in this.marks) {
      var type$1 = this.marks[prop$2],
          excl = type$1.spec.excludes;
      type$1.excluded = excl == null ? [type$1] : excl == "" ? [] : gatherMarks(this, excl.split(" "));
    }

    this.nodeFromJSON = this.nodeFromJSON.bind(this);
    this.markFromJSON = this.markFromJSON.bind(this); // :: NodeType
    // The type of the [default top node](#model.SchemaSpec.topNode)
    // for this schema.

    this.topNodeType = this.nodes[this.spec.topNode || "doc"]; // :: Object
    // An object for storing whatever values modules may want to
    // compute and cache per schema. (If you want to store something
    // in it, try to use property names unlikely to clash.)

    this.cached = Object.create(null);
    this.cached.wrappings = Object.create(null);
  }; // :: (union<string, NodeType>, ?Object, ?union<Fragment, Node, [Node]>, ?[Mark]) → Node
  // Create a node in this schema. The `type` may be a string or a
  // `NodeType` instance. Attributes will be extended
  // with defaults, `content` may be a `Fragment`,
  // `null`, a `Node`, or an array of nodes.


  Schema.prototype.node = function node(type, attrs, content, marks) {
    if (typeof type == "string") {
      type = this.nodeType(type);
    } else if (!(type instanceof NodeType)) {
      throw new RangeError("Invalid node type: " + type);
    } else if (type.schema != this) {
      throw new RangeError("Node type from different schema used (" + type.name + ")");
    }

    return type.createChecked(attrs, content, marks);
  }; // :: (string, ?[Mark]) → Node
  // Create a text node in the schema. Empty text nodes are not
  // allowed.


  Schema.prototype.text = function text(text$1, marks) {
    var type = this.nodes.text;
    return new TextNode(type, type.defaultAttrs, text$1, Mark.setFrom(marks));
  }; // :: (union<string, MarkType>, ?Object) → Mark
  // Create a mark with the given type and attributes.


  Schema.prototype.mark = function mark(type, attrs) {
    if (typeof type == "string") {
      type = this.marks[type];
    }

    return type.create(attrs);
  }; // :: (Object) → Node
  // Deserialize a node from its JSON representation. This method is
  // bound.


  Schema.prototype.nodeFromJSON = function nodeFromJSON(json) {
    return Node$1.fromJSON(this, json);
  }; // :: (Object) → Mark
  // Deserialize a mark from its JSON representation. This method is
  // bound.


  Schema.prototype.markFromJSON = function markFromJSON(json) {
    return Mark.fromJSON(this, json);
  };

  Schema.prototype.nodeType = function nodeType(name) {
    var found = this.nodes[name];

    if (!found) {
      throw new RangeError("Unknown node type: " + name);
    }

    return found;
  };

  function gatherMarks(schema, marks) {
    var found = [];

    for (var i = 0; i < marks.length; i++) {
      var name = marks[i],
          mark = schema.marks[name],
          ok = mark;

      if (mark) {
        found.push(mark);
      } else {
        for (var prop in schema.marks) {
          var mark$1 = schema.marks[prop];

          if (name == "_" || mark$1.spec.group && mark$1.spec.group.split(" ").indexOf(name) > -1) {
            found.push(ok = mark$1);
          }
        }
      }

      if (!ok) {
        throw new SyntaxError("Unknown mark type: '" + marks[i] + "'");
      }
    }

    return found;
  } // ParseOptions:: interface
  // These are the options recognized by the
  // [`parse`](#model.DOMParser.parse) and
  // [`parseSlice`](#model.DOMParser.parseSlice) methods.
  //
  //   preserveWhitespace:: ?union<bool, "full">
  //   By default, whitespace is collapsed as per HTML's rules. Pass
  //   `true` to preserve whitespace, but normalize newlines to
  //   spaces, and `"full"` to preserve whitespace entirely.
  //
  //   findPositions:: ?[{node: dom.Node, offset: number}]
  //   When given, the parser will, beside parsing the content,
  //   record the document positions of the given DOM positions. It
  //   will do so by writing to the objects, adding a `pos` property
  //   that holds the document position. DOM positions that are not
  //   in the parsed content will not be written to.
  //
  //   from:: ?number
  //   The child node index to start parsing from.
  //
  //   to:: ?number
  //   The child node index to stop parsing at.
  //
  //   topNode:: ?Node
  //   By default, the content is parsed into the schema's default
  //   [top node type](#model.Schema.topNodeType). You can pass this
  //   option to use the type and attributes from a different node
  //   as the top container.
  //
  //   topMatch:: ?ContentMatch
  //   Provide the starting content match that content parsed into the
  //   top node is matched against.
  //
  //   context:: ?ResolvedPos
  //   A set of additional nodes to count as
  //   [context](#model.ParseRule.context) when parsing, above the
  //   given [top node](#model.ParseOptions.topNode).
  // ParseRule:: interface
  // A value that describes how to parse a given DOM node or inline
  // style as a ProseMirror node or mark.
  //
  //   tag:: ?string
  //   A CSS selector describing the kind of DOM elements to match. A
  //   single rule should have _either_ a `tag` or a `style` property.
  //
  //   namespace:: ?string
  //   The namespace to match. This should be used with `tag`.
  //   Nodes are only matched when the namespace matches or this property
  //   is null.
  //
  //   style:: ?string
  //   A CSS property name to match. When given, this rule matches
  //   inline styles that list that property. May also have the form
  //   `"property=value"`, in which case the rule only matches if the
  //   propery's value exactly matches the given value. (For more
  //   complicated filters, use [`getAttrs`](#model.ParseRule.getAttrs)
  //   and return false to indicate that the match failed.)
  //
  //   priority:: ?number
  //   Can be used to change the order in which the parse rules in a
  //   schema are tried. Those with higher priority come first. Rules
  //   without a priority are counted as having priority 50. This
  //   property is only meaningful in a schema—when directly
  //   constructing a parser, the order of the rule array is used.
  //
  //   context:: ?string
  //   When given, restricts this rule to only match when the current
  //   context—the parent nodes into which the content is being
  //   parsed—matches this expression. Should contain one or more node
  //   names or node group names followed by single or double slashes.
  //   For example `"paragraph/"` means the rule only matches when the
  //   parent node is a paragraph, `"blockquote/paragraph/"` restricts
  //   it to be in a paragraph that is inside a blockquote, and
  //   `"section//"` matches any position inside a section—a double
  //   slash matches any sequence of ancestor nodes. To allow multiple
  //   different contexts, they can be separated by a pipe (`|`)
  //   character, as in `"blockquote/|list_item/"`.
  //
  //   node:: ?string
  //   The name of the node type to create when this rule matches. Only
  //   valid for rules with a `tag` property, not for style rules. Each
  //   rule should have one of a `node`, `mark`, or `ignore` property
  //   (except when it appears in a [node](#model.NodeSpec.parseDOM) or
  //   [mark spec](#model.MarkSpec.parseDOM), in which case the `node`
  //   or `mark` property will be derived from its position).
  //
  //   mark:: ?string
  //   The name of the mark type to wrap the matched content in.
  //
  //   ignore:: ?bool
  //   When true, ignore content that matches this rule.
  //
  //   skip:: ?bool
  //   When true, ignore the node that matches this rule, but do parse
  //   its content.
  //
  //   attrs:: ?Object
  //   Attributes for the node or mark created by this rule. When
  //   `getAttrs` is provided, it takes precedence.
  //
  //   getAttrs:: ?(union<dom.Node, string>) → ?union<Object, false>
  //   A function used to compute the attributes for the node or mark
  //   created by this rule. Can also be used to describe further
  //   conditions the DOM element or style must match. When it returns
  //   `false`, the rule won't match. When it returns null or undefined,
  //   that is interpreted as an empty/default set of attributes.
  //
  //   Called with a DOM Element for `tag` rules, and with a string (the
  //   style's value) for `style` rules.
  //
  //   contentElement:: ?union<string, (dom.Node) → dom.Node>
  //   For `tag` rules that produce non-leaf nodes or marks, by default
  //   the content of the DOM element is parsed as content of the mark
  //   or node. If the child nodes are in a descendent node, this may be
  //   a CSS selector string that the parser must use to find the actual
  //   content element, or a function that returns the actual content
  //   element to the parser.
  //
  //   getContent:: ?(dom.Node, schema: Schema) → Fragment
  //   Can be used to override the content of a matched node. When
  //   present, instead of parsing the node's child nodes, the result of
  //   this function is used.
  //
  //   preserveWhitespace:: ?union<bool, "full">
  //   Controls whether whitespace should be preserved when parsing the
  //   content inside the matched element. `false` means whitespace may
  //   be collapsed, `true` means that whitespace should be preserved
  //   but newlines normalized to spaces, and `"full"` means that
  //   newlines should also be preserved.
  // ::- A DOM parser represents a strategy for parsing DOM content into
  // a ProseMirror document conforming to a given schema. Its behavior
  // is defined by an array of [rules](#model.ParseRule).


  var DOMParser = function DOMParser(schema, rules) {
    var this$1 = this; // :: Schema
    // The schema into which the parser parses.

    this.schema = schema; // :: [ParseRule]
    // The set of [parse rules](#model.ParseRule) that the parser
    // uses, in order of precedence.

    this.rules = rules;
    this.tags = [];
    this.styles = [];
    rules.forEach(function (rule) {
      if (rule.tag) {
        this$1.tags.push(rule);
      } else if (rule.style) {
        this$1.styles.push(rule);
      }
    });
  }; // :: (dom.Node, ?ParseOptions) → Node
  // Parse a document from the content of a DOM node.


  DOMParser.prototype.parse = function parse(dom, options) {
    if (options === void 0) options = {};
    var context = new ParseContext(this, options, false);
    context.addAll(dom, null, options.from, options.to);
    return context.finish();
  }; // :: (dom.Node, ?ParseOptions) → Slice
  // Parses the content of the given DOM node, like
  // [`parse`](#model.DOMParser.parse), and takes the same set of
  // options. But unlike that method, which produces a whole node,
  // this one returns a slice that is open at the sides, meaning that
  // the schema constraints aren't applied to the start of nodes to
  // the left of the input and the end of nodes at the end.


  DOMParser.prototype.parseSlice = function parseSlice(dom, options) {
    if (options === void 0) options = {};
    var context = new ParseContext(this, options, true);
    context.addAll(dom, null, options.from, options.to);
    return Slice.maxOpen(context.finish());
  };

  DOMParser.prototype.matchTag = function matchTag(dom, context) {
    for (var i = 0; i < this.tags.length; i++) {
      var rule = this.tags[i];

      if (matches(dom, rule.tag) && (rule.namespace === undefined || dom.namespaceURI == rule.namespace) && (!rule.context || context.matchesContext(rule.context))) {
        if (rule.getAttrs) {
          var result = rule.getAttrs(dom);

          if (result === false) {
            continue;
          }

          rule.attrs = result;
        }

        return rule;
      }
    }
  };

  DOMParser.prototype.matchStyle = function matchStyle(prop, value, context) {
    for (var i = 0; i < this.styles.length; i++) {
      var rule = this.styles[i];

      if (rule.style.indexOf(prop) != 0 || rule.context && !context.matchesContext(rule.context) || // Test that the style string either precisely matches the prop,
      // or has an '=' sign after the prop, followed by the given
      // value.
      rule.style.length > prop.length && (rule.style.charCodeAt(prop.length) != 61 || rule.style.slice(prop.length + 1) != value)) {
        continue;
      }

      if (rule.getAttrs) {
        var result = rule.getAttrs(value);

        if (result === false) {
          continue;
        }

        rule.attrs = result;
      }

      return rule;
    }
  }; // : (Schema) → [ParseRule]


  DOMParser.schemaRules = function schemaRules(schema) {
    var result = [];

    function insert(rule) {
      var priority = rule.priority == null ? 50 : rule.priority,
          i = 0;

      for (; i < result.length; i++) {
        var next = result[i],
            nextPriority = next.priority == null ? 50 : next.priority;

        if (nextPriority < priority) {
          break;
        }
      }

      result.splice(i, 0, rule);
    }

    var loop = function (name) {
      var rules = schema.marks[name].spec.parseDOM;

      if (rules) {
        rules.forEach(function (rule) {
          insert(rule = copy(rule));
          rule.mark = name;
        });
      }
    };

    for (var name in schema.marks) loop(name);

    var loop$1 = function (name) {
      var rules$1 = schema.nodes[name$1].spec.parseDOM;

      if (rules$1) {
        rules$1.forEach(function (rule) {
          insert(rule = copy(rule));
          rule.node = name$1;
        });
      }
    };

    for (var name$1 in schema.nodes) loop$1();

    return result;
  }; // :: (Schema) → DOMParser
  // Construct a DOM parser using the parsing rules listed in a
  // schema's [node specs](#model.NodeSpec.parseDOM), reordered by
  // [priority](#model.ParseRule.priority).


  DOMParser.fromSchema = function fromSchema(schema) {
    return schema.cached.domParser || (schema.cached.domParser = new DOMParser(schema, DOMParser.schemaRules(schema)));
  }; // : Object<bool> The block-level tags in HTML5


  var blockTags = {
    address: true,
    article: true,
    aside: true,
    blockquote: true,
    canvas: true,
    dd: true,
    div: true,
    dl: true,
    fieldset: true,
    figcaption: true,
    figure: true,
    footer: true,
    form: true,
    h1: true,
    h2: true,
    h3: true,
    h4: true,
    h5: true,
    h6: true,
    header: true,
    hgroup: true,
    hr: true,
    li: true,
    noscript: true,
    ol: true,
    output: true,
    p: true,
    pre: true,
    section: true,
    table: true,
    tfoot: true,
    ul: true
  }; // : Object<bool> The tags that we normally ignore.

  var ignoreTags = {
    head: true,
    noscript: true,
    object: true,
    script: true,
    style: true,
    title: true
  }; // : Object<bool> List tags.

  var listTags = {
    ol: true,
    ul: true
  }; // Using a bitfield for node context options

  var OPT_PRESERVE_WS = 1,
      OPT_PRESERVE_WS_FULL = 2,
      OPT_OPEN_LEFT = 4;

  function wsOptionsFor(preserveWhitespace) {
    return (preserveWhitespace ? OPT_PRESERVE_WS : 0) | (preserveWhitespace === "full" ? OPT_PRESERVE_WS_FULL : 0);
  }

  var NodeContext = function NodeContext(type, attrs, marks, solid, match, options) {
    this.type = type;
    this.attrs = attrs;
    this.solid = solid;
    this.match = match || (options & OPT_OPEN_LEFT ? null : type.contentMatch);
    this.options = options;
    this.content = [];
    this.marks = marks;
    this.activeMarks = Mark.none;
  };

  NodeContext.prototype.findWrapping = function findWrapping(node) {
    if (!this.match) {
      if (!this.type) {
        return [];
      }

      var fill = this.type.contentMatch.fillBefore(Fragment.from(node));

      if (fill) {
        this.match = this.type.contentMatch.matchFragment(fill);
      } else {
        var start = this.type.contentMatch,
            wrap;

        if (wrap = start.findWrapping(node.type)) {
          this.match = start;
          return wrap;
        } else {
          return null;
        }
      }
    }

    return this.match.findWrapping(node.type);
  };

  NodeContext.prototype.finish = function finish(openEnd) {
    if (!(this.options & OPT_PRESERVE_WS)) {
      // Strip trailing whitespace
      var last = this.content[this.content.length - 1],
          m;

      if (last && last.isText && (m = /[ \t\r\n\u000c]+$/.exec(last.text))) {
        if (last.text.length == m[0].length) {
          this.content.pop();
        } else {
          this.content[this.content.length - 1] = last.withText(last.text.slice(0, last.text.length - m[0].length));
        }
      }
    }

    var content = Fragment.from(this.content);

    if (!openEnd && this.match) {
      content = content.append(this.match.fillBefore(Fragment.empty, true));
    }

    return this.type ? this.type.create(this.attrs, content, this.marks) : content;
  };

  var ParseContext = function ParseContext(parser, options, open) {
    // : DOMParser The parser we are using.
    this.parser = parser; // : Object The options passed to this parse.

    this.options = options;
    this.isOpen = open;
    this.pendingMarks = [];
    var topNode = options.topNode,
        topContext;
    var topOptions = wsOptionsFor(options.preserveWhitespace) | (open ? OPT_OPEN_LEFT : 0);

    if (topNode) {
      topContext = new NodeContext(topNode.type, topNode.attrs, Mark.none, true, options.topMatch || topNode.type.contentMatch, topOptions);
    } else if (open) {
      topContext = new NodeContext(null, null, Mark.none, true, null, topOptions);
    } else {
      topContext = new NodeContext(parser.schema.topNodeType, null, Mark.none, true, null, topOptions);
    }

    this.nodes = [topContext]; // : [Mark] The current set of marks

    this.open = 0;
    this.find = options.findPositions;
    this.needsBlock = false;
  };

  var prototypeAccessors$6 = {
    top: {
      configurable: true
    },
    currentPos: {
      configurable: true
    }
  };

  prototypeAccessors$6.top.get = function () {
    return this.nodes[this.open];
  }; // : (dom.Node)
  // Add a DOM node to the content. Text is inserted as text node,
  // otherwise, the node is passed to `addElement` or, if it has a
  // `style` attribute, `addElementWithStyles`.


  ParseContext.prototype.addDOM = function addDOM(dom) {
    if (dom.nodeType == 3) {
      this.addTextNode(dom);
    } else if (dom.nodeType == 1) {
      var style = dom.getAttribute("style");
      var marks = style ? this.readStyles(parseStyles(style)) : null;

      if (marks != null) {
        for (var i = 0; i < marks.length; i++) {
          this.addPendingMark(marks[i]);
        }
      }

      this.addElement(dom);

      if (marks != null) {
        for (var i$1 = 0; i$1 < marks.length; i$1++) {
          this.removePendingMark(marks[i$1]);
        }
      }
    }
  };

  ParseContext.prototype.addTextNode = function addTextNode(dom) {
    var value = dom.nodeValue;
    var top = this.top;

    if ((top.type ? top.type.inlineContent : top.content.length && top.content[0].isInline) || /[^ \t\r\n\u000c]/.test(value)) {
      if (!(top.options & OPT_PRESERVE_WS)) {
        value = value.replace(/[ \t\r\n\u000c]+/g, " "); // If this starts with whitespace, and there is no node before it, or
        // a hard break, or a text node that ends with whitespace, strip the
        // leading space.

        if (/^[ \t\r\n\u000c]/.test(value) && this.open == this.nodes.length - 1) {
          var nodeBefore = top.content[top.content.length - 1];
          var domNodeBefore = dom.previousSibling;

          if (!nodeBefore || domNodeBefore && domNodeBefore.nodeName == 'BR' || nodeBefore.isText && /[ \t\r\n\u000c]$/.test(nodeBefore.text)) {
            value = value.slice(1);
          }
        }
      } else if (!(top.options & OPT_PRESERVE_WS_FULL)) {
        value = value.replace(/\r?\n|\r/g, " ");
      }

      if (value) {
        this.insertNode(this.parser.schema.text(value));
      }

      this.findInText(dom);
    } else {
      this.findInside(dom);
    }
  }; // : (dom.Element)
  // Try to find a handler for the given tag and use that to parse. If
  // none is found, the element's content nodes are added directly.


  ParseContext.prototype.addElement = function addElement(dom) {
    var name = dom.nodeName.toLowerCase();

    if (listTags.hasOwnProperty(name)) {
      normalizeList(dom);
    }

    var rule = this.options.ruleFromNode && this.options.ruleFromNode(dom) || this.parser.matchTag(dom, this);

    if (rule ? rule.ignore : ignoreTags.hasOwnProperty(name)) {
      this.findInside(dom);
    } else if (!rule || rule.skip) {
      if (rule && rule.skip.nodeType) {
        dom = rule.skip;
      }

      var sync,
          top = this.top,
          oldNeedsBlock = this.needsBlock;

      if (blockTags.hasOwnProperty(name)) {
        sync = true;

        if (!top.type) {
          this.needsBlock = true;
        }
      } else if (!dom.firstChild) {
        this.leafFallback(dom);
        return;
      }

      this.addAll(dom);

      if (sync) {
        this.sync(top);
      }

      this.needsBlock = oldNeedsBlock;
    } else {
      this.addElementByRule(dom, rule);
    }
  }; // Called for leaf DOM nodes that would otherwise be ignored


  ParseContext.prototype.leafFallback = function leafFallback(dom) {
    if (dom.nodeName == "BR" && this.top.type && this.top.type.inlineContent) {
      this.addTextNode(dom.ownerDocument.createTextNode("\n"));
    }
  }; // Run any style parser associated with the node's styles. Either
  // return an array of marks, or null to indicate some of the styles
  // had a rule with `ignore` set.


  ParseContext.prototype.readStyles = function readStyles(styles) {
    var marks = Mark.none;

    for (var i = 0; i < styles.length; i += 2) {
      var rule = this.parser.matchStyle(styles[i], styles[i + 1], this);

      if (!rule) {
        continue;
      }

      if (rule.ignore) {
        return null;
      }

      marks = this.parser.schema.marks[rule.mark].create(rule.attrs).addToSet(marks);
    }

    return marks;
  }; // : (dom.Element, ParseRule) → bool
  // Look up a handler for the given node. If none are found, return
  // false. Otherwise, apply it, use its return value to drive the way
  // the node's content is wrapped, and return true.


  ParseContext.prototype.addElementByRule = function addElementByRule(dom, rule) {
    var this$1 = this;
    var sync, nodeType, markType, mark;

    if (rule.node) {
      nodeType = this.parser.schema.nodes[rule.node];

      if (!nodeType.isLeaf) {
        sync = this.enter(nodeType, rule.attrs, rule.preserveWhitespace);
      } else if (!this.insertNode(nodeType.create(rule.attrs))) {
        this.leafFallback(dom);
      }
    } else {
      markType = this.parser.schema.marks[rule.mark];
      mark = markType.create(rule.attrs);
      this.addPendingMark(mark);
    }

    var startIn = this.top;

    if (nodeType && nodeType.isLeaf) {
      this.findInside(dom);
    } else if (rule.getContent) {
      this.findInside(dom);
      rule.getContent(dom, this.parser.schema).forEach(function (node) {
        return this$1.insertNode(node);
      });
    } else {
      var contentDOM = rule.contentElement;

      if (typeof contentDOM == "string") {
        contentDOM = dom.querySelector(contentDOM);
      } else if (typeof contentDOM == "function") {
        contentDOM = contentDOM(dom);
      }

      if (!contentDOM) {
        contentDOM = dom;
      }

      this.findAround(dom, contentDOM, true);
      this.addAll(contentDOM, sync);
    }

    if (sync) {
      this.sync(startIn);
      this.open--;
    }

    if (mark) {
      this.removePendingMark(mark);
    }
  }; // : (dom.Node, ?NodeBuilder, ?number, ?number)
  // Add all child nodes between `startIndex` and `endIndex` (or the
  // whole node, if not given). If `sync` is passed, use it to
  // synchronize after every block element.


  ParseContext.prototype.addAll = function addAll(parent, sync, startIndex, endIndex) {
    var index = startIndex || 0;

    for (var dom = startIndex ? parent.childNodes[startIndex] : parent.firstChild, end = endIndex == null ? null : parent.childNodes[endIndex]; dom != end; dom = dom.nextSibling, ++index) {
      this.findAtPoint(parent, index);
      this.addDOM(dom);

      if (sync && blockTags.hasOwnProperty(dom.nodeName.toLowerCase())) {
        this.sync(sync);
      }
    }

    this.findAtPoint(parent, index);
  }; // Try to find a way to fit the given node type into the current
  // context. May add intermediate wrappers and/or leave non-solid
  // nodes that we're in.


  ParseContext.prototype.findPlace = function findPlace(node) {
    var route, sync;

    for (var depth = this.open; depth >= 0; depth--) {
      var cx = this.nodes[depth];
      var found = cx.findWrapping(node);

      if (found && (!route || route.length > found.length)) {
        route = found;
        sync = cx;

        if (!found.length) {
          break;
        }
      }

      if (cx.solid) {
        break;
      }
    }

    if (!route) {
      return false;
    }

    this.sync(sync);

    for (var i = 0; i < route.length; i++) {
      this.enterInner(route[i], null, false);
    }

    return true;
  }; // : (Node) → ?Node
  // Try to insert the given node, adjusting the context when needed.


  ParseContext.prototype.insertNode = function insertNode(node) {
    if (node.isInline && this.needsBlock && !this.top.type) {
      var block = this.textblockFromContext();

      if (block) {
        this.enterInner(block);
      }
    }

    if (this.findPlace(node)) {
      this.closeExtra();
      var top = this.top;
      this.applyPendingMarks(top);

      if (top.match) {
        top.match = top.match.matchType(node.type);
      }

      var marks = top.activeMarks;

      for (var i = 0; i < node.marks.length; i++) {
        if (!top.type || top.type.allowsMarkType(node.marks[i].type)) {
          marks = node.marks[i].addToSet(marks);
        }
      }

      top.content.push(node.mark(marks));
      return true;
    }

    return false;
  };

  ParseContext.prototype.applyPendingMarks = function applyPendingMarks(top) {
    for (var i = 0; i < this.pendingMarks.length; i++) {
      var mark = this.pendingMarks[i];

      if ((!top.type || top.type.allowsMarkType(mark.type)) && !mark.isInSet(top.activeMarks)) {
        top.activeMarks = mark.addToSet(top.activeMarks);
        this.pendingMarks.splice(i--, 1);
      }
    }
  }; // : (NodeType, ?Object) → bool
  // Try to start a node of the given type, adjusting the context when
  // necessary.


  ParseContext.prototype.enter = function enter(type, attrs, preserveWS) {
    var ok = this.findPlace(type.create(attrs));

    if (ok) {
      this.applyPendingMarks(this.top);
      this.enterInner(type, attrs, true, preserveWS);
    }

    return ok;
  }; // Open a node of the given type


  ParseContext.prototype.enterInner = function enterInner(type, attrs, solid, preserveWS) {
    this.closeExtra();
    var top = this.top;
    top.match = top.match && top.match.matchType(type, attrs);
    var options = preserveWS == null ? top.options & ~OPT_OPEN_LEFT : wsOptionsFor(preserveWS);

    if (top.options & OPT_OPEN_LEFT && top.content.length == 0) {
      options |= OPT_OPEN_LEFT;
    }

    this.nodes.push(new NodeContext(type, attrs, top.activeMarks, solid, null, options));
    this.open++;
  }; // Make sure all nodes above this.open are finished and added to
  // their parents


  ParseContext.prototype.closeExtra = function closeExtra(openEnd) {
    var i = this.nodes.length - 1;

    if (i > this.open) {
      for (; i > this.open; i--) {
        this.nodes[i - 1].content.push(this.nodes[i].finish(openEnd));
      }

      this.nodes.length = this.open + 1;
    }
  };

  ParseContext.prototype.finish = function finish() {
    this.open = 0;
    this.closeExtra(this.isOpen);
    return this.nodes[0].finish(this.isOpen || this.options.topOpen);
  };

  ParseContext.prototype.sync = function sync(to) {
    for (var i = this.open; i >= 0; i--) {
      if (this.nodes[i] == to) {
        this.open = i;
        return;
      }
    }
  };

  ParseContext.prototype.addPendingMark = function addPendingMark(mark) {
    this.pendingMarks.push(mark);
  };

  ParseContext.prototype.removePendingMark = function removePendingMark(mark) {
    var found = this.pendingMarks.lastIndexOf(mark);

    if (found > -1) {
      this.pendingMarks.splice(found, 1);
    } else {
      var top = this.top;
      top.activeMarks = mark.removeFromSet(top.activeMarks);
    }
  };

  prototypeAccessors$6.currentPos.get = function () {
    this.closeExtra();
    var pos = 0;

    for (var i = this.open; i >= 0; i--) {
      var content = this.nodes[i].content;

      for (var j = content.length - 1; j >= 0; j--) {
        pos += content[j].nodeSize;
      }

      if (i) {
        pos++;
      }
    }

    return pos;
  };

  ParseContext.prototype.findAtPoint = function findAtPoint(parent, offset) {
    if (this.find) {
      for (var i = 0; i < this.find.length; i++) {
        if (this.find[i].node == parent && this.find[i].offset == offset) {
          this.find[i].pos = this.currentPos;
        }
      }
    }
  };

  ParseContext.prototype.findInside = function findInside(parent) {
    if (this.find) {
      for (var i = 0; i < this.find.length; i++) {
        if (this.find[i].pos == null && parent.nodeType == 1 && parent.contains(this.find[i].node)) {
          this.find[i].pos = this.currentPos;
        }
      }
    }
  };

  ParseContext.prototype.findAround = function findAround(parent, content, before) {
    if (parent != content && this.find) {
      for (var i = 0; i < this.find.length; i++) {
        if (this.find[i].pos == null && parent.nodeType == 1 && parent.contains(this.find[i].node)) {
          var pos = content.compareDocumentPosition(this.find[i].node);

          if (pos & (before ? 2 : 4)) {
            this.find[i].pos = this.currentPos;
          }
        }
      }
    }
  };

  ParseContext.prototype.findInText = function findInText(textNode) {
    if (this.find) {
      for (var i = 0; i < this.find.length; i++) {
        if (this.find[i].node == textNode) {
          this.find[i].pos = this.currentPos - (textNode.nodeValue.length - this.find[i].offset);
        }
      }
    }
  }; // : (string) → bool
  // Determines whether the given [context
  // string](#ParseRule.context) matches this context.


  ParseContext.prototype.matchesContext = function matchesContext(context) {
    var this$1 = this;

    if (context.indexOf("|") > -1) {
      return context.split(/\s*\|\s*/).some(this.matchesContext, this);
    }

    var parts = context.split("/");
    var option = this.options.context;
    var useRoot = !this.isOpen && (!option || option.parent.type == this.nodes[0].type);
    var minDepth = -(option ? option.depth + 1 : 0) + (useRoot ? 0 : 1);

    var match = function (i, depth) {
      for (; i >= 0; i--) {
        var part = parts[i];

        if (part == "") {
          if (i == parts.length - 1 || i == 0) {
            continue;
          }

          for (; depth >= minDepth; depth--) {
            if (match(i - 1, depth)) {
              return true;
            }
          }

          return false;
        } else {
          var next = depth > 0 || depth == 0 && useRoot ? this$1.nodes[depth].type : option && depth >= minDepth ? option.node(depth - minDepth).type : null;

          if (!next || next.name != part && next.groups.indexOf(part) == -1) {
            return false;
          }

          depth--;
        }
      }

      return true;
    };

    return match(parts.length - 1, this.open);
  };

  ParseContext.prototype.textblockFromContext = function textblockFromContext() {
    var $context = this.options.context;

    if ($context) {
      for (var d = $context.depth; d >= 0; d--) {
        var deflt = $context.node(d).contentMatchAt($context.indexAfter(d)).defaultType;

        if (deflt && deflt.isTextblock && deflt.defaultAttrs) {
          return deflt;
        }
      }
    }

    for (var name in this.parser.schema.nodes) {
      var type = this.parser.schema.nodes[name];

      if (type.isTextblock && type.defaultAttrs) {
        return type;
      }
    }
  };

  Object.defineProperties(ParseContext.prototype, prototypeAccessors$6); // Kludge to work around directly nested list nodes produced by some
  // tools and allowed by browsers to mean that the nested list is
  // actually part of the list item above it.

  function normalizeList(dom) {
    for (var child = dom.firstChild, prevItem = null; child; child = child.nextSibling) {
      var name = child.nodeType == 1 ? child.nodeName.toLowerCase() : null;

      if (name && listTags.hasOwnProperty(name) && prevItem) {
        prevItem.appendChild(child);
        child = prevItem;
      } else if (name == "li") {
        prevItem = child;
      } else if (name) {
        prevItem = null;
      }
    }
  } // Apply a CSS selector.


  function matches(dom, selector) {
    return (dom.matches || dom.msMatchesSelector || dom.webkitMatchesSelector || dom.mozMatchesSelector).call(dom, selector);
  } // : (string) → [string]
  // Tokenize a style attribute into property/value pairs.


  function parseStyles(style) {
    var re = /\s*([\w-]+)\s*:\s*([^;]+)/g,
        m,
        result = [];

    while (m = re.exec(style)) {
      result.push(m[1], m[2].trim());
    }

    return result;
  }

  function copy(obj) {
    var copy = {};

    for (var prop in obj) {
      copy[prop] = obj[prop];
    }

    return copy;
  } // DOMOutputSpec:: interface
  // A description of a DOM structure. Can be either a string, which is
  // interpreted as a text node, a DOM node, which is interpreted as
  // itself, or an array.
  //
  // An array describes a DOM element. The first value in the array
  // should be a string—the name of the DOM element. If the second
  // element is plain object, it is interpreted as a set of attributes
  // for the element. Any elements after that (including the 2nd if it's
  // not an attribute object) are interpreted as children of the DOM
  // elements, and must either be valid `DOMOutputSpec` values, or the
  // number zero.
  //
  // The number zero (pronounced “hole”) is used to indicate the place
  // where a node's child nodes should be inserted. If it occurs in an
  // output spec, it should be the only child element in its parent
  // node.
  // ::- A DOM serializer knows how to convert ProseMirror nodes and
  // marks of various types to DOM nodes.


  var DOMSerializer = function DOMSerializer(nodes, marks) {
    // :: Object<(node: Node) → DOMOutputSpec>
    // The node serialization functions.
    this.nodes = nodes || {}; // :: Object<?(mark: Mark, inline: bool) → DOMOutputSpec>
    // The mark serialization functions.

    this.marks = marks || {};
  }; // :: (Fragment, ?Object) → dom.DocumentFragment
  // Serialize the content of this fragment to a DOM fragment. When
  // not in the browser, the `document` option, containing a DOM
  // document, should be passed so that the serializer can create
  // nodes.


  DOMSerializer.prototype.serializeFragment = function serializeFragment(fragment, options, target) {
    var this$1 = this;
    if (options === void 0) options = {};

    if (!target) {
      target = doc(options).createDocumentFragment();
    }

    var top = target,
        active = null;
    fragment.forEach(function (node) {
      if (active || node.marks.length) {
        if (!active) {
          active = [];
        }

        var keep = 0,
            rendered = 0;

        while (keep < active.length && rendered < node.marks.length) {
          var next = node.marks[rendered];

          if (!this$1.marks[next.type.name]) {
            rendered++;
            continue;
          }

          if (!next.eq(active[keep]) || next.type.spec.spanning === false) {
            break;
          }

          keep += 2;
          rendered++;
        }

        while (keep < active.length) {
          top = active.pop();
          active.pop();
        }

        while (rendered < node.marks.length) {
          var add = node.marks[rendered++];
          var markDOM = this$1.serializeMark(add, node.isInline, options);

          if (markDOM) {
            active.push(add, top);
            top.appendChild(markDOM.dom);
            top = markDOM.contentDOM || markDOM.dom;
          }
        }
      }

      top.appendChild(this$1.serializeNode(node, options));
    });
    return target;
  }; // :: (Node, ?Object) → dom.Node
  // Serialize this node to a DOM node. This can be useful when you
  // need to serialize a part of a document, as opposed to the whole
  // document. To serialize a whole document, use
  // [`serializeFragment`](#model.DOMSerializer.serializeFragment) on
  // its [content](#model.Node.content).


  DOMSerializer.prototype.serializeNode = function serializeNode(node, options) {
    if (options === void 0) options = {};
    var ref = DOMSerializer.renderSpec(doc(options), this.nodes[node.type.name](node));
    var dom = ref.dom;
    var contentDOM = ref.contentDOM;

    if (contentDOM) {
      if (node.isLeaf) {
        throw new RangeError("Content hole not allowed in a leaf node spec");
      }

      if (options.onContent) {
        options.onContent(node, contentDOM, options);
      } else {
        this.serializeFragment(node.content, options, contentDOM);
      }
    }

    return dom;
  };

  DOMSerializer.prototype.serializeNodeAndMarks = function serializeNodeAndMarks(node, options) {
    if (options === void 0) options = {};
    var dom = this.serializeNode(node, options);

    for (var i = node.marks.length - 1; i >= 0; i--) {
      var wrap = this.serializeMark(node.marks[i], node.isInline, options);

      if (wrap) {
        (wrap.contentDOM || wrap.dom).appendChild(dom);
        dom = wrap.dom;
      }
    }

    return dom;
  };

  DOMSerializer.prototype.serializeMark = function serializeMark(mark, inline, options) {
    if (options === void 0) options = {};
    var toDOM = this.marks[mark.type.name];
    return toDOM && DOMSerializer.renderSpec(doc(options), toDOM(mark, inline));
  }; // :: (dom.Document, DOMOutputSpec) → {dom: dom.Node, contentDOM: ?dom.Node}
  // Render an [output spec](#model.DOMOutputSpec) to a DOM node. If
  // the spec has a hole (zero) in it, `contentDOM` will point at the
  // node with the hole.


  DOMSerializer.renderSpec = function renderSpec(doc, structure) {
    if (typeof structure == "string") {
      return {
        dom: doc.createTextNode(structure)
      };
    }

    if (structure.nodeType != null) {
      return {
        dom: structure
      };
    }

    var dom = doc.createElement(structure[0]),
        contentDOM = null;
    var attrs = structure[1],
        start = 1;

    if (attrs && typeof attrs == "object" && attrs.nodeType == null && !Array.isArray(attrs)) {
      start = 2;

      for (var name in attrs) {
        if (attrs[name] != null) {
          dom.setAttribute(name, attrs[name]);
        }
      }
    }

    for (var i = start; i < structure.length; i++) {
      var child = structure[i];

      if (child === 0) {
        if (i < structure.length - 1 || i > start) {
          throw new RangeError("Content hole must be the only child of its parent node");
        }

        return {
          dom: dom,
          contentDOM: dom
        };
      } else {
        var ref = DOMSerializer.renderSpec(doc, child);
        var inner = ref.dom;
        var innerContent = ref.contentDOM;
        dom.appendChild(inner);

        if (innerContent) {
          if (contentDOM) {
            throw new RangeError("Multiple content holes");
          }

          contentDOM = innerContent;
        }
      }
    }

    return {
      dom: dom,
      contentDOM: contentDOM
    };
  }; // :: (Schema) → DOMSerializer
  // Build a serializer using the [`toDOM`](#model.NodeSpec.toDOM)
  // properties in a schema's node and mark specs.


  DOMSerializer.fromSchema = function fromSchema(schema) {
    return schema.cached.domSerializer || (schema.cached.domSerializer = new DOMSerializer(this.nodesFromSchema(schema), this.marksFromSchema(schema)));
  }; // : (Schema) → Object<(node: Node) → DOMOutputSpec>
  // Gather the serializers in a schema's node specs into an object.
  // This can be useful as a base to build a custom serializer from.


  DOMSerializer.nodesFromSchema = function nodesFromSchema(schema) {
    var result = gatherToDOM(schema.nodes);

    if (!result.text) {
      result.text = function (node) {
        return node.text;
      };
    }

    return result;
  }; // : (Schema) → Object<(mark: Mark) → DOMOutputSpec>
  // Gather the serializers in a schema's mark specs into an object.


  DOMSerializer.marksFromSchema = function marksFromSchema(schema) {
    return gatherToDOM(schema.marks);
  };

  function gatherToDOM(obj) {
    var result = {};

    for (var name in obj) {
      var toDOM = obj[name].spec.toDOM;

      if (toDOM) {
        result[name] = toDOM;
      }
    }

    return result;
  }

  function doc(options) {
    // declare global: window
    return options.document || window.document;
  }

  // There are several things that positions can be mapped through.
  // Such objects conform to this interface.
  //
  //   map:: (pos: number, assoc: ?number) → number
  //   Map a position through this object. When given, `assoc` (should
  //   be -1 or 1, defaults to 1) determines with which side the
  //   position is associated, which determines in which direction to
  //   move when a chunk of content is inserted at the mapped position.
  //
  //   mapResult:: (pos: number, assoc: ?number) → MapResult
  //   Map a position, and return an object containing additional
  //   information about the mapping. The result's `deleted` field tells
  //   you whether the position was deleted (completely enclosed in a
  //   replaced range) during the mapping. When content on only one side
  //   is deleted, the position itself is only considered deleted when
  //   `assoc` points in the direction of the deleted content.
  // Recovery values encode a range index and an offset. They are
  // represented as numbers, because tons of them will be created when
  // mapping, for example, a large number of decorations. The number's
  // lower 16 bits provide the index, the remaining bits the offset.
  //
  // Note: We intentionally don't use bit shift operators to en- and
  // decode these, since those clip to 32 bits, which we might in rare
  // cases want to overflow. A 64-bit float can represent 48-bit
  // integers precisely.

  var lower16 = 0xffff;
  var factor16 = Math.pow(2, 16);

  function makeRecover(index, offset) {
    return index + offset * factor16;
  }

  function recoverIndex(value) {
    return value & lower16;
  }

  function recoverOffset(value) {
    return (value - (value & lower16)) / factor16;
  } // ::- An object representing a mapped position with extra
  // information.


  var MapResult = function MapResult(pos, deleted, recover) {
    if (deleted === void 0) deleted = false;
    if (recover === void 0) recover = null; // :: number The mapped version of the position.

    this.pos = pos; // :: bool Tells you whether the position was deleted, that is,
    // whether the step removed its surroundings from the document.

    this.deleted = deleted;
    this.recover = recover;
  }; // :: class extends Mappable
  // A map describing the deletions and insertions made by a step, which
  // can be used to find the correspondence between positions in the
  // pre-step version of a document and the same position in the
  // post-step version.


  var StepMap = function StepMap(ranges, inverted) {
    if (inverted === void 0) inverted = false;
    this.ranges = ranges;
    this.inverted = inverted;
  };

  StepMap.prototype.recover = function recover(value) {
    var diff = 0,
        index = recoverIndex(value);

    if (!this.inverted) {
      for (var i = 0; i < index; i++) {
        diff += this.ranges[i * 3 + 2] - this.ranges[i * 3 + 1];
      }
    }

    return this.ranges[index * 3] + diff + recoverOffset(value);
  }; // : (number, ?number) → MapResult


  StepMap.prototype.mapResult = function mapResult(pos, assoc) {
    if (assoc === void 0) assoc = 1;
    return this._map(pos, assoc, false);
  }; // : (number, ?number) → number


  StepMap.prototype.map = function map(pos, assoc) {
    if (assoc === void 0) assoc = 1;
    return this._map(pos, assoc, true);
  };

  StepMap.prototype._map = function _map(pos, assoc, simple) {
    var diff = 0,
        oldIndex = this.inverted ? 2 : 1,
        newIndex = this.inverted ? 1 : 2;

    for (var i = 0; i < this.ranges.length; i += 3) {
      var start = this.ranges[i] - (this.inverted ? diff : 0);

      if (start > pos) {
        break;
      }

      var oldSize = this.ranges[i + oldIndex],
          newSize = this.ranges[i + newIndex],
          end = start + oldSize;

      if (pos <= end) {
        var side = !oldSize ? assoc : pos == start ? -1 : pos == end ? 1 : assoc;
        var result = start + diff + (side < 0 ? 0 : newSize);

        if (simple) {
          return result;
        }

        var recover = makeRecover(i / 3, pos - start);
        return new MapResult(result, assoc < 0 ? pos != start : pos != end, recover);
      }

      diff += newSize - oldSize;
    }

    return simple ? pos + diff : new MapResult(pos + diff);
  };

  StepMap.prototype.touches = function touches(pos, recover) {
    var diff = 0,
        index = recoverIndex(recover);
    var oldIndex = this.inverted ? 2 : 1,
        newIndex = this.inverted ? 1 : 2;

    for (var i = 0; i < this.ranges.length; i += 3) {
      var start = this.ranges[i] - (this.inverted ? diff : 0);

      if (start > pos) {
        break;
      }

      var oldSize = this.ranges[i + oldIndex],
          end = start + oldSize;

      if (pos <= end && i == index * 3) {
        return true;
      }

      diff += this.ranges[i + newIndex] - oldSize;
    }

    return false;
  }; // :: ((oldStart: number, oldEnd: number, newStart: number, newEnd: number))
  // Calls the given function on each of the changed ranges included in
  // this map.


  StepMap.prototype.forEach = function forEach(f) {
    var oldIndex = this.inverted ? 2 : 1,
        newIndex = this.inverted ? 1 : 2;

    for (var i = 0, diff = 0; i < this.ranges.length; i += 3) {
      var start = this.ranges[i],
          oldStart = start - (this.inverted ? diff : 0),
          newStart = start + (this.inverted ? 0 : diff);
      var oldSize = this.ranges[i + oldIndex],
          newSize = this.ranges[i + newIndex];
      f(oldStart, oldStart + oldSize, newStart, newStart + newSize);
      diff += newSize - oldSize;
    }
  }; // :: () → StepMap
  // Create an inverted version of this map. The result can be used to
  // map positions in the post-step document to the pre-step document.


  StepMap.prototype.invert = function invert() {
    return new StepMap(this.ranges, !this.inverted);
  };

  StepMap.prototype.toString = function toString() {
    return (this.inverted ? "-" : "") + JSON.stringify(this.ranges);
  }; // :: (n: number) → StepMap
  // Create a map that moves all positions by offset `n` (which may be
  // negative). This can be useful when applying steps meant for a
  // sub-document to a larger document, or vice-versa.


  StepMap.offset = function offset(n) {
    return n == 0 ? StepMap.empty : new StepMap(n < 0 ? [0, -n, 0] : [0, 0, n]);
  };

  StepMap.empty = new StepMap([]); // :: class extends Mappable
  // A mapping represents a pipeline of zero or more [step
  // maps](#transform.StepMap). It has special provisions for losslessly
  // handling mapping positions through a series of steps in which some
  // steps are inverted versions of earlier steps. (This comes up when
  // ‘[rebasing](/docs/guide/#transform.rebasing)’ steps for
  // collaboration or history management.)

  var Mapping = function Mapping(maps, mirror, from, to) {
    // :: [StepMap]
    // The step maps in this mapping.
    this.maps = maps || []; // :: number
    // The starting position in the `maps` array, used when `map` or
    // `mapResult` is called.

    this.from = from || 0; // :: number
    // The end position in the `maps` array.

    this.to = to == null ? this.maps.length : to;
    this.mirror = mirror;
  }; // :: (?number, ?number) → Mapping
  // Create a mapping that maps only through a part of this one.


  Mapping.prototype.slice = function slice(from, to) {
    if (from === void 0) from = 0;
    if (to === void 0) to = this.maps.length;
    return new Mapping(this.maps, this.mirror, from, to);
  };

  Mapping.prototype.copy = function copy() {
    return new Mapping(this.maps.slice(), this.mirror && this.mirror.slice(), this.from, this.to);
  }; // :: (StepMap, ?number)
  // Add a step map to the end of this mapping. If `mirrors` is
  // given, it should be the index of the step map that is the mirror
  // image of this one.


  Mapping.prototype.appendMap = function appendMap(map, mirrors) {
    this.to = this.maps.push(map);

    if (mirrors != null) {
      this.setMirror(this.maps.length - 1, mirrors);
    }
  }; // :: (Mapping)
  // Add all the step maps in a given mapping to this one (preserving
  // mirroring information).


  Mapping.prototype.appendMapping = function appendMapping(mapping) {
    for (var i = 0, startSize = this.maps.length; i < mapping.maps.length; i++) {
      var mirr = mapping.getMirror(i);
      this.appendMap(mapping.maps[i], mirr != null && mirr < i ? startSize + mirr : null);
    }
  }; // :: (number) → ?number
  // Finds the offset of the step map that mirrors the map at the
  // given offset, in this mapping (as per the second argument to
  // `appendMap`).


  Mapping.prototype.getMirror = function getMirror(n) {
    if (this.mirror) {
      for (var i = 0; i < this.mirror.length; i++) {
        if (this.mirror[i] == n) {
          return this.mirror[i + (i % 2 ? -1 : 1)];
        }
      }
    }
  };

  Mapping.prototype.setMirror = function setMirror(n, m) {
    if (!this.mirror) {
      this.mirror = [];
    }

    this.mirror.push(n, m);
  }; // :: (Mapping)
  // Append the inverse of the given mapping to this one.


  Mapping.prototype.appendMappingInverted = function appendMappingInverted(mapping) {
    for (var i = mapping.maps.length - 1, totalSize = this.maps.length + mapping.maps.length; i >= 0; i--) {
      var mirr = mapping.getMirror(i);
      this.appendMap(mapping.maps[i].invert(), mirr != null && mirr > i ? totalSize - mirr - 1 : null);
    }
  }; // :: () → Mapping
  // Create an inverted version of this mapping.


  Mapping.prototype.invert = function invert() {
    var inverse = new Mapping();
    inverse.appendMappingInverted(this);
    return inverse;
  }; // : (number, ?number) → number
  // Map a position through this mapping.


  Mapping.prototype.map = function map(pos, assoc) {
    if (assoc === void 0) assoc = 1;

    if (this.mirror) {
      return this._map(pos, assoc, true);
    }

    for (var i = this.from; i < this.to; i++) {
      pos = this.maps[i].map(pos, assoc);
    }

    return pos;
  }; // : (number, ?number) → MapResult
  // Map a position through this mapping, returning a mapping
  // result.


  Mapping.prototype.mapResult = function mapResult(pos, assoc) {
    if (assoc === void 0) assoc = 1;
    return this._map(pos, assoc, false);
  };

  Mapping.prototype._map = function _map(pos, assoc, simple) {
    var deleted = false,
        recoverables = null;

    for (var i = this.from; i < this.to; i++) {
      var map = this.maps[i],
          rec = recoverables && recoverables[i];

      if (rec != null && map.touches(pos, rec)) {
        pos = map.recover(rec);
        continue;
      }

      var result = map.mapResult(pos, assoc);

      if (result.recover != null) {
        var corr = this.getMirror(i);

        if (corr != null && corr > i && corr < this.to) {
          if (result.deleted) {
            i = corr;
            pos = this.maps[corr].recover(result.recover);
            continue;
          } else {
            (recoverables || (recoverables = Object.create(null)))[corr] = result.recover;
          }
        }
      }

      if (result.deleted) {
        deleted = true;
      }

      pos = result.pos;
    }

    return simple ? pos : new MapResult(pos, deleted);
  };

  function TransformError(message) {
    var err = Error.call(this, message);
    err.__proto__ = TransformError.prototype;
    return err;
  }

  TransformError.prototype = Object.create(Error.prototype);
  TransformError.prototype.constructor = TransformError;
  TransformError.prototype.name = "TransformError"; // ::- Abstraction to build up and track an array of
  // [steps](#transform.Step) representing a document transformation.
  //
  // Most transforming methods return the `Transform` object itself, so
  // that they can be chained.

  var Transform = function Transform(doc) {
    // :: Node
    // The current document (the result of applying the steps in the
    // transform).
    this.doc = doc; // :: [Step]
    // The steps in this transform.

    this.steps = []; // :: [Node]
    // The documents before each of the steps.

    this.docs = []; // :: Mapping
    // A mapping with the maps for each of the steps in this transform.

    this.mapping = new Mapping();
  };

  var prototypeAccessors$7 = {
    before: {
      configurable: true
    },
    docChanged: {
      configurable: true
    }
  }; // :: Node The starting document.

  prototypeAccessors$7.before.get = function () {
    return this.docs.length ? this.docs[0] : this.doc;
  }; // :: (step: Step) → this
  // Apply a new step in this transform, saving the result. Throws an
  // error when the step fails.


  Transform.prototype.step = function step(object) {
    var result = this.maybeStep(object);

    if (result.failed) {
      throw new TransformError(result.failed);
    }

    return this;
  }; // :: (Step) → StepResult
  // Try to apply a step in this transformation, ignoring it if it
  // fails. Returns the step result.


  Transform.prototype.maybeStep = function maybeStep(step) {
    var result = step.apply(this.doc);

    if (!result.failed) {
      this.addStep(step, result.doc);
    }

    return result;
  }; // :: bool
  // True when the document has been changed (when there are any
  // steps).


  prototypeAccessors$7.docChanged.get = function () {
    return this.steps.length > 0;
  };

  Transform.prototype.addStep = function addStep(step, doc) {
    this.docs.push(this.doc);
    this.steps.push(step);
    this.mapping.appendMap(step.getMap());
    this.doc = doc;
  };

  Object.defineProperties(Transform.prototype, prototypeAccessors$7);

  function mustOverride() {
    throw new Error("Override me");
  }

  var stepsByID = Object.create(null); // ::- A step object represents an atomic change. It generally applies
  // only to the document it was created for, since the positions
  // stored in it will only make sense for that document.
  //
  // New steps are defined by creating classes that extend `Step`,
  // overriding the `apply`, `invert`, `map`, `getMap` and `fromJSON`
  // methods, and registering your class with a unique
  // JSON-serialization identifier using
  // [`Step.jsonID`](#transform.Step^jsonID).

  var Step = function Step() {};

  Step.prototype.apply = function apply(_doc) {
    return mustOverride();
  }; // :: () → StepMap
  // Get the step map that represents the changes made by this step,
  // and which can be used to transform between positions in the old
  // and the new document.


  Step.prototype.getMap = function getMap() {
    return StepMap.empty;
  }; // :: (doc: Node) → Step
  // Create an inverted version of this step. Needs the document as it
  // was before the step as argument.


  Step.prototype.invert = function invert(_doc) {
    return mustOverride();
  }; // :: (mapping: Mappable) → ?Step
  // Map this step through a mappable thing, returning either a
  // version of that step with its positions adjusted, or `null` if
  // the step was entirely deleted by the mapping.


  Step.prototype.map = function map(_mapping) {
    return mustOverride();
  }; // :: (other: Step) → ?Step
  // Try to merge this step with another one, to be applied directly
  // after it. Returns the merged step when possible, null if the
  // steps can't be merged.


  Step.prototype.merge = function merge(_other) {
    return null;
  }; // :: () → Object
  // Create a JSON-serializeable representation of this step. When
  // defining this for a custom subclass, make sure the result object
  // includes the step type's [JSON id](#transform.Step^jsonID) under
  // the `stepType` property.


  Step.prototype.toJSON = function toJSON() {
    return mustOverride();
  }; // :: (Schema, Object) → Step
  // Deserialize a step from its JSON representation. Will call
  // through to the step class' own implementation of this method.


  Step.fromJSON = function fromJSON(schema, json) {
    if (!json || !json.stepType) {
      throw new RangeError("Invalid input for Step.fromJSON");
    }

    var type = stepsByID[json.stepType];

    if (!type) {
      throw new RangeError("No step type " + json.stepType + " defined");
    }

    return type.fromJSON(schema, json);
  }; // :: (string, constructor<Step>)
  // To be able to serialize steps to JSON, each step needs a string
  // ID to attach to its JSON representation. Use this method to
  // register an ID for your step classes. Try to pick something
  // that's unlikely to clash with steps from other modules.


  Step.jsonID = function jsonID(id, stepClass) {
    if (id in stepsByID) {
      throw new RangeError("Duplicate use of step JSON ID " + id);
    }

    stepsByID[id] = stepClass;
    stepClass.prototype.jsonID = id;
    return stepClass;
  }; // ::- The result of [applying](#transform.Step.apply) a step. Contains either a
  // new document or a failure value.


  var StepResult = function StepResult(doc, failed) {
    // :: ?Node The transformed document.
    this.doc = doc; // :: ?string Text providing information about a failed step.

    this.failed = failed;
  }; // :: (Node) → StepResult
  // Create a successful step result.


  StepResult.ok = function ok(doc) {
    return new StepResult(doc, null);
  }; // :: (string) → StepResult
  // Create a failed step result.


  StepResult.fail = function fail(message) {
    return new StepResult(null, message);
  }; // :: (Node, number, number, Slice) → StepResult
  // Call [`Node.replace`](#model.Node.replace) with the given
  // arguments. Create a successful result if it succeeds, and a
  // failed one if it throws a `ReplaceError`.


  StepResult.fromReplace = function fromReplace(doc, from, to, slice) {
    try {
      return StepResult.ok(doc.replace(from, to, slice));
    } catch (e) {
      if (e instanceof ReplaceError) {
        return StepResult.fail(e.message);
      }

      throw e;
    }
  }; // ::- Replace a part of the document with a slice of new content.


  var ReplaceStep =
  /*@__PURE__*/
  function (Step) {
    function ReplaceStep(from, to, slice, structure) {
      Step.call(this);
      this.from = from;
      this.to = to;
      this.slice = slice;
      this.structure = !!structure;
    }

    if (Step) ReplaceStep.__proto__ = Step;
    ReplaceStep.prototype = Object.create(Step && Step.prototype);
    ReplaceStep.prototype.constructor = ReplaceStep;

    ReplaceStep.prototype.apply = function apply(doc) {
      if (this.structure && contentBetween(doc, this.from, this.to)) {
        return StepResult.fail("Structure replace would overwrite content");
      }

      return StepResult.fromReplace(doc, this.from, this.to, this.slice);
    };

    ReplaceStep.prototype.getMap = function getMap() {
      return new StepMap([this.from, this.to - this.from, this.slice.size]);
    };

    ReplaceStep.prototype.invert = function invert(doc) {
      return new ReplaceStep(this.from, this.from + this.slice.size, doc.slice(this.from, this.to));
    };

    ReplaceStep.prototype.map = function map(mapping) {
      var from = mapping.mapResult(this.from, 1),
          to = mapping.mapResult(this.to, -1);

      if (from.deleted && to.deleted) {
        return null;
      }

      return new ReplaceStep(from.pos, Math.max(from.pos, to.pos), this.slice);
    };

    ReplaceStep.prototype.merge = function merge(other) {
      if (!(other instanceof ReplaceStep) || other.structure != this.structure) {
        return null;
      }

      if (this.from + this.slice.size == other.from && !this.slice.openEnd && !other.slice.openStart) {
        var slice = this.slice.size + other.slice.size == 0 ? Slice.empty : new Slice(this.slice.content.append(other.slice.content), this.slice.openStart, other.slice.openEnd);
        return new ReplaceStep(this.from, this.to + (other.to - other.from), slice, this.structure);
      } else if (other.to == this.from && !this.slice.openStart && !other.slice.openEnd) {
        var slice$1 = this.slice.size + other.slice.size == 0 ? Slice.empty : new Slice(other.slice.content.append(this.slice.content), other.slice.openStart, this.slice.openEnd);
        return new ReplaceStep(other.from, this.to, slice$1, this.structure);
      } else {
        return null;
      }
    };

    ReplaceStep.prototype.toJSON = function toJSON() {
      var json = {
        stepType: "replace",
        from: this.from,
        to: this.to
      };

      if (this.slice.size) {
        json.slice = this.slice.toJSON();
      }

      if (this.structure) {
        json.structure = true;
      }

      return json;
    };

    ReplaceStep.fromJSON = function fromJSON(schema, json) {
      if (typeof json.from != "number" || typeof json.to != "number") {
        throw new RangeError("Invalid input for ReplaceStep.fromJSON");
      }

      return new ReplaceStep(json.from, json.to, Slice.fromJSON(schema, json.slice), !!json.structure);
    };

    return ReplaceStep;
  }(Step);

  Step.jsonID("replace", ReplaceStep); // ::- Replace a part of the document with a slice of content, but
  // preserve a range of the replaced content by moving it into the
  // slice.

  var ReplaceAroundStep =
  /*@__PURE__*/
  function (Step) {
    function ReplaceAroundStep(from, to, gapFrom, gapTo, slice, insert, structure) {
      Step.call(this);
      this.from = from;
      this.to = to;
      this.gapFrom = gapFrom;
      this.gapTo = gapTo;
      this.slice = slice;
      this.insert = insert;
      this.structure = !!structure;
    }

    if (Step) ReplaceAroundStep.__proto__ = Step;
    ReplaceAroundStep.prototype = Object.create(Step && Step.prototype);
    ReplaceAroundStep.prototype.constructor = ReplaceAroundStep;

    ReplaceAroundStep.prototype.apply = function apply(doc) {
      if (this.structure && (contentBetween(doc, this.from, this.gapFrom) || contentBetween(doc, this.gapTo, this.to))) {
        return StepResult.fail("Structure gap-replace would overwrite content");
      }

      var gap = doc.slice(this.gapFrom, this.gapTo);

      if (gap.openStart || gap.openEnd) {
        return StepResult.fail("Gap is not a flat range");
      }

      var inserted = this.slice.insertAt(this.insert, gap.content);

      if (!inserted) {
        return StepResult.fail("Content does not fit in gap");
      }

      return StepResult.fromReplace(doc, this.from, this.to, inserted);
    };

    ReplaceAroundStep.prototype.getMap = function getMap() {
      return new StepMap([this.from, this.gapFrom - this.from, this.insert, this.gapTo, this.to - this.gapTo, this.slice.size - this.insert]);
    };

    ReplaceAroundStep.prototype.invert = function invert(doc) {
      var gap = this.gapTo - this.gapFrom;
      return new ReplaceAroundStep(this.from, this.from + this.slice.size + gap, this.from + this.insert, this.from + this.insert + gap, doc.slice(this.from, this.to).removeBetween(this.gapFrom - this.from, this.gapTo - this.from), this.gapFrom - this.from, this.structure);
    };

    ReplaceAroundStep.prototype.map = function map(mapping) {
      var from = mapping.mapResult(this.from, 1),
          to = mapping.mapResult(this.to, -1);
      var gapFrom = mapping.map(this.gapFrom, -1),
          gapTo = mapping.map(this.gapTo, 1);

      if (from.deleted && to.deleted || gapFrom < from.pos || gapTo > to.pos) {
        return null;
      }

      return new ReplaceAroundStep(from.pos, to.pos, gapFrom, gapTo, this.slice, this.insert, this.structure);
    };

    ReplaceAroundStep.prototype.toJSON = function toJSON() {
      var json = {
        stepType: "replaceAround",
        from: this.from,
        to: this.to,
        gapFrom: this.gapFrom,
        gapTo: this.gapTo,
        insert: this.insert
      };

      if (this.slice.size) {
        json.slice = this.slice.toJSON();
      }

      if (this.structure) {
        json.structure = true;
      }

      return json;
    };

    ReplaceAroundStep.fromJSON = function fromJSON(schema, json) {
      if (typeof json.from != "number" || typeof json.to != "number" || typeof json.gapFrom != "number" || typeof json.gapTo != "number" || typeof json.insert != "number") {
        throw new RangeError("Invalid input for ReplaceAroundStep.fromJSON");
      }

      return new ReplaceAroundStep(json.from, json.to, json.gapFrom, json.gapTo, Slice.fromJSON(schema, json.slice), json.insert, !!json.structure);
    };

    return ReplaceAroundStep;
  }(Step);

  Step.jsonID("replaceAround", ReplaceAroundStep);

  function contentBetween(doc, from, to) {
    var $from = doc.resolve(from),
        dist = to - from,
        depth = $from.depth;

    while (dist > 0 && depth > 0 && $from.indexAfter(depth) == $from.node(depth).childCount) {
      depth--;
      dist--;
    }

    if (dist > 0) {
      var next = $from.node(depth).maybeChild($from.indexAfter(depth));

      while (dist > 0) {
        if (!next || next.isLeaf) {
          return true;
        }

        next = next.firstChild;
        dist--;
      }
    }

    return false;
  }

  function canCut(node, start, end) {
    return (start == 0 || node.canReplace(start, node.childCount)) && (end == node.childCount || node.canReplace(0, end));
  } // :: (NodeRange) → ?number
  // Try to find a target depth to which the content in the given range
  // can be lifted. Will not go across
  // [isolating](#model.NodeSpec.isolating) parent nodes.


  function liftTarget(range) {
    var parent = range.parent;
    var content = parent.content.cutByIndex(range.startIndex, range.endIndex);

    for (var depth = range.depth;; --depth) {
      var node = range.$from.node(depth);
      var index = range.$from.index(depth),
          endIndex = range.$to.indexAfter(depth);

      if (depth < range.depth && node.canReplace(index, endIndex, content)) {
        return depth;
      }

      if (depth == 0 || node.type.spec.isolating || !canCut(node, index, endIndex)) {
        break;
      }
    }
  } // :: (NodeRange, number) → this
  // Split the content in the given range off from its parent, if there
  // is sibling content before or after it, and move it up the tree to
  // the depth specified by `target`. You'll probably want to use
  // [`liftTarget`](#transform.liftTarget) to compute `target`, to make
  // sure the lift is valid.


  Transform.prototype.lift = function (range, target) {
    var $from = range.$from;
    var $to = range.$to;
    var depth = range.depth;
    var gapStart = $from.before(depth + 1),
        gapEnd = $to.after(depth + 1);
    var start = gapStart,
        end = gapEnd;
    var before = Fragment.empty,
        openStart = 0;

    for (var d = depth, splitting = false; d > target; d--) {
      if (splitting || $from.index(d) > 0) {
        splitting = true;
        before = Fragment.from($from.node(d).copy(before));
        openStart++;
      } else {
        start--;
      }
    }

    var after = Fragment.empty,
        openEnd = 0;

    for (var d$1 = depth, splitting$1 = false; d$1 > target; d$1--) {
      if (splitting$1 || $to.after(d$1 + 1) < $to.end(d$1)) {
        splitting$1 = true;
        after = Fragment.from($to.node(d$1).copy(after));
        openEnd++;
      } else {
        end++;
      }
    }

    return this.step(new ReplaceAroundStep(start, end, gapStart, gapEnd, new Slice(before.append(after), openStart, openEnd), before.size - openStart, true));
  }; // :: (NodeRange, NodeType, ?Object, ?NodeRange) → ?[{type: NodeType, attrs: ?Object}]
  // Try to find a valid way to wrap the content in the given range in a
  // node of the given type. May introduce extra nodes around and inside
  // the wrapper node, if necessary. Returns null if no valid wrapping
  // could be found. When `innerRange` is given, that range's content is
  // used as the content to fit into the wrapping, instead of the
  // content of `range`.


  function findWrapping(range, nodeType, attrs, innerRange) {
    if (innerRange === void 0) innerRange = range;
    var around = findWrappingOutside(range, nodeType);
    var inner = around && findWrappingInside(innerRange, nodeType);

    if (!inner) {
      return null;
    }

    return around.map(withAttrs).concat({
      type: nodeType,
      attrs: attrs
    }).concat(inner.map(withAttrs));
  }

  function withAttrs(type) {
    return {
      type: type,
      attrs: null
    };
  }

  function findWrappingOutside(range, type) {
    var parent = range.parent;
    var startIndex = range.startIndex;
    var endIndex = range.endIndex;
    var around = parent.contentMatchAt(startIndex).findWrapping(type);

    if (!around) {
      return null;
    }

    var outer = around.length ? around[0] : type;
    return parent.canReplaceWith(startIndex, endIndex, outer) ? around : null;
  }

  function findWrappingInside(range, type) {
    var parent = range.parent;
    var startIndex = range.startIndex;
    var endIndex = range.endIndex;
    var inner = parent.child(startIndex);
    var inside = type.contentMatch.findWrapping(inner.type);

    if (!inside) {
      return null;
    }

    var lastType = inside.length ? inside[inside.length - 1] : type;
    var innerMatch = lastType.contentMatch;

    for (var i = startIndex; innerMatch && i < endIndex; i++) {
      innerMatch = innerMatch.matchType(parent.child(i).type);
    }

    if (!innerMatch || !innerMatch.validEnd) {
      return null;
    }

    return inside;
  } // :: (NodeRange, [{type: NodeType, attrs: ?Object}]) → this
  // Wrap the given [range](#model.NodeRange) in the given set of wrappers.
  // The wrappers are assumed to be valid in this position, and should
  // probably be computed with [`findWrapping`](#transform.findWrapping).


  Transform.prototype.wrap = function (range, wrappers) {
    var content = Fragment.empty;

    for (var i = wrappers.length - 1; i >= 0; i--) {
      content = Fragment.from(wrappers[i].type.create(wrappers[i].attrs, content));
    }

    var start = range.start,
        end = range.end;
    return this.step(new ReplaceAroundStep(start, end, start, end, new Slice(content, 0, 0), wrappers.length, true));
  }; // :: (number, ?number, NodeType, ?Object) → this
  // Set the type of all textblocks (partly) between `from` and `to` to
  // the given node type with the given attributes.


  Transform.prototype.setBlockType = function (from, to, type, attrs) {
    var this$1 = this;
    if (to === void 0) to = from;

    if (!type.isTextblock) {
      throw new RangeError("Type given to setBlockType should be a textblock");
    }

    var mapFrom = this.steps.length;
    this.doc.nodesBetween(from, to, function (node, pos) {
      if (node.isTextblock && !node.hasMarkup(type, attrs) && canChangeType(this$1.doc, this$1.mapping.slice(mapFrom).map(pos), type)) {
        // Ensure all markup that isn't allowed in the new node type is cleared
        this$1.clearIncompatible(this$1.mapping.slice(mapFrom).map(pos, 1), type);
        var mapping = this$1.mapping.slice(mapFrom);
        var startM = mapping.map(pos, 1),
            endM = mapping.map(pos + node.nodeSize, 1);
        this$1.step(new ReplaceAroundStep(startM, endM, startM + 1, endM - 1, new Slice(Fragment.from(type.create(attrs, null, node.marks)), 0, 0), 1, true));
        return false;
      }
    });
    return this;
  };

  function canChangeType(doc, pos, type) {
    var $pos = doc.resolve(pos),
        index = $pos.index();
    return $pos.parent.canReplaceWith(index, index + 1, type);
  } // :: (number, ?NodeType, ?Object, ?[Mark]) → this
  // Change the type, attributes, and/or marks of the node at `pos`.
  // When `type` isn't given, the existing node type is preserved,


  Transform.prototype.setNodeMarkup = function (pos, type, attrs, marks) {
    var node = this.doc.nodeAt(pos);

    if (!node) {
      throw new RangeError("No node at given position");
    }

    if (!type) {
      type = node.type;
    }

    var newNode = type.create(attrs, null, marks || node.marks);

    if (node.isLeaf) {
      return this.replaceWith(pos, pos + node.nodeSize, newNode);
    }

    if (!type.validContent(node.content)) {
      throw new RangeError("Invalid content for node type " + type.name);
    }

    return this.step(new ReplaceAroundStep(pos, pos + node.nodeSize, pos + 1, pos + node.nodeSize - 1, new Slice(Fragment.from(newNode), 0, 0), 1, true));
  }; // :: (Node, number, number, ?[?{type: NodeType, attrs: ?Object}]) → bool
  // Check whether splitting at the given position is allowed.


  function canSplit(doc, pos, depth, typesAfter) {
    if (depth === void 0) depth = 1;
    var $pos = doc.resolve(pos),
        base = $pos.depth - depth;
    var innerType = typesAfter && typesAfter[typesAfter.length - 1] || $pos.parent;

    if (base < 0 || $pos.parent.type.spec.isolating || !$pos.parent.canReplace($pos.index(), $pos.parent.childCount) || !innerType.type.validContent($pos.parent.content.cutByIndex($pos.index(), $pos.parent.childCount))) {
      return false;
    }

    for (var d = $pos.depth - 1, i = depth - 2; d > base; d--, i--) {
      var node = $pos.node(d),
          index$1 = $pos.index(d);

      if (node.type.spec.isolating) {
        return false;
      }

      var rest = node.content.cutByIndex(index$1, node.childCount);
      var after = typesAfter && typesAfter[i] || node;

      if (after != node) {
        rest = rest.replaceChild(0, after.type.create(after.attrs));
      }

      if (!node.canReplace(index$1 + 1, node.childCount) || !after.type.validContent(rest)) {
        return false;
      }
    }

    var index = $pos.indexAfter(base);
    var baseType = typesAfter && typesAfter[0];
    return $pos.node(base).canReplaceWith(index, index, baseType ? baseType.type : $pos.node(base + 1).type);
  } // :: (number, ?number, ?[?{type: NodeType, attrs: ?Object}]) → this
  // Split the node at the given position, and optionally, if `depth` is
  // greater than one, any number of nodes above that. By default, the
  // parts split off will inherit the node type of the original node.
  // This can be changed by passing an array of types and attributes to
  // use after the split.


  Transform.prototype.split = function (pos, depth, typesAfter) {
    if (depth === void 0) depth = 1;
    var $pos = this.doc.resolve(pos),
        before = Fragment.empty,
        after = Fragment.empty;

    for (var d = $pos.depth, e = $pos.depth - depth, i = depth - 1; d > e; d--, i--) {
      before = Fragment.from($pos.node(d).copy(before));
      var typeAfter = typesAfter && typesAfter[i];
      after = Fragment.from(typeAfter ? typeAfter.type.create(typeAfter.attrs, after) : $pos.node(d).copy(after));
    }

    return this.step(new ReplaceStep(pos, pos, new Slice(before.append(after), depth, depth), true));
  }; // :: (Node, number) → bool
  // Test whether the blocks before and after a given position can be
  // joined.


  function canJoin(doc, pos) {
    var $pos = doc.resolve(pos),
        index = $pos.index();
    return joinable$1($pos.nodeBefore, $pos.nodeAfter) && $pos.parent.canReplace(index, index + 1);
  }

  function joinable$1(a, b) {
    return a && b && !a.isLeaf && a.canAppend(b);
  } // :: (Node, number, ?number) → ?number
  // Find an ancestor of the given position that can be joined to the
  // block before (or after if `dir` is positive). Returns the joinable
  // point, if any.


  function joinPoint(doc, pos, dir) {
    if (dir === void 0) dir = -1;
    var $pos = doc.resolve(pos);

    for (var d = $pos.depth;; d--) {
      var before = void 0,
          after = void 0;

      if (d == $pos.depth) {
        before = $pos.nodeBefore;
        after = $pos.nodeAfter;
      } else if (dir > 0) {
        before = $pos.node(d + 1);
        after = $pos.node(d).maybeChild($pos.index(d) + 1);
      } else {
        before = $pos.node(d).maybeChild($pos.index(d) - 1);
        after = $pos.node(d + 1);
      }

      if (before && !before.isTextblock && joinable$1(before, after)) {
        return pos;
      }

      if (d == 0) {
        break;
      }

      pos = dir < 0 ? $pos.before(d) : $pos.after(d);
    }
  } // :: (number, ?number) → this
  // Join the blocks around the given position. If depth is 2, their
  // last and first siblings are also joined, and so on.


  Transform.prototype.join = function (pos, depth) {
    if (depth === void 0) depth = 1;
    var step = new ReplaceStep(pos - depth, pos + depth, Slice.empty, true);
    return this.step(step);
  }; // :: (Node, number, NodeType) → ?number
  // Try to find a point where a node of the given type can be inserted
  // near `pos`, by searching up the node hierarchy when `pos` itself
  // isn't a valid place but is at the start or end of a node. Return
  // null if no position was found.


  function insertPoint(doc, pos, nodeType) {
    var $pos = doc.resolve(pos);

    if ($pos.parent.canReplaceWith($pos.index(), $pos.index(), nodeType)) {
      return pos;
    }

    if ($pos.parentOffset == 0) {
      for (var d = $pos.depth - 1; d >= 0; d--) {
        var index = $pos.index(d);

        if ($pos.node(d).canReplaceWith(index, index, nodeType)) {
          return $pos.before(d + 1);
        }

        if (index > 0) {
          return null;
        }
      }
    }

    if ($pos.parentOffset == $pos.parent.content.size) {
      for (var d$1 = $pos.depth - 1; d$1 >= 0; d$1--) {
        var index$1 = $pos.indexAfter(d$1);

        if ($pos.node(d$1).canReplaceWith(index$1, index$1, nodeType)) {
          return $pos.after(d$1 + 1);
        }

        if (index$1 < $pos.node(d$1).childCount) {
          return null;
        }
      }
    }
  } // :: (Node, number, Slice) → ?number
  // Finds a position at or around the given position where the given
  // slice can be inserted. Will look at parent nodes' nearest boundary
  // and try there, even if the original position wasn't directly at the
  // start or end of that node. Returns null when no position was found.


  function dropPoint(doc, pos, slice) {
    var $pos = doc.resolve(pos);

    if (!slice.content.size) {
      return pos;
    }

    var content = slice.content;

    for (var i = 0; i < slice.openStart; i++) {
      content = content.firstChild.content;
    }

    for (var pass = 1; pass <= (slice.openStart == 0 && slice.size ? 2 : 1); pass++) {
      for (var d = $pos.depth; d >= 0; d--) {
        var bias = d == $pos.depth ? 0 : $pos.pos <= ($pos.start(d + 1) + $pos.end(d + 1)) / 2 ? -1 : 1;
        var insertPos = $pos.index(d) + (bias > 0 ? 1 : 0);

        if (pass == 1 ? $pos.node(d).canReplace(insertPos, insertPos, content) : $pos.node(d).contentMatchAt(insertPos).findWrapping(content.firstChild.type)) {
          return bias == 0 ? $pos.pos : bias < 0 ? $pos.before(d + 1) : $pos.after(d + 1);
        }
      }
    }

    return null;
  }

  function mapFragment(fragment, f, parent) {
    var mapped = [];

    for (var i = 0; i < fragment.childCount; i++) {
      var child = fragment.child(i);

      if (child.content.size) {
        child = child.copy(mapFragment(child.content, f, child));
      }

      if (child.isInline) {
        child = f(child, parent, i);
      }

      mapped.push(child);
    }

    return Fragment.fromArray(mapped);
  } // ::- Add a mark to all inline content between two positions.


  var AddMarkStep =
  /*@__PURE__*/
  function (Step) {
    function AddMarkStep(from, to, mark) {
      Step.call(this);
      this.from = from;
      this.to = to;
      this.mark = mark;
    }

    if (Step) AddMarkStep.__proto__ = Step;
    AddMarkStep.prototype = Object.create(Step && Step.prototype);
    AddMarkStep.prototype.constructor = AddMarkStep;

    AddMarkStep.prototype.apply = function apply(doc) {
      var this$1 = this;
      var oldSlice = doc.slice(this.from, this.to),
          $from = doc.resolve(this.from);
      var parent = $from.node($from.sharedDepth(this.to));
      var slice = new Slice(mapFragment(oldSlice.content, function (node, parent) {
        if (!parent.type.allowsMarkType(this$1.mark.type)) {
          return node;
        }

        return node.mark(this$1.mark.addToSet(node.marks));
      }, parent), oldSlice.openStart, oldSlice.openEnd);
      return StepResult.fromReplace(doc, this.from, this.to, slice);
    };

    AddMarkStep.prototype.invert = function invert() {
      return new RemoveMarkStep(this.from, this.to, this.mark);
    };

    AddMarkStep.prototype.map = function map(mapping) {
      var from = mapping.mapResult(this.from, 1),
          to = mapping.mapResult(this.to, -1);

      if (from.deleted && to.deleted || from.pos >= to.pos) {
        return null;
      }

      return new AddMarkStep(from.pos, to.pos, this.mark);
    };

    AddMarkStep.prototype.merge = function merge(other) {
      if (other instanceof AddMarkStep && other.mark.eq(this.mark) && this.from <= other.to && this.to >= other.from) {
        return new AddMarkStep(Math.min(this.from, other.from), Math.max(this.to, other.to), this.mark);
      }
    };

    AddMarkStep.prototype.toJSON = function toJSON() {
      return {
        stepType: "addMark",
        mark: this.mark.toJSON(),
        from: this.from,
        to: this.to
      };
    };

    AddMarkStep.fromJSON = function fromJSON(schema, json) {
      if (typeof json.from != "number" || typeof json.to != "number") {
        throw new RangeError("Invalid input for AddMarkStep.fromJSON");
      }

      return new AddMarkStep(json.from, json.to, schema.markFromJSON(json.mark));
    };

    return AddMarkStep;
  }(Step);

  Step.jsonID("addMark", AddMarkStep); // ::- Remove a mark from all inline content between two positions.

  var RemoveMarkStep =
  /*@__PURE__*/
  function (Step) {
    function RemoveMarkStep(from, to, mark) {
      Step.call(this);
      this.from = from;
      this.to = to;
      this.mark = mark;
    }

    if (Step) RemoveMarkStep.__proto__ = Step;
    RemoveMarkStep.prototype = Object.create(Step && Step.prototype);
    RemoveMarkStep.prototype.constructor = RemoveMarkStep;

    RemoveMarkStep.prototype.apply = function apply(doc) {
      var this$1 = this;
      var oldSlice = doc.slice(this.from, this.to);
      var slice = new Slice(mapFragment(oldSlice.content, function (node) {
        return node.mark(this$1.mark.removeFromSet(node.marks));
      }), oldSlice.openStart, oldSlice.openEnd);
      return StepResult.fromReplace(doc, this.from, this.to, slice);
    };

    RemoveMarkStep.prototype.invert = function invert() {
      return new AddMarkStep(this.from, this.to, this.mark);
    };

    RemoveMarkStep.prototype.map = function map(mapping) {
      var from = mapping.mapResult(this.from, 1),
          to = mapping.mapResult(this.to, -1);

      if (from.deleted && to.deleted || from.pos >= to.pos) {
        return null;
      }

      return new RemoveMarkStep(from.pos, to.pos, this.mark);
    };

    RemoveMarkStep.prototype.merge = function merge(other) {
      if (other instanceof RemoveMarkStep && other.mark.eq(this.mark) && this.from <= other.to && this.to >= other.from) {
        return new RemoveMarkStep(Math.min(this.from, other.from), Math.max(this.to, other.to), this.mark);
      }
    };

    RemoveMarkStep.prototype.toJSON = function toJSON() {
      return {
        stepType: "removeMark",
        mark: this.mark.toJSON(),
        from: this.from,
        to: this.to
      };
    };

    RemoveMarkStep.fromJSON = function fromJSON(schema, json) {
      if (typeof json.from != "number" || typeof json.to != "number") {
        throw new RangeError("Invalid input for RemoveMarkStep.fromJSON");
      }

      return new RemoveMarkStep(json.from, json.to, schema.markFromJSON(json.mark));
    };

    return RemoveMarkStep;
  }(Step);

  Step.jsonID("removeMark", RemoveMarkStep); // :: (number, number, Mark) → this
  // Add the given mark to the inline content between `from` and `to`.

  Transform.prototype.addMark = function (from, to, mark) {
    var this$1 = this;
    var removed = [],
        added = [],
        removing = null,
        adding = null;
    this.doc.nodesBetween(from, to, function (node, pos, parent) {
      if (!node.isInline) {
        return;
      }

      var marks = node.marks;

      if (!mark.isInSet(marks) && parent.type.allowsMarkType(mark.type)) {
        var start = Math.max(pos, from),
            end = Math.min(pos + node.nodeSize, to);
        var newSet = mark.addToSet(marks);

        for (var i = 0; i < marks.length; i++) {
          if (!marks[i].isInSet(newSet)) {
            if (removing && removing.to == start && removing.mark.eq(marks[i])) {
              removing.to = end;
            } else {
              removed.push(removing = new RemoveMarkStep(start, end, marks[i]));
            }
          }
        }

        if (adding && adding.to == start) {
          adding.to = end;
        } else {
          added.push(adding = new AddMarkStep(start, end, mark));
        }
      }
    });
    removed.forEach(function (s) {
      return this$1.step(s);
    });
    added.forEach(function (s) {
      return this$1.step(s);
    });
    return this;
  }; // :: (number, number, ?union<Mark, MarkType>) → this
  // Remove marks from inline nodes between `from` and `to`. When `mark`
  // is a single mark, remove precisely that mark. When it is a mark type,
  // remove all marks of that type. When it is null, remove all marks of
  // any type.


  Transform.prototype.removeMark = function (from, to, mark) {
    var this$1 = this;
    if (mark === void 0) mark = null;
    var matched = [],
        step = 0;
    this.doc.nodesBetween(from, to, function (node, pos) {
      if (!node.isInline) {
        return;
      }

      step++;
      var toRemove = null;

      if (mark instanceof MarkType) {
        var found = mark.isInSet(node.marks);

        if (found) {
          toRemove = [found];
        }
      } else if (mark) {
        if (mark.isInSet(node.marks)) {
          toRemove = [mark];
        }
      } else {
        toRemove = node.marks;
      }

      if (toRemove && toRemove.length) {
        var end = Math.min(pos + node.nodeSize, to);

        for (var i = 0; i < toRemove.length; i++) {
          var style = toRemove[i],
              found$1 = void 0;

          for (var j = 0; j < matched.length; j++) {
            var m = matched[j];

            if (m.step == step - 1 && style.eq(matched[j].style)) {
              found$1 = m;
            }
          }

          if (found$1) {
            found$1.to = end;
            found$1.step = step;
          } else {
            matched.push({
              style: style,
              from: Math.max(pos, from),
              to: end,
              step: step
            });
          }
        }
      }
    });
    matched.forEach(function (m) {
      return this$1.step(new RemoveMarkStep(m.from, m.to, m.style));
    });
    return this;
  }; // :: (number, NodeType, ?ContentMatch) → this
  // Removes all marks and nodes from the content of the node at `pos`
  // that don't match the given new parent node type. Accepts an
  // optional starting [content match](#model.ContentMatch) as third
  // argument.


  Transform.prototype.clearIncompatible = function (pos, parentType, match) {
    if (match === void 0) match = parentType.contentMatch;
    var node = this.doc.nodeAt(pos);
    var delSteps = [],
        cur = pos + 1;

    for (var i = 0; i < node.childCount; i++) {
      var child = node.child(i),
          end = cur + child.nodeSize;
      var allowed = match.matchType(child.type, child.attrs);

      if (!allowed) {
        delSteps.push(new ReplaceStep(cur, end, Slice.empty));
      } else {
        match = allowed;

        for (var j = 0; j < child.marks.length; j++) {
          if (!parentType.allowsMarkType(child.marks[j].type)) {
            this.step(new RemoveMarkStep(cur, end, child.marks[j]));
          }
        }
      }

      cur = end;
    }

    if (!match.validEnd) {
      var fill = match.fillBefore(Fragment.empty, true);
      this.replace(cur, cur, new Slice(fill, 0, 0));
    }

    for (var i$1 = delSteps.length - 1; i$1 >= 0; i$1--) {
      this.step(delSteps[i$1]);
    }

    return this;
  }; // :: (Node, number, ?number, ?Slice) → ?Step
  // ‘Fit’ a slice into a given position in the document, producing a
  // [step](#transform.Step) that inserts it. Will return null if
  // there's no meaningful way to insert the slice here, or inserting it
  // would be a no-op (an empty slice over an empty range).


  function replaceStep(doc, from, to, slice) {
    if (to === void 0) to = from;
    if (slice === void 0) slice = Slice.empty;

    if (from == to && !slice.size) {
      return null;
    }

    var $from = doc.resolve(from),
        $to = doc.resolve(to); // Optimization -- avoid work if it's obvious that it's not needed.

    if (fitsTrivially($from, $to, slice)) {
      return new ReplaceStep(from, to, slice);
    }

    var placed = placeSlice($from, slice);
    var fittedLeft = fitLeft($from, placed);
    var fitted = fitRight($from, $to, fittedLeft);

    if (!fitted) {
      return null;
    }

    if (fittedLeft.size != fitted.size && canMoveText($from, $to, fittedLeft)) {
      var d = $to.depth,
          after = $to.after(d);

      while (d > 1 && after == $to.end(--d)) {
        ++after;
      }

      var fittedAfter = fitRight($from, doc.resolve(after), fittedLeft);

      if (fittedAfter) {
        return new ReplaceAroundStep(from, after, to, $to.end(), fittedAfter, fittedLeft.size);
      }
    }

    return fitted.size || from != to ? new ReplaceStep(from, to, fitted) : null;
  } // :: (number, ?number, ?Slice) → this
  // Replace the part of the document between `from` and `to` with the
  // given `slice`.


  Transform.prototype.replace = function (from, to, slice) {
    if (to === void 0) to = from;
    if (slice === void 0) slice = Slice.empty;
    var step = replaceStep(this.doc, from, to, slice);

    if (step) {
      this.step(step);
    }

    return this;
  }; // :: (number, number, union<Fragment, Node, [Node]>) → this
  // Replace the given range with the given content, which may be a
  // fragment, node, or array of nodes.


  Transform.prototype.replaceWith = function (from, to, content) {
    return this.replace(from, to, new Slice(Fragment.from(content), 0, 0));
  }; // :: (number, number) → this
  // Delete the content between the given positions.


  Transform.prototype.delete = function (from, to) {
    return this.replace(from, to, Slice.empty);
  }; // :: (number, union<Fragment, Node, [Node]>) → this
  // Insert the given content at the given position.


  Transform.prototype.insert = function (pos, content) {
    return this.replaceWith(pos, pos, content);
  };

  function fitLeftInner($from, depth, placed, placedBelow) {
    var content = Fragment.empty,
        openEnd = 0,
        placedHere = placed[depth];

    if ($from.depth > depth) {
      var inner = fitLeftInner($from, depth + 1, placed, placedBelow || placedHere);
      openEnd = inner.openEnd + 1;
      content = Fragment.from($from.node(depth + 1).copy(inner.content));
    }

    if (placedHere) {
      content = content.append(placedHere.content);
      openEnd = placedHere.openEnd;
    }

    if (placedBelow) {
      content = content.append($from.node(depth).contentMatchAt($from.indexAfter(depth)).fillBefore(Fragment.empty, true));
      openEnd = 0;
    }

    return {
      content: content,
      openEnd: openEnd
    };
  }

  function fitLeft($from, placed) {
    var ref = fitLeftInner($from, 0, placed, false);
    var content = ref.content;
    var openEnd = ref.openEnd;
    return new Slice(content, $from.depth, openEnd || 0);
  }

  function fitRightJoin(content, parent, $from, $to, depth, openStart, openEnd) {
    var match,
        count = content.childCount,
        matchCount = count - (openEnd > 0 ? 1 : 0);
    var parentNode = openStart < 0 ? parent : $from.node(depth);

    if (openStart < 0) {
      match = parentNode.contentMatchAt(matchCount);
    } else if (count == 1 && openEnd > 0) {
      match = parentNode.contentMatchAt(openStart ? $from.index(depth) : $from.indexAfter(depth));
    } else {
      match = parentNode.contentMatchAt($from.indexAfter(depth)).matchFragment(content, count > 0 && openStart ? 1 : 0, matchCount);
    }

    var toNode = $to.node(depth);

    if (openEnd > 0 && depth < $to.depth) {
      var after = toNode.content.cutByIndex($to.indexAfter(depth)).addToStart(content.lastChild);
      var joinable$1 = match.fillBefore(after, true); // Can't insert content if there's a single node stretched across this gap

      if (joinable$1 && joinable$1.size && openStart > 0 && count == 1) {
        joinable$1 = null;
      }

      if (joinable$1) {
        var inner = fitRightJoin(content.lastChild.content, content.lastChild, $from, $to, depth + 1, count == 1 ? openStart - 1 : -1, openEnd - 1);

        if (inner) {
          var last = content.lastChild.copy(inner);

          if (joinable$1.size) {
            return content.cutByIndex(0, count - 1).append(joinable$1).addToEnd(last);
          } else {
            return content.replaceChild(count - 1, last);
          }
        }
      }
    }

    if (openEnd > 0) {
      match = match.matchType((count == 1 && openStart > 0 ? $from.node(depth + 1) : content.lastChild).type);
    } // If we're here, the next level can't be joined, so we see what
    // happens if we leave it open.


    var toIndex = $to.index(depth);

    if (toIndex == toNode.childCount && !toNode.type.compatibleContent(parent.type)) {
      return null;
    }

    var joinable = match.fillBefore(toNode.content, true, toIndex);

    for (var i = toIndex; joinable && i < toNode.content.childCount; i++) {
      if (!parentNode.type.allowsMarks(toNode.content.child(i).marks)) {
        joinable = null;
      }
    }

    if (!joinable) {
      return null;
    }

    if (openEnd > 0) {
      var closed = fitRightClosed(content.lastChild, openEnd - 1, $from, depth + 1, count == 1 ? openStart - 1 : -1);
      content = content.replaceChild(count - 1, closed);
    }

    content = content.append(joinable);

    if ($to.depth > depth) {
      content = content.addToEnd(fitRightSeparate($to, depth + 1));
    }

    return content;
  }

  function fitRightClosed(node, openEnd, $from, depth, openStart) {
    var match,
        content = node.content,
        count = content.childCount;

    if (openStart >= 0) {
      match = $from.node(depth).contentMatchAt($from.indexAfter(depth)).matchFragment(content, openStart > 0 ? 1 : 0, count);
    } else {
      match = node.contentMatchAt(count);
    }

    if (openEnd > 0) {
      var closed = fitRightClosed(content.lastChild, openEnd - 1, $from, depth + 1, count == 1 ? openStart - 1 : -1);
      content = content.replaceChild(count - 1, closed);
    }

    return node.copy(content.append(match.fillBefore(Fragment.empty, true)));
  }

  function fitRightSeparate($to, depth) {
    var node = $to.node(depth);
    var fill = node.contentMatchAt(0).fillBefore(node.content, true, $to.index(depth));

    if ($to.depth > depth) {
      fill = fill.addToEnd(fitRightSeparate($to, depth + 1));
    }

    return node.copy(fill);
  }

  function normalizeSlice(content, openStart, openEnd) {
    while (openStart > 0 && openEnd > 0 && content.childCount == 1) {
      content = content.firstChild.content;
      openStart--;
      openEnd--;
    }

    return new Slice(content, openStart, openEnd);
  } // : (ResolvedPos, ResolvedPos, number, Slice) → Slice


  function fitRight($from, $to, slice) {
    var fitted = fitRightJoin(slice.content, $from.node(0), $from, $to, 0, slice.openStart, slice.openEnd);

    if (!fitted) {
      return null;
    }

    return normalizeSlice(fitted, slice.openStart, $to.depth);
  }

  function fitsTrivially($from, $to, slice) {
    return !slice.openStart && !slice.openEnd && $from.start() == $to.start() && $from.parent.canReplace($from.index(), $to.index(), slice.content);
  }

  function canMoveText($from, $to, slice) {
    if (!$to.parent.isTextblock) {
      return false;
    }

    var parent = slice.openEnd ? nodeRight(slice.content, slice.openEnd) : $from.node($from.depth - (slice.openStart - slice.openEnd));

    if (!parent.isTextblock) {
      return false;
    }

    for (var i = $to.index(); i < $to.parent.childCount; i++) {
      if (!parent.type.allowsMarks($to.parent.child(i).marks)) {
        return false;
      }
    }

    var match;

    if (slice.openEnd) {
      match = parent.contentMatchAt(parent.childCount);
    } else {
      match = parent.contentMatchAt(parent.childCount);

      if (slice.size) {
        match = match.matchFragment(slice.content, slice.openStart ? 1 : 0);
      }
    }

    match = match.matchFragment($to.parent.content, $to.index());
    return match && match.validEnd;
  }

  function nodeRight(content, depth) {
    for (var i = 1; i < depth; i++) {
      content = content.lastChild.content;
    }

    return content.lastChild;
  } // Algorithm for 'placing' the elements of a slice into a gap:
  //
  // We consider the content of each node that is open to the left to be
  // independently placeable. I.e. in <p("foo"), p("bar")>, when the
  // paragraph on the left is open, "foo" can be placed (somewhere on
  // the left side of the replacement gap) independently from p("bar").
  //
  // So placeSlice splits up a slice into a number of sub-slices,
  // along with information on where they can be placed on the given
  // left-side edge. It works by walking the open side of the slice,
  // from the inside out, and trying to find a landing spot for each
  // element, by simultaneously scanning over the gap side. When no
  // place is found for an open node's content, it is left in that node.
  // : (ResolvedPos, Slice) → [{content: Fragment, openEnd: number, depth: number}]


  function placeSlice($from, slice) {
    var frontier = new Frontier($from);

    for (var pass = 1; slice.size && pass <= 3; pass++) {
      var value = frontier.placeSlice(slice.content, slice.openStart, slice.openEnd, pass);

      if (pass == 3 && value != slice && value.size) {
        pass = 0;
      } // Restart if the 3rd pass made progress but left content


      slice = value;
    }

    while (frontier.open.length) {
      frontier.closeNode();
    }

    return frontier.placed;
  } // Helper class that models the open side of the insert position,
  // keeping track of the content match and already inserted content
  // at each depth.


  var Frontier = function Frontier($pos) {
    // : [{parent: Node, match: ContentMatch, content: Fragment, wrapper: bool, openEnd: number, depth: number}]
    this.open = [];

    for (var d = 0; d <= $pos.depth; d++) {
      var parent = $pos.node(d),
          match = parent.contentMatchAt($pos.indexAfter(d));
      this.open.push({
        parent: parent,
        match: match,
        content: Fragment.empty,
        wrapper: false,
        openEnd: 0,
        depth: d
      });
    }

    this.placed = [];
  }; // : (Fragment, number, number, number, ?Node) → Slice
  // Tries to place the content of the given slice, and returns a
  // slice containing unplaced content.
  //
  // pass 1: try to fit directly
  // pass 2: allow wrapper nodes to be introduced
  // pass 3: allow unwrapping of nodes that aren't open


  Frontier.prototype.placeSlice = function placeSlice(fragment, openStart, openEnd, pass, parent) {
    if (openStart > 0) {
      var first = fragment.firstChild;
      var inner = this.placeSlice(first.content, Math.max(0, openStart - 1), openEnd && fragment.childCount == 1 ? openEnd - 1 : 0, pass, first);

      if (inner.content != first.content) {
        if (inner.content.size) {
          fragment = fragment.replaceChild(0, first.copy(inner.content));
          openStart = inner.openStart + 1;
        } else {
          if (fragment.childCount == 1) {
            openEnd = 0;
          }

          fragment = fragment.cutByIndex(1);
          openStart = 0;
        }
      }
    }

    var result = this.placeContent(fragment, openStart, openEnd, pass, parent);

    if (pass > 2 && result.size && openStart == 0) {
      var child = result.content.firstChild,
          single = result.content.childCount == 1;
      this.placeContent(child.content, 0, openEnd && single ? openEnd - 1 : 0, pass, child);
      result = single ? Fragment.empty : new Slice(result.content.cutByIndex(1), 0, openEnd);
    }

    return result;
  };

  Frontier.prototype.placeContent = function placeContent(fragment, openStart, openEnd, pass, parent) {
    var i = 0; // Go over the fragment's children

    for (; i < fragment.childCount; i++) {
      var child = fragment.child(i),
          placed = false,
          last = i == fragment.childCount - 1; // Try each open node in turn, starting from the innermost

      for (var d = this.open.length - 1; d >= 0; d--) {
        var open = this.open[d],
            wrap = void 0; // If pass > 1, it is allowed to wrap the node to help find a
        // fit, so if findWrapping returns something, we add open
        // nodes to the frontier for that wrapping.

        if (pass > 1 && (wrap = open.match.findWrapping(child.type)) && !(parent && wrap.length && wrap[wrap.length - 1] == parent.type)) {
          while (this.open.length - 1 > d) {
            this.closeNode();
          }

          for (var w = 0; w < wrap.length; w++) {
            open.match = open.match.matchType(wrap[w]);
            d++;
            open = {
              parent: wrap[w].create(),
              match: wrap[w].contentMatch,
              content: Fragment.empty,
              wrapper: true,
              openEnd: 0,
              depth: d + w
            };
            this.open.push(open);
          }
        } // See if the child fits here


        var match = open.match.matchType(child.type);

        if (!match) {
          var fill = open.match.fillBefore(Fragment.from(child));

          if (fill) {
            for (var j = 0; j < fill.childCount; j++) {
              var ch = fill.child(j);
              this.addNode(open, ch, 0);
              match = open.match.matchFragment(ch);
            }
          } else if (parent && open.match.matchType(parent.type)) {
            // Don't continue looking further up if the parent node
            // would fit here.
            break;
          } else {
            continue;
          }
        } // Close open nodes above this one, since we're starting to
        // add to this.


        while (this.open.length - 1 > d) {
          this.closeNode();
        } // Strip marks from the child or close its start when necessary


        child = child.mark(open.parent.type.allowedMarks(child.marks));

        if (openStart) {
          child = closeNodeStart(child, openStart, last ? openEnd : 0);
          openStart = 0;
        } // Add the child to this open node and adjust its metadata


        this.addNode(open, child, last ? openEnd : 0);
        open.match = match;

        if (last) {
          openEnd = 0;
        }

        placed = true;
        break;
      } // As soon as we've failed to place a node we stop looking at
      // later nodes


      if (!placed) {
        break;
      }
    } // Close the current open node if it's not the the root and we
    // either placed up to the end of the node or the the current
    // slice depth's node type matches the open node's type


    if (this.open.length > 1 && (i > 0 && i == fragment.childCount || parent && this.open[this.open.length - 1].parent.type == parent.type)) {
      this.closeNode();
    }

    return new Slice(fragment.cutByIndex(i), openStart, openEnd);
  };

  Frontier.prototype.addNode = function addNode(open, node, openEnd) {
    open.content = closeFragmentEnd(open.content, open.openEnd).addToEnd(node);
    open.openEnd = openEnd;
  };

  Frontier.prototype.closeNode = function closeNode() {
    var open = this.open.pop();
    if (open.content.size == 0) ;else if (open.wrapper) {
      this.addNode(this.open[this.open.length - 1], open.parent.copy(open.content), open.openEnd + 1);
    } else {
      this.placed[open.depth] = {
        depth: open.depth,
        content: open.content,
        openEnd: open.openEnd
      };
    }
  };

  function closeNodeStart(node, openStart, openEnd) {
    var content = node.content;

    if (openStart > 1) {
      var first = closeNodeStart(node.firstChild, openStart - 1, node.childCount == 1 ? openEnd - 1 : 0);
      content = node.content.replaceChild(0, first);
    }

    var fill = node.type.contentMatch.fillBefore(content, openEnd == 0);
    return node.copy(fill.append(content));
  }

  function closeNodeEnd(node, depth) {
    var content = node.content;

    if (depth > 1) {
      var last = closeNodeEnd(node.lastChild, depth - 1);
      content = node.content.replaceChild(node.childCount - 1, last);
    }

    var fill = node.contentMatchAt(node.childCount).fillBefore(Fragment.empty, true);
    return node.copy(content.append(fill));
  }

  function closeFragmentEnd(fragment, depth) {
    return depth ? fragment.replaceChild(fragment.childCount - 1, closeNodeEnd(fragment.lastChild, depth)) : fragment;
  } // :: (number, number, Slice) → this
  // Replace a range of the document with a given slice, using `from`,
  // `to`, and the slice's [`openStart`](#model.Slice.openStart) property
  // as hints, rather than fixed start and end points. This method may
  // grow the replaced area or close open nodes in the slice in order to
  // get a fit that is more in line with WYSIWYG expectations, by
  // dropping fully covered parent nodes of the replaced region when
  // they are marked [non-defining](#model.NodeSpec.defining), or
  // including an open parent node from the slice that _is_ marked as
  // [defining](#model.NodeSpec.defining).
  //
  // This is the method, for example, to handle paste. The similar
  // [`replace`](#transform.Transform.replace) method is a more
  // primitive tool which will _not_ move the start and end of its given
  // range, and is useful in situations where you need more precise
  // control over what happens.


  Transform.prototype.replaceRange = function (from, to, slice) {
    if (!slice.size) {
      return this.deleteRange(from, to);
    }

    var $from = this.doc.resolve(from),
        $to = this.doc.resolve(to);

    if (fitsTrivially($from, $to, slice)) {
      return this.step(new ReplaceStep(from, to, slice));
    }

    var targetDepths = coveredDepths($from, this.doc.resolve(to)); // Can't replace the whole document, so remove 0 if it's present

    if (targetDepths[targetDepths.length - 1] == 0) {
      targetDepths.pop();
    } // Negative numbers represent not expansion over the whole node at
    // that depth, but replacing from $from.before(-D) to $to.pos.


    var preferredTarget = -($from.depth + 1);
    targetDepths.unshift(preferredTarget); // This loop picks a preferred target depth, if one of the covering
    // depths is not outside of a defining node, and adds negative
    // depths for any depth that has $from at its start and does not
    // cross a defining node.

    for (var d = $from.depth, pos = $from.pos - 1; d > 0; d--, pos--) {
      var spec = $from.node(d).type.spec;

      if (spec.defining || spec.isolating) {
        break;
      }

      if (targetDepths.indexOf(d) > -1) {
        preferredTarget = d;
      } else if ($from.before(d) == pos) {
        targetDepths.splice(1, 0, -d);
      }
    } // Try to fit each possible depth of the slice into each possible
    // target depth, starting with the preferred depths.


    var preferredTargetIndex = targetDepths.indexOf(preferredTarget);
    var leftNodes = [],
        preferredDepth = slice.openStart;

    for (var content = slice.content, i = 0;; i++) {
      var node = content.firstChild;
      leftNodes.push(node);

      if (i == slice.openStart) {
        break;
      }

      content = node.content;
    } // Back up if the node directly above openStart, or the node above
    // that separated only by a non-defining textblock node, is defining.


    if (preferredDepth > 0 && leftNodes[preferredDepth - 1].type.spec.defining && $from.node(preferredTargetIndex).type != leftNodes[preferredDepth - 1].type) {
      preferredDepth -= 1;
    } else if (preferredDepth >= 2 && leftNodes[preferredDepth - 1].isTextblock && leftNodes[preferredDepth - 2].type.spec.defining && $from.node(preferredTargetIndex).type != leftNodes[preferredDepth - 2].type) {
      preferredDepth -= 2;
    }

    for (var j = slice.openStart; j >= 0; j--) {
      var openDepth = (j + preferredDepth + 1) % (slice.openStart + 1);
      var insert = leftNodes[openDepth];

      if (!insert) {
        continue;
      }

      for (var i$1 = 0; i$1 < targetDepths.length; i$1++) {
        // Loop over possible expansion levels, starting with the
        // preferred one
        var targetDepth = targetDepths[(i$1 + preferredTargetIndex) % targetDepths.length],
            expand = true;

        if (targetDepth < 0) {
          expand = false;
          targetDepth = -targetDepth;
        }

        var parent = $from.node(targetDepth - 1),
            index = $from.index(targetDepth - 1);

        if (parent.canReplaceWith(index, index, insert.type, insert.marks)) {
          return this.replace($from.before(targetDepth), expand ? $to.after(targetDepth) : to, new Slice(closeFragment(slice.content, 0, slice.openStart, openDepth), openDepth, slice.openEnd));
        }
      }
    }

    var startSteps = this.steps.length;

    for (var i$2 = targetDepths.length - 1; i$2 >= 0; i$2--) {
      this.replace(from, to, slice);

      if (this.steps.length > startSteps) {
        break;
      }

      var depth = targetDepths[i$2];

      if (i$2 < 0) {
        continue;
      }

      from = $from.before(depth);
      to = $to.after(depth);
    }

    return this;
  };

  function closeFragment(fragment, depth, oldOpen, newOpen, parent) {
    if (depth < oldOpen) {
      var first = fragment.firstChild;
      fragment = fragment.replaceChild(0, first.copy(closeFragment(first.content, depth + 1, oldOpen, newOpen, first)));
    }

    if (depth > newOpen) {
      var match = parent.contentMatchAt(0);
      var start = match.fillBefore(fragment).append(fragment);
      fragment = start.append(match.matchFragment(start).fillBefore(Fragment.empty, true));
    }

    return fragment;
  } // :: (number, number, Node) → this
  // Replace the given range with a node, but use `from` and `to` as
  // hints, rather than precise positions. When from and to are the same
  // and are at the start or end of a parent node in which the given
  // node doesn't fit, this method may _move_ them out towards a parent
  // that does allow the given node to be placed. When the given range
  // completely covers a parent node, this method may completely replace
  // that parent node.


  Transform.prototype.replaceRangeWith = function (from, to, node) {
    if (!node.isInline && from == to && this.doc.resolve(from).parent.content.size) {
      var point = insertPoint(this.doc, from, node.type);

      if (point != null) {
        from = to = point;
      }
    }

    return this.replaceRange(from, to, new Slice(Fragment.from(node), 0, 0));
  }; // :: (number, number) → this
  // Delete the given range, expanding it to cover fully covered
  // parent nodes until a valid replace is found.


  Transform.prototype.deleteRange = function (from, to) {
    var $from = this.doc.resolve(from),
        $to = this.doc.resolve(to);
    var covered = coveredDepths($from, $to);

    for (var i = 0; i < covered.length; i++) {
      var depth = covered[i],
          last = i == covered.length - 1;

      if (last && depth == 0 || $from.node(depth).type.contentMatch.validEnd) {
        return this.delete($from.start(depth), $to.end(depth));
      }

      if (depth > 0 && (last || $from.node(depth - 1).canReplace($from.index(depth - 1), $to.indexAfter(depth - 1)))) {
        return this.delete($from.before(depth), $to.after(depth));
      }
    }

    for (var d = 1; d <= $from.depth && d <= $to.depth; d++) {
      if (from - $from.start(d) == $from.depth - d && to > $from.end(d) && $to.end(d) - to != $to.depth - d) {
        return this.delete($from.before(d), to);
      }
    }

    return this.delete(from, to);
  }; // : (ResolvedPos, ResolvedPos) → [number]
  // Returns an array of all depths for which $from - $to spans the
  // whole content of the nodes at that depth.


  function coveredDepths($from, $to) {
    var result = [],
        minDepth = Math.min($from.depth, $to.depth);

    for (var d = minDepth; d >= 0; d--) {
      var start = $from.start(d);

      if (start < $from.pos - ($from.depth - d) || $to.end(d) > $to.pos + ($to.depth - d) || $from.node(d).type.spec.isolating || $to.node(d).type.spec.isolating) {
        break;
      }

      if (start == $to.start(d)) {
        result.push(d);
      }
    }

    return result;
  }

  var classesById = Object.create(null); // ::- Superclass for editor selections. Every selection type should
  // extend this. Should not be instantiated directly.

  var Selection = function Selection($anchor, $head, ranges) {
    // :: [SelectionRange]
    // The ranges covered by the selection.
    this.ranges = ranges || [new SelectionRange($anchor.min($head), $anchor.max($head))]; // :: ResolvedPos
    // The resolved anchor of the selection (the side that stays in
    // place when the selection is modified).

    this.$anchor = $anchor; // :: ResolvedPos
    // The resolved head of the selection (the side that moves when
    // the selection is modified).

    this.$head = $head;
  };

  var prototypeAccessors$8 = {
    anchor: {
      configurable: true
    },
    head: {
      configurable: true
    },
    from: {
      configurable: true
    },
    to: {
      configurable: true
    },
    $from: {
      configurable: true
    },
    $to: {
      configurable: true
    },
    empty: {
      configurable: true
    }
  }; // :: number
  // The selection's anchor, as an unresolved position.

  prototypeAccessors$8.anchor.get = function () {
    return this.$anchor.pos;
  }; // :: number
  // The selection's head.


  prototypeAccessors$8.head.get = function () {
    return this.$head.pos;
  }; // :: number
  // The lower bound of the selection's main range.


  prototypeAccessors$8.from.get = function () {
    return this.$from.pos;
  }; // :: number
  // The upper bound of the selection's main range.


  prototypeAccessors$8.to.get = function () {
    return this.$to.pos;
  }; // :: ResolvedPos
  // The resolved lowerbound of the selection's main range.


  prototypeAccessors$8.$from.get = function () {
    return this.ranges[0].$from;
  }; // :: ResolvedPos
  // The resolved upper bound of the selection's main range.


  prototypeAccessors$8.$to.get = function () {
    return this.ranges[0].$to;
  }; // :: bool
  // Indicates whether the selection contains any content.


  prototypeAccessors$8.empty.get = function () {
    var ranges = this.ranges;

    for (var i = 0; i < ranges.length; i++) {
      if (ranges[i].$from.pos != ranges[i].$to.pos) {
        return false;
      }
    }

    return true;
  }; // eq:: (Selection) → bool
  // Test whether the selection is the same as another selection.
  // map:: (doc: Node, mapping: Mappable) → Selection
  // Map this selection through a [mappable](#transform.Mappable) thing. `doc`
  // should be the new document to which we are mapping.
  // :: () → Slice
  // Get the content of this selection as a slice.


  Selection.prototype.content = function content() {
    return this.$from.node(0).slice(this.from, this.to, true);
  }; // :: (Transaction, ?Slice)
  // Replace the selection with a slice or, if no slice is given,
  // delete the selection. Will append to the given transaction.


  Selection.prototype.replace = function replace(tr, content) {
    if (content === void 0) content = Slice.empty; // Put the new selection at the position after the inserted
    // content. When that ended in an inline node, search backwards,
    // to get the position after that node. If not, search forward.

    var lastNode = content.content.lastChild,
        lastParent = null;

    for (var i = 0; i < content.openEnd; i++) {
      lastParent = lastNode;
      lastNode = lastNode.lastChild;
    }

    var mapFrom = tr.steps.length,
        ranges = this.ranges;

    for (var i$1 = 0; i$1 < ranges.length; i$1++) {
      var ref = ranges[i$1];
      var $from = ref.$from;
      var $to = ref.$to;
      var mapping = tr.mapping.slice(mapFrom);
      tr.replaceRange(mapping.map($from.pos), mapping.map($to.pos), i$1 ? Slice.empty : content);

      if (i$1 == 0) {
        selectionToInsertionEnd(tr, mapFrom, (lastNode ? lastNode.isInline : lastParent && lastParent.isTextblock) ? -1 : 1);
      }
    }
  }; // :: (Transaction, Node)
  // Replace the selection with the given node, appending the changes
  // to the given transaction.


  Selection.prototype.replaceWith = function replaceWith(tr, node) {
    var mapFrom = tr.steps.length,
        ranges = this.ranges;

    for (var i = 0; i < ranges.length; i++) {
      var ref = ranges[i];
      var $from = ref.$from;
      var $to = ref.$to;
      var mapping = tr.mapping.slice(mapFrom);
      var from = mapping.map($from.pos),
          to = mapping.map($to.pos);

      if (i) {
        tr.deleteRange(from, to);
      } else {
        tr.replaceRangeWith(from, to, node);
        selectionToInsertionEnd(tr, mapFrom, node.isInline ? -1 : 1);
      }
    }
  }; // toJSON:: () → Object
  // Convert the selection to a JSON representation. When implementing
  // this for a custom selection class, make sure to give the object a
  // `type` property whose value matches the ID under which you
  // [registered](#state.Selection^jsonID) your class.
  // :: (ResolvedPos, number, ?bool) → ?Selection
  // Find a valid cursor or leaf node selection starting at the given
  // position and searching back if `dir` is negative, and forward if
  // positive. When `textOnly` is true, only consider cursor
  // selections. Will return null when no valid selection position is
  // found.


  Selection.findFrom = function findFrom($pos, dir, textOnly) {
    var inner = $pos.parent.inlineContent ? new TextSelection($pos) : findSelectionIn($pos.node(0), $pos.parent, $pos.pos, $pos.index(), dir, textOnly);

    if (inner) {
      return inner;
    }

    for (var depth = $pos.depth - 1; depth >= 0; depth--) {
      var found = dir < 0 ? findSelectionIn($pos.node(0), $pos.node(depth), $pos.before(depth + 1), $pos.index(depth), dir, textOnly) : findSelectionIn($pos.node(0), $pos.node(depth), $pos.after(depth + 1), $pos.index(depth) + 1, dir, textOnly);

      if (found) {
        return found;
      }
    }
  }; // :: (ResolvedPos, ?number) → Selection
  // Find a valid cursor or leaf node selection near the given
  // position. Searches forward first by default, but if `bias` is
  // negative, it will search backwards first.


  Selection.near = function near($pos, bias) {
    if (bias === void 0) bias = 1;
    return this.findFrom($pos, bias) || this.findFrom($pos, -bias) || new AllSelection($pos.node(0));
  }; // :: (Node) → Selection
  // Find the cursor or leaf node selection closest to the start of
  // the given document. Will return an
  // [`AllSelection`](#state.AllSelection) if no valid position
  // exists.


  Selection.atStart = function atStart(doc) {
    return findSelectionIn(doc, doc, 0, 0, 1) || new AllSelection(doc);
  }; // :: (Node) → Selection
  // Find the cursor or leaf node selection closest to the end of the
  // given document.


  Selection.atEnd = function atEnd(doc) {
    return findSelectionIn(doc, doc, doc.content.size, doc.childCount, -1) || new AllSelection(doc);
  }; // :: (Node, Object) → Selection
  // Deserialize the JSON representation of a selection. Must be
  // implemented for custom classes (as a static class method).


  Selection.fromJSON = function fromJSON(doc, json) {
    if (!json || !json.type) {
      throw new RangeError("Invalid input for Selection.fromJSON");
    }

    var cls = classesById[json.type];

    if (!cls) {
      throw new RangeError("No selection type " + json.type + " defined");
    }

    return cls.fromJSON(doc, json);
  }; // :: (string, constructor<Selection>)
  // To be able to deserialize selections from JSON, custom selection
  // classes must register themselves with an ID string, so that they
  // can be disambiguated. Try to pick something that's unlikely to
  // clash with classes from other modules.


  Selection.jsonID = function jsonID(id, selectionClass) {
    if (id in classesById) {
      throw new RangeError("Duplicate use of selection JSON ID " + id);
    }

    classesById[id] = selectionClass;
    selectionClass.prototype.jsonID = id;
    return selectionClass;
  }; // :: () → SelectionBookmark
  // Get a [bookmark](#state.SelectionBookmark) for this selection,
  // which is a value that can be mapped without having access to a
  // current document, and later resolved to a real selection for a
  // given document again. (This is used mostly by the history to
  // track and restore old selections.) The default implementation of
  // this method just converts the selection to a text selection and
  // returns the bookmark for that.


  Selection.prototype.getBookmark = function getBookmark() {
    return TextSelection.between(this.$anchor, this.$head).getBookmark();
  };

  Object.defineProperties(Selection.prototype, prototypeAccessors$8); // :: bool
  // Controls whether, when a selection of this type is active in the
  // browser, the selected range should be visible to the user. Defaults
  // to `true`.

  Selection.prototype.visible = true; // SelectionBookmark:: interface
  // A lightweight, document-independent representation of a selection.
  // You can define a custom bookmark type for a custom selection class
  // to make the history handle it well.
  //
  //   map:: (mapping: Mapping) → SelectionBookmark
  //   Map the bookmark through a set of changes.
  //
  //   resolve:: (doc: Node) → Selection
  //   Resolve the bookmark to a real selection again. This may need to
  //   do some error checking and may fall back to a default (usually
  //   [`TextSelection.between`](#state.TextSelection^between)) if
  //   mapping made the bookmark invalid.
  // ::- Represents a selected range in a document.

  var SelectionRange = function SelectionRange($from, $to) {
    // :: ResolvedPos
    // The lower bound of the range.
    this.$from = $from; // :: ResolvedPos
    // The upper bound of the range.

    this.$to = $to;
  }; // ::- A text selection represents a classical editor selection, with
  // a head (the moving side) and anchor (immobile side), both of which
  // point into textblock nodes. It can be empty (a regular cursor
  // position).


  var TextSelection =
  /*@__PURE__*/
  function (Selection) {
    function TextSelection($anchor, $head) {
      if ($head === void 0) $head = $anchor;
      Selection.call(this, $anchor, $head);
    }

    if (Selection) TextSelection.__proto__ = Selection;
    TextSelection.prototype = Object.create(Selection && Selection.prototype);
    TextSelection.prototype.constructor = TextSelection;
    var prototypeAccessors$1 = {
      $cursor: {
        configurable: true
      }
    }; // :: ?ResolvedPos
    // Returns a resolved position if this is a cursor selection (an
    // empty text selection), and null otherwise.

    prototypeAccessors$1.$cursor.get = function () {
      return this.$anchor.pos == this.$head.pos ? this.$head : null;
    };

    TextSelection.prototype.map = function map(doc, mapping) {
      var $head = doc.resolve(mapping.map(this.head));

      if (!$head.parent.inlineContent) {
        return Selection.near($head);
      }

      var $anchor = doc.resolve(mapping.map(this.anchor));
      return new TextSelection($anchor.parent.inlineContent ? $anchor : $head, $head);
    };

    TextSelection.prototype.replace = function replace(tr, content) {
      if (content === void 0) content = Slice.empty;
      Selection.prototype.replace.call(this, tr, content);

      if (content == Slice.empty) {
        var marks = this.$from.marksAcross(this.$to);

        if (marks) {
          tr.ensureMarks(marks);
        }
      }
    };

    TextSelection.prototype.eq = function eq(other) {
      return other instanceof TextSelection && other.anchor == this.anchor && other.head == this.head;
    };

    TextSelection.prototype.getBookmark = function getBookmark() {
      return new TextBookmark(this.anchor, this.head);
    };

    TextSelection.prototype.toJSON = function toJSON() {
      return {
        type: "text",
        anchor: this.anchor,
        head: this.head
      };
    };

    TextSelection.fromJSON = function fromJSON(doc, json) {
      if (typeof json.anchor != "number" || typeof json.head != "number") {
        throw new RangeError("Invalid input for TextSelection.fromJSON");
      }

      return new TextSelection(doc.resolve(json.anchor), doc.resolve(json.head));
    }; // :: (Node, number, ?number) → TextSelection
    // Create a text selection from non-resolved positions.


    TextSelection.create = function create(doc, anchor, head) {
      if (head === void 0) head = anchor;
      var $anchor = doc.resolve(anchor);
      return new this($anchor, head == anchor ? $anchor : doc.resolve(head));
    }; // :: (ResolvedPos, ResolvedPos, ?number) → Selection
    // Return a text selection that spans the given positions or, if
    // they aren't text positions, find a text selection near them.
    // `bias` determines whether the method searches forward (default)
    // or backwards (negative number) first. Will fall back to calling
    // [`Selection.near`](#state.Selection^near) when the document
    // doesn't contain a valid text position.


    TextSelection.between = function between($anchor, $head, bias) {
      var dPos = $anchor.pos - $head.pos;

      if (!bias || dPos) {
        bias = dPos >= 0 ? 1 : -1;
      }

      if (!$head.parent.inlineContent) {
        var found = Selection.findFrom($head, bias, true) || Selection.findFrom($head, -bias, true);

        if (found) {
          $head = found.$head;
        } else {
          return Selection.near($head, bias);
        }
      }

      if (!$anchor.parent.inlineContent) {
        if (dPos == 0) {
          $anchor = $head;
        } else {
          $anchor = (Selection.findFrom($anchor, -bias, true) || Selection.findFrom($anchor, bias, true)).$anchor;

          if ($anchor.pos < $head.pos != dPos < 0) {
            $anchor = $head;
          }
        }
      }

      return new TextSelection($anchor, $head);
    };

    Object.defineProperties(TextSelection.prototype, prototypeAccessors$1);
    return TextSelection;
  }(Selection);

  Selection.jsonID("text", TextSelection);

  var TextBookmark = function TextBookmark(anchor, head) {
    this.anchor = anchor;
    this.head = head;
  };

  TextBookmark.prototype.map = function map(mapping) {
    return new TextBookmark(mapping.map(this.anchor), mapping.map(this.head));
  };

  TextBookmark.prototype.resolve = function resolve(doc) {
    return TextSelection.between(doc.resolve(this.anchor), doc.resolve(this.head));
  }; // ::- A node selection is a selection that points at a single node.
  // All nodes marked [selectable](#model.NodeSpec.selectable) can be
  // the target of a node selection. In such a selection, `from` and
  // `to` point directly before and after the selected node, `anchor`
  // equals `from`, and `head` equals `to`..


  var NodeSelection =
  /*@__PURE__*/
  function (Selection) {
    function NodeSelection($pos) {
      var node = $pos.nodeAfter;
      var $end = $pos.node(0).resolve($pos.pos + node.nodeSize);
      Selection.call(this, $pos, $end); // :: Node The selected node.

      this.node = node;
    }

    if (Selection) NodeSelection.__proto__ = Selection;
    NodeSelection.prototype = Object.create(Selection && Selection.prototype);
    NodeSelection.prototype.constructor = NodeSelection;

    NodeSelection.prototype.map = function map(doc, mapping) {
      var ref = mapping.mapResult(this.anchor);
      var deleted = ref.deleted;
      var pos = ref.pos;
      var $pos = doc.resolve(pos);

      if (deleted) {
        return Selection.near($pos);
      }

      return new NodeSelection($pos);
    };

    NodeSelection.prototype.content = function content() {
      return new Slice(Fragment.from(this.node), 0, 0);
    };

    NodeSelection.prototype.eq = function eq(other) {
      return other instanceof NodeSelection && other.anchor == this.anchor;
    };

    NodeSelection.prototype.toJSON = function toJSON() {
      return {
        type: "node",
        anchor: this.anchor
      };
    };

    NodeSelection.prototype.getBookmark = function getBookmark() {
      return new NodeBookmark(this.anchor);
    };

    NodeSelection.fromJSON = function fromJSON(doc, json) {
      if (typeof json.anchor != "number") {
        throw new RangeError("Invalid input for NodeSelection.fromJSON");
      }

      return new NodeSelection(doc.resolve(json.anchor));
    }; // :: (Node, number) → NodeSelection
    // Create a node selection from non-resolved positions.


    NodeSelection.create = function create(doc, from) {
      return new this(doc.resolve(from));
    }; // :: (Node) → bool
    // Determines whether the given node may be selected as a node
    // selection.


    NodeSelection.isSelectable = function isSelectable(node) {
      return !node.isText && node.type.spec.selectable !== false;
    };

    return NodeSelection;
  }(Selection);

  NodeSelection.prototype.visible = false;
  Selection.jsonID("node", NodeSelection);

  var NodeBookmark = function NodeBookmark(anchor) {
    this.anchor = anchor;
  };

  NodeBookmark.prototype.map = function map(mapping) {
    var ref = mapping.mapResult(this.anchor);
    var deleted = ref.deleted;
    var pos = ref.pos;
    return deleted ? new TextBookmark(pos, pos) : new NodeBookmark(pos);
  };

  NodeBookmark.prototype.resolve = function resolve(doc) {
    var $pos = doc.resolve(this.anchor),
        node = $pos.nodeAfter;

    if (node && NodeSelection.isSelectable(node)) {
      return new NodeSelection($pos);
    }

    return Selection.near($pos);
  }; // ::- A selection type that represents selecting the whole document
  // (which can not necessarily be expressed with a text selection, when
  // there are for example leaf block nodes at the start or end of the
  // document).


  var AllSelection =
  /*@__PURE__*/
  function (Selection) {
    function AllSelection(doc) {
      Selection.call(this, doc.resolve(0), doc.resolve(doc.content.size));
    }

    if (Selection) AllSelection.__proto__ = Selection;
    AllSelection.prototype = Object.create(Selection && Selection.prototype);
    AllSelection.prototype.constructor = AllSelection;

    AllSelection.prototype.toJSON = function toJSON() {
      return {
        type: "all"
      };
    };

    AllSelection.fromJSON = function fromJSON(doc) {
      return new AllSelection(doc);
    };

    AllSelection.prototype.map = function map(doc) {
      return new AllSelection(doc);
    };

    AllSelection.prototype.eq = function eq(other) {
      return other instanceof AllSelection;
    };

    AllSelection.prototype.getBookmark = function getBookmark() {
      return AllBookmark;
    };

    return AllSelection;
  }(Selection);

  Selection.jsonID("all", AllSelection);
  var AllBookmark = {
    map: function map() {
      return this;
    },
    resolve: function resolve(doc) {
      return new AllSelection(doc);
    }
  }; // FIXME we'll need some awareness of text direction when scanning for selections
  // Try to find a selection inside the given node. `pos` points at the
  // position where the search starts. When `text` is true, only return
  // text selections.

  function findSelectionIn(doc, node, pos, index, dir, text) {
    if (node.inlineContent) {
      return TextSelection.create(doc, pos);
    }

    for (var i = index - (dir > 0 ? 0 : 1); dir > 0 ? i < node.childCount : i >= 0; i += dir) {
      var child = node.child(i);

      if (!child.isAtom) {
        var inner = findSelectionIn(doc, child, pos + dir, dir < 0 ? child.childCount : 0, dir, text);

        if (inner) {
          return inner;
        }
      } else if (!text && NodeSelection.isSelectable(child)) {
        return NodeSelection.create(doc, pos - (dir < 0 ? child.nodeSize : 0));
      }

      pos += child.nodeSize * dir;
    }
  }

  function selectionToInsertionEnd(tr, startLen, bias) {
    var last = tr.steps.length - 1;

    if (last < startLen) {
      return;
    }

    var step = tr.steps[last];

    if (!(step instanceof ReplaceStep || step instanceof ReplaceAroundStep)) {
      return;
    }

    var map = tr.mapping.maps[last],
        end;
    map.forEach(function (_from, _to, _newFrom, newTo) {
      if (end == null) {
        end = newTo;
      }
    });
    tr.setSelection(Selection.near(tr.doc.resolve(end), bias));
  }

  var UPDATED_SEL = 1,
      UPDATED_MARKS = 2,
      UPDATED_SCROLL = 4; // ::- An editor state transaction, which can be applied to a state to
  // create an updated state. Use
  // [`EditorState.tr`](#state.EditorState.tr) to create an instance.
  //
  // Transactions track changes to the document (they are a subclass of
  // [`Transform`](#transform.Transform)), but also other state changes,
  // like selection updates and adjustments of the set of [stored
  // marks](#state.EditorState.storedMarks). In addition, you can store
  // metadata properties in a transaction, which are extra pieces of
  // information that client code or plugins can use to describe what a
  // transacion represents, so that they can update their [own
  // state](#state.StateField) accordingly.
  //
  // The [editor view](#view.EditorView) uses a few metadata properties:
  // it will attach a property `"pointer"` with the value `true` to
  // selection transactions directly caused by mouse or touch input, and
  // a `"uiEvent"` property of that may be `"paste"`, `"cut"`, or `"drop"`.

  var Transaction =
  /*@__PURE__*/
  function (Transform) {
    function Transaction(state) {
      Transform.call(this, state.doc); // :: number
      // The timestamp associated with this transaction, in the same
      // format as `Date.now()`.

      this.time = Date.now();
      this.curSelection = state.selection; // The step count for which the current selection is valid.

      this.curSelectionFor = 0; // :: ?[Mark]
      // The stored marks set by this transaction, if any.

      this.storedMarks = state.storedMarks; // Bitfield to track which aspects of the state were updated by
      // this transaction.

      this.updated = 0; // Object used to store metadata properties for the transaction.

      this.meta = Object.create(null);
    }

    if (Transform) Transaction.__proto__ = Transform;
    Transaction.prototype = Object.create(Transform && Transform.prototype);
    Transaction.prototype.constructor = Transaction;
    var prototypeAccessors = {
      selection: {
        configurable: true
      },
      selectionSet: {
        configurable: true
      },
      storedMarksSet: {
        configurable: true
      },
      isGeneric: {
        configurable: true
      },
      scrolledIntoView: {
        configurable: true
      }
    }; // :: Selection
    // The transaction's current selection. This defaults to the editor
    // selection [mapped](#state.Selection.map) through the steps in the
    // transaction, but can be overwritten with
    // [`setSelection`](#state.Transaction.setSelection).

    prototypeAccessors.selection.get = function () {
      if (this.curSelectionFor < this.steps.length) {
        this.curSelection = this.curSelection.map(this.doc, this.mapping.slice(this.curSelectionFor));
        this.curSelectionFor = this.steps.length;
      }

      return this.curSelection;
    }; // :: (Selection) → Transaction
    // Update the transaction's current selection. Will determine the
    // selection that the editor gets when the transaction is applied.


    Transaction.prototype.setSelection = function setSelection(selection) {
      if (selection.$from.doc != this.doc) {
        throw new RangeError("Selection passed to setSelection must point at the current document");
      }

      this.curSelection = selection;
      this.curSelectionFor = this.steps.length;
      this.updated = (this.updated | UPDATED_SEL) & ~UPDATED_MARKS;
      this.storedMarks = null;
      return this;
    }; // :: bool
    // Whether the selection was explicitly updated by this transaction.


    prototypeAccessors.selectionSet.get = function () {
      return (this.updated & UPDATED_SEL) > 0;
    }; // :: (?[Mark]) → Transaction
    // Set the current stored marks.


    Transaction.prototype.setStoredMarks = function setStoredMarks(marks) {
      this.storedMarks = marks;
      this.updated |= UPDATED_MARKS;
      return this;
    }; // :: ([Mark]) → Transaction
    // Make sure the current stored marks or, if that is null, the marks
    // at the selection, match the given set of marks. Does nothing if
    // this is already the case.


    Transaction.prototype.ensureMarks = function ensureMarks(marks) {
      if (!Mark.sameSet(this.storedMarks || this.selection.$from.marks(), marks)) {
        this.setStoredMarks(marks);
      }

      return this;
    }; // :: (Mark) → Transaction
    // Add a mark to the set of stored marks.


    Transaction.prototype.addStoredMark = function addStoredMark(mark) {
      return this.ensureMarks(mark.addToSet(this.storedMarks || this.selection.$head.marks()));
    }; // :: (union<Mark, MarkType>) → Transaction
    // Remove a mark or mark type from the set of stored marks.


    Transaction.prototype.removeStoredMark = function removeStoredMark(mark) {
      return this.ensureMarks(mark.removeFromSet(this.storedMarks || this.selection.$head.marks()));
    }; // :: bool
    // Whether the stored marks were explicitly set for this transaction.


    prototypeAccessors.storedMarksSet.get = function () {
      return (this.updated & UPDATED_MARKS) > 0;
    };

    Transaction.prototype.addStep = function addStep(step, doc) {
      Transform.prototype.addStep.call(this, step, doc);
      this.updated = this.updated & ~UPDATED_MARKS;
      this.storedMarks = null;
    }; // :: (number) → Transaction
    // Update the timestamp for the transaction.


    Transaction.prototype.setTime = function setTime(time) {
      this.time = time;
      return this;
    }; // :: (Slice) → Transaction
    // Replace the current selection with the given slice.


    Transaction.prototype.replaceSelection = function replaceSelection(slice) {
      this.selection.replace(this, slice);
      return this;
    }; // :: (Node, ?bool) → Transaction
    // Replace the selection with the given node. When `inheritMarks` is
    // true and the content is inline, it inherits the marks from the
    // place where it is inserted.


    Transaction.prototype.replaceSelectionWith = function replaceSelectionWith(node, inheritMarks) {
      var selection = this.selection;

      if (inheritMarks !== false) {
        node = node.mark(this.storedMarks || (selection.empty ? selection.$from.marks() : selection.$from.marksAcross(selection.$to) || Mark.none));
      }

      selection.replaceWith(this, node);
      return this;
    }; // :: () → Transaction
    // Delete the selection.


    Transaction.prototype.deleteSelection = function deleteSelection() {
      this.selection.replace(this);
      return this;
    }; // :: (string, from: ?number, to: ?number) → Transaction
    // Replace the given range, or the selection if no range is given,
    // with a text node containing the given string.


    Transaction.prototype.insertText = function insertText(text, from, to) {
      if (to === void 0) to = from;
      var schema = this.doc.type.schema;

      if (from == null) {
        if (!text) {
          return this.deleteSelection();
        }

        return this.replaceSelectionWith(schema.text(text), true);
      } else {
        if (!text) {
          return this.deleteRange(from, to);
        }

        var marks = this.storedMarks;

        if (!marks) {
          var $from = this.doc.resolve(from);
          marks = to == from ? $from.marks() : $from.marksAcross(this.doc.resolve(to));
        }

        this.replaceRangeWith(from, to, schema.text(text, marks));

        if (!this.selection.empty) {
          this.setSelection(Selection.near(this.selection.$to));
        }

        return this;
      }
    }; // :: (union<string, Plugin, PluginKey>, any) → Transaction
    // Store a metadata property in this transaction, keyed either by
    // name or by plugin.


    Transaction.prototype.setMeta = function setMeta(key, value) {
      this.meta[typeof key == "string" ? key : key.key] = value;
      return this;
    }; // :: (union<string, Plugin, PluginKey>) → any
    // Retrieve a metadata property for a given name or plugin.


    Transaction.prototype.getMeta = function getMeta(key) {
      return this.meta[typeof key == "string" ? key : key.key];
    }; // :: bool
    // Returns true if this transaction doesn't contain any metadata,
    // and can thus safely be extended.


    prototypeAccessors.isGeneric.get = function () {
      for (var _ in this.meta) {
        return false;
      }

      return true;
    }; // :: () → Transaction
    // Indicate that the editor should scroll the selection into view
    // when updated to the state produced by this transaction.


    Transaction.prototype.scrollIntoView = function scrollIntoView() {
      this.updated |= UPDATED_SCROLL;
      return this;
    };

    prototypeAccessors.scrolledIntoView.get = function () {
      return (this.updated & UPDATED_SCROLL) > 0;
    };

    Object.defineProperties(Transaction.prototype, prototypeAccessors);
    return Transaction;
  }(Transform);

  function bind(f, self) {
    return !self || !f ? f : f.bind(self);
  }

  var FieldDesc = function FieldDesc(name, desc, self) {
    this.name = name;
    this.init = bind(desc.init, self);
    this.apply = bind(desc.apply, self);
  };

  var baseFields = [new FieldDesc("doc", {
    init: function init(config) {
      return config.doc || config.schema.topNodeType.createAndFill();
    },
    apply: function apply(tr) {
      return tr.doc;
    }
  }), new FieldDesc("selection", {
    init: function init(config, instance) {
      return config.selection || Selection.atStart(instance.doc);
    },
    apply: function apply(tr) {
      return tr.selection;
    }
  }), new FieldDesc("storedMarks", {
    init: function init(config) {
      return config.storedMarks || null;
    },
    apply: function apply(tr, _marks, _old, state) {
      return state.selection.$cursor ? tr.storedMarks : null;
    }
  }), new FieldDesc("scrollToSelection", {
    init: function init() {
      return 0;
    },
    apply: function apply(tr, prev) {
      return tr.scrolledIntoView ? prev + 1 : prev;
    }
  })]; // Object wrapping the part of a state object that stays the same
  // across transactions. Stored in the state's `config` property.

  var Configuration = function Configuration(schema, plugins) {
    var this$1 = this;
    this.schema = schema;
    this.fields = baseFields.concat();
    this.plugins = [];
    this.pluginsByKey = Object.create(null);

    if (plugins) {
      plugins.forEach(function (plugin) {
        if (this$1.pluginsByKey[plugin.key]) {
          throw new RangeError("Adding different instances of a keyed plugin (" + plugin.key + ")");
        }

        this$1.plugins.push(plugin);
        this$1.pluginsByKey[plugin.key] = plugin;

        if (plugin.spec.state) {
          this$1.fields.push(new FieldDesc(plugin.key, plugin.spec.state, plugin));
        }
      });
    }
  }; // ::- The state of a ProseMirror editor is represented by an object
  // of this type. A state is a persistent data structure—it isn't
  // updated, but rather a new state value is computed from an old one
  // using the [`apply`](#state.EditorState.apply) method.
  //
  // A state holds a number of built-in fields, and plugins can
  // [define](#state.PluginSpec.state) additional fields.


  var EditorState = function EditorState(config) {
    this.config = config;
  };

  var prototypeAccessors$1$4 = {
    schema: {
      configurable: true
    },
    plugins: {
      configurable: true
    },
    tr: {
      configurable: true
    }
  }; // doc:: Node
  // The current document.
  // selection:: Selection
  // The selection.
  // storedMarks:: ?[Mark]
  // A set of marks to apply to the next input. Will be null when
  // no explicit marks have been set.
  // :: Schema
  // The schema of the state's document.

  prototypeAccessors$1$4.schema.get = function () {
    return this.config.schema;
  }; // :: [Plugin]
  // The plugins that are active in this state.


  prototypeAccessors$1$4.plugins.get = function () {
    return this.config.plugins;
  }; // :: (Transaction) → EditorState
  // Apply the given transaction to produce a new state.


  EditorState.prototype.apply = function apply(tr) {
    return this.applyTransaction(tr).state;
  }; // : (Transaction) → bool


  EditorState.prototype.filterTransaction = function filterTransaction(tr, ignore) {
    if (ignore === void 0) ignore = -1;

    for (var i = 0; i < this.config.plugins.length; i++) {
      if (i != ignore) {
        var plugin = this.config.plugins[i];

        if (plugin.spec.filterTransaction && !plugin.spec.filterTransaction.call(plugin, tr, this)) {
          return false;
        }
      }
    }

    return true;
  }; // :: (Transaction) → {state: EditorState, transactions: [Transaction]}
  // Verbose variant of [`apply`](#state.EditorState.apply) that
  // returns the precise transactions that were applied (which might
  // be influenced by the [transaction
  // hooks](#state.PluginSpec.filterTransaction) of
  // plugins) along with the new state.


  EditorState.prototype.applyTransaction = function applyTransaction(rootTr) {
    if (!this.filterTransaction(rootTr)) {
      return {
        state: this,
        transactions: []
      };
    }

    var trs = [rootTr],
        newState = this.applyInner(rootTr),
        seen = null; // This loop repeatedly gives plugins a chance to respond to
    // transactions as new transactions are added, making sure to only
    // pass the transactions the plugin did not see before.

    for (;;) {
      var haveNew = false;

      for (var i = 0; i < this.config.plugins.length; i++) {
        var plugin = this.config.plugins[i];

        if (plugin.spec.appendTransaction) {
          var n = seen ? seen[i].n : 0,
              oldState = seen ? seen[i].state : this;
          var tr = n < trs.length && plugin.spec.appendTransaction.call(plugin, n ? trs.slice(n) : trs, oldState, newState);

          if (tr && newState.filterTransaction(tr, i)) {
            tr.setMeta("appendedTransaction", rootTr);

            if (!seen) {
              seen = [];

              for (var j = 0; j < this.config.plugins.length; j++) {
                seen.push(j < i ? {
                  state: newState,
                  n: trs.length
                } : {
                  state: this,
                  n: 0
                });
              }
            }

            trs.push(tr);
            newState = newState.applyInner(tr);
            haveNew = true;
          }

          if (seen) {
            seen[i] = {
              state: newState,
              n: trs.length
            };
          }
        }
      }

      if (!haveNew) {
        return {
          state: newState,
          transactions: trs
        };
      }
    }
  }; // : (Transaction) → EditorState


  EditorState.prototype.applyInner = function applyInner(tr) {
    if (!tr.before.eq(this.doc)) {
      throw new RangeError("Applying a mismatched transaction");
    }

    var newInstance = new EditorState(this.config),
        fields = this.config.fields;

    for (var i = 0; i < fields.length; i++) {
      var field = fields[i];
      newInstance[field.name] = field.apply(tr, this[field.name], this, newInstance);
    }

    for (var i$1 = 0; i$1 < applyListeners.length; i$1++) {
      applyListeners[i$1](this, tr, newInstance);
    }

    return newInstance;
  }; // :: Transaction
  // Start a [transaction](#state.Transaction) from this state.


  prototypeAccessors$1$4.tr.get = function () {
    return new Transaction(this);
  }; // :: (Object) → EditorState
  // Create a new state.
  //
  // config::- Configuration options. Must contain `schema` or `doc` (or both).
  //
  //    schema:: ?Schema
  //    The schema to use.
  //
  //    doc:: ?Node
  //    The starting document.
  //
  //    selection:: ?Selection
  //    A valid selection in the document.
  //
  //    storedMarks:: ?[Mark]
  //    The initial set of [stored marks](#state.EditorState.storedMarks).
  //
  //    plugins:: ?[Plugin]
  //    The plugins that should be active in this state.


  EditorState.create = function create(config) {
    var $config = new Configuration(config.schema || config.doc.type.schema, config.plugins);
    var instance = new EditorState($config);

    for (var i = 0; i < $config.fields.length; i++) {
      instance[$config.fields[i].name] = $config.fields[i].init(config, instance);
    }

    return instance;
  }; // :: (Object) → EditorState
  // Create a new state based on this one, but with an adjusted set of
  // active plugins. State fields that exist in both sets of plugins
  // are kept unchanged. Those that no longer exist are dropped, and
  // those that are new are initialized using their
  // [`init`](#state.StateField.init) method, passing in the new
  // configuration object..
  //
  // config::- configuration options
  //
  //   schema:: ?Schema
  //   New schema to use.
  //
  //   plugins:: ?[Plugin]
  //   New set of active plugins.


  EditorState.prototype.reconfigure = function reconfigure(config) {
    var $config = new Configuration(config.schema || this.schema, config.plugins);
    var fields = $config.fields,
        instance = new EditorState($config);

    for (var i = 0; i < fields.length; i++) {
      var name = fields[i].name;
      instance[name] = this.hasOwnProperty(name) ? this[name] : fields[i].init(config, instance);
    }

    return instance;
  }; // :: (?union<Object<Plugin>, string, number>) → Object
  // Serialize this state to JSON. If you want to serialize the state
  // of plugins, pass an object mapping property names to use in the
  // resulting JSON object to plugin objects. The argument may also be
  // a string or number, in which case it is ignored, to support the
  // way `JSON.stringify` calls `toString` methods.


  EditorState.prototype.toJSON = function toJSON(pluginFields) {
    var result = {
      doc: this.doc.toJSON(),
      selection: this.selection.toJSON()
    };

    if (this.storedMarks) {
      result.storedMarks = this.storedMarks.map(function (m) {
        return m.toJSON();
      });
    }

    if (pluginFields && typeof pluginFields == 'object') {
      for (var prop in pluginFields) {
        if (prop == "doc" || prop == "selection") {
          throw new RangeError("The JSON fields `doc` and `selection` are reserved");
        }

        var plugin = pluginFields[prop],
            state = plugin.spec.state;

        if (state && state.toJSON) {
          result[prop] = state.toJSON.call(plugin, this[plugin.key]);
        }
      }
    }

    return result;
  }; // :: (Object, Object, ?Object<Plugin>) → EditorState
  // Deserialize a JSON representation of a state. `config` should
  // have at least a `schema` field, and should contain array of
  // plugins to initialize the state with. `pluginFields` can be used
  // to deserialize the state of plugins, by associating plugin
  // instances with the property names they use in the JSON object.
  //
  // config::- configuration options
  //
  //   schema:: Schema
  //   The schema to use.
  //
  //   plugins:: ?[Plugin]
  //   The set of active plugins.


  EditorState.fromJSON = function fromJSON(config, json, pluginFields) {
    if (!json) {
      throw new RangeError("Invalid input for EditorState.fromJSON");
    }

    if (!config.schema) {
      throw new RangeError("Required config field 'schema' missing");
    }

    var $config = new Configuration(config.schema, config.plugins);
    var instance = new EditorState($config);
    $config.fields.forEach(function (field) {
      if (field.name == "doc") {
        instance.doc = Node$1.fromJSON(config.schema, json.doc);
      } else if (field.name == "selection") {
        instance.selection = Selection.fromJSON(instance.doc, json.selection);
      } else if (field.name == "storedMarks") {
        if (json.storedMarks) {
          instance.storedMarks = json.storedMarks.map(config.schema.markFromJSON);
        }
      } else {
        if (pluginFields) {
          for (var prop in pluginFields) {
            var plugin = pluginFields[prop],
                state = plugin.spec.state;

            if (plugin.key == field.name && state && state.fromJSON && Object.prototype.hasOwnProperty.call(json, prop)) {
              // This field belongs to a plugin mapped to a JSON field, read it from there.
              instance[field.name] = state.fromJSON.call(plugin, config, json[prop], instance);
              return;
            }
          }
        }

        instance[field.name] = field.init(config, instance);
      }
    });
    return instance;
  }; // Kludge to allow the view to track mappings between different
  // instances of a state.
  //
  // FIXME this is no longer needed as of prosemirror-view 1.9.0,
  // though due to backwards-compat we should probably keep it around
  // for a while (if only as a no-op)


  EditorState.addApplyListener = function addApplyListener(f) {
    applyListeners.push(f);
  };

  EditorState.removeApplyListener = function removeApplyListener(f) {
    var found = applyListeners.indexOf(f);

    if (found > -1) {
      applyListeners.splice(found, 1);
    }
  };

  Object.defineProperties(EditorState.prototype, prototypeAccessors$1$4);
  var applyListeners = []; // PluginSpec:: interface
  //
  // This is the type passed to the [`Plugin`](#state.Plugin)
  // constructor. It provides a definition for a plugin.
  //
  //   props:: ?EditorProps
  //   The [view props](#view.EditorProps) added by this plugin. Props
  //   that are functions will be bound to have the plugin instance as
  //   their `this` binding.
  //
  //   state:: ?StateField<any>
  //   Allows a plugin to define a [state field](#state.StateField), an
  //   extra slot in the state object in which it can keep its own data.
  //
  //   key:: ?PluginKey
  //   Can be used to make this a keyed plugin. You can have only one
  //   plugin with a given key in a given state, but it is possible to
  //   access the plugin's configuration and state through the key,
  //   without having access to the plugin instance object.
  //
  //   view:: ?(EditorView) → Object
  //   When the plugin needs to interact with the editor view, or
  //   set something up in the DOM, use this field. The function
  //   will be called when the plugin's state is associated with an
  //   editor view.
  //
  //     return::-
  //     Should return an object with the following optional
  //     properties:
  //
  //       update:: ?(view: EditorView, prevState: EditorState)
  //       Called whenever the view's state is updated.
  //
  //       destroy:: ?()
  //       Called when the view is destroyed or receives a state
  //       with different plugins.
  //
  //   filterTransaction:: ?(Transaction, EditorState) → bool
  //   When present, this will be called before a transaction is
  //   applied by the state, allowing the plugin to cancel it (by
  //   returning false).
  //
  //   appendTransaction:: ?(transactions: [Transaction], oldState: EditorState, newState: EditorState) → ?Transaction
  //   Allows the plugin to append another transaction to be applied
  //   after the given array of transactions. When another plugin
  //   appends a transaction after this was called, it is called again
  //   with the new state and new transactions—but only the new
  //   transactions, i.e. it won't be passed transactions that it
  //   already saw.

  function bindProps(obj, self, target) {
    for (var prop in obj) {
      var val = obj[prop];

      if (val instanceof Function) {
        val = val.bind(self);
      } else if (prop == "handleDOMEvents") {
        val = bindProps(val, self, {});
      }

      target[prop] = val;
    }

    return target;
  } // ::- Plugins bundle functionality that can be added to an editor.
  // They are part of the [editor state](#state.EditorState) and
  // may influence that state and the view that contains it.


  var Plugin = function Plugin(spec) {
    // :: EditorProps
    // The [props](#view.EditorProps) exported by this plugin.
    this.props = {};

    if (spec.props) {
      bindProps(spec.props, this, this.props);
    } // :: Object
    // The plugin's [spec object](#state.PluginSpec).


    this.spec = spec;
    this.key = spec.key ? spec.key.key : createKey("plugin");
  }; // :: (EditorState) → any
  // Extract the plugin's state field from an editor state.


  Plugin.prototype.getState = function getState(state) {
    return state[this.key];
  }; // StateField:: interface<T>
  // A plugin spec may provide a state field (under its
  // [`state`](#state.PluginSpec.state) property) of this type, which
  // describes the state it wants to keep. Functions provided here are
  // always called with the plugin instance as their `this` binding.
  //
  //   init:: (config: Object, instance: EditorState) → T
  //   Initialize the value of the field. `config` will be the object
  //   passed to [`EditorState.create`](#state.EditorState^create). Note
  //   that `instance` is a half-initialized state instance, and will
  //   not have values for plugin fields initialized after this one.
  //
  //   apply:: (tr: Transaction, value: T, oldState: EditorState, newState: EditorState) → T
  //   Apply the given transaction to this state field, producing a new
  //   field value. Note that the `newState` argument is again a partially
  //   constructed state does not yet contain the state from plugins
  //   coming after this one.
  //
  //   toJSON:: ?(value: T) → *
  //   Convert this field to JSON. Optional, can be left off to disable
  //   JSON serialization for the field.
  //
  //   fromJSON:: ?(config: Object, value: *, state: EditorState) → T
  //   Deserialize the JSON representation of this field. Note that the
  //   `state` argument is again a half-initialized state.


  var keys = Object.create(null);

  function createKey(name) {
    if (name in keys) {
      return name + "$" + ++keys[name];
    }

    keys[name] = 0;
    return name + "$";
  } // ::- A key is used to [tag](#state.PluginSpec.key)
  // plugins in a way that makes it possible to find them, given an
  // editor state. Assigning a key does mean only one plugin of that
  // type can be active in a state.


  var PluginKey = function PluginKey(name) {
    if (name === void 0) name = "key";
    this.key = createKey(name);
  }; // :: (EditorState) → ?Plugin
  // Get the active plugin with this key, if any, from an editor
  // state.


  PluginKey.prototype.get = function get(state) {
    return state.config.pluginsByKey[this.key];
  }; // :: (EditorState) → ?any
  // Get the plugin's state from an editor state.


  PluginKey.prototype.getState = function getState(state) {
    return state[this.key];
  };

  var result = {};

  if (typeof navigator != "undefined" && typeof document != "undefined") {
    var ie_edge = /Edge\/(\d+)/.exec(navigator.userAgent);
    var ie_upto10 = /MSIE \d/.test(navigator.userAgent);
    var ie_11up = /Trident\/(?:[7-9]|\d{2,})\..*rv:(\d+)/.exec(navigator.userAgent);
    result.mac = /Mac/.test(navigator.platform);
    var ie = result.ie = !!(ie_upto10 || ie_11up || ie_edge);
    result.ie_version = ie_upto10 ? document.documentMode || 6 : ie_11up ? +ie_11up[1] : ie_edge ? +ie_edge[1] : null;
    result.gecko = !ie && /gecko\/(\d+)/i.test(navigator.userAgent);
    result.gecko_version = result.gecko && +(/Firefox\/(\d+)/.exec(navigator.userAgent) || [0, 0])[1];
    var chrome = !ie && /Chrome\/(\d+)/.exec(navigator.userAgent);
    result.chrome = !!chrome;
    result.chrome_version = chrome && +chrome[1];
    result.ios = !ie && /AppleWebKit/.test(navigator.userAgent) && /Mobile\/\w+/.test(navigator.userAgent);
    result.android = /Android \d/.test(navigator.userAgent);
    result.webkit = !ie && 'WebkitAppearance' in document.documentElement.style;
    result.safari = /Apple Computer/.test(navigator.vendor);
    result.webkit_version = result.webkit && +(/\bAppleWebKit\/(\d+)/.exec(navigator.userAgent) || [0, 0])[1];
  }

  var domIndex = function (node) {
    for (var index = 0;; index++) {
      node = node.previousSibling;

      if (!node) {
        return index;
      }
    }
  };

  var parentNode = function (node) {
    var parent = node.parentNode;
    return parent && parent.nodeType == 11 ? parent.host : parent;
  };

  var textRange = function (node, from, to) {
    var range = document.createRange();
    range.setEnd(node, to == null ? node.nodeValue.length : to);
    range.setStart(node, from || 0);
    return range;
  }; // Scans forward and backward through DOM positions equivalent to the
  // given one to see if the two are in the same place (i.e. after a
  // text node vs at the end of that text node)


  var isEquivalentPosition = function (node, off, targetNode, targetOff) {
    return targetNode && (scanFor(node, off, targetNode, targetOff, -1) || scanFor(node, off, targetNode, targetOff, 1));
  };

  var atomElements = /^(img|br|input|textarea|hr)$/i;

  function scanFor(node, off, targetNode, targetOff, dir) {
    for (;;) {
      if (node == targetNode && off == targetOff) {
        return true;
      }

      if (off == (dir < 0 ? 0 : nodeSize(node))) {
        var parent = node.parentNode;

        if (parent.nodeType != 1 || hasBlockDesc(node) || atomElements.test(node.nodeName) || node.contentEditable == "false") {
          return false;
        }

        off = domIndex(node) + (dir < 0 ? 0 : 1);
        node = parent;
      } else if (node.nodeType == 1) {
        node = node.childNodes[off + (dir < 0 ? -1 : 0)];
        off = dir < 0 ? nodeSize(node) : 0;
      } else {
        return false;
      }
    }
  }

  function nodeSize(node) {
    return node.nodeType == 3 ? node.nodeValue.length : node.childNodes.length;
  }

  function hasBlockDesc(dom) {
    var desc;

    for (var cur = dom; cur; cur = cur.parentNode) {
      if (desc = cur.pmViewDesc) {
        break;
      }
    }

    return desc && desc.node && desc.node.isBlock && (desc.dom == dom || desc.contentDOM == dom);
  } // Work around Chrome issue https://bugs.chromium.org/p/chromium/issues/detail?id=447523
  // (isCollapsed inappropriately returns true in shadow dom)


  var selectionCollapsed = function (domSel) {
    var collapsed = domSel.isCollapsed;

    if (collapsed && result.chrome && domSel.rangeCount && !domSel.getRangeAt(0).collapsed) {
      collapsed = false;
    }

    return collapsed;
  };

  function keyEvent(keyCode, key) {
    var event = document.createEvent("Event");
    event.initEvent("keydown", true, true);
    event.keyCode = keyCode;
    event.key = event.code = key;
    return event;
  }

  function windowRect(win) {
    return {
      left: 0,
      right: win.innerWidth,
      top: 0,
      bottom: win.innerHeight
    };
  }

  function getSide(value, side) {
    return typeof value == "number" ? value : value[side];
  }

  function scrollRectIntoView(view, rect, startDOM) {
    var scrollThreshold = view.someProp("scrollThreshold") || 0,
        scrollMargin = view.someProp("scrollMargin") || 5;
    var doc = view.dom.ownerDocument,
        win = doc.defaultView;

    for (var parent = startDOM || view.dom;; parent = parentNode(parent)) {
      if (!parent) {
        break;
      }

      if (parent.nodeType != 1) {
        continue;
      }

      var atTop = parent == doc.body || parent.nodeType != 1;
      var bounding = atTop ? windowRect(win) : parent.getBoundingClientRect();
      var moveX = 0,
          moveY = 0;

      if (rect.top < bounding.top + getSide(scrollThreshold, "top")) {
        moveY = -(bounding.top - rect.top + getSide(scrollMargin, "top"));
      } else if (rect.bottom > bounding.bottom - getSide(scrollThreshold, "bottom")) {
        moveY = rect.bottom - bounding.bottom + getSide(scrollMargin, "bottom");
      }

      if (rect.left < bounding.left + getSide(scrollThreshold, "left")) {
        moveX = -(bounding.left - rect.left + getSide(scrollMargin, "left"));
      } else if (rect.right > bounding.right - getSide(scrollThreshold, "right")) {
        moveX = rect.right - bounding.right + getSide(scrollMargin, "right");
      }

      if (moveX || moveY) {
        if (atTop) {
          win.scrollBy(moveX, moveY);
        } else {
          if (moveY) {
            parent.scrollTop += moveY;
          }

          if (moveX) {
            parent.scrollLeft += moveX;
          }
        }
      }

      if (atTop) {
        break;
      }
    }
  } // Store the scroll position of the editor's parent nodes, along with
  // the top position of an element near the top of the editor, which
  // will be used to make sure the visible viewport remains stable even
  // when the size of the content above changes.


  function storeScrollPos(view) {
    var rect = view.dom.getBoundingClientRect(),
        startY = Math.max(0, rect.top);
    var refDOM, refTop;

    for (var x = (rect.left + rect.right) / 2, y = startY + 1; y < Math.min(innerHeight, rect.bottom); y += 5) {
      var dom = view.root.elementFromPoint(x, y);

      if (dom == view.dom || !view.dom.contains(dom)) {
        continue;
      }

      var localRect = dom.getBoundingClientRect();

      if (localRect.top >= startY - 20) {
        refDOM = dom;
        refTop = localRect.top;
        break;
      }
    }

    return {
      refDOM: refDOM,
      refTop: refTop,
      stack: scrollStack(view.dom)
    };
  }

  function scrollStack(dom) {
    var stack = [],
        doc = dom.ownerDocument;

    for (; dom; dom = parentNode(dom)) {
      stack.push({
        dom: dom,
        top: dom.scrollTop,
        left: dom.scrollLeft
      });

      if (dom == doc) {
        break;
      }
    }

    return stack;
  } // Reset the scroll position of the editor's parent nodes to that what
  // it was before, when storeScrollPos was called.


  function resetScrollPos(ref) {
    var refDOM = ref.refDOM;
    var refTop = ref.refTop;
    var stack = ref.stack;
    var newRefTop = refDOM ? refDOM.getBoundingClientRect().top : 0;
    restoreScrollStack(stack, newRefTop == 0 ? 0 : newRefTop - refTop);
  }

  function restoreScrollStack(stack, dTop) {
    for (var i = 0; i < stack.length; i++) {
      var ref = stack[i];
      var dom = ref.dom;
      var top = ref.top;
      var left = ref.left;

      if (dom.scrollTop != top + dTop) {
        dom.scrollTop = top + dTop;
      }

      if (dom.scrollLeft != left) {
        dom.scrollLeft = left;
      }
    }
  }

  var preventScrollSupported = null; // Feature-detects support for .focus({preventScroll: true}), and uses
  // a fallback kludge when not supported.

  function focusPreventScroll(dom) {
    if (dom.setActive) {
      return dom.setActive();
    } // in IE


    if (preventScrollSupported) {
      return dom.focus(preventScrollSupported);
    }

    var stored = scrollStack(dom);
    dom.focus(preventScrollSupported == null ? {
      get preventScroll() {
        preventScrollSupported = {
          preventScroll: true
        };
        return true;
      }

    } : undefined);

    if (!preventScrollSupported) {
      preventScrollSupported = false;
      restoreScrollStack(stored, 0);
    }
  }

  function findOffsetInNode(node, coords) {
    var closest,
        dxClosest = 2e8,
        coordsClosest,
        offset = 0;
    var rowBot = coords.top,
        rowTop = coords.top;

    for (var child = node.firstChild, childIndex = 0; child; child = child.nextSibling, childIndex++) {
      var rects = void 0;

      if (child.nodeType == 1) {
        rects = child.getClientRects();
      } else if (child.nodeType == 3) {
        rects = textRange(child).getClientRects();
      } else {
        continue;
      }

      for (var i = 0; i < rects.length; i++) {
        var rect = rects[i];

        if (rect.top <= rowBot && rect.bottom >= rowTop) {
          rowBot = Math.max(rect.bottom, rowBot);
          rowTop = Math.min(rect.top, rowTop);
          var dx = rect.left > coords.left ? rect.left - coords.left : rect.right < coords.left ? coords.left - rect.right : 0;

          if (dx < dxClosest) {
            closest = child;
            dxClosest = dx;
            coordsClosest = dx && closest.nodeType == 3 ? {
              left: rect.right < coords.left ? rect.right : rect.left,
              top: coords.top
            } : coords;

            if (child.nodeType == 1 && dx) {
              offset = childIndex + (coords.left >= (rect.left + rect.right) / 2 ? 1 : 0);
            }

            continue;
          }
        }

        if (!closest && (coords.left >= rect.right && coords.top >= rect.top || coords.left >= rect.left && coords.top >= rect.bottom)) {
          offset = childIndex + 1;
        }
      }
    }

    if (closest && closest.nodeType == 3) {
      return findOffsetInText(closest, coordsClosest);
    }

    if (!closest || dxClosest && closest.nodeType == 1) {
      return {
        node: node,
        offset: offset
      };
    }

    return findOffsetInNode(closest, coordsClosest);
  }

  function findOffsetInText(node, coords) {
    var len = node.nodeValue.length;
    var range = document.createRange();

    for (var i = 0; i < len; i++) {
      range.setEnd(node, i + 1);
      range.setStart(node, i);
      var rect = singleRect(range, 1);

      if (rect.top == rect.bottom) {
        continue;
      }

      if (inRect(coords, rect)) {
        return {
          node: node,
          offset: i + (coords.left >= (rect.left + rect.right) / 2 ? 1 : 0)
        };
      }
    }

    return {
      node: node,
      offset: 0
    };
  }

  function inRect(coords, rect) {
    return coords.left >= rect.left - 1 && coords.left <= rect.right + 1 && coords.top >= rect.top - 1 && coords.top <= rect.bottom + 1;
  }

  function targetKludge(dom, coords) {
    var parent = dom.parentNode;

    if (parent && /^li$/i.test(parent.nodeName) && coords.left < dom.getBoundingClientRect().left) {
      return parent;
    }

    return dom;
  }

  function posFromElement(view, elt, coords) {
    var ref = findOffsetInNode(elt, coords);
    var node = ref.node;
    var offset = ref.offset;
    var bias = -1;

    if (node.nodeType == 1 && !node.firstChild) {
      var rect = node.getBoundingClientRect();
      bias = rect.left != rect.right && coords.left > (rect.left + rect.right) / 2 ? 1 : -1;
    }

    return view.docView.posFromDOM(node, offset, bias);
  }

  function posFromCaret(view, node, offset, coords) {
    // Browser (in caretPosition/RangeFromPoint) will agressively
    // normalize towards nearby inline nodes. Since we are interested in
    // positions between block nodes too, we first walk up the hierarchy
    // of nodes to see if there are block nodes that the coordinates
    // fall outside of. If so, we take the position before/after that
    // block. If not, we call `posFromDOM` on the raw node/offset.
    var outside = -1;

    for (var cur = node;;) {
      if (cur == view.dom) {
        break;
      }

      var desc = view.docView.nearestDesc(cur, true);

      if (!desc) {
        return null;
      }

      if (desc.node.isBlock && desc.parent) {
        var rect = desc.dom.getBoundingClientRect();

        if (rect.left > coords.left || rect.top > coords.top) {
          outside = desc.posBefore;
        } else if (rect.right < coords.left || rect.bottom < coords.top) {
          outside = desc.posAfter;
        } else {
          break;
        }
      }

      cur = desc.dom.parentNode;
    }

    return outside > -1 ? outside : view.docView.posFromDOM(node, offset);
  }

  function elementFromPoint(element, coords, box) {
    var len = element.childNodes.length;

    if (len && box.top < box.bottom) {
      for (var startI = Math.max(0, Math.min(len - 1, Math.floor(len * (coords.top - box.top) / (box.bottom - box.top)) - 2)), i = startI;;) {
        var child = element.childNodes[i];

        if (child.nodeType == 1) {
          var rects = child.getClientRects();

          for (var j = 0; j < rects.length; j++) {
            var rect = rects[j];

            if (inRect(coords, rect)) {
              return elementFromPoint(child, coords, rect);
            }
          }
        }

        if ((i = (i + 1) % len) == startI) {
          break;
        }
      }
    }

    return element;
  } // Given an x,y position on the editor, get the position in the document.


  function posAtCoords(view, coords) {
    var assign, assign$1;
    var root = view.root,
        node,
        offset;

    if (root.caretPositionFromPoint) {
      try {
        // Firefox throws for this call in hard-to-predict circumstances (#994)
        var pos$1 = root.caretPositionFromPoint(coords.left, coords.top);

        if (pos$1) {
          assign = pos$1, node = assign.offsetNode, offset = assign.offset;
        }
      } catch (_) {}
    }

    if (!node && root.caretRangeFromPoint) {
      var range = root.caretRangeFromPoint(coords.left, coords.top);

      if (range) {
        assign$1 = range, node = assign$1.startContainer, offset = assign$1.startOffset;
      }
    }

    var elt = root.elementFromPoint(coords.left, coords.top + 1),
        pos;

    if (!elt || !view.dom.contains(elt.nodeType != 1 ? elt.parentNode : elt)) {
      var box = view.dom.getBoundingClientRect();

      if (!inRect(coords, box)) {
        return null;
      }

      elt = elementFromPoint(view.dom, coords, box);

      if (!elt) {
        return null;
      }
    }

    elt = targetKludge(elt, coords);

    if (node) {
      if (result.gecko && node.nodeType == 1) {
        // Firefox will sometimes return offsets into <input> nodes, which
        // have no actual children, from caretPositionFromPoint (#953)
        offset = Math.min(offset, node.childNodes.length); // It'll also move the returned position before image nodes,
        // even if those are behind it.

        if (offset < node.childNodes.length) {
          var next = node.childNodes[offset],
              box$1;

          if (next.nodeName == "IMG" && (box$1 = next.getBoundingClientRect()).right <= coords.left && box$1.bottom > coords.top) {
            offset++;
          }
        }
      } // Suspiciously specific kludge to work around caret*FromPoint
      // never returning a position at the end of the document


      if (node == view.dom && offset == node.childNodes.length - 1 && node.lastChild.nodeType == 1 && coords.top > node.lastChild.getBoundingClientRect().bottom) {
        pos = view.state.doc.content.size;
      } // Ignore positions directly after a BR, since caret*FromPoint
      // 'round up' positions that would be more accurately placed
      // before the BR node.
      else if (offset == 0 || node.nodeType != 1 || node.childNodes[offset - 1].nodeName != "BR") {
          pos = posFromCaret(view, node, offset, coords);
        }
    }

    if (pos == null) {
      pos = posFromElement(view, elt, coords);
    }

    var desc = view.docView.nearestDesc(elt, true);
    return {
      pos: pos,
      inside: desc ? desc.posAtStart - desc.border : -1
    };
  }

  function singleRect(object, bias) {
    var rects = object.getClientRects();
    return !rects.length ? object.getBoundingClientRect() : rects[bias < 0 ? 0 : rects.length - 1];
  } // : (EditorView, number) → {left: number, top: number, right: number, bottom: number}
  // Given a position in the document model, get a bounding box of the
  // character at that position, relative to the window.


  function coordsAtPos(view, pos) {
    var ref = view.docView.domFromPos(pos);
    var node = ref.node;
    var offset = ref.offset; // These browsers support querying empty text ranges

    if (node.nodeType == 3 && (result.chrome || result.gecko)) {
      var rect = singleRect(textRange(node, offset, offset), 0); // Firefox returns bad results (the position before the space)
      // when querying a position directly after line-broken
      // whitespace. Detect this situation and and kludge around it

      if (result.gecko && offset && /\s/.test(node.nodeValue[offset - 1]) && offset < node.nodeValue.length) {
        var rectBefore = singleRect(textRange(node, offset - 1, offset - 1), -1);

        if (Math.abs(rectBefore.left - rect.left) < 1 && rectBefore.top == rect.top) {
          var rectAfter = singleRect(textRange(node, offset, offset + 1), -1);
          return flattenV(rectAfter, rectAfter.left < rectBefore.left);
        }
      }

      return rect;
    }

    if (node.nodeType == 1 && !view.state.doc.resolve(pos).parent.inlineContent) {
      // Return a horizontal line in block context
      var top = true,
          rect$1;

      if (offset < node.childNodes.length) {
        var after = node.childNodes[offset];

        if (after.nodeType == 1) {
          rect$1 = after.getBoundingClientRect();
        }
      }

      if (!rect$1 && offset) {
        var before = node.childNodes[offset - 1];

        if (before.nodeType == 1) {
          rect$1 = before.getBoundingClientRect();
          top = false;
        }
      }

      return flattenH(rect$1 || node.getBoundingClientRect(), top);
    } // Not Firefox/Chrome, or not in a text node, so we have to use
    // actual element/character rectangles to get a solution (this part
    // is not very bidi-safe)
    //
    // Try the left side first, fall back to the right one if that
    // doesn't work.


    for (var dir = -1; dir < 2; dir += 2) {
      if (dir < 0 && offset) {
        var prev = void 0,
            target = node.nodeType == 3 ? textRange(node, offset - 1, offset) : (prev = node.childNodes[offset - 1]).nodeType == 3 ? textRange(prev) : prev.nodeType == 1 && prev.nodeName != "BR" ? prev : null; // BR nodes tend to only return the rectangle before them

        if (target) {
          var rect$2 = singleRect(target, 1);

          if (rect$2.top < rect$2.bottom) {
            return flattenV(rect$2, false);
          }
        }
      } else if (dir > 0 && offset < nodeSize(node)) {
        var next = void 0,
            target$1 = node.nodeType == 3 ? textRange(node, offset, offset + 1) : (next = node.childNodes[offset]).nodeType == 3 ? textRange(next) : next.nodeType == 1 ? next : null;

        if (target$1) {
          var rect$3 = singleRect(target$1, -1);

          if (rect$3.top < rect$3.bottom) {
            return flattenV(rect$3, true);
          }
        }
      }
    } // All else failed, just try to get a rectangle for the target node


    return flattenV(singleRect(node.nodeType == 3 ? textRange(node) : node, 0), false);
  }

  function flattenV(rect, left) {
    if (rect.width == 0) {
      return rect;
    }

    var x = left ? rect.left : rect.right;
    return {
      top: rect.top,
      bottom: rect.bottom,
      left: x,
      right: x
    };
  }

  function flattenH(rect, top) {
    if (rect.height == 0) {
      return rect;
    }

    var y = top ? rect.top : rect.bottom;
    return {
      top: y,
      bottom: y,
      left: rect.left,
      right: rect.right
    };
  }

  function withFlushedState(view, state, f) {
    var viewState = view.state,
        active = view.root.activeElement;

    if (viewState != state) {
      view.updateState(state);
    }

    if (active != view.dom) {
      view.focus();
    }

    try {
      return f();
    } finally {
      if (viewState != state) {
        view.updateState(viewState);
      }

      if (active != view.dom) {
        active.focus();
      }
    }
  } // : (EditorView, number, number)
  // Whether vertical position motion in a given direction
  // from a position would leave a text block.


  function endOfTextblockVertical(view, state, dir) {
    var sel = state.selection;
    var $pos = dir == "up" ? sel.$anchor.min(sel.$head) : sel.$anchor.max(sel.$head);
    return withFlushedState(view, state, function () {
      var ref = view.docView.domFromPos($pos.pos);
      var dom = ref.node;

      for (;;) {
        var nearest = view.docView.nearestDesc(dom, true);

        if (!nearest) {
          break;
        }

        if (nearest.node.isBlock) {
          dom = nearest.dom;
          break;
        }

        dom = nearest.dom.parentNode;
      }

      var coords = coordsAtPos(view, $pos.pos);

      for (var child = dom.firstChild; child; child = child.nextSibling) {
        var boxes = void 0;

        if (child.nodeType == 1) {
          boxes = child.getClientRects();
        } else if (child.nodeType == 3) {
          boxes = textRange(child, 0, child.nodeValue.length).getClientRects();
        } else {
          continue;
        }

        for (var i = 0; i < boxes.length; i++) {
          var box = boxes[i];

          if (box.bottom > box.top && (dir == "up" ? box.bottom < coords.top + 1 : box.top > coords.bottom - 1)) {
            return false;
          }
        }
      }

      return true;
    });
  }

  var maybeRTL = /[\u0590-\u08ac]/;

  function endOfTextblockHorizontal(view, state, dir) {
    var ref = state.selection;
    var $head = ref.$head;

    if (!$head.parent.isTextblock) {
      return false;
    }

    var offset = $head.parentOffset,
        atStart = !offset,
        atEnd = offset == $head.parent.content.size;
    var sel = getSelection(); // If the textblock is all LTR, or the browser doesn't support
    // Selection.modify (Edge), fall back to a primitive approach

    if (!maybeRTL.test($head.parent.textContent) || !sel.modify) {
      return dir == "left" || dir == "backward" ? atStart : atEnd;
    }

    return withFlushedState(view, state, function () {
      // This is a huge hack, but appears to be the best we can
      // currently do: use `Selection.modify` to move the selection by
      // one character, and see if that moves the cursor out of the
      // textblock (or doesn't move it at all, when at the start/end of
      // the document).
      var oldRange = sel.getRangeAt(0),
          oldNode = sel.focusNode,
          oldOff = sel.focusOffset;
      var oldBidiLevel = sel.caretBidiLevel; // Only for Firefox

      sel.modify("move", dir, "character");
      var parentDOM = $head.depth ? view.docView.domAfterPos($head.before()) : view.dom;
      var result = !parentDOM.contains(sel.focusNode.nodeType == 1 ? sel.focusNode : sel.focusNode.parentNode) || oldNode == sel.focusNode && oldOff == sel.focusOffset; // Restore the previous selection

      sel.removeAllRanges();
      sel.addRange(oldRange);

      if (oldBidiLevel != null) {
        sel.caretBidiLevel = oldBidiLevel;
      }

      return result;
    });
  }

  var cachedState = null,
      cachedDir = null,
      cachedResult = false;

  function endOfTextblock(view, state, dir) {
    if (cachedState == state && cachedDir == dir) {
      return cachedResult;
    }

    cachedState = state;
    cachedDir = dir;
    return cachedResult = dir == "up" || dir == "down" ? endOfTextblockVertical(view, state, dir) : endOfTextblockHorizontal(view, state, dir);
  } // NodeView:: interface
  //
  // By default, document nodes are rendered using the result of the
  // [`toDOM`](#model.NodeSpec.toDOM) method of their spec, and managed
  // entirely by the editor. For some use cases, such as embedded
  // node-specific editing interfaces, you want more control over
  // the behavior of a node's in-editor representation, and need to
  // [define](#view.EditorProps.nodeViews) a custom node view.
  //
  // Objects returned as node views must conform to this interface.
  //
  //   dom:: ?dom.Node
  //   The outer DOM node that represents the document node. When not
  //   given, the default strategy is used to create a DOM node.
  //
  //   contentDOM:: ?dom.Node
  //   The DOM node that should hold the node's content. Only meaningful
  //   if the node view also defines a `dom` property and if its node
  //   type is not a leaf node type. When this is present, ProseMirror
  //   will take care of rendering the node's children into it. When it
  //   is not present, the node view itself is responsible for rendering
  //   (or deciding not to render) its child nodes.
  //
  //   update:: ?(node: Node, decorations: [Decoration]) → bool
  //   When given, this will be called when the view is updating itself.
  //   It will be given a node (possibly of a different type), and an
  //   array of active decorations (which are automatically drawn, and
  //   the node view may ignore if it isn't interested in them), and
  //   should return true if it was able to update to that node, and
  //   false otherwise. If the node view has a `contentDOM` property (or
  //   no `dom` property), updating its child nodes will be handled by
  //   ProseMirror.
  //
  //   selectNode:: ?()
  //   Can be used to override the way the node's selected status (as a
  //   node selection) is displayed.
  //
  //   deselectNode:: ?()
  //   When defining a `selectNode` method, you should also provide a
  //   `deselectNode` method to remove the effect again.
  //
  //   setSelection:: ?(anchor: number, head: number, root: dom.Document)
  //   This will be called to handle setting the selection inside the
  //   node. The `anchor` and `head` positions are relative to the start
  //   of the node. By default, a DOM selection will be created between
  //   the DOM positions corresponding to those positions, but if you
  //   override it you can do something else.
  //
  //   stopEvent:: ?(event: dom.Event) → bool
  //   Can be used to prevent the editor view from trying to handle some
  //   or all DOM events that bubble up from the node view. Events for
  //   which this returns true are not handled by the editor.
  //
  //   ignoreMutation:: ?(dom.MutationRecord) → bool
  //   Called when a DOM
  //   [mutation](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver)
  //   or a selection change happens within the view. When the change is
  //   a selection change, the record will have a `type` property of
  //   `"selection"` (which doesn't occur for native mutation records).
  //   Return false if the editor should re-read the selection or
  //   re-parse the range around the mutation, true if it can safely be
  //   ignored.
  //
  //   destroy:: ?()
  //   Called when the node view is removed from the editor or the whole
  //   editor is destroyed.
  // View descriptions are data structures that describe the DOM that is
  // used to represent the editor's content. They are used for:
  //
  // - Incremental redrawing when the document changes
  //
  // - Figuring out what part of the document a given DOM position
  //   corresponds to
  //
  // - Wiring in custom implementations of the editing interface for a
  //   given node
  //
  // They form a doubly-linked mutable tree, starting at `view.docView`.


  var NOT_DIRTY = 0,
      CHILD_DIRTY = 1,
      CONTENT_DIRTY = 2,
      NODE_DIRTY = 3; // Superclass for the various kinds of descriptions. Defines their
  // basic structure and shared methods.

  var ViewDesc = function ViewDesc(parent, children, dom, contentDOM) {
    this.parent = parent;
    this.children = children;
    this.dom = dom; // An expando property on the DOM node provides a link back to its
    // description.

    dom.pmViewDesc = this; // This is the node that holds the child views. It may be null for
    // descs that don't have children.

    this.contentDOM = contentDOM;
    this.dirty = NOT_DIRTY;
  };

  var prototypeAccessors$9 = {
    beforePosition: {
      configurable: true
    },
    size: {
      configurable: true
    },
    border: {
      configurable: true
    },
    posBefore: {
      configurable: true
    },
    posAtStart: {
      configurable: true
    },
    posAfter: {
      configurable: true
    },
    posAtEnd: {
      configurable: true
    },
    contentLost: {
      configurable: true
    }
  }; // Used to check whether a given description corresponds to a
  // widget/mark/node.

  ViewDesc.prototype.matchesWidget = function matchesWidget() {
    return false;
  };

  ViewDesc.prototype.matchesMark = function matchesMark() {
    return false;
  };

  ViewDesc.prototype.matchesNode = function matchesNode() {
    return false;
  };

  ViewDesc.prototype.matchesHack = function matchesHack() {
    return false;
  };

  prototypeAccessors$9.beforePosition.get = function () {
    return false;
  }; // : () → ?ParseRule
  // When parsing in-editor content (in domchange.js), we allow
  // descriptions to determine the parse rules that should be used to
  // parse them.


  ViewDesc.prototype.parseRule = function parseRule() {
    return null;
  }; // : (dom.Event) → bool
  // Used by the editor's event handler to ignore events that come
  // from certain descs.


  ViewDesc.prototype.stopEvent = function stopEvent() {
    return false;
  }; // The size of the content represented by this desc.


  prototypeAccessors$9.size.get = function () {
    var size = 0;

    for (var i = 0; i < this.children.length; i++) {
      size += this.children[i].size;
    }

    return size;
  }; // For block nodes, this represents the space taken up by their
  // start/end tokens.


  prototypeAccessors$9.border.get = function () {
    return 0;
  };

  ViewDesc.prototype.destroy = function destroy() {
    this.parent = null;

    if (this.dom.pmViewDesc == this) {
      this.dom.pmViewDesc = null;
    }

    for (var i = 0; i < this.children.length; i++) {
      this.children[i].destroy();
    }
  };

  ViewDesc.prototype.posBeforeChild = function posBeforeChild(child) {
    for (var i = 0, pos = this.posAtStart; i < this.children.length; i++) {
      var cur = this.children[i];

      if (cur == child) {
        return pos;
      }

      pos += cur.size;
    }
  };

  prototypeAccessors$9.posBefore.get = function () {
    return this.parent.posBeforeChild(this);
  };

  prototypeAccessors$9.posAtStart.get = function () {
    return this.parent ? this.parent.posBeforeChild(this) + this.border : 0;
  };

  prototypeAccessors$9.posAfter.get = function () {
    return this.posBefore + this.size;
  };

  prototypeAccessors$9.posAtEnd.get = function () {
    return this.posAtStart + this.size - 2 * this.border;
  }; // : (dom.Node, number, ?number) → number


  ViewDesc.prototype.localPosFromDOM = function localPosFromDOM(dom, offset, bias) {
    // If the DOM position is in the content, use the child desc after
    // it to figure out a position.
    if (this.contentDOM && this.contentDOM.contains(dom.nodeType == 1 ? dom : dom.parentNode)) {
      if (bias < 0) {
        var domBefore, desc;

        if (dom == this.contentDOM) {
          domBefore = dom.childNodes[offset - 1];
        } else {
          while (dom.parentNode != this.contentDOM) {
            dom = dom.parentNode;
          }

          domBefore = dom.previousSibling;
        }

        while (domBefore && !((desc = domBefore.pmViewDesc) && desc.parent == this)) {
          domBefore = domBefore.previousSibling;
        }

        return domBefore ? this.posBeforeChild(desc) + desc.size : this.posAtStart;
      } else {
        var domAfter, desc$1;

        if (dom == this.contentDOM) {
          domAfter = dom.childNodes[offset];
        } else {
          while (dom.parentNode != this.contentDOM) {
            dom = dom.parentNode;
          }

          domAfter = dom.nextSibling;
        }

        while (domAfter && !((desc$1 = domAfter.pmViewDesc) && desc$1.parent == this)) {
          domAfter = domAfter.nextSibling;
        }

        return domAfter ? this.posBeforeChild(desc$1) : this.posAtEnd;
      }
    } // Otherwise, use various heuristics, falling back on the bias
    // parameter, to determine whether to return the position at the
    // start or at the end of this view desc.


    var atEnd;

    if (this.contentDOM && this.contentDOM != this.dom && this.dom.contains(this.contentDOM)) {
      atEnd = dom.compareDocumentPosition(this.contentDOM) & 2;
    } else if (this.dom.firstChild) {
      if (offset == 0) {
        for (var search = dom;; search = search.parentNode) {
          if (search == this.dom) {
            atEnd = false;
            break;
          }

          if (search.parentNode.firstChild != search) {
            break;
          }
        }
      }

      if (atEnd == null && offset == dom.childNodes.length) {
        for (var search$1 = dom;; search$1 = search$1.parentNode) {
          if (search$1 == this.dom) {
            atEnd = true;
            break;
          }

          if (search$1.parentNode.lastChild != search$1) {
            break;
          }
        }
      }
    }

    return (atEnd == null ? bias > 0 : atEnd) ? this.posAtEnd : this.posAtStart;
  }; // Scan up the dom finding the first desc that is a descendant of
  // this one.


  ViewDesc.prototype.nearestDesc = function nearestDesc(dom, onlyNodes) {
    for (var first = true, cur = dom; cur; cur = cur.parentNode) {
      var desc = this.getDesc(cur);

      if (desc && (!onlyNodes || desc.node)) {
        // If dom is outside of this desc's nodeDOM, don't count it.
        if (first && desc.nodeDOM && !(desc.nodeDOM.nodeType == 1 ? desc.nodeDOM.contains(dom) : desc.nodeDOM == dom)) {
          first = false;
        } else {
          return desc;
        }
      }
    }
  };

  ViewDesc.prototype.getDesc = function getDesc(dom) {
    var desc = dom.pmViewDesc;

    for (var cur = desc; cur; cur = cur.parent) {
      if (cur == this) {
        return desc;
      }
    }
  };

  ViewDesc.prototype.posFromDOM = function posFromDOM(dom, offset, bias) {
    for (var scan = dom;; scan = scan.parentNode) {
      var desc = this.getDesc(scan);

      if (desc) {
        return desc.localPosFromDOM(dom, offset, bias);
      }
    }
  }; // : (number) → ?NodeViewDesc
  // Find the desc for the node after the given pos, if any. (When a
  // parent node overrode rendering, there might not be one.)


  ViewDesc.prototype.descAt = function descAt(pos) {
    for (var i = 0, offset = 0; i < this.children.length; i++) {
      var child = this.children[i],
          end = offset + child.size;

      if (offset == pos && end != offset) {
        while (!child.border && child.children.length) {
          child = child.children[0];
        }

        return child;
      }

      if (pos < end) {
        return child.descAt(pos - offset - child.border);
      }

      offset = end;
    }
  }; // : (number) → {node: dom.Node, offset: number}


  ViewDesc.prototype.domFromPos = function domFromPos(pos) {
    if (!this.contentDOM) {
      return {
        node: this.dom,
        offset: 0
      };
    }

    for (var offset = 0, i = 0;; i++) {
      if (offset == pos) {
        while (i < this.children.length && (this.children[i].beforePosition || this.children[i].dom.parentNode != this.contentDOM)) {
          i++;
        }

        return {
          node: this.contentDOM,
          offset: i == this.children.length ? this.contentDOM.childNodes.length : domIndex(this.children[i].dom)
        };
      }

      if (i == this.children.length) {
        throw new Error("Invalid position " + pos);
      }

      var child = this.children[i],
          end = offset + child.size;

      if (pos < end) {
        return child.domFromPos(pos - offset - child.border);
      }

      offset = end;
    }
  }; // Used to find a DOM range in a single parent for a given changed
  // range.


  ViewDesc.prototype.parseRange = function parseRange(from, to, base) {
    if (base === void 0) base = 0;

    if (this.children.length == 0) {
      return {
        node: this.contentDOM,
        from: from,
        to: to,
        fromOffset: 0,
        toOffset: this.contentDOM.childNodes.length
      };
    }

    var fromOffset = -1,
        toOffset = -1;

    for (var offset = base, i = 0;; i++) {
      var child = this.children[i],
          end = offset + child.size;

      if (fromOffset == -1 && from <= end) {
        var childBase = offset + child.border; // FIXME maybe descend mark views to parse a narrower range?

        if (from >= childBase && to <= end - child.border && child.node && child.contentDOM && this.contentDOM.contains(child.contentDOM)) {
          return child.parseRange(from, to, childBase);
        }

        from = offset;

        for (var j = i; j > 0; j--) {
          var prev = this.children[j - 1];

          if (prev.size && prev.dom.parentNode == this.contentDOM && !prev.emptyChildAt(1)) {
            fromOffset = domIndex(prev.dom) + 1;
            break;
          }

          from -= prev.size;
        }

        if (fromOffset == -1) {
          fromOffset = 0;
        }
      }

      if (fromOffset > -1 && to <= end) {
        to = end;

        for (var j$1 = i + 1; j$1 < this.children.length; j$1++) {
          var next = this.children[j$1];

          if (next.size && next.dom.parentNode == this.contentDOM && !next.emptyChildAt(-1)) {
            toOffset = domIndex(next.dom);
            break;
          }

          to += next.size;
        }

        if (toOffset == -1) {
          toOffset = this.contentDOM.childNodes.length;
        }

        break;
      }

      offset = end;
    }

    return {
      node: this.contentDOM,
      from: from,
      to: to,
      fromOffset: fromOffset,
      toOffset: toOffset
    };
  };

  ViewDesc.prototype.emptyChildAt = function emptyChildAt(side) {
    if (this.border || !this.contentDOM || !this.children.length) {
      return false;
    }

    var child = this.children[side < 0 ? 0 : this.children.length - 1];
    return child.size == 0 || child.emptyChildAt(side);
  }; // : (number) → dom.Node


  ViewDesc.prototype.domAfterPos = function domAfterPos(pos) {
    var ref = this.domFromPos(pos);
    var node = ref.node;
    var offset = ref.offset;

    if (node.nodeType != 1 || offset == node.childNodes.length) {
      throw new RangeError("No node after pos " + pos);
    }

    return node.childNodes[offset];
  }; // : (number, number, dom.Document)
  // View descs are responsible for setting any selection that falls
  // entirely inside of them, so that custom implementations can do
  // custom things with the selection. Note that this falls apart when
  // a selection starts in such a node and ends in another, in which
  // case we just use whatever domFromPos produces as a best effort.


  ViewDesc.prototype.setSelection = function setSelection(anchor, head, root, force) {
    // If the selection falls entirely in a child, give it to that child
    var from = Math.min(anchor, head),
        to = Math.max(anchor, head);

    for (var i = 0, offset = 0; i < this.children.length; i++) {
      var child = this.children[i],
          end = offset + child.size;

      if (from > offset && to < end) {
        return child.setSelection(anchor - offset - child.border, head - offset - child.border, root, force);
      }

      offset = end;
    }

    var anchorDOM = this.domFromPos(anchor),
        headDOM = this.domFromPos(head);
    var domSel = root.getSelection(),
        range = document.createRange();

    if (!force && isEquivalentPosition(anchorDOM.node, anchorDOM.offset, domSel.anchorNode, domSel.anchorOffset) && isEquivalentPosition(headDOM.node, headDOM.offset, domSel.focusNode, domSel.focusOffset)) {
      return;
    } // Selection.extend can be used to create an 'inverted' selection
    // (one where the focus is before the anchor), but not all
    // browsers support it yet.


    if (domSel.extend) {
      range.setEnd(anchorDOM.node, anchorDOM.offset);
      range.collapse(false);
    } else {
      if (anchor > head) {
        var tmp = anchorDOM;
        anchorDOM = headDOM;
        headDOM = tmp;
      }

      range.setEnd(headDOM.node, headDOM.offset);
      range.setStart(anchorDOM.node, anchorDOM.offset);
    }

    domSel.removeAllRanges();
    domSel.addRange(range);

    if (domSel.extend) {
      domSel.extend(headDOM.node, headDOM.offset);
    }
  }; // : (dom.MutationRecord) → bool


  ViewDesc.prototype.ignoreMutation = function ignoreMutation(_mutation) {
    return !this.contentDOM;
  };

  prototypeAccessors$9.contentLost.get = function () {
    return this.contentDOM && this.contentDOM != this.dom && !this.dom.contains(this.contentDOM);
  }; // Remove a subtree of the element tree that has been touched
  // by a DOM change, so that the next update will redraw it.


  ViewDesc.prototype.markDirty = function markDirty(from, to) {
    for (var offset = 0, i = 0; i < this.children.length; i++) {
      var child = this.children[i],
          end = offset + child.size;

      if (offset == end ? from <= end && to >= offset : from < end && to > offset) {
        var startInside = offset + child.border,
            endInside = end - child.border;

        if (from >= startInside && to <= endInside) {
          this.dirty = from == offset || to == end ? CONTENT_DIRTY : CHILD_DIRTY;

          if (from == startInside && to == endInside && (child.contentLost || child.dom.parentNode != this.contentDOM)) {
            child.dirty = NODE_DIRTY;
          } else {
            child.markDirty(from - startInside, to - startInside);
          }

          return;
        } else {
          child.dirty = NODE_DIRTY;
        }
      }

      offset = end;
    }

    this.dirty = CONTENT_DIRTY;
  };

  ViewDesc.prototype.markParentsDirty = function markParentsDirty() {
    for (var node = this.parent; node; node = node.parent) {
      var dirty = CONTENT_DIRTY;

      if (node.dirty < dirty) {
        node.dirty = dirty;
      }
    }
  };

  Object.defineProperties(ViewDesc.prototype, prototypeAccessors$9); // Reused array to avoid allocating fresh arrays for things that will
  // stay empty anyway.

  var nothing = []; // A widget desc represents a widget decoration, which is a DOM node
  // drawn between the document nodes.

  var WidgetViewDesc =
  /*@__PURE__*/
  function (ViewDesc) {
    function WidgetViewDesc(parent, widget, view, pos) {
      var self,
          dom = widget.type.toDOM;

      if (typeof dom == "function") {
        dom = dom(view, function () {
          if (!self) {
            return pos;
          }

          if (self.parent) {
            return self.parent.posBeforeChild(self);
          }
        });
      }

      if (!widget.type.spec.raw) {
        if (dom.nodeType != 1) {
          var wrap = document.createElement("span");
          wrap.appendChild(dom);
          dom = wrap;
        }

        dom.contentEditable = false;
        dom.classList.add("ProseMirror-widget");
      }

      ViewDesc.call(this, parent, nothing, dom, null);
      this.widget = widget;
      self = this;
    }

    if (ViewDesc) WidgetViewDesc.__proto__ = ViewDesc;
    WidgetViewDesc.prototype = Object.create(ViewDesc && ViewDesc.prototype);
    WidgetViewDesc.prototype.constructor = WidgetViewDesc;
    var prototypeAccessors$1 = {
      beforePosition: {
        configurable: true
      }
    };

    prototypeAccessors$1.beforePosition.get = function () {
      return this.widget.type.side < 0;
    };

    WidgetViewDesc.prototype.matchesWidget = function matchesWidget(widget) {
      return this.dirty == NOT_DIRTY && widget.type.eq(this.widget.type);
    };

    WidgetViewDesc.prototype.parseRule = function parseRule() {
      return {
        ignore: true
      };
    };

    WidgetViewDesc.prototype.stopEvent = function stopEvent(event) {
      var stop = this.widget.spec.stopEvent;
      return stop ? stop(event) : false;
    };

    Object.defineProperties(WidgetViewDesc.prototype, prototypeAccessors$1);
    return WidgetViewDesc;
  }(ViewDesc);

  var CompositionViewDesc =
  /*@__PURE__*/
  function (ViewDesc) {
    function CompositionViewDesc(parent, dom, textDOM, text) {
      ViewDesc.call(this, parent, nothing, dom, null);
      this.textDOM = textDOM;
      this.text = text;
    }

    if (ViewDesc) CompositionViewDesc.__proto__ = ViewDesc;
    CompositionViewDesc.prototype = Object.create(ViewDesc && ViewDesc.prototype);
    CompositionViewDesc.prototype.constructor = CompositionViewDesc;
    var prototypeAccessors$2 = {
      size: {
        configurable: true
      }
    };

    prototypeAccessors$2.size.get = function () {
      return this.text.length;
    };

    CompositionViewDesc.prototype.localPosFromDOM = function localPosFromDOM(dom, offset) {
      if (dom != this.textDOM) {
        return this.posAtStart + (offset ? this.size : 0);
      }

      return this.posAtStart + offset;
    };

    CompositionViewDesc.prototype.domFromPos = function domFromPos(pos) {
      return {
        node: this.textDOM,
        offset: pos
      };
    };

    CompositionViewDesc.prototype.ignoreMutation = function ignoreMutation(mut) {
      return mut.type === 'characterData' && mut.target.nodeValue == mut.oldValue;
    };

    Object.defineProperties(CompositionViewDesc.prototype, prototypeAccessors$2);
    return CompositionViewDesc;
  }(ViewDesc); // A mark desc represents a mark. May have multiple children,
  // depending on how the mark is split. Note that marks are drawn using
  // a fixed nesting order, for simplicity and predictability, so in
  // some cases they will be split more often than would appear
  // necessary.


  var MarkViewDesc =
  /*@__PURE__*/
  function (ViewDesc) {
    function MarkViewDesc(parent, mark, dom, contentDOM) {
      ViewDesc.call(this, parent, [], dom, contentDOM);
      this.mark = mark;
    }

    if (ViewDesc) MarkViewDesc.__proto__ = ViewDesc;
    MarkViewDesc.prototype = Object.create(ViewDesc && ViewDesc.prototype);
    MarkViewDesc.prototype.constructor = MarkViewDesc;

    MarkViewDesc.create = function create(parent, mark, inline, view) {
      var custom = view.nodeViews[mark.type.name];
      var spec = custom && custom(mark, view, inline);

      if (!spec || !spec.dom) {
        spec = DOMSerializer.renderSpec(document, mark.type.spec.toDOM(mark, inline));
      }

      return new MarkViewDesc(parent, mark, spec.dom, spec.contentDOM || spec.dom);
    };

    MarkViewDesc.prototype.parseRule = function parseRule() {
      return {
        mark: this.mark.type.name,
        attrs: this.mark.attrs,
        contentElement: this.contentDOM
      };
    };

    MarkViewDesc.prototype.matchesMark = function matchesMark(mark) {
      return this.dirty != NODE_DIRTY && this.mark.eq(mark);
    };

    MarkViewDesc.prototype.markDirty = function markDirty(from, to) {
      ViewDesc.prototype.markDirty.call(this, from, to); // Move dirty info to nearest node view

      if (this.dirty != NOT_DIRTY) {
        var parent = this.parent;

        while (!parent.node) {
          parent = parent.parent;
        }

        if (parent.dirty < this.dirty) {
          parent.dirty = this.dirty;
        }

        this.dirty = NOT_DIRTY;
      }
    };

    MarkViewDesc.prototype.slice = function slice(from, to, view) {
      var copy = MarkViewDesc.create(this.parent, this.mark, true, view);
      var nodes = this.children,
          size = this.size;

      if (to < size) {
        nodes = replaceNodes(nodes, to, size, view);
      }

      if (from > 0) {
        nodes = replaceNodes(nodes, 0, from, view);
      }

      for (var i = 0; i < nodes.length; i++) {
        nodes[i].parent = copy;
      }

      copy.children = nodes;
      return copy;
    };

    return MarkViewDesc;
  }(ViewDesc); // Node view descs are the main, most common type of view desc, and
  // correspond to an actual node in the document. Unlike mark descs,
  // they populate their child array themselves.


  var NodeViewDesc =
  /*@__PURE__*/
  function (ViewDesc) {
    function NodeViewDesc(parent, node, outerDeco, innerDeco, dom, contentDOM, nodeDOM, view, pos) {
      ViewDesc.call(this, parent, node.isLeaf ? nothing : [], dom, contentDOM);
      this.nodeDOM = nodeDOM;
      this.node = node;
      this.outerDeco = outerDeco;
      this.innerDeco = innerDeco;

      if (contentDOM) {
        this.updateChildren(view, pos);
      }
    }

    if (ViewDesc) NodeViewDesc.__proto__ = ViewDesc;
    NodeViewDesc.prototype = Object.create(ViewDesc && ViewDesc.prototype);
    NodeViewDesc.prototype.constructor = NodeViewDesc;
    var prototypeAccessors$3 = {
      size: {
        configurable: true
      },
      border: {
        configurable: true
      }
    }; // By default, a node is rendered using the `toDOM` method from the
    // node type spec. But client code can use the `nodeViews` spec to
    // supply a custom node view, which can influence various aspects of
    // the way the node works.
    //
    // (Using subclassing for this was intentionally decided against,
    // since it'd require exposing a whole slew of finnicky
    // implementation details to the user code that they probably will
    // never need.)

    NodeViewDesc.create = function create(parent, node, outerDeco, innerDeco, view, pos) {
      var assign;
      var custom = view.nodeViews[node.type.name],
          descObj;
      var spec = custom && custom(node, view, function () {
        // (This is a function that allows the custom view to find its
        // own position)
        if (!descObj) {
          return pos;
        }

        if (descObj.parent) {
          return descObj.parent.posBeforeChild(descObj);
        }
      }, outerDeco);
      var dom = spec && spec.dom,
          contentDOM = spec && spec.contentDOM;

      if (node.isText) {
        if (!dom) {
          dom = document.createTextNode(node.text);
        } else if (dom.nodeType != 3) {
          throw new RangeError("Text must be rendered as a DOM text node");
        }
      } else if (!dom) {
        assign = DOMSerializer.renderSpec(document, node.type.spec.toDOM(node)), dom = assign.dom, contentDOM = assign.contentDOM;
      }

      if (!contentDOM && !node.isText && dom.nodeName != "BR") {
        // Chrome gets confused by <br contenteditable=false>
        if (!dom.hasAttribute("contenteditable")) {
          dom.contentEditable = false;
        }

        if (node.type.spec.draggable) {
          dom.draggable = true;
        }
      }

      var nodeDOM = dom;
      dom = applyOuterDeco(dom, outerDeco, node);

      if (spec) {
        return descObj = new CustomNodeViewDesc(parent, node, outerDeco, innerDeco, dom, contentDOM, nodeDOM, spec, view, pos + 1);
      } else if (node.isText) {
        return new TextViewDesc(parent, node, outerDeco, innerDeco, dom, nodeDOM, view);
      } else {
        return new NodeViewDesc(parent, node, outerDeco, innerDeco, dom, contentDOM, nodeDOM, view, pos + 1);
      }
    };

    NodeViewDesc.prototype.parseRule = function parseRule() {
      var this$1 = this; // Experimental kludge to allow opt-in re-parsing of nodes

      if (this.node.type.spec.reparseInView) {
        return null;
      } // FIXME the assumption that this can always return the current
      // attrs means that if the user somehow manages to change the
      // attrs in the dom, that won't be picked up. Not entirely sure
      // whether this is a problem


      var rule = {
        node: this.node.type.name,
        attrs: this.node.attrs
      };

      if (this.node.type.spec.code) {
        rule.preserveWhitespace = "full";
      }

      if (this.contentDOM && !this.contentLost) {
        rule.contentElement = this.contentDOM;
      } else {
        rule.getContent = function () {
          return this$1.contentDOM ? Fragment.empty : this$1.node.content;
        };
      }

      return rule;
    };

    NodeViewDesc.prototype.matchesNode = function matchesNode(node, outerDeco, innerDeco) {
      return this.dirty == NOT_DIRTY && node.eq(this.node) && sameOuterDeco(outerDeco, this.outerDeco) && innerDeco.eq(this.innerDeco);
    };

    prototypeAccessors$3.size.get = function () {
      return this.node.nodeSize;
    };

    prototypeAccessors$3.border.get = function () {
      return this.node.isLeaf ? 0 : 1;
    }; // Syncs `this.children` to match `this.node.content` and the local
    // decorations, possibly introducing nesting for marks. Then, in a
    // separate step, syncs the DOM inside `this.contentDOM` to
    // `this.children`.


    NodeViewDesc.prototype.updateChildren = function updateChildren(view, pos) {
      var this$1 = this;
      var inline = this.node.inlineContent,
          off = pos;
      var composition = inline && view.composing && this.localCompositionNode(view, pos);
      var updater = new ViewTreeUpdater(this, composition && composition.node);
      iterDeco(this.node, this.innerDeco, function (widget, i) {
        if (widget.spec.marks) {
          updater.syncToMarks(widget.spec.marks, inline, view);
        } else if (widget.type.side >= 0) {
          updater.syncToMarks(i == this$1.node.childCount ? Mark.none : this$1.node.child(i).marks, inline, view);
        } // If the next node is a desc matching this widget, reuse it,
        // otherwise insert the widget as a new view desc.


        updater.placeWidget(widget, view, off);
      }, function (child, outerDeco, innerDeco, i) {
        // Make sure the wrapping mark descs match the node's marks.
        updater.syncToMarks(child.marks, inline, view); // Either find an existing desc that exactly matches this node,
        // and drop the descs before it.

        updater.findNodeMatch(child, outerDeco, innerDeco, i) || // Or try updating the next desc to reflect this node.
        updater.updateNextNode(child, outerDeco, innerDeco, view, i) || // Or just add it as a new desc.
        updater.addNode(child, outerDeco, innerDeco, view, off);
        off += child.nodeSize;
      }); // Drop all remaining descs after the current position.

      updater.syncToMarks(nothing, inline, view);

      if (this.node.isTextblock) {
        updater.addTextblockHacks();
      }

      updater.destroyRest(); // Sync the DOM if anything changed

      if (updater.changed || this.dirty == CONTENT_DIRTY) {
        // May have to protect focused DOM from being changed if a composition is active
        if (composition) {
          this.protectLocalComposition(view, composition);
        }

        this.renderChildren();
      }
    };

    NodeViewDesc.prototype.renderChildren = function renderChildren() {
      renderDescs(this.contentDOM, this.children);

      if (result.ios) {
        iosHacks(this.dom);
      }
    };

    NodeViewDesc.prototype.localCompositionNode = function localCompositionNode(view, pos) {
      // Only do something if both the selection and a focused text node
      // are inside of this node, and the node isn't already part of a
      // view that's a child of this view
      var ref = view.state.selection;
      var from = ref.from;
      var to = ref.to;

      if (!(view.state.selection instanceof TextSelection) || from < pos || to > pos + this.node.content.size) {
        return;
      }

      var sel = view.root.getSelection();
      var textNode = nearbyTextNode(sel.focusNode, sel.focusOffset);

      if (!textNode || !this.dom.contains(textNode.parentNode)) {
        return;
      } // Find the text in the focused node in the node, stop if it's not
      // there (may have been modified through other means, in which
      // case it should overwritten)


      var text = textNode.nodeValue;
      var textPos = findTextInFragment(this.node.content, text, from - pos, to - pos);
      return textPos < 0 ? null : {
        node: textNode,
        pos: textPos,
        text: text
      };
    };

    NodeViewDesc.prototype.protectLocalComposition = function protectLocalComposition(view, ref) {
      var node = ref.node;
      var pos = ref.pos;
      var text = ref.text; // The node is already part of a local view desc, leave it there

      if (this.getDesc(node)) {
        return;
      } // Create a composition view for the orphaned nodes


      var topNode = node;

      for (;; topNode = topNode.parentNode) {
        if (topNode.parentNode == this.contentDOM) {
          break;
        }

        while (topNode.previousSibling) {
          topNode.parentNode.removeChild(topNode.previousSibling);
        }

        while (topNode.nextSibling) {
          topNode.parentNode.removeChild(topNode.nextSibling);
        }

        if (topNode.pmViewDesc) {
          topNode.pmViewDesc = null;
        }
      }

      var desc = new CompositionViewDesc(this, topNode, node, text);
      view.compositionNodes.push(desc); // Patch up this.children to contain the composition view

      this.children = replaceNodes(this.children, pos, pos + text.length, view, desc);
    }; // : (Node, [Decoration], DecorationSet, EditorView) → bool
    // If this desc be updated to match the given node decoration,
    // do so and return true.


    NodeViewDesc.prototype.update = function update(node, outerDeco, innerDeco, view) {
      if (this.dirty == NODE_DIRTY || !node.sameMarkup(this.node)) {
        return false;
      }

      this.updateInner(node, outerDeco, innerDeco, view);
      return true;
    };

    NodeViewDesc.prototype.updateInner = function updateInner(node, outerDeco, innerDeco, view) {
      this.updateOuterDeco(outerDeco);
      this.node = node;
      this.innerDeco = innerDeco;

      if (this.contentDOM) {
        this.updateChildren(view, this.posAtStart);
      }

      this.dirty = NOT_DIRTY;
    };

    NodeViewDesc.prototype.updateOuterDeco = function updateOuterDeco(outerDeco) {
      if (sameOuterDeco(outerDeco, this.outerDeco)) {
        return;
      }

      var needsWrap = this.nodeDOM.nodeType != 1;
      var oldDOM = this.dom;
      this.dom = patchOuterDeco(this.dom, this.nodeDOM, computeOuterDeco(this.outerDeco, this.node, needsWrap), computeOuterDeco(outerDeco, this.node, needsWrap));

      if (this.dom != oldDOM) {
        oldDOM.pmViewDesc = null;
        this.dom.pmViewDesc = this;
      }

      this.outerDeco = outerDeco;
    }; // Mark this node as being the selected node.


    NodeViewDesc.prototype.selectNode = function selectNode() {
      this.nodeDOM.classList.add("ProseMirror-selectednode");

      if (this.contentDOM || !this.node.type.spec.draggable) {
        this.dom.draggable = true;
      }
    }; // Remove selected node marking from this node.


    NodeViewDesc.prototype.deselectNode = function deselectNode() {
      this.nodeDOM.classList.remove("ProseMirror-selectednode");

      if (this.contentDOM || !this.node.type.spec.draggable) {
        this.dom.draggable = false;
      }
    };

    Object.defineProperties(NodeViewDesc.prototype, prototypeAccessors$3);
    return NodeViewDesc;
  }(ViewDesc); // Create a view desc for the top-level document node, to be exported
  // and used by the view class.


  function docViewDesc(doc, outerDeco, innerDeco, dom, view) {
    applyOuterDeco(dom, outerDeco, doc);
    return new NodeViewDesc(null, doc, outerDeco, innerDeco, dom, dom, dom, view, 0);
  }

  var TextViewDesc =
  /*@__PURE__*/
  function (NodeViewDesc) {
    function TextViewDesc(parent, node, outerDeco, innerDeco, dom, nodeDOM, view) {
      NodeViewDesc.call(this, parent, node, outerDeco, innerDeco, dom, null, nodeDOM, view);
    }

    if (NodeViewDesc) TextViewDesc.__proto__ = NodeViewDesc;
    TextViewDesc.prototype = Object.create(NodeViewDesc && NodeViewDesc.prototype);
    TextViewDesc.prototype.constructor = TextViewDesc;

    TextViewDesc.prototype.parseRule = function parseRule() {
      return {
        skip: this.nodeDOM.parentNode || true
      };
    };

    TextViewDesc.prototype.update = function update(node, outerDeco) {
      if (this.dirty == NODE_DIRTY || this.dirty != NOT_DIRTY && !this.inParent() || !node.sameMarkup(this.node)) {
        return false;
      }

      this.updateOuterDeco(outerDeco);

      if ((this.dirty != NOT_DIRTY || node.text != this.node.text) && node.text != this.nodeDOM.nodeValue) {
        this.nodeDOM.nodeValue = node.text;
      }

      this.node = node;
      this.dirty = NOT_DIRTY;
      return true;
    };

    TextViewDesc.prototype.inParent = function inParent() {
      var parentDOM = this.parent.contentDOM;

      for (var n = this.nodeDOM; n; n = n.parentNode) {
        if (n == parentDOM) {
          return true;
        }
      }

      return false;
    };

    TextViewDesc.prototype.domFromPos = function domFromPos(pos) {
      return {
        node: this.nodeDOM,
        offset: pos
      };
    };

    TextViewDesc.prototype.localPosFromDOM = function localPosFromDOM(dom, offset, bias) {
      if (dom == this.nodeDOM) {
        return this.posAtStart + Math.min(offset, this.node.text.length);
      }

      return NodeViewDesc.prototype.localPosFromDOM.call(this, dom, offset, bias);
    };

    TextViewDesc.prototype.ignoreMutation = function ignoreMutation(mutation) {
      return mutation.type != "characterData" && mutation.type != "selection";
    };

    TextViewDesc.prototype.slice = function slice(from, to, view) {
      var node = this.node.cut(from, to),
          dom = document.createTextNode(node.text);
      return new TextViewDesc(this.parent, node, this.outerDeco, this.innerDeco, dom, dom, view);
    };

    return TextViewDesc;
  }(NodeViewDesc); // A dummy desc used to tag trailing BR or span nodes created to work
  // around contentEditable terribleness.


  var BRHackViewDesc =
  /*@__PURE__*/
  function (ViewDesc) {
    function BRHackViewDesc() {
      ViewDesc.apply(this, arguments);
    }

    if (ViewDesc) BRHackViewDesc.__proto__ = ViewDesc;
    BRHackViewDesc.prototype = Object.create(ViewDesc && ViewDesc.prototype);
    BRHackViewDesc.prototype.constructor = BRHackViewDesc;

    BRHackViewDesc.prototype.parseRule = function parseRule() {
      return {
        ignore: true
      };
    };

    BRHackViewDesc.prototype.matchesHack = function matchesHack() {
      return this.dirty == NOT_DIRTY;
    };

    return BRHackViewDesc;
  }(ViewDesc); // A separate subclass is used for customized node views, so that the
  // extra checks only have to be made for nodes that are actually
  // customized.


  var CustomNodeViewDesc =
  /*@__PURE__*/
  function (NodeViewDesc) {
    function CustomNodeViewDesc(parent, node, outerDeco, innerDeco, dom, contentDOM, nodeDOM, spec, view, pos) {
      NodeViewDesc.call(this, parent, node, outerDeco, innerDeco, dom, contentDOM, nodeDOM, view, pos);
      this.spec = spec;
    }

    if (NodeViewDesc) CustomNodeViewDesc.__proto__ = NodeViewDesc;
    CustomNodeViewDesc.prototype = Object.create(NodeViewDesc && NodeViewDesc.prototype);
    CustomNodeViewDesc.prototype.constructor = CustomNodeViewDesc; // A custom `update` method gets to decide whether the update goes
    // through. If it does, and there's a `contentDOM` node, our logic
    // updates the children.

    CustomNodeViewDesc.prototype.update = function update(node, outerDeco, innerDeco, view) {
      if (this.dirty == NODE_DIRTY) {
        return false;
      }

      if (this.spec.update) {
        var result = this.spec.update(node, outerDeco);

        if (result) {
          this.updateInner(node, outerDeco, innerDeco, view);
        }

        return result;
      } else if (!this.contentDOM && !node.isLeaf) {
        return false;
      } else {
        return NodeViewDesc.prototype.update.call(this, node, outerDeco, innerDeco, view);
      }
    };

    CustomNodeViewDesc.prototype.selectNode = function selectNode() {
      this.spec.selectNode ? this.spec.selectNode() : NodeViewDesc.prototype.selectNode.call(this);
    };

    CustomNodeViewDesc.prototype.deselectNode = function deselectNode() {
      this.spec.deselectNode ? this.spec.deselectNode() : NodeViewDesc.prototype.deselectNode.call(this);
    };

    CustomNodeViewDesc.prototype.setSelection = function setSelection(anchor, head, root, force) {
      this.spec.setSelection ? this.spec.setSelection(anchor, head, root) : NodeViewDesc.prototype.setSelection.call(this, anchor, head, root, force);
    };

    CustomNodeViewDesc.prototype.destroy = function destroy() {
      if (this.spec.destroy) {
        this.spec.destroy();
      }

      NodeViewDesc.prototype.destroy.call(this);
    };

    CustomNodeViewDesc.prototype.stopEvent = function stopEvent(event) {
      return this.spec.stopEvent ? this.spec.stopEvent(event) : false;
    };

    CustomNodeViewDesc.prototype.ignoreMutation = function ignoreMutation(mutation) {
      return this.spec.ignoreMutation ? this.spec.ignoreMutation(mutation) : NodeViewDesc.prototype.ignoreMutation.call(this, mutation);
    };

    return CustomNodeViewDesc;
  }(NodeViewDesc); // : (dom.Node, [ViewDesc])
  // Sync the content of the given DOM node with the nodes associated
  // with the given array of view descs, recursing into mark descs
  // because this should sync the subtree for a whole node at a time.


  function renderDescs(parentDOM, descs) {
    var dom = parentDOM.firstChild;

    for (var i = 0; i < descs.length; i++) {
      var desc = descs[i],
          childDOM = desc.dom;

      if (childDOM.parentNode == parentDOM) {
        while (childDOM != dom) {
          dom = rm(dom);
        }

        dom = dom.nextSibling;
      } else {
        parentDOM.insertBefore(childDOM, dom);
      }

      if (desc instanceof MarkViewDesc) {
        var pos = dom ? dom.previousSibling : parentDOM.lastChild;
        renderDescs(desc.contentDOM, desc.children);
        dom = pos ? pos.nextSibling : parentDOM.firstChild;
      }
    }

    while (dom) {
      dom = rm(dom);
    }
  }

  function OuterDecoLevel(nodeName) {
    if (nodeName) {
      this.nodeName = nodeName;
    }
  }

  OuterDecoLevel.prototype = Object.create(null);
  var noDeco = [new OuterDecoLevel()];

  function computeOuterDeco(outerDeco, node, needsWrap) {
    if (outerDeco.length == 0) {
      return noDeco;
    }

    var top = needsWrap ? noDeco[0] : new OuterDecoLevel(),
        result = [top];

    for (var i = 0; i < outerDeco.length; i++) {
      var attrs = outerDeco[i].type.attrs,
          cur = top;

      if (!attrs) {
        continue;
      }

      if (attrs.nodeName) {
        result.push(cur = new OuterDecoLevel(attrs.nodeName));
      }

      for (var name in attrs) {
        var val = attrs[name];

        if (val == null) {
          continue;
        }

        if (needsWrap && result.length == 1) {
          result.push(cur = top = new OuterDecoLevel(node.isInline ? "span" : "div"));
        }

        if (name == "class") {
          cur.class = (cur.class ? cur.class + " " : "") + val;
        } else if (name == "style") {
          cur.style = (cur.style ? cur.style + ";" : "") + val;
        } else if (name != "nodeName") {
          cur[name] = val;
        }
      }
    }

    return result;
  }

  function patchOuterDeco(outerDOM, nodeDOM, prevComputed, curComputed) {
    // Shortcut for trivial case
    if (prevComputed == noDeco && curComputed == noDeco) {
      return nodeDOM;
    }

    var curDOM = nodeDOM;

    for (var i = 0; i < curComputed.length; i++) {
      var deco = curComputed[i],
          prev = prevComputed[i];

      if (i) {
        var parent = void 0;

        if (prev && prev.nodeName == deco.nodeName && curDOM != outerDOM && (parent = curDOM.parentNode) && parent.tagName.toLowerCase() == deco.nodeName) {
          curDOM = parent;
        } else {
          parent = document.createElement(deco.nodeName);
          parent.appendChild(curDOM);
          prev = noDeco[0];
          curDOM = parent;
        }
      }

      patchAttributes(curDOM, prev || noDeco[0], deco);
    }

    return curDOM;
  }

  function patchAttributes(dom, prev, cur) {
    for (var name in prev) {
      if (name != "class" && name != "style" && name != "nodeName" && !(name in cur)) {
        dom.removeAttribute(name);
      }
    }

    for (var name$1 in cur) {
      if (name$1 != "class" && name$1 != "style" && name$1 != "nodeName" && cur[name$1] != prev[name$1]) {
        dom.setAttribute(name$1, cur[name$1]);
      }
    }

    if (prev.class != cur.class) {
      var prevList = prev.class ? prev.class.split(" ") : nothing;
      var curList = cur.class ? cur.class.split(" ") : nothing;

      for (var i = 0; i < prevList.length; i++) {
        if (curList.indexOf(prevList[i]) == -1) {
          dom.classList.remove(prevList[i]);
        }
      }

      for (var i$1 = 0; i$1 < curList.length; i$1++) {
        if (prevList.indexOf(curList[i$1]) == -1) {
          dom.classList.add(curList[i$1]);
        }
      }
    }

    if (prev.style != cur.style) {
      if (prev.style) {
        var prop = /\s*([\w\-\xa1-\uffff]+)\s*:(?:"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|\(.*?\)|[^;])*/g,
            m;

        while (m = prop.exec(prev.style)) {
          dom.style.removeProperty(m[1]);
        }
      }

      if (cur.style) {
        dom.style.cssText += cur.style;
      }
    }
  }

  function applyOuterDeco(dom, deco, node) {
    return patchOuterDeco(dom, dom, noDeco, computeOuterDeco(deco, node, dom.nodeType != 1));
  } // : ([Decoration], [Decoration]) → bool


  function sameOuterDeco(a, b) {
    if (a.length != b.length) {
      return false;
    }

    for (var i = 0; i < a.length; i++) {
      if (!a[i].type.eq(b[i].type)) {
        return false;
      }
    }

    return true;
  } // Remove a DOM node and return its next sibling.


  function rm(dom) {
    var next = dom.nextSibling;
    dom.parentNode.removeChild(dom);
    return next;
  } // Helper class for incrementally updating a tree of mark descs and
  // the widget and node descs inside of them.


  var ViewTreeUpdater = function ViewTreeUpdater(top, lockedNode) {
    this.top = top;
    this.lock = lockedNode; // Index into `this.top`'s child array, represents the current
    // update position.

    this.index = 0; // When entering a mark, the current top and index are pushed
    // onto this.

    this.stack = []; // Tracks whether anything was changed

    this.changed = false;
    var pre = preMatch(top.node.content, top.children);
    this.preMatched = pre.nodes;
    this.preMatchOffset = pre.offset;
  };

  ViewTreeUpdater.prototype.getPreMatch = function getPreMatch(index) {
    return index >= this.preMatchOffset ? this.preMatched[index - this.preMatchOffset] : null;
  }; // Destroy and remove the children between the given indices in
  // `this.top`.


  ViewTreeUpdater.prototype.destroyBetween = function destroyBetween(start, end) {
    if (start == end) {
      return;
    }

    for (var i = start; i < end; i++) {
      this.top.children[i].destroy();
    }

    this.top.children.splice(start, end - start);
    this.changed = true;
  }; // Destroy all remaining children in `this.top`.


  ViewTreeUpdater.prototype.destroyRest = function destroyRest() {
    this.destroyBetween(this.index, this.top.children.length);
  }; // : ([Mark], EditorView)
  // Sync the current stack of mark descs with the given array of
  // marks, reusing existing mark descs when possible.


  ViewTreeUpdater.prototype.syncToMarks = function syncToMarks(marks, inline, view) {
    var keep = 0,
        depth = this.stack.length >> 1;
    var maxKeep = Math.min(depth, marks.length);

    while (keep < maxKeep && (keep == depth - 1 ? this.top : this.stack[keep + 1 << 1]).matchesMark(marks[keep]) && marks[keep].type.spec.spanning !== false) {
      keep++;
    }

    while (keep < depth) {
      this.destroyRest();
      this.top.dirty = NOT_DIRTY;
      this.index = this.stack.pop();
      this.top = this.stack.pop();
      depth--;
    }

    while (depth < marks.length) {
      this.stack.push(this.top, this.index + 1);
      var found = -1;

      for (var i = this.index; i < Math.min(this.index + 3, this.top.children.length); i++) {
        if (this.top.children[i].matchesMark(marks[depth])) {
          found = i;
          break;
        }
      }

      if (found > -1) {
        if (found > this.index) {
          this.changed = true;
          this.destroyBetween(this.index, found);
        }

        this.top = this.top.children[this.index];
      } else {
        var markDesc = MarkViewDesc.create(this.top, marks[depth], inline, view);
        this.top.children.splice(this.index, 0, markDesc);
        this.top = markDesc;
        this.changed = true;
      }

      this.index = 0;
      depth++;
    }
  }; // : (Node, [Decoration], DecorationSet) → bool
  // Try to find a node desc matching the given data. Skip over it and
  // return true when successful.


  ViewTreeUpdater.prototype.findNodeMatch = function findNodeMatch(node, outerDeco, innerDeco, index) {
    var found = -1,
        preMatch = index < 0 ? undefined : this.getPreMatch(index),
        children = this.top.children;

    if (preMatch && preMatch.matchesNode(node, outerDeco, innerDeco)) {
      found = children.indexOf(preMatch);
    } else {
      for (var i = this.index, e = Math.min(children.length, i + 5); i < e; i++) {
        var child = children[i];

        if (child.matchesNode(node, outerDeco, innerDeco) && this.preMatched.indexOf(child) < 0) {
          found = i;
          break;
        }
      }
    }

    if (found < 0) {
      return false;
    }

    this.destroyBetween(this.index, found);
    this.index++;
    return true;
  }; // : (Node, [Decoration], DecorationSet, EditorView, Fragment, number) → bool
  // Try to update the next node, if any, to the given data. Checks
  // pre-matches to avoid overwriting nodes that could still be used.


  ViewTreeUpdater.prototype.updateNextNode = function updateNextNode(node, outerDeco, innerDeco, view, index) {
    if (this.index == this.top.children.length) {
      return false;
    }

    var next = this.top.children[this.index];

    if (next instanceof NodeViewDesc) {
      var preMatch = this.preMatched.indexOf(next);

      if (preMatch > -1 && preMatch + this.preMatchOffset != index) {
        return false;
      }

      var nextDOM = next.dom; // Can't update if nextDOM is or contains this.lock, except if
      // it's a text node whose content already matches the new text
      // and whose decorations match the new ones.

      var locked = this.lock && (nextDOM == this.lock || nextDOM.nodeType == 1 && nextDOM.contains(this.lock.parentNode)) && !(node.isText && next.node && next.node.isText && next.nodeDOM.nodeValue == node.text && next.dirty != NODE_DIRTY && sameOuterDeco(outerDeco, next.outerDeco));

      if (!locked && next.update(node, outerDeco, innerDeco, view)) {
        if (next.dom != nextDOM) {
          this.changed = true;
        }

        this.index++;
        return true;
      }
    }

    return false;
  }; // : (Node, [Decoration], DecorationSet, EditorView)
  // Insert the node as a newly created node desc.


  ViewTreeUpdater.prototype.addNode = function addNode(node, outerDeco, innerDeco, view, pos) {
    this.top.children.splice(this.index++, 0, NodeViewDesc.create(this.top, node, outerDeco, innerDeco, view, pos));
    this.changed = true;
  };

  ViewTreeUpdater.prototype.placeWidget = function placeWidget(widget, view, pos) {
    if (this.index < this.top.children.length && this.top.children[this.index].matchesWidget(widget)) {
      this.index++;
    } else {
      var desc = new WidgetViewDesc(this.top, widget, view, pos);
      this.top.children.splice(this.index++, 0, desc);
      this.changed = true;
    }
  }; // Make sure a textblock looks and behaves correctly in
  // contentEditable.


  ViewTreeUpdater.prototype.addTextblockHacks = function addTextblockHacks() {
    var lastChild = this.top.children[this.index - 1];

    while (lastChild instanceof MarkViewDesc) {
      lastChild = lastChild.children[lastChild.children.length - 1];
    }

    if (!lastChild || // Empty textblock
    !(lastChild instanceof TextViewDesc) || /\n$/.test(lastChild.node.text)) {
      if (this.index < this.top.children.length && this.top.children[this.index].matchesHack()) {
        this.index++;
      } else {
        var dom = document.createElement("br");
        this.top.children.splice(this.index++, 0, new BRHackViewDesc(this.top, nothing, dom, null));
        this.changed = true;
      }
    }
  }; // : (Fragment, [ViewDesc]) → [ViewDesc]
  // Iterate from the end of the fragment and array of descs to find
  // directly matching ones, in order to avoid overeagerly reusing
  // those for other nodes. Returns an array whose positions correspond
  // to node positions in the fragment, and whose elements are either
  // descs matched to the child at that index, or empty.


  function preMatch(frag, descs) {
    var result = [],
        end = frag.childCount;

    for (var i = descs.length - 1; end > 0 && i >= 0; i--) {
      var desc = descs[i],
          node = desc.node;

      if (!node) {
        continue;
      }

      if (node != frag.child(end - 1)) {
        break;
      }

      result.push(desc);
      --end;
    }

    return {
      nodes: result.reverse(),
      offset: end
    };
  }

  function compareSide(a, b) {
    return a.type.side - b.type.side;
  } // : (ViewDesc, DecorationSet, (Decoration, number), (Node, [Decoration], DecorationSet, number))
  // This function abstracts iterating over the nodes and decorations in
  // a fragment. Calls `onNode` for each node, with its local and child
  // decorations. Splits text nodes when there is a decoration starting
  // or ending inside of them. Calls `onWidget` for each widget.


  function iterDeco(parent, deco, onWidget, onNode) {
    var locals = deco.locals(parent),
        offset = 0; // Simple, cheap variant for when there are no local decorations

    if (locals.length == 0) {
      for (var i = 0; i < parent.childCount; i++) {
        var child = parent.child(i);
        onNode(child, locals, deco.forChild(offset, child), i);
        offset += child.nodeSize;
      }

      return;
    }

    var decoIndex = 0,
        active = [],
        restNode = null;

    for (var parentIndex = 0;;) {
      if (decoIndex < locals.length && locals[decoIndex].to == offset) {
        var widget = locals[decoIndex++],
            widgets = void 0;

        while (decoIndex < locals.length && locals[decoIndex].to == offset) {
          (widgets || (widgets = [widget])).push(locals[decoIndex++]);
        }

        if (widgets) {
          widgets.sort(compareSide);

          for (var i$1 = 0; i$1 < widgets.length; i$1++) {
            onWidget(widgets[i$1], parentIndex);
          }
        } else {
          onWidget(widget, parentIndex);
        }
      }

      var child$1 = void 0,
          index = void 0;

      if (restNode) {
        index = -1;
        child$1 = restNode;
        restNode = null;
      } else if (parentIndex < parent.childCount) {
        index = parentIndex;
        child$1 = parent.child(parentIndex++);
      } else {
        break;
      }

      for (var i$2 = 0; i$2 < active.length; i$2++) {
        if (active[i$2].to <= offset) {
          active.splice(i$2--, 1);
        }
      }

      while (decoIndex < locals.length && locals[decoIndex].from == offset) {
        active.push(locals[decoIndex++]);
      }

      var end = offset + child$1.nodeSize;

      if (child$1.isText) {
        var cutAt = end;

        if (decoIndex < locals.length && locals[decoIndex].from < cutAt) {
          cutAt = locals[decoIndex].from;
        }

        for (var i$3 = 0; i$3 < active.length; i$3++) {
          if (active[i$3].to < cutAt) {
            cutAt = active[i$3].to;
          }
        }

        if (cutAt < end) {
          restNode = child$1.cut(cutAt - offset);
          child$1 = child$1.cut(0, cutAt - offset);
          end = cutAt;
          index = -1;
        }
      }

      onNode(child$1, active.length ? active.slice() : nothing, deco.forChild(offset, child$1), index);
      offset = end;
    }
  } // List markers in Mobile Safari will mysteriously disappear
  // sometimes. This works around that.


  function iosHacks(dom) {
    if (dom.nodeName == "UL" || dom.nodeName == "OL") {
      var oldCSS = dom.style.cssText;
      dom.style.cssText = oldCSS + "; list-style: square !important";
      window.getComputedStyle(dom).listStyle;
      dom.style.cssText = oldCSS;
    }
  }

  function nearbyTextNode(node, offset) {
    for (;;) {
      if (node.nodeType == 3) {
        return node;
      }

      if (node.nodeType == 1 && offset > 0) {
        if (node.childNodes.length > offset && node.childNodes[offset].nodeType == 3) {
          return node.childNodes[offset];
        }

        node = node.childNodes[offset - 1];
        offset = nodeSize(node);
      } else if (node.nodeType == 1 && offset < node.childNodes.length) {
        node = node.childNodes[offset];
        offset = 0;
      } else {
        return null;
      }
    }
  } // Find a piece of text in an inline fragment, overlapping from-to


  function findTextInFragment(frag, text, from, to) {
    for (var str = "", i = 0, childPos = 0; i < frag.childCount; i++) {
      var child = frag.child(i),
          end = childPos + child.nodeSize;

      if (child.isText) {
        str += child.text;

        if (end >= to) {
          var strStart = end - str.length,
              found = str.lastIndexOf(text);

          while (found > -1 && strStart + found > from) {
            found = str.lastIndexOf(text, found - 1);
          }

          if (found > -1 && strStart + found + text.length >= to) {
            return strStart + found;
          } else if (end > to) {
            break;
          }
        }
      } else {
        str = "";
      }

      childPos = end;
    }

    return -1;
  } // Replace range from-to in an array of view descs with replacement
  // (may be null to just delete). This goes very much against the grain
  // of the rest of this code, which tends to create nodes with the
  // right shape in one go, rather than messing with them after
  // creation, but is necessary in the composition hack.


  function replaceNodes(nodes, from, to, view, replacement) {
    var result = [];

    for (var i = 0, off = 0; i < nodes.length; i++) {
      var child = nodes[i],
          start = off,
          end = off += child.size;

      if (start >= to || end <= from) {
        result.push(child);
      } else {
        if (start < from) {
          result.push(child.slice(0, from - start, view));
        }

        if (replacement) {
          result.push(replacement);
          replacement = null;
        }

        if (end > to) {
          result.push(child.slice(to - start, child.size, view));
        }
      }
    }

    return result;
  }

  function moveSelectionBlock(state, dir) {
    var ref = state.selection;
    var $anchor = ref.$anchor;
    var $head = ref.$head;
    var $side = dir > 0 ? $anchor.max($head) : $anchor.min($head);
    var $start = !$side.parent.inlineContent ? $side : $side.depth ? state.doc.resolve(dir > 0 ? $side.after() : $side.before()) : null;
    return $start && Selection.findFrom($start, dir);
  }

  function apply(view, sel) {
    view.dispatch(view.state.tr.setSelection(sel).scrollIntoView());
    return true;
  }

  function selectHorizontally(view, dir, mods) {
    var sel = view.state.selection;

    if (sel instanceof TextSelection) {
      if (!sel.empty || mods.indexOf("s") > -1) {
        return false;
      } else if (view.endOfTextblock(dir > 0 ? "right" : "left")) {
        var next = moveSelectionBlock(view.state, dir);

        if (next && next instanceof NodeSelection) {
          return apply(view, next);
        }

        return false;
      } else {
        var $head = sel.$head,
            node = $head.textOffset ? null : dir < 0 ? $head.nodeBefore : $head.nodeAfter,
            desc;

        if (!node || node.isText) {
          return false;
        }

        var nodePos = dir < 0 ? $head.pos - node.nodeSize : $head.pos;

        if (!(node.isAtom || (desc = view.docView.descAt(nodePos)) && !desc.contentDOM)) {
          return false;
        }

        if (NodeSelection.isSelectable(node)) {
          return apply(view, new NodeSelection(dir < 0 ? view.state.doc.resolve($head.pos - node.nodeSize) : $head));
        } else if (result.webkit) {
          // Chrome and Safari will introduce extra pointless cursor
          // positions around inline uneditable nodes, so we have to
          // take over and move the cursor past them (#937)
          return apply(view, new TextSelection(view.state.doc.resolve(dir < 0 ? nodePos : nodePos + node.nodeSize)));
        } else {
          return false;
        }
      }
    } else if (sel instanceof NodeSelection && sel.node.isInline) {
      return apply(view, new TextSelection(dir > 0 ? sel.$to : sel.$from));
    } else {
      var next$1 = moveSelectionBlock(view.state, dir);

      if (next$1) {
        return apply(view, next$1);
      }

      return false;
    }
  }

  function nodeLen(node) {
    return node.nodeType == 3 ? node.nodeValue.length : node.childNodes.length;
  }

  function isIgnorable(dom) {
    var desc = dom.pmViewDesc;
    return desc && desc.size == 0 && (dom.nextSibling || dom.nodeName != "BR");
  } // Make sure the cursor isn't directly after one or more ignored
  // nodes, which will confuse the browser's cursor motion logic.


  function skipIgnoredNodesLeft(view) {
    var sel = view.root.getSelection();
    var node = sel.focusNode,
        offset = sel.focusOffset;

    if (!node) {
      return;
    }

    var moveNode,
        moveOffset,
        force = false; // Gecko will do odd things when the selection is directly in front
    // of a non-editable node, so in that case, move it into the next
    // node if possible. Issue prosemirror/prosemirror#832.

    if (result.gecko && node.nodeType == 1 && offset < nodeLen(node) && isIgnorable(node.childNodes[offset])) {
      force = true;
    }

    for (;;) {
      if (offset > 0) {
        if (node.nodeType != 1) {
          break;
        } else {
          var before = node.childNodes[offset - 1];

          if (isIgnorable(before)) {
            moveNode = node;
            moveOffset = --offset;
          } else if (before.nodeType == 3) {
            node = before;
            offset = node.nodeValue.length;
          } else {
            break;
          }
        }
      } else if (isBlockNode(node)) {
        break;
      } else {
        var prev = node.previousSibling;

        while (prev && isIgnorable(prev)) {
          moveNode = node.parentNode;
          moveOffset = domIndex(prev);
          prev = prev.previousSibling;
        }

        if (!prev) {
          node = node.parentNode;

          if (node == view.dom) {
            break;
          }

          offset = 0;
        } else {
          node = prev;
          offset = nodeLen(node);
        }
      }
    }

    if (force) {
      setSelFocus(view, sel, node, offset);
    } else if (moveNode) {
      setSelFocus(view, sel, moveNode, moveOffset);
    }
  } // Make sure the cursor isn't directly before one or more ignored
  // nodes.


  function skipIgnoredNodesRight(view) {
    var sel = view.root.getSelection();
    var node = sel.focusNode,
        offset = sel.focusOffset;

    if (!node) {
      return;
    }

    var len = nodeLen(node);
    var moveNode, moveOffset;

    for (;;) {
      if (offset < len) {
        if (node.nodeType != 1) {
          break;
        }

        var after = node.childNodes[offset];

        if (isIgnorable(after)) {
          moveNode = node;
          moveOffset = ++offset;
        } else {
          break;
        }
      } else if (isBlockNode(node)) {
        break;
      } else {
        var next = node.nextSibling;

        while (next && isIgnorable(next)) {
          moveNode = next.parentNode;
          moveOffset = domIndex(next) + 1;
          next = next.nextSibling;
        }

        if (!next) {
          node = node.parentNode;

          if (node == view.dom) {
            break;
          }

          offset = len = 0;
        } else {
          node = next;
          offset = 0;
          len = nodeLen(node);
        }
      }
    }

    if (moveNode) {
      setSelFocus(view, sel, moveNode, moveOffset);
    }
  }

  function isBlockNode(dom) {
    var desc = dom.pmViewDesc;
    return desc && desc.node && desc.node.isBlock;
  }

  function setSelFocus(view, sel, node, offset) {
    if (selectionCollapsed(sel)) {
      var range = document.createRange();
      range.setEnd(node, offset);
      range.setStart(node, offset);
      sel.removeAllRanges();
      sel.addRange(range);
    } else if (sel.extend) {
      sel.extend(node, offset);
    }

    view.domObserver.setCurSelection();
  } // : (EditorState, number)
  // Check whether vertical selection motion would involve node
  // selections. If so, apply it (if not, the result is left to the
  // browser)


  function selectVertically(view, dir, mods) {
    var sel = view.state.selection;

    if (sel instanceof TextSelection && !sel.empty || mods.indexOf("s") > -1) {
      return false;
    }

    var $from = sel.$from;
    var $to = sel.$to;

    if (!$from.parent.inlineContent || view.endOfTextblock(dir < 0 ? "up" : "down")) {
      var next = moveSelectionBlock(view.state, dir);

      if (next && next instanceof NodeSelection) {
        return apply(view, next);
      }
    }

    if (!$from.parent.inlineContent) {
      var beyond = Selection.findFrom(dir < 0 ? $from : $to, dir);
      return beyond ? apply(view, beyond) : true;
    }

    return false;
  }

  function stopNativeHorizontalDelete(view, dir) {
    if (!(view.state.selection instanceof TextSelection)) {
      return true;
    }

    var ref = view.state.selection;
    var $head = ref.$head;
    var $anchor = ref.$anchor;
    var empty = ref.empty;

    if (!$head.sameParent($anchor)) {
      return true;
    }

    if (!empty) {
      return false;
    }

    if (view.endOfTextblock(dir > 0 ? "forward" : "backward")) {
      return true;
    }

    var nextNode = !$head.textOffset && (dir < 0 ? $head.nodeBefore : $head.nodeAfter);

    if (nextNode && !nextNode.isText) {
      var tr = view.state.tr;

      if (dir < 0) {
        tr.delete($head.pos - nextNode.nodeSize, $head.pos);
      } else {
        tr.delete($head.pos, $head.pos + nextNode.nodeSize);
      }

      view.dispatch(tr);
      return true;
    }

    return false;
  }

  function switchEditable(view, node, state) {
    view.domObserver.stop();
    node.contentEditable = state;
    view.domObserver.start();
  } // Issue #867 / https://bugs.chromium.org/p/chromium/issues/detail?id=903821
  // In which Chrome does really wrong things when the down arrow is
  // pressed when the cursor is directly at the start of a textblock and
  // has an uneditable node after it


  function chromeDownArrowBug(view) {
    if (!result.chrome || view.state.selection.$head.parentOffset > 0) {
      return;
    }

    var ref = view.root.getSelection();
    var focusNode = ref.focusNode;
    var focusOffset = ref.focusOffset;

    if (focusNode && focusNode.nodeType == 1 && focusOffset == 0 && focusNode.firstChild && focusNode.firstChild.contentEditable == "false") {
      var child = focusNode.firstChild;
      switchEditable(view, child, true);
      setTimeout(function () {
        return switchEditable(view, child, false);
      }, 20);
    }
  } // A backdrop key mapping used to make sure we always suppress keys
  // that have a dangerous default effect, even if the commands they are
  // bound to return false, and to make sure that cursor-motion keys
  // find a cursor (as opposed to a node selection) when pressed. For
  // cursor-motion keys, the code in the handlers also takes care of
  // block selections.


  function getMods(event) {
    var result = "";

    if (event.ctrlKey) {
      result += "c";
    }

    if (event.metaKey) {
      result += "m";
    }

    if (event.altKey) {
      result += "a";
    }

    if (event.shiftKey) {
      result += "s";
    }

    return result;
  }

  function captureKeyDown(view, event) {
    var code = event.keyCode,
        mods = getMods(event);

    if (code == 8 || result.mac && code == 72 && mods == "c") {
      // Backspace, Ctrl-h on Mac
      return stopNativeHorizontalDelete(view, -1) || skipIgnoredNodesLeft(view);
    } else if (code == 46 || result.mac && code == 68 && mods == "c") {
      // Delete, Ctrl-d on Mac
      return stopNativeHorizontalDelete(view, 1) || skipIgnoredNodesRight(view);
    } else if (code == 13 || code == 27) {
      // Enter, Esc
      return true;
    } else if (code == 37) {
      // Left arrow
      return selectHorizontally(view, -1, mods) || skipIgnoredNodesLeft(view);
    } else if (code == 39) {
      // Right arrow
      return selectHorizontally(view, 1, mods) || skipIgnoredNodesRight(view);
    } else if (code == 38) {
      // Up arrow
      return selectVertically(view, -1, mods) || skipIgnoredNodesLeft(view);
    } else if (code == 40) {
      // Down arrow
      return chromeDownArrowBug(view) || selectVertically(view, 1, mods) || skipIgnoredNodesRight(view);
    } else if (mods == (result.mac ? "m" : "c") && (code == 66 || code == 73 || code == 89 || code == 90)) {
      // Mod-[biyz]
      return true;
    }

    return false;
  }

  function selectionFromDOM(view, origin) {
    var domSel = view.root.getSelection(),
        doc = view.state.doc;
    var nearestDesc = view.docView.nearestDesc(domSel.focusNode),
        inWidget = nearestDesc && nearestDesc.size == 0;
    var head = view.docView.posFromDOM(domSel.focusNode, domSel.focusOffset);
    var $head = doc.resolve(head),
        $anchor,
        selection;

    if (selectionCollapsed(domSel)) {
      $anchor = $head;

      while (nearestDesc && !nearestDesc.node) {
        nearestDesc = nearestDesc.parent;
      }

      if (nearestDesc && nearestDesc.node.isAtom && NodeSelection.isSelectable(nearestDesc.node) && nearestDesc.parent) {
        var pos = nearestDesc.posBefore;
        selection = new NodeSelection(head == pos ? $head : doc.resolve(pos));
      }
    } else {
      $anchor = doc.resolve(view.docView.posFromDOM(domSel.anchorNode, domSel.anchorOffset));
    }

    if (!selection) {
      var bias = origin == "pointer" || view.state.selection.head < $head.pos && !inWidget ? 1 : -1;
      selection = selectionBetween(view, $anchor, $head, bias);
    }

    return selection;
  }

  function selectionToDOM(view, force) {
    var sel = view.state.selection;
    syncNodeSelection(view, sel);

    if (view.editable ? !view.hasFocus() : !(hasSelection(view) && document.activeElement.contains(view.dom))) {
      return;
    }

    view.domObserver.disconnectSelection();

    if (view.cursorWrapper) {
      selectCursorWrapper(view);
    } else {
      var anchor = sel.anchor;
      var head = sel.head;
      var resetEditableFrom, resetEditableTo;

      if (brokenSelectBetweenUneditable && !(sel instanceof TextSelection)) {
        if (!sel.$from.parent.inlineContent) {
          resetEditableFrom = temporarilyEditableNear(view, sel.from);
        }

        if (!sel.empty && !sel.$from.parent.inlineContent) {
          resetEditableTo = temporarilyEditableNear(view, sel.to);
        }
      }

      view.docView.setSelection(anchor, head, view.root, force);

      if (brokenSelectBetweenUneditable) {
        if (resetEditableFrom) {
          resetEditableFrom.contentEditable = "false";
        }

        if (resetEditableTo) {
          resetEditableTo.contentEditable = "false";
        }
      }

      if (sel.visible) {
        view.dom.classList.remove("ProseMirror-hideselection");
      } else if (anchor != head) {
        view.dom.classList.add("ProseMirror-hideselection");

        if ("onselectionchange" in document) {
          removeClassOnSelectionChange(view);
        }
      }
    }

    view.domObserver.setCurSelection();
    view.domObserver.connectSelection();
  } // Kludge to work around Webkit not allowing a selection to start/end
  // between non-editable block nodes. We briefly make something
  // editable, set the selection, then set it uneditable again.


  var brokenSelectBetweenUneditable = result.safari || result.chrome && result.chrome_version < 63;

  function temporarilyEditableNear(view, pos) {
    var ref = view.docView.domFromPos(pos);
    var node = ref.node;
    var offset = ref.offset;
    var after = offset < node.childNodes.length ? node.childNodes[offset] : null;
    var before = offset ? node.childNodes[offset - 1] : null;

    if ((!after || after.contentEditable == "false") && (!before || before.contentEditable == "false")) {
      if (after) {
        after.contentEditable = "true";
        return after;
      } else if (before) {
        before.contentEditable = "true";
        return before;
      }
    }
  }

  function removeClassOnSelectionChange(view) {
    var doc = view.dom.ownerDocument;
    doc.removeEventListener("selectionchange", view.hideSelectionGuard);
    var domSel = view.root.getSelection();
    var node = domSel.anchorNode,
        offset = domSel.anchorOffset;
    doc.addEventListener("selectionchange", view.hideSelectionGuard = function () {
      if (domSel.anchorNode != node || domSel.anchorOffset != offset) {
        doc.removeEventListener("selectionchange", view.hideSelectionGuard);
        view.dom.classList.remove("ProseMirror-hideselection");
      }
    });
  }

  function selectCursorWrapper(view) {
    var domSel = view.root.getSelection(),
        range = document.createRange();
    var node = view.cursorWrapper.dom,
        img = node.nodeName == "IMG";

    if (img) {
      range.setEnd(node.parentNode, domIndex(node) + 1);
    } else {
      range.setEnd(node, 0);
    }

    range.collapse(false);
    domSel.removeAllRanges();
    domSel.addRange(range); // Kludge to kill 'control selection' in IE11 when selecting an
    // invisible cursor wrapper, since that would result in those weird
    // resize handles and a selection that considers the absolutely
    // positioned wrapper, rather than the root editable node, the
    // focused element.

    if (!img && !view.state.selection.visible && result.ie && result.ie_version <= 11) {
      node.disabled = true;
      node.disabled = false;
    }
  }

  function syncNodeSelection(view, sel) {
    if (sel instanceof NodeSelection) {
      var desc = view.docView.descAt(sel.from);

      if (desc != view.lastSelectedViewDesc) {
        clearNodeSelection(view);

        if (desc) {
          desc.selectNode();
        }

        view.lastSelectedViewDesc = desc;
      }
    } else {
      clearNodeSelection(view);
    }
  } // Clear all DOM statefulness of the last node selection.


  function clearNodeSelection(view) {
    if (view.lastSelectedViewDesc) {
      if (view.lastSelectedViewDesc.parent) {
        view.lastSelectedViewDesc.deselectNode();
      }

      view.lastSelectedViewDesc = null;
    }
  }

  function selectionBetween(view, $anchor, $head, bias) {
    return view.someProp("createSelectionBetween", function (f) {
      return f(view, $anchor, $head);
    }) || TextSelection.between($anchor, $head, bias);
  }

  function hasFocusAndSelection(view) {
    if (view.editable && view.root.activeElement != view.dom) {
      return false;
    }

    return hasSelection(view);
  }

  function hasSelection(view) {
    var sel = view.root.getSelection();

    if (!sel.anchorNode) {
      return false;
    }

    try {
      // Firefox will raise 'permission denied' errors when accessing
      // properties of `sel.anchorNode` when it's in a generated CSS
      // element.
      return view.dom.contains(sel.anchorNode.nodeType == 3 ? sel.anchorNode.parentNode : sel.anchorNode) && (view.editable || view.dom.contains(sel.focusNode.nodeType == 3 ? sel.focusNode.parentNode : sel.focusNode));
    } catch (_) {
      return false;
    }
  }

  function anchorInRightPlace(view) {
    var anchorDOM = view.docView.domFromPos(view.state.selection.anchor);
    var domSel = view.root.getSelection();
    return isEquivalentPosition(anchorDOM.node, anchorDOM.offset, domSel.anchorNode, domSel.anchorOffset);
  } // Note that all referencing and parsing is done with the
  // start-of-operation selection and document, since that's the one
  // that the DOM represents. If any changes came in in the meantime,
  // the modification is mapped over those before it is applied, in
  // readDOMChange.


  function parseBetween(view, from_, to_) {
    var ref = view.docView.parseRange(from_, to_);
    var parent = ref.node;
    var fromOffset = ref.fromOffset;
    var toOffset = ref.toOffset;
    var from = ref.from;
    var to = ref.to;
    var domSel = view.root.getSelection(),
        find = null,
        anchor = domSel.anchorNode;

    if (anchor && view.dom.contains(anchor.nodeType == 1 ? anchor : anchor.parentNode)) {
      find = [{
        node: anchor,
        offset: domSel.anchorOffset
      }];

      if (!selectionCollapsed(domSel)) {
        find.push({
          node: domSel.focusNode,
          offset: domSel.focusOffset
        });
      }
    } // Work around issue in Chrome where backspacing sometimes replaces
    // the deleted content with a random BR node (issues #799, #831)


    if (result.chrome && view.lastKeyCode === 8) {
      for (var off = toOffset; off > fromOffset; off--) {
        var node = parent.childNodes[off - 1],
            desc = node.pmViewDesc;

        if (node.nodeType == "BR" && !desc) {
          toOffset = off;
          break;
        }

        if (!desc || desc.size) {
          break;
        }
      }
    }

    var startDoc = view.state.doc;
    var parser = view.someProp("domParser") || DOMParser.fromSchema(view.state.schema);
    var $from = startDoc.resolve(from);
    var sel = null,
        doc = parser.parse(parent, {
      topNode: $from.parent,
      topMatch: $from.parent.contentMatchAt($from.index()),
      topOpen: true,
      from: fromOffset,
      to: toOffset,
      preserveWhitespace: $from.parent.type.spec.code ? "full" : true,
      editableContent: true,
      findPositions: find,
      ruleFromNode: ruleFromNode,
      context: $from
    });

    if (find && find[0].pos != null) {
      var anchor$1 = find[0].pos,
          head = find[1] && find[1].pos;

      if (head == null) {
        head = anchor$1;
      }

      sel = {
        anchor: anchor$1 + from,
        head: head + from
      };
    }

    return {
      doc: doc,
      sel: sel,
      from: from,
      to: to
    };
  }

  function ruleFromNode(dom) {
    var desc = dom.pmViewDesc;

    if (desc) {
      return desc.parseRule();
    } else if (dom.nodeName == "BR" && dom.parentNode) {
      // Safari replaces the list item or table cell with a BR
      // directly in the list node (?!) if you delete the last
      // character in a list item or table cell (#708, #862)
      if (result.safari && /^(ul|ol)$/i.test(dom.parentNode.nodeName)) {
        var skip = document.createElement("div");
        skip.appendChild(document.createElement("li"));
        return {
          skip: skip
        };
      } else if (dom.parentNode.lastChild == dom || result.safari && /^(tr|table)$/i.test(dom.parentNode.nodeName)) {
        return {
          ignore: true
        };
      }
    } else if (dom.nodeName == "IMG" && dom.getAttribute("mark-placeholder")) {
      return {
        ignore: true
      };
    }
  }

  function readDOMChange(view, from, to, typeOver) {
    if (from < 0) {
      var origin = view.lastSelectionTime > Date.now() - 50 ? view.lastSelectionOrigin : null;
      var newSel = selectionFromDOM(view, origin);

      if (!view.state.selection.eq(newSel)) {
        var tr$1 = view.state.tr.setSelection(newSel);

        if (origin == "pointer") {
          tr$1.setMeta("pointer", true);
        } else if (origin == "key") {
          tr$1.scrollIntoView();
        }

        view.dispatch(tr$1);
      }

      return;
    }

    var $before = view.state.doc.resolve(from);
    var shared = $before.sharedDepth(to);
    from = $before.before(shared + 1);
    to = view.state.doc.resolve(to).after(shared + 1);
    var sel = view.state.selection;
    var parse = parseBetween(view, from, to);
    var doc = view.state.doc,
        compare = doc.slice(parse.from, parse.to);
    var preferredPos, preferredSide; // Prefer anchoring to end when Backspace is pressed

    if (view.lastKeyCode === 8 && Date.now() - 100 < view.lastKeyCodeTime) {
      preferredPos = view.state.selection.to;
      preferredSide = "end";
    } else {
      preferredPos = view.state.selection.from;
      preferredSide = "start";
    }

    view.lastKeyCode = null;
    var change = findDiff(compare.content, parse.doc.content, parse.from, preferredPos, preferredSide);

    if (!change) {
      if (typeOver && sel instanceof TextSelection && !sel.empty && sel.$head.sameParent(sel.$anchor) && !view.composing && !(parse.sel && parse.sel.anchor != parse.sel.head)) {
        change = {
          start: sel.from,
          endA: sel.to,
          endB: sel.to
        };
      } else {
        if (parse.sel) {
          var sel$1 = resolveSelection(view, view.state.doc, parse.sel);

          if (sel$1 && !sel$1.eq(view.state.selection)) {
            view.dispatch(view.state.tr.setSelection(sel$1));
          }
        }

        return;
      }
    }

    view.domChangeCount++; // Handle the case where overwriting a selection by typing matches
    // the start or end of the selected content, creating a change
    // that's smaller than what was actually overwritten.

    if (view.state.selection.from < view.state.selection.to && change.start == change.endB && view.state.selection instanceof TextSelection) {
      if (change.start > view.state.selection.from && change.start <= view.state.selection.from + 2) {
        change.start = view.state.selection.from;
      } else if (change.endA < view.state.selection.to && change.endA >= view.state.selection.to - 2) {
        change.endB += view.state.selection.to - change.endA;
        change.endA = view.state.selection.to;
      }
    } // IE11 will insert a non-breaking space _ahead_ of the space after
    // the cursor space when adding a space before another space. When
    // that happened, adjust the change to cover the space instead.


    if (result.ie && result.ie_version <= 11 && change.endB == change.start + 1 && change.endA == change.start && change.start > parse.from && parse.doc.textBetween(change.start - parse.from - 1, change.start - parse.from + 1) == " \u00a0") {
      change.start--;
      change.endA--;
      change.endB--;
    }

    var $from = parse.doc.resolveNoCache(change.start - parse.from);
    var $to = parse.doc.resolveNoCache(change.endB - parse.from);
    var nextSel; // If this looks like the effect of pressing Enter, just dispatch an
    // Enter key instead.

    if (!$from.sameParent($to) && $from.pos < parse.doc.content.size && (nextSel = Selection.findFrom(parse.doc.resolve($from.pos + 1), 1, true)) && nextSel.head == $to.pos && view.someProp("handleKeyDown", function (f) {
      return f(view, keyEvent(13, "Enter"));
    })) {
      return;
    } // Same for backspace


    if (view.state.selection.anchor > change.start && looksLikeJoin(doc, change.start, change.endA, $from, $to) && view.someProp("handleKeyDown", function (f) {
      return f(view, keyEvent(8, "Backspace"));
    })) {
      if (result.android && result.chrome) {
        view.domObserver.suppressSelectionUpdates();
      } // #820


      return;
    }

    var chFrom = change.start,
        chTo = change.endA;
    var tr, storedMarks, markChange, $from1;

    if ($from.sameParent($to) && $from.parent.inlineContent) {
      if ($from.pos == $to.pos) {
        // Deletion
        // IE11 sometimes weirdly moves the DOM selection around after
        // backspacing out the first element in a textblock
        if (result.ie && result.ie_version <= 11 && $from.parentOffset == 0) {
          view.domObserver.suppressSelectionUpdates();
          setTimeout(function () {
            return selectionToDOM(view);
          }, 20);
        }

        tr = view.state.tr.delete(chFrom, chTo);
        storedMarks = doc.resolve(change.start).marksAcross(doc.resolve(change.endA));
      } else if ( // Adding or removing a mark
      change.endA == change.endB && ($from1 = doc.resolve(change.start)) && (markChange = isMarkChange($from.parent.content.cut($from.parentOffset, $to.parentOffset), $from1.parent.content.cut($from1.parentOffset, change.endA - $from1.start())))) {
        tr = view.state.tr;

        if (markChange.type == "add") {
          tr.addMark(chFrom, chTo, markChange.mark);
        } else {
          tr.removeMark(chFrom, chTo, markChange.mark);
        }
      } else if ($from.parent.child($from.index()).isText && $from.index() == $to.index() - ($to.textOffset ? 0 : 1)) {
        // Both positions in the same text node -- simply insert text
        var text = $from.parent.textBetween($from.parentOffset, $to.parentOffset);

        if (view.someProp("handleTextInput", function (f) {
          return f(view, chFrom, chTo, text);
        })) {
          return;
        }

        tr = view.state.tr.insertText(text, chFrom, chTo);
      }
    }

    if (!tr) {
      tr = view.state.tr.replace(chFrom, chTo, parse.doc.slice(change.start - parse.from, change.endB - parse.from));
    }

    if (parse.sel) {
      var sel$2 = resolveSelection(view, tr.doc, parse.sel); // Chrome Android will sometimes, during composition, report the
      // selection in the wrong place. If it looks like that is
      // happening, don't update the selection.
      // Edge just doesn't move the cursor forward when you start typing
      // in an empty block or between br nodes.

      if (sel$2 && !(result.chrome && result.android && view.composing && sel$2.empty && sel$2.head == chFrom || result.ie && sel$2.empty && sel$2.head == chFrom)) {
        tr.setSelection(sel$2);
      }
    }

    if (storedMarks) {
      tr.ensureMarks(storedMarks);
    }

    view.dispatch(tr.scrollIntoView());
  }

  function resolveSelection(view, doc, parsedSel) {
    if (Math.max(parsedSel.anchor, parsedSel.head) > doc.content.size) {
      return null;
    }

    return selectionBetween(view, doc.resolve(parsedSel.anchor), doc.resolve(parsedSel.head));
  } // : (Fragment, Fragment) → ?{mark: Mark, type: string}
  // Given two same-length, non-empty fragments of inline content,
  // determine whether the first could be created from the second by
  // removing or adding a single mark type.


  function isMarkChange(cur, prev) {
    var curMarks = cur.firstChild.marks,
        prevMarks = prev.firstChild.marks;
    var added = curMarks,
        removed = prevMarks,
        type,
        mark,
        update;

    for (var i = 0; i < prevMarks.length; i++) {
      added = prevMarks[i].removeFromSet(added);
    }

    for (var i$1 = 0; i$1 < curMarks.length; i$1++) {
      removed = curMarks[i$1].removeFromSet(removed);
    }

    if (added.length == 1 && removed.length == 0) {
      mark = added[0];
      type = "add";

      update = function (node) {
        return node.mark(mark.addToSet(node.marks));
      };
    } else if (added.length == 0 && removed.length == 1) {
      mark = removed[0];
      type = "remove";

      update = function (node) {
        return node.mark(mark.removeFromSet(node.marks));
      };
    } else {
      return null;
    }

    var updated = [];

    for (var i$2 = 0; i$2 < prev.childCount; i$2++) {
      updated.push(update(prev.child(i$2)));
    }

    if (Fragment.from(updated).eq(cur)) {
      return {
        mark: mark,
        type: type
      };
    }
  }

  function looksLikeJoin(old, start, end, $newStart, $newEnd) {
    if (!$newStart.parent.isTextblock || // The content must have shrunk
    end - start <= $newEnd.pos - $newStart.pos || // newEnd must point directly at or after the end of the block that newStart points into
    skipClosingAndOpening($newStart, true, false) < $newEnd.pos) {
      return false;
    }

    var $start = old.resolve(start); // Start must be at the end of a block

    if ($start.parentOffset < $start.parent.content.size || !$start.parent.isTextblock) {
      return false;
    }

    var $next = old.resolve(skipClosingAndOpening($start, true, true)); // The next textblock must start before end and end near it

    if (!$next.parent.isTextblock || $next.pos > end || skipClosingAndOpening($next, true, false) < end) {
      return false;
    } // The fragments after the join point must match


    return $newStart.parent.content.cut($newStart.parentOffset).eq($next.parent.content);
  }

  function skipClosingAndOpening($pos, fromEnd, mayOpen) {
    var depth = $pos.depth,
        end = fromEnd ? $pos.end() : $pos.pos;

    while (depth > 0 && (fromEnd || $pos.indexAfter(depth) == $pos.node(depth).childCount)) {
      depth--;
      end++;
      fromEnd = false;
    }

    if (mayOpen) {
      var next = $pos.node(depth).maybeChild($pos.indexAfter(depth));

      while (next && !next.isLeaf) {
        next = next.firstChild;
        end++;
      }
    }

    return end;
  }

  function findDiff(a, b, pos, preferredPos, preferredSide) {
    var start = a.findDiffStart(b, pos);

    if (start == null) {
      return null;
    }

    var ref = a.findDiffEnd(b, pos + a.size, pos + b.size);
    var endA = ref.a;
    var endB = ref.b;

    if (preferredSide == "end") {
      var adjust = Math.max(0, start - Math.min(endA, endB));
      preferredPos -= endA + adjust - start;
    }

    if (endA < start && a.size < b.size) {
      var move = preferredPos <= start && preferredPos >= endA ? start - preferredPos : 0;
      start -= move;
      endB = start + (endB - endA);
      endA = start;
    } else if (endB < start) {
      var move$1 = preferredPos <= start && preferredPos >= endB ? start - preferredPos : 0;
      start -= move$1;
      endA = start + (endA - endB);
      endB = start;
    }

    return {
      start: start,
      endA: endA,
      endB: endB
    };
  }

  function serializeForClipboard(view, slice) {
    var context = [];
    var content = slice.content;
    var openStart = slice.openStart;
    var openEnd = slice.openEnd;

    while (openStart > 1 && openEnd > 1 && content.childCount == 1 && content.firstChild.childCount == 1) {
      openStart--;
      openEnd--;
      var node = content.firstChild;
      context.push(node.type.name, node.type.hasRequiredAttrs() ? node.attrs : null);
      content = node.content;
    }

    var serializer = view.someProp("clipboardSerializer") || DOMSerializer.fromSchema(view.state.schema);
    var doc = detachedDoc(),
        wrap = doc.createElement("div");
    wrap.appendChild(serializer.serializeFragment(content, {
      document: doc
    }));
    var firstChild = wrap.firstChild,
        needsWrap;

    while (firstChild && firstChild.nodeType == 1 && (needsWrap = wrapMap[firstChild.nodeName.toLowerCase()])) {
      for (var i = needsWrap.length - 1; i >= 0; i--) {
        var wrapper = doc.createElement(needsWrap[i]);

        while (wrap.firstChild) {
          wrapper.appendChild(wrap.firstChild);
        }

        wrap.appendChild(wrapper);
      }

      firstChild = wrap.firstChild;
    }

    if (firstChild && firstChild.nodeType == 1) {
      firstChild.setAttribute("data-pm-slice", openStart + " " + openEnd + " " + JSON.stringify(context));
    }

    var text = view.someProp("clipboardTextSerializer", function (f) {
      return f(slice);
    }) || slice.content.textBetween(0, slice.content.size, "\n\n");
    return {
      dom: wrap,
      text: text
    };
  } // : (EditorView, string, string, ?bool, ResolvedPos) → ?Slice
  // Read a slice of content from the clipboard (or drop data).


  function parseFromClipboard(view, text, html, plainText, $context) {
    var dom,
        inCode = $context.parent.type.spec.code,
        slice;

    if (!html && !text) {
      return null;
    }

    var asText = text && (plainText || inCode || !html);

    if (asText) {
      view.someProp("transformPastedText", function (f) {
        text = f(text);
      });

      if (inCode) {
        return new Slice(Fragment.from(view.state.schema.text(text)), 0, 0);
      }

      var parsed = view.someProp("clipboardTextParser", function (f) {
        return f(text, $context);
      });

      if (parsed) {
        slice = parsed;
      } else {
        dom = document.createElement("div");
        text.trim().split(/(?:\r\n?|\n)+/).forEach(function (block) {
          dom.appendChild(document.createElement("p")).textContent = block;
        });
      }
    } else {
      view.someProp("transformPastedHTML", function (f) {
        html = f(html);
      });
      dom = readHTML(html);
    }

    var contextNode = dom && dom.querySelector("[data-pm-slice]");
    var sliceData = contextNode && /^(\d+) (\d+) (.*)/.exec(contextNode.getAttribute("data-pm-slice"));

    if (!slice) {
      var parser = view.someProp("clipboardParser") || view.someProp("domParser") || DOMParser.fromSchema(view.state.schema);
      slice = parser.parseSlice(dom, {
        preserveWhitespace: !!(asText || sliceData),
        context: $context
      });
    }

    if (sliceData) {
      slice = addContext(closeSlice(slice, +sliceData[1], +sliceData[2]), sliceData[3]);
    } else // HTML wasn't created by ProseMirror. Make sure top-level siblings are coherent
      {
        slice = Slice.maxOpen(normalizeSiblings(slice.content, $context), false);
      }

    view.someProp("transformPasted", function (f) {
      slice = f(slice);
    });
    return slice;
  } // Takes a slice parsed with parseSlice, which means there hasn't been
  // any content-expression checking done on the top nodes, tries to
  // find a parent node in the current context that might fit the nodes,
  // and if successful, rebuilds the slice so that it fits into that parent.
  //
  // This addresses the problem that Transform.replace expects a
  // coherent slice, and will fail to place a set of siblings that don't
  // fit anywhere in the schema.


  function normalizeSiblings(fragment, $context) {
    if (fragment.childCount < 2) {
      return fragment;
    }

    var loop = function (d) {
      var parent = $context.node(d);
      var match = parent.contentMatchAt($context.index(d));
      var lastWrap = void 0,
          result = [];
      fragment.forEach(function (node) {
        if (!result) {
          return;
        }

        var wrap = match.findWrapping(node.type),
            inLast;

        if (!wrap) {
          return result = null;
        }

        if (inLast = result.length && lastWrap.length && addToSibling(wrap, lastWrap, node, result[result.length - 1], 0)) {
          result[result.length - 1] = inLast;
        } else {
          if (result.length) {
            result[result.length - 1] = closeRight(result[result.length - 1], lastWrap.length);
          }

          var wrapped = withWrappers(node, wrap);
          result.push(wrapped);
          match = match.matchType(wrapped.type, wrapped.attrs);
          lastWrap = wrap;
        }
      });

      if (result) {
        return {
          v: Fragment.from(result)
        };
      }
    };

    for (var d = $context.depth; d >= 0; d--) {
      var returned = loop(d);
      if (returned) return returned.v;
    }

    return fragment;
  }

  function withWrappers(node, wrap, from) {
    if (from === void 0) from = 0;

    for (var i = wrap.length - 1; i >= from; i--) {
      node = wrap[i].create(null, Fragment.from(node));
    }

    return node;
  } // Used to group adjacent nodes wrapped in similar parents by
  // normalizeSiblings into the same parent node


  function addToSibling(wrap, lastWrap, node, sibling, depth) {
    if (depth < wrap.length && depth < lastWrap.length && wrap[depth] == lastWrap[depth]) {
      var inner = addToSibling(wrap, lastWrap, node, sibling.lastChild, depth + 1);

      if (inner) {
        return sibling.copy(sibling.content.replaceChild(sibling.childCount - 1, inner));
      }

      var match = sibling.contentMatchAt(sibling.childCount);

      if (match.matchType(depth == wrap.length - 1 ? node.type : wrap[depth + 1])) {
        return sibling.copy(sibling.content.append(Fragment.from(withWrappers(node, wrap, depth + 1))));
      }
    }
  }

  function closeRight(node, depth) {
    if (depth == 0) {
      return node;
    }

    var fragment = node.content.replaceChild(node.childCount - 1, closeRight(node.lastChild, depth - 1));
    var fill = node.contentMatchAt(node.childCount).fillBefore(Fragment.empty, true);
    return node.copy(fragment.append(fill));
  }

  function closeRange(fragment, side, from, to, depth, openEnd) {
    var node = side < 0 ? fragment.firstChild : fragment.lastChild,
        inner = node.content;

    if (depth < to - 1) {
      inner = closeRange(inner, side, from, to, depth + 1, openEnd);
    }

    if (depth >= from) {
      inner = side < 0 ? node.contentMatchAt(0).fillBefore(inner, fragment.childCount > 1 || openEnd <= depth).append(inner) : inner.append(node.contentMatchAt(node.childCount).fillBefore(Fragment.empty, true));
    }

    return fragment.replaceChild(side < 0 ? 0 : fragment.childCount - 1, node.copy(inner));
  }

  function closeSlice(slice, openStart, openEnd) {
    if (openStart < slice.openStart) {
      slice = new Slice(closeRange(slice.content, -1, openStart, slice.openStart, 0, slice.openEnd), openStart, slice.openEnd);
    }

    if (openEnd < slice.openEnd) {
      slice = new Slice(closeRange(slice.content, 1, openEnd, slice.openEnd, 0, 0), slice.openStart, openEnd);
    }

    return slice;
  } // Trick from jQuery -- some elements must be wrapped in other
  // elements for innerHTML to work. I.e. if you do `div.innerHTML =
  // "<td>..</td>"` the table cells are ignored.


  var wrapMap = {
    thead: ["table"],
    colgroup: ["table"],
    col: ["table", "colgroup"],
    tr: ["table", "tbody"],
    td: ["table", "tbody", "tr"],
    th: ["table", "tbody", "tr"]
  };
  var _detachedDoc = null;

  function detachedDoc() {
    return _detachedDoc || (_detachedDoc = document.implementation.createHTMLDocument("title"));
  }

  function readHTML(html) {
    var metas = /(\s*<meta [^>]*>)*/.exec(html);

    if (metas) {
      html = html.slice(metas[0].length);
    }

    var elt = detachedDoc().createElement("div");
    var firstTag = /(?:<meta [^>]*>)*<([a-z][^>\s]+)/i.exec(html),
        wrap,
        depth = 0;

    if (wrap = firstTag && wrapMap[firstTag[1].toLowerCase()]) {
      html = wrap.map(function (n) {
        return "<" + n + ">";
      }).join("") + html + wrap.map(function (n) {
        return "</" + n + ">";
      }).reverse().join("");
      depth = wrap.length;
    }

    elt.innerHTML = html;

    for (var i = 0; i < depth; i++) {
      elt = elt.firstChild;
    }

    return elt;
  }

  function addContext(slice, context) {
    if (!slice.size) {
      return slice;
    }

    var schema = slice.content.firstChild.type.schema,
        array;

    try {
      array = JSON.parse(context);
    } catch (e) {
      return slice;
    }

    var content = slice.content;
    var openStart = slice.openStart;
    var openEnd = slice.openEnd;

    for (var i = array.length - 2; i >= 0; i -= 2) {
      var type = schema.nodes[array[i]];

      if (!type || type.hasRequiredAttrs()) {
        break;
      }

      content = Fragment.from(type.create(array[i + 1], content));
      openStart++;
      openEnd++;
    }

    return new Slice(content, openStart, openEnd);
  }

  var observeOptions = {
    childList: true,
    characterData: true,
    characterDataOldValue: true,
    attributes: true,
    attributeOldValue: true,
    subtree: true
  }; // IE11 has very broken mutation observers, so we also listen to DOMCharacterDataModified

  var useCharData = result.ie && result.ie_version <= 11;

  var SelectionState = function SelectionState() {
    this.anchorNode = this.anchorOffset = this.focusNode = this.focusOffset = null;
  };

  SelectionState.prototype.set = function set(sel) {
    this.anchorNode = sel.anchorNode;
    this.anchorOffset = sel.anchorOffset;
    this.focusNode = sel.focusNode;
    this.focusOffset = sel.focusOffset;
  };

  SelectionState.prototype.eq = function eq(sel) {
    return sel.anchorNode == this.anchorNode && sel.anchorOffset == this.anchorOffset && sel.focusNode == this.focusNode && sel.focusOffset == this.focusOffset;
  };

  var DOMObserver = function DOMObserver(view, handleDOMChange) {
    var this$1 = this;
    this.view = view;
    this.handleDOMChange = handleDOMChange;
    this.queue = [];
    this.flushingSoon = false;
    this.observer = window.MutationObserver && new window.MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        this$1.queue.push(mutations[i]);
      } // IE11 will sometimes (on backspacing out a single character
      // text node after a BR node) call the observer callback
      // before actually updating the DOM, which will cause
      // ProseMirror to miss the change (see #930)


      if (result.ie && result.ie_version <= 11 && mutations.some(function (m) {
        return m.type == "childList" && m.removedNodes.length || m.type == "characterData" && m.oldValue.length > m.target.nodeValue.length;
      })) {
        this$1.flushSoon();
      } else {
        this$1.flush();
      }
    });
    this.currentSelection = new SelectionState();

    if (useCharData) {
      this.onCharData = function (e) {
        this$1.queue.push({
          target: e.target,
          type: "characterData",
          oldValue: e.prevValue
        });
        this$1.flushSoon();
      };
    }

    this.onSelectionChange = this.onSelectionChange.bind(this);
    this.suppressingSelectionUpdates = false;
  };

  DOMObserver.prototype.flushSoon = function flushSoon() {
    var this$1 = this;

    if (!this.flushingSoon) {
      this.flushingSoon = true;
      window.setTimeout(function () {
        this$1.flushingSoon = false;
        this$1.flush();
      }, 20);
    }
  };

  DOMObserver.prototype.start = function start() {
    if (this.observer) {
      this.observer.observe(this.view.dom, observeOptions);
    }

    if (useCharData) {
      this.view.dom.addEventListener("DOMCharacterDataModified", this.onCharData);
    }

    this.connectSelection();
  };

  DOMObserver.prototype.stop = function stop() {
    var this$1 = this;

    if (this.observer) {
      var take = this.observer.takeRecords();

      if (take.length) {
        for (var i = 0; i < take.length; i++) {
          this.queue.push(take[i]);
        }

        window.setTimeout(function () {
          return this$1.flush();
        }, 20);
      }

      this.observer.disconnect();
    }

    if (useCharData) {
      this.view.dom.removeEventListener("DOMCharacterDataModified", this.onCharData);
    }

    this.disconnectSelection();
  };

  DOMObserver.prototype.connectSelection = function connectSelection() {
    this.view.dom.ownerDocument.addEventListener("selectionchange", this.onSelectionChange);
  };

  DOMObserver.prototype.disconnectSelection = function disconnectSelection() {
    this.view.dom.ownerDocument.removeEventListener("selectionchange", this.onSelectionChange);
  };

  DOMObserver.prototype.suppressSelectionUpdates = function suppressSelectionUpdates() {
    var this$1 = this;
    this.suppressingSelectionUpdates = true;
    setTimeout(function () {
      return this$1.suppressingSelectionUpdates = false;
    }, 50);
  };

  DOMObserver.prototype.onSelectionChange = function onSelectionChange() {
    if (!hasFocusAndSelection(this.view)) {
      return;
    }

    if (this.suppressingSelectionUpdates) {
      return selectionToDOM(this.view);
    } // Deletions on IE11 fire their events in the wrong order, giving
    // us a selection change event before the DOM changes are
    // reported.


    if (result.ie && result.ie_version <= 11 && !this.view.state.selection.empty) {
      var sel = this.view.root.getSelection(); // Selection.isCollapsed isn't reliable on IE

      if (sel.focusNode && isEquivalentPosition(sel.focusNode, sel.focusOffset, sel.anchorNode, sel.anchorOffset)) {
        return this.flushSoon();
      }
    }

    this.flush();
  };

  DOMObserver.prototype.setCurSelection = function setCurSelection() {
    this.currentSelection.set(this.view.root.getSelection());
  };

  DOMObserver.prototype.ignoreSelectionChange = function ignoreSelectionChange(sel) {
    if (sel.rangeCount == 0) {
      return true;
    }

    var container = sel.getRangeAt(0).commonAncestorContainer;
    var desc = this.view.docView.nearestDesc(container);
    return desc && desc.ignoreMutation({
      type: "selection",
      target: container.nodeType == 3 ? container.parentNode : container
    });
  };

  DOMObserver.prototype.flush = function flush() {
    if (!this.view.docView || this.flushingSoon) {
      return;
    }

    var mutations = this.observer ? this.observer.takeRecords() : [];

    if (this.queue.length) {
      mutations = this.queue.concat(mutations);
      this.queue.length = 0;
    }

    var sel = this.view.root.getSelection();
    var newSel = !this.suppressingSelectionUpdates && !this.currentSelection.eq(sel) && hasSelection(this.view) && !this.ignoreSelectionChange(sel);
    var from = -1,
        to = -1,
        typeOver = false,
        added = [];

    if (this.view.editable) {
      for (var i = 0; i < mutations.length; i++) {
        var result$1 = this.registerMutation(mutations[i], added);

        if (result$1) {
          from = from < 0 ? result$1.from : Math.min(result$1.from, from);
          to = to < 0 ? result$1.to : Math.max(result$1.to, to);

          if (result$1.typeOver && !this.view.composing) {
            typeOver = true;
          }
        }
      }
    }

    if (result.gecko && added.length > 1) {
      var brs = added.filter(function (n) {
        return n.nodeName == "BR";
      });

      if (brs.length == 2) {
        var a = brs[0];
        var b = brs[1];

        if (a.parentNode && a.parentNode.parentNode == b.parentNode) {
          b.remove();
        } else {
          a.remove();
        }
      }
    }

    if (from > -1 || newSel) {
      if (from > -1) {
        this.view.docView.markDirty(from, to);
        checkCSS(this.view);
      }

      this.handleDOMChange(from, to, typeOver);

      if (this.view.docView.dirty) {
        this.view.updateState(this.view.state);
      } else if (!this.currentSelection.eq(sel)) {
        selectionToDOM(this.view);
      }
    }
  };

  DOMObserver.prototype.registerMutation = function registerMutation(mut, added) {
    // Ignore mutations inside nodes that were already noted as inserted
    if (added.indexOf(mut.target) > -1) {
      return null;
    }

    var desc = this.view.docView.nearestDesc(mut.target);

    if (mut.type == "attributes" && (desc == this.view.docView || mut.attributeName == "contenteditable" || // Firefox sometimes fires spurious events for null/empty styles
    mut.attributeName == "style" && !mut.oldValue && !mut.target.getAttribute("style"))) {
      return null;
    }

    if (!desc || desc.ignoreMutation(mut)) {
      return null;
    }

    if (mut.type == "childList") {
      var prev = mut.previousSibling,
          next = mut.nextSibling;

      if (result.ie && result.ie_version <= 11 && mut.addedNodes.length) {
        // IE11 gives us incorrect next/prev siblings for some
        // insertions, so if there are added nodes, recompute those
        for (var i = 0; i < mut.addedNodes.length; i++) {
          var ref = mut.addedNodes[i];
          var previousSibling = ref.previousSibling;
          var nextSibling = ref.nextSibling;

          if (!previousSibling || Array.prototype.indexOf.call(mut.addedNodes, previousSibling) < 0) {
            prev = previousSibling;
          }

          if (!nextSibling || Array.prototype.indexOf.call(mut.addedNodes, nextSibling) < 0) {
            next = nextSibling;
          }
        }
      }

      var fromOffset = prev && prev.parentNode == mut.target ? domIndex(prev) + 1 : 0;
      var from = desc.localPosFromDOM(mut.target, fromOffset, -1);
      var toOffset = next && next.parentNode == mut.target ? domIndex(next) : mut.target.childNodes.length;

      for (var i$1 = 0; i$1 < mut.addedNodes.length; i$1++) {
        added.push(mut.addedNodes[i$1]);
      }

      var to = desc.localPosFromDOM(mut.target, toOffset, 1);
      return {
        from: from,
        to: to
      };
    } else if (mut.type == "attributes") {
      return {
        from: desc.posAtStart - desc.border,
        to: desc.posAtEnd + desc.border
      };
    } else {
      // "characterData"
      return {
        from: desc.posAtStart,
        to: desc.posAtEnd,
        // An event was generated for a text change that didn't change
        // any text. Mark the dom change to fall back to assuming the
        // selection was typed over with an identical value if it can't
        // find another change.
        typeOver: mut.target.nodeValue == mut.oldValue
      };
    }
  };

  var cssChecked = false;

  function checkCSS(view) {
    if (cssChecked) {
      return;
    }

    cssChecked = true;

    if (getComputedStyle(view.dom).whiteSpace == "normal") {
      console["warn"]("ProseMirror expects the CSS white-space property to be set, preferably to 'pre-wrap'. It is recommended to load style/prosemirror.css from the prosemirror-view package.");
    }
  } // A collection of DOM events that occur within the editor, and callback functions
  // to invoke when the event fires.


  var handlers = {},
      editHandlers = {};

  function initInput(view) {
    view.shiftKey = false;
    view.mouseDown = null;
    view.lastKeyCode = null;
    view.lastKeyCodeTime = 0;
    view.lastClick = {
      time: 0,
      x: 0,
      y: 0,
      type: ""
    };
    view.lastSelectionOrigin = null;
    view.lastSelectionTime = 0;
    view.composing = false;
    view.composingTimeout = null;
    view.compositionNodes = [];
    view.compositionEndedAt = -2e8;
    view.domObserver = new DOMObserver(view, function (from, to, typeOver) {
      return readDOMChange(view, from, to, typeOver);
    });
    view.domObserver.start(); // Used by hacks like the beforeinput handler to check whether anything happened in the DOM

    view.domChangeCount = 0;
    view.eventHandlers = Object.create(null);

    var loop = function (event) {
      var handler = handlers[event];
      view.dom.addEventListener(event, view.eventHandlers[event] = function (event) {
        if (eventBelongsToView(view, event) && !runCustomHandler(view, event) && (view.editable || !(event.type in editHandlers))) {
          handler(view, event);
        }
      });
    };

    for (var event in handlers) loop(event); // On Safari, for reasons beyond my understanding, adding an input
    // event handler makes an issue where the composition vanishes when
    // you press enter go away.


    if (result.safari) {
      view.dom.addEventListener("input", function () {
        return null;
      });
    }

    ensureListeners(view);
  }

  function setSelectionOrigin(view, origin) {
    view.lastSelectionOrigin = origin;
    view.lastSelectionTime = Date.now();
  }

  function destroyInput(view) {
    view.domObserver.stop();

    for (var type in view.eventHandlers) {
      view.dom.removeEventListener(type, view.eventHandlers[type]);
    }

    clearTimeout(view.composingTimeout);
  }

  function ensureListeners(view) {
    view.someProp("handleDOMEvents", function (currentHandlers) {
      for (var type in currentHandlers) {
        if (!view.eventHandlers[type]) {
          view.dom.addEventListener(type, view.eventHandlers[type] = function (event) {
            return runCustomHandler(view, event);
          });
        }
      }
    });
  }

  function runCustomHandler(view, event) {
    return view.someProp("handleDOMEvents", function (handlers) {
      var handler = handlers[event.type];
      return handler ? handler(view, event) || event.defaultPrevented : false;
    });
  }

  function eventBelongsToView(view, event) {
    if (!event.bubbles) {
      return true;
    }

    if (event.defaultPrevented) {
      return false;
    }

    for (var node = event.target; node != view.dom; node = node.parentNode) {
      if (!node || node.nodeType == 11 || node.pmViewDesc && node.pmViewDesc.stopEvent(event)) {
        return false;
      }
    }

    return true;
  }

  function dispatchEvent(view, event) {
    if (!runCustomHandler(view, event) && handlers[event.type] && (view.editable || !(event.type in editHandlers))) {
      handlers[event.type](view, event);
    }
  }

  editHandlers.keydown = function (view, event) {
    view.shiftKey = event.keyCode == 16 || event.shiftKey;

    if (inOrNearComposition(view, event)) {
      return;
    }

    view.lastKeyCode = event.keyCode;
    view.lastKeyCodeTime = Date.now();

    if (view.someProp("handleKeyDown", function (f) {
      return f(view, event);
    }) || captureKeyDown(view, event)) {
      event.preventDefault();
    } else {
      setSelectionOrigin(view, "key");
    }
  };

  editHandlers.keyup = function (view, e) {
    if (e.keyCode == 16) {
      view.shiftKey = false;
    }
  };

  editHandlers.keypress = function (view, event) {
    if (inOrNearComposition(view, event) || !event.charCode || event.ctrlKey && !event.altKey || result.mac && event.metaKey) {
      return;
    }

    if (view.someProp("handleKeyPress", function (f) {
      return f(view, event);
    })) {
      event.preventDefault();
      return;
    }

    var sel = view.state.selection;

    if (!(sel instanceof TextSelection) || !sel.$from.sameParent(sel.$to)) {
      var text = String.fromCharCode(event.charCode);

      if (!view.someProp("handleTextInput", function (f) {
        return f(view, sel.$from.pos, sel.$to.pos, text);
      })) {
        view.dispatch(view.state.tr.insertText(text).scrollIntoView());
      }

      event.preventDefault();
    }
  };

  function eventCoords(event) {
    return {
      left: event.clientX,
      top: event.clientY
    };
  }

  function isNear(event, click) {
    var dx = click.x - event.clientX,
        dy = click.y - event.clientY;
    return dx * dx + dy * dy < 100;
  }

  function runHandlerOnContext(view, propName, pos, inside, event) {
    if (inside == -1) {
      return false;
    }

    var $pos = view.state.doc.resolve(inside);

    var loop = function (i) {
      if (view.someProp(propName, function (f) {
        return i > $pos.depth ? f(view, pos, $pos.nodeAfter, $pos.before(i), event, true) : f(view, pos, $pos.node(i), $pos.before(i), event, false);
      })) {
        return {
          v: true
        };
      }
    };

    for (var i = $pos.depth + 1; i > 0; i--) {
      var returned = loop(i);
      if (returned) return returned.v;
    }

    return false;
  }

  function updateSelection(view, selection, origin) {
    if (!view.focused) {
      view.focus();
    }

    var tr = view.state.tr.setSelection(selection);

    if (origin == "pointer") {
      tr.setMeta("pointer", true);
    }

    view.dispatch(tr);
  }

  function selectClickedLeaf(view, inside) {
    if (inside == -1) {
      return false;
    }

    var $pos = view.state.doc.resolve(inside),
        node = $pos.nodeAfter;

    if (node && node.isAtom && NodeSelection.isSelectable(node)) {
      updateSelection(view, new NodeSelection($pos), "pointer");
      return true;
    }

    return false;
  }

  function selectClickedNode(view, inside) {
    if (inside == -1) {
      return false;
    }

    var sel = view.state.selection,
        selectedNode,
        selectAt;

    if (sel instanceof NodeSelection) {
      selectedNode = sel.node;
    }

    var $pos = view.state.doc.resolve(inside);

    for (var i = $pos.depth + 1; i > 0; i--) {
      var node = i > $pos.depth ? $pos.nodeAfter : $pos.node(i);

      if (NodeSelection.isSelectable(node)) {
        if (selectedNode && sel.$from.depth > 0 && i >= sel.$from.depth && $pos.before(sel.$from.depth + 1) == sel.$from.pos) {
          selectAt = $pos.before(sel.$from.depth);
        } else {
          selectAt = $pos.before(i);
        }

        break;
      }
    }

    if (selectAt != null) {
      updateSelection(view, NodeSelection.create(view.state.doc, selectAt), "pointer");
      return true;
    } else {
      return false;
    }
  }

  function handleSingleClick(view, pos, inside, event, selectNode) {
    return runHandlerOnContext(view, "handleClickOn", pos, inside, event) || view.someProp("handleClick", function (f) {
      return f(view, pos, event);
    }) || (selectNode ? selectClickedNode(view, inside) : selectClickedLeaf(view, inside));
  }

  function handleDoubleClick(view, pos, inside, event) {
    return runHandlerOnContext(view, "handleDoubleClickOn", pos, inside, event) || view.someProp("handleDoubleClick", function (f) {
      return f(view, pos, event);
    });
  }

  function handleTripleClick(view, pos, inside, event) {
    return runHandlerOnContext(view, "handleTripleClickOn", pos, inside, event) || view.someProp("handleTripleClick", function (f) {
      return f(view, pos, event);
    }) || defaultTripleClick(view, inside);
  }

  function defaultTripleClick(view, inside) {
    var doc = view.state.doc;

    if (inside == -1) {
      if (doc.inlineContent) {
        updateSelection(view, TextSelection.create(doc, 0, doc.content.size), "pointer");
        return true;
      }

      return false;
    }

    var $pos = doc.resolve(inside);

    for (var i = $pos.depth + 1; i > 0; i--) {
      var node = i > $pos.depth ? $pos.nodeAfter : $pos.node(i);
      var nodePos = $pos.before(i);

      if (node.inlineContent) {
        updateSelection(view, TextSelection.create(doc, nodePos + 1, nodePos + 1 + node.content.size), "pointer");
      } else if (NodeSelection.isSelectable(node)) {
        updateSelection(view, NodeSelection.create(doc, nodePos), "pointer");
      } else {
        continue;
      }

      return true;
    }
  }

  function forceDOMFlush(view) {
    return endComposition(view);
  }

  var selectNodeModifier = result.mac ? "metaKey" : "ctrlKey";

  handlers.mousedown = function (view, event) {
    view.shiftKey = event.shiftKey;
    var flushed = forceDOMFlush(view);
    var now = Date.now(),
        type = "singleClick";

    if (now - view.lastClick.time < 500 && isNear(event, view.lastClick) && !event[selectNodeModifier]) {
      if (view.lastClick.type == "singleClick") {
        type = "doubleClick";
      } else if (view.lastClick.type == "doubleClick") {
        type = "tripleClick";
      }
    }

    view.lastClick = {
      time: now,
      x: event.clientX,
      y: event.clientY,
      type: type
    };
    var pos = view.posAtCoords(eventCoords(event));

    if (!pos) {
      return;
    }

    if (type == "singleClick") {
      view.mouseDown = new MouseDown(view, pos, event, flushed);
    } else if ((type == "doubleClick" ? handleDoubleClick : handleTripleClick)(view, pos.pos, pos.inside, event)) {
      event.preventDefault();
    } else {
      setSelectionOrigin(view, "pointer");
    }
  };

  var MouseDown = function MouseDown(view, pos, event, flushed) {
    var this$1 = this;
    this.view = view;
    this.startDoc = view.state.doc;
    this.pos = pos;
    this.event = event;
    this.flushed = flushed;
    this.selectNode = event[selectNodeModifier];
    this.allowDefault = event.shiftKey;
    var targetNode, targetPos;

    if (pos.inside > -1) {
      targetNode = view.state.doc.nodeAt(pos.inside);
      targetPos = pos.inside;
    } else {
      var $pos = view.state.doc.resolve(pos.pos);
      targetNode = $pos.parent;
      targetPos = $pos.depth ? $pos.before() : 0;
    }

    this.mightDrag = null;
    var target = flushed ? null : event.target;
    var targetDesc = target ? view.docView.nearestDesc(target, true) : null;
    this.target = targetDesc ? targetDesc.dom : null;

    if (targetNode.type.spec.draggable && targetNode.type.spec.selectable !== false || view.state.selection instanceof NodeSelection && targetPos == view.state.selection.from) {
      this.mightDrag = {
        node: targetNode,
        pos: targetPos,
        addAttr: this.target && !this.target.draggable,
        setUneditable: this.target && result.gecko && !this.target.hasAttribute("contentEditable")
      };
    }

    if (this.target && this.mightDrag && (this.mightDrag.addAttr || this.mightDrag.setUneditable)) {
      this.view.domObserver.stop();

      if (this.mightDrag.addAttr) {
        this.target.draggable = true;
      }

      if (this.mightDrag.setUneditable) {
        setTimeout(function () {
          return this$1.target.setAttribute("contentEditable", "false");
        }, 20);
      }

      this.view.domObserver.start();
    }

    view.root.addEventListener("mouseup", this.up = this.up.bind(this));
    view.root.addEventListener("mousemove", this.move = this.move.bind(this));
    setSelectionOrigin(view, "pointer");
  };

  MouseDown.prototype.done = function done() {
    this.view.root.removeEventListener("mouseup", this.up);
    this.view.root.removeEventListener("mousemove", this.move);

    if (this.mightDrag && this.target) {
      this.view.domObserver.stop();

      if (this.mightDrag.addAttr) {
        this.target.draggable = false;
      }

      if (this.mightDrag.setUneditable) {
        this.target.removeAttribute("contentEditable");
      }

      this.view.domObserver.start();
    }

    this.view.mouseDown = null;
  };

  MouseDown.prototype.up = function up(event) {
    this.done();

    if (!this.view.dom.contains(event.target.nodeType == 3 ? event.target.parentNode : event.target)) {
      return;
    }

    var pos = this.pos;

    if (this.view.state.doc != this.startDoc) {
      pos = this.view.posAtCoords(eventCoords(event));
    }

    if (this.allowDefault || !pos) {
      setSelectionOrigin(this.view, "pointer");
    } else if (handleSingleClick(this.view, pos.pos, pos.inside, event, this.selectNode)) {
      event.preventDefault();
    } else if (this.flushed || // Chrome will sometimes treat a node selection as a
    // cursor, but still report that the node is selected
    // when asked through getSelection. You'll then get a
    // situation where clicking at the point where that
    // (hidden) cursor is doesn't change the selection, and
    // thus doesn't get a reaction from ProseMirror. This
    // works around that.
    result.chrome && !(this.view.state.selection instanceof TextSelection) && (pos.pos == this.view.state.selection.from || pos.pos == this.view.state.selection.to)) {
      updateSelection(this.view, Selection.near(this.view.state.doc.resolve(pos.pos)), "pointer");
      event.preventDefault();
    } else {
      setSelectionOrigin(this.view, "pointer");
    }
  };

  MouseDown.prototype.move = function move(event) {
    if (!this.allowDefault && (Math.abs(this.event.x - event.clientX) > 4 || Math.abs(this.event.y - event.clientY) > 4)) {
      this.allowDefault = true;
    }

    setSelectionOrigin(this.view, "pointer");
  };

  handlers.touchdown = function (view) {
    forceDOMFlush(view);
    setSelectionOrigin(view, "pointer");
  };

  handlers.contextmenu = function (view) {
    return forceDOMFlush(view);
  };

  function inOrNearComposition(view, event) {
    if (view.composing) {
      return true;
    } // See https://www.stum.de/2016/06/24/handling-ime-events-in-javascript/.
    // On Japanese input method editors (IMEs), the Enter key is used to confirm character
    // selection. On Safari, when Enter is pressed, compositionend and keydown events are
    // emitted. The keydown event triggers newline insertion, which we don't want.
    // This method returns true if the keydown event should be ignored.
    // We only ignore it once, as pressing Enter a second time *should* insert a newline.
    // Furthermore, the keydown event timestamp must be close to the compositionEndedAt timestamp.
    // This guards against the case where compositionend is triggered without the keyboard
    // (e.g. character confirmation may be done with the mouse), and keydown is triggered
    // afterwards- we wouldn't want to ignore the keydown event in this case.


    if (result.safari && Math.abs(event.timeStamp - view.compositionEndedAt) < 500) {
      view.compositionEndedAt = -2e8;
      return true;
    }

    return false;
  } // Drop active composition after 5 seconds of inactivity on Android


  var timeoutComposition = result.android ? 5000 : -1;

  editHandlers.compositionstart = editHandlers.compositionupdate = function (view) {
    if (!view.composing) {
      view.domObserver.flush();
      var state = view.state;
      var $pos = state.selection.$from;

      if (state.selection.empty && (state.storedMarks || !$pos.textOffset && $pos.parentOffset && $pos.nodeBefore.marks.some(function (m) {
        return m.type.spec.inclusive === false;
      }))) {
        // Need to wrap the cursor in mark nodes different from the ones in the DOM context
        view.markCursor = view.state.storedMarks || $pos.marks();
        endComposition(view, true);
        view.markCursor = null;
      } else {
        endComposition(view); // In firefox, if the cursor is after but outside a marked node,
        // the inserted text won't inherit the marks. So this moves it
        // inside if necessary.

        if (result.gecko && state.selection.empty && $pos.parentOffset && !$pos.textOffset && $pos.nodeBefore.marks.length) {
          var sel = view.root.getSelection();

          for (var node = sel.focusNode, offset = sel.focusOffset; node && node.nodeType == 1 && offset != 0;) {
            var before = offset < 0 ? node.lastChild : node.childNodes[offset - 1];

            if (before.nodeType == 3) {
              sel.collapse(before, before.nodeValue.length);
              break;
            } else {
              node = before;
              offset = -1;
            }
          }
        }
      }

      view.composing = true;
    }

    scheduleComposeEnd(view, timeoutComposition);
  };

  editHandlers.compositionend = function (view, event) {
    if (view.composing) {
      view.composing = false;
      view.compositionEndedAt = event.timeStamp;
      scheduleComposeEnd(view, 20);
    }
  };

  function scheduleComposeEnd(view, delay) {
    clearTimeout(view.composingTimeout);

    if (delay > -1) {
      view.composingTimeout = setTimeout(function () {
        return endComposition(view);
      }, delay);
    }
  }

  function endComposition(view, forceUpdate) {
    view.composing = false;

    while (view.compositionNodes.length > 0) {
      view.compositionNodes.pop().markParentsDirty();
    }

    if (forceUpdate || view.docView.dirty) {
      view.updateState(view.state);
      return true;
    }

    return false;
  }

  function captureCopy(view, dom) {
    // The extra wrapper is somehow necessary on IE/Edge to prevent the
    // content from being mangled when it is put onto the clipboard
    var doc = view.dom.ownerDocument;
    var wrap = doc.body.appendChild(doc.createElement("div"));
    wrap.appendChild(dom);
    wrap.style.cssText = "position: fixed; left: -10000px; top: 10px";
    var sel = getSelection(),
        range = doc.createRange();
    range.selectNodeContents(dom); // Done because IE will fire a selectionchange moving the selection
    // to its start when removeAllRanges is called and the editor still
    // has focus (which will mess up the editor's selection state).

    view.dom.blur();
    sel.removeAllRanges();
    sel.addRange(range);
    setTimeout(function () {
      doc.body.removeChild(wrap);
      view.focus();
    }, 50);
  } // This is very crude, but unfortunately both these browsers _pretend_
  // that they have a clipboard API—all the objects and methods are
  // there, they just don't work, and they are hard to test.


  var brokenClipboardAPI = result.ie && result.ie_version < 15 || result.ios && result.webkit_version < 604;

  handlers.copy = editHandlers.cut = function (view, e) {
    var sel = view.state.selection,
        cut = e.type == "cut";

    if (sel.empty) {
      return;
    } // IE and Edge's clipboard interface is completely broken


    var data = brokenClipboardAPI ? null : e.clipboardData;
    var slice = sel.content();
    var ref = serializeForClipboard(view, slice);
    var dom = ref.dom;
    var text = ref.text;

    if (data) {
      e.preventDefault();
      data.clearData();
      data.setData("text/html", dom.innerHTML);
      data.setData("text/plain", text);
    } else {
      captureCopy(view, dom);
    }

    if (cut) {
      view.dispatch(view.state.tr.deleteSelection().scrollIntoView().setMeta("uiEvent", "cut"));
    }
  };

  function sliceSingleNode(slice) {
    return slice.openStart == 0 && slice.openEnd == 0 && slice.content.childCount == 1 ? slice.content.firstChild : null;
  }

  function capturePaste(view, e) {
    var doc = view.dom.ownerDocument;
    var plainText = view.shiftKey || view.state.selection.$from.parent.type.spec.code;
    var target = doc.body.appendChild(doc.createElement(plainText ? "textarea" : "div"));

    if (!plainText) {
      target.contentEditable = "true";
    }

    target.style.cssText = "position: fixed; left: -10000px; top: 10px";
    target.focus();
    setTimeout(function () {
      view.focus();
      doc.body.removeChild(target);

      if (plainText) {
        doPaste(view, target.value, null, e);
      } else {
        doPaste(view, target.textContent, target.innerHTML, e);
      }
    }, 50);
  }

  function doPaste(view, text, html, e) {
    var slice = parseFromClipboard(view, text, html, view.shiftKey, view.state.selection.$from);

    if (view.someProp("handlePaste", function (f) {
      return f(view, e, slice || Slice.empty);
    }) || !slice) {
      return;
    }

    var singleNode = sliceSingleNode(slice);
    var tr = singleNode ? view.state.tr.replaceSelectionWith(singleNode, view.shiftKey) : view.state.tr.replaceSelection(slice);
    view.dispatch(tr.scrollIntoView().setMeta("paste", true).setMeta("uiEvent", "paste"));
  }

  editHandlers.paste = function (view, e) {
    var data = brokenClipboardAPI ? null : e.clipboardData;
    var html = data && data.getData("text/html"),
        text = data && data.getData("text/plain");

    if (data && (html || text || data.files.length)) {
      doPaste(view, text, html, e);
      e.preventDefault();
    } else {
      capturePaste(view, e);
    }
  };

  var Dragging = function Dragging(slice, move) {
    this.slice = slice;
    this.move = move;
  };

  var dragCopyModifier = result.mac ? "altKey" : "ctrlKey";

  handlers.dragstart = function (view, e) {
    var mouseDown = view.mouseDown;

    if (mouseDown) {
      mouseDown.done();
    }

    if (!e.dataTransfer) {
      return;
    }

    var sel = view.state.selection;
    var pos = sel.empty ? null : view.posAtCoords(eventCoords(e));
    if (pos && pos.pos >= sel.from && pos.pos <= (sel instanceof NodeSelection ? sel.to - 1 : sel.to)) ;else if (mouseDown && mouseDown.mightDrag) {
      view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, mouseDown.mightDrag.pos)));
    } else if (e.target && e.target.nodeType == 1) {
      var desc = view.docView.nearestDesc(e.target, true);

      if (!desc || !desc.node.type.spec.draggable || desc == view.docView) {
        return;
      }

      view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, desc.posBefore)));
    }
    var slice = view.state.selection.content();
    var ref = serializeForClipboard(view, slice);
    var dom = ref.dom;
    var text = ref.text;
    e.dataTransfer.clearData();
    e.dataTransfer.setData(brokenClipboardAPI ? "Text" : "text/html", dom.innerHTML);

    if (!brokenClipboardAPI) {
      e.dataTransfer.setData("text/plain", text);
    }

    view.dragging = new Dragging(slice, !e[dragCopyModifier]);
  };

  handlers.dragend = function (view) {
    window.setTimeout(function () {
      return view.dragging = null;
    }, 50);
  };

  editHandlers.dragover = editHandlers.dragenter = function (_, e) {
    return e.preventDefault();
  };

  editHandlers.drop = function (view, e) {
    var dragging = view.dragging;
    view.dragging = null;

    if (!e.dataTransfer) {
      return;
    }

    var eventPos = view.posAtCoords(eventCoords(e));

    if (!eventPos) {
      return;
    }

    var $mouse = view.state.doc.resolve(eventPos.pos);

    if (!$mouse) {
      return;
    }

    var slice = dragging && dragging.slice || parseFromClipboard(view, e.dataTransfer.getData(brokenClipboardAPI ? "Text" : "text/plain"), brokenClipboardAPI ? null : e.dataTransfer.getData("text/html"), false, $mouse);

    if (!slice) {
      return;
    }

    e.preventDefault();

    if (view.someProp("handleDrop", function (f) {
      return f(view, e, slice, dragging && dragging.move);
    })) {
      return;
    }

    var insertPos = slice ? dropPoint(view.state.doc, $mouse.pos, slice) : $mouse.pos;

    if (insertPos == null) {
      insertPos = $mouse.pos;
    }

    var tr = view.state.tr;

    if (dragging && dragging.move) {
      tr.deleteSelection();
    }

    var pos = tr.mapping.map(insertPos);
    var isNode = slice.openStart == 0 && slice.openEnd == 0 && slice.content.childCount == 1;
    var beforeInsert = tr.doc;

    if (isNode) {
      tr.replaceRangeWith(pos, pos, slice.content.firstChild);
    } else {
      tr.replaceRange(pos, pos, slice);
    }

    if (tr.doc.eq(beforeInsert)) {
      return;
    }

    var $pos = tr.doc.resolve(pos);

    if (isNode && NodeSelection.isSelectable(slice.content.firstChild) && $pos.nodeAfter && $pos.nodeAfter.sameMarkup(slice.content.firstChild)) {
      tr.setSelection(new NodeSelection($pos));
    } else {
      tr.setSelection(selectionBetween(view, $pos, tr.doc.resolve(tr.mapping.map(insertPos))));
    }

    view.focus();
    view.dispatch(tr.setMeta("uiEvent", "drop"));
  };

  handlers.focus = function (view) {
    if (!view.focused) {
      view.domObserver.stop();
      view.dom.classList.add("ProseMirror-focused");
      view.domObserver.start();
      view.focused = true;
    }
  };

  handlers.blur = function (view) {
    if (view.focused) {
      view.domObserver.stop();
      view.dom.classList.remove("ProseMirror-focused");
      view.domObserver.start();
      view.domObserver.currentSelection.set({});
      view.focused = false;
    }
  };

  handlers.beforeinput = function (view, event) {
    // We should probably do more with beforeinput events, but support
    // is so spotty that I'm still waiting to see where they are going.
    // Very specific hack to deal with backspace sometimes failing on
    // Chrome Android when after an uneditable node.
    if (result.chrome && result.android && event.inputType == "deleteContentBackward") {
      var domChangeCount = view.domChangeCount;
      setTimeout(function () {
        if (view.domChangeCount != domChangeCount) {
          return;
        } // Event already had some effect
        // This bug tends to close the virtual keyboard, so we refocus


        view.dom.blur();
        view.focus();

        if (view.someProp("handleKeyDown", function (f) {
          return f(view, keyEvent(8, "Backspace"));
        })) {
          return;
        }

        var ref = view.state.selection;
        var $cursor = ref.$cursor; // Crude approximation of backspace behavior when no command handled it

        if ($cursor && $cursor.pos > 0) {
          view.dispatch(view.state.tr.delete($cursor.pos - 1, $cursor.pos).scrollIntoView());
        }
      }, 50);
    }
  }; // Make sure all handlers get registered


  for (var prop in editHandlers) {
    handlers[prop] = editHandlers[prop];
  }

  function compareObjs(a, b) {
    if (a == b) {
      return true;
    }

    for (var p in a) {
      if (a[p] !== b[p]) {
        return false;
      }
    }

    for (var p$1 in b) {
      if (!(p$1 in a)) {
        return false;
      }
    }

    return true;
  }

  var WidgetType = function WidgetType(toDOM, spec) {
    this.spec = spec || noSpec;
    this.side = this.spec.side || 0;
    this.toDOM = toDOM;
  };

  WidgetType.prototype.map = function map(mapping, span, offset, oldOffset) {
    var ref = mapping.mapResult(span.from + oldOffset, this.side < 0 ? -1 : 1);
    var pos = ref.pos;
    var deleted = ref.deleted;
    return deleted ? null : new Decoration(pos - offset, pos - offset, this);
  };

  WidgetType.prototype.valid = function valid() {
    return true;
  };

  WidgetType.prototype.eq = function eq(other) {
    return this == other || other instanceof WidgetType && (this.spec.key && this.spec.key == other.spec.key || this.toDOM == other.toDOM && compareObjs(this.spec, other.spec));
  };

  var InlineType = function InlineType(attrs, spec) {
    this.spec = spec || noSpec;
    this.attrs = attrs;
  };

  InlineType.prototype.map = function map(mapping, span, offset, oldOffset) {
    var from = mapping.map(span.from + oldOffset, this.spec.inclusiveStart ? -1 : 1) - offset;
    var to = mapping.map(span.to + oldOffset, this.spec.inclusiveEnd ? 1 : -1) - offset;
    return from >= to ? null : new Decoration(from, to, this);
  };

  InlineType.prototype.valid = function valid(_, span) {
    return span.from < span.to;
  };

  InlineType.prototype.eq = function eq(other) {
    return this == other || other instanceof InlineType && compareObjs(this.attrs, other.attrs) && compareObjs(this.spec, other.spec);
  };

  InlineType.is = function is(span) {
    return span.type instanceof InlineType;
  };

  var NodeType$1 = function NodeType(attrs, spec) {
    this.spec = spec || noSpec;
    this.attrs = attrs;
  };

  NodeType$1.prototype.map = function map(mapping, span, offset, oldOffset) {
    var from = mapping.mapResult(span.from + oldOffset, 1);

    if (from.deleted) {
      return null;
    }

    var to = mapping.mapResult(span.to + oldOffset, -1);

    if (to.deleted || to.pos <= from.pos) {
      return null;
    }

    return new Decoration(from.pos - offset, to.pos - offset, this);
  };

  NodeType$1.prototype.valid = function valid(node, span) {
    var ref = node.content.findIndex(span.from);
    var index = ref.index;
    var offset = ref.offset;
    return offset == span.from && offset + node.child(index).nodeSize == span.to;
  };

  NodeType$1.prototype.eq = function eq(other) {
    return this == other || other instanceof NodeType$1 && compareObjs(this.attrs, other.attrs) && compareObjs(this.spec, other.spec);
  }; // ::- Decoration objects can be provided to the view through the
  // [`decorations` prop](#view.EditorProps.decorations). They come in
  // several variants—see the static members of this class for details.


  var Decoration = function Decoration(from, to, type) {
    // :: number
    // The start position of the decoration.
    this.from = from; // :: number
    // The end position. Will be the same as `from` for [widget
    // decorations](#view.Decoration^widget).

    this.to = to;
    this.type = type;
  };

  var prototypeAccessors$1$5 = {
    spec: {
      configurable: true
    }
  };

  Decoration.prototype.copy = function copy(from, to) {
    return new Decoration(from, to, this.type);
  };

  Decoration.prototype.eq = function eq(other) {
    return this.type.eq(other.type) && this.from == other.from && this.to == other.to;
  };

  Decoration.prototype.map = function map(mapping, offset, oldOffset) {
    return this.type.map(mapping, this, offset, oldOffset);
  }; // :: (number, union<(view: EditorView, getPos: () → number) → dom.Node, dom.Node>, ?Object) → Decoration
  // Creates a widget decoration, which is a DOM node that's shown in
  // the document at the given position. It is recommended that you
  // delay rendering the widget by passing a function that will be
  // called when the widget is actually drawn in a view, but you can
  // also directly pass a DOM node. `getPos` can be used to find the
  // widget's current document position.
  //
  // spec::- These options are supported:
  //
  //   side:: ?number
  //   Controls which side of the document position this widget is
  //   associated with. When negative, it is drawn before a cursor
  //   at its position, and content inserted at that position ends
  //   up after the widget. When zero (the default) or positive, the
  //   widget is drawn after the cursor and content inserted there
  //   ends up before the widget.
  //
  //   When there are multiple widgets at a given position, their
  //   `side` values determine the order in which they appear. Those
  //   with lower values appear first. The ordering of widgets with
  //   the same `side` value is unspecified.
  //
  //   When `marks` is null, `side` also determines the marks that
  //   the widget is wrapped in—those of the node before when
  //   negative, those of the node after when positive.
  //
  //   marks:: ?[Mark]
  //   The precise set of marks to draw around the widget.
  //
  //   stopEvent:: ?(event: dom.Event) → bool
  //   Can be used to control which DOM events, when they bubble out
  //   of this widget, the editor view should ignore.
  //
  //   key:: ?string
  //   When comparing decorations of this type (in order to decide
  //   whether it needs to be redrawn), ProseMirror will by default
  //   compare the widget DOM node by identity. If you pass a key,
  //   that key will be compared instead, which can be useful when
  //   you generate decorations on the fly and don't want to store
  //   and reuse DOM nodes. Make sure that any widgets with the same
  //   key are interchangeable—if widgets differ in, for example,
  //   the behavior of some event handler, they should get
  //   different keys.


  Decoration.widget = function widget(pos, toDOM, spec) {
    return new Decoration(pos, pos, new WidgetType(toDOM, spec));
  }; // :: (number, number, DecorationAttrs, ?Object) → Decoration
  // Creates an inline decoration, which adds the given attributes to
  // each inline node between `from` and `to`.
  //
  // spec::- These options are recognized:
  //
  //   inclusiveStart:: ?bool
  //   Determines how the left side of the decoration is
  //   [mapped](#transform.Position_Mapping) when content is
  //   inserted directly at that position. By default, the decoration
  //   won't include the new content, but you can set this to `true`
  //   to make it inclusive.
  //
  //   inclusiveEnd:: ?bool
  //   Determines how the right side of the decoration is mapped.
  //   See
  //   [`inclusiveStart`](#view.Decoration^inline^spec.inclusiveStart).


  Decoration.inline = function inline(from, to, attrs, spec) {
    return new Decoration(from, to, new InlineType(attrs, spec));
  }; // :: (number, number, DecorationAttrs, ?Object) → Decoration
  // Creates a node decoration. `from` and `to` should point precisely
  // before and after a node in the document. That node, and only that
  // node, will receive the given attributes.
  //
  // spec::-
  //
  // Optional information to store with the decoration. It
  // is also used when comparing decorators for equality.


  Decoration.node = function node(from, to, attrs, spec) {
    return new Decoration(from, to, new NodeType$1(attrs, spec));
  }; // :: Object
  // The spec provided when creating this decoration. Can be useful
  // if you've stored extra information in that object.


  prototypeAccessors$1$5.spec.get = function () {
    return this.type.spec;
  };

  Object.defineProperties(Decoration.prototype, prototypeAccessors$1$5); // DecorationAttrs:: interface
  // A set of attributes to add to a decorated node. Most properties
  // simply directly correspond to DOM attributes of the same name,
  // which will be set to the property's value. These are exceptions:
  //
  //   class:: ?string
  //   A CSS class name or a space-separated set of class names to be
  //   _added_ to the classes that the node already had.
  //
  //   style:: ?string
  //   A string of CSS to be _added_ to the node's existing `style` property.
  //
  //   nodeName:: ?string
  //   When non-null, the target node is wrapped in a DOM element of
  //   this type (and the other attributes are applied to this element).

  var none = [],
      noSpec = {}; // ::- A collection of [decorations](#view.Decoration), organized in
  // such a way that the drawing algorithm can efficiently use and
  // compare them. This is a persistent data structure—it is not
  // modified, updates create a new value.

  var DecorationSet = function DecorationSet(local, children) {
    this.local = local && local.length ? local : none;
    this.children = children && children.length ? children : none;
  }; // :: (Node, [Decoration]) → DecorationSet
  // Create a set of decorations, using the structure of the given
  // document.


  DecorationSet.create = function create(doc, decorations) {
    return decorations.length ? buildTree(decorations, doc, 0, noSpec) : empty;
  }; // :: (?number, ?number, ?(spec: Object) → bool) → [Decoration]
  // Find all decorations in this set which touch the given range
  // (including decorations that start or end directly at the
  // boundaries) and match the given predicate on their spec. When
  // `start` and `end` are omitted, all decorations in the set are
  // considered. When `predicate` isn't given, all decorations are
  // assumed to match.


  DecorationSet.prototype.find = function find(start, end, predicate) {
    var result = [];
    this.findInner(start == null ? 0 : start, end == null ? 1e9 : end, result, 0, predicate);
    return result;
  };

  DecorationSet.prototype.findInner = function findInner(start, end, result, offset, predicate) {
    for (var i = 0; i < this.local.length; i++) {
      var span = this.local[i];

      if (span.from <= end && span.to >= start && (!predicate || predicate(span.spec))) {
        result.push(span.copy(span.from + offset, span.to + offset));
      }
    }

    for (var i$1 = 0; i$1 < this.children.length; i$1 += 3) {
      if (this.children[i$1] < end && this.children[i$1 + 1] > start) {
        var childOff = this.children[i$1] + 1;
        this.children[i$1 + 2].findInner(start - childOff, end - childOff, result, offset + childOff, predicate);
      }
    }
  }; // :: (Mapping, Node, ?Object) → DecorationSet
  // Map the set of decorations in response to a change in the
  // document.
  //
  // options::- An optional set of options.
  //
  //   onRemove:: ?(decorationSpec: Object)
  //   When given, this function will be called for each decoration
  //   that gets dropped as a result of the mapping, passing the
  //   spec of that decoration.


  DecorationSet.prototype.map = function map(mapping, doc, options) {
    if (this == empty || mapping.maps.length == 0) {
      return this;
    }

    return this.mapInner(mapping, doc, 0, 0, options || noSpec);
  };

  DecorationSet.prototype.mapInner = function mapInner(mapping, node, offset, oldOffset, options) {
    var newLocal;

    for (var i = 0; i < this.local.length; i++) {
      var mapped = this.local[i].map(mapping, offset, oldOffset);

      if (mapped && mapped.type.valid(node, mapped)) {
        (newLocal || (newLocal = [])).push(mapped);
      } else if (options.onRemove) {
        options.onRemove(this.local[i].spec);
      }
    }

    if (this.children.length) {
      return mapChildren(this.children, newLocal, mapping, node, offset, oldOffset, options);
    } else {
      return newLocal ? new DecorationSet(newLocal.sort(byPos)) : empty;
    }
  }; // :: (Node, [Decoration]) → DecorationSet
  // Add the given array of decorations to the ones in the set,
  // producing a new set. Needs access to the current document to
  // create the appropriate tree structure.


  DecorationSet.prototype.add = function add(doc, decorations) {
    if (!decorations.length) {
      return this;
    }

    if (this == empty) {
      return DecorationSet.create(doc, decorations);
    }

    return this.addInner(doc, decorations, 0);
  };

  DecorationSet.prototype.addInner = function addInner(doc, decorations, offset) {
    var this$1 = this;
    var children,
        childIndex = 0;
    doc.forEach(function (childNode, childOffset) {
      var baseOffset = childOffset + offset,
          found;

      if (!(found = takeSpansForNode(decorations, childNode, baseOffset))) {
        return;
      }

      if (!children) {
        children = this$1.children.slice();
      }

      while (childIndex < children.length && children[childIndex] < childOffset) {
        childIndex += 3;
      }

      if (children[childIndex] == childOffset) {
        children[childIndex + 2] = children[childIndex + 2].addInner(childNode, found, baseOffset + 1);
      } else {
        children.splice(childIndex, 0, childOffset, childOffset + childNode.nodeSize, buildTree(found, childNode, baseOffset + 1, noSpec));
      }

      childIndex += 3;
    });
    var local = moveSpans(childIndex ? withoutNulls(decorations) : decorations, -offset);
    return new DecorationSet(local.length ? this.local.concat(local).sort(byPos) : this.local, children || this.children);
  }; // :: ([Decoration]) → DecorationSet
  // Create a new set that contains the decorations in this set, minus
  // the ones in the given array.


  DecorationSet.prototype.remove = function remove(decorations) {
    if (decorations.length == 0 || this == empty) {
      return this;
    }

    return this.removeInner(decorations, 0);
  };

  DecorationSet.prototype.removeInner = function removeInner(decorations, offset) {
    var children = this.children,
        local = this.local;

    for (var i = 0; i < children.length; i += 3) {
      var found = void 0,
          from = children[i] + offset,
          to = children[i + 1] + offset;

      for (var j = 0, span = void 0; j < decorations.length; j++) {
        if (span = decorations[j]) {
          if (span.from > from && span.to < to) {
            decorations[j] = null;
            (found || (found = [])).push(span);
          }
        }
      }

      if (!found) {
        continue;
      }

      if (children == this.children) {
        children = this.children.slice();
      }

      var removed = children[i + 2].removeInner(found, from + 1);

      if (removed != empty) {
        children[i + 2] = removed;
      } else {
        children.splice(i, 3);
        i -= 3;
      }
    }

    if (local.length) {
      for (var i$1 = 0, span$1 = void 0; i$1 < decorations.length; i$1++) {
        if (span$1 = decorations[i$1]) {
          for (var j$1 = 0; j$1 < local.length; j$1++) {
            if (local[j$1].type.eq(span$1.type)) {
              if (local == this.local) {
                local = this.local.slice();
              }

              local.splice(j$1--, 1);
            }
          }
        }
      }
    }

    if (children == this.children && local == this.local) {
      return this;
    }

    return local.length || children.length ? new DecorationSet(local, children) : empty;
  };

  DecorationSet.prototype.forChild = function forChild(offset, node) {
    if (this == empty) {
      return this;
    }

    if (node.isLeaf) {
      return DecorationSet.empty;
    }

    var child, local;

    for (var i = 0; i < this.children.length; i += 3) {
      if (this.children[i] >= offset) {
        if (this.children[i] == offset) {
          child = this.children[i + 2];
        }

        break;
      }
    }

    var start = offset + 1,
        end = start + node.content.size;

    for (var i$1 = 0; i$1 < this.local.length; i$1++) {
      var dec = this.local[i$1];

      if (dec.from < end && dec.to > start && dec.type instanceof InlineType) {
        var from = Math.max(start, dec.from) - start,
            to = Math.min(end, dec.to) - start;

        if (from < to) {
          (local || (local = [])).push(dec.copy(from, to));
        }
      }
    }

    if (local) {
      var localSet = new DecorationSet(local.sort(byPos));
      return child ? new DecorationGroup([localSet, child]) : localSet;
    }

    return child || empty;
  };

  DecorationSet.prototype.eq = function eq(other) {
    if (this == other) {
      return true;
    }

    if (!(other instanceof DecorationSet) || this.local.length != other.local.length || this.children.length != other.children.length) {
      return false;
    }

    for (var i = 0; i < this.local.length; i++) {
      if (!this.local[i].eq(other.local[i])) {
        return false;
      }
    }

    for (var i$1 = 0; i$1 < this.children.length; i$1 += 3) {
      if (this.children[i$1] != other.children[i$1] || this.children[i$1 + 1] != other.children[i$1 + 1] || !this.children[i$1 + 2].eq(other.children[i$1 + 2])) {
        return false;
      }
    }

    return true;
  };

  DecorationSet.prototype.locals = function locals(node) {
    return removeOverlap(this.localsInner(node));
  };

  DecorationSet.prototype.localsInner = function localsInner(node) {
    if (this == empty) {
      return none;
    }

    if (node.inlineContent || !this.local.some(InlineType.is)) {
      return this.local;
    }

    var result = [];

    for (var i = 0; i < this.local.length; i++) {
      if (!(this.local[i].type instanceof InlineType)) {
        result.push(this.local[i]);
      }
    }

    return result;
  };

  var empty = new DecorationSet(); // :: DecorationSet
  // The empty set of decorations.

  DecorationSet.empty = empty;
  DecorationSet.removeOverlap = removeOverlap; // :- An abstraction that allows the code dealing with decorations to
  // treat multiple DecorationSet objects as if it were a single object
  // with (a subset of) the same interface.

  var DecorationGroup = function DecorationGroup(members) {
    this.members = members;
  };

  DecorationGroup.prototype.forChild = function forChild(offset, child) {
    if (child.isLeaf) {
      return DecorationSet.empty;
    }

    var found = [];

    for (var i = 0; i < this.members.length; i++) {
      var result = this.members[i].forChild(offset, child);

      if (result == empty) {
        continue;
      }

      if (result instanceof DecorationGroup) {
        found = found.concat(result.members);
      } else {
        found.push(result);
      }
    }

    return DecorationGroup.from(found);
  };

  DecorationGroup.prototype.eq = function eq(other) {
    if (!(other instanceof DecorationGroup) || other.members.length != this.members.length) {
      return false;
    }

    for (var i = 0; i < this.members.length; i++) {
      if (!this.members[i].eq(other.members[i])) {
        return false;
      }
    }

    return true;
  };

  DecorationGroup.prototype.locals = function locals(node) {
    var result,
        sorted = true;

    for (var i = 0; i < this.members.length; i++) {
      var locals = this.members[i].localsInner(node);

      if (!locals.length) {
        continue;
      }

      if (!result) {
        result = locals;
      } else {
        if (sorted) {
          result = result.slice();
          sorted = false;
        }

        for (var j = 0; j < locals.length; j++) {
          result.push(locals[j]);
        }
      }
    }

    return result ? removeOverlap(sorted ? result : result.sort(byPos)) : none;
  }; // : ([DecorationSet]) → union<DecorationSet, DecorationGroup>
  // Create a group for the given array of decoration sets, or return
  // a single set when possible.


  DecorationGroup.from = function from(members) {
    switch (members.length) {
      case 0:
        return empty;

      case 1:
        return members[0];

      default:
        return new DecorationGroup(members);
    }
  };

  function mapChildren(oldChildren, newLocal, mapping, node, offset, oldOffset, options) {
    var children = oldChildren.slice(); // Mark the children that are directly touched by changes, and
    // move those that are after the changes.

    var shift = function (oldStart, oldEnd, newStart, newEnd) {
      for (var i = 0; i < children.length; i += 3) {
        var end = children[i + 1],
            dSize = void 0;

        if (end == -1 || oldStart > end + oldOffset) {
          continue;
        }

        if (oldEnd >= children[i] + oldOffset) {
          children[i + 1] = -1;
        } else if (dSize = newEnd - newStart - (oldEnd - oldStart) + (oldOffset - offset)) {
          children[i] += dSize;
          children[i + 1] += dSize;
        }
      }
    };

    for (var i = 0; i < mapping.maps.length; i++) {
      mapping.maps[i].forEach(shift);
    } // Find the child nodes that still correspond to a single node,
    // recursively call mapInner on them and update their positions.


    var mustRebuild = false;

    for (var i$1 = 0; i$1 < children.length; i$1 += 3) {
      if (children[i$1 + 1] == -1) {
        // Touched nodes
        var from = mapping.map(children[i$1] + oldOffset),
            fromLocal = from - offset;

        if (fromLocal < 0 || fromLocal >= node.content.size) {
          mustRebuild = true;
          continue;
        } // Must read oldChildren because children was tagged with -1


        var to = mapping.map(oldChildren[i$1 + 1] + oldOffset, -1),
            toLocal = to - offset;
        var ref = node.content.findIndex(fromLocal);
        var index = ref.index;
        var childOffset = ref.offset;
        var childNode = node.maybeChild(index);

        if (childNode && childOffset == fromLocal && childOffset + childNode.nodeSize == toLocal) {
          var mapped = children[i$1 + 2].mapInner(mapping, childNode, from + 1, children[i$1] + oldOffset + 1, options);

          if (mapped != empty) {
            children[i$1] = fromLocal;
            children[i$1 + 1] = toLocal;
            children[i$1 + 2] = mapped;
          } else {
            children[i$1 + 1] = -2;
            mustRebuild = true;
          }
        } else {
          mustRebuild = true;
        }
      }
    } // Remaining children must be collected and rebuilt into the appropriate structure


    if (mustRebuild) {
      var decorations = mapAndGatherRemainingDecorations(children, oldChildren, newLocal || [], mapping, offset, oldOffset, options);
      var built = buildTree(decorations, node, 0, options);
      newLocal = built.local;

      for (var i$2 = 0; i$2 < children.length; i$2 += 3) {
        if (children[i$2 + 1] < 0) {
          children.splice(i$2, 3);
          i$2 -= 3;
        }
      }

      for (var i$3 = 0, j = 0; i$3 < built.children.length; i$3 += 3) {
        var from$1 = built.children[i$3];

        while (j < children.length && children[j] < from$1) {
          j += 3;
        }

        children.splice(j, 0, built.children[i$3], built.children[i$3 + 1], built.children[i$3 + 2]);
      }
    }

    return new DecorationSet(newLocal && newLocal.sort(byPos), children);
  }

  function moveSpans(spans, offset) {
    if (!offset || !spans.length) {
      return spans;
    }

    var result = [];

    for (var i = 0; i < spans.length; i++) {
      var span = spans[i];
      result.push(new Decoration(span.from + offset, span.to + offset, span.type));
    }

    return result;
  }

  function mapAndGatherRemainingDecorations(children, oldChildren, decorations, mapping, offset, oldOffset, options) {
    // Gather all decorations from the remaining marked children
    function gather(set, oldOffset) {
      for (var i = 0; i < set.local.length; i++) {
        var mapped = set.local[i].map(mapping, offset, oldOffset);

        if (mapped) {
          decorations.push(mapped);
        } else if (options.onRemove) {
          options.onRemove(set.local[i].spec);
        }
      }

      for (var i$1 = 0; i$1 < set.children.length; i$1 += 3) {
        gather(set.children[i$1 + 2], set.children[i$1] + oldOffset + 1);
      }
    }

    for (var i = 0; i < children.length; i += 3) {
      if (children[i + 1] == -1) {
        gather(children[i + 2], oldChildren[i] + oldOffset + 1);
      }
    }

    return decorations;
  }

  function takeSpansForNode(spans, node, offset) {
    if (node.isLeaf) {
      return null;
    }

    var end = offset + node.nodeSize,
        found = null;

    for (var i = 0, span = void 0; i < spans.length; i++) {
      if ((span = spans[i]) && span.from > offset && span.to < end) {
        (found || (found = [])).push(span);
        spans[i] = null;
      }
    }

    return found;
  }

  function withoutNulls(array) {
    var result = [];

    for (var i = 0; i < array.length; i++) {
      if (array[i] != null) {
        result.push(array[i]);
      }
    }

    return result;
  } // : ([Decoration], Node, number) → DecorationSet
  // Build up a tree that corresponds to a set of decorations. `offset`
  // is a base offset that should be subtractet from the `from` and `to`
  // positions in the spans (so that we don't have to allocate new spans
  // for recursive calls).


  function buildTree(spans, node, offset, options) {
    var children = [],
        hasNulls = false;
    node.forEach(function (childNode, localStart) {
      var found = takeSpansForNode(spans, childNode, localStart + offset);

      if (found) {
        hasNulls = true;
        var subtree = buildTree(found, childNode, offset + localStart + 1, options);

        if (subtree != empty) {
          children.push(localStart, localStart + childNode.nodeSize, subtree);
        }
      }
    });
    var locals = moveSpans(hasNulls ? withoutNulls(spans) : spans, -offset).sort(byPos);

    for (var i = 0; i < locals.length; i++) {
      if (!locals[i].type.valid(node, locals[i])) {
        if (options.onRemove) {
          options.onRemove(locals[i].spec);
        }

        locals.splice(i--, 1);
      }
    }

    return locals.length || children.length ? new DecorationSet(locals, children) : empty;
  } // : (Decoration, Decoration) → number
  // Used to sort decorations so that ones with a low start position
  // come first, and within a set with the same start position, those
  // with an smaller end position come first.


  function byPos(a, b) {
    return a.from - b.from || a.to - b.to;
  } // : ([Decoration]) → [Decoration]
  // Scan a sorted array of decorations for partially overlapping spans,
  // and split those so that only fully overlapping spans are left (to
  // make subsequent rendering easier). Will return the input array if
  // no partially overlapping spans are found (the common case).


  function removeOverlap(spans) {
    var working = spans;

    for (var i = 0; i < working.length - 1; i++) {
      var span = working[i];

      if (span.from != span.to) {
        for (var j = i + 1; j < working.length; j++) {
          var next = working[j];

          if (next.from == span.from) {
            if (next.to != span.to) {
              if (working == spans) {
                working = spans.slice();
              } // Followed by a partially overlapping larger span. Split that
              // span.


              working[j] = next.copy(next.from, span.to);
              insertAhead(working, j + 1, next.copy(span.to, next.to));
            }

            continue;
          } else {
            if (next.from < span.to) {
              if (working == spans) {
                working = spans.slice();
              } // The end of this one overlaps with a subsequent span. Split
              // this one.


              working[i] = span.copy(span.from, next.from);
              insertAhead(working, j, span.copy(next.from, span.to));
            }

            break;
          }
        }
      }
    }

    return working;
  }

  function insertAhead(array, i, deco) {
    while (i < array.length && byPos(deco, array[i]) > 0) {
      i++;
    }

    array.splice(i, 0, deco);
  } // : (EditorView) → union<DecorationSet, DecorationGroup>
  // Get the decorations associated with the current props of a view.


  function viewDecorations(view) {
    var found = [];
    view.someProp("decorations", function (f) {
      var result = f(view.state);

      if (result && result != empty) {
        found.push(result);
      }
    });

    if (view.cursorWrapper) {
      found.push(DecorationSet.create(view.state.doc, [view.cursorWrapper.deco]));
    }

    return DecorationGroup.from(found);
  } // ::- An editor view manages the DOM structure that represents an
  // editable document. Its state and behavior are determined by its
  // [props](#view.DirectEditorProps).


  var EditorView = function EditorView(place, props) {
    this._props = props; // :: EditorState
    // The view's current [state](#state.EditorState).

    this.state = props.state;
    this.dispatch = this.dispatch.bind(this);
    this._root = null;
    this.focused = false; // :: dom.Element
    // An editable DOM node containing the document. (You probably
    // should not directly interfere with its content.)

    this.dom = place && place.mount || document.createElement("div");

    if (place) {
      if (place.appendChild) {
        place.appendChild(this.dom);
      } else if (place.apply) {
        place(this.dom);
      } else if (place.mount) {
        this.mounted = true;
      }
    } // :: bool
    // Indicates whether the editor is currently [editable](#view.EditorProps.editable).


    this.editable = getEditable(this);
    this.markCursor = null;
    this.cursorWrapper = null;
    updateCursorWrapper(this);
    this.nodeViews = buildNodeViews(this);
    this.docView = docViewDesc(this.state.doc, computeDocDeco(this), viewDecorations(this), this.dom, this);
    this.lastSelectedViewDesc = null; // :: ?{slice: Slice, move: bool}
    // When editor content is being dragged, this object contains
    // information about the dragged slice and whether it is being
    // copied or moved. At any other time, it is null.

    this.dragging = null;
    initInput(this);
    this.pluginViews = [];
    this.updatePluginViews();
  };

  var prototypeAccessors$2$1 = {
    props: {
      configurable: true
    },
    root: {
      configurable: true
    }
  }; // composing:: boolean
  // Holds `true` when a
  // [composition](https://developer.mozilla.org/en-US/docs/Mozilla/IME_handling_guide)
  // is active.
  // :: DirectEditorProps
  // The view's current [props](#view.EditorProps).

  prototypeAccessors$2$1.props.get = function () {
    if (this._props.state != this.state) {
      var prev = this._props;
      this._props = {};

      for (var name in prev) {
        this._props[name] = prev[name];
      }

      this._props.state = this.state;
    }

    return this._props;
  }; // :: (DirectEditorProps)
  // Update the view's props. Will immediately cause an update to
  // the DOM.


  EditorView.prototype.update = function update(props) {
    if (props.handleDOMEvents != this._props.handleDOMEvents) {
      ensureListeners(this);
    }

    this._props = props;
    this.updateStateInner(props.state, true);
  }; // :: (DirectEditorProps)
  // Update the view by updating existing props object with the object
  // given as argument. Equivalent to `view.update(Object.assign({},
  // view.props, props))`.


  EditorView.prototype.setProps = function setProps(props) {
    var updated = {};

    for (var name in this._props) {
      updated[name] = this._props[name];
    }

    updated.state = this.state;

    for (var name$1 in props) {
      updated[name$1] = props[name$1];
    }

    this.update(updated);
  }; // :: (EditorState)
  // Update the editor's `state` prop, without touching any of the
  // other props.


  EditorView.prototype.updateState = function updateState(state) {
    this.updateStateInner(state, this.state.plugins != state.plugins);
  };

  EditorView.prototype.updateStateInner = function updateStateInner(state, reconfigured) {
    var this$1 = this;
    var prev = this.state,
        redraw = false;
    this.state = state;

    if (reconfigured) {
      var nodeViews = buildNodeViews(this);

      if (changedNodeViews(nodeViews, this.nodeViews)) {
        this.nodeViews = nodeViews;
        redraw = true;
      }

      ensureListeners(this);
    }

    this.editable = getEditable(this);
    updateCursorWrapper(this);
    var innerDeco = viewDecorations(this),
        outerDeco = computeDocDeco(this);
    var scroll = reconfigured ? "reset" : state.scrollToSelection > prev.scrollToSelection ? "to selection" : "preserve";
    var updateDoc = redraw || !this.docView.matchesNode(state.doc, outerDeco, innerDeco);
    var updateSel = updateDoc || !state.selection.eq(prev.selection);
    var oldScrollPos = scroll == "preserve" && updateSel && this.dom.style.overflowAnchor == null && storeScrollPos(this);

    if (updateSel) {
      this.domObserver.stop(); // Work around an issue in Chrome, IE, and Edge where changing
      // the DOM around an active selection puts it into a broken
      // state where the thing the user sees differs from the
      // selection reported by the Selection object (#710, #973,
      // #1011, #1013).

      var forceSelUpdate = updateDoc && (result.ie || result.chrome) && !prev.selection.empty && !state.selection.empty && selectionContextChanged(prev.selection, state.selection);

      if (updateDoc) {
        if (redraw || !this.docView.update(state.doc, outerDeco, innerDeco, this)) {
          this.docView.destroy();
          this.docView = docViewDesc(state.doc, outerDeco, innerDeco, this.dom, this);
        }
      } // Work around for an issue where an update arriving right between
      // a DOM selection change and the "selectionchange" event for it
      // can cause a spurious DOM selection update, disrupting mouse
      // drag selection.


      if (forceSelUpdate || !(this.mouseDown && this.domObserver.currentSelection.eq(this.root.getSelection()) && anchorInRightPlace(this))) {
        selectionToDOM(this, forceSelUpdate);
      } else {
        syncNodeSelection(this, state.selection);
        this.domObserver.setCurSelection();
      }

      this.domObserver.start();
    }

    this.updatePluginViews(prev);

    if (scroll == "reset") {
      this.dom.scrollTop = 0;
    } else if (scroll == "to selection") {
      var startDOM = this.root.getSelection().focusNode;
      if (this.someProp("handleScrollToSelection", function (f) {
        return f(this$1);
      })) ; // Handled
      else if (state.selection instanceof NodeSelection) {
          scrollRectIntoView(this, this.docView.domAfterPos(state.selection.from).getBoundingClientRect(), startDOM);
        } else {
          scrollRectIntoView(this, this.coordsAtPos(state.selection.head), startDOM);
        }
    } else if (oldScrollPos) {
      resetScrollPos(oldScrollPos);
    }
  };

  EditorView.prototype.destroyPluginViews = function destroyPluginViews() {
    var view;

    while (view = this.pluginViews.pop()) {
      if (view.destroy) {
        view.destroy();
      }
    }
  };

  EditorView.prototype.updatePluginViews = function updatePluginViews(prevState) {
    if (!prevState || prevState.plugins != this.state.plugins) {
      this.destroyPluginViews();

      for (var i = 0; i < this.state.plugins.length; i++) {
        var plugin = this.state.plugins[i];

        if (plugin.spec.view) {
          this.pluginViews.push(plugin.spec.view(this));
        }
      }
    } else {
      for (var i$1 = 0; i$1 < this.pluginViews.length; i$1++) {
        var pluginView = this.pluginViews[i$1];

        if (pluginView.update) {
          pluginView.update(this, prevState);
        }
      }
    }
  }; // :: (string, ?(prop: *) → *) → *
  // Goes over the values of a prop, first those provided directly,
  // then those from plugins (in order), and calls `f` every time a
  // non-undefined value is found. When `f` returns a truthy value,
  // that is immediately returned. When `f` isn't provided, it is
  // treated as the identity function (the prop value is returned
  // directly).


  EditorView.prototype.someProp = function someProp(propName, f) {
    var prop = this._props && this._props[propName],
        value;

    if (prop != null && (value = f ? f(prop) : prop)) {
      return value;
    }

    var plugins = this.state.plugins;

    if (plugins) {
      for (var i = 0; i < plugins.length; i++) {
        var prop$1 = plugins[i].props[propName];

        if (prop$1 != null && (value = f ? f(prop$1) : prop$1)) {
          return value;
        }
      }
    }
  }; // :: () → bool
  // Query whether the view has focus.


  EditorView.prototype.hasFocus = function hasFocus() {
    return this.root.activeElement == this.dom;
  }; // :: ()
  // Focus the editor.


  EditorView.prototype.focus = function focus() {
    this.domObserver.stop();

    if (this.editable) {
      focusPreventScroll(this.dom);
    }

    selectionToDOM(this);
    this.domObserver.start();
  }; // :: union<dom.Document, dom.DocumentFragment>
  // Get the document root in which the editor exists. This will
  // usually be the top-level `document`, but might be a [shadow
  // DOM](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Shadow_DOM)
  // root if the editor is inside one.


  prototypeAccessors$2$1.root.get = function () {
    var cached = this._root;

    if (cached == null) {
      for (var search = this.dom.parentNode; search; search = search.parentNode) {
        if (search.nodeType == 9 || search.nodeType == 11 && search.host) {
          if (!search.getSelection) {
            Object.getPrototypeOf(search).getSelection = function () {
              return document.getSelection();
            };
          }

          return this._root = search;
        }
      }
    }

    return cached || document;
  }; // :: ({left: number, top: number}) → ?{pos: number, inside: number}
  // Given a pair of viewport coordinates, return the document
  // position that corresponds to them. May return null if the given
  // coordinates aren't inside of the editor. When an object is
  // returned, its `pos` property is the position nearest to the
  // coordinates, and its `inside` property holds the position of the
  // inner node that the position falls inside of, or -1 if it is at
  // the top level, not in any node.


  EditorView.prototype.posAtCoords = function posAtCoords$1(coords) {
    return posAtCoords(this, coords);
  }; // :: (number) → {left: number, right: number, top: number, bottom: number}
  // Returns the viewport rectangle at a given document position. `left`
  // and `right` will be the same number, as this returns a flat
  // cursor-ish rectangle.


  EditorView.prototype.coordsAtPos = function coordsAtPos$1(pos) {
    return coordsAtPos(this, pos);
  }; // :: (number) → {node: dom.Node, offset: number}
  // Find the DOM position that corresponds to the given document
  // position. Note that you should **not** mutate the editor's
  // internal DOM, only inspect it (and even that is usually not
  // necessary).


  EditorView.prototype.domAtPos = function domAtPos(pos) {
    return this.docView.domFromPos(pos);
  }; // :: (number) → ?dom.Node
  // Find the DOM node that represents the document node after the
  // given position. May return `null` when the position doesn't point
  // in front of a node or if the node is inside an opaque node view.
  //
  // This is intended to be able to call things like
  // `getBoundingClientRect` on that DOM node. Do **not** mutate the
  // editor DOM directly, or add styling this way, since that will be
  // immediately overriden by the editor as it redraws the node.


  EditorView.prototype.nodeDOM = function nodeDOM(pos) {
    var desc = this.docView.descAt(pos);
    return desc ? desc.nodeDOM : null;
  }; // :: (dom.Node, number, ?number) → number
  // Find the document position that corresponds to a given DOM
  // position. (Whenever possible, it is preferable to inspect the
  // document structure directly, rather than poking around in the
  // DOM, but sometimes—for example when interpreting an event
  // target—you don't have a choice.)
  //
  // The `bias` parameter can be used to influence which side of a DOM
  // node to use when the position is inside a leaf node.


  EditorView.prototype.posAtDOM = function posAtDOM(node, offset, bias) {
    if (bias === void 0) bias = -1;
    var pos = this.docView.posFromDOM(node, offset, bias);

    if (pos == null) {
      throw new RangeError("DOM position not inside the editor");
    }

    return pos;
  }; // :: (union<"up", "down", "left", "right", "forward", "backward">, ?EditorState) → bool
  // Find out whether the selection is at the end of a textblock when
  // moving in a given direction. When, for example, given `"left"`,
  // it will return true if moving left from the current cursor
  // position would leave that position's parent textblock. Will apply
  // to the view's current state by default, but it is possible to
  // pass a different state.


  EditorView.prototype.endOfTextblock = function endOfTextblock$1(dir, state) {
    return endOfTextblock(this, state || this.state, dir);
  }; // :: ()
  // Removes the editor from the DOM and destroys all [node
  // views](#view.NodeView).


  EditorView.prototype.destroy = function destroy() {
    if (!this.docView) {
      return;
    }

    destroyInput(this);
    this.destroyPluginViews();

    if (this.mounted) {
      this.docView.update(this.state.doc, [], viewDecorations(this), this);
      this.dom.textContent = "";
    } else if (this.dom.parentNode) {
      this.dom.parentNode.removeChild(this.dom);
    }

    this.docView.destroy();
    this.docView = null;
  }; // Used for testing.


  EditorView.prototype.dispatchEvent = function dispatchEvent$1(event) {
    return dispatchEvent(this, event);
  }; // :: (Transaction)
  // Dispatch a transaction. Will call
  // [`dispatchTransaction`](#view.DirectEditorProps.dispatchTransaction)
  // when given, and otherwise defaults to applying the transaction to
  // the current state and calling
  // [`updateState`](#view.EditorView.updateState) with the result.
  // This method is bound to the view instance, so that it can be
  // easily passed around.


  EditorView.prototype.dispatch = function dispatch(tr) {
    var dispatchTransaction = this._props.dispatchTransaction;

    if (dispatchTransaction) {
      dispatchTransaction.call(this, tr);
    } else {
      this.updateState(this.state.apply(tr));
    }
  };

  Object.defineProperties(EditorView.prototype, prototypeAccessors$2$1);

  function computeDocDeco(view) {
    var attrs = Object.create(null);
    attrs.class = "ProseMirror";
    attrs.contenteditable = String(view.editable);
    view.someProp("attributes", function (value) {
      if (typeof value == "function") {
        value = value(view.state);
      }

      if (value) {
        for (var attr in value) {
          if (attr == "class") {
            attrs.class += " " + value[attr];
          } else if (!attrs[attr] && attr != "contenteditable" && attr != "nodeName") {
            attrs[attr] = String(value[attr]);
          }
        }
      }
    });
    return [Decoration.node(0, view.state.doc.content.size, attrs)];
  }

  function updateCursorWrapper(view) {
    var ref = view.state.selection;
    var $head = ref.$head;
    var $anchor = ref.$anchor;
    var visible = ref.visible;

    if (view.markCursor) {
      var dom = document.createElement("img");
      dom.setAttribute("mark-placeholder", "true");
      view.cursorWrapper = {
        dom: dom,
        deco: Decoration.widget($head.pos, dom, {
          raw: true,
          marks: view.markCursor
        })
      };
    } else if (visible || $head.pos != $anchor.pos) {
      view.cursorWrapper = null;
    } else {
      var dom$1;

      if (!view.cursorWrapper || view.cursorWrapper.dom.childNodes.length) {
        dom$1 = document.createElement("div");
        dom$1.style.position = "absolute";
        dom$1.style.left = "-100000px";
      } else if (view.cursorWrapper.deco.pos != $head.pos) {
        dom$1 = view.cursorWrapper.dom;
      }

      if (dom$1) {
        view.cursorWrapper = {
          dom: dom$1,
          deco: Decoration.widget($head.pos, dom$1, {
            raw: true
          })
        };
      }
    }
  }

  function getEditable(view) {
    return !view.someProp("editable", function (value) {
      return value(view.state) === false;
    });
  }

  function selectionContextChanged(sel1, sel2) {
    var depth = Math.min(sel1.$anchor.sharedDepth(sel1.head), sel2.$anchor.sharedDepth(sel2.head));
    return sel1.$anchor.node(depth) != sel2.$anchor.node(depth);
  }

  function buildNodeViews(view) {
    var result = {};
    view.someProp("nodeViews", function (obj) {
      for (var prop in obj) {
        if (!Object.prototype.hasOwnProperty.call(result, prop)) {
          result[prop] = obj[prop];
        }
      }
    });
    return result;
  }

  function changedNodeViews(a, b) {
    var nA = 0,
        nB = 0;

    for (var prop in a) {
      if (a[prop] != b[prop]) {
        return true;
      }

      nA++;
    }

    for (var _ in b) {
      nB++;
    }

    return nA != nB;
  } // EditorProps:: interface

  var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

  function createCommonjsModule(fn, module) {
  	return module = { exports: {} }, fn(module, module.exports), module.exports;
  }

  function getCjsExportFromNamespace (n) {
  	return n && n['default'] || n;
  }

  var Aacute = "Á";
  var aacute = "á";
  var Abreve = "Ă";
  var abreve = "ă";
  var ac = "∾";
  var acd = "∿";
  var acE = "∾̳";
  var Acirc = "Â";
  var acirc = "â";
  var acute = "´";
  var Acy = "А";
  var acy = "а";
  var AElig = "Æ";
  var aelig = "æ";
  var af = "⁡";
  var Afr = "𝔄";
  var afr = "𝔞";
  var Agrave = "À";
  var agrave = "à";
  var alefsym = "ℵ";
  var aleph = "ℵ";
  var Alpha = "Α";
  var alpha = "α";
  var Amacr = "Ā";
  var amacr = "ā";
  var amalg = "⨿";
  var amp = "&";
  var AMP = "&";
  var andand = "⩕";
  var And = "⩓";
  var and = "∧";
  var andd = "⩜";
  var andslope = "⩘";
  var andv = "⩚";
  var ang = "∠";
  var ange = "⦤";
  var angle = "∠";
  var angmsdaa = "⦨";
  var angmsdab = "⦩";
  var angmsdac = "⦪";
  var angmsdad = "⦫";
  var angmsdae = "⦬";
  var angmsdaf = "⦭";
  var angmsdag = "⦮";
  var angmsdah = "⦯";
  var angmsd = "∡";
  var angrt = "∟";
  var angrtvb = "⊾";
  var angrtvbd = "⦝";
  var angsph = "∢";
  var angst = "Å";
  var angzarr = "⍼";
  var Aogon = "Ą";
  var aogon = "ą";
  var Aopf = "𝔸";
  var aopf = "𝕒";
  var apacir = "⩯";
  var ap = "≈";
  var apE = "⩰";
  var ape = "≊";
  var apid = "≋";
  var apos = "'";
  var ApplyFunction = "⁡";
  var approx = "≈";
  var approxeq = "≊";
  var Aring = "Å";
  var aring = "å";
  var Ascr = "𝒜";
  var ascr = "𝒶";
  var Assign = "≔";
  var ast = "*";
  var asymp = "≈";
  var asympeq = "≍";
  var Atilde = "Ã";
  var atilde = "ã";
  var Auml = "Ä";
  var auml = "ä";
  var awconint = "∳";
  var awint = "⨑";
  var backcong = "≌";
  var backepsilon = "϶";
  var backprime = "‵";
  var backsim = "∽";
  var backsimeq = "⋍";
  var Backslash = "∖";
  var Barv = "⫧";
  var barvee = "⊽";
  var barwed = "⌅";
  var Barwed = "⌆";
  var barwedge = "⌅";
  var bbrk = "⎵";
  var bbrktbrk = "⎶";
  var bcong = "≌";
  var Bcy = "Б";
  var bcy = "б";
  var bdquo = "„";
  var becaus = "∵";
  var because = "∵";
  var Because = "∵";
  var bemptyv = "⦰";
  var bepsi = "϶";
  var bernou = "ℬ";
  var Bernoullis = "ℬ";
  var Beta = "Β";
  var beta = "β";
  var beth = "ℶ";
  var between = "≬";
  var Bfr = "𝔅";
  var bfr = "𝔟";
  var bigcap = "⋂";
  var bigcirc = "◯";
  var bigcup = "⋃";
  var bigodot = "⨀";
  var bigoplus = "⨁";
  var bigotimes = "⨂";
  var bigsqcup = "⨆";
  var bigstar = "★";
  var bigtriangledown = "▽";
  var bigtriangleup = "△";
  var biguplus = "⨄";
  var bigvee = "⋁";
  var bigwedge = "⋀";
  var bkarow = "⤍";
  var blacklozenge = "⧫";
  var blacksquare = "▪";
  var blacktriangle = "▴";
  var blacktriangledown = "▾";
  var blacktriangleleft = "◂";
  var blacktriangleright = "▸";
  var blank = "␣";
  var blk12 = "▒";
  var blk14 = "░";
  var blk34 = "▓";
  var block = "█";
  var bne = "=⃥";
  var bnequiv = "≡⃥";
  var bNot = "⫭";
  var bnot = "⌐";
  var Bopf = "𝔹";
  var bopf = "𝕓";
  var bot = "⊥";
  var bottom = "⊥";
  var bowtie = "⋈";
  var boxbox = "⧉";
  var boxdl = "┐";
  var boxdL = "╕";
  var boxDl = "╖";
  var boxDL = "╗";
  var boxdr = "┌";
  var boxdR = "╒";
  var boxDr = "╓";
  var boxDR = "╔";
  var boxh = "─";
  var boxH = "═";
  var boxhd = "┬";
  var boxHd = "╤";
  var boxhD = "╥";
  var boxHD = "╦";
  var boxhu = "┴";
  var boxHu = "╧";
  var boxhU = "╨";
  var boxHU = "╩";
  var boxminus = "⊟";
  var boxplus = "⊞";
  var boxtimes = "⊠";
  var boxul = "┘";
  var boxuL = "╛";
  var boxUl = "╜";
  var boxUL = "╝";
  var boxur = "└";
  var boxuR = "╘";
  var boxUr = "╙";
  var boxUR = "╚";
  var boxv = "│";
  var boxV = "║";
  var boxvh = "┼";
  var boxvH = "╪";
  var boxVh = "╫";
  var boxVH = "╬";
  var boxvl = "┤";
  var boxvL = "╡";
  var boxVl = "╢";
  var boxVL = "╣";
  var boxvr = "├";
  var boxvR = "╞";
  var boxVr = "╟";
  var boxVR = "╠";
  var bprime = "‵";
  var breve = "˘";
  var Breve = "˘";
  var brvbar = "¦";
  var bscr = "𝒷";
  var Bscr = "ℬ";
  var bsemi = "⁏";
  var bsim = "∽";
  var bsime = "⋍";
  var bsolb = "⧅";
  var bsol = "\\";
  var bsolhsub = "⟈";
  var bull = "•";
  var bullet = "•";
  var bump = "≎";
  var bumpE = "⪮";
  var bumpe = "≏";
  var Bumpeq = "≎";
  var bumpeq = "≏";
  var Cacute = "Ć";
  var cacute = "ć";
  var capand = "⩄";
  var capbrcup = "⩉";
  var capcap = "⩋";
  var cap = "∩";
  var Cap = "⋒";
  var capcup = "⩇";
  var capdot = "⩀";
  var CapitalDifferentialD = "ⅅ";
  var caps = "∩︀";
  var caret = "⁁";
  var caron = "ˇ";
  var Cayleys = "ℭ";
  var ccaps = "⩍";
  var Ccaron = "Č";
  var ccaron = "č";
  var Ccedil = "Ç";
  var ccedil = "ç";
  var Ccirc = "Ĉ";
  var ccirc = "ĉ";
  var Cconint = "∰";
  var ccups = "⩌";
  var ccupssm = "⩐";
  var Cdot = "Ċ";
  var cdot = "ċ";
  var cedil = "¸";
  var Cedilla = "¸";
  var cemptyv = "⦲";
  var cent = "¢";
  var centerdot = "·";
  var CenterDot = "·";
  var cfr = "𝔠";
  var Cfr = "ℭ";
  var CHcy = "Ч";
  var chcy = "ч";
  var check = "✓";
  var checkmark = "✓";
  var Chi = "Χ";
  var chi = "χ";
  var circ = "ˆ";
  var circeq = "≗";
  var circlearrowleft = "↺";
  var circlearrowright = "↻";
  var circledast = "⊛";
  var circledcirc = "⊚";
  var circleddash = "⊝";
  var CircleDot = "⊙";
  var circledR = "®";
  var circledS = "Ⓢ";
  var CircleMinus = "⊖";
  var CirclePlus = "⊕";
  var CircleTimes = "⊗";
  var cir = "○";
  var cirE = "⧃";
  var cire = "≗";
  var cirfnint = "⨐";
  var cirmid = "⫯";
  var cirscir = "⧂";
  var ClockwiseContourIntegral = "∲";
  var CloseCurlyDoubleQuote = "”";
  var CloseCurlyQuote = "’";
  var clubs = "♣";
  var clubsuit = "♣";
  var colon = ":";
  var Colon = "∷";
  var Colone = "⩴";
  var colone = "≔";
  var coloneq = "≔";
  var comma = ",";
  var commat = "@";
  var comp = "∁";
  var compfn = "∘";
  var complement = "∁";
  var complexes = "ℂ";
  var cong = "≅";
  var congdot = "⩭";
  var Congruent = "≡";
  var conint = "∮";
  var Conint = "∯";
  var ContourIntegral = "∮";
  var copf = "𝕔";
  var Copf = "ℂ";
  var coprod = "∐";
  var Coproduct = "∐";
  var copy$1 = "©";
  var COPY = "©";
  var copysr = "℗";
  var CounterClockwiseContourIntegral = "∳";
  var crarr = "↵";
  var cross = "✗";
  var Cross = "⨯";
  var Cscr = "𝒞";
  var cscr = "𝒸";
  var csub = "⫏";
  var csube = "⫑";
  var csup = "⫐";
  var csupe = "⫒";
  var ctdot = "⋯";
  var cudarrl = "⤸";
  var cudarrr = "⤵";
  var cuepr = "⋞";
  var cuesc = "⋟";
  var cularr = "↶";
  var cularrp = "⤽";
  var cupbrcap = "⩈";
  var cupcap = "⩆";
  var CupCap = "≍";
  var cup = "∪";
  var Cup = "⋓";
  var cupcup = "⩊";
  var cupdot = "⊍";
  var cupor = "⩅";
  var cups = "∪︀";
  var curarr = "↷";
  var curarrm = "⤼";
  var curlyeqprec = "⋞";
  var curlyeqsucc = "⋟";
  var curlyvee = "⋎";
  var curlywedge = "⋏";
  var curren = "¤";
  var curvearrowleft = "↶";
  var curvearrowright = "↷";
  var cuvee = "⋎";
  var cuwed = "⋏";
  var cwconint = "∲";
  var cwint = "∱";
  var cylcty = "⌭";
  var dagger = "†";
  var Dagger = "‡";
  var daleth = "ℸ";
  var darr = "↓";
  var Darr = "↡";
  var dArr = "⇓";
  var dash = "‐";
  var Dashv = "⫤";
  var dashv = "⊣";
  var dbkarow = "⤏";
  var dblac = "˝";
  var Dcaron = "Ď";
  var dcaron = "ď";
  var Dcy = "Д";
  var dcy = "д";
  var ddagger = "‡";
  var ddarr = "⇊";
  var DD = "ⅅ";
  var dd = "ⅆ";
  var DDotrahd = "⤑";
  var ddotseq = "⩷";
  var deg = "°";
  var Del = "∇";
  var Delta = "Δ";
  var delta = "δ";
  var demptyv = "⦱";
  var dfisht = "⥿";
  var Dfr = "𝔇";
  var dfr = "𝔡";
  var dHar = "⥥";
  var dharl = "⇃";
  var dharr = "⇂";
  var DiacriticalAcute = "´";
  var DiacriticalDot = "˙";
  var DiacriticalDoubleAcute = "˝";
  var DiacriticalGrave = "`";
  var DiacriticalTilde = "˜";
  var diam = "⋄";
  var diamond = "⋄";
  var Diamond = "⋄";
  var diamondsuit = "♦";
  var diams = "♦";
  var die = "¨";
  var DifferentialD = "ⅆ";
  var digamma = "ϝ";
  var disin = "⋲";
  var div = "÷";
  var divide = "÷";
  var divideontimes = "⋇";
  var divonx = "⋇";
  var DJcy = "Ђ";
  var djcy = "ђ";
  var dlcorn = "⌞";
  var dlcrop = "⌍";
  var dollar = "$";
  var Dopf = "𝔻";
  var dopf = "𝕕";
  var Dot = "¨";
  var dot = "˙";
  var DotDot = "⃜";
  var doteq = "≐";
  var doteqdot = "≑";
  var DotEqual = "≐";
  var dotminus = "∸";
  var dotplus = "∔";
  var dotsquare = "⊡";
  var doublebarwedge = "⌆";
  var DoubleContourIntegral = "∯";
  var DoubleDot = "¨";
  var DoubleDownArrow = "⇓";
  var DoubleLeftArrow = "⇐";
  var DoubleLeftRightArrow = "⇔";
  var DoubleLeftTee = "⫤";
  var DoubleLongLeftArrow = "⟸";
  var DoubleLongLeftRightArrow = "⟺";
  var DoubleLongRightArrow = "⟹";
  var DoubleRightArrow = "⇒";
  var DoubleRightTee = "⊨";
  var DoubleUpArrow = "⇑";
  var DoubleUpDownArrow = "⇕";
  var DoubleVerticalBar = "∥";
  var DownArrowBar = "⤓";
  var downarrow = "↓";
  var DownArrow = "↓";
  var Downarrow = "⇓";
  var DownArrowUpArrow = "⇵";
  var DownBreve = "̑";
  var downdownarrows = "⇊";
  var downharpoonleft = "⇃";
  var downharpoonright = "⇂";
  var DownLeftRightVector = "⥐";
  var DownLeftTeeVector = "⥞";
  var DownLeftVectorBar = "⥖";
  var DownLeftVector = "↽";
  var DownRightTeeVector = "⥟";
  var DownRightVectorBar = "⥗";
  var DownRightVector = "⇁";
  var DownTeeArrow = "↧";
  var DownTee = "⊤";
  var drbkarow = "⤐";
  var drcorn = "⌟";
  var drcrop = "⌌";
  var Dscr = "𝒟";
  var dscr = "𝒹";
  var DScy = "Ѕ";
  var dscy = "ѕ";
  var dsol = "⧶";
  var Dstrok = "Đ";
  var dstrok = "đ";
  var dtdot = "⋱";
  var dtri = "▿";
  var dtrif = "▾";
  var duarr = "⇵";
  var duhar = "⥯";
  var dwangle = "⦦";
  var DZcy = "Џ";
  var dzcy = "џ";
  var dzigrarr = "⟿";
  var Eacute = "É";
  var eacute = "é";
  var easter = "⩮";
  var Ecaron = "Ě";
  var ecaron = "ě";
  var Ecirc = "Ê";
  var ecirc = "ê";
  var ecir = "≖";
  var ecolon = "≕";
  var Ecy = "Э";
  var ecy = "э";
  var eDDot = "⩷";
  var Edot = "Ė";
  var edot = "ė";
  var eDot = "≑";
  var ee = "ⅇ";
  var efDot = "≒";
  var Efr = "𝔈";
  var efr = "𝔢";
  var eg = "⪚";
  var Egrave = "È";
  var egrave = "è";
  var egs = "⪖";
  var egsdot = "⪘";
  var el = "⪙";
  var Element = "∈";
  var elinters = "⏧";
  var ell = "ℓ";
  var els = "⪕";
  var elsdot = "⪗";
  var Emacr = "Ē";
  var emacr = "ē";
  var empty$1 = "∅";
  var emptyset = "∅";
  var EmptySmallSquare = "◻";
  var emptyv = "∅";
  var EmptyVerySmallSquare = "▫";
  var emsp13 = " ";
  var emsp14 = " ";
  var emsp = " ";
  var ENG = "Ŋ";
  var eng = "ŋ";
  var ensp = " ";
  var Eogon = "Ę";
  var eogon = "ę";
  var Eopf = "𝔼";
  var eopf = "𝕖";
  var epar = "⋕";
  var eparsl = "⧣";
  var eplus = "⩱";
  var epsi = "ε";
  var Epsilon = "Ε";
  var epsilon = "ε";
  var epsiv = "ϵ";
  var eqcirc = "≖";
  var eqcolon = "≕";
  var eqsim = "≂";
  var eqslantgtr = "⪖";
  var eqslantless = "⪕";
  var Equal = "⩵";
  var equals = "=";
  var EqualTilde = "≂";
  var equest = "≟";
  var Equilibrium = "⇌";
  var equiv = "≡";
  var equivDD = "⩸";
  var eqvparsl = "⧥";
  var erarr = "⥱";
  var erDot = "≓";
  var escr = "ℯ";
  var Escr = "ℰ";
  var esdot = "≐";
  var Esim = "⩳";
  var esim = "≂";
  var Eta = "Η";
  var eta = "η";
  var ETH = "Ð";
  var eth = "ð";
  var Euml = "Ë";
  var euml = "ë";
  var euro = "€";
  var excl = "!";
  var exist = "∃";
  var Exists = "∃";
  var expectation = "ℰ";
  var exponentiale = "ⅇ";
  var ExponentialE = "ⅇ";
  var fallingdotseq = "≒";
  var Fcy = "Ф";
  var fcy = "ф";
  var female = "♀";
  var ffilig = "ﬃ";
  var fflig = "ﬀ";
  var ffllig = "ﬄ";
  var Ffr = "𝔉";
  var ffr = "𝔣";
  var filig = "ﬁ";
  var FilledSmallSquare = "◼";
  var FilledVerySmallSquare = "▪";
  var fjlig = "fj";
  var flat = "♭";
  var fllig = "ﬂ";
  var fltns = "▱";
  var fnof = "ƒ";
  var Fopf = "𝔽";
  var fopf = "𝕗";
  var forall = "∀";
  var ForAll = "∀";
  var fork = "⋔";
  var forkv = "⫙";
  var Fouriertrf = "ℱ";
  var fpartint = "⨍";
  var frac12 = "½";
  var frac13 = "⅓";
  var frac14 = "¼";
  var frac15 = "⅕";
  var frac16 = "⅙";
  var frac18 = "⅛";
  var frac23 = "⅔";
  var frac25 = "⅖";
  var frac34 = "¾";
  var frac35 = "⅗";
  var frac38 = "⅜";
  var frac45 = "⅘";
  var frac56 = "⅚";
  var frac58 = "⅝";
  var frac78 = "⅞";
  var frasl = "⁄";
  var frown = "⌢";
  var fscr = "𝒻";
  var Fscr = "ℱ";
  var gacute = "ǵ";
  var Gamma = "Γ";
  var gamma = "γ";
  var Gammad = "Ϝ";
  var gammad = "ϝ";
  var gap = "⪆";
  var Gbreve = "Ğ";
  var gbreve = "ğ";
  var Gcedil = "Ģ";
  var Gcirc = "Ĝ";
  var gcirc = "ĝ";
  var Gcy = "Г";
  var gcy = "г";
  var Gdot = "Ġ";
  var gdot = "ġ";
  var ge = "≥";
  var gE = "≧";
  var gEl = "⪌";
  var gel = "⋛";
  var geq = "≥";
  var geqq = "≧";
  var geqslant = "⩾";
  var gescc = "⪩";
  var ges = "⩾";
  var gesdot = "⪀";
  var gesdoto = "⪂";
  var gesdotol = "⪄";
  var gesl = "⋛︀";
  var gesles = "⪔";
  var Gfr = "𝔊";
  var gfr = "𝔤";
  var gg = "≫";
  var Gg = "⋙";
  var ggg = "⋙";
  var gimel = "ℷ";
  var GJcy = "Ѓ";
  var gjcy = "ѓ";
  var gla = "⪥";
  var gl = "≷";
  var glE = "⪒";
  var glj = "⪤";
  var gnap = "⪊";
  var gnapprox = "⪊";
  var gne = "⪈";
  var gnE = "≩";
  var gneq = "⪈";
  var gneqq = "≩";
  var gnsim = "⋧";
  var Gopf = "𝔾";
  var gopf = "𝕘";
  var grave = "`";
  var GreaterEqual = "≥";
  var GreaterEqualLess = "⋛";
  var GreaterFullEqual = "≧";
  var GreaterGreater = "⪢";
  var GreaterLess = "≷";
  var GreaterSlantEqual = "⩾";
  var GreaterTilde = "≳";
  var Gscr = "𝒢";
  var gscr = "ℊ";
  var gsim = "≳";
  var gsime = "⪎";
  var gsiml = "⪐";
  var gtcc = "⪧";
  var gtcir = "⩺";
  var gt = ">";
  var GT = ">";
  var Gt = "≫";
  var gtdot = "⋗";
  var gtlPar = "⦕";
  var gtquest = "⩼";
  var gtrapprox = "⪆";
  var gtrarr = "⥸";
  var gtrdot = "⋗";
  var gtreqless = "⋛";
  var gtreqqless = "⪌";
  var gtrless = "≷";
  var gtrsim = "≳";
  var gvertneqq = "≩︀";
  var gvnE = "≩︀";
  var Hacek = "ˇ";
  var hairsp = " ";
  var half = "½";
  var hamilt = "ℋ";
  var HARDcy = "Ъ";
  var hardcy = "ъ";
  var harrcir = "⥈";
  var harr = "↔";
  var hArr = "⇔";
  var harrw = "↭";
  var Hat = "^";
  var hbar = "ℏ";
  var Hcirc = "Ĥ";
  var hcirc = "ĥ";
  var hearts = "♥";
  var heartsuit = "♥";
  var hellip = "…";
  var hercon = "⊹";
  var hfr = "𝔥";
  var Hfr = "ℌ";
  var HilbertSpace = "ℋ";
  var hksearow = "⤥";
  var hkswarow = "⤦";
  var hoarr = "⇿";
  var homtht = "∻";
  var hookleftarrow = "↩";
  var hookrightarrow = "↪";
  var hopf = "𝕙";
  var Hopf = "ℍ";
  var horbar = "―";
  var HorizontalLine = "─";
  var hscr = "𝒽";
  var Hscr = "ℋ";
  var hslash = "ℏ";
  var Hstrok = "Ħ";
  var hstrok = "ħ";
  var HumpDownHump = "≎";
  var HumpEqual = "≏";
  var hybull = "⁃";
  var hyphen = "‐";
  var Iacute = "Í";
  var iacute = "í";
  var ic = "⁣";
  var Icirc = "Î";
  var icirc = "î";
  var Icy = "И";
  var icy = "и";
  var Idot = "İ";
  var IEcy = "Е";
  var iecy = "е";
  var iexcl = "¡";
  var iff = "⇔";
  var ifr = "𝔦";
  var Ifr = "ℑ";
  var Igrave = "Ì";
  var igrave = "ì";
  var ii = "ⅈ";
  var iiiint = "⨌";
  var iiint = "∭";
  var iinfin = "⧜";
  var iiota = "℩";
  var IJlig = "Ĳ";
  var ijlig = "ĳ";
  var Imacr = "Ī";
  var imacr = "ī";
  var image = "ℑ";
  var ImaginaryI = "ⅈ";
  var imagline = "ℐ";
  var imagpart = "ℑ";
  var imath = "ı";
  var Im = "ℑ";
  var imof = "⊷";
  var imped = "Ƶ";
  var Implies = "⇒";
  var incare = "℅";
  var infin = "∞";
  var infintie = "⧝";
  var inodot = "ı";
  var intcal = "⊺";
  var int = "∫";
  var Int = "∬";
  var integers = "ℤ";
  var Integral = "∫";
  var intercal = "⊺";
  var Intersection = "⋂";
  var intlarhk = "⨗";
  var intprod = "⨼";
  var InvisibleComma = "⁣";
  var InvisibleTimes = "⁢";
  var IOcy = "Ё";
  var iocy = "ё";
  var Iogon = "Į";
  var iogon = "į";
  var Iopf = "𝕀";
  var iopf = "𝕚";
  var Iota = "Ι";
  var iota = "ι";
  var iprod = "⨼";
  var iquest = "¿";
  var iscr = "𝒾";
  var Iscr = "ℐ";
  var isin = "∈";
  var isindot = "⋵";
  var isinE = "⋹";
  var isins = "⋴";
  var isinsv = "⋳";
  var isinv = "∈";
  var it = "⁢";
  var Itilde = "Ĩ";
  var itilde = "ĩ";
  var Iukcy = "І";
  var iukcy = "і";
  var Iuml = "Ï";
  var iuml = "ï";
  var Jcirc = "Ĵ";
  var jcirc = "ĵ";
  var Jcy = "Й";
  var jcy = "й";
  var Jfr = "𝔍";
  var jfr = "𝔧";
  var jmath = "ȷ";
  var Jopf = "𝕁";
  var jopf = "𝕛";
  var Jscr = "𝒥";
  var jscr = "𝒿";
  var Jsercy = "Ј";
  var jsercy = "ј";
  var Jukcy = "Є";
  var jukcy = "є";
  var Kappa = "Κ";
  var kappa = "κ";
  var kappav = "ϰ";
  var Kcedil = "Ķ";
  var kcedil = "ķ";
  var Kcy = "К";
  var kcy = "к";
  var Kfr = "𝔎";
  var kfr = "𝔨";
  var kgreen = "ĸ";
  var KHcy = "Х";
  var khcy = "х";
  var KJcy = "Ќ";
  var kjcy = "ќ";
  var Kopf = "𝕂";
  var kopf = "𝕜";
  var Kscr = "𝒦";
  var kscr = "𝓀";
  var lAarr = "⇚";
  var Lacute = "Ĺ";
  var lacute = "ĺ";
  var laemptyv = "⦴";
  var lagran = "ℒ";
  var Lambda = "Λ";
  var lambda = "λ";
  var lang = "⟨";
  var Lang = "⟪";
  var langd = "⦑";
  var langle = "⟨";
  var lap = "⪅";
  var Laplacetrf = "ℒ";
  var laquo = "«";
  var larrb = "⇤";
  var larrbfs = "⤟";
  var larr = "←";
  var Larr = "↞";
  var lArr = "⇐";
  var larrfs = "⤝";
  var larrhk = "↩";
  var larrlp = "↫";
  var larrpl = "⤹";
  var larrsim = "⥳";
  var larrtl = "↢";
  var latail = "⤙";
  var lAtail = "⤛";
  var lat = "⪫";
  var late = "⪭";
  var lates = "⪭︀";
  var lbarr = "⤌";
  var lBarr = "⤎";
  var lbbrk = "❲";
  var lbrace = "{";
  var lbrack = "[";
  var lbrke = "⦋";
  var lbrksld = "⦏";
  var lbrkslu = "⦍";
  var Lcaron = "Ľ";
  var lcaron = "ľ";
  var Lcedil = "Ļ";
  var lcedil = "ļ";
  var lceil = "⌈";
  var lcub = "{";
  var Lcy = "Л";
  var lcy = "л";
  var ldca = "⤶";
  var ldquo = "“";
  var ldquor = "„";
  var ldrdhar = "⥧";
  var ldrushar = "⥋";
  var ldsh = "↲";
  var le = "≤";
  var lE = "≦";
  var LeftAngleBracket = "⟨";
  var LeftArrowBar = "⇤";
  var leftarrow = "←";
  var LeftArrow = "←";
  var Leftarrow = "⇐";
  var LeftArrowRightArrow = "⇆";
  var leftarrowtail = "↢";
  var LeftCeiling = "⌈";
  var LeftDoubleBracket = "⟦";
  var LeftDownTeeVector = "⥡";
  var LeftDownVectorBar = "⥙";
  var LeftDownVector = "⇃";
  var LeftFloor = "⌊";
  var leftharpoondown = "↽";
  var leftharpoonup = "↼";
  var leftleftarrows = "⇇";
  var leftrightarrow = "↔";
  var LeftRightArrow = "↔";
  var Leftrightarrow = "⇔";
  var leftrightarrows = "⇆";
  var leftrightharpoons = "⇋";
  var leftrightsquigarrow = "↭";
  var LeftRightVector = "⥎";
  var LeftTeeArrow = "↤";
  var LeftTee = "⊣";
  var LeftTeeVector = "⥚";
  var leftthreetimes = "⋋";
  var LeftTriangleBar = "⧏";
  var LeftTriangle = "⊲";
  var LeftTriangleEqual = "⊴";
  var LeftUpDownVector = "⥑";
  var LeftUpTeeVector = "⥠";
  var LeftUpVectorBar = "⥘";
  var LeftUpVector = "↿";
  var LeftVectorBar = "⥒";
  var LeftVector = "↼";
  var lEg = "⪋";
  var leg = "⋚";
  var leq = "≤";
  var leqq = "≦";
  var leqslant = "⩽";
  var lescc = "⪨";
  var les = "⩽";
  var lesdot = "⩿";
  var lesdoto = "⪁";
  var lesdotor = "⪃";
  var lesg = "⋚︀";
  var lesges = "⪓";
  var lessapprox = "⪅";
  var lessdot = "⋖";
  var lesseqgtr = "⋚";
  var lesseqqgtr = "⪋";
  var LessEqualGreater = "⋚";
  var LessFullEqual = "≦";
  var LessGreater = "≶";
  var lessgtr = "≶";
  var LessLess = "⪡";
  var lesssim = "≲";
  var LessSlantEqual = "⩽";
  var LessTilde = "≲";
  var lfisht = "⥼";
  var lfloor = "⌊";
  var Lfr = "𝔏";
  var lfr = "𝔩";
  var lg = "≶";
  var lgE = "⪑";
  var lHar = "⥢";
  var lhard = "↽";
  var lharu = "↼";
  var lharul = "⥪";
  var lhblk = "▄";
  var LJcy = "Љ";
  var ljcy = "љ";
  var llarr = "⇇";
  var ll = "≪";
  var Ll = "⋘";
  var llcorner = "⌞";
  var Lleftarrow = "⇚";
  var llhard = "⥫";
  var lltri = "◺";
  var Lmidot = "Ŀ";
  var lmidot = "ŀ";
  var lmoustache = "⎰";
  var lmoust = "⎰";
  var lnap = "⪉";
  var lnapprox = "⪉";
  var lne = "⪇";
  var lnE = "≨";
  var lneq = "⪇";
  var lneqq = "≨";
  var lnsim = "⋦";
  var loang = "⟬";
  var loarr = "⇽";
  var lobrk = "⟦";
  var longleftarrow = "⟵";
  var LongLeftArrow = "⟵";
  var Longleftarrow = "⟸";
  var longleftrightarrow = "⟷";
  var LongLeftRightArrow = "⟷";
  var Longleftrightarrow = "⟺";
  var longmapsto = "⟼";
  var longrightarrow = "⟶";
  var LongRightArrow = "⟶";
  var Longrightarrow = "⟹";
  var looparrowleft = "↫";
  var looparrowright = "↬";
  var lopar = "⦅";
  var Lopf = "𝕃";
  var lopf = "𝕝";
  var loplus = "⨭";
  var lotimes = "⨴";
  var lowast = "∗";
  var lowbar = "_";
  var LowerLeftArrow = "↙";
  var LowerRightArrow = "↘";
  var loz = "◊";
  var lozenge = "◊";
  var lozf = "⧫";
  var lpar = "(";
  var lparlt = "⦓";
  var lrarr = "⇆";
  var lrcorner = "⌟";
  var lrhar = "⇋";
  var lrhard = "⥭";
  var lrm = "‎";
  var lrtri = "⊿";
  var lsaquo = "‹";
  var lscr = "𝓁";
  var Lscr = "ℒ";
  var lsh = "↰";
  var Lsh = "↰";
  var lsim = "≲";
  var lsime = "⪍";
  var lsimg = "⪏";
  var lsqb = "[";
  var lsquo = "‘";
  var lsquor = "‚";
  var Lstrok = "Ł";
  var lstrok = "ł";
  var ltcc = "⪦";
  var ltcir = "⩹";
  var lt = "<";
  var LT = "<";
  var Lt = "≪";
  var ltdot = "⋖";
  var lthree = "⋋";
  var ltimes = "⋉";
  var ltlarr = "⥶";
  var ltquest = "⩻";
  var ltri = "◃";
  var ltrie = "⊴";
  var ltrif = "◂";
  var ltrPar = "⦖";
  var lurdshar = "⥊";
  var luruhar = "⥦";
  var lvertneqq = "≨︀";
  var lvnE = "≨︀";
  var macr = "¯";
  var male = "♂";
  var malt = "✠";
  var maltese = "✠";
  var map = "↦";
  var mapsto = "↦";
  var mapstodown = "↧";
  var mapstoleft = "↤";
  var mapstoup = "↥";
  var marker = "▮";
  var mcomma = "⨩";
  var Mcy = "М";
  var mcy = "м";
  var mdash = "—";
  var mDDot = "∺";
  var measuredangle = "∡";
  var MediumSpace = " ";
  var Mellintrf = "ℳ";
  var Mfr = "𝔐";
  var mfr = "𝔪";
  var mho = "℧";
  var micro = "µ";
  var midast = "*";
  var midcir = "⫰";
  var mid = "∣";
  var middot = "·";
  var minusb = "⊟";
  var minus = "−";
  var minusd = "∸";
  var minusdu = "⨪";
  var MinusPlus = "∓";
  var mlcp = "⫛";
  var mldr = "…";
  var mnplus = "∓";
  var models = "⊧";
  var Mopf = "𝕄";
  var mopf = "𝕞";
  var mp = "∓";
  var mscr = "𝓂";
  var Mscr = "ℳ";
  var mstpos = "∾";
  var Mu = "Μ";
  var mu = "μ";
  var multimap = "⊸";
  var mumap = "⊸";
  var nabla = "∇";
  var Nacute = "Ń";
  var nacute = "ń";
  var nang = "∠⃒";
  var nap = "≉";
  var napE = "⩰̸";
  var napid = "≋̸";
  var napos = "ŉ";
  var napprox = "≉";
  var natural = "♮";
  var naturals = "ℕ";
  var natur = "♮";
  var nbsp = " ";
  var nbump = "≎̸";
  var nbumpe = "≏̸";
  var ncap = "⩃";
  var Ncaron = "Ň";
  var ncaron = "ň";
  var Ncedil = "Ņ";
  var ncedil = "ņ";
  var ncong = "≇";
  var ncongdot = "⩭̸";
  var ncup = "⩂";
  var Ncy = "Н";
  var ncy = "н";
  var ndash = "–";
  var nearhk = "⤤";
  var nearr = "↗";
  var neArr = "⇗";
  var nearrow = "↗";
  var ne = "≠";
  var nedot = "≐̸";
  var NegativeMediumSpace = "​";
  var NegativeThickSpace = "​";
  var NegativeThinSpace = "​";
  var NegativeVeryThinSpace = "​";
  var nequiv = "≢";
  var nesear = "⤨";
  var nesim = "≂̸";
  var NestedGreaterGreater = "≫";
  var NestedLessLess = "≪";
  var NewLine = "\n";
  var nexist = "∄";
  var nexists = "∄";
  var Nfr = "𝔑";
  var nfr = "𝔫";
  var ngE = "≧̸";
  var nge = "≱";
  var ngeq = "≱";
  var ngeqq = "≧̸";
  var ngeqslant = "⩾̸";
  var nges = "⩾̸";
  var nGg = "⋙̸";
  var ngsim = "≵";
  var nGt = "≫⃒";
  var ngt = "≯";
  var ngtr = "≯";
  var nGtv = "≫̸";
  var nharr = "↮";
  var nhArr = "⇎";
  var nhpar = "⫲";
  var ni = "∋";
  var nis = "⋼";
  var nisd = "⋺";
  var niv = "∋";
  var NJcy = "Њ";
  var njcy = "њ";
  var nlarr = "↚";
  var nlArr = "⇍";
  var nldr = "‥";
  var nlE = "≦̸";
  var nle = "≰";
  var nleftarrow = "↚";
  var nLeftarrow = "⇍";
  var nleftrightarrow = "↮";
  var nLeftrightarrow = "⇎";
  var nleq = "≰";
  var nleqq = "≦̸";
  var nleqslant = "⩽̸";
  var nles = "⩽̸";
  var nless = "≮";
  var nLl = "⋘̸";
  var nlsim = "≴";
  var nLt = "≪⃒";
  var nlt = "≮";
  var nltri = "⋪";
  var nltrie = "⋬";
  var nLtv = "≪̸";
  var nmid = "∤";
  var NoBreak = "⁠";
  var NonBreakingSpace = " ";
  var nopf = "𝕟";
  var Nopf = "ℕ";
  var Not = "⫬";
  var not = "¬";
  var NotCongruent = "≢";
  var NotCupCap = "≭";
  var NotDoubleVerticalBar = "∦";
  var NotElement = "∉";
  var NotEqual = "≠";
  var NotEqualTilde = "≂̸";
  var NotExists = "∄";
  var NotGreater = "≯";
  var NotGreaterEqual = "≱";
  var NotGreaterFullEqual = "≧̸";
  var NotGreaterGreater = "≫̸";
  var NotGreaterLess = "≹";
  var NotGreaterSlantEqual = "⩾̸";
  var NotGreaterTilde = "≵";
  var NotHumpDownHump = "≎̸";
  var NotHumpEqual = "≏̸";
  var notin = "∉";
  var notindot = "⋵̸";
  var notinE = "⋹̸";
  var notinva = "∉";
  var notinvb = "⋷";
  var notinvc = "⋶";
  var NotLeftTriangleBar = "⧏̸";
  var NotLeftTriangle = "⋪";
  var NotLeftTriangleEqual = "⋬";
  var NotLess = "≮";
  var NotLessEqual = "≰";
  var NotLessGreater = "≸";
  var NotLessLess = "≪̸";
  var NotLessSlantEqual = "⩽̸";
  var NotLessTilde = "≴";
  var NotNestedGreaterGreater = "⪢̸";
  var NotNestedLessLess = "⪡̸";
  var notni = "∌";
  var notniva = "∌";
  var notnivb = "⋾";
  var notnivc = "⋽";
  var NotPrecedes = "⊀";
  var NotPrecedesEqual = "⪯̸";
  var NotPrecedesSlantEqual = "⋠";
  var NotReverseElement = "∌";
  var NotRightTriangleBar = "⧐̸";
  var NotRightTriangle = "⋫";
  var NotRightTriangleEqual = "⋭";
  var NotSquareSubset = "⊏̸";
  var NotSquareSubsetEqual = "⋢";
  var NotSquareSuperset = "⊐̸";
  var NotSquareSupersetEqual = "⋣";
  var NotSubset = "⊂⃒";
  var NotSubsetEqual = "⊈";
  var NotSucceeds = "⊁";
  var NotSucceedsEqual = "⪰̸";
  var NotSucceedsSlantEqual = "⋡";
  var NotSucceedsTilde = "≿̸";
  var NotSuperset = "⊃⃒";
  var NotSupersetEqual = "⊉";
  var NotTilde = "≁";
  var NotTildeEqual = "≄";
  var NotTildeFullEqual = "≇";
  var NotTildeTilde = "≉";
  var NotVerticalBar = "∤";
  var nparallel = "∦";
  var npar = "∦";
  var nparsl = "⫽⃥";
  var npart = "∂̸";
  var npolint = "⨔";
  var npr = "⊀";
  var nprcue = "⋠";
  var nprec = "⊀";
  var npreceq = "⪯̸";
  var npre = "⪯̸";
  var nrarrc = "⤳̸";
  var nrarr = "↛";
  var nrArr = "⇏";
  var nrarrw = "↝̸";
  var nrightarrow = "↛";
  var nRightarrow = "⇏";
  var nrtri = "⋫";
  var nrtrie = "⋭";
  var nsc = "⊁";
  var nsccue = "⋡";
  var nsce = "⪰̸";
  var Nscr = "𝒩";
  var nscr = "𝓃";
  var nshortmid = "∤";
  var nshortparallel = "∦";
  var nsim = "≁";
  var nsime = "≄";
  var nsimeq = "≄";
  var nsmid = "∤";
  var nspar = "∦";
  var nsqsube = "⋢";
  var nsqsupe = "⋣";
  var nsub = "⊄";
  var nsubE = "⫅̸";
  var nsube = "⊈";
  var nsubset = "⊂⃒";
  var nsubseteq = "⊈";
  var nsubseteqq = "⫅̸";
  var nsucc = "⊁";
  var nsucceq = "⪰̸";
  var nsup = "⊅";
  var nsupE = "⫆̸";
  var nsupe = "⊉";
  var nsupset = "⊃⃒";
  var nsupseteq = "⊉";
  var nsupseteqq = "⫆̸";
  var ntgl = "≹";
  var Ntilde = "Ñ";
  var ntilde = "ñ";
  var ntlg = "≸";
  var ntriangleleft = "⋪";
  var ntrianglelefteq = "⋬";
  var ntriangleright = "⋫";
  var ntrianglerighteq = "⋭";
  var Nu = "Ν";
  var nu = "ν";
  var num = "#";
  var numero = "№";
  var numsp = " ";
  var nvap = "≍⃒";
  var nvdash = "⊬";
  var nvDash = "⊭";
  var nVdash = "⊮";
  var nVDash = "⊯";
  var nvge = "≥⃒";
  var nvgt = ">⃒";
  var nvHarr = "⤄";
  var nvinfin = "⧞";
  var nvlArr = "⤂";
  var nvle = "≤⃒";
  var nvlt = "<⃒";
  var nvltrie = "⊴⃒";
  var nvrArr = "⤃";
  var nvrtrie = "⊵⃒";
  var nvsim = "∼⃒";
  var nwarhk = "⤣";
  var nwarr = "↖";
  var nwArr = "⇖";
  var nwarrow = "↖";
  var nwnear = "⤧";
  var Oacute = "Ó";
  var oacute = "ó";
  var oast = "⊛";
  var Ocirc = "Ô";
  var ocirc = "ô";
  var ocir = "⊚";
  var Ocy = "О";
  var ocy = "о";
  var odash = "⊝";
  var Odblac = "Ő";
  var odblac = "ő";
  var odiv = "⨸";
  var odot = "⊙";
  var odsold = "⦼";
  var OElig = "Œ";
  var oelig = "œ";
  var ofcir = "⦿";
  var Ofr = "𝔒";
  var ofr = "𝔬";
  var ogon = "˛";
  var Ograve = "Ò";
  var ograve = "ò";
  var ogt = "⧁";
  var ohbar = "⦵";
  var ohm = "Ω";
  var oint = "∮";
  var olarr = "↺";
  var olcir = "⦾";
  var olcross = "⦻";
  var oline = "‾";
  var olt = "⧀";
  var Omacr = "Ō";
  var omacr = "ō";
  var Omega = "Ω";
  var omega = "ω";
  var Omicron = "Ο";
  var omicron = "ο";
  var omid = "⦶";
  var ominus = "⊖";
  var Oopf = "𝕆";
  var oopf = "𝕠";
  var opar = "⦷";
  var OpenCurlyDoubleQuote = "“";
  var OpenCurlyQuote = "‘";
  var operp = "⦹";
  var oplus = "⊕";
  var orarr = "↻";
  var Or = "⩔";
  var or = "∨";
  var ord = "⩝";
  var order = "ℴ";
  var orderof = "ℴ";
  var ordf = "ª";
  var ordm = "º";
  var origof = "⊶";
  var oror = "⩖";
  var orslope = "⩗";
  var orv = "⩛";
  var oS = "Ⓢ";
  var Oscr = "𝒪";
  var oscr = "ℴ";
  var Oslash = "Ø";
  var oslash = "ø";
  var osol = "⊘";
  var Otilde = "Õ";
  var otilde = "õ";
  var otimesas = "⨶";
  var Otimes = "⨷";
  var otimes = "⊗";
  var Ouml = "Ö";
  var ouml = "ö";
  var ovbar = "⌽";
  var OverBar = "‾";
  var OverBrace = "⏞";
  var OverBracket = "⎴";
  var OverParenthesis = "⏜";
  var para = "¶";
  var parallel = "∥";
  var par = "∥";
  var parsim = "⫳";
  var parsl = "⫽";
  var part = "∂";
  var PartialD = "∂";
  var Pcy = "П";
  var pcy = "п";
  var percnt = "%";
  var period = ".";
  var permil = "‰";
  var perp = "⊥";
  var pertenk = "‱";
  var Pfr = "𝔓";
  var pfr = "𝔭";
  var Phi = "Φ";
  var phi = "φ";
  var phiv = "ϕ";
  var phmmat = "ℳ";
  var phone = "☎";
  var Pi = "Π";
  var pi = "π";
  var pitchfork = "⋔";
  var piv = "ϖ";
  var planck = "ℏ";
  var planckh = "ℎ";
  var plankv = "ℏ";
  var plusacir = "⨣";
  var plusb = "⊞";
  var pluscir = "⨢";
  var plus = "+";
  var plusdo = "∔";
  var plusdu = "⨥";
  var pluse = "⩲";
  var PlusMinus = "±";
  var plusmn = "±";
  var plussim = "⨦";
  var plustwo = "⨧";
  var pm = "±";
  var Poincareplane = "ℌ";
  var pointint = "⨕";
  var popf = "𝕡";
  var Popf = "ℙ";
  var pound = "£";
  var prap = "⪷";
  var Pr = "⪻";
  var pr = "≺";
  var prcue = "≼";
  var precapprox = "⪷";
  var prec = "≺";
  var preccurlyeq = "≼";
  var Precedes = "≺";
  var PrecedesEqual = "⪯";
  var PrecedesSlantEqual = "≼";
  var PrecedesTilde = "≾";
  var preceq = "⪯";
  var precnapprox = "⪹";
  var precneqq = "⪵";
  var precnsim = "⋨";
  var pre = "⪯";
  var prE = "⪳";
  var precsim = "≾";
  var prime = "′";
  var Prime = "″";
  var primes = "ℙ";
  var prnap = "⪹";
  var prnE = "⪵";
  var prnsim = "⋨";
  var prod = "∏";
  var Product = "∏";
  var profalar = "⌮";
  var profline = "⌒";
  var profsurf = "⌓";
  var prop$1 = "∝";
  var Proportional = "∝";
  var Proportion = "∷";
  var propto = "∝";
  var prsim = "≾";
  var prurel = "⊰";
  var Pscr = "𝒫";
  var pscr = "𝓅";
  var Psi = "Ψ";
  var psi = "ψ";
  var puncsp = " ";
  var Qfr = "𝔔";
  var qfr = "𝔮";
  var qint = "⨌";
  var qopf = "𝕢";
  var Qopf = "ℚ";
  var qprime = "⁗";
  var Qscr = "𝒬";
  var qscr = "𝓆";
  var quaternions = "ℍ";
  var quatint = "⨖";
  var quest = "?";
  var questeq = "≟";
  var quot = "\"";
  var QUOT = "\"";
  var rAarr = "⇛";
  var race = "∽̱";
  var Racute = "Ŕ";
  var racute = "ŕ";
  var radic = "√";
  var raemptyv = "⦳";
  var rang = "⟩";
  var Rang = "⟫";
  var rangd = "⦒";
  var range = "⦥";
  var rangle = "⟩";
  var raquo = "»";
  var rarrap = "⥵";
  var rarrb = "⇥";
  var rarrbfs = "⤠";
  var rarrc = "⤳";
  var rarr = "→";
  var Rarr = "↠";
  var rArr = "⇒";
  var rarrfs = "⤞";
  var rarrhk = "↪";
  var rarrlp = "↬";
  var rarrpl = "⥅";
  var rarrsim = "⥴";
  var Rarrtl = "⤖";
  var rarrtl = "↣";
  var rarrw = "↝";
  var ratail = "⤚";
  var rAtail = "⤜";
  var ratio = "∶";
  var rationals = "ℚ";
  var rbarr = "⤍";
  var rBarr = "⤏";
  var RBarr = "⤐";
  var rbbrk = "❳";
  var rbrace = "}";
  var rbrack = "]";
  var rbrke = "⦌";
  var rbrksld = "⦎";
  var rbrkslu = "⦐";
  var Rcaron = "Ř";
  var rcaron = "ř";
  var Rcedil = "Ŗ";
  var rcedil = "ŗ";
  var rceil = "⌉";
  var rcub = "}";
  var Rcy = "Р";
  var rcy = "р";
  var rdca = "⤷";
  var rdldhar = "⥩";
  var rdquo = "”";
  var rdquor = "”";
  var rdsh = "↳";
  var real = "ℜ";
  var realine = "ℛ";
  var realpart = "ℜ";
  var reals = "ℝ";
  var Re = "ℜ";
  var rect = "▭";
  var reg = "®";
  var REG = "®";
  var ReverseElement = "∋";
  var ReverseEquilibrium = "⇋";
  var ReverseUpEquilibrium = "⥯";
  var rfisht = "⥽";
  var rfloor = "⌋";
  var rfr = "𝔯";
  var Rfr = "ℜ";
  var rHar = "⥤";
  var rhard = "⇁";
  var rharu = "⇀";
  var rharul = "⥬";
  var Rho = "Ρ";
  var rho = "ρ";
  var rhov = "ϱ";
  var RightAngleBracket = "⟩";
  var RightArrowBar = "⇥";
  var rightarrow = "→";
  var RightArrow = "→";
  var Rightarrow = "⇒";
  var RightArrowLeftArrow = "⇄";
  var rightarrowtail = "↣";
  var RightCeiling = "⌉";
  var RightDoubleBracket = "⟧";
  var RightDownTeeVector = "⥝";
  var RightDownVectorBar = "⥕";
  var RightDownVector = "⇂";
  var RightFloor = "⌋";
  var rightharpoondown = "⇁";
  var rightharpoonup = "⇀";
  var rightleftarrows = "⇄";
  var rightleftharpoons = "⇌";
  var rightrightarrows = "⇉";
  var rightsquigarrow = "↝";
  var RightTeeArrow = "↦";
  var RightTee = "⊢";
  var RightTeeVector = "⥛";
  var rightthreetimes = "⋌";
  var RightTriangleBar = "⧐";
  var RightTriangle = "⊳";
  var RightTriangleEqual = "⊵";
  var RightUpDownVector = "⥏";
  var RightUpTeeVector = "⥜";
  var RightUpVectorBar = "⥔";
  var RightUpVector = "↾";
  var RightVectorBar = "⥓";
  var RightVector = "⇀";
  var ring = "˚";
  var risingdotseq = "≓";
  var rlarr = "⇄";
  var rlhar = "⇌";
  var rlm = "‏";
  var rmoustache = "⎱";
  var rmoust = "⎱";
  var rnmid = "⫮";
  var roang = "⟭";
  var roarr = "⇾";
  var robrk = "⟧";
  var ropar = "⦆";
  var ropf = "𝕣";
  var Ropf = "ℝ";
  var roplus = "⨮";
  var rotimes = "⨵";
  var RoundImplies = "⥰";
  var rpar = ")";
  var rpargt = "⦔";
  var rppolint = "⨒";
  var rrarr = "⇉";
  var Rrightarrow = "⇛";
  var rsaquo = "›";
  var rscr = "𝓇";
  var Rscr = "ℛ";
  var rsh = "↱";
  var Rsh = "↱";
  var rsqb = "]";
  var rsquo = "’";
  var rsquor = "’";
  var rthree = "⋌";
  var rtimes = "⋊";
  var rtri = "▹";
  var rtrie = "⊵";
  var rtrif = "▸";
  var rtriltri = "⧎";
  var RuleDelayed = "⧴";
  var ruluhar = "⥨";
  var rx = "℞";
  var Sacute = "Ś";
  var sacute = "ś";
  var sbquo = "‚";
  var scap = "⪸";
  var Scaron = "Š";
  var scaron = "š";
  var Sc = "⪼";
  var sc = "≻";
  var sccue = "≽";
  var sce = "⪰";
  var scE = "⪴";
  var Scedil = "Ş";
  var scedil = "ş";
  var Scirc = "Ŝ";
  var scirc = "ŝ";
  var scnap = "⪺";
  var scnE = "⪶";
  var scnsim = "⋩";
  var scpolint = "⨓";
  var scsim = "≿";
  var Scy = "С";
  var scy = "с";
  var sdotb = "⊡";
  var sdot = "⋅";
  var sdote = "⩦";
  var searhk = "⤥";
  var searr = "↘";
  var seArr = "⇘";
  var searrow = "↘";
  var sect = "§";
  var semi = ";";
  var seswar = "⤩";
  var setminus = "∖";
  var setmn = "∖";
  var sext = "✶";
  var Sfr = "𝔖";
  var sfr = "𝔰";
  var sfrown = "⌢";
  var sharp = "♯";
  var SHCHcy = "Щ";
  var shchcy = "щ";
  var SHcy = "Ш";
  var shcy = "ш";
  var ShortDownArrow = "↓";
  var ShortLeftArrow = "←";
  var shortmid = "∣";
  var shortparallel = "∥";
  var ShortRightArrow = "→";
  var ShortUpArrow = "↑";
  var shy = "­";
  var Sigma = "Σ";
  var sigma = "σ";
  var sigmaf = "ς";
  var sigmav = "ς";
  var sim = "∼";
  var simdot = "⩪";
  var sime = "≃";
  var simeq = "≃";
  var simg = "⪞";
  var simgE = "⪠";
  var siml = "⪝";
  var simlE = "⪟";
  var simne = "≆";
  var simplus = "⨤";
  var simrarr = "⥲";
  var slarr = "←";
  var SmallCircle = "∘";
  var smallsetminus = "∖";
  var smashp = "⨳";
  var smeparsl = "⧤";
  var smid = "∣";
  var smile = "⌣";
  var smt = "⪪";
  var smte = "⪬";
  var smtes = "⪬︀";
  var SOFTcy = "Ь";
  var softcy = "ь";
  var solbar = "⌿";
  var solb = "⧄";
  var sol = "/";
  var Sopf = "𝕊";
  var sopf = "𝕤";
  var spades = "♠";
  var spadesuit = "♠";
  var spar = "∥";
  var sqcap = "⊓";
  var sqcaps = "⊓︀";
  var sqcup = "⊔";
  var sqcups = "⊔︀";
  var Sqrt = "√";
  var sqsub = "⊏";
  var sqsube = "⊑";
  var sqsubset = "⊏";
  var sqsubseteq = "⊑";
  var sqsup = "⊐";
  var sqsupe = "⊒";
  var sqsupset = "⊐";
  var sqsupseteq = "⊒";
  var square = "□";
  var Square = "□";
  var SquareIntersection = "⊓";
  var SquareSubset = "⊏";
  var SquareSubsetEqual = "⊑";
  var SquareSuperset = "⊐";
  var SquareSupersetEqual = "⊒";
  var SquareUnion = "⊔";
  var squarf = "▪";
  var squ = "□";
  var squf = "▪";
  var srarr = "→";
  var Sscr = "𝒮";
  var sscr = "𝓈";
  var ssetmn = "∖";
  var ssmile = "⌣";
  var sstarf = "⋆";
  var Star = "⋆";
  var star = "☆";
  var starf = "★";
  var straightepsilon = "ϵ";
  var straightphi = "ϕ";
  var strns = "¯";
  var sub = "⊂";
  var Sub = "⋐";
  var subdot = "⪽";
  var subE = "⫅";
  var sube = "⊆";
  var subedot = "⫃";
  var submult = "⫁";
  var subnE = "⫋";
  var subne = "⊊";
  var subplus = "⪿";
  var subrarr = "⥹";
  var subset = "⊂";
  var Subset = "⋐";
  var subseteq = "⊆";
  var subseteqq = "⫅";
  var SubsetEqual = "⊆";
  var subsetneq = "⊊";
  var subsetneqq = "⫋";
  var subsim = "⫇";
  var subsub = "⫕";
  var subsup = "⫓";
  var succapprox = "⪸";
  var succ = "≻";
  var succcurlyeq = "≽";
  var Succeeds = "≻";
  var SucceedsEqual = "⪰";
  var SucceedsSlantEqual = "≽";
  var SucceedsTilde = "≿";
  var succeq = "⪰";
  var succnapprox = "⪺";
  var succneqq = "⪶";
  var succnsim = "⋩";
  var succsim = "≿";
  var SuchThat = "∋";
  var sum = "∑";
  var Sum = "∑";
  var sung = "♪";
  var sup1 = "¹";
  var sup2 = "²";
  var sup3 = "³";
  var sup = "⊃";
  var Sup = "⋑";
  var supdot = "⪾";
  var supdsub = "⫘";
  var supE = "⫆";
  var supe = "⊇";
  var supedot = "⫄";
  var Superset = "⊃";
  var SupersetEqual = "⊇";
  var suphsol = "⟉";
  var suphsub = "⫗";
  var suplarr = "⥻";
  var supmult = "⫂";
  var supnE = "⫌";
  var supne = "⊋";
  var supplus = "⫀";
  var supset = "⊃";
  var Supset = "⋑";
  var supseteq = "⊇";
  var supseteqq = "⫆";
  var supsetneq = "⊋";
  var supsetneqq = "⫌";
  var supsim = "⫈";
  var supsub = "⫔";
  var supsup = "⫖";
  var swarhk = "⤦";
  var swarr = "↙";
  var swArr = "⇙";
  var swarrow = "↙";
  var swnwar = "⤪";
  var szlig = "ß";
  var Tab = "\t";
  var target = "⌖";
  var Tau = "Τ";
  var tau = "τ";
  var tbrk = "⎴";
  var Tcaron = "Ť";
  var tcaron = "ť";
  var Tcedil = "Ţ";
  var tcedil = "ţ";
  var Tcy = "Т";
  var tcy = "т";
  var tdot = "⃛";
  var telrec = "⌕";
  var Tfr = "𝔗";
  var tfr = "𝔱";
  var there4 = "∴";
  var therefore = "∴";
  var Therefore = "∴";
  var Theta = "Θ";
  var theta = "θ";
  var thetasym = "ϑ";
  var thetav = "ϑ";
  var thickapprox = "≈";
  var thicksim = "∼";
  var ThickSpace = "  ";
  var ThinSpace = " ";
  var thinsp = " ";
  var thkap = "≈";
  var thksim = "∼";
  var THORN = "Þ";
  var thorn = "þ";
  var tilde = "˜";
  var Tilde = "∼";
  var TildeEqual = "≃";
  var TildeFullEqual = "≅";
  var TildeTilde = "≈";
  var timesbar = "⨱";
  var timesb = "⊠";
  var times = "×";
  var timesd = "⨰";
  var tint = "∭";
  var toea = "⤨";
  var topbot = "⌶";
  var topcir = "⫱";
  var top = "⊤";
  var Topf = "𝕋";
  var topf = "𝕥";
  var topfork = "⫚";
  var tosa = "⤩";
  var tprime = "‴";
  var trade = "™";
  var TRADE = "™";
  var triangle = "▵";
  var triangledown = "▿";
  var triangleleft = "◃";
  var trianglelefteq = "⊴";
  var triangleq = "≜";
  var triangleright = "▹";
  var trianglerighteq = "⊵";
  var tridot = "◬";
  var trie = "≜";
  var triminus = "⨺";
  var TripleDot = "⃛";
  var triplus = "⨹";
  var trisb = "⧍";
  var tritime = "⨻";
  var trpezium = "⏢";
  var Tscr = "𝒯";
  var tscr = "𝓉";
  var TScy = "Ц";
  var tscy = "ц";
  var TSHcy = "Ћ";
  var tshcy = "ћ";
  var Tstrok = "Ŧ";
  var tstrok = "ŧ";
  var twixt = "≬";
  var twoheadleftarrow = "↞";
  var twoheadrightarrow = "↠";
  var Uacute = "Ú";
  var uacute = "ú";
  var uarr = "↑";
  var Uarr = "↟";
  var uArr = "⇑";
  var Uarrocir = "⥉";
  var Ubrcy = "Ў";
  var ubrcy = "ў";
  var Ubreve = "Ŭ";
  var ubreve = "ŭ";
  var Ucirc = "Û";
  var ucirc = "û";
  var Ucy = "У";
  var ucy = "у";
  var udarr = "⇅";
  var Udblac = "Ű";
  var udblac = "ű";
  var udhar = "⥮";
  var ufisht = "⥾";
  var Ufr = "𝔘";
  var ufr = "𝔲";
  var Ugrave = "Ù";
  var ugrave = "ù";
  var uHar = "⥣";
  var uharl = "↿";
  var uharr = "↾";
  var uhblk = "▀";
  var ulcorn = "⌜";
  var ulcorner = "⌜";
  var ulcrop = "⌏";
  var ultri = "◸";
  var Umacr = "Ū";
  var umacr = "ū";
  var uml = "¨";
  var UnderBar = "_";
  var UnderBrace = "⏟";
  var UnderBracket = "⎵";
  var UnderParenthesis = "⏝";
  var Union = "⋃";
  var UnionPlus = "⊎";
  var Uogon = "Ų";
  var uogon = "ų";
  var Uopf = "𝕌";
  var uopf = "𝕦";
  var UpArrowBar = "⤒";
  var uparrow = "↑";
  var UpArrow = "↑";
  var Uparrow = "⇑";
  var UpArrowDownArrow = "⇅";
  var updownarrow = "↕";
  var UpDownArrow = "↕";
  var Updownarrow = "⇕";
  var UpEquilibrium = "⥮";
  var upharpoonleft = "↿";
  var upharpoonright = "↾";
  var uplus = "⊎";
  var UpperLeftArrow = "↖";
  var UpperRightArrow = "↗";
  var upsi = "υ";
  var Upsi = "ϒ";
  var upsih = "ϒ";
  var Upsilon = "Υ";
  var upsilon = "υ";
  var UpTeeArrow = "↥";
  var UpTee = "⊥";
  var upuparrows = "⇈";
  var urcorn = "⌝";
  var urcorner = "⌝";
  var urcrop = "⌎";
  var Uring = "Ů";
  var uring = "ů";
  var urtri = "◹";
  var Uscr = "𝒰";
  var uscr = "𝓊";
  var utdot = "⋰";
  var Utilde = "Ũ";
  var utilde = "ũ";
  var utri = "▵";
  var utrif = "▴";
  var uuarr = "⇈";
  var Uuml = "Ü";
  var uuml = "ü";
  var uwangle = "⦧";
  var vangrt = "⦜";
  var varepsilon = "ϵ";
  var varkappa = "ϰ";
  var varnothing = "∅";
  var varphi = "ϕ";
  var varpi = "ϖ";
  var varpropto = "∝";
  var varr = "↕";
  var vArr = "⇕";
  var varrho = "ϱ";
  var varsigma = "ς";
  var varsubsetneq = "⊊︀";
  var varsubsetneqq = "⫋︀";
  var varsupsetneq = "⊋︀";
  var varsupsetneqq = "⫌︀";
  var vartheta = "ϑ";
  var vartriangleleft = "⊲";
  var vartriangleright = "⊳";
  var vBar = "⫨";
  var Vbar = "⫫";
  var vBarv = "⫩";
  var Vcy = "В";
  var vcy = "в";
  var vdash = "⊢";
  var vDash = "⊨";
  var Vdash = "⊩";
  var VDash = "⊫";
  var Vdashl = "⫦";
  var veebar = "⊻";
  var vee = "∨";
  var Vee = "⋁";
  var veeeq = "≚";
  var vellip = "⋮";
  var verbar = "|";
  var Verbar = "‖";
  var vert = "|";
  var Vert = "‖";
  var VerticalBar = "∣";
  var VerticalLine = "|";
  var VerticalSeparator = "❘";
  var VerticalTilde = "≀";
  var VeryThinSpace = " ";
  var Vfr = "𝔙";
  var vfr = "𝔳";
  var vltri = "⊲";
  var vnsub = "⊂⃒";
  var vnsup = "⊃⃒";
  var Vopf = "𝕍";
  var vopf = "𝕧";
  var vprop = "∝";
  var vrtri = "⊳";
  var Vscr = "𝒱";
  var vscr = "𝓋";
  var vsubnE = "⫋︀";
  var vsubne = "⊊︀";
  var vsupnE = "⫌︀";
  var vsupne = "⊋︀";
  var Vvdash = "⊪";
  var vzigzag = "⦚";
  var Wcirc = "Ŵ";
  var wcirc = "ŵ";
  var wedbar = "⩟";
  var wedge = "∧";
  var Wedge = "⋀";
  var wedgeq = "≙";
  var weierp = "℘";
  var Wfr = "𝔚";
  var wfr = "𝔴";
  var Wopf = "𝕎";
  var wopf = "𝕨";
  var wp = "℘";
  var wr = "≀";
  var wreath = "≀";
  var Wscr = "𝒲";
  var wscr = "𝓌";
  var xcap = "⋂";
  var xcirc = "◯";
  var xcup = "⋃";
  var xdtri = "▽";
  var Xfr = "𝔛";
  var xfr = "𝔵";
  var xharr = "⟷";
  var xhArr = "⟺";
  var Xi = "Ξ";
  var xi = "ξ";
  var xlarr = "⟵";
  var xlArr = "⟸";
  var xmap = "⟼";
  var xnis = "⋻";
  var xodot = "⨀";
  var Xopf = "𝕏";
  var xopf = "𝕩";
  var xoplus = "⨁";
  var xotime = "⨂";
  var xrarr = "⟶";
  var xrArr = "⟹";
  var Xscr = "𝒳";
  var xscr = "𝓍";
  var xsqcup = "⨆";
  var xuplus = "⨄";
  var xutri = "△";
  var xvee = "⋁";
  var xwedge = "⋀";
  var Yacute = "Ý";
  var yacute = "ý";
  var YAcy = "Я";
  var yacy = "я";
  var Ycirc = "Ŷ";
  var ycirc = "ŷ";
  var Ycy = "Ы";
  var ycy = "ы";
  var yen = "¥";
  var Yfr = "𝔜";
  var yfr = "𝔶";
  var YIcy = "Ї";
  var yicy = "ї";
  var Yopf = "𝕐";
  var yopf = "𝕪";
  var Yscr = "𝒴";
  var yscr = "𝓎";
  var YUcy = "Ю";
  var yucy = "ю";
  var yuml = "ÿ";
  var Yuml = "Ÿ";
  var Zacute = "Ź";
  var zacute = "ź";
  var Zcaron = "Ž";
  var zcaron = "ž";
  var Zcy = "З";
  var zcy = "з";
  var Zdot = "Ż";
  var zdot = "ż";
  var zeetrf = "ℨ";
  var ZeroWidthSpace = "​";
  var Zeta = "Ζ";
  var zeta = "ζ";
  var zfr = "𝔷";
  var Zfr = "ℨ";
  var ZHcy = "Ж";
  var zhcy = "ж";
  var zigrarr = "⇝";
  var zopf = "𝕫";
  var Zopf = "ℤ";
  var Zscr = "𝒵";
  var zscr = "𝓏";
  var zwj = "‍";
  var zwnj = "‌";
  var entities = {
  	Aacute: Aacute,
  	aacute: aacute,
  	Abreve: Abreve,
  	abreve: abreve,
  	ac: ac,
  	acd: acd,
  	acE: acE,
  	Acirc: Acirc,
  	acirc: acirc,
  	acute: acute,
  	Acy: Acy,
  	acy: acy,
  	AElig: AElig,
  	aelig: aelig,
  	af: af,
  	Afr: Afr,
  	afr: afr,
  	Agrave: Agrave,
  	agrave: agrave,
  	alefsym: alefsym,
  	aleph: aleph,
  	Alpha: Alpha,
  	alpha: alpha,
  	Amacr: Amacr,
  	amacr: amacr,
  	amalg: amalg,
  	amp: amp,
  	AMP: AMP,
  	andand: andand,
  	And: And,
  	and: and,
  	andd: andd,
  	andslope: andslope,
  	andv: andv,
  	ang: ang,
  	ange: ange,
  	angle: angle,
  	angmsdaa: angmsdaa,
  	angmsdab: angmsdab,
  	angmsdac: angmsdac,
  	angmsdad: angmsdad,
  	angmsdae: angmsdae,
  	angmsdaf: angmsdaf,
  	angmsdag: angmsdag,
  	angmsdah: angmsdah,
  	angmsd: angmsd,
  	angrt: angrt,
  	angrtvb: angrtvb,
  	angrtvbd: angrtvbd,
  	angsph: angsph,
  	angst: angst,
  	angzarr: angzarr,
  	Aogon: Aogon,
  	aogon: aogon,
  	Aopf: Aopf,
  	aopf: aopf,
  	apacir: apacir,
  	ap: ap,
  	apE: apE,
  	ape: ape,
  	apid: apid,
  	apos: apos,
  	ApplyFunction: ApplyFunction,
  	approx: approx,
  	approxeq: approxeq,
  	Aring: Aring,
  	aring: aring,
  	Ascr: Ascr,
  	ascr: ascr,
  	Assign: Assign,
  	ast: ast,
  	asymp: asymp,
  	asympeq: asympeq,
  	Atilde: Atilde,
  	atilde: atilde,
  	Auml: Auml,
  	auml: auml,
  	awconint: awconint,
  	awint: awint,
  	backcong: backcong,
  	backepsilon: backepsilon,
  	backprime: backprime,
  	backsim: backsim,
  	backsimeq: backsimeq,
  	Backslash: Backslash,
  	Barv: Barv,
  	barvee: barvee,
  	barwed: barwed,
  	Barwed: Barwed,
  	barwedge: barwedge,
  	bbrk: bbrk,
  	bbrktbrk: bbrktbrk,
  	bcong: bcong,
  	Bcy: Bcy,
  	bcy: bcy,
  	bdquo: bdquo,
  	becaus: becaus,
  	because: because,
  	Because: Because,
  	bemptyv: bemptyv,
  	bepsi: bepsi,
  	bernou: bernou,
  	Bernoullis: Bernoullis,
  	Beta: Beta,
  	beta: beta,
  	beth: beth,
  	between: between,
  	Bfr: Bfr,
  	bfr: bfr,
  	bigcap: bigcap,
  	bigcirc: bigcirc,
  	bigcup: bigcup,
  	bigodot: bigodot,
  	bigoplus: bigoplus,
  	bigotimes: bigotimes,
  	bigsqcup: bigsqcup,
  	bigstar: bigstar,
  	bigtriangledown: bigtriangledown,
  	bigtriangleup: bigtriangleup,
  	biguplus: biguplus,
  	bigvee: bigvee,
  	bigwedge: bigwedge,
  	bkarow: bkarow,
  	blacklozenge: blacklozenge,
  	blacksquare: blacksquare,
  	blacktriangle: blacktriangle,
  	blacktriangledown: blacktriangledown,
  	blacktriangleleft: blacktriangleleft,
  	blacktriangleright: blacktriangleright,
  	blank: blank,
  	blk12: blk12,
  	blk14: blk14,
  	blk34: blk34,
  	block: block,
  	bne: bne,
  	bnequiv: bnequiv,
  	bNot: bNot,
  	bnot: bnot,
  	Bopf: Bopf,
  	bopf: bopf,
  	bot: bot,
  	bottom: bottom,
  	bowtie: bowtie,
  	boxbox: boxbox,
  	boxdl: boxdl,
  	boxdL: boxdL,
  	boxDl: boxDl,
  	boxDL: boxDL,
  	boxdr: boxdr,
  	boxdR: boxdR,
  	boxDr: boxDr,
  	boxDR: boxDR,
  	boxh: boxh,
  	boxH: boxH,
  	boxhd: boxhd,
  	boxHd: boxHd,
  	boxhD: boxhD,
  	boxHD: boxHD,
  	boxhu: boxhu,
  	boxHu: boxHu,
  	boxhU: boxhU,
  	boxHU: boxHU,
  	boxminus: boxminus,
  	boxplus: boxplus,
  	boxtimes: boxtimes,
  	boxul: boxul,
  	boxuL: boxuL,
  	boxUl: boxUl,
  	boxUL: boxUL,
  	boxur: boxur,
  	boxuR: boxuR,
  	boxUr: boxUr,
  	boxUR: boxUR,
  	boxv: boxv,
  	boxV: boxV,
  	boxvh: boxvh,
  	boxvH: boxvH,
  	boxVh: boxVh,
  	boxVH: boxVH,
  	boxvl: boxvl,
  	boxvL: boxvL,
  	boxVl: boxVl,
  	boxVL: boxVL,
  	boxvr: boxvr,
  	boxvR: boxvR,
  	boxVr: boxVr,
  	boxVR: boxVR,
  	bprime: bprime,
  	breve: breve,
  	Breve: Breve,
  	brvbar: brvbar,
  	bscr: bscr,
  	Bscr: Bscr,
  	bsemi: bsemi,
  	bsim: bsim,
  	bsime: bsime,
  	bsolb: bsolb,
  	bsol: bsol,
  	bsolhsub: bsolhsub,
  	bull: bull,
  	bullet: bullet,
  	bump: bump,
  	bumpE: bumpE,
  	bumpe: bumpe,
  	Bumpeq: Bumpeq,
  	bumpeq: bumpeq,
  	Cacute: Cacute,
  	cacute: cacute,
  	capand: capand,
  	capbrcup: capbrcup,
  	capcap: capcap,
  	cap: cap,
  	Cap: Cap,
  	capcup: capcup,
  	capdot: capdot,
  	CapitalDifferentialD: CapitalDifferentialD,
  	caps: caps,
  	caret: caret,
  	caron: caron,
  	Cayleys: Cayleys,
  	ccaps: ccaps,
  	Ccaron: Ccaron,
  	ccaron: ccaron,
  	Ccedil: Ccedil,
  	ccedil: ccedil,
  	Ccirc: Ccirc,
  	ccirc: ccirc,
  	Cconint: Cconint,
  	ccups: ccups,
  	ccupssm: ccupssm,
  	Cdot: Cdot,
  	cdot: cdot,
  	cedil: cedil,
  	Cedilla: Cedilla,
  	cemptyv: cemptyv,
  	cent: cent,
  	centerdot: centerdot,
  	CenterDot: CenterDot,
  	cfr: cfr,
  	Cfr: Cfr,
  	CHcy: CHcy,
  	chcy: chcy,
  	check: check,
  	checkmark: checkmark,
  	Chi: Chi,
  	chi: chi,
  	circ: circ,
  	circeq: circeq,
  	circlearrowleft: circlearrowleft,
  	circlearrowright: circlearrowright,
  	circledast: circledast,
  	circledcirc: circledcirc,
  	circleddash: circleddash,
  	CircleDot: CircleDot,
  	circledR: circledR,
  	circledS: circledS,
  	CircleMinus: CircleMinus,
  	CirclePlus: CirclePlus,
  	CircleTimes: CircleTimes,
  	cir: cir,
  	cirE: cirE,
  	cire: cire,
  	cirfnint: cirfnint,
  	cirmid: cirmid,
  	cirscir: cirscir,
  	ClockwiseContourIntegral: ClockwiseContourIntegral,
  	CloseCurlyDoubleQuote: CloseCurlyDoubleQuote,
  	CloseCurlyQuote: CloseCurlyQuote,
  	clubs: clubs,
  	clubsuit: clubsuit,
  	colon: colon,
  	Colon: Colon,
  	Colone: Colone,
  	colone: colone,
  	coloneq: coloneq,
  	comma: comma,
  	commat: commat,
  	comp: comp,
  	compfn: compfn,
  	complement: complement,
  	complexes: complexes,
  	cong: cong,
  	congdot: congdot,
  	Congruent: Congruent,
  	conint: conint,
  	Conint: Conint,
  	ContourIntegral: ContourIntegral,
  	copf: copf,
  	Copf: Copf,
  	coprod: coprod,
  	Coproduct: Coproduct,
  	copy: copy$1,
  	COPY: COPY,
  	copysr: copysr,
  	CounterClockwiseContourIntegral: CounterClockwiseContourIntegral,
  	crarr: crarr,
  	cross: cross,
  	Cross: Cross,
  	Cscr: Cscr,
  	cscr: cscr,
  	csub: csub,
  	csube: csube,
  	csup: csup,
  	csupe: csupe,
  	ctdot: ctdot,
  	cudarrl: cudarrl,
  	cudarrr: cudarrr,
  	cuepr: cuepr,
  	cuesc: cuesc,
  	cularr: cularr,
  	cularrp: cularrp,
  	cupbrcap: cupbrcap,
  	cupcap: cupcap,
  	CupCap: CupCap,
  	cup: cup,
  	Cup: Cup,
  	cupcup: cupcup,
  	cupdot: cupdot,
  	cupor: cupor,
  	cups: cups,
  	curarr: curarr,
  	curarrm: curarrm,
  	curlyeqprec: curlyeqprec,
  	curlyeqsucc: curlyeqsucc,
  	curlyvee: curlyvee,
  	curlywedge: curlywedge,
  	curren: curren,
  	curvearrowleft: curvearrowleft,
  	curvearrowright: curvearrowright,
  	cuvee: cuvee,
  	cuwed: cuwed,
  	cwconint: cwconint,
  	cwint: cwint,
  	cylcty: cylcty,
  	dagger: dagger,
  	Dagger: Dagger,
  	daleth: daleth,
  	darr: darr,
  	Darr: Darr,
  	dArr: dArr,
  	dash: dash,
  	Dashv: Dashv,
  	dashv: dashv,
  	dbkarow: dbkarow,
  	dblac: dblac,
  	Dcaron: Dcaron,
  	dcaron: dcaron,
  	Dcy: Dcy,
  	dcy: dcy,
  	ddagger: ddagger,
  	ddarr: ddarr,
  	DD: DD,
  	dd: dd,
  	DDotrahd: DDotrahd,
  	ddotseq: ddotseq,
  	deg: deg,
  	Del: Del,
  	Delta: Delta,
  	delta: delta,
  	demptyv: demptyv,
  	dfisht: dfisht,
  	Dfr: Dfr,
  	dfr: dfr,
  	dHar: dHar,
  	dharl: dharl,
  	dharr: dharr,
  	DiacriticalAcute: DiacriticalAcute,
  	DiacriticalDot: DiacriticalDot,
  	DiacriticalDoubleAcute: DiacriticalDoubleAcute,
  	DiacriticalGrave: DiacriticalGrave,
  	DiacriticalTilde: DiacriticalTilde,
  	diam: diam,
  	diamond: diamond,
  	Diamond: Diamond,
  	diamondsuit: diamondsuit,
  	diams: diams,
  	die: die,
  	DifferentialD: DifferentialD,
  	digamma: digamma,
  	disin: disin,
  	div: div,
  	divide: divide,
  	divideontimes: divideontimes,
  	divonx: divonx,
  	DJcy: DJcy,
  	djcy: djcy,
  	dlcorn: dlcorn,
  	dlcrop: dlcrop,
  	dollar: dollar,
  	Dopf: Dopf,
  	dopf: dopf,
  	Dot: Dot,
  	dot: dot,
  	DotDot: DotDot,
  	doteq: doteq,
  	doteqdot: doteqdot,
  	DotEqual: DotEqual,
  	dotminus: dotminus,
  	dotplus: dotplus,
  	dotsquare: dotsquare,
  	doublebarwedge: doublebarwedge,
  	DoubleContourIntegral: DoubleContourIntegral,
  	DoubleDot: DoubleDot,
  	DoubleDownArrow: DoubleDownArrow,
  	DoubleLeftArrow: DoubleLeftArrow,
  	DoubleLeftRightArrow: DoubleLeftRightArrow,
  	DoubleLeftTee: DoubleLeftTee,
  	DoubleLongLeftArrow: DoubleLongLeftArrow,
  	DoubleLongLeftRightArrow: DoubleLongLeftRightArrow,
  	DoubleLongRightArrow: DoubleLongRightArrow,
  	DoubleRightArrow: DoubleRightArrow,
  	DoubleRightTee: DoubleRightTee,
  	DoubleUpArrow: DoubleUpArrow,
  	DoubleUpDownArrow: DoubleUpDownArrow,
  	DoubleVerticalBar: DoubleVerticalBar,
  	DownArrowBar: DownArrowBar,
  	downarrow: downarrow,
  	DownArrow: DownArrow,
  	Downarrow: Downarrow,
  	DownArrowUpArrow: DownArrowUpArrow,
  	DownBreve: DownBreve,
  	downdownarrows: downdownarrows,
  	downharpoonleft: downharpoonleft,
  	downharpoonright: downharpoonright,
  	DownLeftRightVector: DownLeftRightVector,
  	DownLeftTeeVector: DownLeftTeeVector,
  	DownLeftVectorBar: DownLeftVectorBar,
  	DownLeftVector: DownLeftVector,
  	DownRightTeeVector: DownRightTeeVector,
  	DownRightVectorBar: DownRightVectorBar,
  	DownRightVector: DownRightVector,
  	DownTeeArrow: DownTeeArrow,
  	DownTee: DownTee,
  	drbkarow: drbkarow,
  	drcorn: drcorn,
  	drcrop: drcrop,
  	Dscr: Dscr,
  	dscr: dscr,
  	DScy: DScy,
  	dscy: dscy,
  	dsol: dsol,
  	Dstrok: Dstrok,
  	dstrok: dstrok,
  	dtdot: dtdot,
  	dtri: dtri,
  	dtrif: dtrif,
  	duarr: duarr,
  	duhar: duhar,
  	dwangle: dwangle,
  	DZcy: DZcy,
  	dzcy: dzcy,
  	dzigrarr: dzigrarr,
  	Eacute: Eacute,
  	eacute: eacute,
  	easter: easter,
  	Ecaron: Ecaron,
  	ecaron: ecaron,
  	Ecirc: Ecirc,
  	ecirc: ecirc,
  	ecir: ecir,
  	ecolon: ecolon,
  	Ecy: Ecy,
  	ecy: ecy,
  	eDDot: eDDot,
  	Edot: Edot,
  	edot: edot,
  	eDot: eDot,
  	ee: ee,
  	efDot: efDot,
  	Efr: Efr,
  	efr: efr,
  	eg: eg,
  	Egrave: Egrave,
  	egrave: egrave,
  	egs: egs,
  	egsdot: egsdot,
  	el: el,
  	Element: Element,
  	elinters: elinters,
  	ell: ell,
  	els: els,
  	elsdot: elsdot,
  	Emacr: Emacr,
  	emacr: emacr,
  	empty: empty$1,
  	emptyset: emptyset,
  	EmptySmallSquare: EmptySmallSquare,
  	emptyv: emptyv,
  	EmptyVerySmallSquare: EmptyVerySmallSquare,
  	emsp13: emsp13,
  	emsp14: emsp14,
  	emsp: emsp,
  	ENG: ENG,
  	eng: eng,
  	ensp: ensp,
  	Eogon: Eogon,
  	eogon: eogon,
  	Eopf: Eopf,
  	eopf: eopf,
  	epar: epar,
  	eparsl: eparsl,
  	eplus: eplus,
  	epsi: epsi,
  	Epsilon: Epsilon,
  	epsilon: epsilon,
  	epsiv: epsiv,
  	eqcirc: eqcirc,
  	eqcolon: eqcolon,
  	eqsim: eqsim,
  	eqslantgtr: eqslantgtr,
  	eqslantless: eqslantless,
  	Equal: Equal,
  	equals: equals,
  	EqualTilde: EqualTilde,
  	equest: equest,
  	Equilibrium: Equilibrium,
  	equiv: equiv,
  	equivDD: equivDD,
  	eqvparsl: eqvparsl,
  	erarr: erarr,
  	erDot: erDot,
  	escr: escr,
  	Escr: Escr,
  	esdot: esdot,
  	Esim: Esim,
  	esim: esim,
  	Eta: Eta,
  	eta: eta,
  	ETH: ETH,
  	eth: eth,
  	Euml: Euml,
  	euml: euml,
  	euro: euro,
  	excl: excl,
  	exist: exist,
  	Exists: Exists,
  	expectation: expectation,
  	exponentiale: exponentiale,
  	ExponentialE: ExponentialE,
  	fallingdotseq: fallingdotseq,
  	Fcy: Fcy,
  	fcy: fcy,
  	female: female,
  	ffilig: ffilig,
  	fflig: fflig,
  	ffllig: ffllig,
  	Ffr: Ffr,
  	ffr: ffr,
  	filig: filig,
  	FilledSmallSquare: FilledSmallSquare,
  	FilledVerySmallSquare: FilledVerySmallSquare,
  	fjlig: fjlig,
  	flat: flat,
  	fllig: fllig,
  	fltns: fltns,
  	fnof: fnof,
  	Fopf: Fopf,
  	fopf: fopf,
  	forall: forall,
  	ForAll: ForAll,
  	fork: fork,
  	forkv: forkv,
  	Fouriertrf: Fouriertrf,
  	fpartint: fpartint,
  	frac12: frac12,
  	frac13: frac13,
  	frac14: frac14,
  	frac15: frac15,
  	frac16: frac16,
  	frac18: frac18,
  	frac23: frac23,
  	frac25: frac25,
  	frac34: frac34,
  	frac35: frac35,
  	frac38: frac38,
  	frac45: frac45,
  	frac56: frac56,
  	frac58: frac58,
  	frac78: frac78,
  	frasl: frasl,
  	frown: frown,
  	fscr: fscr,
  	Fscr: Fscr,
  	gacute: gacute,
  	Gamma: Gamma,
  	gamma: gamma,
  	Gammad: Gammad,
  	gammad: gammad,
  	gap: gap,
  	Gbreve: Gbreve,
  	gbreve: gbreve,
  	Gcedil: Gcedil,
  	Gcirc: Gcirc,
  	gcirc: gcirc,
  	Gcy: Gcy,
  	gcy: gcy,
  	Gdot: Gdot,
  	gdot: gdot,
  	ge: ge,
  	gE: gE,
  	gEl: gEl,
  	gel: gel,
  	geq: geq,
  	geqq: geqq,
  	geqslant: geqslant,
  	gescc: gescc,
  	ges: ges,
  	gesdot: gesdot,
  	gesdoto: gesdoto,
  	gesdotol: gesdotol,
  	gesl: gesl,
  	gesles: gesles,
  	Gfr: Gfr,
  	gfr: gfr,
  	gg: gg,
  	Gg: Gg,
  	ggg: ggg,
  	gimel: gimel,
  	GJcy: GJcy,
  	gjcy: gjcy,
  	gla: gla,
  	gl: gl,
  	glE: glE,
  	glj: glj,
  	gnap: gnap,
  	gnapprox: gnapprox,
  	gne: gne,
  	gnE: gnE,
  	gneq: gneq,
  	gneqq: gneqq,
  	gnsim: gnsim,
  	Gopf: Gopf,
  	gopf: gopf,
  	grave: grave,
  	GreaterEqual: GreaterEqual,
  	GreaterEqualLess: GreaterEqualLess,
  	GreaterFullEqual: GreaterFullEqual,
  	GreaterGreater: GreaterGreater,
  	GreaterLess: GreaterLess,
  	GreaterSlantEqual: GreaterSlantEqual,
  	GreaterTilde: GreaterTilde,
  	Gscr: Gscr,
  	gscr: gscr,
  	gsim: gsim,
  	gsime: gsime,
  	gsiml: gsiml,
  	gtcc: gtcc,
  	gtcir: gtcir,
  	gt: gt,
  	GT: GT,
  	Gt: Gt,
  	gtdot: gtdot,
  	gtlPar: gtlPar,
  	gtquest: gtquest,
  	gtrapprox: gtrapprox,
  	gtrarr: gtrarr,
  	gtrdot: gtrdot,
  	gtreqless: gtreqless,
  	gtreqqless: gtreqqless,
  	gtrless: gtrless,
  	gtrsim: gtrsim,
  	gvertneqq: gvertneqq,
  	gvnE: gvnE,
  	Hacek: Hacek,
  	hairsp: hairsp,
  	half: half,
  	hamilt: hamilt,
  	HARDcy: HARDcy,
  	hardcy: hardcy,
  	harrcir: harrcir,
  	harr: harr,
  	hArr: hArr,
  	harrw: harrw,
  	Hat: Hat,
  	hbar: hbar,
  	Hcirc: Hcirc,
  	hcirc: hcirc,
  	hearts: hearts,
  	heartsuit: heartsuit,
  	hellip: hellip,
  	hercon: hercon,
  	hfr: hfr,
  	Hfr: Hfr,
  	HilbertSpace: HilbertSpace,
  	hksearow: hksearow,
  	hkswarow: hkswarow,
  	hoarr: hoarr,
  	homtht: homtht,
  	hookleftarrow: hookleftarrow,
  	hookrightarrow: hookrightarrow,
  	hopf: hopf,
  	Hopf: Hopf,
  	horbar: horbar,
  	HorizontalLine: HorizontalLine,
  	hscr: hscr,
  	Hscr: Hscr,
  	hslash: hslash,
  	Hstrok: Hstrok,
  	hstrok: hstrok,
  	HumpDownHump: HumpDownHump,
  	HumpEqual: HumpEqual,
  	hybull: hybull,
  	hyphen: hyphen,
  	Iacute: Iacute,
  	iacute: iacute,
  	ic: ic,
  	Icirc: Icirc,
  	icirc: icirc,
  	Icy: Icy,
  	icy: icy,
  	Idot: Idot,
  	IEcy: IEcy,
  	iecy: iecy,
  	iexcl: iexcl,
  	iff: iff,
  	ifr: ifr,
  	Ifr: Ifr,
  	Igrave: Igrave,
  	igrave: igrave,
  	ii: ii,
  	iiiint: iiiint,
  	iiint: iiint,
  	iinfin: iinfin,
  	iiota: iiota,
  	IJlig: IJlig,
  	ijlig: ijlig,
  	Imacr: Imacr,
  	imacr: imacr,
  	image: image,
  	ImaginaryI: ImaginaryI,
  	imagline: imagline,
  	imagpart: imagpart,
  	imath: imath,
  	Im: Im,
  	imof: imof,
  	imped: imped,
  	Implies: Implies,
  	incare: incare,
  	"in": "∈",
  	infin: infin,
  	infintie: infintie,
  	inodot: inodot,
  	intcal: intcal,
  	int: int,
  	Int: Int,
  	integers: integers,
  	Integral: Integral,
  	intercal: intercal,
  	Intersection: Intersection,
  	intlarhk: intlarhk,
  	intprod: intprod,
  	InvisibleComma: InvisibleComma,
  	InvisibleTimes: InvisibleTimes,
  	IOcy: IOcy,
  	iocy: iocy,
  	Iogon: Iogon,
  	iogon: iogon,
  	Iopf: Iopf,
  	iopf: iopf,
  	Iota: Iota,
  	iota: iota,
  	iprod: iprod,
  	iquest: iquest,
  	iscr: iscr,
  	Iscr: Iscr,
  	isin: isin,
  	isindot: isindot,
  	isinE: isinE,
  	isins: isins,
  	isinsv: isinsv,
  	isinv: isinv,
  	it: it,
  	Itilde: Itilde,
  	itilde: itilde,
  	Iukcy: Iukcy,
  	iukcy: iukcy,
  	Iuml: Iuml,
  	iuml: iuml,
  	Jcirc: Jcirc,
  	jcirc: jcirc,
  	Jcy: Jcy,
  	jcy: jcy,
  	Jfr: Jfr,
  	jfr: jfr,
  	jmath: jmath,
  	Jopf: Jopf,
  	jopf: jopf,
  	Jscr: Jscr,
  	jscr: jscr,
  	Jsercy: Jsercy,
  	jsercy: jsercy,
  	Jukcy: Jukcy,
  	jukcy: jukcy,
  	Kappa: Kappa,
  	kappa: kappa,
  	kappav: kappav,
  	Kcedil: Kcedil,
  	kcedil: kcedil,
  	Kcy: Kcy,
  	kcy: kcy,
  	Kfr: Kfr,
  	kfr: kfr,
  	kgreen: kgreen,
  	KHcy: KHcy,
  	khcy: khcy,
  	KJcy: KJcy,
  	kjcy: kjcy,
  	Kopf: Kopf,
  	kopf: kopf,
  	Kscr: Kscr,
  	kscr: kscr,
  	lAarr: lAarr,
  	Lacute: Lacute,
  	lacute: lacute,
  	laemptyv: laemptyv,
  	lagran: lagran,
  	Lambda: Lambda,
  	lambda: lambda,
  	lang: lang,
  	Lang: Lang,
  	langd: langd,
  	langle: langle,
  	lap: lap,
  	Laplacetrf: Laplacetrf,
  	laquo: laquo,
  	larrb: larrb,
  	larrbfs: larrbfs,
  	larr: larr,
  	Larr: Larr,
  	lArr: lArr,
  	larrfs: larrfs,
  	larrhk: larrhk,
  	larrlp: larrlp,
  	larrpl: larrpl,
  	larrsim: larrsim,
  	larrtl: larrtl,
  	latail: latail,
  	lAtail: lAtail,
  	lat: lat,
  	late: late,
  	lates: lates,
  	lbarr: lbarr,
  	lBarr: lBarr,
  	lbbrk: lbbrk,
  	lbrace: lbrace,
  	lbrack: lbrack,
  	lbrke: lbrke,
  	lbrksld: lbrksld,
  	lbrkslu: lbrkslu,
  	Lcaron: Lcaron,
  	lcaron: lcaron,
  	Lcedil: Lcedil,
  	lcedil: lcedil,
  	lceil: lceil,
  	lcub: lcub,
  	Lcy: Lcy,
  	lcy: lcy,
  	ldca: ldca,
  	ldquo: ldquo,
  	ldquor: ldquor,
  	ldrdhar: ldrdhar,
  	ldrushar: ldrushar,
  	ldsh: ldsh,
  	le: le,
  	lE: lE,
  	LeftAngleBracket: LeftAngleBracket,
  	LeftArrowBar: LeftArrowBar,
  	leftarrow: leftarrow,
  	LeftArrow: LeftArrow,
  	Leftarrow: Leftarrow,
  	LeftArrowRightArrow: LeftArrowRightArrow,
  	leftarrowtail: leftarrowtail,
  	LeftCeiling: LeftCeiling,
  	LeftDoubleBracket: LeftDoubleBracket,
  	LeftDownTeeVector: LeftDownTeeVector,
  	LeftDownVectorBar: LeftDownVectorBar,
  	LeftDownVector: LeftDownVector,
  	LeftFloor: LeftFloor,
  	leftharpoondown: leftharpoondown,
  	leftharpoonup: leftharpoonup,
  	leftleftarrows: leftleftarrows,
  	leftrightarrow: leftrightarrow,
  	LeftRightArrow: LeftRightArrow,
  	Leftrightarrow: Leftrightarrow,
  	leftrightarrows: leftrightarrows,
  	leftrightharpoons: leftrightharpoons,
  	leftrightsquigarrow: leftrightsquigarrow,
  	LeftRightVector: LeftRightVector,
  	LeftTeeArrow: LeftTeeArrow,
  	LeftTee: LeftTee,
  	LeftTeeVector: LeftTeeVector,
  	leftthreetimes: leftthreetimes,
  	LeftTriangleBar: LeftTriangleBar,
  	LeftTriangle: LeftTriangle,
  	LeftTriangleEqual: LeftTriangleEqual,
  	LeftUpDownVector: LeftUpDownVector,
  	LeftUpTeeVector: LeftUpTeeVector,
  	LeftUpVectorBar: LeftUpVectorBar,
  	LeftUpVector: LeftUpVector,
  	LeftVectorBar: LeftVectorBar,
  	LeftVector: LeftVector,
  	lEg: lEg,
  	leg: leg,
  	leq: leq,
  	leqq: leqq,
  	leqslant: leqslant,
  	lescc: lescc,
  	les: les,
  	lesdot: lesdot,
  	lesdoto: lesdoto,
  	lesdotor: lesdotor,
  	lesg: lesg,
  	lesges: lesges,
  	lessapprox: lessapprox,
  	lessdot: lessdot,
  	lesseqgtr: lesseqgtr,
  	lesseqqgtr: lesseqqgtr,
  	LessEqualGreater: LessEqualGreater,
  	LessFullEqual: LessFullEqual,
  	LessGreater: LessGreater,
  	lessgtr: lessgtr,
  	LessLess: LessLess,
  	lesssim: lesssim,
  	LessSlantEqual: LessSlantEqual,
  	LessTilde: LessTilde,
  	lfisht: lfisht,
  	lfloor: lfloor,
  	Lfr: Lfr,
  	lfr: lfr,
  	lg: lg,
  	lgE: lgE,
  	lHar: lHar,
  	lhard: lhard,
  	lharu: lharu,
  	lharul: lharul,
  	lhblk: lhblk,
  	LJcy: LJcy,
  	ljcy: ljcy,
  	llarr: llarr,
  	ll: ll,
  	Ll: Ll,
  	llcorner: llcorner,
  	Lleftarrow: Lleftarrow,
  	llhard: llhard,
  	lltri: lltri,
  	Lmidot: Lmidot,
  	lmidot: lmidot,
  	lmoustache: lmoustache,
  	lmoust: lmoust,
  	lnap: lnap,
  	lnapprox: lnapprox,
  	lne: lne,
  	lnE: lnE,
  	lneq: lneq,
  	lneqq: lneqq,
  	lnsim: lnsim,
  	loang: loang,
  	loarr: loarr,
  	lobrk: lobrk,
  	longleftarrow: longleftarrow,
  	LongLeftArrow: LongLeftArrow,
  	Longleftarrow: Longleftarrow,
  	longleftrightarrow: longleftrightarrow,
  	LongLeftRightArrow: LongLeftRightArrow,
  	Longleftrightarrow: Longleftrightarrow,
  	longmapsto: longmapsto,
  	longrightarrow: longrightarrow,
  	LongRightArrow: LongRightArrow,
  	Longrightarrow: Longrightarrow,
  	looparrowleft: looparrowleft,
  	looparrowright: looparrowright,
  	lopar: lopar,
  	Lopf: Lopf,
  	lopf: lopf,
  	loplus: loplus,
  	lotimes: lotimes,
  	lowast: lowast,
  	lowbar: lowbar,
  	LowerLeftArrow: LowerLeftArrow,
  	LowerRightArrow: LowerRightArrow,
  	loz: loz,
  	lozenge: lozenge,
  	lozf: lozf,
  	lpar: lpar,
  	lparlt: lparlt,
  	lrarr: lrarr,
  	lrcorner: lrcorner,
  	lrhar: lrhar,
  	lrhard: lrhard,
  	lrm: lrm,
  	lrtri: lrtri,
  	lsaquo: lsaquo,
  	lscr: lscr,
  	Lscr: Lscr,
  	lsh: lsh,
  	Lsh: Lsh,
  	lsim: lsim,
  	lsime: lsime,
  	lsimg: lsimg,
  	lsqb: lsqb,
  	lsquo: lsquo,
  	lsquor: lsquor,
  	Lstrok: Lstrok,
  	lstrok: lstrok,
  	ltcc: ltcc,
  	ltcir: ltcir,
  	lt: lt,
  	LT: LT,
  	Lt: Lt,
  	ltdot: ltdot,
  	lthree: lthree,
  	ltimes: ltimes,
  	ltlarr: ltlarr,
  	ltquest: ltquest,
  	ltri: ltri,
  	ltrie: ltrie,
  	ltrif: ltrif,
  	ltrPar: ltrPar,
  	lurdshar: lurdshar,
  	luruhar: luruhar,
  	lvertneqq: lvertneqq,
  	lvnE: lvnE,
  	macr: macr,
  	male: male,
  	malt: malt,
  	maltese: maltese,
  	"Map": "⤅",
  	map: map,
  	mapsto: mapsto,
  	mapstodown: mapstodown,
  	mapstoleft: mapstoleft,
  	mapstoup: mapstoup,
  	marker: marker,
  	mcomma: mcomma,
  	Mcy: Mcy,
  	mcy: mcy,
  	mdash: mdash,
  	mDDot: mDDot,
  	measuredangle: measuredangle,
  	MediumSpace: MediumSpace,
  	Mellintrf: Mellintrf,
  	Mfr: Mfr,
  	mfr: mfr,
  	mho: mho,
  	micro: micro,
  	midast: midast,
  	midcir: midcir,
  	mid: mid,
  	middot: middot,
  	minusb: minusb,
  	minus: minus,
  	minusd: minusd,
  	minusdu: minusdu,
  	MinusPlus: MinusPlus,
  	mlcp: mlcp,
  	mldr: mldr,
  	mnplus: mnplus,
  	models: models,
  	Mopf: Mopf,
  	mopf: mopf,
  	mp: mp,
  	mscr: mscr,
  	Mscr: Mscr,
  	mstpos: mstpos,
  	Mu: Mu,
  	mu: mu,
  	multimap: multimap,
  	mumap: mumap,
  	nabla: nabla,
  	Nacute: Nacute,
  	nacute: nacute,
  	nang: nang,
  	nap: nap,
  	napE: napE,
  	napid: napid,
  	napos: napos,
  	napprox: napprox,
  	natural: natural,
  	naturals: naturals,
  	natur: natur,
  	nbsp: nbsp,
  	nbump: nbump,
  	nbumpe: nbumpe,
  	ncap: ncap,
  	Ncaron: Ncaron,
  	ncaron: ncaron,
  	Ncedil: Ncedil,
  	ncedil: ncedil,
  	ncong: ncong,
  	ncongdot: ncongdot,
  	ncup: ncup,
  	Ncy: Ncy,
  	ncy: ncy,
  	ndash: ndash,
  	nearhk: nearhk,
  	nearr: nearr,
  	neArr: neArr,
  	nearrow: nearrow,
  	ne: ne,
  	nedot: nedot,
  	NegativeMediumSpace: NegativeMediumSpace,
  	NegativeThickSpace: NegativeThickSpace,
  	NegativeThinSpace: NegativeThinSpace,
  	NegativeVeryThinSpace: NegativeVeryThinSpace,
  	nequiv: nequiv,
  	nesear: nesear,
  	nesim: nesim,
  	NestedGreaterGreater: NestedGreaterGreater,
  	NestedLessLess: NestedLessLess,
  	NewLine: NewLine,
  	nexist: nexist,
  	nexists: nexists,
  	Nfr: Nfr,
  	nfr: nfr,
  	ngE: ngE,
  	nge: nge,
  	ngeq: ngeq,
  	ngeqq: ngeqq,
  	ngeqslant: ngeqslant,
  	nges: nges,
  	nGg: nGg,
  	ngsim: ngsim,
  	nGt: nGt,
  	ngt: ngt,
  	ngtr: ngtr,
  	nGtv: nGtv,
  	nharr: nharr,
  	nhArr: nhArr,
  	nhpar: nhpar,
  	ni: ni,
  	nis: nis,
  	nisd: nisd,
  	niv: niv,
  	NJcy: NJcy,
  	njcy: njcy,
  	nlarr: nlarr,
  	nlArr: nlArr,
  	nldr: nldr,
  	nlE: nlE,
  	nle: nle,
  	nleftarrow: nleftarrow,
  	nLeftarrow: nLeftarrow,
  	nleftrightarrow: nleftrightarrow,
  	nLeftrightarrow: nLeftrightarrow,
  	nleq: nleq,
  	nleqq: nleqq,
  	nleqslant: nleqslant,
  	nles: nles,
  	nless: nless,
  	nLl: nLl,
  	nlsim: nlsim,
  	nLt: nLt,
  	nlt: nlt,
  	nltri: nltri,
  	nltrie: nltrie,
  	nLtv: nLtv,
  	nmid: nmid,
  	NoBreak: NoBreak,
  	NonBreakingSpace: NonBreakingSpace,
  	nopf: nopf,
  	Nopf: Nopf,
  	Not: Not,
  	not: not,
  	NotCongruent: NotCongruent,
  	NotCupCap: NotCupCap,
  	NotDoubleVerticalBar: NotDoubleVerticalBar,
  	NotElement: NotElement,
  	NotEqual: NotEqual,
  	NotEqualTilde: NotEqualTilde,
  	NotExists: NotExists,
  	NotGreater: NotGreater,
  	NotGreaterEqual: NotGreaterEqual,
  	NotGreaterFullEqual: NotGreaterFullEqual,
  	NotGreaterGreater: NotGreaterGreater,
  	NotGreaterLess: NotGreaterLess,
  	NotGreaterSlantEqual: NotGreaterSlantEqual,
  	NotGreaterTilde: NotGreaterTilde,
  	NotHumpDownHump: NotHumpDownHump,
  	NotHumpEqual: NotHumpEqual,
  	notin: notin,
  	notindot: notindot,
  	notinE: notinE,
  	notinva: notinva,
  	notinvb: notinvb,
  	notinvc: notinvc,
  	NotLeftTriangleBar: NotLeftTriangleBar,
  	NotLeftTriangle: NotLeftTriangle,
  	NotLeftTriangleEqual: NotLeftTriangleEqual,
  	NotLess: NotLess,
  	NotLessEqual: NotLessEqual,
  	NotLessGreater: NotLessGreater,
  	NotLessLess: NotLessLess,
  	NotLessSlantEqual: NotLessSlantEqual,
  	NotLessTilde: NotLessTilde,
  	NotNestedGreaterGreater: NotNestedGreaterGreater,
  	NotNestedLessLess: NotNestedLessLess,
  	notni: notni,
  	notniva: notniva,
  	notnivb: notnivb,
  	notnivc: notnivc,
  	NotPrecedes: NotPrecedes,
  	NotPrecedesEqual: NotPrecedesEqual,
  	NotPrecedesSlantEqual: NotPrecedesSlantEqual,
  	NotReverseElement: NotReverseElement,
  	NotRightTriangleBar: NotRightTriangleBar,
  	NotRightTriangle: NotRightTriangle,
  	NotRightTriangleEqual: NotRightTriangleEqual,
  	NotSquareSubset: NotSquareSubset,
  	NotSquareSubsetEqual: NotSquareSubsetEqual,
  	NotSquareSuperset: NotSquareSuperset,
  	NotSquareSupersetEqual: NotSquareSupersetEqual,
  	NotSubset: NotSubset,
  	NotSubsetEqual: NotSubsetEqual,
  	NotSucceeds: NotSucceeds,
  	NotSucceedsEqual: NotSucceedsEqual,
  	NotSucceedsSlantEqual: NotSucceedsSlantEqual,
  	NotSucceedsTilde: NotSucceedsTilde,
  	NotSuperset: NotSuperset,
  	NotSupersetEqual: NotSupersetEqual,
  	NotTilde: NotTilde,
  	NotTildeEqual: NotTildeEqual,
  	NotTildeFullEqual: NotTildeFullEqual,
  	NotTildeTilde: NotTildeTilde,
  	NotVerticalBar: NotVerticalBar,
  	nparallel: nparallel,
  	npar: npar,
  	nparsl: nparsl,
  	npart: npart,
  	npolint: npolint,
  	npr: npr,
  	nprcue: nprcue,
  	nprec: nprec,
  	npreceq: npreceq,
  	npre: npre,
  	nrarrc: nrarrc,
  	nrarr: nrarr,
  	nrArr: nrArr,
  	nrarrw: nrarrw,
  	nrightarrow: nrightarrow,
  	nRightarrow: nRightarrow,
  	nrtri: nrtri,
  	nrtrie: nrtrie,
  	nsc: nsc,
  	nsccue: nsccue,
  	nsce: nsce,
  	Nscr: Nscr,
  	nscr: nscr,
  	nshortmid: nshortmid,
  	nshortparallel: nshortparallel,
  	nsim: nsim,
  	nsime: nsime,
  	nsimeq: nsimeq,
  	nsmid: nsmid,
  	nspar: nspar,
  	nsqsube: nsqsube,
  	nsqsupe: nsqsupe,
  	nsub: nsub,
  	nsubE: nsubE,
  	nsube: nsube,
  	nsubset: nsubset,
  	nsubseteq: nsubseteq,
  	nsubseteqq: nsubseteqq,
  	nsucc: nsucc,
  	nsucceq: nsucceq,
  	nsup: nsup,
  	nsupE: nsupE,
  	nsupe: nsupe,
  	nsupset: nsupset,
  	nsupseteq: nsupseteq,
  	nsupseteqq: nsupseteqq,
  	ntgl: ntgl,
  	Ntilde: Ntilde,
  	ntilde: ntilde,
  	ntlg: ntlg,
  	ntriangleleft: ntriangleleft,
  	ntrianglelefteq: ntrianglelefteq,
  	ntriangleright: ntriangleright,
  	ntrianglerighteq: ntrianglerighteq,
  	Nu: Nu,
  	nu: nu,
  	num: num,
  	numero: numero,
  	numsp: numsp,
  	nvap: nvap,
  	nvdash: nvdash,
  	nvDash: nvDash,
  	nVdash: nVdash,
  	nVDash: nVDash,
  	nvge: nvge,
  	nvgt: nvgt,
  	nvHarr: nvHarr,
  	nvinfin: nvinfin,
  	nvlArr: nvlArr,
  	nvle: nvle,
  	nvlt: nvlt,
  	nvltrie: nvltrie,
  	nvrArr: nvrArr,
  	nvrtrie: nvrtrie,
  	nvsim: nvsim,
  	nwarhk: nwarhk,
  	nwarr: nwarr,
  	nwArr: nwArr,
  	nwarrow: nwarrow,
  	nwnear: nwnear,
  	Oacute: Oacute,
  	oacute: oacute,
  	oast: oast,
  	Ocirc: Ocirc,
  	ocirc: ocirc,
  	ocir: ocir,
  	Ocy: Ocy,
  	ocy: ocy,
  	odash: odash,
  	Odblac: Odblac,
  	odblac: odblac,
  	odiv: odiv,
  	odot: odot,
  	odsold: odsold,
  	OElig: OElig,
  	oelig: oelig,
  	ofcir: ofcir,
  	Ofr: Ofr,
  	ofr: ofr,
  	ogon: ogon,
  	Ograve: Ograve,
  	ograve: ograve,
  	ogt: ogt,
  	ohbar: ohbar,
  	ohm: ohm,
  	oint: oint,
  	olarr: olarr,
  	olcir: olcir,
  	olcross: olcross,
  	oline: oline,
  	olt: olt,
  	Omacr: Omacr,
  	omacr: omacr,
  	Omega: Omega,
  	omega: omega,
  	Omicron: Omicron,
  	omicron: omicron,
  	omid: omid,
  	ominus: ominus,
  	Oopf: Oopf,
  	oopf: oopf,
  	opar: opar,
  	OpenCurlyDoubleQuote: OpenCurlyDoubleQuote,
  	OpenCurlyQuote: OpenCurlyQuote,
  	operp: operp,
  	oplus: oplus,
  	orarr: orarr,
  	Or: Or,
  	or: or,
  	ord: ord,
  	order: order,
  	orderof: orderof,
  	ordf: ordf,
  	ordm: ordm,
  	origof: origof,
  	oror: oror,
  	orslope: orslope,
  	orv: orv,
  	oS: oS,
  	Oscr: Oscr,
  	oscr: oscr,
  	Oslash: Oslash,
  	oslash: oslash,
  	osol: osol,
  	Otilde: Otilde,
  	otilde: otilde,
  	otimesas: otimesas,
  	Otimes: Otimes,
  	otimes: otimes,
  	Ouml: Ouml,
  	ouml: ouml,
  	ovbar: ovbar,
  	OverBar: OverBar,
  	OverBrace: OverBrace,
  	OverBracket: OverBracket,
  	OverParenthesis: OverParenthesis,
  	para: para,
  	parallel: parallel,
  	par: par,
  	parsim: parsim,
  	parsl: parsl,
  	part: part,
  	PartialD: PartialD,
  	Pcy: Pcy,
  	pcy: pcy,
  	percnt: percnt,
  	period: period,
  	permil: permil,
  	perp: perp,
  	pertenk: pertenk,
  	Pfr: Pfr,
  	pfr: pfr,
  	Phi: Phi,
  	phi: phi,
  	phiv: phiv,
  	phmmat: phmmat,
  	phone: phone,
  	Pi: Pi,
  	pi: pi,
  	pitchfork: pitchfork,
  	piv: piv,
  	planck: planck,
  	planckh: planckh,
  	plankv: plankv,
  	plusacir: plusacir,
  	plusb: plusb,
  	pluscir: pluscir,
  	plus: plus,
  	plusdo: plusdo,
  	plusdu: plusdu,
  	pluse: pluse,
  	PlusMinus: PlusMinus,
  	plusmn: plusmn,
  	plussim: plussim,
  	plustwo: plustwo,
  	pm: pm,
  	Poincareplane: Poincareplane,
  	pointint: pointint,
  	popf: popf,
  	Popf: Popf,
  	pound: pound,
  	prap: prap,
  	Pr: Pr,
  	pr: pr,
  	prcue: prcue,
  	precapprox: precapprox,
  	prec: prec,
  	preccurlyeq: preccurlyeq,
  	Precedes: Precedes,
  	PrecedesEqual: PrecedesEqual,
  	PrecedesSlantEqual: PrecedesSlantEqual,
  	PrecedesTilde: PrecedesTilde,
  	preceq: preceq,
  	precnapprox: precnapprox,
  	precneqq: precneqq,
  	precnsim: precnsim,
  	pre: pre,
  	prE: prE,
  	precsim: precsim,
  	prime: prime,
  	Prime: Prime,
  	primes: primes,
  	prnap: prnap,
  	prnE: prnE,
  	prnsim: prnsim,
  	prod: prod,
  	Product: Product,
  	profalar: profalar,
  	profline: profline,
  	profsurf: profsurf,
  	prop: prop$1,
  	Proportional: Proportional,
  	Proportion: Proportion,
  	propto: propto,
  	prsim: prsim,
  	prurel: prurel,
  	Pscr: Pscr,
  	pscr: pscr,
  	Psi: Psi,
  	psi: psi,
  	puncsp: puncsp,
  	Qfr: Qfr,
  	qfr: qfr,
  	qint: qint,
  	qopf: qopf,
  	Qopf: Qopf,
  	qprime: qprime,
  	Qscr: Qscr,
  	qscr: qscr,
  	quaternions: quaternions,
  	quatint: quatint,
  	quest: quest,
  	questeq: questeq,
  	quot: quot,
  	QUOT: QUOT,
  	rAarr: rAarr,
  	race: race,
  	Racute: Racute,
  	racute: racute,
  	radic: radic,
  	raemptyv: raemptyv,
  	rang: rang,
  	Rang: Rang,
  	rangd: rangd,
  	range: range,
  	rangle: rangle,
  	raquo: raquo,
  	rarrap: rarrap,
  	rarrb: rarrb,
  	rarrbfs: rarrbfs,
  	rarrc: rarrc,
  	rarr: rarr,
  	Rarr: Rarr,
  	rArr: rArr,
  	rarrfs: rarrfs,
  	rarrhk: rarrhk,
  	rarrlp: rarrlp,
  	rarrpl: rarrpl,
  	rarrsim: rarrsim,
  	Rarrtl: Rarrtl,
  	rarrtl: rarrtl,
  	rarrw: rarrw,
  	ratail: ratail,
  	rAtail: rAtail,
  	ratio: ratio,
  	rationals: rationals,
  	rbarr: rbarr,
  	rBarr: rBarr,
  	RBarr: RBarr,
  	rbbrk: rbbrk,
  	rbrace: rbrace,
  	rbrack: rbrack,
  	rbrke: rbrke,
  	rbrksld: rbrksld,
  	rbrkslu: rbrkslu,
  	Rcaron: Rcaron,
  	rcaron: rcaron,
  	Rcedil: Rcedil,
  	rcedil: rcedil,
  	rceil: rceil,
  	rcub: rcub,
  	Rcy: Rcy,
  	rcy: rcy,
  	rdca: rdca,
  	rdldhar: rdldhar,
  	rdquo: rdquo,
  	rdquor: rdquor,
  	rdsh: rdsh,
  	real: real,
  	realine: realine,
  	realpart: realpart,
  	reals: reals,
  	Re: Re,
  	rect: rect,
  	reg: reg,
  	REG: REG,
  	ReverseElement: ReverseElement,
  	ReverseEquilibrium: ReverseEquilibrium,
  	ReverseUpEquilibrium: ReverseUpEquilibrium,
  	rfisht: rfisht,
  	rfloor: rfloor,
  	rfr: rfr,
  	Rfr: Rfr,
  	rHar: rHar,
  	rhard: rhard,
  	rharu: rharu,
  	rharul: rharul,
  	Rho: Rho,
  	rho: rho,
  	rhov: rhov,
  	RightAngleBracket: RightAngleBracket,
  	RightArrowBar: RightArrowBar,
  	rightarrow: rightarrow,
  	RightArrow: RightArrow,
  	Rightarrow: Rightarrow,
  	RightArrowLeftArrow: RightArrowLeftArrow,
  	rightarrowtail: rightarrowtail,
  	RightCeiling: RightCeiling,
  	RightDoubleBracket: RightDoubleBracket,
  	RightDownTeeVector: RightDownTeeVector,
  	RightDownVectorBar: RightDownVectorBar,
  	RightDownVector: RightDownVector,
  	RightFloor: RightFloor,
  	rightharpoondown: rightharpoondown,
  	rightharpoonup: rightharpoonup,
  	rightleftarrows: rightleftarrows,
  	rightleftharpoons: rightleftharpoons,
  	rightrightarrows: rightrightarrows,
  	rightsquigarrow: rightsquigarrow,
  	RightTeeArrow: RightTeeArrow,
  	RightTee: RightTee,
  	RightTeeVector: RightTeeVector,
  	rightthreetimes: rightthreetimes,
  	RightTriangleBar: RightTriangleBar,
  	RightTriangle: RightTriangle,
  	RightTriangleEqual: RightTriangleEqual,
  	RightUpDownVector: RightUpDownVector,
  	RightUpTeeVector: RightUpTeeVector,
  	RightUpVectorBar: RightUpVectorBar,
  	RightUpVector: RightUpVector,
  	RightVectorBar: RightVectorBar,
  	RightVector: RightVector,
  	ring: ring,
  	risingdotseq: risingdotseq,
  	rlarr: rlarr,
  	rlhar: rlhar,
  	rlm: rlm,
  	rmoustache: rmoustache,
  	rmoust: rmoust,
  	rnmid: rnmid,
  	roang: roang,
  	roarr: roarr,
  	robrk: robrk,
  	ropar: ropar,
  	ropf: ropf,
  	Ropf: Ropf,
  	roplus: roplus,
  	rotimes: rotimes,
  	RoundImplies: RoundImplies,
  	rpar: rpar,
  	rpargt: rpargt,
  	rppolint: rppolint,
  	rrarr: rrarr,
  	Rrightarrow: Rrightarrow,
  	rsaquo: rsaquo,
  	rscr: rscr,
  	Rscr: Rscr,
  	rsh: rsh,
  	Rsh: Rsh,
  	rsqb: rsqb,
  	rsquo: rsquo,
  	rsquor: rsquor,
  	rthree: rthree,
  	rtimes: rtimes,
  	rtri: rtri,
  	rtrie: rtrie,
  	rtrif: rtrif,
  	rtriltri: rtriltri,
  	RuleDelayed: RuleDelayed,
  	ruluhar: ruluhar,
  	rx: rx,
  	Sacute: Sacute,
  	sacute: sacute,
  	sbquo: sbquo,
  	scap: scap,
  	Scaron: Scaron,
  	scaron: scaron,
  	Sc: Sc,
  	sc: sc,
  	sccue: sccue,
  	sce: sce,
  	scE: scE,
  	Scedil: Scedil,
  	scedil: scedil,
  	Scirc: Scirc,
  	scirc: scirc,
  	scnap: scnap,
  	scnE: scnE,
  	scnsim: scnsim,
  	scpolint: scpolint,
  	scsim: scsim,
  	Scy: Scy,
  	scy: scy,
  	sdotb: sdotb,
  	sdot: sdot,
  	sdote: sdote,
  	searhk: searhk,
  	searr: searr,
  	seArr: seArr,
  	searrow: searrow,
  	sect: sect,
  	semi: semi,
  	seswar: seswar,
  	setminus: setminus,
  	setmn: setmn,
  	sext: sext,
  	Sfr: Sfr,
  	sfr: sfr,
  	sfrown: sfrown,
  	sharp: sharp,
  	SHCHcy: SHCHcy,
  	shchcy: shchcy,
  	SHcy: SHcy,
  	shcy: shcy,
  	ShortDownArrow: ShortDownArrow,
  	ShortLeftArrow: ShortLeftArrow,
  	shortmid: shortmid,
  	shortparallel: shortparallel,
  	ShortRightArrow: ShortRightArrow,
  	ShortUpArrow: ShortUpArrow,
  	shy: shy,
  	Sigma: Sigma,
  	sigma: sigma,
  	sigmaf: sigmaf,
  	sigmav: sigmav,
  	sim: sim,
  	simdot: simdot,
  	sime: sime,
  	simeq: simeq,
  	simg: simg,
  	simgE: simgE,
  	siml: siml,
  	simlE: simlE,
  	simne: simne,
  	simplus: simplus,
  	simrarr: simrarr,
  	slarr: slarr,
  	SmallCircle: SmallCircle,
  	smallsetminus: smallsetminus,
  	smashp: smashp,
  	smeparsl: smeparsl,
  	smid: smid,
  	smile: smile,
  	smt: smt,
  	smte: smte,
  	smtes: smtes,
  	SOFTcy: SOFTcy,
  	softcy: softcy,
  	solbar: solbar,
  	solb: solb,
  	sol: sol,
  	Sopf: Sopf,
  	sopf: sopf,
  	spades: spades,
  	spadesuit: spadesuit,
  	spar: spar,
  	sqcap: sqcap,
  	sqcaps: sqcaps,
  	sqcup: sqcup,
  	sqcups: sqcups,
  	Sqrt: Sqrt,
  	sqsub: sqsub,
  	sqsube: sqsube,
  	sqsubset: sqsubset,
  	sqsubseteq: sqsubseteq,
  	sqsup: sqsup,
  	sqsupe: sqsupe,
  	sqsupset: sqsupset,
  	sqsupseteq: sqsupseteq,
  	square: square,
  	Square: Square,
  	SquareIntersection: SquareIntersection,
  	SquareSubset: SquareSubset,
  	SquareSubsetEqual: SquareSubsetEqual,
  	SquareSuperset: SquareSuperset,
  	SquareSupersetEqual: SquareSupersetEqual,
  	SquareUnion: SquareUnion,
  	squarf: squarf,
  	squ: squ,
  	squf: squf,
  	srarr: srarr,
  	Sscr: Sscr,
  	sscr: sscr,
  	ssetmn: ssetmn,
  	ssmile: ssmile,
  	sstarf: sstarf,
  	Star: Star,
  	star: star,
  	starf: starf,
  	straightepsilon: straightepsilon,
  	straightphi: straightphi,
  	strns: strns,
  	sub: sub,
  	Sub: Sub,
  	subdot: subdot,
  	subE: subE,
  	sube: sube,
  	subedot: subedot,
  	submult: submult,
  	subnE: subnE,
  	subne: subne,
  	subplus: subplus,
  	subrarr: subrarr,
  	subset: subset,
  	Subset: Subset,
  	subseteq: subseteq,
  	subseteqq: subseteqq,
  	SubsetEqual: SubsetEqual,
  	subsetneq: subsetneq,
  	subsetneqq: subsetneqq,
  	subsim: subsim,
  	subsub: subsub,
  	subsup: subsup,
  	succapprox: succapprox,
  	succ: succ,
  	succcurlyeq: succcurlyeq,
  	Succeeds: Succeeds,
  	SucceedsEqual: SucceedsEqual,
  	SucceedsSlantEqual: SucceedsSlantEqual,
  	SucceedsTilde: SucceedsTilde,
  	succeq: succeq,
  	succnapprox: succnapprox,
  	succneqq: succneqq,
  	succnsim: succnsim,
  	succsim: succsim,
  	SuchThat: SuchThat,
  	sum: sum,
  	Sum: Sum,
  	sung: sung,
  	sup1: sup1,
  	sup2: sup2,
  	sup3: sup3,
  	sup: sup,
  	Sup: Sup,
  	supdot: supdot,
  	supdsub: supdsub,
  	supE: supE,
  	supe: supe,
  	supedot: supedot,
  	Superset: Superset,
  	SupersetEqual: SupersetEqual,
  	suphsol: suphsol,
  	suphsub: suphsub,
  	suplarr: suplarr,
  	supmult: supmult,
  	supnE: supnE,
  	supne: supne,
  	supplus: supplus,
  	supset: supset,
  	Supset: Supset,
  	supseteq: supseteq,
  	supseteqq: supseteqq,
  	supsetneq: supsetneq,
  	supsetneqq: supsetneqq,
  	supsim: supsim,
  	supsub: supsub,
  	supsup: supsup,
  	swarhk: swarhk,
  	swarr: swarr,
  	swArr: swArr,
  	swarrow: swarrow,
  	swnwar: swnwar,
  	szlig: szlig,
  	Tab: Tab,
  	target: target,
  	Tau: Tau,
  	tau: tau,
  	tbrk: tbrk,
  	Tcaron: Tcaron,
  	tcaron: tcaron,
  	Tcedil: Tcedil,
  	tcedil: tcedil,
  	Tcy: Tcy,
  	tcy: tcy,
  	tdot: tdot,
  	telrec: telrec,
  	Tfr: Tfr,
  	tfr: tfr,
  	there4: there4,
  	therefore: therefore,
  	Therefore: Therefore,
  	Theta: Theta,
  	theta: theta,
  	thetasym: thetasym,
  	thetav: thetav,
  	thickapprox: thickapprox,
  	thicksim: thicksim,
  	ThickSpace: ThickSpace,
  	ThinSpace: ThinSpace,
  	thinsp: thinsp,
  	thkap: thkap,
  	thksim: thksim,
  	THORN: THORN,
  	thorn: thorn,
  	tilde: tilde,
  	Tilde: Tilde,
  	TildeEqual: TildeEqual,
  	TildeFullEqual: TildeFullEqual,
  	TildeTilde: TildeTilde,
  	timesbar: timesbar,
  	timesb: timesb,
  	times: times,
  	timesd: timesd,
  	tint: tint,
  	toea: toea,
  	topbot: topbot,
  	topcir: topcir,
  	top: top,
  	Topf: Topf,
  	topf: topf,
  	topfork: topfork,
  	tosa: tosa,
  	tprime: tprime,
  	trade: trade,
  	TRADE: TRADE,
  	triangle: triangle,
  	triangledown: triangledown,
  	triangleleft: triangleleft,
  	trianglelefteq: trianglelefteq,
  	triangleq: triangleq,
  	triangleright: triangleright,
  	trianglerighteq: trianglerighteq,
  	tridot: tridot,
  	trie: trie,
  	triminus: triminus,
  	TripleDot: TripleDot,
  	triplus: triplus,
  	trisb: trisb,
  	tritime: tritime,
  	trpezium: trpezium,
  	Tscr: Tscr,
  	tscr: tscr,
  	TScy: TScy,
  	tscy: tscy,
  	TSHcy: TSHcy,
  	tshcy: tshcy,
  	Tstrok: Tstrok,
  	tstrok: tstrok,
  	twixt: twixt,
  	twoheadleftarrow: twoheadleftarrow,
  	twoheadrightarrow: twoheadrightarrow,
  	Uacute: Uacute,
  	uacute: uacute,
  	uarr: uarr,
  	Uarr: Uarr,
  	uArr: uArr,
  	Uarrocir: Uarrocir,
  	Ubrcy: Ubrcy,
  	ubrcy: ubrcy,
  	Ubreve: Ubreve,
  	ubreve: ubreve,
  	Ucirc: Ucirc,
  	ucirc: ucirc,
  	Ucy: Ucy,
  	ucy: ucy,
  	udarr: udarr,
  	Udblac: Udblac,
  	udblac: udblac,
  	udhar: udhar,
  	ufisht: ufisht,
  	Ufr: Ufr,
  	ufr: ufr,
  	Ugrave: Ugrave,
  	ugrave: ugrave,
  	uHar: uHar,
  	uharl: uharl,
  	uharr: uharr,
  	uhblk: uhblk,
  	ulcorn: ulcorn,
  	ulcorner: ulcorner,
  	ulcrop: ulcrop,
  	ultri: ultri,
  	Umacr: Umacr,
  	umacr: umacr,
  	uml: uml,
  	UnderBar: UnderBar,
  	UnderBrace: UnderBrace,
  	UnderBracket: UnderBracket,
  	UnderParenthesis: UnderParenthesis,
  	Union: Union,
  	UnionPlus: UnionPlus,
  	Uogon: Uogon,
  	uogon: uogon,
  	Uopf: Uopf,
  	uopf: uopf,
  	UpArrowBar: UpArrowBar,
  	uparrow: uparrow,
  	UpArrow: UpArrow,
  	Uparrow: Uparrow,
  	UpArrowDownArrow: UpArrowDownArrow,
  	updownarrow: updownarrow,
  	UpDownArrow: UpDownArrow,
  	Updownarrow: Updownarrow,
  	UpEquilibrium: UpEquilibrium,
  	upharpoonleft: upharpoonleft,
  	upharpoonright: upharpoonright,
  	uplus: uplus,
  	UpperLeftArrow: UpperLeftArrow,
  	UpperRightArrow: UpperRightArrow,
  	upsi: upsi,
  	Upsi: Upsi,
  	upsih: upsih,
  	Upsilon: Upsilon,
  	upsilon: upsilon,
  	UpTeeArrow: UpTeeArrow,
  	UpTee: UpTee,
  	upuparrows: upuparrows,
  	urcorn: urcorn,
  	urcorner: urcorner,
  	urcrop: urcrop,
  	Uring: Uring,
  	uring: uring,
  	urtri: urtri,
  	Uscr: Uscr,
  	uscr: uscr,
  	utdot: utdot,
  	Utilde: Utilde,
  	utilde: utilde,
  	utri: utri,
  	utrif: utrif,
  	uuarr: uuarr,
  	Uuml: Uuml,
  	uuml: uuml,
  	uwangle: uwangle,
  	vangrt: vangrt,
  	varepsilon: varepsilon,
  	varkappa: varkappa,
  	varnothing: varnothing,
  	varphi: varphi,
  	varpi: varpi,
  	varpropto: varpropto,
  	varr: varr,
  	vArr: vArr,
  	varrho: varrho,
  	varsigma: varsigma,
  	varsubsetneq: varsubsetneq,
  	varsubsetneqq: varsubsetneqq,
  	varsupsetneq: varsupsetneq,
  	varsupsetneqq: varsupsetneqq,
  	vartheta: vartheta,
  	vartriangleleft: vartriangleleft,
  	vartriangleright: vartriangleright,
  	vBar: vBar,
  	Vbar: Vbar,
  	vBarv: vBarv,
  	Vcy: Vcy,
  	vcy: vcy,
  	vdash: vdash,
  	vDash: vDash,
  	Vdash: Vdash,
  	VDash: VDash,
  	Vdashl: Vdashl,
  	veebar: veebar,
  	vee: vee,
  	Vee: Vee,
  	veeeq: veeeq,
  	vellip: vellip,
  	verbar: verbar,
  	Verbar: Verbar,
  	vert: vert,
  	Vert: Vert,
  	VerticalBar: VerticalBar,
  	VerticalLine: VerticalLine,
  	VerticalSeparator: VerticalSeparator,
  	VerticalTilde: VerticalTilde,
  	VeryThinSpace: VeryThinSpace,
  	Vfr: Vfr,
  	vfr: vfr,
  	vltri: vltri,
  	vnsub: vnsub,
  	vnsup: vnsup,
  	Vopf: Vopf,
  	vopf: vopf,
  	vprop: vprop,
  	vrtri: vrtri,
  	Vscr: Vscr,
  	vscr: vscr,
  	vsubnE: vsubnE,
  	vsubne: vsubne,
  	vsupnE: vsupnE,
  	vsupne: vsupne,
  	Vvdash: Vvdash,
  	vzigzag: vzigzag,
  	Wcirc: Wcirc,
  	wcirc: wcirc,
  	wedbar: wedbar,
  	wedge: wedge,
  	Wedge: Wedge,
  	wedgeq: wedgeq,
  	weierp: weierp,
  	Wfr: Wfr,
  	wfr: wfr,
  	Wopf: Wopf,
  	wopf: wopf,
  	wp: wp,
  	wr: wr,
  	wreath: wreath,
  	Wscr: Wscr,
  	wscr: wscr,
  	xcap: xcap,
  	xcirc: xcirc,
  	xcup: xcup,
  	xdtri: xdtri,
  	Xfr: Xfr,
  	xfr: xfr,
  	xharr: xharr,
  	xhArr: xhArr,
  	Xi: Xi,
  	xi: xi,
  	xlarr: xlarr,
  	xlArr: xlArr,
  	xmap: xmap,
  	xnis: xnis,
  	xodot: xodot,
  	Xopf: Xopf,
  	xopf: xopf,
  	xoplus: xoplus,
  	xotime: xotime,
  	xrarr: xrarr,
  	xrArr: xrArr,
  	Xscr: Xscr,
  	xscr: xscr,
  	xsqcup: xsqcup,
  	xuplus: xuplus,
  	xutri: xutri,
  	xvee: xvee,
  	xwedge: xwedge,
  	Yacute: Yacute,
  	yacute: yacute,
  	YAcy: YAcy,
  	yacy: yacy,
  	Ycirc: Ycirc,
  	ycirc: ycirc,
  	Ycy: Ycy,
  	ycy: ycy,
  	yen: yen,
  	Yfr: Yfr,
  	yfr: yfr,
  	YIcy: YIcy,
  	yicy: yicy,
  	Yopf: Yopf,
  	yopf: yopf,
  	Yscr: Yscr,
  	yscr: yscr,
  	YUcy: YUcy,
  	yucy: yucy,
  	yuml: yuml,
  	Yuml: Yuml,
  	Zacute: Zacute,
  	zacute: zacute,
  	Zcaron: Zcaron,
  	zcaron: zcaron,
  	Zcy: Zcy,
  	zcy: zcy,
  	Zdot: Zdot,
  	zdot: zdot,
  	zeetrf: zeetrf,
  	ZeroWidthSpace: ZeroWidthSpace,
  	Zeta: Zeta,
  	zeta: zeta,
  	zfr: zfr,
  	Zfr: Zfr,
  	ZHcy: ZHcy,
  	zhcy: zhcy,
  	zigrarr: zigrarr,
  	zopf: zopf,
  	Zopf: Zopf,
  	Zscr: Zscr,
  	zscr: zscr,
  	zwj: zwj,
  	zwnj: zwnj
  };

  var entities$1 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    Aacute: Aacute,
    aacute: aacute,
    Abreve: Abreve,
    abreve: abreve,
    ac: ac,
    acd: acd,
    acE: acE,
    Acirc: Acirc,
    acirc: acirc,
    acute: acute,
    Acy: Acy,
    acy: acy,
    AElig: AElig,
    aelig: aelig,
    af: af,
    Afr: Afr,
    afr: afr,
    Agrave: Agrave,
    agrave: agrave,
    alefsym: alefsym,
    aleph: aleph,
    Alpha: Alpha,
    alpha: alpha,
    Amacr: Amacr,
    amacr: amacr,
    amalg: amalg,
    amp: amp,
    AMP: AMP,
    andand: andand,
    And: And,
    and: and,
    andd: andd,
    andslope: andslope,
    andv: andv,
    ang: ang,
    ange: ange,
    angle: angle,
    angmsdaa: angmsdaa,
    angmsdab: angmsdab,
    angmsdac: angmsdac,
    angmsdad: angmsdad,
    angmsdae: angmsdae,
    angmsdaf: angmsdaf,
    angmsdag: angmsdag,
    angmsdah: angmsdah,
    angmsd: angmsd,
    angrt: angrt,
    angrtvb: angrtvb,
    angrtvbd: angrtvbd,
    angsph: angsph,
    angst: angst,
    angzarr: angzarr,
    Aogon: Aogon,
    aogon: aogon,
    Aopf: Aopf,
    aopf: aopf,
    apacir: apacir,
    ap: ap,
    apE: apE,
    ape: ape,
    apid: apid,
    apos: apos,
    ApplyFunction: ApplyFunction,
    approx: approx,
    approxeq: approxeq,
    Aring: Aring,
    aring: aring,
    Ascr: Ascr,
    ascr: ascr,
    Assign: Assign,
    ast: ast,
    asymp: asymp,
    asympeq: asympeq,
    Atilde: Atilde,
    atilde: atilde,
    Auml: Auml,
    auml: auml,
    awconint: awconint,
    awint: awint,
    backcong: backcong,
    backepsilon: backepsilon,
    backprime: backprime,
    backsim: backsim,
    backsimeq: backsimeq,
    Backslash: Backslash,
    Barv: Barv,
    barvee: barvee,
    barwed: barwed,
    Barwed: Barwed,
    barwedge: barwedge,
    bbrk: bbrk,
    bbrktbrk: bbrktbrk,
    bcong: bcong,
    Bcy: Bcy,
    bcy: bcy,
    bdquo: bdquo,
    becaus: becaus,
    because: because,
    Because: Because,
    bemptyv: bemptyv,
    bepsi: bepsi,
    bernou: bernou,
    Bernoullis: Bernoullis,
    Beta: Beta,
    beta: beta,
    beth: beth,
    between: between,
    Bfr: Bfr,
    bfr: bfr,
    bigcap: bigcap,
    bigcirc: bigcirc,
    bigcup: bigcup,
    bigodot: bigodot,
    bigoplus: bigoplus,
    bigotimes: bigotimes,
    bigsqcup: bigsqcup,
    bigstar: bigstar,
    bigtriangledown: bigtriangledown,
    bigtriangleup: bigtriangleup,
    biguplus: biguplus,
    bigvee: bigvee,
    bigwedge: bigwedge,
    bkarow: bkarow,
    blacklozenge: blacklozenge,
    blacksquare: blacksquare,
    blacktriangle: blacktriangle,
    blacktriangledown: blacktriangledown,
    blacktriangleleft: blacktriangleleft,
    blacktriangleright: blacktriangleright,
    blank: blank,
    blk12: blk12,
    blk14: blk14,
    blk34: blk34,
    block: block,
    bne: bne,
    bnequiv: bnequiv,
    bNot: bNot,
    bnot: bnot,
    Bopf: Bopf,
    bopf: bopf,
    bot: bot,
    bottom: bottom,
    bowtie: bowtie,
    boxbox: boxbox,
    boxdl: boxdl,
    boxdL: boxdL,
    boxDl: boxDl,
    boxDL: boxDL,
    boxdr: boxdr,
    boxdR: boxdR,
    boxDr: boxDr,
    boxDR: boxDR,
    boxh: boxh,
    boxH: boxH,
    boxhd: boxhd,
    boxHd: boxHd,
    boxhD: boxhD,
    boxHD: boxHD,
    boxhu: boxhu,
    boxHu: boxHu,
    boxhU: boxhU,
    boxHU: boxHU,
    boxminus: boxminus,
    boxplus: boxplus,
    boxtimes: boxtimes,
    boxul: boxul,
    boxuL: boxuL,
    boxUl: boxUl,
    boxUL: boxUL,
    boxur: boxur,
    boxuR: boxuR,
    boxUr: boxUr,
    boxUR: boxUR,
    boxv: boxv,
    boxV: boxV,
    boxvh: boxvh,
    boxvH: boxvH,
    boxVh: boxVh,
    boxVH: boxVH,
    boxvl: boxvl,
    boxvL: boxvL,
    boxVl: boxVl,
    boxVL: boxVL,
    boxvr: boxvr,
    boxvR: boxvR,
    boxVr: boxVr,
    boxVR: boxVR,
    bprime: bprime,
    breve: breve,
    Breve: Breve,
    brvbar: brvbar,
    bscr: bscr,
    Bscr: Bscr,
    bsemi: bsemi,
    bsim: bsim,
    bsime: bsime,
    bsolb: bsolb,
    bsol: bsol,
    bsolhsub: bsolhsub,
    bull: bull,
    bullet: bullet,
    bump: bump,
    bumpE: bumpE,
    bumpe: bumpe,
    Bumpeq: Bumpeq,
    bumpeq: bumpeq,
    Cacute: Cacute,
    cacute: cacute,
    capand: capand,
    capbrcup: capbrcup,
    capcap: capcap,
    cap: cap,
    Cap: Cap,
    capcup: capcup,
    capdot: capdot,
    CapitalDifferentialD: CapitalDifferentialD,
    caps: caps,
    caret: caret,
    caron: caron,
    Cayleys: Cayleys,
    ccaps: ccaps,
    Ccaron: Ccaron,
    ccaron: ccaron,
    Ccedil: Ccedil,
    ccedil: ccedil,
    Ccirc: Ccirc,
    ccirc: ccirc,
    Cconint: Cconint,
    ccups: ccups,
    ccupssm: ccupssm,
    Cdot: Cdot,
    cdot: cdot,
    cedil: cedil,
    Cedilla: Cedilla,
    cemptyv: cemptyv,
    cent: cent,
    centerdot: centerdot,
    CenterDot: CenterDot,
    cfr: cfr,
    Cfr: Cfr,
    CHcy: CHcy,
    chcy: chcy,
    check: check,
    checkmark: checkmark,
    Chi: Chi,
    chi: chi,
    circ: circ,
    circeq: circeq,
    circlearrowleft: circlearrowleft,
    circlearrowright: circlearrowright,
    circledast: circledast,
    circledcirc: circledcirc,
    circleddash: circleddash,
    CircleDot: CircleDot,
    circledR: circledR,
    circledS: circledS,
    CircleMinus: CircleMinus,
    CirclePlus: CirclePlus,
    CircleTimes: CircleTimes,
    cir: cir,
    cirE: cirE,
    cire: cire,
    cirfnint: cirfnint,
    cirmid: cirmid,
    cirscir: cirscir,
    ClockwiseContourIntegral: ClockwiseContourIntegral,
    CloseCurlyDoubleQuote: CloseCurlyDoubleQuote,
    CloseCurlyQuote: CloseCurlyQuote,
    clubs: clubs,
    clubsuit: clubsuit,
    colon: colon,
    Colon: Colon,
    Colone: Colone,
    colone: colone,
    coloneq: coloneq,
    comma: comma,
    commat: commat,
    comp: comp,
    compfn: compfn,
    complement: complement,
    complexes: complexes,
    cong: cong,
    congdot: congdot,
    Congruent: Congruent,
    conint: conint,
    Conint: Conint,
    ContourIntegral: ContourIntegral,
    copf: copf,
    Copf: Copf,
    coprod: coprod,
    Coproduct: Coproduct,
    copy: copy$1,
    COPY: COPY,
    copysr: copysr,
    CounterClockwiseContourIntegral: CounterClockwiseContourIntegral,
    crarr: crarr,
    cross: cross,
    Cross: Cross,
    Cscr: Cscr,
    cscr: cscr,
    csub: csub,
    csube: csube,
    csup: csup,
    csupe: csupe,
    ctdot: ctdot,
    cudarrl: cudarrl,
    cudarrr: cudarrr,
    cuepr: cuepr,
    cuesc: cuesc,
    cularr: cularr,
    cularrp: cularrp,
    cupbrcap: cupbrcap,
    cupcap: cupcap,
    CupCap: CupCap,
    cup: cup,
    Cup: Cup,
    cupcup: cupcup,
    cupdot: cupdot,
    cupor: cupor,
    cups: cups,
    curarr: curarr,
    curarrm: curarrm,
    curlyeqprec: curlyeqprec,
    curlyeqsucc: curlyeqsucc,
    curlyvee: curlyvee,
    curlywedge: curlywedge,
    curren: curren,
    curvearrowleft: curvearrowleft,
    curvearrowright: curvearrowright,
    cuvee: cuvee,
    cuwed: cuwed,
    cwconint: cwconint,
    cwint: cwint,
    cylcty: cylcty,
    dagger: dagger,
    Dagger: Dagger,
    daleth: daleth,
    darr: darr,
    Darr: Darr,
    dArr: dArr,
    dash: dash,
    Dashv: Dashv,
    dashv: dashv,
    dbkarow: dbkarow,
    dblac: dblac,
    Dcaron: Dcaron,
    dcaron: dcaron,
    Dcy: Dcy,
    dcy: dcy,
    ddagger: ddagger,
    ddarr: ddarr,
    DD: DD,
    dd: dd,
    DDotrahd: DDotrahd,
    ddotseq: ddotseq,
    deg: deg,
    Del: Del,
    Delta: Delta,
    delta: delta,
    demptyv: demptyv,
    dfisht: dfisht,
    Dfr: Dfr,
    dfr: dfr,
    dHar: dHar,
    dharl: dharl,
    dharr: dharr,
    DiacriticalAcute: DiacriticalAcute,
    DiacriticalDot: DiacriticalDot,
    DiacriticalDoubleAcute: DiacriticalDoubleAcute,
    DiacriticalGrave: DiacriticalGrave,
    DiacriticalTilde: DiacriticalTilde,
    diam: diam,
    diamond: diamond,
    Diamond: Diamond,
    diamondsuit: diamondsuit,
    diams: diams,
    die: die,
    DifferentialD: DifferentialD,
    digamma: digamma,
    disin: disin,
    div: div,
    divide: divide,
    divideontimes: divideontimes,
    divonx: divonx,
    DJcy: DJcy,
    djcy: djcy,
    dlcorn: dlcorn,
    dlcrop: dlcrop,
    dollar: dollar,
    Dopf: Dopf,
    dopf: dopf,
    Dot: Dot,
    dot: dot,
    DotDot: DotDot,
    doteq: doteq,
    doteqdot: doteqdot,
    DotEqual: DotEqual,
    dotminus: dotminus,
    dotplus: dotplus,
    dotsquare: dotsquare,
    doublebarwedge: doublebarwedge,
    DoubleContourIntegral: DoubleContourIntegral,
    DoubleDot: DoubleDot,
    DoubleDownArrow: DoubleDownArrow,
    DoubleLeftArrow: DoubleLeftArrow,
    DoubleLeftRightArrow: DoubleLeftRightArrow,
    DoubleLeftTee: DoubleLeftTee,
    DoubleLongLeftArrow: DoubleLongLeftArrow,
    DoubleLongLeftRightArrow: DoubleLongLeftRightArrow,
    DoubleLongRightArrow: DoubleLongRightArrow,
    DoubleRightArrow: DoubleRightArrow,
    DoubleRightTee: DoubleRightTee,
    DoubleUpArrow: DoubleUpArrow,
    DoubleUpDownArrow: DoubleUpDownArrow,
    DoubleVerticalBar: DoubleVerticalBar,
    DownArrowBar: DownArrowBar,
    downarrow: downarrow,
    DownArrow: DownArrow,
    Downarrow: Downarrow,
    DownArrowUpArrow: DownArrowUpArrow,
    DownBreve: DownBreve,
    downdownarrows: downdownarrows,
    downharpoonleft: downharpoonleft,
    downharpoonright: downharpoonright,
    DownLeftRightVector: DownLeftRightVector,
    DownLeftTeeVector: DownLeftTeeVector,
    DownLeftVectorBar: DownLeftVectorBar,
    DownLeftVector: DownLeftVector,
    DownRightTeeVector: DownRightTeeVector,
    DownRightVectorBar: DownRightVectorBar,
    DownRightVector: DownRightVector,
    DownTeeArrow: DownTeeArrow,
    DownTee: DownTee,
    drbkarow: drbkarow,
    drcorn: drcorn,
    drcrop: drcrop,
    Dscr: Dscr,
    dscr: dscr,
    DScy: DScy,
    dscy: dscy,
    dsol: dsol,
    Dstrok: Dstrok,
    dstrok: dstrok,
    dtdot: dtdot,
    dtri: dtri,
    dtrif: dtrif,
    duarr: duarr,
    duhar: duhar,
    dwangle: dwangle,
    DZcy: DZcy,
    dzcy: dzcy,
    dzigrarr: dzigrarr,
    Eacute: Eacute,
    eacute: eacute,
    easter: easter,
    Ecaron: Ecaron,
    ecaron: ecaron,
    Ecirc: Ecirc,
    ecirc: ecirc,
    ecir: ecir,
    ecolon: ecolon,
    Ecy: Ecy,
    ecy: ecy,
    eDDot: eDDot,
    Edot: Edot,
    edot: edot,
    eDot: eDot,
    ee: ee,
    efDot: efDot,
    Efr: Efr,
    efr: efr,
    eg: eg,
    Egrave: Egrave,
    egrave: egrave,
    egs: egs,
    egsdot: egsdot,
    el: el,
    Element: Element,
    elinters: elinters,
    ell: ell,
    els: els,
    elsdot: elsdot,
    Emacr: Emacr,
    emacr: emacr,
    empty: empty$1,
    emptyset: emptyset,
    EmptySmallSquare: EmptySmallSquare,
    emptyv: emptyv,
    EmptyVerySmallSquare: EmptyVerySmallSquare,
    emsp13: emsp13,
    emsp14: emsp14,
    emsp: emsp,
    ENG: ENG,
    eng: eng,
    ensp: ensp,
    Eogon: Eogon,
    eogon: eogon,
    Eopf: Eopf,
    eopf: eopf,
    epar: epar,
    eparsl: eparsl,
    eplus: eplus,
    epsi: epsi,
    Epsilon: Epsilon,
    epsilon: epsilon,
    epsiv: epsiv,
    eqcirc: eqcirc,
    eqcolon: eqcolon,
    eqsim: eqsim,
    eqslantgtr: eqslantgtr,
    eqslantless: eqslantless,
    Equal: Equal,
    equals: equals,
    EqualTilde: EqualTilde,
    equest: equest,
    Equilibrium: Equilibrium,
    equiv: equiv,
    equivDD: equivDD,
    eqvparsl: eqvparsl,
    erarr: erarr,
    erDot: erDot,
    escr: escr,
    Escr: Escr,
    esdot: esdot,
    Esim: Esim,
    esim: esim,
    Eta: Eta,
    eta: eta,
    ETH: ETH,
    eth: eth,
    Euml: Euml,
    euml: euml,
    euro: euro,
    excl: excl,
    exist: exist,
    Exists: Exists,
    expectation: expectation,
    exponentiale: exponentiale,
    ExponentialE: ExponentialE,
    fallingdotseq: fallingdotseq,
    Fcy: Fcy,
    fcy: fcy,
    female: female,
    ffilig: ffilig,
    fflig: fflig,
    ffllig: ffllig,
    Ffr: Ffr,
    ffr: ffr,
    filig: filig,
    FilledSmallSquare: FilledSmallSquare,
    FilledVerySmallSquare: FilledVerySmallSquare,
    fjlig: fjlig,
    flat: flat,
    fllig: fllig,
    fltns: fltns,
    fnof: fnof,
    Fopf: Fopf,
    fopf: fopf,
    forall: forall,
    ForAll: ForAll,
    fork: fork,
    forkv: forkv,
    Fouriertrf: Fouriertrf,
    fpartint: fpartint,
    frac12: frac12,
    frac13: frac13,
    frac14: frac14,
    frac15: frac15,
    frac16: frac16,
    frac18: frac18,
    frac23: frac23,
    frac25: frac25,
    frac34: frac34,
    frac35: frac35,
    frac38: frac38,
    frac45: frac45,
    frac56: frac56,
    frac58: frac58,
    frac78: frac78,
    frasl: frasl,
    frown: frown,
    fscr: fscr,
    Fscr: Fscr,
    gacute: gacute,
    Gamma: Gamma,
    gamma: gamma,
    Gammad: Gammad,
    gammad: gammad,
    gap: gap,
    Gbreve: Gbreve,
    gbreve: gbreve,
    Gcedil: Gcedil,
    Gcirc: Gcirc,
    gcirc: gcirc,
    Gcy: Gcy,
    gcy: gcy,
    Gdot: Gdot,
    gdot: gdot,
    ge: ge,
    gE: gE,
    gEl: gEl,
    gel: gel,
    geq: geq,
    geqq: geqq,
    geqslant: geqslant,
    gescc: gescc,
    ges: ges,
    gesdot: gesdot,
    gesdoto: gesdoto,
    gesdotol: gesdotol,
    gesl: gesl,
    gesles: gesles,
    Gfr: Gfr,
    gfr: gfr,
    gg: gg,
    Gg: Gg,
    ggg: ggg,
    gimel: gimel,
    GJcy: GJcy,
    gjcy: gjcy,
    gla: gla,
    gl: gl,
    glE: glE,
    glj: glj,
    gnap: gnap,
    gnapprox: gnapprox,
    gne: gne,
    gnE: gnE,
    gneq: gneq,
    gneqq: gneqq,
    gnsim: gnsim,
    Gopf: Gopf,
    gopf: gopf,
    grave: grave,
    GreaterEqual: GreaterEqual,
    GreaterEqualLess: GreaterEqualLess,
    GreaterFullEqual: GreaterFullEqual,
    GreaterGreater: GreaterGreater,
    GreaterLess: GreaterLess,
    GreaterSlantEqual: GreaterSlantEqual,
    GreaterTilde: GreaterTilde,
    Gscr: Gscr,
    gscr: gscr,
    gsim: gsim,
    gsime: gsime,
    gsiml: gsiml,
    gtcc: gtcc,
    gtcir: gtcir,
    gt: gt,
    GT: GT,
    Gt: Gt,
    gtdot: gtdot,
    gtlPar: gtlPar,
    gtquest: gtquest,
    gtrapprox: gtrapprox,
    gtrarr: gtrarr,
    gtrdot: gtrdot,
    gtreqless: gtreqless,
    gtreqqless: gtreqqless,
    gtrless: gtrless,
    gtrsim: gtrsim,
    gvertneqq: gvertneqq,
    gvnE: gvnE,
    Hacek: Hacek,
    hairsp: hairsp,
    half: half,
    hamilt: hamilt,
    HARDcy: HARDcy,
    hardcy: hardcy,
    harrcir: harrcir,
    harr: harr,
    hArr: hArr,
    harrw: harrw,
    Hat: Hat,
    hbar: hbar,
    Hcirc: Hcirc,
    hcirc: hcirc,
    hearts: hearts,
    heartsuit: heartsuit,
    hellip: hellip,
    hercon: hercon,
    hfr: hfr,
    Hfr: Hfr,
    HilbertSpace: HilbertSpace,
    hksearow: hksearow,
    hkswarow: hkswarow,
    hoarr: hoarr,
    homtht: homtht,
    hookleftarrow: hookleftarrow,
    hookrightarrow: hookrightarrow,
    hopf: hopf,
    Hopf: Hopf,
    horbar: horbar,
    HorizontalLine: HorizontalLine,
    hscr: hscr,
    Hscr: Hscr,
    hslash: hslash,
    Hstrok: Hstrok,
    hstrok: hstrok,
    HumpDownHump: HumpDownHump,
    HumpEqual: HumpEqual,
    hybull: hybull,
    hyphen: hyphen,
    Iacute: Iacute,
    iacute: iacute,
    ic: ic,
    Icirc: Icirc,
    icirc: icirc,
    Icy: Icy,
    icy: icy,
    Idot: Idot,
    IEcy: IEcy,
    iecy: iecy,
    iexcl: iexcl,
    iff: iff,
    ifr: ifr,
    Ifr: Ifr,
    Igrave: Igrave,
    igrave: igrave,
    ii: ii,
    iiiint: iiiint,
    iiint: iiint,
    iinfin: iinfin,
    iiota: iiota,
    IJlig: IJlig,
    ijlig: ijlig,
    Imacr: Imacr,
    imacr: imacr,
    image: image,
    ImaginaryI: ImaginaryI,
    imagline: imagline,
    imagpart: imagpart,
    imath: imath,
    Im: Im,
    imof: imof,
    imped: imped,
    Implies: Implies,
    incare: incare,
    infin: infin,
    infintie: infintie,
    inodot: inodot,
    intcal: intcal,
    int: int,
    Int: Int,
    integers: integers,
    Integral: Integral,
    intercal: intercal,
    Intersection: Intersection,
    intlarhk: intlarhk,
    intprod: intprod,
    InvisibleComma: InvisibleComma,
    InvisibleTimes: InvisibleTimes,
    IOcy: IOcy,
    iocy: iocy,
    Iogon: Iogon,
    iogon: iogon,
    Iopf: Iopf,
    iopf: iopf,
    Iota: Iota,
    iota: iota,
    iprod: iprod,
    iquest: iquest,
    iscr: iscr,
    Iscr: Iscr,
    isin: isin,
    isindot: isindot,
    isinE: isinE,
    isins: isins,
    isinsv: isinsv,
    isinv: isinv,
    it: it,
    Itilde: Itilde,
    itilde: itilde,
    Iukcy: Iukcy,
    iukcy: iukcy,
    Iuml: Iuml,
    iuml: iuml,
    Jcirc: Jcirc,
    jcirc: jcirc,
    Jcy: Jcy,
    jcy: jcy,
    Jfr: Jfr,
    jfr: jfr,
    jmath: jmath,
    Jopf: Jopf,
    jopf: jopf,
    Jscr: Jscr,
    jscr: jscr,
    Jsercy: Jsercy,
    jsercy: jsercy,
    Jukcy: Jukcy,
    jukcy: jukcy,
    Kappa: Kappa,
    kappa: kappa,
    kappav: kappav,
    Kcedil: Kcedil,
    kcedil: kcedil,
    Kcy: Kcy,
    kcy: kcy,
    Kfr: Kfr,
    kfr: kfr,
    kgreen: kgreen,
    KHcy: KHcy,
    khcy: khcy,
    KJcy: KJcy,
    kjcy: kjcy,
    Kopf: Kopf,
    kopf: kopf,
    Kscr: Kscr,
    kscr: kscr,
    lAarr: lAarr,
    Lacute: Lacute,
    lacute: lacute,
    laemptyv: laemptyv,
    lagran: lagran,
    Lambda: Lambda,
    lambda: lambda,
    lang: lang,
    Lang: Lang,
    langd: langd,
    langle: langle,
    lap: lap,
    Laplacetrf: Laplacetrf,
    laquo: laquo,
    larrb: larrb,
    larrbfs: larrbfs,
    larr: larr,
    Larr: Larr,
    lArr: lArr,
    larrfs: larrfs,
    larrhk: larrhk,
    larrlp: larrlp,
    larrpl: larrpl,
    larrsim: larrsim,
    larrtl: larrtl,
    latail: latail,
    lAtail: lAtail,
    lat: lat,
    late: late,
    lates: lates,
    lbarr: lbarr,
    lBarr: lBarr,
    lbbrk: lbbrk,
    lbrace: lbrace,
    lbrack: lbrack,
    lbrke: lbrke,
    lbrksld: lbrksld,
    lbrkslu: lbrkslu,
    Lcaron: Lcaron,
    lcaron: lcaron,
    Lcedil: Lcedil,
    lcedil: lcedil,
    lceil: lceil,
    lcub: lcub,
    Lcy: Lcy,
    lcy: lcy,
    ldca: ldca,
    ldquo: ldquo,
    ldquor: ldquor,
    ldrdhar: ldrdhar,
    ldrushar: ldrushar,
    ldsh: ldsh,
    le: le,
    lE: lE,
    LeftAngleBracket: LeftAngleBracket,
    LeftArrowBar: LeftArrowBar,
    leftarrow: leftarrow,
    LeftArrow: LeftArrow,
    Leftarrow: Leftarrow,
    LeftArrowRightArrow: LeftArrowRightArrow,
    leftarrowtail: leftarrowtail,
    LeftCeiling: LeftCeiling,
    LeftDoubleBracket: LeftDoubleBracket,
    LeftDownTeeVector: LeftDownTeeVector,
    LeftDownVectorBar: LeftDownVectorBar,
    LeftDownVector: LeftDownVector,
    LeftFloor: LeftFloor,
    leftharpoondown: leftharpoondown,
    leftharpoonup: leftharpoonup,
    leftleftarrows: leftleftarrows,
    leftrightarrow: leftrightarrow,
    LeftRightArrow: LeftRightArrow,
    Leftrightarrow: Leftrightarrow,
    leftrightarrows: leftrightarrows,
    leftrightharpoons: leftrightharpoons,
    leftrightsquigarrow: leftrightsquigarrow,
    LeftRightVector: LeftRightVector,
    LeftTeeArrow: LeftTeeArrow,
    LeftTee: LeftTee,
    LeftTeeVector: LeftTeeVector,
    leftthreetimes: leftthreetimes,
    LeftTriangleBar: LeftTriangleBar,
    LeftTriangle: LeftTriangle,
    LeftTriangleEqual: LeftTriangleEqual,
    LeftUpDownVector: LeftUpDownVector,
    LeftUpTeeVector: LeftUpTeeVector,
    LeftUpVectorBar: LeftUpVectorBar,
    LeftUpVector: LeftUpVector,
    LeftVectorBar: LeftVectorBar,
    LeftVector: LeftVector,
    lEg: lEg,
    leg: leg,
    leq: leq,
    leqq: leqq,
    leqslant: leqslant,
    lescc: lescc,
    les: les,
    lesdot: lesdot,
    lesdoto: lesdoto,
    lesdotor: lesdotor,
    lesg: lesg,
    lesges: lesges,
    lessapprox: lessapprox,
    lessdot: lessdot,
    lesseqgtr: lesseqgtr,
    lesseqqgtr: lesseqqgtr,
    LessEqualGreater: LessEqualGreater,
    LessFullEqual: LessFullEqual,
    LessGreater: LessGreater,
    lessgtr: lessgtr,
    LessLess: LessLess,
    lesssim: lesssim,
    LessSlantEqual: LessSlantEqual,
    LessTilde: LessTilde,
    lfisht: lfisht,
    lfloor: lfloor,
    Lfr: Lfr,
    lfr: lfr,
    lg: lg,
    lgE: lgE,
    lHar: lHar,
    lhard: lhard,
    lharu: lharu,
    lharul: lharul,
    lhblk: lhblk,
    LJcy: LJcy,
    ljcy: ljcy,
    llarr: llarr,
    ll: ll,
    Ll: Ll,
    llcorner: llcorner,
    Lleftarrow: Lleftarrow,
    llhard: llhard,
    lltri: lltri,
    Lmidot: Lmidot,
    lmidot: lmidot,
    lmoustache: lmoustache,
    lmoust: lmoust,
    lnap: lnap,
    lnapprox: lnapprox,
    lne: lne,
    lnE: lnE,
    lneq: lneq,
    lneqq: lneqq,
    lnsim: lnsim,
    loang: loang,
    loarr: loarr,
    lobrk: lobrk,
    longleftarrow: longleftarrow,
    LongLeftArrow: LongLeftArrow,
    Longleftarrow: Longleftarrow,
    longleftrightarrow: longleftrightarrow,
    LongLeftRightArrow: LongLeftRightArrow,
    Longleftrightarrow: Longleftrightarrow,
    longmapsto: longmapsto,
    longrightarrow: longrightarrow,
    LongRightArrow: LongRightArrow,
    Longrightarrow: Longrightarrow,
    looparrowleft: looparrowleft,
    looparrowright: looparrowright,
    lopar: lopar,
    Lopf: Lopf,
    lopf: lopf,
    loplus: loplus,
    lotimes: lotimes,
    lowast: lowast,
    lowbar: lowbar,
    LowerLeftArrow: LowerLeftArrow,
    LowerRightArrow: LowerRightArrow,
    loz: loz,
    lozenge: lozenge,
    lozf: lozf,
    lpar: lpar,
    lparlt: lparlt,
    lrarr: lrarr,
    lrcorner: lrcorner,
    lrhar: lrhar,
    lrhard: lrhard,
    lrm: lrm,
    lrtri: lrtri,
    lsaquo: lsaquo,
    lscr: lscr,
    Lscr: Lscr,
    lsh: lsh,
    Lsh: Lsh,
    lsim: lsim,
    lsime: lsime,
    lsimg: lsimg,
    lsqb: lsqb,
    lsquo: lsquo,
    lsquor: lsquor,
    Lstrok: Lstrok,
    lstrok: lstrok,
    ltcc: ltcc,
    ltcir: ltcir,
    lt: lt,
    LT: LT,
    Lt: Lt,
    ltdot: ltdot,
    lthree: lthree,
    ltimes: ltimes,
    ltlarr: ltlarr,
    ltquest: ltquest,
    ltri: ltri,
    ltrie: ltrie,
    ltrif: ltrif,
    ltrPar: ltrPar,
    lurdshar: lurdshar,
    luruhar: luruhar,
    lvertneqq: lvertneqq,
    lvnE: lvnE,
    macr: macr,
    male: male,
    malt: malt,
    maltese: maltese,
    map: map,
    mapsto: mapsto,
    mapstodown: mapstodown,
    mapstoleft: mapstoleft,
    mapstoup: mapstoup,
    marker: marker,
    mcomma: mcomma,
    Mcy: Mcy,
    mcy: mcy,
    mdash: mdash,
    mDDot: mDDot,
    measuredangle: measuredangle,
    MediumSpace: MediumSpace,
    Mellintrf: Mellintrf,
    Mfr: Mfr,
    mfr: mfr,
    mho: mho,
    micro: micro,
    midast: midast,
    midcir: midcir,
    mid: mid,
    middot: middot,
    minusb: minusb,
    minus: minus,
    minusd: minusd,
    minusdu: minusdu,
    MinusPlus: MinusPlus,
    mlcp: mlcp,
    mldr: mldr,
    mnplus: mnplus,
    models: models,
    Mopf: Mopf,
    mopf: mopf,
    mp: mp,
    mscr: mscr,
    Mscr: Mscr,
    mstpos: mstpos,
    Mu: Mu,
    mu: mu,
    multimap: multimap,
    mumap: mumap,
    nabla: nabla,
    Nacute: Nacute,
    nacute: nacute,
    nang: nang,
    nap: nap,
    napE: napE,
    napid: napid,
    napos: napos,
    napprox: napprox,
    natural: natural,
    naturals: naturals,
    natur: natur,
    nbsp: nbsp,
    nbump: nbump,
    nbumpe: nbumpe,
    ncap: ncap,
    Ncaron: Ncaron,
    ncaron: ncaron,
    Ncedil: Ncedil,
    ncedil: ncedil,
    ncong: ncong,
    ncongdot: ncongdot,
    ncup: ncup,
    Ncy: Ncy,
    ncy: ncy,
    ndash: ndash,
    nearhk: nearhk,
    nearr: nearr,
    neArr: neArr,
    nearrow: nearrow,
    ne: ne,
    nedot: nedot,
    NegativeMediumSpace: NegativeMediumSpace,
    NegativeThickSpace: NegativeThickSpace,
    NegativeThinSpace: NegativeThinSpace,
    NegativeVeryThinSpace: NegativeVeryThinSpace,
    nequiv: nequiv,
    nesear: nesear,
    nesim: nesim,
    NestedGreaterGreater: NestedGreaterGreater,
    NestedLessLess: NestedLessLess,
    NewLine: NewLine,
    nexist: nexist,
    nexists: nexists,
    Nfr: Nfr,
    nfr: nfr,
    ngE: ngE,
    nge: nge,
    ngeq: ngeq,
    ngeqq: ngeqq,
    ngeqslant: ngeqslant,
    nges: nges,
    nGg: nGg,
    ngsim: ngsim,
    nGt: nGt,
    ngt: ngt,
    ngtr: ngtr,
    nGtv: nGtv,
    nharr: nharr,
    nhArr: nhArr,
    nhpar: nhpar,
    ni: ni,
    nis: nis,
    nisd: nisd,
    niv: niv,
    NJcy: NJcy,
    njcy: njcy,
    nlarr: nlarr,
    nlArr: nlArr,
    nldr: nldr,
    nlE: nlE,
    nle: nle,
    nleftarrow: nleftarrow,
    nLeftarrow: nLeftarrow,
    nleftrightarrow: nleftrightarrow,
    nLeftrightarrow: nLeftrightarrow,
    nleq: nleq,
    nleqq: nleqq,
    nleqslant: nleqslant,
    nles: nles,
    nless: nless,
    nLl: nLl,
    nlsim: nlsim,
    nLt: nLt,
    nlt: nlt,
    nltri: nltri,
    nltrie: nltrie,
    nLtv: nLtv,
    nmid: nmid,
    NoBreak: NoBreak,
    NonBreakingSpace: NonBreakingSpace,
    nopf: nopf,
    Nopf: Nopf,
    Not: Not,
    not: not,
    NotCongruent: NotCongruent,
    NotCupCap: NotCupCap,
    NotDoubleVerticalBar: NotDoubleVerticalBar,
    NotElement: NotElement,
    NotEqual: NotEqual,
    NotEqualTilde: NotEqualTilde,
    NotExists: NotExists,
    NotGreater: NotGreater,
    NotGreaterEqual: NotGreaterEqual,
    NotGreaterFullEqual: NotGreaterFullEqual,
    NotGreaterGreater: NotGreaterGreater,
    NotGreaterLess: NotGreaterLess,
    NotGreaterSlantEqual: NotGreaterSlantEqual,
    NotGreaterTilde: NotGreaterTilde,
    NotHumpDownHump: NotHumpDownHump,
    NotHumpEqual: NotHumpEqual,
    notin: notin,
    notindot: notindot,
    notinE: notinE,
    notinva: notinva,
    notinvb: notinvb,
    notinvc: notinvc,
    NotLeftTriangleBar: NotLeftTriangleBar,
    NotLeftTriangle: NotLeftTriangle,
    NotLeftTriangleEqual: NotLeftTriangleEqual,
    NotLess: NotLess,
    NotLessEqual: NotLessEqual,
    NotLessGreater: NotLessGreater,
    NotLessLess: NotLessLess,
    NotLessSlantEqual: NotLessSlantEqual,
    NotLessTilde: NotLessTilde,
    NotNestedGreaterGreater: NotNestedGreaterGreater,
    NotNestedLessLess: NotNestedLessLess,
    notni: notni,
    notniva: notniva,
    notnivb: notnivb,
    notnivc: notnivc,
    NotPrecedes: NotPrecedes,
    NotPrecedesEqual: NotPrecedesEqual,
    NotPrecedesSlantEqual: NotPrecedesSlantEqual,
    NotReverseElement: NotReverseElement,
    NotRightTriangleBar: NotRightTriangleBar,
    NotRightTriangle: NotRightTriangle,
    NotRightTriangleEqual: NotRightTriangleEqual,
    NotSquareSubset: NotSquareSubset,
    NotSquareSubsetEqual: NotSquareSubsetEqual,
    NotSquareSuperset: NotSquareSuperset,
    NotSquareSupersetEqual: NotSquareSupersetEqual,
    NotSubset: NotSubset,
    NotSubsetEqual: NotSubsetEqual,
    NotSucceeds: NotSucceeds,
    NotSucceedsEqual: NotSucceedsEqual,
    NotSucceedsSlantEqual: NotSucceedsSlantEqual,
    NotSucceedsTilde: NotSucceedsTilde,
    NotSuperset: NotSuperset,
    NotSupersetEqual: NotSupersetEqual,
    NotTilde: NotTilde,
    NotTildeEqual: NotTildeEqual,
    NotTildeFullEqual: NotTildeFullEqual,
    NotTildeTilde: NotTildeTilde,
    NotVerticalBar: NotVerticalBar,
    nparallel: nparallel,
    npar: npar,
    nparsl: nparsl,
    npart: npart,
    npolint: npolint,
    npr: npr,
    nprcue: nprcue,
    nprec: nprec,
    npreceq: npreceq,
    npre: npre,
    nrarrc: nrarrc,
    nrarr: nrarr,
    nrArr: nrArr,
    nrarrw: nrarrw,
    nrightarrow: nrightarrow,
    nRightarrow: nRightarrow,
    nrtri: nrtri,
    nrtrie: nrtrie,
    nsc: nsc,
    nsccue: nsccue,
    nsce: nsce,
    Nscr: Nscr,
    nscr: nscr,
    nshortmid: nshortmid,
    nshortparallel: nshortparallel,
    nsim: nsim,
    nsime: nsime,
    nsimeq: nsimeq,
    nsmid: nsmid,
    nspar: nspar,
    nsqsube: nsqsube,
    nsqsupe: nsqsupe,
    nsub: nsub,
    nsubE: nsubE,
    nsube: nsube,
    nsubset: nsubset,
    nsubseteq: nsubseteq,
    nsubseteqq: nsubseteqq,
    nsucc: nsucc,
    nsucceq: nsucceq,
    nsup: nsup,
    nsupE: nsupE,
    nsupe: nsupe,
    nsupset: nsupset,
    nsupseteq: nsupseteq,
    nsupseteqq: nsupseteqq,
    ntgl: ntgl,
    Ntilde: Ntilde,
    ntilde: ntilde,
    ntlg: ntlg,
    ntriangleleft: ntriangleleft,
    ntrianglelefteq: ntrianglelefteq,
    ntriangleright: ntriangleright,
    ntrianglerighteq: ntrianglerighteq,
    Nu: Nu,
    nu: nu,
    num: num,
    numero: numero,
    numsp: numsp,
    nvap: nvap,
    nvdash: nvdash,
    nvDash: nvDash,
    nVdash: nVdash,
    nVDash: nVDash,
    nvge: nvge,
    nvgt: nvgt,
    nvHarr: nvHarr,
    nvinfin: nvinfin,
    nvlArr: nvlArr,
    nvle: nvle,
    nvlt: nvlt,
    nvltrie: nvltrie,
    nvrArr: nvrArr,
    nvrtrie: nvrtrie,
    nvsim: nvsim,
    nwarhk: nwarhk,
    nwarr: nwarr,
    nwArr: nwArr,
    nwarrow: nwarrow,
    nwnear: nwnear,
    Oacute: Oacute,
    oacute: oacute,
    oast: oast,
    Ocirc: Ocirc,
    ocirc: ocirc,
    ocir: ocir,
    Ocy: Ocy,
    ocy: ocy,
    odash: odash,
    Odblac: Odblac,
    odblac: odblac,
    odiv: odiv,
    odot: odot,
    odsold: odsold,
    OElig: OElig,
    oelig: oelig,
    ofcir: ofcir,
    Ofr: Ofr,
    ofr: ofr,
    ogon: ogon,
    Ograve: Ograve,
    ograve: ograve,
    ogt: ogt,
    ohbar: ohbar,
    ohm: ohm,
    oint: oint,
    olarr: olarr,
    olcir: olcir,
    olcross: olcross,
    oline: oline,
    olt: olt,
    Omacr: Omacr,
    omacr: omacr,
    Omega: Omega,
    omega: omega,
    Omicron: Omicron,
    omicron: omicron,
    omid: omid,
    ominus: ominus,
    Oopf: Oopf,
    oopf: oopf,
    opar: opar,
    OpenCurlyDoubleQuote: OpenCurlyDoubleQuote,
    OpenCurlyQuote: OpenCurlyQuote,
    operp: operp,
    oplus: oplus,
    orarr: orarr,
    Or: Or,
    or: or,
    ord: ord,
    order: order,
    orderof: orderof,
    ordf: ordf,
    ordm: ordm,
    origof: origof,
    oror: oror,
    orslope: orslope,
    orv: orv,
    oS: oS,
    Oscr: Oscr,
    oscr: oscr,
    Oslash: Oslash,
    oslash: oslash,
    osol: osol,
    Otilde: Otilde,
    otilde: otilde,
    otimesas: otimesas,
    Otimes: Otimes,
    otimes: otimes,
    Ouml: Ouml,
    ouml: ouml,
    ovbar: ovbar,
    OverBar: OverBar,
    OverBrace: OverBrace,
    OverBracket: OverBracket,
    OverParenthesis: OverParenthesis,
    para: para,
    parallel: parallel,
    par: par,
    parsim: parsim,
    parsl: parsl,
    part: part,
    PartialD: PartialD,
    Pcy: Pcy,
    pcy: pcy,
    percnt: percnt,
    period: period,
    permil: permil,
    perp: perp,
    pertenk: pertenk,
    Pfr: Pfr,
    pfr: pfr,
    Phi: Phi,
    phi: phi,
    phiv: phiv,
    phmmat: phmmat,
    phone: phone,
    Pi: Pi,
    pi: pi,
    pitchfork: pitchfork,
    piv: piv,
    planck: planck,
    planckh: planckh,
    plankv: plankv,
    plusacir: plusacir,
    plusb: plusb,
    pluscir: pluscir,
    plus: plus,
    plusdo: plusdo,
    plusdu: plusdu,
    pluse: pluse,
    PlusMinus: PlusMinus,
    plusmn: plusmn,
    plussim: plussim,
    plustwo: plustwo,
    pm: pm,
    Poincareplane: Poincareplane,
    pointint: pointint,
    popf: popf,
    Popf: Popf,
    pound: pound,
    prap: prap,
    Pr: Pr,
    pr: pr,
    prcue: prcue,
    precapprox: precapprox,
    prec: prec,
    preccurlyeq: preccurlyeq,
    Precedes: Precedes,
    PrecedesEqual: PrecedesEqual,
    PrecedesSlantEqual: PrecedesSlantEqual,
    PrecedesTilde: PrecedesTilde,
    preceq: preceq,
    precnapprox: precnapprox,
    precneqq: precneqq,
    precnsim: precnsim,
    pre: pre,
    prE: prE,
    precsim: precsim,
    prime: prime,
    Prime: Prime,
    primes: primes,
    prnap: prnap,
    prnE: prnE,
    prnsim: prnsim,
    prod: prod,
    Product: Product,
    profalar: profalar,
    profline: profline,
    profsurf: profsurf,
    prop: prop$1,
    Proportional: Proportional,
    Proportion: Proportion,
    propto: propto,
    prsim: prsim,
    prurel: prurel,
    Pscr: Pscr,
    pscr: pscr,
    Psi: Psi,
    psi: psi,
    puncsp: puncsp,
    Qfr: Qfr,
    qfr: qfr,
    qint: qint,
    qopf: qopf,
    Qopf: Qopf,
    qprime: qprime,
    Qscr: Qscr,
    qscr: qscr,
    quaternions: quaternions,
    quatint: quatint,
    quest: quest,
    questeq: questeq,
    quot: quot,
    QUOT: QUOT,
    rAarr: rAarr,
    race: race,
    Racute: Racute,
    racute: racute,
    radic: radic,
    raemptyv: raemptyv,
    rang: rang,
    Rang: Rang,
    rangd: rangd,
    range: range,
    rangle: rangle,
    raquo: raquo,
    rarrap: rarrap,
    rarrb: rarrb,
    rarrbfs: rarrbfs,
    rarrc: rarrc,
    rarr: rarr,
    Rarr: Rarr,
    rArr: rArr,
    rarrfs: rarrfs,
    rarrhk: rarrhk,
    rarrlp: rarrlp,
    rarrpl: rarrpl,
    rarrsim: rarrsim,
    Rarrtl: Rarrtl,
    rarrtl: rarrtl,
    rarrw: rarrw,
    ratail: ratail,
    rAtail: rAtail,
    ratio: ratio,
    rationals: rationals,
    rbarr: rbarr,
    rBarr: rBarr,
    RBarr: RBarr,
    rbbrk: rbbrk,
    rbrace: rbrace,
    rbrack: rbrack,
    rbrke: rbrke,
    rbrksld: rbrksld,
    rbrkslu: rbrkslu,
    Rcaron: Rcaron,
    rcaron: rcaron,
    Rcedil: Rcedil,
    rcedil: rcedil,
    rceil: rceil,
    rcub: rcub,
    Rcy: Rcy,
    rcy: rcy,
    rdca: rdca,
    rdldhar: rdldhar,
    rdquo: rdquo,
    rdquor: rdquor,
    rdsh: rdsh,
    real: real,
    realine: realine,
    realpart: realpart,
    reals: reals,
    Re: Re,
    rect: rect,
    reg: reg,
    REG: REG,
    ReverseElement: ReverseElement,
    ReverseEquilibrium: ReverseEquilibrium,
    ReverseUpEquilibrium: ReverseUpEquilibrium,
    rfisht: rfisht,
    rfloor: rfloor,
    rfr: rfr,
    Rfr: Rfr,
    rHar: rHar,
    rhard: rhard,
    rharu: rharu,
    rharul: rharul,
    Rho: Rho,
    rho: rho,
    rhov: rhov,
    RightAngleBracket: RightAngleBracket,
    RightArrowBar: RightArrowBar,
    rightarrow: rightarrow,
    RightArrow: RightArrow,
    Rightarrow: Rightarrow,
    RightArrowLeftArrow: RightArrowLeftArrow,
    rightarrowtail: rightarrowtail,
    RightCeiling: RightCeiling,
    RightDoubleBracket: RightDoubleBracket,
    RightDownTeeVector: RightDownTeeVector,
    RightDownVectorBar: RightDownVectorBar,
    RightDownVector: RightDownVector,
    RightFloor: RightFloor,
    rightharpoondown: rightharpoondown,
    rightharpoonup: rightharpoonup,
    rightleftarrows: rightleftarrows,
    rightleftharpoons: rightleftharpoons,
    rightrightarrows: rightrightarrows,
    rightsquigarrow: rightsquigarrow,
    RightTeeArrow: RightTeeArrow,
    RightTee: RightTee,
    RightTeeVector: RightTeeVector,
    rightthreetimes: rightthreetimes,
    RightTriangleBar: RightTriangleBar,
    RightTriangle: RightTriangle,
    RightTriangleEqual: RightTriangleEqual,
    RightUpDownVector: RightUpDownVector,
    RightUpTeeVector: RightUpTeeVector,
    RightUpVectorBar: RightUpVectorBar,
    RightUpVector: RightUpVector,
    RightVectorBar: RightVectorBar,
    RightVector: RightVector,
    ring: ring,
    risingdotseq: risingdotseq,
    rlarr: rlarr,
    rlhar: rlhar,
    rlm: rlm,
    rmoustache: rmoustache,
    rmoust: rmoust,
    rnmid: rnmid,
    roang: roang,
    roarr: roarr,
    robrk: robrk,
    ropar: ropar,
    ropf: ropf,
    Ropf: Ropf,
    roplus: roplus,
    rotimes: rotimes,
    RoundImplies: RoundImplies,
    rpar: rpar,
    rpargt: rpargt,
    rppolint: rppolint,
    rrarr: rrarr,
    Rrightarrow: Rrightarrow,
    rsaquo: rsaquo,
    rscr: rscr,
    Rscr: Rscr,
    rsh: rsh,
    Rsh: Rsh,
    rsqb: rsqb,
    rsquo: rsquo,
    rsquor: rsquor,
    rthree: rthree,
    rtimes: rtimes,
    rtri: rtri,
    rtrie: rtrie,
    rtrif: rtrif,
    rtriltri: rtriltri,
    RuleDelayed: RuleDelayed,
    ruluhar: ruluhar,
    rx: rx,
    Sacute: Sacute,
    sacute: sacute,
    sbquo: sbquo,
    scap: scap,
    Scaron: Scaron,
    scaron: scaron,
    Sc: Sc,
    sc: sc,
    sccue: sccue,
    sce: sce,
    scE: scE,
    Scedil: Scedil,
    scedil: scedil,
    Scirc: Scirc,
    scirc: scirc,
    scnap: scnap,
    scnE: scnE,
    scnsim: scnsim,
    scpolint: scpolint,
    scsim: scsim,
    Scy: Scy,
    scy: scy,
    sdotb: sdotb,
    sdot: sdot,
    sdote: sdote,
    searhk: searhk,
    searr: searr,
    seArr: seArr,
    searrow: searrow,
    sect: sect,
    semi: semi,
    seswar: seswar,
    setminus: setminus,
    setmn: setmn,
    sext: sext,
    Sfr: Sfr,
    sfr: sfr,
    sfrown: sfrown,
    sharp: sharp,
    SHCHcy: SHCHcy,
    shchcy: shchcy,
    SHcy: SHcy,
    shcy: shcy,
    ShortDownArrow: ShortDownArrow,
    ShortLeftArrow: ShortLeftArrow,
    shortmid: shortmid,
    shortparallel: shortparallel,
    ShortRightArrow: ShortRightArrow,
    ShortUpArrow: ShortUpArrow,
    shy: shy,
    Sigma: Sigma,
    sigma: sigma,
    sigmaf: sigmaf,
    sigmav: sigmav,
    sim: sim,
    simdot: simdot,
    sime: sime,
    simeq: simeq,
    simg: simg,
    simgE: simgE,
    siml: siml,
    simlE: simlE,
    simne: simne,
    simplus: simplus,
    simrarr: simrarr,
    slarr: slarr,
    SmallCircle: SmallCircle,
    smallsetminus: smallsetminus,
    smashp: smashp,
    smeparsl: smeparsl,
    smid: smid,
    smile: smile,
    smt: smt,
    smte: smte,
    smtes: smtes,
    SOFTcy: SOFTcy,
    softcy: softcy,
    solbar: solbar,
    solb: solb,
    sol: sol,
    Sopf: Sopf,
    sopf: sopf,
    spades: spades,
    spadesuit: spadesuit,
    spar: spar,
    sqcap: sqcap,
    sqcaps: sqcaps,
    sqcup: sqcup,
    sqcups: sqcups,
    Sqrt: Sqrt,
    sqsub: sqsub,
    sqsube: sqsube,
    sqsubset: sqsubset,
    sqsubseteq: sqsubseteq,
    sqsup: sqsup,
    sqsupe: sqsupe,
    sqsupset: sqsupset,
    sqsupseteq: sqsupseteq,
    square: square,
    Square: Square,
    SquareIntersection: SquareIntersection,
    SquareSubset: SquareSubset,
    SquareSubsetEqual: SquareSubsetEqual,
    SquareSuperset: SquareSuperset,
    SquareSupersetEqual: SquareSupersetEqual,
    SquareUnion: SquareUnion,
    squarf: squarf,
    squ: squ,
    squf: squf,
    srarr: srarr,
    Sscr: Sscr,
    sscr: sscr,
    ssetmn: ssetmn,
    ssmile: ssmile,
    sstarf: sstarf,
    Star: Star,
    star: star,
    starf: starf,
    straightepsilon: straightepsilon,
    straightphi: straightphi,
    strns: strns,
    sub: sub,
    Sub: Sub,
    subdot: subdot,
    subE: subE,
    sube: sube,
    subedot: subedot,
    submult: submult,
    subnE: subnE,
    subne: subne,
    subplus: subplus,
    subrarr: subrarr,
    subset: subset,
    Subset: Subset,
    subseteq: subseteq,
    subseteqq: subseteqq,
    SubsetEqual: SubsetEqual,
    subsetneq: subsetneq,
    subsetneqq: subsetneqq,
    subsim: subsim,
    subsub: subsub,
    subsup: subsup,
    succapprox: succapprox,
    succ: succ,
    succcurlyeq: succcurlyeq,
    Succeeds: Succeeds,
    SucceedsEqual: SucceedsEqual,
    SucceedsSlantEqual: SucceedsSlantEqual,
    SucceedsTilde: SucceedsTilde,
    succeq: succeq,
    succnapprox: succnapprox,
    succneqq: succneqq,
    succnsim: succnsim,
    succsim: succsim,
    SuchThat: SuchThat,
    sum: sum,
    Sum: Sum,
    sung: sung,
    sup1: sup1,
    sup2: sup2,
    sup3: sup3,
    sup: sup,
    Sup: Sup,
    supdot: supdot,
    supdsub: supdsub,
    supE: supE,
    supe: supe,
    supedot: supedot,
    Superset: Superset,
    SupersetEqual: SupersetEqual,
    suphsol: suphsol,
    suphsub: suphsub,
    suplarr: suplarr,
    supmult: supmult,
    supnE: supnE,
    supne: supne,
    supplus: supplus,
    supset: supset,
    Supset: Supset,
    supseteq: supseteq,
    supseteqq: supseteqq,
    supsetneq: supsetneq,
    supsetneqq: supsetneqq,
    supsim: supsim,
    supsub: supsub,
    supsup: supsup,
    swarhk: swarhk,
    swarr: swarr,
    swArr: swArr,
    swarrow: swarrow,
    swnwar: swnwar,
    szlig: szlig,
    Tab: Tab,
    target: target,
    Tau: Tau,
    tau: tau,
    tbrk: tbrk,
    Tcaron: Tcaron,
    tcaron: tcaron,
    Tcedil: Tcedil,
    tcedil: tcedil,
    Tcy: Tcy,
    tcy: tcy,
    tdot: tdot,
    telrec: telrec,
    Tfr: Tfr,
    tfr: tfr,
    there4: there4,
    therefore: therefore,
    Therefore: Therefore,
    Theta: Theta,
    theta: theta,
    thetasym: thetasym,
    thetav: thetav,
    thickapprox: thickapprox,
    thicksim: thicksim,
    ThickSpace: ThickSpace,
    ThinSpace: ThinSpace,
    thinsp: thinsp,
    thkap: thkap,
    thksim: thksim,
    THORN: THORN,
    thorn: thorn,
    tilde: tilde,
    Tilde: Tilde,
    TildeEqual: TildeEqual,
    TildeFullEqual: TildeFullEqual,
    TildeTilde: TildeTilde,
    timesbar: timesbar,
    timesb: timesb,
    times: times,
    timesd: timesd,
    tint: tint,
    toea: toea,
    topbot: topbot,
    topcir: topcir,
    top: top,
    Topf: Topf,
    topf: topf,
    topfork: topfork,
    tosa: tosa,
    tprime: tprime,
    trade: trade,
    TRADE: TRADE,
    triangle: triangle,
    triangledown: triangledown,
    triangleleft: triangleleft,
    trianglelefteq: trianglelefteq,
    triangleq: triangleq,
    triangleright: triangleright,
    trianglerighteq: trianglerighteq,
    tridot: tridot,
    trie: trie,
    triminus: triminus,
    TripleDot: TripleDot,
    triplus: triplus,
    trisb: trisb,
    tritime: tritime,
    trpezium: trpezium,
    Tscr: Tscr,
    tscr: tscr,
    TScy: TScy,
    tscy: tscy,
    TSHcy: TSHcy,
    tshcy: tshcy,
    Tstrok: Tstrok,
    tstrok: tstrok,
    twixt: twixt,
    twoheadleftarrow: twoheadleftarrow,
    twoheadrightarrow: twoheadrightarrow,
    Uacute: Uacute,
    uacute: uacute,
    uarr: uarr,
    Uarr: Uarr,
    uArr: uArr,
    Uarrocir: Uarrocir,
    Ubrcy: Ubrcy,
    ubrcy: ubrcy,
    Ubreve: Ubreve,
    ubreve: ubreve,
    Ucirc: Ucirc,
    ucirc: ucirc,
    Ucy: Ucy,
    ucy: ucy,
    udarr: udarr,
    Udblac: Udblac,
    udblac: udblac,
    udhar: udhar,
    ufisht: ufisht,
    Ufr: Ufr,
    ufr: ufr,
    Ugrave: Ugrave,
    ugrave: ugrave,
    uHar: uHar,
    uharl: uharl,
    uharr: uharr,
    uhblk: uhblk,
    ulcorn: ulcorn,
    ulcorner: ulcorner,
    ulcrop: ulcrop,
    ultri: ultri,
    Umacr: Umacr,
    umacr: umacr,
    uml: uml,
    UnderBar: UnderBar,
    UnderBrace: UnderBrace,
    UnderBracket: UnderBracket,
    UnderParenthesis: UnderParenthesis,
    Union: Union,
    UnionPlus: UnionPlus,
    Uogon: Uogon,
    uogon: uogon,
    Uopf: Uopf,
    uopf: uopf,
    UpArrowBar: UpArrowBar,
    uparrow: uparrow,
    UpArrow: UpArrow,
    Uparrow: Uparrow,
    UpArrowDownArrow: UpArrowDownArrow,
    updownarrow: updownarrow,
    UpDownArrow: UpDownArrow,
    Updownarrow: Updownarrow,
    UpEquilibrium: UpEquilibrium,
    upharpoonleft: upharpoonleft,
    upharpoonright: upharpoonright,
    uplus: uplus,
    UpperLeftArrow: UpperLeftArrow,
    UpperRightArrow: UpperRightArrow,
    upsi: upsi,
    Upsi: Upsi,
    upsih: upsih,
    Upsilon: Upsilon,
    upsilon: upsilon,
    UpTeeArrow: UpTeeArrow,
    UpTee: UpTee,
    upuparrows: upuparrows,
    urcorn: urcorn,
    urcorner: urcorner,
    urcrop: urcrop,
    Uring: Uring,
    uring: uring,
    urtri: urtri,
    Uscr: Uscr,
    uscr: uscr,
    utdot: utdot,
    Utilde: Utilde,
    utilde: utilde,
    utri: utri,
    utrif: utrif,
    uuarr: uuarr,
    Uuml: Uuml,
    uuml: uuml,
    uwangle: uwangle,
    vangrt: vangrt,
    varepsilon: varepsilon,
    varkappa: varkappa,
    varnothing: varnothing,
    varphi: varphi,
    varpi: varpi,
    varpropto: varpropto,
    varr: varr,
    vArr: vArr,
    varrho: varrho,
    varsigma: varsigma,
    varsubsetneq: varsubsetneq,
    varsubsetneqq: varsubsetneqq,
    varsupsetneq: varsupsetneq,
    varsupsetneqq: varsupsetneqq,
    vartheta: vartheta,
    vartriangleleft: vartriangleleft,
    vartriangleright: vartriangleright,
    vBar: vBar,
    Vbar: Vbar,
    vBarv: vBarv,
    Vcy: Vcy,
    vcy: vcy,
    vdash: vdash,
    vDash: vDash,
    Vdash: Vdash,
    VDash: VDash,
    Vdashl: Vdashl,
    veebar: veebar,
    vee: vee,
    Vee: Vee,
    veeeq: veeeq,
    vellip: vellip,
    verbar: verbar,
    Verbar: Verbar,
    vert: vert,
    Vert: Vert,
    VerticalBar: VerticalBar,
    VerticalLine: VerticalLine,
    VerticalSeparator: VerticalSeparator,
    VerticalTilde: VerticalTilde,
    VeryThinSpace: VeryThinSpace,
    Vfr: Vfr,
    vfr: vfr,
    vltri: vltri,
    vnsub: vnsub,
    vnsup: vnsup,
    Vopf: Vopf,
    vopf: vopf,
    vprop: vprop,
    vrtri: vrtri,
    Vscr: Vscr,
    vscr: vscr,
    vsubnE: vsubnE,
    vsubne: vsubne,
    vsupnE: vsupnE,
    vsupne: vsupne,
    Vvdash: Vvdash,
    vzigzag: vzigzag,
    Wcirc: Wcirc,
    wcirc: wcirc,
    wedbar: wedbar,
    wedge: wedge,
    Wedge: Wedge,
    wedgeq: wedgeq,
    weierp: weierp,
    Wfr: Wfr,
    wfr: wfr,
    Wopf: Wopf,
    wopf: wopf,
    wp: wp,
    wr: wr,
    wreath: wreath,
    Wscr: Wscr,
    wscr: wscr,
    xcap: xcap,
    xcirc: xcirc,
    xcup: xcup,
    xdtri: xdtri,
    Xfr: Xfr,
    xfr: xfr,
    xharr: xharr,
    xhArr: xhArr,
    Xi: Xi,
    xi: xi,
    xlarr: xlarr,
    xlArr: xlArr,
    xmap: xmap,
    xnis: xnis,
    xodot: xodot,
    Xopf: Xopf,
    xopf: xopf,
    xoplus: xoplus,
    xotime: xotime,
    xrarr: xrarr,
    xrArr: xrArr,
    Xscr: Xscr,
    xscr: xscr,
    xsqcup: xsqcup,
    xuplus: xuplus,
    xutri: xutri,
    xvee: xvee,
    xwedge: xwedge,
    Yacute: Yacute,
    yacute: yacute,
    YAcy: YAcy,
    yacy: yacy,
    Ycirc: Ycirc,
    ycirc: ycirc,
    Ycy: Ycy,
    ycy: ycy,
    yen: yen,
    Yfr: Yfr,
    yfr: yfr,
    YIcy: YIcy,
    yicy: yicy,
    Yopf: Yopf,
    yopf: yopf,
    Yscr: Yscr,
    yscr: yscr,
    YUcy: YUcy,
    yucy: yucy,
    yuml: yuml,
    Yuml: Yuml,
    Zacute: Zacute,
    zacute: zacute,
    Zcaron: Zcaron,
    zcaron: zcaron,
    Zcy: Zcy,
    zcy: zcy,
    Zdot: Zdot,
    zdot: zdot,
    zeetrf: zeetrf,
    ZeroWidthSpace: ZeroWidthSpace,
    Zeta: Zeta,
    zeta: zeta,
    zfr: zfr,
    Zfr: Zfr,
    ZHcy: ZHcy,
    zhcy: zhcy,
    zigrarr: zigrarr,
    zopf: zopf,
    Zopf: Zopf,
    Zscr: Zscr,
    zscr: zscr,
    zwj: zwj,
    zwnj: zwnj,
    'default': entities
  });

  var require$$0 = getCjsExportFromNamespace(entities$1);

  /*eslint quotes:0*/

  var entities$2 = require$$0;

  var regex = /[!-#%-\*,-\/:;\?@\[-\]_\{\}\xA1\xA7\xAB\xB6\xB7\xBB\xBF\u037E\u0387\u055A-\u055F\u0589\u058A\u05BE\u05C0\u05C3\u05C6\u05F3\u05F4\u0609\u060A\u060C\u060D\u061B\u061E\u061F\u066A-\u066D\u06D4\u0700-\u070D\u07F7-\u07F9\u0830-\u083E\u085E\u0964\u0965\u0970\u09FD\u0A76\u0AF0\u0C84\u0DF4\u0E4F\u0E5A\u0E5B\u0F04-\u0F12\u0F14\u0F3A-\u0F3D\u0F85\u0FD0-\u0FD4\u0FD9\u0FDA\u104A-\u104F\u10FB\u1360-\u1368\u1400\u166D\u166E\u169B\u169C\u16EB-\u16ED\u1735\u1736\u17D4-\u17D6\u17D8-\u17DA\u1800-\u180A\u1944\u1945\u1A1E\u1A1F\u1AA0-\u1AA6\u1AA8-\u1AAD\u1B5A-\u1B60\u1BFC-\u1BFF\u1C3B-\u1C3F\u1C7E\u1C7F\u1CC0-\u1CC7\u1CD3\u2010-\u2027\u2030-\u2043\u2045-\u2051\u2053-\u205E\u207D\u207E\u208D\u208E\u2308-\u230B\u2329\u232A\u2768-\u2775\u27C5\u27C6\u27E6-\u27EF\u2983-\u2998\u29D8-\u29DB\u29FC\u29FD\u2CF9-\u2CFC\u2CFE\u2CFF\u2D70\u2E00-\u2E2E\u2E30-\u2E4E\u3001-\u3003\u3008-\u3011\u3014-\u301F\u3030\u303D\u30A0\u30FB\uA4FE\uA4FF\uA60D-\uA60F\uA673\uA67E\uA6F2-\uA6F7\uA874-\uA877\uA8CE\uA8CF\uA8F8-\uA8FA\uA8FC\uA92E\uA92F\uA95F\uA9C1-\uA9CD\uA9DE\uA9DF\uAA5C-\uAA5F\uAADE\uAADF\uAAF0\uAAF1\uABEB\uFD3E\uFD3F\uFE10-\uFE19\uFE30-\uFE52\uFE54-\uFE61\uFE63\uFE68\uFE6A\uFE6B\uFF01-\uFF03\uFF05-\uFF0A\uFF0C-\uFF0F\uFF1A\uFF1B\uFF1F\uFF20\uFF3B-\uFF3D\uFF3F\uFF5B\uFF5D\uFF5F-\uFF65]|\uD800[\uDD00-\uDD02\uDF9F\uDFD0]|\uD801\uDD6F|\uD802[\uDC57\uDD1F\uDD3F\uDE50-\uDE58\uDE7F\uDEF0-\uDEF6\uDF39-\uDF3F\uDF99-\uDF9C]|\uD803[\uDF55-\uDF59]|\uD804[\uDC47-\uDC4D\uDCBB\uDCBC\uDCBE-\uDCC1\uDD40-\uDD43\uDD74\uDD75\uDDC5-\uDDC8\uDDCD\uDDDB\uDDDD-\uDDDF\uDE38-\uDE3D\uDEA9]|\uD805[\uDC4B-\uDC4F\uDC5B\uDC5D\uDCC6\uDDC1-\uDDD7\uDE41-\uDE43\uDE60-\uDE6C\uDF3C-\uDF3E]|\uD806[\uDC3B\uDE3F-\uDE46\uDE9A-\uDE9C\uDE9E-\uDEA2]|\uD807[\uDC41-\uDC45\uDC70\uDC71\uDEF7\uDEF8]|\uD809[\uDC70-\uDC74]|\uD81A[\uDE6E\uDE6F\uDEF5\uDF37-\uDF3B\uDF44]|\uD81B[\uDE97-\uDE9A]|\uD82F\uDC9F|\uD836[\uDE87-\uDE8B]|\uD83A[\uDD5E\uDD5F]/;

  var encodeCache = {}; // Create a lookup array where anything but characters in `chars` string
  // and alphanumeric chars is percent-encoded.
  //

  function getEncodeCache(exclude) {
    var i,
        ch,
        cache = encodeCache[exclude];

    if (cache) {
      return cache;
    }

    cache = encodeCache[exclude] = [];

    for (i = 0; i < 128; i++) {
      ch = String.fromCharCode(i);

      if (/^[0-9a-z]$/i.test(ch)) {
        // always allow unencoded alphanumeric characters
        cache.push(ch);
      } else {
        cache.push('%' + ('0' + i.toString(16).toUpperCase()).slice(-2));
      }
    }

    for (i = 0; i < exclude.length; i++) {
      cache[exclude.charCodeAt(i)] = exclude[i];
    }

    return cache;
  } // Encode unsafe characters with percent-encoding, skipping already
  // encoded sequences.
  //
  //  - string       - string to encode
  //  - exclude      - list of characters to ignore (in addition to a-zA-Z0-9)
  //  - keepEscaped  - don't encode '%' in a correct escape sequence (default: true)
  //


  function encode(string, exclude, keepEscaped) {
    var i,
        l,
        code,
        nextCode,
        cache,
        result = '';

    if (typeof exclude !== 'string') {
      // encode(string, keepEscaped)
      keepEscaped = exclude;
      exclude = encode.defaultChars;
    }

    if (typeof keepEscaped === 'undefined') {
      keepEscaped = true;
    }

    cache = getEncodeCache(exclude);

    for (i = 0, l = string.length; i < l; i++) {
      code = string.charCodeAt(i);

      if (keepEscaped && code === 0x25
      /* % */
      && i + 2 < l) {
        if (/^[0-9a-f]{2}$/i.test(string.slice(i + 1, i + 3))) {
          result += string.slice(i, i + 3);
          i += 2;
          continue;
        }
      }

      if (code < 128) {
        result += cache[code];
        continue;
      }

      if (code >= 0xD800 && code <= 0xDFFF) {
        if (code >= 0xD800 && code <= 0xDBFF && i + 1 < l) {
          nextCode = string.charCodeAt(i + 1);

          if (nextCode >= 0xDC00 && nextCode <= 0xDFFF) {
            result += encodeURIComponent(string[i] + string[i + 1]);
            i++;
            continue;
          }
        }

        result += '%EF%BF%BD';
        continue;
      }

      result += encodeURIComponent(string[i]);
    }

    return result;
  }

  encode.defaultChars = ";/?:@&=+$,-_.!~*'()#";
  encode.componentChars = "-_.!~*'()";
  var encode_1 = encode;

  /* eslint-disable no-bitwise */

  var decodeCache = {};

  function getDecodeCache(exclude) {
    var i,
        ch,
        cache = decodeCache[exclude];

    if (cache) {
      return cache;
    }

    cache = decodeCache[exclude] = [];

    for (i = 0; i < 128; i++) {
      ch = String.fromCharCode(i);
      cache.push(ch);
    }

    for (i = 0; i < exclude.length; i++) {
      ch = exclude.charCodeAt(i);
      cache[ch] = '%' + ('0' + ch.toString(16).toUpperCase()).slice(-2);
    }

    return cache;
  } // Decode percent-encoded string.
  //


  function decode(string, exclude) {
    var cache;

    if (typeof exclude !== 'string') {
      exclude = decode.defaultChars;
    }

    cache = getDecodeCache(exclude);
    return string.replace(/(%[a-f0-9]{2})+/gi, function (seq) {
      var i,
          l,
          b1,
          b2,
          b3,
          b4,
          chr,
          result = '';

      for (i = 0, l = seq.length; i < l; i += 3) {
        b1 = parseInt(seq.slice(i + 1, i + 3), 16);

        if (b1 < 0x80) {
          result += cache[b1];
          continue;
        }

        if ((b1 & 0xE0) === 0xC0 && i + 3 < l) {
          // 110xxxxx 10xxxxxx
          b2 = parseInt(seq.slice(i + 4, i + 6), 16);

          if ((b2 & 0xC0) === 0x80) {
            chr = b1 << 6 & 0x7C0 | b2 & 0x3F;

            if (chr < 0x80) {
              result += '\ufffd\ufffd';
            } else {
              result += String.fromCharCode(chr);
            }

            i += 3;
            continue;
          }
        }

        if ((b1 & 0xF0) === 0xE0 && i + 6 < l) {
          // 1110xxxx 10xxxxxx 10xxxxxx
          b2 = parseInt(seq.slice(i + 4, i + 6), 16);
          b3 = parseInt(seq.slice(i + 7, i + 9), 16);

          if ((b2 & 0xC0) === 0x80 && (b3 & 0xC0) === 0x80) {
            chr = b1 << 12 & 0xF000 | b2 << 6 & 0xFC0 | b3 & 0x3F;

            if (chr < 0x800 || chr >= 0xD800 && chr <= 0xDFFF) {
              result += '\ufffd\ufffd\ufffd';
            } else {
              result += String.fromCharCode(chr);
            }

            i += 6;
            continue;
          }
        }

        if ((b1 & 0xF8) === 0xF0 && i + 9 < l) {
          // 111110xx 10xxxxxx 10xxxxxx 10xxxxxx
          b2 = parseInt(seq.slice(i + 4, i + 6), 16);
          b3 = parseInt(seq.slice(i + 7, i + 9), 16);
          b4 = parseInt(seq.slice(i + 10, i + 12), 16);

          if ((b2 & 0xC0) === 0x80 && (b3 & 0xC0) === 0x80 && (b4 & 0xC0) === 0x80) {
            chr = b1 << 18 & 0x1C0000 | b2 << 12 & 0x3F000 | b3 << 6 & 0xFC0 | b4 & 0x3F;

            if (chr < 0x10000 || chr > 0x10FFFF) {
              result += '\ufffd\ufffd\ufffd\ufffd';
            } else {
              chr -= 0x10000;
              result += String.fromCharCode(0xD800 + (chr >> 10), 0xDC00 + (chr & 0x3FF));
            }

            i += 9;
            continue;
          }
        }

        result += '\ufffd';
      }

      return result;
    });
  }

  decode.defaultChars = ';/?:@&=+$,#';
  decode.componentChars = '';
  var decode_1 = decode;

  var format = function format(url) {
    var result = '';
    result += url.protocol || '';
    result += url.slashes ? '//' : '';
    result += url.auth ? url.auth + '@' : '';

    if (url.hostname && url.hostname.indexOf(':') !== -1) {
      // ipv6 address
      result += '[' + url.hostname + ']';
    } else {
      result += url.hostname || '';
    }

    result += url.port ? ':' + url.port : '';
    result += url.pathname || '';
    result += url.search || '';
    result += url.hash || '';
    return result;
  };

  // Copyright Joyent, Inc. and other Node contributors.
  // Changes from joyent/node:
  //
  // 1. No leading slash in paths,
  //    e.g. in `url.parse('http://foo?bar')` pathname is ``, not `/`
  //
  // 2. Backslashes are not replaced with slashes,
  //    so `http:\\example.org\` is treated like a relative path
  //
  // 3. Trailing colon is treated like a part of the path,
  //    i.e. in `http://example.org:foo` pathname is `:foo`
  //
  // 4. Nothing is URL-encoded in the resulting object,
  //    (in joyent/node some chars in auth and paths are encoded)
  //
  // 5. `url.parse()` does not have `parseQueryString` argument
  //
  // 6. Removed extraneous result properties: `host`, `path`, `query`, etc.,
  //    which can be constructed using other parts of the url.
  //

  function Url() {
    this.protocol = null;
    this.slashes = null;
    this.auth = null;
    this.port = null;
    this.hostname = null;
    this.hash = null;
    this.search = null;
    this.pathname = null;
  } // Reference: RFC 3986, RFC 1808, RFC 2396
  // define these here so at least they only have to be
  // compiled once on the first module load.


  var protocolPattern = /^([a-z0-9.+-]+:)/i,
      portPattern = /:[0-9]*$/,
      // Special case for a simple path URL
  simplePathPattern = /^(\/\/?(?!\/)[^\?\s]*)(\?[^\s]*)?$/,
      // RFC 2396: characters reserved for delimiting URLs.
  // We actually just auto-escape these.
  delims = ['<', '>', '"', '`', ' ', '\r', '\n', '\t'],
      // RFC 2396: characters not allowed for various reasons.
  unwise = ['{', '}', '|', '\\', '^', '`'].concat(delims),
      // Allowed by RFCs, but cause of XSS attacks.  Always escape these.
  autoEscape = ['\''].concat(unwise),
      // Characters that are never ever allowed in a hostname.
  // Note that any invalid chars are also handled, but these
  // are the ones that are *expected* to be seen, so we fast-path
  // them.
  nonHostChars = ['%', '/', '?', ';', '#'].concat(autoEscape),
      hostEndingChars = ['/', '?', '#'],
      hostnameMaxLen = 255,
      hostnamePartPattern = /^[+a-z0-9A-Z_-]{0,63}$/,
      hostnamePartStart = /^([+a-z0-9A-Z_-]{0,63})(.*)$/,
      // protocols that can allow "unsafe" and "unwise" chars.

  /* eslint-disable no-script-url */
  // protocols that never have a hostname.
  hostlessProtocol = {
    'javascript': true,
    'javascript:': true
  },
      // protocols that always contain a // bit.
  slashedProtocol = {
    'http': true,
    'https': true,
    'ftp': true,
    'gopher': true,
    'file': true,
    'http:': true,
    'https:': true,
    'ftp:': true,
    'gopher:': true,
    'file:': true
  };
  /* eslint-enable no-script-url */

  function urlParse(url, slashesDenoteHost) {
    if (url && url instanceof Url) {
      return url;
    }

    var u = new Url();
    u.parse(url, slashesDenoteHost);
    return u;
  }

  Url.prototype.parse = function (url, slashesDenoteHost) {
    var i,
        l,
        lowerProto,
        hec,
        slashes,
        rest = url; // trim before proceeding.
    // This is to support parse stuff like "  http://foo.com  \n"

    rest = rest.trim();

    if (!slashesDenoteHost && url.split('#').length === 1) {
      // Try fast path regexp
      var simplePath = simplePathPattern.exec(rest);

      if (simplePath) {
        this.pathname = simplePath[1];

        if (simplePath[2]) {
          this.search = simplePath[2];
        }

        return this;
      }
    }

    var proto = protocolPattern.exec(rest);

    if (proto) {
      proto = proto[0];
      lowerProto = proto.toLowerCase();
      this.protocol = proto;
      rest = rest.substr(proto.length);
    } // figure out if it's got a host
    // user@server is *always* interpreted as a hostname, and url
    // resolution will treat //foo/bar as host=foo,path=bar because that's
    // how the browser resolves relative URLs.


    if (slashesDenoteHost || proto || rest.match(/^\/\/[^@\/]+@[^@\/]+/)) {
      slashes = rest.substr(0, 2) === '//';

      if (slashes && !(proto && hostlessProtocol[proto])) {
        rest = rest.substr(2);
        this.slashes = true;
      }
    }

    if (!hostlessProtocol[proto] && (slashes || proto && !slashedProtocol[proto])) {
      // there's a hostname.
      // the first instance of /, ?, ;, or # ends the host.
      //
      // If there is an @ in the hostname, then non-host chars *are* allowed
      // to the left of the last @ sign, unless some host-ending character
      // comes *before* the @-sign.
      // URLs are obnoxious.
      //
      // ex:
      // http://a@b@c/ => user:a@b host:c
      // http://a@b?@c => user:a host:c path:/?@c
      // v0.12 TODO(isaacs): This is not quite how Chrome does things.
      // Review our test case against browsers more comprehensively.
      // find the first instance of any hostEndingChars
      var hostEnd = -1;

      for (i = 0; i < hostEndingChars.length; i++) {
        hec = rest.indexOf(hostEndingChars[i]);

        if (hec !== -1 && (hostEnd === -1 || hec < hostEnd)) {
          hostEnd = hec;
        }
      } // at this point, either we have an explicit point where the
      // auth portion cannot go past, or the last @ char is the decider.


      var auth, atSign;

      if (hostEnd === -1) {
        // atSign can be anywhere.
        atSign = rest.lastIndexOf('@');
      } else {
        // atSign must be in auth portion.
        // http://a@b/c@d => host:b auth:a path:/c@d
        atSign = rest.lastIndexOf('@', hostEnd);
      } // Now we have a portion which is definitely the auth.
      // Pull that off.


      if (atSign !== -1) {
        auth = rest.slice(0, atSign);
        rest = rest.slice(atSign + 1);
        this.auth = auth;
      } // the host is the remaining to the left of the first non-host char


      hostEnd = -1;

      for (i = 0; i < nonHostChars.length; i++) {
        hec = rest.indexOf(nonHostChars[i]);

        if (hec !== -1 && (hostEnd === -1 || hec < hostEnd)) {
          hostEnd = hec;
        }
      } // if we still have not hit it, then the entire thing is a host.


      if (hostEnd === -1) {
        hostEnd = rest.length;
      }

      if (rest[hostEnd - 1] === ':') {
        hostEnd--;
      }

      var host = rest.slice(0, hostEnd);
      rest = rest.slice(hostEnd); // pull out port.

      this.parseHost(host); // we've indicated that there is a hostname,
      // so even if it's empty, it has to be present.

      this.hostname = this.hostname || ''; // if hostname begins with [ and ends with ]
      // assume that it's an IPv6 address.

      var ipv6Hostname = this.hostname[0] === '[' && this.hostname[this.hostname.length - 1] === ']'; // validate a little.

      if (!ipv6Hostname) {
        var hostparts = this.hostname.split(/\./);

        for (i = 0, l = hostparts.length; i < l; i++) {
          var part = hostparts[i];

          if (!part) {
            continue;
          }

          if (!part.match(hostnamePartPattern)) {
            var newpart = '';

            for (var j = 0, k = part.length; j < k; j++) {
              if (part.charCodeAt(j) > 127) {
                // we replace non-ASCII char with a temporary placeholder
                // we need this to make sure size of hostname is not
                // broken by replacing non-ASCII by nothing
                newpart += 'x';
              } else {
                newpart += part[j];
              }
            } // we test again with ASCII char only


            if (!newpart.match(hostnamePartPattern)) {
              var validParts = hostparts.slice(0, i);
              var notHost = hostparts.slice(i + 1);
              var bit = part.match(hostnamePartStart);

              if (bit) {
                validParts.push(bit[1]);
                notHost.unshift(bit[2]);
              }

              if (notHost.length) {
                rest = notHost.join('.') + rest;
              }

              this.hostname = validParts.join('.');
              break;
            }
          }
        }
      }

      if (this.hostname.length > hostnameMaxLen) {
        this.hostname = '';
      } // strip [ and ] from the hostname
      // the host field still retains them, though


      if (ipv6Hostname) {
        this.hostname = this.hostname.substr(1, this.hostname.length - 2);
      }
    } // chop off from the tail first.


    var hash = rest.indexOf('#');

    if (hash !== -1) {
      // got a fragment string.
      this.hash = rest.substr(hash);
      rest = rest.slice(0, hash);
    }

    var qm = rest.indexOf('?');

    if (qm !== -1) {
      this.search = rest.substr(qm);
      rest = rest.slice(0, qm);
    }

    if (rest) {
      this.pathname = rest;
    }

    if (slashedProtocol[lowerProto] && this.hostname && !this.pathname) {
      this.pathname = '';
    }

    return this;
  };

  Url.prototype.parseHost = function (host) {
    var port = portPattern.exec(host);

    if (port) {
      port = port[0];

      if (port !== ':') {
        this.port = port.substr(1);
      }

      host = host.substr(0, host.length - port.length);
    }

    if (host) {
      this.hostname = host;
    }
  };

  var parse = urlParse;

  var encode$1 = encode_1;
  var decode$1 = decode_1;
  var format$1 = format;
  var parse$1 = parse;

  var mdurl = {
  	encode: encode$1,
  	decode: decode$1,
  	format: format$1,
  	parse: parse$1
  };

  var regex$1 = /[\0-\uD7FF\uE000-\uFFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;

  var regex$2 = /[\0-\x1F\x7F-\x9F]/;

  var regex$3 = /[\xAD\u0600-\u0605\u061C\u06DD\u070F\u08E2\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF\uFFF9-\uFFFB]|\uD804[\uDCBD\uDCCD]|\uD82F[\uDCA0-\uDCA3]|\uD834[\uDD73-\uDD7A]|\uDB40[\uDC01\uDC20-\uDC7F]/;

  var regex$4 = /[ \xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/;

  var Any = regex$1;
  var Cc = regex$2;
  var Cf = regex$3;
  var P = regex;
  var Z = regex$4;

  var uc_micro = {
  	Any: Any,
  	Cc: Cc,
  	Cf: Cf,
  	P: P,
  	Z: Z
  };

  var utils = createCommonjsModule(function (module, exports) {

  function _class(obj) {
    return Object.prototype.toString.call(obj);
  }

  function isString(obj) {
    return _class(obj) === '[object String]';
  }

  var _hasOwnProperty = Object.prototype.hasOwnProperty;

  function has(object, key) {
    return _hasOwnProperty.call(object, key);
  } // Merge objects
  //


  function assign(obj
  /*from1, from2, from3, ...*/
  ) {
    var sources = Array.prototype.slice.call(arguments, 1);
    sources.forEach(function (source) {
      if (!source) {
        return;
      }

      if (typeof source !== 'object') {
        throw new TypeError(source + 'must be object');
      }

      Object.keys(source).forEach(function (key) {
        obj[key] = source[key];
      });
    });
    return obj;
  } // Remove element from array and put another array at those position.
  // Useful for some operations with tokens


  function arrayReplaceAt(src, pos, newElements) {
    return [].concat(src.slice(0, pos), newElements, src.slice(pos + 1));
  } ////////////////////////////////////////////////////////////////////////////////


  function isValidEntityCode(c) {
    /*eslint no-bitwise:0*/
    // broken sequence
    if (c >= 0xD800 && c <= 0xDFFF) {
      return false;
    } // never used


    if (c >= 0xFDD0 && c <= 0xFDEF) {
      return false;
    }

    if ((c & 0xFFFF) === 0xFFFF || (c & 0xFFFF) === 0xFFFE) {
      return false;
    } // control codes


    if (c >= 0x00 && c <= 0x08) {
      return false;
    }

    if (c === 0x0B) {
      return false;
    }

    if (c >= 0x0E && c <= 0x1F) {
      return false;
    }

    if (c >= 0x7F && c <= 0x9F) {
      return false;
    } // out of range


    if (c > 0x10FFFF) {
      return false;
    }

    return true;
  }

  function fromCodePoint(c) {
    /*eslint no-bitwise:0*/
    if (c > 0xffff) {
      c -= 0x10000;
      var surrogate1 = 0xd800 + (c >> 10),
          surrogate2 = 0xdc00 + (c & 0x3ff);
      return String.fromCharCode(surrogate1, surrogate2);
    }

    return String.fromCharCode(c);
  }

  var UNESCAPE_MD_RE = /\\([!"#$%&'()*+,\-.\/:;<=>?@[\\\]^_`{|}~])/g;
  var ENTITY_RE = /&([a-z#][a-z0-9]{1,31});/gi;
  var UNESCAPE_ALL_RE = new RegExp(UNESCAPE_MD_RE.source + '|' + ENTITY_RE.source, 'gi');
  var DIGITAL_ENTITY_TEST_RE = /^#((?:x[a-f0-9]{1,8}|[0-9]{1,8}))/i;



  function replaceEntityPattern(match, name) {
    var code = 0;

    if (has(entities$2, name)) {
      return entities$2[name];
    }

    if (name.charCodeAt(0) === 0x23
    /* # */
    && DIGITAL_ENTITY_TEST_RE.test(name)) {
      code = name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);

      if (isValidEntityCode(code)) {
        return fromCodePoint(code);
      }
    }

    return match;
  }
  /*function replaceEntities(str) {
    if (str.indexOf('&') < 0) { return str; }

    return str.replace(ENTITY_RE, replaceEntityPattern);
  }*/


  function unescapeMd(str) {
    if (str.indexOf('\\') < 0) {
      return str;
    }

    return str.replace(UNESCAPE_MD_RE, '$1');
  }

  function unescapeAll(str) {
    if (str.indexOf('\\') < 0 && str.indexOf('&') < 0) {
      return str;
    }

    return str.replace(UNESCAPE_ALL_RE, function (match, escaped, entity) {
      if (escaped) {
        return escaped;
      }

      return replaceEntityPattern(match, entity);
    });
  } ////////////////////////////////////////////////////////////////////////////////


  var HTML_ESCAPE_TEST_RE = /[&<>"]/;
  var HTML_ESCAPE_REPLACE_RE = /[&<>"]/g;
  var HTML_REPLACEMENTS = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;'
  };

  function replaceUnsafeChar(ch) {
    return HTML_REPLACEMENTS[ch];
  }

  function escapeHtml(str) {
    if (HTML_ESCAPE_TEST_RE.test(str)) {
      return str.replace(HTML_ESCAPE_REPLACE_RE, replaceUnsafeChar);
    }

    return str;
  } ////////////////////////////////////////////////////////////////////////////////


  var REGEXP_ESCAPE_RE = /[.?*+^$[\]\\(){}|-]/g;

  function escapeRE(str) {
    return str.replace(REGEXP_ESCAPE_RE, '\\$&');
  } ////////////////////////////////////////////////////////////////////////////////


  function isSpace(code) {
    switch (code) {
      case 0x09:
      case 0x20:
        return true;
    }

    return false;
  } // Zs (unicode class) || [\t\f\v\r\n]


  function isWhiteSpace(code) {
    if (code >= 0x2000 && code <= 0x200A) {
      return true;
    }

    switch (code) {
      case 0x09: // \t

      case 0x0A: // \n

      case 0x0B: // \v

      case 0x0C: // \f

      case 0x0D: // \r

      case 0x20:
      case 0xA0:
      case 0x1680:
      case 0x202F:
      case 0x205F:
      case 0x3000:
        return true;
    }

    return false;
  } ////////////////////////////////////////////////////////////////////////////////

  /*eslint-disable max-len*/


   // Currently without astral characters support.


  function isPunctChar(ch) {
    return regex.test(ch);
  } // Markdown ASCII punctuation characters.
  //
  // !, ", #, $, %, &, ', (, ), *, +, ,, -, ., /, :, ;, <, =, >, ?, @, [, \, ], ^, _, `, {, |, }, or ~
  // http://spec.commonmark.org/0.15/#ascii-punctuation-character
  //
  // Don't confuse with unicode punctuation !!! It lacks some chars in ascii range.
  //


  function isMdAsciiPunct(ch) {
    switch (ch) {
      case 0x21
      /* ! */
      :
      case 0x22
      /* " */
      :
      case 0x23
      /* # */
      :
      case 0x24
      /* $ */
      :
      case 0x25
      /* % */
      :
      case 0x26
      /* & */
      :
      case 0x27
      /* ' */
      :
      case 0x28
      /* ( */
      :
      case 0x29
      /* ) */
      :
      case 0x2A
      /* * */
      :
      case 0x2B
      /* + */
      :
      case 0x2C
      /* , */
      :
      case 0x2D
      /* - */
      :
      case 0x2E
      /* . */
      :
      case 0x2F
      /* / */
      :
      case 0x3A
      /* : */
      :
      case 0x3B
      /* ; */
      :
      case 0x3C
      /* < */
      :
      case 0x3D
      /* = */
      :
      case 0x3E
      /* > */
      :
      case 0x3F
      /* ? */
      :
      case 0x40
      /* @ */
      :
      case 0x5B
      /* [ */
      :
      case 0x5C
      /* \ */
      :
      case 0x5D
      /* ] */
      :
      case 0x5E
      /* ^ */
      :
      case 0x5F
      /* _ */
      :
      case 0x60
      /* ` */
      :
      case 0x7B
      /* { */
      :
      case 0x7C
      /* | */
      :
      case 0x7D
      /* } */
      :
      case 0x7E
      /* ~ */
      :
        return true;

      default:
        return false;
    }
  } // Hepler to unify [reference labels].
  //


  function normalizeReference(str) {
    // Trim and collapse whitespace
    //
    str = str.trim().replace(/\s+/g, ' '); // In node v10 'ẞ'.toLowerCase() === 'Ṿ', which is presumed to be a bug
    // fixed in v12 (couldn't find any details).
    //
    // So treat this one as a special case
    // (remove this when node v10 is no longer supported).
    //

    if ('ẞ'.toLowerCase() === 'Ṿ') {
      str = str.replace(/ẞ/g, 'ß');
    } // .toLowerCase().toUpperCase() should get rid of all differences
    // between letter variants.
    //
    // Simple .toLowerCase() doesn't normalize 125 code points correctly,
    // and .toUpperCase doesn't normalize 6 of them (list of exceptions:
    // İ, ϴ, ẞ, Ω, K, Å - those are already uppercased, but have differently
    // uppercased versions).
    //
    // Here's an example showing how it happens. Lets take greek letter omega:
    // uppercase U+0398 (Θ), U+03f4 (ϴ) and lowercase U+03b8 (θ), U+03d1 (ϑ)
    //
    // Unicode entries:
    // 0398;GREEK CAPITAL LETTER THETA;Lu;0;L;;;;;N;;;;03B8;
    // 03B8;GREEK SMALL LETTER THETA;Ll;0;L;;;;;N;;;0398;;0398
    // 03D1;GREEK THETA SYMBOL;Ll;0;L;<compat> 03B8;;;;N;GREEK SMALL LETTER SCRIPT THETA;;0398;;0398
    // 03F4;GREEK CAPITAL THETA SYMBOL;Lu;0;L;<compat> 0398;;;;N;;;;03B8;
    //
    // Case-insensitive comparison should treat all of them as equivalent.
    //
    // But .toLowerCase() doesn't change ϑ (it's already lowercase),
    // and .toUpperCase() doesn't change ϴ (already uppercase).
    //
    // Applying first lower then upper case normalizes any character:
    // '\u0398\u03f4\u03b8\u03d1'.toLowerCase().toUpperCase() === '\u0398\u0398\u0398\u0398'
    //
    // Note: this is equivalent to unicode case folding; unicode normalization
    // is a different step that is not required here.
    //
    // Final result should be uppercased, because it's later stored in an object
    // (this avoid a conflict with Object.prototype members,
    // most notably, `__proto__`)
    //


    return str.toLowerCase().toUpperCase();
  } ////////////////////////////////////////////////////////////////////////////////
  // Re-export libraries commonly used in both markdown-it and its plugins,
  // so plugins won't have to depend on them explicitly, which reduces their
  // bundled size (e.g. a browser build).
  //


  exports.lib = {};
  exports.lib.mdurl = mdurl;
  exports.lib.ucmicro = uc_micro;
  exports.assign = assign;
  exports.isString = isString;
  exports.has = has;
  exports.unescapeMd = unescapeMd;
  exports.unescapeAll = unescapeAll;
  exports.isValidEntityCode = isValidEntityCode;
  exports.fromCodePoint = fromCodePoint; // exports.replaceEntities     = replaceEntities;

  exports.escapeHtml = escapeHtml;
  exports.arrayReplaceAt = arrayReplaceAt;
  exports.isSpace = isSpace;
  exports.isWhiteSpace = isWhiteSpace;
  exports.isMdAsciiPunct = isMdAsciiPunct;
  exports.isPunctChar = isPunctChar;
  exports.escapeRE = escapeRE;
  exports.normalizeReference = normalizeReference;
  });
  var utils_1 = utils.lib;
  var utils_2 = utils.assign;
  var utils_3 = utils.isString;
  var utils_4 = utils.has;
  var utils_5 = utils.unescapeMd;
  var utils_6 = utils.unescapeAll;
  var utils_7 = utils.isValidEntityCode;
  var utils_8 = utils.fromCodePoint;
  var utils_9 = utils.escapeHtml;
  var utils_10 = utils.arrayReplaceAt;
  var utils_11 = utils.isSpace;
  var utils_12 = utils.isWhiteSpace;
  var utils_13 = utils.isMdAsciiPunct;
  var utils_14 = utils.isPunctChar;
  var utils_15 = utils.escapeRE;
  var utils_16 = utils.normalizeReference;

  // Parse link label

  var parse_link_label = function parseLinkLabel(state, start, disableNested) {
    var level,
        found,
        marker,
        prevPos,
        labelEnd = -1,
        max = state.posMax,
        oldPos = state.pos;
    state.pos = start + 1;
    level = 1;

    while (state.pos < max) {
      marker = state.src.charCodeAt(state.pos);

      if (marker === 0x5D
      /* ] */
      ) {
          level--;

          if (level === 0) {
            found = true;
            break;
          }
        }

      prevPos = state.pos;
      state.md.inline.skipToken(state);

      if (marker === 0x5B
      /* [ */
      ) {
          if (prevPos === state.pos - 1) {
            // increase level if we find text `[`, which is not a part of any token
            level++;
          } else if (disableNested) {
            state.pos = oldPos;
            return -1;
          }
        }
    }

    if (found) {
      labelEnd = state.pos;
    } // restore old state


    state.pos = oldPos;
    return labelEnd;
  };

  var unescapeAll = utils.unescapeAll;

  var parse_link_destination = function parseLinkDestination(str, pos, max) {
    var code,
        level,
        lines = 0,
        start = pos,
        result = {
      ok: false,
      pos: 0,
      lines: 0,
      str: ''
    };

    if (str.charCodeAt(pos) === 0x3C
    /* < */
    ) {
        pos++;

        while (pos < max) {
          code = str.charCodeAt(pos);

          if (code === 0x0A
          /* \n */
          ) {
              return result;
            }

          if (code === 0x3E
          /* > */
          ) {
              result.pos = pos + 1;
              result.str = unescapeAll(str.slice(start + 1, pos));
              result.ok = true;
              return result;
            }

          if (code === 0x5C
          /* \ */
          && pos + 1 < max) {
            pos += 2;
            continue;
          }

          pos++;
        } // no closing '>'


        return result;
      } // this should be ... } else { ... branch


    level = 0;

    while (pos < max) {
      code = str.charCodeAt(pos);

      if (code === 0x20) {
        break;
      } // ascii control characters


      if (code < 0x20 || code === 0x7F) {
        break;
      }

      if (code === 0x5C
      /* \ */
      && pos + 1 < max) {
        pos += 2;
        continue;
      }

      if (code === 0x28
      /* ( */
      ) {
          level++;
        }

      if (code === 0x29
      /* ) */
      ) {
          if (level === 0) {
            break;
          }

          level--;
        }

      pos++;
    }

    if (start === pos) {
      return result;
    }

    if (level !== 0) {
      return result;
    }

    result.str = unescapeAll(str.slice(start, pos));
    result.lines = lines;
    result.pos = pos;
    result.ok = true;
    return result;
  };

  var unescapeAll$1 = utils.unescapeAll;

  var parse_link_title = function parseLinkTitle(str, pos, max) {
    var code,
        marker,
        lines = 0,
        start = pos,
        result = {
      ok: false,
      pos: 0,
      lines: 0,
      str: ''
    };

    if (pos >= max) {
      return result;
    }

    marker = str.charCodeAt(pos);

    if (marker !== 0x22
    /* " */
    && marker !== 0x27
    /* ' */
    && marker !== 0x28
    /* ( */
    ) {
        return result;
      }

    pos++; // if opening marker is "(", switch it to closing marker ")"

    if (marker === 0x28) {
      marker = 0x29;
    }

    while (pos < max) {
      code = str.charCodeAt(pos);

      if (code === marker) {
        result.pos = pos + 1;
        result.lines = lines;
        result.str = unescapeAll$1(str.slice(start + 1, pos));
        result.ok = true;
        return result;
      } else if (code === 0x0A) {
        lines++;
      } else if (code === 0x5C
      /* \ */
      && pos + 1 < max) {
        pos++;

        if (str.charCodeAt(pos) === 0x0A) {
          lines++;
        }
      }

      pos++;
    }

    return result;
  };

  var parseLinkLabel = parse_link_label;
  var parseLinkDestination = parse_link_destination;
  var parseLinkTitle = parse_link_title;

  var helpers = {
  	parseLinkLabel: parseLinkLabel,
  	parseLinkDestination: parseLinkDestination,
  	parseLinkTitle: parseLinkTitle
  };

  var assign = utils.assign;

  var unescapeAll$2 = utils.unescapeAll;

  var escapeHtml = utils.escapeHtml; ////////////////////////////////////////////////////////////////////////////////


  var default_rules = {};

  default_rules.code_inline = function (tokens, idx, options, env, slf) {
    var token = tokens[idx];
    return '<code' + slf.renderAttrs(token) + '>' + escapeHtml(tokens[idx].content) + '</code>';
  };

  default_rules.code_block = function (tokens, idx, options, env, slf) {
    var token = tokens[idx];
    return '<pre' + slf.renderAttrs(token) + '><code>' + escapeHtml(tokens[idx].content) + '</code></pre>\n';
  };

  default_rules.fence = function (tokens, idx, options, env, slf) {
    var token = tokens[idx],
        info = token.info ? unescapeAll$2(token.info).trim() : '',
        langName = '',
        highlighted,
        i,
        tmpAttrs,
        tmpToken;

    if (info) {
      langName = info.split(/\s+/g)[0];
    }

    if (options.highlight) {
      highlighted = options.highlight(token.content, langName) || escapeHtml(token.content);
    } else {
      highlighted = escapeHtml(token.content);
    }

    if (highlighted.indexOf('<pre') === 0) {
      return highlighted + '\n';
    } // If language exists, inject class gently, without modifying original token.
    // May be, one day we will add .clone() for token and simplify this part, but
    // now we prefer to keep things local.


    if (info) {
      i = token.attrIndex('class');
      tmpAttrs = token.attrs ? token.attrs.slice() : [];

      if (i < 0) {
        tmpAttrs.push(['class', options.langPrefix + langName]);
      } else {
        tmpAttrs[i][1] += ' ' + options.langPrefix + langName;
      } // Fake token just to render attributes


      tmpToken = {
        attrs: tmpAttrs
      };
      return '<pre><code' + slf.renderAttrs(tmpToken) + '>' + highlighted + '</code></pre>\n';
    }

    return '<pre><code' + slf.renderAttrs(token) + '>' + highlighted + '</code></pre>\n';
  };

  default_rules.image = function (tokens, idx, options, env, slf) {
    var token = tokens[idx]; // "alt" attr MUST be set, even if empty. Because it's mandatory and
    // should be placed on proper position for tests.
    //
    // Replace content with actual value

    token.attrs[token.attrIndex('alt')][1] = slf.renderInlineAsText(token.children, options, env);
    return slf.renderToken(tokens, idx, options);
  };

  default_rules.hardbreak = function (tokens, idx, options
  /*, env */
  ) {
    return options.xhtmlOut ? '<br />\n' : '<br>\n';
  };

  default_rules.softbreak = function (tokens, idx, options
  /*, env */
  ) {
    return options.breaks ? options.xhtmlOut ? '<br />\n' : '<br>\n' : '\n';
  };

  default_rules.text = function (tokens, idx
  /*, options, env */
  ) {
    return escapeHtml(tokens[idx].content);
  };

  default_rules.html_block = function (tokens, idx
  /*, options, env */
  ) {
    return tokens[idx].content;
  };

  default_rules.html_inline = function (tokens, idx
  /*, options, env */
  ) {
    return tokens[idx].content;
  };
  /**
   * new Renderer()
   *
   * Creates new [[Renderer]] instance and fill [[Renderer#rules]] with defaults.
   **/


  function Renderer() {
    /**
     * Renderer#rules -> Object
     *
     * Contains render rules for tokens. Can be updated and extended.
     *
     * ##### Example
     *
     * ```javascript
     * var md = require('markdown-it')();
     *
     * md.renderer.rules.strong_open  = function () { return '<b>'; };
     * md.renderer.rules.strong_close = function () { return '</b>'; };
     *
     * var result = md.renderInline(...);
     * ```
     *
     * Each rule is called as independent static function with fixed signature:
     *
     * ```javascript
     * function my_token_render(tokens, idx, options, env, renderer) {
     *   // ...
     *   return renderedHTML;
     * }
     * ```
     *
     * See [source code](https://github.com/markdown-it/markdown-it/blob/master/lib/renderer.js)
     * for more details and examples.
     **/
    this.rules = assign({}, default_rules);
  }
  /**
   * Renderer.renderAttrs(token) -> String
   *
   * Render token attributes to string.
   **/


  Renderer.prototype.renderAttrs = function renderAttrs(token) {
    var i, l, result;

    if (!token.attrs) {
      return '';
    }

    result = '';

    for (i = 0, l = token.attrs.length; i < l; i++) {
      result += ' ' + escapeHtml(token.attrs[i][0]) + '="' + escapeHtml(token.attrs[i][1]) + '"';
    }

    return result;
  };
  /**
   * Renderer.renderToken(tokens, idx, options) -> String
   * - tokens (Array): list of tokens
   * - idx (Numbed): token index to render
   * - options (Object): params of parser instance
   *
   * Default token renderer. Can be overriden by custom function
   * in [[Renderer#rules]].
   **/


  Renderer.prototype.renderToken = function renderToken(tokens, idx, options) {
    var nextToken,
        result = '',
        needLf = false,
        token = tokens[idx]; // Tight list paragraphs

    if (token.hidden) {
      return '';
    } // Insert a newline between hidden paragraph and subsequent opening
    // block-level tag.
    //
    // For example, here we should insert a newline before blockquote:
    //  - a
    //    >
    //


    if (token.block && token.nesting !== -1 && idx && tokens[idx - 1].hidden) {
      result += '\n';
    } // Add token name, e.g. `<img`


    result += (token.nesting === -1 ? '</' : '<') + token.tag; // Encode attributes, e.g. `<img src="foo"`

    result += this.renderAttrs(token); // Add a slash for self-closing tags, e.g. `<img src="foo" /`

    if (token.nesting === 0 && options.xhtmlOut) {
      result += ' /';
    } // Check if we need to add a newline after this tag


    if (token.block) {
      needLf = true;

      if (token.nesting === 1) {
        if (idx + 1 < tokens.length) {
          nextToken = tokens[idx + 1];

          if (nextToken.type === 'inline' || nextToken.hidden) {
            // Block-level tag containing an inline tag.
            //
            needLf = false;
          } else if (nextToken.nesting === -1 && nextToken.tag === token.tag) {
            // Opening tag + closing tag of the same type. E.g. `<li></li>`.
            //
            needLf = false;
          }
        }
      }
    }

    result += needLf ? '>\n' : '>';
    return result;
  };
  /**
   * Renderer.renderInline(tokens, options, env) -> String
   * - tokens (Array): list on block tokens to renter
   * - options (Object): params of parser instance
   * - env (Object): additional data from parsed input (references, for example)
   *
   * The same as [[Renderer.render]], but for single token of `inline` type.
   **/


  Renderer.prototype.renderInline = function (tokens, options, env) {
    var type,
        result = '',
        rules = this.rules;

    for (var i = 0, len = tokens.length; i < len; i++) {
      type = tokens[i].type;

      if (typeof rules[type] !== 'undefined') {
        result += rules[type](tokens, i, options, env, this);
      } else {
        result += this.renderToken(tokens, i, options);
      }
    }

    return result;
  };
  /** internal
   * Renderer.renderInlineAsText(tokens, options, env) -> String
   * - tokens (Array): list on block tokens to renter
   * - options (Object): params of parser instance
   * - env (Object): additional data from parsed input (references, for example)
   *
   * Special kludge for image `alt` attributes to conform CommonMark spec.
   * Don't try to use it! Spec requires to show `alt` content with stripped markup,
   * instead of simple escaping.
   **/


  Renderer.prototype.renderInlineAsText = function (tokens, options, env) {
    var result = '';

    for (var i = 0, len = tokens.length; i < len; i++) {
      if (tokens[i].type === 'text') {
        result += tokens[i].content;
      } else if (tokens[i].type === 'image') {
        result += this.renderInlineAsText(tokens[i].children, options, env);
      }
    }

    return result;
  };
  /**
   * Renderer.render(tokens, options, env) -> String
   * - tokens (Array): list on block tokens to renter
   * - options (Object): params of parser instance
   * - env (Object): additional data from parsed input (references, for example)
   *
   * Takes token stream and generates HTML. Probably, you will never need to call
   * this method directly.
   **/


  Renderer.prototype.render = function (tokens, options, env) {
    var i,
        len,
        type,
        result = '',
        rules = this.rules;

    for (i = 0, len = tokens.length; i < len; i++) {
      type = tokens[i].type;

      if (type === 'inline') {
        result += this.renderInline(tokens[i].children, options, env);
      } else if (typeof rules[type] !== 'undefined') {
        result += rules[tokens[i].type](tokens, i, options, env, this);
      } else {
        result += this.renderToken(tokens, i, options, env);
      }
    }

    return result;
  };

  var renderer = Renderer;

  /**
   * class Ruler
   *
   * Helper class, used by [[MarkdownIt#core]], [[MarkdownIt#block]] and
   * [[MarkdownIt#inline]] to manage sequences of functions (rules):
   *
   * - keep rules in defined order
   * - assign the name to each rule
   * - enable/disable rules
   * - add/replace rules
   * - allow assign rules to additional named chains (in the same)
   * - cacheing lists of active rules
   *
   * You will not need use this class directly until write plugins. For simple
   * rules control use [[MarkdownIt.disable]], [[MarkdownIt.enable]] and
   * [[MarkdownIt.use]].
   **/
  /**
   * new Ruler()
   **/

  function Ruler() {
    // List of added rules. Each element is:
    //
    // {
    //   name: XXX,
    //   enabled: Boolean,
    //   fn: Function(),
    //   alt: [ name2, name3 ]
    // }
    //
    this.__rules__ = []; // Cached rule chains.
    //
    // First level - chain name, '' for default.
    // Second level - diginal anchor for fast filtering by charcodes.
    //

    this.__cache__ = null;
  } ////////////////////////////////////////////////////////////////////////////////
  // Helper methods, should not be used directly
  // Find rule index by name
  //


  Ruler.prototype.__find__ = function (name) {
    for (var i = 0; i < this.__rules__.length; i++) {
      if (this.__rules__[i].name === name) {
        return i;
      }
    }

    return -1;
  }; // Build rules lookup cache
  //


  Ruler.prototype.__compile__ = function () {
    var self = this;
    var chains = ['']; // collect unique names

    self.__rules__.forEach(function (rule) {
      if (!rule.enabled) {
        return;
      }

      rule.alt.forEach(function (altName) {
        if (chains.indexOf(altName) < 0) {
          chains.push(altName);
        }
      });
    });

    self.__cache__ = {};
    chains.forEach(function (chain) {
      self.__cache__[chain] = [];

      self.__rules__.forEach(function (rule) {
        if (!rule.enabled) {
          return;
        }

        if (chain && rule.alt.indexOf(chain) < 0) {
          return;
        }

        self.__cache__[chain].push(rule.fn);
      });
    });
  };
  /**
   * Ruler.at(name, fn [, options])
   * - name (String): rule name to replace.
   * - fn (Function): new rule function.
   * - options (Object): new rule options (not mandatory).
   *
   * Replace rule by name with new function & options. Throws error if name not
   * found.
   *
   * ##### Options:
   *
   * - __alt__ - array with names of "alternate" chains.
   *
   * ##### Example
   *
   * Replace existing typographer replacement rule with new one:
   *
   * ```javascript
   * var md = require('markdown-it')();
   *
   * md.core.ruler.at('replacements', function replace(state) {
   *   //...
   * });
   * ```
   **/


  Ruler.prototype.at = function (name, fn, options) {
    var index = this.__find__(name);

    var opt = options || {};

    if (index === -1) {
      throw new Error('Parser rule not found: ' + name);
    }

    this.__rules__[index].fn = fn;
    this.__rules__[index].alt = opt.alt || [];
    this.__cache__ = null;
  };
  /**
   * Ruler.before(beforeName, ruleName, fn [, options])
   * - beforeName (String): new rule will be added before this one.
   * - ruleName (String): name of added rule.
   * - fn (Function): rule function.
   * - options (Object): rule options (not mandatory).
   *
   * Add new rule to chain before one with given name. See also
   * [[Ruler.after]], [[Ruler.push]].
   *
   * ##### Options:
   *
   * - __alt__ - array with names of "alternate" chains.
   *
   * ##### Example
   *
   * ```javascript
   * var md = require('markdown-it')();
   *
   * md.block.ruler.before('paragraph', 'my_rule', function replace(state) {
   *   //...
   * });
   * ```
   **/


  Ruler.prototype.before = function (beforeName, ruleName, fn, options) {
    var index = this.__find__(beforeName);

    var opt = options || {};

    if (index === -1) {
      throw new Error('Parser rule not found: ' + beforeName);
    }

    this.__rules__.splice(index, 0, {
      name: ruleName,
      enabled: true,
      fn: fn,
      alt: opt.alt || []
    });

    this.__cache__ = null;
  };
  /**
   * Ruler.after(afterName, ruleName, fn [, options])
   * - afterName (String): new rule will be added after this one.
   * - ruleName (String): name of added rule.
   * - fn (Function): rule function.
   * - options (Object): rule options (not mandatory).
   *
   * Add new rule to chain after one with given name. See also
   * [[Ruler.before]], [[Ruler.push]].
   *
   * ##### Options:
   *
   * - __alt__ - array with names of "alternate" chains.
   *
   * ##### Example
   *
   * ```javascript
   * var md = require('markdown-it')();
   *
   * md.inline.ruler.after('text', 'my_rule', function replace(state) {
   *   //...
   * });
   * ```
   **/


  Ruler.prototype.after = function (afterName, ruleName, fn, options) {
    var index = this.__find__(afterName);

    var opt = options || {};

    if (index === -1) {
      throw new Error('Parser rule not found: ' + afterName);
    }

    this.__rules__.splice(index + 1, 0, {
      name: ruleName,
      enabled: true,
      fn: fn,
      alt: opt.alt || []
    });

    this.__cache__ = null;
  };
  /**
   * Ruler.push(ruleName, fn [, options])
   * - ruleName (String): name of added rule.
   * - fn (Function): rule function.
   * - options (Object): rule options (not mandatory).
   *
   * Push new rule to the end of chain. See also
   * [[Ruler.before]], [[Ruler.after]].
   *
   * ##### Options:
   *
   * - __alt__ - array with names of "alternate" chains.
   *
   * ##### Example
   *
   * ```javascript
   * var md = require('markdown-it')();
   *
   * md.core.ruler.push('my_rule', function replace(state) {
   *   //...
   * });
   * ```
   **/


  Ruler.prototype.push = function (ruleName, fn, options) {
    var opt = options || {};

    this.__rules__.push({
      name: ruleName,
      enabled: true,
      fn: fn,
      alt: opt.alt || []
    });

    this.__cache__ = null;
  };
  /**
   * Ruler.enable(list [, ignoreInvalid]) -> Array
   * - list (String|Array): list of rule names to enable.
   * - ignoreInvalid (Boolean): set `true` to ignore errors when rule not found.
   *
   * Enable rules with given names. If any rule name not found - throw Error.
   * Errors can be disabled by second param.
   *
   * Returns list of found rule names (if no exception happened).
   *
   * See also [[Ruler.disable]], [[Ruler.enableOnly]].
   **/


  Ruler.prototype.enable = function (list, ignoreInvalid) {
    if (!Array.isArray(list)) {
      list = [list];
    }

    var result = []; // Search by name and enable

    list.forEach(function (name) {
      var idx = this.__find__(name);

      if (idx < 0) {
        if (ignoreInvalid) {
          return;
        }

        throw new Error('Rules manager: invalid rule name ' + name);
      }

      this.__rules__[idx].enabled = true;
      result.push(name);
    }, this);
    this.__cache__ = null;
    return result;
  };
  /**
   * Ruler.enableOnly(list [, ignoreInvalid])
   * - list (String|Array): list of rule names to enable (whitelist).
   * - ignoreInvalid (Boolean): set `true` to ignore errors when rule not found.
   *
   * Enable rules with given names, and disable everything else. If any rule name
   * not found - throw Error. Errors can be disabled by second param.
   *
   * See also [[Ruler.disable]], [[Ruler.enable]].
   **/


  Ruler.prototype.enableOnly = function (list, ignoreInvalid) {
    if (!Array.isArray(list)) {
      list = [list];
    }

    this.__rules__.forEach(function (rule) {
      rule.enabled = false;
    });

    this.enable(list, ignoreInvalid);
  };
  /**
   * Ruler.disable(list [, ignoreInvalid]) -> Array
   * - list (String|Array): list of rule names to disable.
   * - ignoreInvalid (Boolean): set `true` to ignore errors when rule not found.
   *
   * Disable rules with given names. If any rule name not found - throw Error.
   * Errors can be disabled by second param.
   *
   * Returns list of found rule names (if no exception happened).
   *
   * See also [[Ruler.enable]], [[Ruler.enableOnly]].
   **/


  Ruler.prototype.disable = function (list, ignoreInvalid) {
    if (!Array.isArray(list)) {
      list = [list];
    }

    var result = []; // Search by name and disable

    list.forEach(function (name) {
      var idx = this.__find__(name);

      if (idx < 0) {
        if (ignoreInvalid) {
          return;
        }

        throw new Error('Rules manager: invalid rule name ' + name);
      }

      this.__rules__[idx].enabled = false;
      result.push(name);
    }, this);
    this.__cache__ = null;
    return result;
  };
  /**
   * Ruler.getRules(chainName) -> Array
   *
   * Return array of active functions (rules) for given chain name. It analyzes
   * rules configuration, compiles caches if not exists and returns result.
   *
   * Default chain name is `''` (empty string). It can't be skipped. That's
   * done intentionally, to keep signature monomorphic for high speed.
   **/


  Ruler.prototype.getRules = function (chainName) {
    if (this.__cache__ === null) {
      this.__compile__();
    } // Chain can be empty, if rules disabled. But we still have to return Array.


    return this.__cache__[chainName] || [];
  };

  var ruler = Ruler;

  // Normalize input string

  var NEWLINES_RE = /\r\n?|\n/g;
  var NULL_RE = /\0/g;

  var normalize = function normalize(state) {
    var str; // Normalize newlines

    str = state.src.replace(NEWLINES_RE, '\n'); // Replace NULL characters

    str = str.replace(NULL_RE, '\uFFFD');
    state.src = str;
  };

  var block$1 = function block(state) {
    var token;

    if (state.inlineMode) {
      token = new state.Token('inline', '', 0);
      token.content = state.src;
      token.map = [0, 1];
      token.children = [];
      state.tokens.push(token);
    } else {
      state.md.block.parse(state.src, state.md, state.env, state.tokens);
    }
  };

  var inline = function inline(state) {
    var tokens = state.tokens,
        tok,
        i,
        l; // Parse inlines

    for (i = 0, l = tokens.length; i < l; i++) {
      tok = tokens[i];

      if (tok.type === 'inline') {
        state.md.inline.parse(tok.content, state.md, state.env, tok.children);
      }
    }
  };

  var arrayReplaceAt = utils.arrayReplaceAt;

  function isLinkOpen(str) {
    return /^<a[>\s]/i.test(str);
  }

  function isLinkClose(str) {
    return /^<\/a\s*>/i.test(str);
  }

  var linkify = function linkify(state) {
    var i,
        j,
        l,
        tokens,
        token,
        currentToken,
        nodes,
        ln,
        text,
        pos,
        lastPos,
        level,
        htmlLinkLevel,
        url,
        fullUrl,
        urlText,
        blockTokens = state.tokens,
        links;

    if (!state.md.options.linkify) {
      return;
    }

    for (j = 0, l = blockTokens.length; j < l; j++) {
      if (blockTokens[j].type !== 'inline' || !state.md.linkify.pretest(blockTokens[j].content)) {
        continue;
      }

      tokens = blockTokens[j].children;
      htmlLinkLevel = 0; // We scan from the end, to keep position when new tags added.
      // Use reversed logic in links start/end match

      for (i = tokens.length - 1; i >= 0; i--) {
        currentToken = tokens[i]; // Skip content of markdown links

        if (currentToken.type === 'link_close') {
          i--;

          while (tokens[i].level !== currentToken.level && tokens[i].type !== 'link_open') {
            i--;
          }

          continue;
        } // Skip content of html tag links


        if (currentToken.type === 'html_inline') {
          if (isLinkOpen(currentToken.content) && htmlLinkLevel > 0) {
            htmlLinkLevel--;
          }

          if (isLinkClose(currentToken.content)) {
            htmlLinkLevel++;
          }
        }

        if (htmlLinkLevel > 0) {
          continue;
        }

        if (currentToken.type === 'text' && state.md.linkify.test(currentToken.content)) {
          text = currentToken.content;
          links = state.md.linkify.match(text); // Now split string to nodes

          nodes = [];
          level = currentToken.level;
          lastPos = 0;

          for (ln = 0; ln < links.length; ln++) {
            url = links[ln].url;
            fullUrl = state.md.normalizeLink(url);

            if (!state.md.validateLink(fullUrl)) {
              continue;
            }

            urlText = links[ln].text; // Linkifier might send raw hostnames like "example.com", where url
            // starts with domain name. So we prepend http:// in those cases,
            // and remove it afterwards.
            //

            if (!links[ln].schema) {
              urlText = state.md.normalizeLinkText('http://' + urlText).replace(/^http:\/\//, '');
            } else if (links[ln].schema === 'mailto:' && !/^mailto:/i.test(urlText)) {
              urlText = state.md.normalizeLinkText('mailto:' + urlText).replace(/^mailto:/, '');
            } else {
              urlText = state.md.normalizeLinkText(urlText);
            }

            pos = links[ln].index;

            if (pos > lastPos) {
              token = new state.Token('text', '', 0);
              token.content = text.slice(lastPos, pos);
              token.level = level;
              nodes.push(token);
            }

            token = new state.Token('link_open', 'a', 1);
            token.attrs = [['href', fullUrl]];
            token.level = level++;
            token.markup = 'linkify';
            token.info = 'auto';
            nodes.push(token);
            token = new state.Token('text', '', 0);
            token.content = urlText;
            token.level = level;
            nodes.push(token);
            token = new state.Token('link_close', 'a', -1);
            token.level = --level;
            token.markup = 'linkify';
            token.info = 'auto';
            nodes.push(token);
            lastPos = links[ln].lastIndex;
          }

          if (lastPos < text.length) {
            token = new state.Token('text', '', 0);
            token.content = text.slice(lastPos);
            token.level = level;
            nodes.push(token);
          } // replace current node


          blockTokens[j].children = tokens = arrayReplaceAt(tokens, i, nodes);
        }
      }
    }
  };

  // Simple typographic replacements
  // - fractionals 1/2, 1/4, 3/4 -> ½, ¼, ¾
  // - miltiplication 2 x 4 -> 2 × 4

  var RARE_RE = /\+-|\.\.|\?\?\?\?|!!!!|,,|--/; // Workaround for phantomjs - need regex without /g flag,
  // or root check will fail every second time

  var SCOPED_ABBR_TEST_RE = /\((c|tm|r|p)\)/i;
  var SCOPED_ABBR_RE = /\((c|tm|r|p)\)/ig;
  var SCOPED_ABBR = {
    c: '©',
    r: '®',
    p: '§',
    tm: '™'
  };

  function replaceFn(match, name) {
    return SCOPED_ABBR[name.toLowerCase()];
  }

  function replace_scoped(inlineTokens) {
    var i,
        token,
        inside_autolink = 0;

    for (i = inlineTokens.length - 1; i >= 0; i--) {
      token = inlineTokens[i];

      if (token.type === 'text' && !inside_autolink) {
        token.content = token.content.replace(SCOPED_ABBR_RE, replaceFn);
      }

      if (token.type === 'link_open' && token.info === 'auto') {
        inside_autolink--;
      }

      if (token.type === 'link_close' && token.info === 'auto') {
        inside_autolink++;
      }
    }
  }

  function replace_rare(inlineTokens) {
    var i,
        token,
        inside_autolink = 0;

    for (i = inlineTokens.length - 1; i >= 0; i--) {
      token = inlineTokens[i];

      if (token.type === 'text' && !inside_autolink) {
        if (RARE_RE.test(token.content)) {
          token.content = token.content.replace(/\+-/g, '±') // .., ..., ....... -> …
          // but ?..... & !..... -> ?.. & !..
          .replace(/\.{2,}/g, '…').replace(/([?!])…/g, '$1..').replace(/([?!]){4,}/g, '$1$1$1').replace(/,{2,}/g, ',') // em-dash
          .replace(/(^|[^-])---([^-]|$)/mg, '$1\u2014$2') // en-dash
          .replace(/(^|\s)--(\s|$)/mg, '$1\u2013$2').replace(/(^|[^-\s])--([^-\s]|$)/mg, '$1\u2013$2');
        }
      }

      if (token.type === 'link_open' && token.info === 'auto') {
        inside_autolink--;
      }

      if (token.type === 'link_close' && token.info === 'auto') {
        inside_autolink++;
      }
    }
  }

  var replacements = function replace(state) {
    var blkIdx;

    if (!state.md.options.typographer) {
      return;
    }

    for (blkIdx = state.tokens.length - 1; blkIdx >= 0; blkIdx--) {
      if (state.tokens[blkIdx].type !== 'inline') {
        continue;
      }

      if (SCOPED_ABBR_TEST_RE.test(state.tokens[blkIdx].content)) {
        replace_scoped(state.tokens[blkIdx].children);
      }

      if (RARE_RE.test(state.tokens[blkIdx].content)) {
        replace_rare(state.tokens[blkIdx].children);
      }
    }
  };

  var isWhiteSpace = utils.isWhiteSpace;

  var isPunctChar = utils.isPunctChar;

  var isMdAsciiPunct = utils.isMdAsciiPunct;

  var QUOTE_TEST_RE = /['"]/;
  var QUOTE_RE = /['"]/g;
  var APOSTROPHE = '\u2019';
  /* ’ */

  function replaceAt(str, index, ch) {
    return str.substr(0, index) + ch + str.substr(index + 1);
  }

  function process_inlines(tokens, state) {
    var i, token, text, t, pos, max, thisLevel, item, lastChar, nextChar, isLastPunctChar, isNextPunctChar, isLastWhiteSpace, isNextWhiteSpace, canOpen, canClose, j, isSingle, stack, openQuote, closeQuote;
    stack = [];

    for (i = 0; i < tokens.length; i++) {
      token = tokens[i];
      thisLevel = tokens[i].level;

      for (j = stack.length - 1; j >= 0; j--) {
        if (stack[j].level <= thisLevel) {
          break;
        }
      }

      stack.length = j + 1;

      if (token.type !== 'text') {
        continue;
      }

      text = token.content;
      pos = 0;
      max = text.length;
      /*eslint no-labels:0,block-scoped-var:0*/

      OUTER: while (pos < max) {
        QUOTE_RE.lastIndex = pos;
        t = QUOTE_RE.exec(text);

        if (!t) {
          break;
        }

        canOpen = canClose = true;
        pos = t.index + 1;
        isSingle = t[0] === "'"; // Find previous character,
        // default to space if it's the beginning of the line
        //

        lastChar = 0x20;

        if (t.index - 1 >= 0) {
          lastChar = text.charCodeAt(t.index - 1);
        } else {
          for (j = i - 1; j >= 0; j--) {
            if (tokens[j].type === 'softbreak' || tokens[j].type === 'hardbreak') break; // lastChar defaults to 0x20

            if (tokens[j].type !== 'text') continue;
            lastChar = tokens[j].content.charCodeAt(tokens[j].content.length - 1);
            break;
          }
        } // Find next character,
        // default to space if it's the end of the line
        //


        nextChar = 0x20;

        if (pos < max) {
          nextChar = text.charCodeAt(pos);
        } else {
          for (j = i + 1; j < tokens.length; j++) {
            if (tokens[j].type === 'softbreak' || tokens[j].type === 'hardbreak') break; // nextChar defaults to 0x20

            if (tokens[j].type !== 'text') continue;
            nextChar = tokens[j].content.charCodeAt(0);
            break;
          }
        }

        isLastPunctChar = isMdAsciiPunct(lastChar) || isPunctChar(String.fromCharCode(lastChar));
        isNextPunctChar = isMdAsciiPunct(nextChar) || isPunctChar(String.fromCharCode(nextChar));
        isLastWhiteSpace = isWhiteSpace(lastChar);
        isNextWhiteSpace = isWhiteSpace(nextChar);

        if (isNextWhiteSpace) {
          canOpen = false;
        } else if (isNextPunctChar) {
          if (!(isLastWhiteSpace || isLastPunctChar)) {
            canOpen = false;
          }
        }

        if (isLastWhiteSpace) {
          canClose = false;
        } else if (isLastPunctChar) {
          if (!(isNextWhiteSpace || isNextPunctChar)) {
            canClose = false;
          }
        }

        if (nextChar === 0x22
        /* " */
        && t[0] === '"') {
          if (lastChar >= 0x30
          /* 0 */
          && lastChar <= 0x39
          /* 9 */
          ) {
              // special case: 1"" - count first quote as an inch
              canClose = canOpen = false;
            }
        }

        if (canOpen && canClose) {
          // treat this as the middle of the word
          canOpen = false;
          canClose = isNextPunctChar;
        }

        if (!canOpen && !canClose) {
          // middle of word
          if (isSingle) {
            token.content = replaceAt(token.content, t.index, APOSTROPHE);
          }

          continue;
        }

        if (canClose) {
          // this could be a closing quote, rewind the stack to get a match
          for (j = stack.length - 1; j >= 0; j--) {
            item = stack[j];

            if (stack[j].level < thisLevel) {
              break;
            }

            if (item.single === isSingle && stack[j].level === thisLevel) {
              item = stack[j];

              if (isSingle) {
                openQuote = state.md.options.quotes[2];
                closeQuote = state.md.options.quotes[3];
              } else {
                openQuote = state.md.options.quotes[0];
                closeQuote = state.md.options.quotes[1];
              } // replace token.content *before* tokens[item.token].content,
              // because, if they are pointing at the same token, replaceAt
              // could mess up indices when quote length != 1


              token.content = replaceAt(token.content, t.index, closeQuote);
              tokens[item.token].content = replaceAt(tokens[item.token].content, item.pos, openQuote);
              pos += closeQuote.length - 1;

              if (item.token === i) {
                pos += openQuote.length - 1;
              }

              text = token.content;
              max = text.length;
              stack.length = j;
              continue OUTER;
            }
          }
        }

        if (canOpen) {
          stack.push({
            token: i,
            pos: t.index,
            single: isSingle,
            level: thisLevel
          });
        } else if (canClose && isSingle) {
          token.content = replaceAt(token.content, t.index, APOSTROPHE);
        }
      }
    }
  }

  var smartquotes = function smartquotes(state) {
    /*eslint max-depth:0*/
    var blkIdx;

    if (!state.md.options.typographer) {
      return;
    }

    for (blkIdx = state.tokens.length - 1; blkIdx >= 0; blkIdx--) {
      if (state.tokens[blkIdx].type !== 'inline' || !QUOTE_TEST_RE.test(state.tokens[blkIdx].content)) {
        continue;
      }

      process_inlines(state.tokens[blkIdx].children, state);
    }
  };

  // Token class
  /**
   * class Token
   **/

  /**
   * new Token(type, tag, nesting)
   *
   * Create new token and fill passed properties.
   **/

  function Token(type, tag, nesting) {
    /**
     * Token#type -> String
     *
     * Type of the token (string, e.g. "paragraph_open")
     **/
    this.type = type;
    /**
     * Token#tag -> String
     *
     * html tag name, e.g. "p"
     **/

    this.tag = tag;
    /**
     * Token#attrs -> Array
     *
     * Html attributes. Format: `[ [ name1, value1 ], [ name2, value2 ] ]`
     **/

    this.attrs = null;
    /**
     * Token#map -> Array
     *
     * Source map info. Format: `[ line_begin, line_end ]`
     **/

    this.map = null;
    /**
     * Token#nesting -> Number
     *
     * Level change (number in {-1, 0, 1} set), where:
     *
     * -  `1` means the tag is opening
     * -  `0` means the tag is self-closing
     * - `-1` means the tag is closing
     **/

    this.nesting = nesting;
    /**
     * Token#level -> Number
     *
     * nesting level, the same as `state.level`
     **/

    this.level = 0;
    /**
     * Token#children -> Array
     *
     * An array of child nodes (inline and img tokens)
     **/

    this.children = null;
    /**
     * Token#content -> String
     *
     * In a case of self-closing tag (code, html, fence, etc.),
     * it has contents of this tag.
     **/

    this.content = '';
    /**
     * Token#markup -> String
     *
     * '*' or '_' for emphasis, fence string for fence, etc.
     **/

    this.markup = '';
    /**
     * Token#info -> String
     *
     * fence infostring
     **/

    this.info = '';
    /**
     * Token#meta -> Object
     *
     * A place for plugins to store an arbitrary data
     **/

    this.meta = null;
    /**
     * Token#block -> Boolean
     *
     * True for block-level tokens, false for inline tokens.
     * Used in renderer to calculate line breaks
     **/

    this.block = false;
    /**
     * Token#hidden -> Boolean
     *
     * If it's true, ignore this element when rendering. Used for tight lists
     * to hide paragraphs.
     **/

    this.hidden = false;
  }
  /**
   * Token.attrIndex(name) -> Number
   *
   * Search attribute index by name.
   **/


  Token.prototype.attrIndex = function attrIndex(name) {
    var attrs, i, len;

    if (!this.attrs) {
      return -1;
    }

    attrs = this.attrs;

    for (i = 0, len = attrs.length; i < len; i++) {
      if (attrs[i][0] === name) {
        return i;
      }
    }

    return -1;
  };
  /**
   * Token.attrPush(attrData)
   *
   * Add `[ name, value ]` attribute to list. Init attrs if necessary
   **/


  Token.prototype.attrPush = function attrPush(attrData) {
    if (this.attrs) {
      this.attrs.push(attrData);
    } else {
      this.attrs = [attrData];
    }
  };
  /**
   * Token.attrSet(name, value)
   *
   * Set `name` attribute to `value`. Override old value if exists.
   **/


  Token.prototype.attrSet = function attrSet(name, value) {
    var idx = this.attrIndex(name),
        attrData = [name, value];

    if (idx < 0) {
      this.attrPush(attrData);
    } else {
      this.attrs[idx] = attrData;
    }
  };
  /**
   * Token.attrGet(name)
   *
   * Get the value of attribute `name`, or null if it does not exist.
   **/


  Token.prototype.attrGet = function attrGet(name) {
    var idx = this.attrIndex(name),
        value = null;

    if (idx >= 0) {
      value = this.attrs[idx][1];
    }

    return value;
  };
  /**
   * Token.attrJoin(name, value)
   *
   * Join value to existing attribute via space. Or create new attribute if not
   * exists. Useful to operate with token classes.
   **/


  Token.prototype.attrJoin = function attrJoin(name, value) {
    var idx = this.attrIndex(name);

    if (idx < 0) {
      this.attrPush([name, value]);
    } else {
      this.attrs[idx][1] = this.attrs[idx][1] + ' ' + value;
    }
  };

  var token = Token;

  function StateCore(src, md, env) {
    this.src = src;
    this.env = env;
    this.tokens = [];
    this.inlineMode = false;
    this.md = md; // link to parser instance
  } // re-export Token class to use in core rules


  StateCore.prototype.Token = token;
  var state_core = StateCore;

  var _rules = [['normalize', normalize], ['block', block$1], ['inline', inline], ['linkify', linkify], ['replacements', replacements], ['smartquotes', smartquotes]];
  /**
   * new Core()
   **/

  function Core() {
    /**
     * Core#ruler -> Ruler
     *
     * [[Ruler]] instance. Keep configuration of core rules.
     **/
    this.ruler = new ruler();

    for (var i = 0; i < _rules.length; i++) {
      this.ruler.push(_rules[i][0], _rules[i][1]);
    }
  }
  /**
   * Core.process(state)
   *
   * Executes core chain rules.
   **/


  Core.prototype.process = function (state) {
    var i, l, rules;
    rules = this.ruler.getRules('');

    for (i = 0, l = rules.length; i < l; i++) {
      rules[i](state);
    }
  };

  Core.prototype.State = state_core;
  var parser_core = Core;

  var isSpace = utils.isSpace;

  function getLine(state, line) {
    var pos = state.bMarks[line] + state.blkIndent,
        max = state.eMarks[line];
    return state.src.substr(pos, max - pos);
  }

  function escapedSplit(str) {
    var result = [],
        pos = 0,
        max = str.length,
        ch,
        escapes = 0,
        lastPos = 0,
        backTicked = false,
        lastBackTick = 0;
    ch = str.charCodeAt(pos);

    while (pos < max) {
      if (ch === 0x60
      /* ` */
      ) {
          if (backTicked) {
            // make \` close code sequence, but not open it;
            // the reason is: `\` is correct code block
            backTicked = false;
            lastBackTick = pos;
          } else if (escapes % 2 === 0) {
            backTicked = true;
            lastBackTick = pos;
          }
        } else if (ch === 0x7c
      /* | */
      && escapes % 2 === 0 && !backTicked) {
        result.push(str.substring(lastPos, pos));
        lastPos = pos + 1;
      }

      if (ch === 0x5c
      /* \ */
      ) {
          escapes++;
        } else {
        escapes = 0;
      }

      pos++; // If there was an un-closed backtick, go back to just after
      // the last backtick, but as if it was a normal character

      if (pos === max && backTicked) {
        backTicked = false;
        pos = lastBackTick + 1;
      }

      ch = str.charCodeAt(pos);
    }

    result.push(str.substring(lastPos));
    return result;
  }

  var table = function table(state, startLine, endLine, silent) {
    var ch, lineText, pos, i, nextLine, columns, columnCount, token, aligns, t, tableLines, tbodyLines; // should have at least two lines

    if (startLine + 2 > endLine) {
      return false;
    }

    nextLine = startLine + 1;

    if (state.sCount[nextLine] < state.blkIndent) {
      return false;
    } // if it's indented more than 3 spaces, it should be a code block


    if (state.sCount[nextLine] - state.blkIndent >= 4) {
      return false;
    } // first character of the second line should be '|', '-', ':',
    // and no other characters are allowed but spaces;
    // basically, this is the equivalent of /^[-:|][-:|\s]*$/ regexp


    pos = state.bMarks[nextLine] + state.tShift[nextLine];

    if (pos >= state.eMarks[nextLine]) {
      return false;
    }

    ch = state.src.charCodeAt(pos++);

    if (ch !== 0x7C
    /* | */
    && ch !== 0x2D
    /* - */
    && ch !== 0x3A
    /* : */
    ) {
        return false;
      }

    while (pos < state.eMarks[nextLine]) {
      ch = state.src.charCodeAt(pos);

      if (ch !== 0x7C
      /* | */
      && ch !== 0x2D
      /* - */
      && ch !== 0x3A
      /* : */
      && !isSpace(ch)) {
        return false;
      }

      pos++;
    }

    lineText = getLine(state, startLine + 1);
    columns = lineText.split('|');
    aligns = [];

    for (i = 0; i < columns.length; i++) {
      t = columns[i].trim();

      if (!t) {
        // allow empty columns before and after table, but not in between columns;
        // e.g. allow ` |---| `, disallow ` ---||--- `
        if (i === 0 || i === columns.length - 1) {
          continue;
        } else {
          return false;
        }
      }

      if (!/^:?-+:?$/.test(t)) {
        return false;
      }

      if (t.charCodeAt(t.length - 1) === 0x3A
      /* : */
      ) {
          aligns.push(t.charCodeAt(0) === 0x3A
          /* : */
          ? 'center' : 'right');
        } else if (t.charCodeAt(0) === 0x3A
      /* : */
      ) {
          aligns.push('left');
        } else {
        aligns.push('');
      }
    }

    lineText = getLine(state, startLine).trim();

    if (lineText.indexOf('|') === -1) {
      return false;
    }

    if (state.sCount[startLine] - state.blkIndent >= 4) {
      return false;
    }

    columns = escapedSplit(lineText.replace(/^\||\|$/g, '')); // header row will define an amount of columns in the entire table,
    // and align row shouldn't be smaller than that (the rest of the rows can)

    columnCount = columns.length;

    if (columnCount > aligns.length) {
      return false;
    }

    if (silent) {
      return true;
    }

    token = state.push('table_open', 'table', 1);
    token.map = tableLines = [startLine, 0];
    token = state.push('thead_open', 'thead', 1);
    token.map = [startLine, startLine + 1];
    token = state.push('tr_open', 'tr', 1);
    token.map = [startLine, startLine + 1];

    for (i = 0; i < columns.length; i++) {
      token = state.push('th_open', 'th', 1);
      token.map = [startLine, startLine + 1];

      if (aligns[i]) {
        token.attrs = [['style', 'text-align:' + aligns[i]]];
      }

      token = state.push('inline', '', 0);
      token.content = columns[i].trim();
      token.map = [startLine, startLine + 1];
      token.children = [];
      token = state.push('th_close', 'th', -1);
    }

    token = state.push('tr_close', 'tr', -1);
    token = state.push('thead_close', 'thead', -1);
    token = state.push('tbody_open', 'tbody', 1);
    token.map = tbodyLines = [startLine + 2, 0];

    for (nextLine = startLine + 2; nextLine < endLine; nextLine++) {
      if (state.sCount[nextLine] < state.blkIndent) {
        break;
      }

      lineText = getLine(state, nextLine).trim();

      if (lineText.indexOf('|') === -1) {
        break;
      }

      if (state.sCount[nextLine] - state.blkIndent >= 4) {
        break;
      }

      columns = escapedSplit(lineText.replace(/^\||\|$/g, ''));
      token = state.push('tr_open', 'tr', 1);

      for (i = 0; i < columnCount; i++) {
        token = state.push('td_open', 'td', 1);

        if (aligns[i]) {
          token.attrs = [['style', 'text-align:' + aligns[i]]];
        }

        token = state.push('inline', '', 0);
        token.content = columns[i] ? columns[i].trim() : '';
        token.children = [];
        token = state.push('td_close', 'td', -1);
      }

      token = state.push('tr_close', 'tr', -1);
    }

    token = state.push('tbody_close', 'tbody', -1);
    token = state.push('table_close', 'table', -1);
    tableLines[1] = tbodyLines[1] = nextLine;
    state.line = nextLine;
    return true;
  };

  // Code block (4 spaces padded)

  var code = function code(state, startLine, endLine
  /*, silent*/
  ) {
    var nextLine, last, token;

    if (state.sCount[startLine] - state.blkIndent < 4) {
      return false;
    }

    last = nextLine = startLine + 1;

    while (nextLine < endLine) {
      if (state.isEmpty(nextLine)) {
        nextLine++;
        continue;
      }

      if (state.sCount[nextLine] - state.blkIndent >= 4) {
        nextLine++;
        last = nextLine;
        continue;
      }

      break;
    }

    state.line = last;
    token = state.push('code_block', 'code', 0);
    token.content = state.getLines(startLine, last, 4 + state.blkIndent, true);
    token.map = [startLine, state.line];
    return true;
  };

  // fences (``` lang, ~~~ lang)

  var fence = function fence(state, startLine, endLine, silent) {
    var marker,
        len,
        params,
        nextLine,
        mem,
        token,
        markup,
        haveEndMarker = false,
        pos = state.bMarks[startLine] + state.tShift[startLine],
        max = state.eMarks[startLine]; // if it's indented more than 3 spaces, it should be a code block

    if (state.sCount[startLine] - state.blkIndent >= 4) {
      return false;
    }

    if (pos + 3 > max) {
      return false;
    }

    marker = state.src.charCodeAt(pos);

    if (marker !== 0x7E
    /* ~ */
    && marker !== 0x60
    /* ` */
    ) {
        return false;
      } // scan marker length


    mem = pos;
    pos = state.skipChars(pos, marker);
    len = pos - mem;

    if (len < 3) {
      return false;
    }

    markup = state.src.slice(mem, pos);
    params = state.src.slice(pos, max);

    if (marker === 0x60
    /* ` */
    ) {
        if (params.indexOf(String.fromCharCode(marker)) >= 0) {
          return false;
        }
      } // Since start is found, we can report success here in validation mode


    if (silent) {
      return true;
    } // search end of block


    nextLine = startLine;

    for (;;) {
      nextLine++;

      if (nextLine >= endLine) {
        // unclosed block should be autoclosed by end of document.
        // also block seems to be autoclosed by end of parent
        break;
      }

      pos = mem = state.bMarks[nextLine] + state.tShift[nextLine];
      max = state.eMarks[nextLine];

      if (pos < max && state.sCount[nextLine] < state.blkIndent) {
        // non-empty line with negative indent should stop the list:
        // - ```
        //  test
        break;
      }

      if (state.src.charCodeAt(pos) !== marker) {
        continue;
      }

      if (state.sCount[nextLine] - state.blkIndent >= 4) {
        // closing fence should be indented less than 4 spaces
        continue;
      }

      pos = state.skipChars(pos, marker); // closing code fence must be at least as long as the opening one

      if (pos - mem < len) {
        continue;
      } // make sure tail has spaces only


      pos = state.skipSpaces(pos);

      if (pos < max) {
        continue;
      }

      haveEndMarker = true; // found!

      break;
    } // If a fence has heading spaces, they should be removed from its inner block


    len = state.sCount[startLine];
    state.line = nextLine + (haveEndMarker ? 1 : 0);
    token = state.push('fence', 'code', 0);
    token.info = params;
    token.content = state.getLines(startLine + 1, nextLine, len, true);
    token.markup = markup;
    token.map = [startLine, state.line];
    return true;
  };

  var isSpace$1 = utils.isSpace;

  var blockquote = function blockquote(state, startLine, endLine, silent) {
    var adjustTab,
        ch,
        i,
        initial,
        l,
        lastLineEmpty,
        lines,
        nextLine,
        offset,
        oldBMarks,
        oldBSCount,
        oldIndent,
        oldParentType,
        oldSCount,
        oldTShift,
        spaceAfterMarker,
        terminate,
        terminatorRules,
        token,
        wasOutdented,
        oldLineMax = state.lineMax,
        pos = state.bMarks[startLine] + state.tShift[startLine],
        max = state.eMarks[startLine]; // if it's indented more than 3 spaces, it should be a code block

    if (state.sCount[startLine] - state.blkIndent >= 4) {
      return false;
    } // check the block quote marker


    if (state.src.charCodeAt(pos++) !== 0x3E
    /* > */
    ) {
        return false;
      } // we know that it's going to be a valid blockquote,
    // so no point trying to find the end of it in silent mode


    if (silent) {
      return true;
    } // skip spaces after ">" and re-calculate offset


    initial = offset = state.sCount[startLine] + pos - (state.bMarks[startLine] + state.tShift[startLine]); // skip one optional space after '>'

    if (state.src.charCodeAt(pos) === 0x20
    /* space */
    ) {
        // ' >   test '
        //     ^ -- position start of line here:
        pos++;
        initial++;
        offset++;
        adjustTab = false;
        spaceAfterMarker = true;
      } else if (state.src.charCodeAt(pos) === 0x09
    /* tab */
    ) {
        spaceAfterMarker = true;

        if ((state.bsCount[startLine] + offset) % 4 === 3) {
          // '  >\t  test '
          //       ^ -- position start of line here (tab has width===1)
          pos++;
          initial++;
          offset++;
          adjustTab = false;
        } else {
          // ' >\t  test '
          //    ^ -- position start of line here + shift bsCount slightly
          //         to make extra space appear
          adjustTab = true;
        }
      } else {
      spaceAfterMarker = false;
    }

    oldBMarks = [state.bMarks[startLine]];
    state.bMarks[startLine] = pos;

    while (pos < max) {
      ch = state.src.charCodeAt(pos);

      if (isSpace$1(ch)) {
        if (ch === 0x09) {
          offset += 4 - (offset + state.bsCount[startLine] + (adjustTab ? 1 : 0)) % 4;
        } else {
          offset++;
        }
      } else {
        break;
      }

      pos++;
    }

    oldBSCount = [state.bsCount[startLine]];
    state.bsCount[startLine] = state.sCount[startLine] + 1 + (spaceAfterMarker ? 1 : 0);
    lastLineEmpty = pos >= max;
    oldSCount = [state.sCount[startLine]];
    state.sCount[startLine] = offset - initial;
    oldTShift = [state.tShift[startLine]];
    state.tShift[startLine] = pos - state.bMarks[startLine];
    terminatorRules = state.md.block.ruler.getRules('blockquote');
    oldParentType = state.parentType;
    state.parentType = 'blockquote';
    wasOutdented = false; // Search the end of the block
    //
    // Block ends with either:
    //  1. an empty line outside:
    //     ```
    //     > test
    //
    //     ```
    //  2. an empty line inside:
    //     ```
    //     >
    //     test
    //     ```
    //  3. another tag:
    //     ```
    //     > test
    //      - - -
    //     ```

    for (nextLine = startLine + 1; nextLine < endLine; nextLine++) {
      // check if it's outdented, i.e. it's inside list item and indented
      // less than said list item:
      //
      // ```
      // 1. anything
      //    > current blockquote
      // 2. checking this line
      // ```
      if (state.sCount[nextLine] < state.blkIndent) wasOutdented = true;
      pos = state.bMarks[nextLine] + state.tShift[nextLine];
      max = state.eMarks[nextLine];

      if (pos >= max) {
        // Case 1: line is not inside the blockquote, and this line is empty.
        break;
      }

      if (state.src.charCodeAt(pos++) === 0x3E
      /* > */
      && !wasOutdented) {
        // This line is inside the blockquote.
        // skip spaces after ">" and re-calculate offset
        initial = offset = state.sCount[nextLine] + pos - (state.bMarks[nextLine] + state.tShift[nextLine]); // skip one optional space after '>'

        if (state.src.charCodeAt(pos) === 0x20
        /* space */
        ) {
            // ' >   test '
            //     ^ -- position start of line here:
            pos++;
            initial++;
            offset++;
            adjustTab = false;
            spaceAfterMarker = true;
          } else if (state.src.charCodeAt(pos) === 0x09
        /* tab */
        ) {
            spaceAfterMarker = true;

            if ((state.bsCount[nextLine] + offset) % 4 === 3) {
              // '  >\t  test '
              //       ^ -- position start of line here (tab has width===1)
              pos++;
              initial++;
              offset++;
              adjustTab = false;
            } else {
              // ' >\t  test '
              //    ^ -- position start of line here + shift bsCount slightly
              //         to make extra space appear
              adjustTab = true;
            }
          } else {
          spaceAfterMarker = false;
        }

        oldBMarks.push(state.bMarks[nextLine]);
        state.bMarks[nextLine] = pos;

        while (pos < max) {
          ch = state.src.charCodeAt(pos);

          if (isSpace$1(ch)) {
            if (ch === 0x09) {
              offset += 4 - (offset + state.bsCount[nextLine] + (adjustTab ? 1 : 0)) % 4;
            } else {
              offset++;
            }
          } else {
            break;
          }

          pos++;
        }

        lastLineEmpty = pos >= max;
        oldBSCount.push(state.bsCount[nextLine]);
        state.bsCount[nextLine] = state.sCount[nextLine] + 1 + (spaceAfterMarker ? 1 : 0);
        oldSCount.push(state.sCount[nextLine]);
        state.sCount[nextLine] = offset - initial;
        oldTShift.push(state.tShift[nextLine]);
        state.tShift[nextLine] = pos - state.bMarks[nextLine];
        continue;
      } // Case 2: line is not inside the blockquote, and the last line was empty.


      if (lastLineEmpty) {
        break;
      } // Case 3: another tag found.


      terminate = false;

      for (i = 0, l = terminatorRules.length; i < l; i++) {
        if (terminatorRules[i](state, nextLine, endLine, true)) {
          terminate = true;
          break;
        }
      }

      if (terminate) {
        // Quirk to enforce "hard termination mode" for paragraphs;
        // normally if you call `tokenize(state, startLine, nextLine)`,
        // paragraphs will look below nextLine for paragraph continuation,
        // but if blockquote is terminated by another tag, they shouldn't
        state.lineMax = nextLine;

        if (state.blkIndent !== 0) {
          // state.blkIndent was non-zero, we now set it to zero,
          // so we need to re-calculate all offsets to appear as
          // if indent wasn't changed
          oldBMarks.push(state.bMarks[nextLine]);
          oldBSCount.push(state.bsCount[nextLine]);
          oldTShift.push(state.tShift[nextLine]);
          oldSCount.push(state.sCount[nextLine]);
          state.sCount[nextLine] -= state.blkIndent;
        }

        break;
      }

      oldBMarks.push(state.bMarks[nextLine]);
      oldBSCount.push(state.bsCount[nextLine]);
      oldTShift.push(state.tShift[nextLine]);
      oldSCount.push(state.sCount[nextLine]); // A negative indentation means that this is a paragraph continuation
      //

      state.sCount[nextLine] = -1;
    }

    oldIndent = state.blkIndent;
    state.blkIndent = 0;
    token = state.push('blockquote_open', 'blockquote', 1);
    token.markup = '>';
    token.map = lines = [startLine, 0];
    state.md.block.tokenize(state, startLine, nextLine);
    token = state.push('blockquote_close', 'blockquote', -1);
    token.markup = '>';
    state.lineMax = oldLineMax;
    state.parentType = oldParentType;
    lines[1] = state.line; // Restore original tShift; this might not be necessary since the parser
    // has already been here, but just to make sure we can do that.

    for (i = 0; i < oldTShift.length; i++) {
      state.bMarks[i + startLine] = oldBMarks[i];
      state.tShift[i + startLine] = oldTShift[i];
      state.sCount[i + startLine] = oldSCount[i];
      state.bsCount[i + startLine] = oldBSCount[i];
    }

    state.blkIndent = oldIndent;
    return true;
  };

  var isSpace$2 = utils.isSpace;

  var hr = function hr(state, startLine, endLine, silent) {
    var marker,
        cnt,
        ch,
        token,
        pos = state.bMarks[startLine] + state.tShift[startLine],
        max = state.eMarks[startLine]; // if it's indented more than 3 spaces, it should be a code block

    if (state.sCount[startLine] - state.blkIndent >= 4) {
      return false;
    }

    marker = state.src.charCodeAt(pos++); // Check hr marker

    if (marker !== 0x2A
    /* * */
    && marker !== 0x2D
    /* - */
    && marker !== 0x5F
    /* _ */
    ) {
        return false;
      } // markers can be mixed with spaces, but there should be at least 3 of them


    cnt = 1;

    while (pos < max) {
      ch = state.src.charCodeAt(pos++);

      if (ch !== marker && !isSpace$2(ch)) {
        return false;
      }

      if (ch === marker) {
        cnt++;
      }
    }

    if (cnt < 3) {
      return false;
    }

    if (silent) {
      return true;
    }

    state.line = startLine + 1;
    token = state.push('hr', 'hr', 0);
    token.map = [startLine, state.line];
    token.markup = Array(cnt + 1).join(String.fromCharCode(marker));
    return true;
  };

  var isSpace$3 = utils.isSpace; // Search `[-+*][\n ]`, returns next pos after marker on success
  // or -1 on fail.


  function skipBulletListMarker(state, startLine) {
    var marker, pos, max, ch;
    pos = state.bMarks[startLine] + state.tShift[startLine];
    max = state.eMarks[startLine];
    marker = state.src.charCodeAt(pos++); // Check bullet

    if (marker !== 0x2A
    /* * */
    && marker !== 0x2D
    /* - */
    && marker !== 0x2B
    /* + */
    ) {
        return -1;
      }

    if (pos < max) {
      ch = state.src.charCodeAt(pos);

      if (!isSpace$3(ch)) {
        // " -test " - is not a list item
        return -1;
      }
    }

    return pos;
  } // Search `\d+[.)][\n ]`, returns next pos after marker on success
  // or -1 on fail.


  function skipOrderedListMarker(state, startLine) {
    var ch,
        start = state.bMarks[startLine] + state.tShift[startLine],
        pos = start,
        max = state.eMarks[startLine]; // List marker should have at least 2 chars (digit + dot)

    if (pos + 1 >= max) {
      return -1;
    }

    ch = state.src.charCodeAt(pos++);

    if (ch < 0x30
    /* 0 */
    || ch > 0x39
    /* 9 */
    ) {
        return -1;
      }

    for (;;) {
      // EOL -> fail
      if (pos >= max) {
        return -1;
      }

      ch = state.src.charCodeAt(pos++);

      if (ch >= 0x30
      /* 0 */
      && ch <= 0x39
      /* 9 */
      ) {
          // List marker should have no more than 9 digits
          // (prevents integer overflow in browsers)
          if (pos - start >= 10) {
            return -1;
          }

          continue;
        } // found valid marker


      if (ch === 0x29
      /* ) */
      || ch === 0x2e
      /* . */
      ) {
          break;
        }

      return -1;
    }

    if (pos < max) {
      ch = state.src.charCodeAt(pos);

      if (!isSpace$3(ch)) {
        // " 1.test " - is not a list item
        return -1;
      }
    }

    return pos;
  }

  function markTightParagraphs(state, idx) {
    var i,
        l,
        level = state.level + 2;

    for (i = idx + 2, l = state.tokens.length - 2; i < l; i++) {
      if (state.tokens[i].level === level && state.tokens[i].type === 'paragraph_open') {
        state.tokens[i + 2].hidden = true;
        state.tokens[i].hidden = true;
        i += 2;
      }
    }
  }

  var list = function list(state, startLine, endLine, silent) {
    var ch,
        contentStart,
        i,
        indent,
        indentAfterMarker,
        initial,
        isOrdered,
        itemLines,
        l,
        listLines,
        listTokIdx,
        markerCharCode,
        markerValue,
        max,
        nextLine,
        offset,
        oldListIndent,
        oldParentType,
        oldSCount,
        oldTShift,
        oldTight,
        pos,
        posAfterMarker,
        prevEmptyEnd,
        start,
        terminate,
        terminatorRules,
        token,
        isTerminatingParagraph = false,
        tight = true; // if it's indented more than 3 spaces, it should be a code block

    if (state.sCount[startLine] - state.blkIndent >= 4) {
      return false;
    } // Special case:
    //  - item 1
    //   - item 2
    //    - item 3
    //     - item 4
    //      - this one is a paragraph continuation


    if (state.listIndent >= 0 && state.sCount[startLine] - state.listIndent >= 4 && state.sCount[startLine] < state.blkIndent) {
      return false;
    } // limit conditions when list can interrupt
    // a paragraph (validation mode only)


    if (silent && state.parentType === 'paragraph') {
      // Next list item should still terminate previous list item;
      //
      // This code can fail if plugins use blkIndent as well as lists,
      // but I hope the spec gets fixed long before that happens.
      //
      if (state.tShift[startLine] >= state.blkIndent) {
        isTerminatingParagraph = true;
      }
    } // Detect list type and position after marker


    if ((posAfterMarker = skipOrderedListMarker(state, startLine)) >= 0) {
      isOrdered = true;
      start = state.bMarks[startLine] + state.tShift[startLine];
      markerValue = Number(state.src.substr(start, posAfterMarker - start - 1)); // If we're starting a new ordered list right after
      // a paragraph, it should start with 1.

      if (isTerminatingParagraph && markerValue !== 1) return false;
    } else if ((posAfterMarker = skipBulletListMarker(state, startLine)) >= 0) {
      isOrdered = false;
    } else {
      return false;
    } // If we're starting a new unordered list right after
    // a paragraph, first line should not be empty.


    if (isTerminatingParagraph) {
      if (state.skipSpaces(posAfterMarker) >= state.eMarks[startLine]) return false;
    } // We should terminate list on style change. Remember first one to compare.


    markerCharCode = state.src.charCodeAt(posAfterMarker - 1); // For validation mode we can terminate immediately

    if (silent) {
      return true;
    } // Start list


    listTokIdx = state.tokens.length;

    if (isOrdered) {
      token = state.push('ordered_list_open', 'ol', 1);

      if (markerValue !== 1) {
        token.attrs = [['start', markerValue]];
      }
    } else {
      token = state.push('bullet_list_open', 'ul', 1);
    }

    token.map = listLines = [startLine, 0];
    token.markup = String.fromCharCode(markerCharCode); //
    // Iterate list items
    //

    nextLine = startLine;
    prevEmptyEnd = false;
    terminatorRules = state.md.block.ruler.getRules('list');
    oldParentType = state.parentType;
    state.parentType = 'list';

    while (nextLine < endLine) {
      pos = posAfterMarker;
      max = state.eMarks[nextLine];
      initial = offset = state.sCount[nextLine] + posAfterMarker - (state.bMarks[startLine] + state.tShift[startLine]);

      while (pos < max) {
        ch = state.src.charCodeAt(pos);

        if (ch === 0x09) {
          offset += 4 - (offset + state.bsCount[nextLine]) % 4;
        } else if (ch === 0x20) {
          offset++;
        } else {
          break;
        }

        pos++;
      }

      contentStart = pos;

      if (contentStart >= max) {
        // trimming space in "-    \n  3" case, indent is 1 here
        indentAfterMarker = 1;
      } else {
        indentAfterMarker = offset - initial;
      } // If we have more than 4 spaces, the indent is 1
      // (the rest is just indented code block)


      if (indentAfterMarker > 4) {
        indentAfterMarker = 1;
      } // "  -  test"
      //  ^^^^^ - calculating total length of this thing


      indent = initial + indentAfterMarker; // Run subparser & write tokens

      token = state.push('list_item_open', 'li', 1);
      token.markup = String.fromCharCode(markerCharCode);
      token.map = itemLines = [startLine, 0]; // change current state, then restore it after parser subcall

      oldTight = state.tight;
      oldTShift = state.tShift[startLine];
      oldSCount = state.sCount[startLine]; //  - example list
      // ^ listIndent position will be here
      //   ^ blkIndent position will be here
      //

      oldListIndent = state.listIndent;
      state.listIndent = state.blkIndent;
      state.blkIndent = indent;
      state.tight = true;
      state.tShift[startLine] = contentStart - state.bMarks[startLine];
      state.sCount[startLine] = offset;

      if (contentStart >= max && state.isEmpty(startLine + 1)) {
        // workaround for this case
        // (list item is empty, list terminates before "foo"):
        // ~~~~~~~~
        //   -
        //
        //     foo
        // ~~~~~~~~
        state.line = Math.min(state.line + 2, endLine);
      } else {
        state.md.block.tokenize(state, startLine, endLine, true);
      } // If any of list item is tight, mark list as tight


      if (!state.tight || prevEmptyEnd) {
        tight = false;
      } // Item become loose if finish with empty line,
      // but we should filter last element, because it means list finish


      prevEmptyEnd = state.line - startLine > 1 && state.isEmpty(state.line - 1);
      state.blkIndent = state.listIndent;
      state.listIndent = oldListIndent;
      state.tShift[startLine] = oldTShift;
      state.sCount[startLine] = oldSCount;
      state.tight = oldTight;
      token = state.push('list_item_close', 'li', -1);
      token.markup = String.fromCharCode(markerCharCode);
      nextLine = startLine = state.line;
      itemLines[1] = nextLine;
      contentStart = state.bMarks[startLine];

      if (nextLine >= endLine) {
        break;
      } //
      // Try to check if list is terminated or continued.
      //


      if (state.sCount[nextLine] < state.blkIndent) {
        break;
      } // if it's indented more than 3 spaces, it should be a code block


      if (state.sCount[startLine] - state.blkIndent >= 4) {
        break;
      } // fail if terminating block found


      terminate = false;

      for (i = 0, l = terminatorRules.length; i < l; i++) {
        if (terminatorRules[i](state, nextLine, endLine, true)) {
          terminate = true;
          break;
        }
      }

      if (terminate) {
        break;
      } // fail if list has another type


      if (isOrdered) {
        posAfterMarker = skipOrderedListMarker(state, nextLine);

        if (posAfterMarker < 0) {
          break;
        }
      } else {
        posAfterMarker = skipBulletListMarker(state, nextLine);

        if (posAfterMarker < 0) {
          break;
        }
      }

      if (markerCharCode !== state.src.charCodeAt(posAfterMarker - 1)) {
        break;
      }
    } // Finalize list


    if (isOrdered) {
      token = state.push('ordered_list_close', 'ol', -1);
    } else {
      token = state.push('bullet_list_close', 'ul', -1);
    }

    token.markup = String.fromCharCode(markerCharCode);
    listLines[1] = nextLine;
    state.line = nextLine;
    state.parentType = oldParentType; // mark paragraphs tight if needed

    if (tight) {
      markTightParagraphs(state, listTokIdx);
    }

    return true;
  };

  var normalizeReference = utils.normalizeReference;

  var isSpace$4 = utils.isSpace;

  var reference = function reference(state, startLine, _endLine, silent) {
    var ch,
        destEndPos,
        destEndLineNo,
        endLine,
        href,
        i,
        l,
        label,
        labelEnd,
        oldParentType,
        res,
        start,
        str,
        terminate,
        terminatorRules,
        title,
        lines = 0,
        pos = state.bMarks[startLine] + state.tShift[startLine],
        max = state.eMarks[startLine],
        nextLine = startLine + 1; // if it's indented more than 3 spaces, it should be a code block

    if (state.sCount[startLine] - state.blkIndent >= 4) {
      return false;
    }

    if (state.src.charCodeAt(pos) !== 0x5B
    /* [ */
    ) {
        return false;
      } // Simple check to quickly interrupt scan on [link](url) at the start of line.
    // Can be useful on practice: https://github.com/markdown-it/markdown-it/issues/54


    while (++pos < max) {
      if (state.src.charCodeAt(pos) === 0x5D
      /* ] */
      && state.src.charCodeAt(pos - 1) !== 0x5C
      /* \ */
      ) {
          if (pos + 1 === max) {
            return false;
          }

          if (state.src.charCodeAt(pos + 1) !== 0x3A
          /* : */
          ) {
              return false;
            }

          break;
        }
    }

    endLine = state.lineMax; // jump line-by-line until empty one or EOF

    terminatorRules = state.md.block.ruler.getRules('reference');
    oldParentType = state.parentType;
    state.parentType = 'reference';

    for (; nextLine < endLine && !state.isEmpty(nextLine); nextLine++) {
      // this would be a code block normally, but after paragraph
      // it's considered a lazy continuation regardless of what's there
      if (state.sCount[nextLine] - state.blkIndent > 3) {
        continue;
      } // quirk for blockquotes, this line should already be checked by that rule


      if (state.sCount[nextLine] < 0) {
        continue;
      } // Some tags can terminate paragraph without empty line.


      terminate = false;

      for (i = 0, l = terminatorRules.length; i < l; i++) {
        if (terminatorRules[i](state, nextLine, endLine, true)) {
          terminate = true;
          break;
        }
      }

      if (terminate) {
        break;
      }
    }

    str = state.getLines(startLine, nextLine, state.blkIndent, false).trim();
    max = str.length;

    for (pos = 1; pos < max; pos++) {
      ch = str.charCodeAt(pos);

      if (ch === 0x5B
      /* [ */
      ) {
          return false;
        } else if (ch === 0x5D
      /* ] */
      ) {
          labelEnd = pos;
          break;
        } else if (ch === 0x0A
      /* \n */
      ) {
          lines++;
        } else if (ch === 0x5C
      /* \ */
      ) {
          pos++;

          if (pos < max && str.charCodeAt(pos) === 0x0A) {
            lines++;
          }
        }
    }

    if (labelEnd < 0 || str.charCodeAt(labelEnd + 1) !== 0x3A
    /* : */
    ) {
        return false;
      } // [label]:   destination   'title'
    //         ^^^ skip optional whitespace here


    for (pos = labelEnd + 2; pos < max; pos++) {
      ch = str.charCodeAt(pos);

      if (ch === 0x0A) {
        lines++;
      } else if (isSpace$4(ch)) ; else {
        break;
      }
    } // [label]:   destination   'title'
    //            ^^^^^^^^^^^ parse this


    res = state.md.helpers.parseLinkDestination(str, pos, max);

    if (!res.ok) {
      return false;
    }

    href = state.md.normalizeLink(res.str);

    if (!state.md.validateLink(href)) {
      return false;
    }

    pos = res.pos;
    lines += res.lines; // save cursor state, we could require to rollback later

    destEndPos = pos;
    destEndLineNo = lines; // [label]:   destination   'title'
    //                       ^^^ skipping those spaces

    start = pos;

    for (; pos < max; pos++) {
      ch = str.charCodeAt(pos);

      if (ch === 0x0A) {
        lines++;
      } else if (isSpace$4(ch)) ; else {
        break;
      }
    } // [label]:   destination   'title'
    //                          ^^^^^^^ parse this


    res = state.md.helpers.parseLinkTitle(str, pos, max);

    if (pos < max && start !== pos && res.ok) {
      title = res.str;
      pos = res.pos;
      lines += res.lines;
    } else {
      title = '';
      pos = destEndPos;
      lines = destEndLineNo;
    } // skip trailing spaces until the rest of the line


    while (pos < max) {
      ch = str.charCodeAt(pos);

      if (!isSpace$4(ch)) {
        break;
      }

      pos++;
    }

    if (pos < max && str.charCodeAt(pos) !== 0x0A) {
      if (title) {
        // garbage at the end of the line after title,
        // but it could still be a valid reference if we roll back
        title = '';
        pos = destEndPos;
        lines = destEndLineNo;

        while (pos < max) {
          ch = str.charCodeAt(pos);

          if (!isSpace$4(ch)) {
            break;
          }

          pos++;
        }
      }
    }

    if (pos < max && str.charCodeAt(pos) !== 0x0A) {
      // garbage at the end of the line
      return false;
    }

    label = normalizeReference(str.slice(1, labelEnd));

    if (!label) {
      // CommonMark 0.20 disallows empty labels
      return false;
    } // Reference can not terminate anything. This check is for safety only.

    /*istanbul ignore if*/


    if (silent) {
      return true;
    }

    if (typeof state.env.references === 'undefined') {
      state.env.references = {};
    }

    if (typeof state.env.references[label] === 'undefined') {
      state.env.references[label] = {
        title: title,
        href: href
      };
    }

    state.parentType = oldParentType;
    state.line = startLine + lines + 1;
    return true;
  };

  var isSpace$5 = utils.isSpace;

  var heading = function heading(state, startLine, endLine, silent) {
    var ch,
        level,
        tmp,
        token,
        pos = state.bMarks[startLine] + state.tShift[startLine],
        max = state.eMarks[startLine]; // if it's indented more than 3 spaces, it should be a code block

    if (state.sCount[startLine] - state.blkIndent >= 4) {
      return false;
    }

    ch = state.src.charCodeAt(pos);

    if (ch !== 0x23
    /* # */
    || pos >= max) {
      return false;
    } // count heading level


    level = 1;
    ch = state.src.charCodeAt(++pos);

    while (ch === 0x23
    /* # */
    && pos < max && level <= 6) {
      level++;
      ch = state.src.charCodeAt(++pos);
    }

    if (level > 6 || pos < max && !isSpace$5(ch)) {
      return false;
    }

    if (silent) {
      return true;
    } // Let's cut tails like '    ###  ' from the end of string


    max = state.skipSpacesBack(max, pos);
    tmp = state.skipCharsBack(max, 0x23, pos); // #

    if (tmp > pos && isSpace$5(state.src.charCodeAt(tmp - 1))) {
      max = tmp;
    }

    state.line = startLine + 1;
    token = state.push('heading_open', 'h' + String(level), 1);
    token.markup = '########'.slice(0, level);
    token.map = [startLine, state.line];
    token = state.push('inline', '', 0);
    token.content = state.src.slice(pos, max).trim();
    token.map = [startLine, state.line];
    token.children = [];
    token = state.push('heading_close', 'h' + String(level), -1);
    token.markup = '########'.slice(0, level);
    return true;
  };

  // lheading (---, ===)

  var lheading = function lheading(state, startLine, endLine
  /*, silent*/
  ) {
    var content,
        terminate,
        i,
        l,
        token,
        pos,
        max,
        level,
        marker,
        nextLine = startLine + 1,
        oldParentType,
        terminatorRules = state.md.block.ruler.getRules('paragraph'); // if it's indented more than 3 spaces, it should be a code block

    if (state.sCount[startLine] - state.blkIndent >= 4) {
      return false;
    }

    oldParentType = state.parentType;
    state.parentType = 'paragraph'; // use paragraph to match terminatorRules
    // jump line-by-line until empty one or EOF

    for (; nextLine < endLine && !state.isEmpty(nextLine); nextLine++) {
      // this would be a code block normally, but after paragraph
      // it's considered a lazy continuation regardless of what's there
      if (state.sCount[nextLine] - state.blkIndent > 3) {
        continue;
      } //
      // Check for underline in setext header
      //


      if (state.sCount[nextLine] >= state.blkIndent) {
        pos = state.bMarks[nextLine] + state.tShift[nextLine];
        max = state.eMarks[nextLine];

        if (pos < max) {
          marker = state.src.charCodeAt(pos);

          if (marker === 0x2D
          /* - */
          || marker === 0x3D
          /* = */
          ) {
              pos = state.skipChars(pos, marker);
              pos = state.skipSpaces(pos);

              if (pos >= max) {
                level = marker === 0x3D
                /* = */
                ? 1 : 2;
                break;
              }
            }
        }
      } // quirk for blockquotes, this line should already be checked by that rule


      if (state.sCount[nextLine] < 0) {
        continue;
      } // Some tags can terminate paragraph without empty line.


      terminate = false;

      for (i = 0, l = terminatorRules.length; i < l; i++) {
        if (terminatorRules[i](state, nextLine, endLine, true)) {
          terminate = true;
          break;
        }
      }

      if (terminate) {
        break;
      }
    }

    if (!level) {
      // Didn't find valid underline
      return false;
    }

    content = state.getLines(startLine, nextLine, state.blkIndent, false).trim();
    state.line = nextLine + 1;
    token = state.push('heading_open', 'h' + String(level), 1);
    token.markup = String.fromCharCode(marker);
    token.map = [startLine, state.line];
    token = state.push('inline', '', 0);
    token.content = content;
    token.map = [startLine, state.line - 1];
    token.children = [];
    token = state.push('heading_close', 'h' + String(level), -1);
    token.markup = String.fromCharCode(marker);
    state.parentType = oldParentType;
    return true;
  };

  // List of valid html blocks names, accorting to commonmark spec

  var html_blocks = ['address', 'article', 'aside', 'base', 'basefont', 'blockquote', 'body', 'caption', 'center', 'col', 'colgroup', 'dd', 'details', 'dialog', 'dir', 'div', 'dl', 'dt', 'fieldset', 'figcaption', 'figure', 'footer', 'form', 'frame', 'frameset', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header', 'hr', 'html', 'iframe', 'legend', 'li', 'link', 'main', 'menu', 'menuitem', 'meta', 'nav', 'noframes', 'ol', 'optgroup', 'option', 'p', 'param', 'section', 'source', 'summary', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'title', 'tr', 'track', 'ul'];

  // Regexps to match html elements

  var attr_name = '[a-zA-Z_:][a-zA-Z0-9:._-]*';
  var unquoted = '[^"\'=<>`\\x00-\\x20]+';
  var single_quoted = "'[^']*'";
  var double_quoted = '"[^"]*"';
  var attr_value = '(?:' + unquoted + '|' + single_quoted + '|' + double_quoted + ')';
  var attribute = '(?:\\s+' + attr_name + '(?:\\s*=\\s*' + attr_value + ')?)';
  var open_tag = '<[A-Za-z][A-Za-z0-9\\-]*' + attribute + '*\\s*\\/?>';
  var close_tag = '<\\/[A-Za-z][A-Za-z0-9\\-]*\\s*>';
  var comment = '<!---->|<!--(?:-?[^>-])(?:-?[^-])*-->';
  var processing = '<[?].*?[?]>';
  var declaration = '<![A-Z]+\\s+[^>]*>';
  var cdata = '<!\\[CDATA\\[[\\s\\S]*?\\]\\]>';
  var HTML_TAG_RE = new RegExp('^(?:' + open_tag + '|' + close_tag + '|' + comment + '|' + processing + '|' + declaration + '|' + cdata + ')');
  var HTML_OPEN_CLOSE_TAG_RE = new RegExp('^(?:' + open_tag + '|' + close_tag + ')');
  var HTML_TAG_RE_1 = HTML_TAG_RE;
  var HTML_OPEN_CLOSE_TAG_RE_1 = HTML_OPEN_CLOSE_TAG_RE;

  var html_re = {
  	HTML_TAG_RE: HTML_TAG_RE_1,
  	HTML_OPEN_CLOSE_TAG_RE: HTML_OPEN_CLOSE_TAG_RE_1
  };

  var HTML_OPEN_CLOSE_TAG_RE$1 = html_re.HTML_OPEN_CLOSE_TAG_RE; // An array of opening and corresponding closing sequences for html tags,
  // last argument defines whether it can terminate a paragraph or not
  //


  var HTML_SEQUENCES = [[/^<(script|pre|style)(?=(\s|>|$))/i, /<\/(script|pre|style)>/i, true], [/^<!--/, /-->/, true], [/^<\?/, /\?>/, true], [/^<![A-Z]/, />/, true], [/^<!\[CDATA\[/, /\]\]>/, true], [new RegExp('^</?(' + html_blocks.join('|') + ')(?=(\\s|/?>|$))', 'i'), /^$/, true], [new RegExp(HTML_OPEN_CLOSE_TAG_RE$1.source + '\\s*$'), /^$/, false]];

  var html_block = function html_block(state, startLine, endLine, silent) {
    var i,
        nextLine,
        token,
        lineText,
        pos = state.bMarks[startLine] + state.tShift[startLine],
        max = state.eMarks[startLine]; // if it's indented more than 3 spaces, it should be a code block

    if (state.sCount[startLine] - state.blkIndent >= 4) {
      return false;
    }

    if (!state.md.options.html) {
      return false;
    }

    if (state.src.charCodeAt(pos) !== 0x3C
    /* < */
    ) {
        return false;
      }

    lineText = state.src.slice(pos, max);

    for (i = 0; i < HTML_SEQUENCES.length; i++) {
      if (HTML_SEQUENCES[i][0].test(lineText)) {
        break;
      }
    }

    if (i === HTML_SEQUENCES.length) {
      return false;
    }

    if (silent) {
      // true if this sequence can be a terminator, false otherwise
      return HTML_SEQUENCES[i][2];
    }

    nextLine = startLine + 1; // If we are here - we detected HTML block.
    // Let's roll down till block end.

    if (!HTML_SEQUENCES[i][1].test(lineText)) {
      for (; nextLine < endLine; nextLine++) {
        if (state.sCount[nextLine] < state.blkIndent) {
          break;
        }

        pos = state.bMarks[nextLine] + state.tShift[nextLine];
        max = state.eMarks[nextLine];
        lineText = state.src.slice(pos, max);

        if (HTML_SEQUENCES[i][1].test(lineText)) {
          if (lineText.length !== 0) {
            nextLine++;
          }

          break;
        }
      }
    }

    state.line = nextLine;
    token = state.push('html_block', '', 0);
    token.map = [startLine, nextLine];
    token.content = state.getLines(startLine, nextLine, state.blkIndent, true);
    return true;
  };

  // Paragraph

  var paragraph = function paragraph(state, startLine
  /*, endLine*/
  ) {
    var content,
        terminate,
        i,
        l,
        token,
        oldParentType,
        nextLine = startLine + 1,
        terminatorRules = state.md.block.ruler.getRules('paragraph'),
        endLine = state.lineMax;
    oldParentType = state.parentType;
    state.parentType = 'paragraph'; // jump line-by-line until empty one or EOF

    for (; nextLine < endLine && !state.isEmpty(nextLine); nextLine++) {
      // this would be a code block normally, but after paragraph
      // it's considered a lazy continuation regardless of what's there
      if (state.sCount[nextLine] - state.blkIndent > 3) {
        continue;
      } // quirk for blockquotes, this line should already be checked by that rule


      if (state.sCount[nextLine] < 0) {
        continue;
      } // Some tags can terminate paragraph without empty line.


      terminate = false;

      for (i = 0, l = terminatorRules.length; i < l; i++) {
        if (terminatorRules[i](state, nextLine, endLine, true)) {
          terminate = true;
          break;
        }
      }

      if (terminate) {
        break;
      }
    }

    content = state.getLines(startLine, nextLine, state.blkIndent, false).trim();
    state.line = nextLine;
    token = state.push('paragraph_open', 'p', 1);
    token.map = [startLine, state.line];
    token = state.push('inline', '', 0);
    token.content = content;
    token.map = [startLine, state.line];
    token.children = [];
    token = state.push('paragraph_close', 'p', -1);
    state.parentType = oldParentType;
    return true;
  };

  var isSpace$6 = utils.isSpace;

  function StateBlock(src, md, env, tokens) {
    var ch, s, start, pos, len, indent, offset, indent_found;
    this.src = src; // link to parser instance

    this.md = md;
    this.env = env; //
    // Internal state vartiables
    //

    this.tokens = tokens;
    this.bMarks = []; // line begin offsets for fast jumps

    this.eMarks = []; // line end offsets for fast jumps

    this.tShift = []; // offsets of the first non-space characters (tabs not expanded)

    this.sCount = []; // indents for each line (tabs expanded)
    // An amount of virtual spaces (tabs expanded) between beginning
    // of each line (bMarks) and real beginning of that line.
    //
    // It exists only as a hack because blockquotes override bMarks
    // losing information in the process.
    //
    // It's used only when expanding tabs, you can think about it as
    // an initial tab length, e.g. bsCount=21 applied to string `\t123`
    // means first tab should be expanded to 4-21%4 === 3 spaces.
    //

    this.bsCount = []; // block parser variables

    this.blkIndent = 0; // required block content indent (for example, if we are
    // inside a list, it would be positioned after list marker)

    this.line = 0; // line index in src

    this.lineMax = 0; // lines count

    this.tight = false; // loose/tight mode for lists

    this.ddIndent = -1; // indent of the current dd block (-1 if there isn't any)

    this.listIndent = -1; // indent of the current list block (-1 if there isn't any)
    // can be 'blockquote', 'list', 'root', 'paragraph' or 'reference'
    // used in lists to determine if they interrupt a paragraph

    this.parentType = 'root';
    this.level = 0; // renderer

    this.result = ''; // Create caches
    // Generate markers.

    s = this.src;
    indent_found = false;

    for (start = pos = indent = offset = 0, len = s.length; pos < len; pos++) {
      ch = s.charCodeAt(pos);

      if (!indent_found) {
        if (isSpace$6(ch)) {
          indent++;

          if (ch === 0x09) {
            offset += 4 - offset % 4;
          } else {
            offset++;
          }

          continue;
        } else {
          indent_found = true;
        }
      }

      if (ch === 0x0A || pos === len - 1) {
        if (ch !== 0x0A) {
          pos++;
        }

        this.bMarks.push(start);
        this.eMarks.push(pos);
        this.tShift.push(indent);
        this.sCount.push(offset);
        this.bsCount.push(0);
        indent_found = false;
        indent = 0;
        offset = 0;
        start = pos + 1;
      }
    } // Push fake entry to simplify cache bounds checks


    this.bMarks.push(s.length);
    this.eMarks.push(s.length);
    this.tShift.push(0);
    this.sCount.push(0);
    this.bsCount.push(0);
    this.lineMax = this.bMarks.length - 1; // don't count last fake line
  } // Push new token to "stream".
  //


  StateBlock.prototype.push = function (type, tag, nesting) {
    var token$1 = new token(type, tag, nesting);
    token$1.block = true;
    if (nesting < 0) this.level--; // closing tag

    token$1.level = this.level;
    if (nesting > 0) this.level++; // opening tag

    this.tokens.push(token$1);
    return token$1;
  };

  StateBlock.prototype.isEmpty = function isEmpty(line) {
    return this.bMarks[line] + this.tShift[line] >= this.eMarks[line];
  };

  StateBlock.prototype.skipEmptyLines = function skipEmptyLines(from) {
    for (var max = this.lineMax; from < max; from++) {
      if (this.bMarks[from] + this.tShift[from] < this.eMarks[from]) {
        break;
      }
    }

    return from;
  }; // Skip spaces from given position.


  StateBlock.prototype.skipSpaces = function skipSpaces(pos) {
    var ch;

    for (var max = this.src.length; pos < max; pos++) {
      ch = this.src.charCodeAt(pos);

      if (!isSpace$6(ch)) {
        break;
      }
    }

    return pos;
  }; // Skip spaces from given position in reverse.


  StateBlock.prototype.skipSpacesBack = function skipSpacesBack(pos, min) {
    if (pos <= min) {
      return pos;
    }

    while (pos > min) {
      if (!isSpace$6(this.src.charCodeAt(--pos))) {
        return pos + 1;
      }
    }

    return pos;
  }; // Skip char codes from given position


  StateBlock.prototype.skipChars = function skipChars(pos, code) {
    for (var max = this.src.length; pos < max; pos++) {
      if (this.src.charCodeAt(pos) !== code) {
        break;
      }
    }

    return pos;
  }; // Skip char codes reverse from given position - 1


  StateBlock.prototype.skipCharsBack = function skipCharsBack(pos, code, min) {
    if (pos <= min) {
      return pos;
    }

    while (pos > min) {
      if (code !== this.src.charCodeAt(--pos)) {
        return pos + 1;
      }
    }

    return pos;
  }; // cut lines range from source.


  StateBlock.prototype.getLines = function getLines(begin, end, indent, keepLastLF) {
    var i,
        lineIndent,
        ch,
        first,
        last,
        queue,
        lineStart,
        line = begin;

    if (begin >= end) {
      return '';
    }

    queue = new Array(end - begin);

    for (i = 0; line < end; line++, i++) {
      lineIndent = 0;
      lineStart = first = this.bMarks[line];

      if (line + 1 < end || keepLastLF) {
        // No need for bounds check because we have fake entry on tail.
        last = this.eMarks[line] + 1;
      } else {
        last = this.eMarks[line];
      }

      while (first < last && lineIndent < indent) {
        ch = this.src.charCodeAt(first);

        if (isSpace$6(ch)) {
          if (ch === 0x09) {
            lineIndent += 4 - (lineIndent + this.bsCount[line]) % 4;
          } else {
            lineIndent++;
          }
        } else if (first - lineStart < this.tShift[line]) {
          // patched tShift masked characters to look like spaces (blockquotes, list markers)
          lineIndent++;
        } else {
          break;
        }

        first++;
      }

      if (lineIndent > indent) {
        // partially expanding tabs in code blocks, e.g '\t\tfoobar'
        // with indent=2 becomes '  \tfoobar'
        queue[i] = new Array(lineIndent - indent + 1).join(' ') + this.src.slice(first, last);
      } else {
        queue[i] = this.src.slice(first, last);
      }
    }

    return queue.join('');
  }; // re-export Token class to use in block rules


  StateBlock.prototype.Token = token;
  var state_block = StateBlock;

  var _rules$1 = [// First 2 params - rule name & source. Secondary array - list of rules,
  // which can be terminated by this one.
  ['table', table, ['paragraph', 'reference']], ['code', code], ['fence', fence, ['paragraph', 'reference', 'blockquote', 'list']], ['blockquote', blockquote, ['paragraph', 'reference', 'blockquote', 'list']], ['hr', hr, ['paragraph', 'reference', 'blockquote', 'list']], ['list', list, ['paragraph', 'reference', 'blockquote']], ['reference', reference], ['heading', heading, ['paragraph', 'reference', 'blockquote']], ['lheading', lheading], ['html_block', html_block, ['paragraph', 'reference', 'blockquote']], ['paragraph', paragraph]];
  /**
   * new ParserBlock()
   **/

  function ParserBlock() {
    /**
     * ParserBlock#ruler -> Ruler
     *
     * [[Ruler]] instance. Keep configuration of block rules.
     **/
    this.ruler = new ruler();

    for (var i = 0; i < _rules$1.length; i++) {
      this.ruler.push(_rules$1[i][0], _rules$1[i][1], {
        alt: (_rules$1[i][2] || []).slice()
      });
    }
  } // Generate tokens for input range
  //


  ParserBlock.prototype.tokenize = function (state, startLine, endLine) {
    var ok,
        i,
        rules = this.ruler.getRules(''),
        len = rules.length,
        line = startLine,
        hasEmptyLines = false,
        maxNesting = state.md.options.maxNesting;

    while (line < endLine) {
      state.line = line = state.skipEmptyLines(line);

      if (line >= endLine) {
        break;
      } // Termination condition for nested calls.
      // Nested calls currently used for blockquotes & lists


      if (state.sCount[line] < state.blkIndent) {
        break;
      } // If nesting level exceeded - skip tail to the end. That's not ordinary
      // situation and we should not care about content.


      if (state.level >= maxNesting) {
        state.line = endLine;
        break;
      } // Try all possible rules.
      // On success, rule should:
      //
      // - update `state.line`
      // - update `state.tokens`
      // - return true


      for (i = 0; i < len; i++) {
        ok = rules[i](state, line, endLine, false);

        if (ok) {
          break;
        }
      } // set state.tight if we had an empty line before current tag
      // i.e. latest empty line should not count


      state.tight = !hasEmptyLines; // paragraph might "eat" one newline after it in nested lists

      if (state.isEmpty(state.line - 1)) {
        hasEmptyLines = true;
      }

      line = state.line;

      if (line < endLine && state.isEmpty(line)) {
        hasEmptyLines = true;
        line++;
        state.line = line;
      }
    }
  };
  /**
   * ParserBlock.parse(str, md, env, outTokens)
   *
   * Process input string and push block tokens into `outTokens`
   **/


  ParserBlock.prototype.parse = function (src, md, env, outTokens) {
    var state;

    if (!src) {
      return;
    }

    state = new this.State(src, md, env, outTokens);
    this.tokenize(state, state.line, state.lineMax);
  };

  ParserBlock.prototype.State = state_block;
  var parser_block = ParserBlock;

  // Skip text characters for text token, place those to pending buffer
  // '{}$%@~+=:' reserved for extentions
  // !, ", #, $, %, &, ', (, ), *, +, ,, -, ., /, :, ;, <, =, >, ?, @, [, \, ], ^, _, `, {, |, }, or ~
  // !!!! Don't confuse with "Markdown ASCII Punctuation" chars
  // http://spec.commonmark.org/0.15/#ascii-punctuation-character

  function isTerminatorChar(ch) {
    switch (ch) {
      case 0x0A
      /* \n */
      :
      case 0x21
      /* ! */
      :
      case 0x23
      /* # */
      :
      case 0x24
      /* $ */
      :
      case 0x25
      /* % */
      :
      case 0x26
      /* & */
      :
      case 0x2A
      /* * */
      :
      case 0x2B
      /* + */
      :
      case 0x2D
      /* - */
      :
      case 0x3A
      /* : */
      :
      case 0x3C
      /* < */
      :
      case 0x3D
      /* = */
      :
      case 0x3E
      /* > */
      :
      case 0x40
      /* @ */
      :
      case 0x5B
      /* [ */
      :
      case 0x5C
      /* \ */
      :
      case 0x5D
      /* ] */
      :
      case 0x5E
      /* ^ */
      :
      case 0x5F
      /* _ */
      :
      case 0x60
      /* ` */
      :
      case 0x7B
      /* { */
      :
      case 0x7D
      /* } */
      :
      case 0x7E
      /* ~ */
      :
        return true;

      default:
        return false;
    }
  }

  var text = function text(state, silent) {
    var pos = state.pos;

    while (pos < state.posMax && !isTerminatorChar(state.src.charCodeAt(pos))) {
      pos++;
    }

    if (pos === state.pos) {
      return false;
    }

    if (!silent) {
      state.pending += state.src.slice(state.pos, pos);
    }

    state.pos = pos;
    return true;
  }; // Alternative implementation, for memory.

  var isSpace$7 = utils.isSpace;

  var newline = function newline(state, silent) {
    var pmax,
        max,
        pos = state.pos;

    if (state.src.charCodeAt(pos) !== 0x0A
    /* \n */
    ) {
        return false;
      }

    pmax = state.pending.length - 1;
    max = state.posMax; // '  \n' -> hardbreak
    // Lookup in pending chars is bad practice! Don't copy to other rules!
    // Pending string is stored in concat mode, indexed lookups will cause
    // convertion to flat mode.

    if (!silent) {
      if (pmax >= 0 && state.pending.charCodeAt(pmax) === 0x20) {
        if (pmax >= 1 && state.pending.charCodeAt(pmax - 1) === 0x20) {
          state.pending = state.pending.replace(/ +$/, '');
          state.push('hardbreak', 'br', 0);
        } else {
          state.pending = state.pending.slice(0, -1);
          state.push('softbreak', 'br', 0);
        }
      } else {
        state.push('softbreak', 'br', 0);
      }
    }

    pos++; // skip heading spaces for next line

    while (pos < max && isSpace$7(state.src.charCodeAt(pos))) {
      pos++;
    }

    state.pos = pos;
    return true;
  };

  var isSpace$8 = utils.isSpace;

  var ESCAPED = [];

  for (var i = 0; i < 256; i++) {
    ESCAPED.push(0);
  }

  '\\!"#$%&\'()*+,./:;<=>?@[]^_`{|}~-'.split('').forEach(function (ch) {
    ESCAPED[ch.charCodeAt(0)] = 1;
  });

  var _escape = function escape(state, silent) {
    var ch,
        pos = state.pos,
        max = state.posMax;

    if (state.src.charCodeAt(pos) !== 0x5C
    /* \ */
    ) {
        return false;
      }

    pos++;

    if (pos < max) {
      ch = state.src.charCodeAt(pos);

      if (ch < 256 && ESCAPED[ch] !== 0) {
        if (!silent) {
          state.pending += state.src[pos];
        }

        state.pos += 2;
        return true;
      }

      if (ch === 0x0A) {
        if (!silent) {
          state.push('hardbreak', 'br', 0);
        }

        pos++; // skip leading whitespaces from next line

        while (pos < max) {
          ch = state.src.charCodeAt(pos);

          if (!isSpace$8(ch)) {
            break;
          }

          pos++;
        }

        state.pos = pos;
        return true;
      }
    }

    if (!silent) {
      state.pending += '\\';
    }

    state.pos++;
    return true;
  };

  // Parse backticks

  var backticks = function backtick(state, silent) {
    var start,
        max,
        marker,
        matchStart,
        matchEnd,
        token,
        pos = state.pos,
        ch = state.src.charCodeAt(pos);

    if (ch !== 0x60
    /* ` */
    ) {
        return false;
      }

    start = pos;
    pos++;
    max = state.posMax;

    while (pos < max && state.src.charCodeAt(pos) === 0x60
    /* ` */
    ) {
      pos++;
    }

    marker = state.src.slice(start, pos);
    matchStart = matchEnd = pos;

    while ((matchStart = state.src.indexOf('`', matchEnd)) !== -1) {
      matchEnd = matchStart + 1;

      while (matchEnd < max && state.src.charCodeAt(matchEnd) === 0x60
      /* ` */
      ) {
        matchEnd++;
      }

      if (matchEnd - matchStart === marker.length) {
        if (!silent) {
          token = state.push('code_inline', 'code', 0);
          token.markup = marker;
          token.content = state.src.slice(pos, matchStart).replace(/\n/g, ' ').replace(/^ (.+) $/, '$1');
        }

        state.pos = matchEnd;
        return true;
      }
    }

    if (!silent) {
      state.pending += marker;
    }

    state.pos += marker.length;
    return true;
  };

  // ~~strike through~~
  //

  var tokenize = function strikethrough(state, silent) {
    var i,
        scanned,
        token,
        len,
        ch,
        start = state.pos,
        marker = state.src.charCodeAt(start);

    if (silent) {
      return false;
    }

    if (marker !== 0x7E
    /* ~ */
    ) {
        return false;
      }

    scanned = state.scanDelims(state.pos, true);
    len = scanned.length;
    ch = String.fromCharCode(marker);

    if (len < 2) {
      return false;
    }

    if (len % 2) {
      token = state.push('text', '', 0);
      token.content = ch;
      len--;
    }

    for (i = 0; i < len; i += 2) {
      token = state.push('text', '', 0);
      token.content = ch + ch;
      state.delimiters.push({
        marker: marker,
        length: 0,
        // disable "rule of 3" length checks meant for emphasis
        jump: i,
        token: state.tokens.length - 1,
        end: -1,
        open: scanned.can_open,
        close: scanned.can_close
      });
    }

    state.pos += scanned.length;
    return true;
  };

  function postProcess(state, delimiters) {
    var i,
        j,
        startDelim,
        endDelim,
        token,
        loneMarkers = [],
        max = delimiters.length;

    for (i = 0; i < max; i++) {
      startDelim = delimiters[i];

      if (startDelim.marker !== 0x7E
      /* ~ */
      ) {
          continue;
        }

      if (startDelim.end === -1) {
        continue;
      }

      endDelim = delimiters[startDelim.end];
      token = state.tokens[startDelim.token];
      token.type = 's_open';
      token.tag = 's';
      token.nesting = 1;
      token.markup = '~~';
      token.content = '';
      token = state.tokens[endDelim.token];
      token.type = 's_close';
      token.tag = 's';
      token.nesting = -1;
      token.markup = '~~';
      token.content = '';

      if (state.tokens[endDelim.token - 1].type === 'text' && state.tokens[endDelim.token - 1].content === '~') {
        loneMarkers.push(endDelim.token - 1);
      }
    } // If a marker sequence has an odd number of characters, it's splitted
    // like this: `~~~~~` -> `~` + `~~` + `~~`, leaving one marker at the
    // start of the sequence.
    //
    // So, we have to move all those markers after subsequent s_close tags.
    //


    while (loneMarkers.length) {
      i = loneMarkers.pop();
      j = i + 1;

      while (j < state.tokens.length && state.tokens[j].type === 's_close') {
        j++;
      }

      j--;

      if (i !== j) {
        token = state.tokens[j];
        state.tokens[j] = state.tokens[i];
        state.tokens[i] = token;
      }
    }
  } // Walk through delimiter list and replace text tokens with tags
  //


  var postProcess_1 = function strikethrough(state) {
    var curr,
        tokens_meta = state.tokens_meta,
        max = state.tokens_meta.length;
    postProcess(state, state.delimiters);

    for (curr = 0; curr < max; curr++) {
      if (tokens_meta[curr] && tokens_meta[curr].delimiters) {
        postProcess(state, tokens_meta[curr].delimiters);
      }
    }
  };

  var strikethrough = {
  	tokenize: tokenize,
  	postProcess: postProcess_1
  };

  // Process *this* and _that_
  //

  var tokenize$1 = function emphasis(state, silent) {
    var i,
        scanned,
        token,
        start = state.pos,
        marker = state.src.charCodeAt(start);

    if (silent) {
      return false;
    }

    if (marker !== 0x5F
    /* _ */
    && marker !== 0x2A
    /* * */
    ) {
        return false;
      }

    scanned = state.scanDelims(state.pos, marker === 0x2A);

    for (i = 0; i < scanned.length; i++) {
      token = state.push('text', '', 0);
      token.content = String.fromCharCode(marker);
      state.delimiters.push({
        // Char code of the starting marker (number).
        //
        marker: marker,
        // Total length of these series of delimiters.
        //
        length: scanned.length,
        // An amount of characters before this one that's equivalent to
        // current one. In plain English: if this delimiter does not open
        // an emphasis, neither do previous `jump` characters.
        //
        // Used to skip sequences like "*****" in one step, for 1st asterisk
        // value will be 0, for 2nd it's 1 and so on.
        //
        jump: i,
        // A position of the token this delimiter corresponds to.
        //
        token: state.tokens.length - 1,
        // If this delimiter is matched as a valid opener, `end` will be
        // equal to its position, otherwise it's `-1`.
        //
        end: -1,
        // Boolean flags that determine if this delimiter could open or close
        // an emphasis.
        //
        open: scanned.can_open,
        close: scanned.can_close
      });
    }

    state.pos += scanned.length;
    return true;
  };

  function postProcess$1(state, delimiters) {
    var i,
        startDelim,
        endDelim,
        token,
        ch,
        isStrong,
        max = delimiters.length;

    for (i = max - 1; i >= 0; i--) {
      startDelim = delimiters[i];

      if (startDelim.marker !== 0x5F
      /* _ */
      && startDelim.marker !== 0x2A
      /* * */
      ) {
          continue;
        } // Process only opening markers


      if (startDelim.end === -1) {
        continue;
      }

      endDelim = delimiters[startDelim.end]; // If the previous delimiter has the same marker and is adjacent to this one,
      // merge those into one strong delimiter.
      //
      // `<em><em>whatever</em></em>` -> `<strong>whatever</strong>`
      //

      isStrong = i > 0 && delimiters[i - 1].end === startDelim.end + 1 && delimiters[i - 1].token === startDelim.token - 1 && delimiters[startDelim.end + 1].token === endDelim.token + 1 && delimiters[i - 1].marker === startDelim.marker;
      ch = String.fromCharCode(startDelim.marker);
      token = state.tokens[startDelim.token];
      token.type = isStrong ? 'strong_open' : 'em_open';
      token.tag = isStrong ? 'strong' : 'em';
      token.nesting = 1;
      token.markup = isStrong ? ch + ch : ch;
      token.content = '';
      token = state.tokens[endDelim.token];
      token.type = isStrong ? 'strong_close' : 'em_close';
      token.tag = isStrong ? 'strong' : 'em';
      token.nesting = -1;
      token.markup = isStrong ? ch + ch : ch;
      token.content = '';

      if (isStrong) {
        state.tokens[delimiters[i - 1].token].content = '';
        state.tokens[delimiters[startDelim.end + 1].token].content = '';
        i--;
      }
    }
  } // Walk through delimiter list and replace text tokens with tags
  //


  var postProcess_1$1 = function emphasis(state) {
    var curr,
        tokens_meta = state.tokens_meta,
        max = state.tokens_meta.length;
    postProcess$1(state, state.delimiters);

    for (curr = 0; curr < max; curr++) {
      if (tokens_meta[curr] && tokens_meta[curr].delimiters) {
        postProcess$1(state, tokens_meta[curr].delimiters);
      }
    }
  };

  var emphasis = {
  	tokenize: tokenize$1,
  	postProcess: postProcess_1$1
  };

  var normalizeReference$1 = utils.normalizeReference;

  var isSpace$9 = utils.isSpace;

  var link = function link(state, silent) {
    var attrs,
        code,
        label,
        labelEnd,
        labelStart,
        pos,
        res,
        ref,
        title,
        token,
        href = '',
        oldPos = state.pos,
        max = state.posMax,
        start = state.pos,
        parseReference = true;

    if (state.src.charCodeAt(state.pos) !== 0x5B
    /* [ */
    ) {
        return false;
      }

    labelStart = state.pos + 1;
    labelEnd = state.md.helpers.parseLinkLabel(state, state.pos, true); // parser failed to find ']', so it's not a valid link

    if (labelEnd < 0) {
      return false;
    }

    pos = labelEnd + 1;

    if (pos < max && state.src.charCodeAt(pos) === 0x28
    /* ( */
    ) {
        //
        // Inline link
        //
        // might have found a valid shortcut link, disable reference parsing
        parseReference = false; // [link](  <href>  "title"  )
        //        ^^ skipping these spaces

        pos++;

        for (; pos < max; pos++) {
          code = state.src.charCodeAt(pos);

          if (!isSpace$9(code) && code !== 0x0A) {
            break;
          }
        }

        if (pos >= max) {
          return false;
        } // [link](  <href>  "title"  )
        //          ^^^^^^ parsing link destination


        start = pos;
        res = state.md.helpers.parseLinkDestination(state.src, pos, state.posMax);

        if (res.ok) {
          href = state.md.normalizeLink(res.str);

          if (state.md.validateLink(href)) {
            pos = res.pos;
          } else {
            href = '';
          }
        } // [link](  <href>  "title"  )
        //                ^^ skipping these spaces


        start = pos;

        for (; pos < max; pos++) {
          code = state.src.charCodeAt(pos);

          if (!isSpace$9(code) && code !== 0x0A) {
            break;
          }
        } // [link](  <href>  "title"  )
        //                  ^^^^^^^ parsing link title


        res = state.md.helpers.parseLinkTitle(state.src, pos, state.posMax);

        if (pos < max && start !== pos && res.ok) {
          title = res.str;
          pos = res.pos; // [link](  <href>  "title"  )
          //                         ^^ skipping these spaces

          for (; pos < max; pos++) {
            code = state.src.charCodeAt(pos);

            if (!isSpace$9(code) && code !== 0x0A) {
              break;
            }
          }
        } else {
          title = '';
        }

        if (pos >= max || state.src.charCodeAt(pos) !== 0x29
        /* ) */
        ) {
            // parsing a valid shortcut link failed, fallback to reference
            parseReference = true;
          }

        pos++;
      }

    if (parseReference) {
      //
      // Link reference
      //
      if (typeof state.env.references === 'undefined') {
        return false;
      }

      if (pos < max && state.src.charCodeAt(pos) === 0x5B
      /* [ */
      ) {
          start = pos + 1;
          pos = state.md.helpers.parseLinkLabel(state, pos);

          if (pos >= 0) {
            label = state.src.slice(start, pos++);
          } else {
            pos = labelEnd + 1;
          }
        } else {
        pos = labelEnd + 1;
      } // covers label === '' and label === undefined
      // (collapsed reference link and shortcut reference link respectively)


      if (!label) {
        label = state.src.slice(labelStart, labelEnd);
      }

      ref = state.env.references[normalizeReference$1(label)];

      if (!ref) {
        state.pos = oldPos;
        return false;
      }

      href = ref.href;
      title = ref.title;
    } //
    // We found the end of the link, and know for a fact it's a valid link;
    // so all that's left to do is to call tokenizer.
    //


    if (!silent) {
      state.pos = labelStart;
      state.posMax = labelEnd;
      token = state.push('link_open', 'a', 1);
      token.attrs = attrs = [['href', href]];

      if (title) {
        attrs.push(['title', title]);
      }

      state.md.inline.tokenize(state);
      token = state.push('link_close', 'a', -1);
    }

    state.pos = pos;
    state.posMax = max;
    return true;
  };

  var normalizeReference$2 = utils.normalizeReference;

  var isSpace$a = utils.isSpace;

  var image$1 = function image(state, silent) {
    var attrs,
        code,
        content,
        label,
        labelEnd,
        labelStart,
        pos,
        ref,
        res,
        title,
        token,
        tokens,
        start,
        href = '',
        oldPos = state.pos,
        max = state.posMax;

    if (state.src.charCodeAt(state.pos) !== 0x21
    /* ! */
    ) {
        return false;
      }

    if (state.src.charCodeAt(state.pos + 1) !== 0x5B
    /* [ */
    ) {
        return false;
      }

    labelStart = state.pos + 2;
    labelEnd = state.md.helpers.parseLinkLabel(state, state.pos + 1, false); // parser failed to find ']', so it's not a valid link

    if (labelEnd < 0) {
      return false;
    }

    pos = labelEnd + 1;

    if (pos < max && state.src.charCodeAt(pos) === 0x28
    /* ( */
    ) {
        //
        // Inline link
        //
        // [link](  <href>  "title"  )
        //        ^^ skipping these spaces
        pos++;

        for (; pos < max; pos++) {
          code = state.src.charCodeAt(pos);

          if (!isSpace$a(code) && code !== 0x0A) {
            break;
          }
        }

        if (pos >= max) {
          return false;
        } // [link](  <href>  "title"  )
        //          ^^^^^^ parsing link destination


        start = pos;
        res = state.md.helpers.parseLinkDestination(state.src, pos, state.posMax);

        if (res.ok) {
          href = state.md.normalizeLink(res.str);

          if (state.md.validateLink(href)) {
            pos = res.pos;
          } else {
            href = '';
          }
        } // [link](  <href>  "title"  )
        //                ^^ skipping these spaces


        start = pos;

        for (; pos < max; pos++) {
          code = state.src.charCodeAt(pos);

          if (!isSpace$a(code) && code !== 0x0A) {
            break;
          }
        } // [link](  <href>  "title"  )
        //                  ^^^^^^^ parsing link title


        res = state.md.helpers.parseLinkTitle(state.src, pos, state.posMax);

        if (pos < max && start !== pos && res.ok) {
          title = res.str;
          pos = res.pos; // [link](  <href>  "title"  )
          //                         ^^ skipping these spaces

          for (; pos < max; pos++) {
            code = state.src.charCodeAt(pos);

            if (!isSpace$a(code) && code !== 0x0A) {
              break;
            }
          }
        } else {
          title = '';
        }

        if (pos >= max || state.src.charCodeAt(pos) !== 0x29
        /* ) */
        ) {
            state.pos = oldPos;
            return false;
          }

        pos++;
      } else {
      //
      // Link reference
      //
      if (typeof state.env.references === 'undefined') {
        return false;
      }

      if (pos < max && state.src.charCodeAt(pos) === 0x5B
      /* [ */
      ) {
          start = pos + 1;
          pos = state.md.helpers.parseLinkLabel(state, pos);

          if (pos >= 0) {
            label = state.src.slice(start, pos++);
          } else {
            pos = labelEnd + 1;
          }
        } else {
        pos = labelEnd + 1;
      } // covers label === '' and label === undefined
      // (collapsed reference link and shortcut reference link respectively)


      if (!label) {
        label = state.src.slice(labelStart, labelEnd);
      }

      ref = state.env.references[normalizeReference$2(label)];

      if (!ref) {
        state.pos = oldPos;
        return false;
      }

      href = ref.href;
      title = ref.title;
    } //
    // We found the end of the link, and know for a fact it's a valid link;
    // so all that's left to do is to call tokenizer.
    //


    if (!silent) {
      content = state.src.slice(labelStart, labelEnd);
      state.md.inline.parse(content, state.md, state.env, tokens = []);
      token = state.push('image', 'img', 0);
      token.attrs = attrs = [['src', href], ['alt', '']];
      token.children = tokens;
      token.content = content;

      if (title) {
        attrs.push(['title', title]);
      }
    }

    state.pos = pos;
    state.posMax = max;
    return true;
  };

  // Process autolinks '<protocol:...>'
  /*eslint max-len:0*/

  var EMAIL_RE = /^<([a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)>/;
  var AUTOLINK_RE = /^<([a-zA-Z][a-zA-Z0-9+.\-]{1,31}):([^<>\x00-\x20]*)>/;

  var autolink = function autolink(state, silent) {
    var tail,
        linkMatch,
        emailMatch,
        url,
        fullUrl,
        token,
        pos = state.pos;

    if (state.src.charCodeAt(pos) !== 0x3C
    /* < */
    ) {
        return false;
      }

    tail = state.src.slice(pos);

    if (tail.indexOf('>') < 0) {
      return false;
    }

    if (AUTOLINK_RE.test(tail)) {
      linkMatch = tail.match(AUTOLINK_RE);
      url = linkMatch[0].slice(1, -1);
      fullUrl = state.md.normalizeLink(url);

      if (!state.md.validateLink(fullUrl)) {
        return false;
      }

      if (!silent) {
        token = state.push('link_open', 'a', 1);
        token.attrs = [['href', fullUrl]];
        token.markup = 'autolink';
        token.info = 'auto';
        token = state.push('text', '', 0);
        token.content = state.md.normalizeLinkText(url);
        token = state.push('link_close', 'a', -1);
        token.markup = 'autolink';
        token.info = 'auto';
      }

      state.pos += linkMatch[0].length;
      return true;
    }

    if (EMAIL_RE.test(tail)) {
      emailMatch = tail.match(EMAIL_RE);
      url = emailMatch[0].slice(1, -1);
      fullUrl = state.md.normalizeLink('mailto:' + url);

      if (!state.md.validateLink(fullUrl)) {
        return false;
      }

      if (!silent) {
        token = state.push('link_open', 'a', 1);
        token.attrs = [['href', fullUrl]];
        token.markup = 'autolink';
        token.info = 'auto';
        token = state.push('text', '', 0);
        token.content = state.md.normalizeLinkText(url);
        token = state.push('link_close', 'a', -1);
        token.markup = 'autolink';
        token.info = 'auto';
      }

      state.pos += emailMatch[0].length;
      return true;
    }

    return false;
  };

  var HTML_TAG_RE$1 = html_re.HTML_TAG_RE;

  function isLetter(ch) {
    /*eslint no-bitwise:0*/
    var lc = ch | 0x20; // to lower case

    return lc >= 0x61
    /* a */
    && lc <= 0x7a
    /* z */
    ;
  }

  var html_inline = function html_inline(state, silent) {
    var ch,
        match,
        max,
        token,
        pos = state.pos;

    if (!state.md.options.html) {
      return false;
    } // Check start


    max = state.posMax;

    if (state.src.charCodeAt(pos) !== 0x3C
    /* < */
    || pos + 2 >= max) {
      return false;
    } // Quick fail on second char


    ch = state.src.charCodeAt(pos + 1);

    if (ch !== 0x21
    /* ! */
    && ch !== 0x3F
    /* ? */
    && ch !== 0x2F
    /* / */
    && !isLetter(ch)) {
      return false;
    }

    match = state.src.slice(pos).match(HTML_TAG_RE$1);

    if (!match) {
      return false;
    }

    if (!silent) {
      token = state.push('html_inline', '', 0);
      token.content = state.src.slice(pos, pos + match[0].length);
    }

    state.pos += match[0].length;
    return true;
  };

  var has = utils.has;

  var isValidEntityCode = utils.isValidEntityCode;

  var fromCodePoint = utils.fromCodePoint;

  var DIGITAL_RE = /^&#((?:x[a-f0-9]{1,6}|[0-9]{1,7}));/i;
  var NAMED_RE = /^&([a-z][a-z0-9]{1,31});/i;

  var entity = function entity(state, silent) {
    var ch,
        code,
        match,
        pos = state.pos,
        max = state.posMax;

    if (state.src.charCodeAt(pos) !== 0x26
    /* & */
    ) {
        return false;
      }

    if (pos + 1 < max) {
      ch = state.src.charCodeAt(pos + 1);

      if (ch === 0x23
      /* # */
      ) {
          match = state.src.slice(pos).match(DIGITAL_RE);

          if (match) {
            if (!silent) {
              code = match[1][0].toLowerCase() === 'x' ? parseInt(match[1].slice(1), 16) : parseInt(match[1], 10);
              state.pending += isValidEntityCode(code) ? fromCodePoint(code) : fromCodePoint(0xFFFD);
            }

            state.pos += match[0].length;
            return true;
          }
        } else {
        match = state.src.slice(pos).match(NAMED_RE);

        if (match) {
          if (has(entities$2, match[1])) {
            if (!silent) {
              state.pending += entities$2[match[1]];
            }

            state.pos += match[0].length;
            return true;
          }
        }
      }
    }

    if (!silent) {
      state.pending += '&';
    }

    state.pos++;
    return true;
  };

  // For each opening emphasis-like marker find a matching closing one

  function processDelimiters(state, delimiters) {
    var closerIdx,
        openerIdx,
        closer,
        opener,
        minOpenerIdx,
        newMinOpenerIdx,
        isOddMatch,
        lastJump,
        openersBottom = {},
        max = delimiters.length;

    for (closerIdx = 0; closerIdx < max; closerIdx++) {
      closer = delimiters[closerIdx]; // Length is only used for emphasis-specific "rule of 3",
      // if it's not defined (in strikethrough or 3rd party plugins),
      // we can default it to 0 to disable those checks.
      //

      closer.length = closer.length || 0;
      if (!closer.close) continue; // Previously calculated lower bounds (previous fails)
      // for each marker and each delimiter length modulo 3.

      if (!openersBottom.hasOwnProperty(closer.marker)) {
        openersBottom[closer.marker] = [-1, -1, -1];
      }

      minOpenerIdx = openersBottom[closer.marker][closer.length % 3];
      newMinOpenerIdx = -1;
      openerIdx = closerIdx - closer.jump - 1;

      for (; openerIdx > minOpenerIdx; openerIdx -= opener.jump + 1) {
        opener = delimiters[openerIdx];
        if (opener.marker !== closer.marker) continue;
        if (newMinOpenerIdx === -1) newMinOpenerIdx = openerIdx;

        if (opener.open && opener.end < 0 && opener.level === closer.level) {
          isOddMatch = false; // from spec:
          //
          // If one of the delimiters can both open and close emphasis, then the
          // sum of the lengths of the delimiter runs containing the opening and
          // closing delimiters must not be a multiple of 3 unless both lengths
          // are multiples of 3.
          //

          if (opener.close || closer.open) {
            if ((opener.length + closer.length) % 3 === 0) {
              if (opener.length % 3 !== 0 || closer.length % 3 !== 0) {
                isOddMatch = true;
              }
            }
          }

          if (!isOddMatch) {
            // If previous delimiter cannot be an opener, we can safely skip
            // the entire sequence in future checks. This is required to make
            // sure algorithm has linear complexity (see *_*_*_*_*_... case).
            //
            lastJump = openerIdx > 0 && !delimiters[openerIdx - 1].open ? delimiters[openerIdx - 1].jump + 1 : 0;
            closer.jump = closerIdx - openerIdx + lastJump;
            closer.open = false;
            opener.end = closerIdx;
            opener.jump = lastJump;
            opener.close = false;
            newMinOpenerIdx = -1;
            break;
          }
        }
      }

      if (newMinOpenerIdx !== -1) {
        // If match for this delimiter run failed, we want to set lower bound for
        // future lookups. This is required to make sure algorithm has linear
        // complexity.
        //
        // See details here:
        // https://github.com/commonmark/cmark/issues/178#issuecomment-270417442
        //
        openersBottom[closer.marker][(closer.length || 0) % 3] = newMinOpenerIdx;
      }
    }
  }

  var balance_pairs = function link_pairs(state) {
    var curr,
        tokens_meta = state.tokens_meta,
        max = state.tokens_meta.length;
    processDelimiters(state, state.delimiters);

    for (curr = 0; curr < max; curr++) {
      if (tokens_meta[curr] && tokens_meta[curr].delimiters) {
        processDelimiters(state, tokens_meta[curr].delimiters);
      }
    }
  };

  // Clean up tokens after emphasis and strikethrough postprocessing:

  var text_collapse = function text_collapse(state) {
    var curr,
        last,
        level = 0,
        tokens = state.tokens,
        max = state.tokens.length;

    for (curr = last = 0; curr < max; curr++) {
      // re-calculate levels after emphasis/strikethrough turns some text nodes
      // into opening/closing tags
      if (tokens[curr].nesting < 0) level--; // closing tag

      tokens[curr].level = level;
      if (tokens[curr].nesting > 0) level++; // opening tag

      if (tokens[curr].type === 'text' && curr + 1 < max && tokens[curr + 1].type === 'text') {
        // collapse two adjacent text nodes
        tokens[curr + 1].content = tokens[curr].content + tokens[curr + 1].content;
      } else {
        if (curr !== last) {
          tokens[last] = tokens[curr];
        }

        last++;
      }
    }

    if (curr !== last) {
      tokens.length = last;
    }
  };

  var isWhiteSpace$1 = utils.isWhiteSpace;

  var isPunctChar$1 = utils.isPunctChar;

  var isMdAsciiPunct$1 = utils.isMdAsciiPunct;

  function StateInline(src, md, env, outTokens) {
    this.src = src;
    this.env = env;
    this.md = md;
    this.tokens = outTokens;
    this.tokens_meta = Array(outTokens.length);
    this.pos = 0;
    this.posMax = this.src.length;
    this.level = 0;
    this.pending = '';
    this.pendingLevel = 0; // Stores { start: end } pairs. Useful for backtrack
    // optimization of pairs parse (emphasis, strikes).

    this.cache = {}; // List of emphasis-like delimiters for current tag

    this.delimiters = []; // Stack of delimiter lists for upper level tags

    this._prev_delimiters = [];
  } // Flush pending text
  //


  StateInline.prototype.pushPending = function () {
    var token$1 = new token('text', '', 0);
    token$1.content = this.pending;
    token$1.level = this.pendingLevel;
    this.tokens.push(token$1);
    this.pending = '';
    return token$1;
  }; // Push new token to "stream".
  // If pending text exists - flush it as text token
  //


  StateInline.prototype.push = function (type, tag, nesting) {
    if (this.pending) {
      this.pushPending();
    }

    var token$1 = new token(type, tag, nesting);
    var token_meta = null;

    if (nesting < 0) {
      // closing tag
      this.level--;
      this.delimiters = this._prev_delimiters.pop();
    }

    token$1.level = this.level;

    if (nesting > 0) {
      // opening tag
      this.level++;

      this._prev_delimiters.push(this.delimiters);

      this.delimiters = [];
      token_meta = {
        delimiters: this.delimiters
      };
    }

    this.pendingLevel = this.level;
    this.tokens.push(token$1);
    this.tokens_meta.push(token_meta);
    return token$1;
  }; // Scan a sequence of emphasis-like markers, and determine whether
  // it can start an emphasis sequence or end an emphasis sequence.
  //
  //  - start - position to scan from (it should point at a valid marker);
  //  - canSplitWord - determine if these markers can be found inside a word
  //


  StateInline.prototype.scanDelims = function (start, canSplitWord) {
    var pos = start,
        lastChar,
        nextChar,
        count,
        can_open,
        can_close,
        isLastWhiteSpace,
        isLastPunctChar,
        isNextWhiteSpace,
        isNextPunctChar,
        left_flanking = true,
        right_flanking = true,
        max = this.posMax,
        marker = this.src.charCodeAt(start); // treat beginning of the line as a whitespace

    lastChar = start > 0 ? this.src.charCodeAt(start - 1) : 0x20;

    while (pos < max && this.src.charCodeAt(pos) === marker) {
      pos++;
    }

    count = pos - start; // treat end of the line as a whitespace

    nextChar = pos < max ? this.src.charCodeAt(pos) : 0x20;
    isLastPunctChar = isMdAsciiPunct$1(lastChar) || isPunctChar$1(String.fromCharCode(lastChar));
    isNextPunctChar = isMdAsciiPunct$1(nextChar) || isPunctChar$1(String.fromCharCode(nextChar));
    isLastWhiteSpace = isWhiteSpace$1(lastChar);
    isNextWhiteSpace = isWhiteSpace$1(nextChar);

    if (isNextWhiteSpace) {
      left_flanking = false;
    } else if (isNextPunctChar) {
      if (!(isLastWhiteSpace || isLastPunctChar)) {
        left_flanking = false;
      }
    }

    if (isLastWhiteSpace) {
      right_flanking = false;
    } else if (isLastPunctChar) {
      if (!(isNextWhiteSpace || isNextPunctChar)) {
        right_flanking = false;
      }
    }

    if (!canSplitWord) {
      can_open = left_flanking && (!right_flanking || isLastPunctChar);
      can_close = right_flanking && (!left_flanking || isNextPunctChar);
    } else {
      can_open = left_flanking;
      can_close = right_flanking;
    }

    return {
      can_open: can_open,
      can_close: can_close,
      length: count
    };
  }; // re-export Token class to use in block rules


  StateInline.prototype.Token = token;
  var state_inline = StateInline;

  ////////////////////////////////////////////////////////////////////////////////
  // Parser rules


  var _rules$2 = [['text', text], ['newline', newline], ['escape', _escape], ['backticks', backticks], ['strikethrough', strikethrough.tokenize], ['emphasis', emphasis.tokenize], ['link', link], ['image', image$1], ['autolink', autolink], ['html_inline', html_inline], ['entity', entity]];
  var _rules2 = [['balance_pairs', balance_pairs], ['strikethrough', strikethrough.postProcess], ['emphasis', emphasis.postProcess], ['text_collapse', text_collapse]];
  /**
   * new ParserInline()
   **/

  function ParserInline() {
    var i;
    /**
     * ParserInline#ruler -> Ruler
     *
     * [[Ruler]] instance. Keep configuration of inline rules.
     **/

    this.ruler = new ruler();

    for (i = 0; i < _rules$2.length; i++) {
      this.ruler.push(_rules$2[i][0], _rules$2[i][1]);
    }
    /**
     * ParserInline#ruler2 -> Ruler
     *
     * [[Ruler]] instance. Second ruler used for post-processing
     * (e.g. in emphasis-like rules).
     **/


    this.ruler2 = new ruler();

    for (i = 0; i < _rules2.length; i++) {
      this.ruler2.push(_rules2[i][0], _rules2[i][1]);
    }
  } // Skip single token by running all rules in validation mode;
  // returns `true` if any rule reported success
  //


  ParserInline.prototype.skipToken = function (state) {
    var ok,
        i,
        pos = state.pos,
        rules = this.ruler.getRules(''),
        len = rules.length,
        maxNesting = state.md.options.maxNesting,
        cache = state.cache;

    if (typeof cache[pos] !== 'undefined') {
      state.pos = cache[pos];
      return;
    }

    if (state.level < maxNesting) {
      for (i = 0; i < len; i++) {
        // Increment state.level and decrement it later to limit recursion.
        // It's harmless to do here, because no tokens are created. But ideally,
        // we'd need a separate private state variable for this purpose.
        //
        state.level++;
        ok = rules[i](state, true);
        state.level--;

        if (ok) {
          break;
        }
      }
    } else {
      // Too much nesting, just skip until the end of the paragraph.
      //
      // NOTE: this will cause links to behave incorrectly in the following case,
      //       when an amount of `[` is exactly equal to `maxNesting + 1`:
      //
      //       [[[[[[[[[[[[[[[[[[[[[foo]()
      //
      // TODO: remove this workaround when CM standard will allow nested links
      //       (we can replace it by preventing links from being parsed in
      //       validation mode)
      //
      state.pos = state.posMax;
    }

    if (!ok) {
      state.pos++;
    }

    cache[pos] = state.pos;
  }; // Generate tokens for input range
  //


  ParserInline.prototype.tokenize = function (state) {
    var ok,
        i,
        rules = this.ruler.getRules(''),
        len = rules.length,
        end = state.posMax,
        maxNesting = state.md.options.maxNesting;

    while (state.pos < end) {
      // Try all possible rules.
      // On success, rule should:
      //
      // - update `state.pos`
      // - update `state.tokens`
      // - return true
      if (state.level < maxNesting) {
        for (i = 0; i < len; i++) {
          ok = rules[i](state, false);

          if (ok) {
            break;
          }
        }
      }

      if (ok) {
        if (state.pos >= end) {
          break;
        }

        continue;
      }

      state.pending += state.src[state.pos++];
    }

    if (state.pending) {
      state.pushPending();
    }
  };
  /**
   * ParserInline.parse(str, md, env, outTokens)
   *
   * Process input string and push inline tokens into `outTokens`
   **/


  ParserInline.prototype.parse = function (str, md, env, outTokens) {
    var i, rules, len;
    var state = new this.State(str, md, env, outTokens);
    this.tokenize(state);
    rules = this.ruler2.getRules('');
    len = rules.length;

    for (i = 0; i < len; i++) {
      rules[i](state);
    }
  };

  ParserInline.prototype.State = state_inline;
  var parser_inline = ParserInline;

  var re = function (opts) {
    var re = {}; // Use direct extract instead of `regenerate` to reduse browserified size

    re.src_Any = regex$1.source;
    re.src_Cc = regex$2.source;
    re.src_Z = regex$4.source;
    re.src_P = regex.source; // \p{\Z\P\Cc\CF} (white spaces + control + format + punctuation)

    re.src_ZPCc = [re.src_Z, re.src_P, re.src_Cc].join('|'); // \p{\Z\Cc} (white spaces + control)

    re.src_ZCc = [re.src_Z, re.src_Cc].join('|'); // Experimental. List of chars, completely prohibited in links
    // because can separate it from other part of text

    var text_separators = '[><\uff5c]'; // All possible word characters (everything without punctuation, spaces & controls)
    // Defined via punctuation & spaces to save space
    // Should be something like \p{\L\N\S\M} (\w but without `_`)

    re.src_pseudo_letter = '(?:(?!' + text_separators + '|' + re.src_ZPCc + ')' + re.src_Any + ')'; // The same as abothe but without [0-9]
    // var src_pseudo_letter_non_d = '(?:(?![0-9]|' + src_ZPCc + ')' + src_Any + ')';
    ////////////////////////////////////////////////////////////////////////////////

    re.src_ip4 = '(?:(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)'; // Prohibit any of "@/[]()" in user/pass to avoid wrong domain fetch.

    re.src_auth = '(?:(?:(?!' + re.src_ZCc + '|[@/\\[\\]()]).)+@)?';
    re.src_port = '(?::(?:6(?:[0-4]\\d{3}|5(?:[0-4]\\d{2}|5(?:[0-2]\\d|3[0-5])))|[1-5]?\\d{1,4}))?';
    re.src_host_terminator = '(?=$|' + text_separators + '|' + re.src_ZPCc + ')(?!-|_|:\\d|\\.-|\\.(?!$|' + re.src_ZPCc + '))';
    re.src_path = '(?:' + '[/?#]' + '(?:' + '(?!' + re.src_ZCc + '|' + text_separators + '|[()[\\]{}.,"\'?!\\-]).|' + '\\[(?:(?!' + re.src_ZCc + '|\\]).)*\\]|' + '\\((?:(?!' + re.src_ZCc + '|[)]).)*\\)|' + '\\{(?:(?!' + re.src_ZCc + '|[}]).)*\\}|' + '\\"(?:(?!' + re.src_ZCc + '|["]).)+\\"|' + "\\'(?:(?!" + re.src_ZCc + "|[']).)+\\'|" + "\\'(?=" + re.src_pseudo_letter + '|[-]).|' + // allow `I'm_king` if no pair found
    '\\.{2,4}[a-zA-Z0-9%/]|' + // github has ... in commit range links,
    // google has .... in links (issue #66)
    // Restrict to
    // - english
    // - percent-encoded
    // - parts of file path
    // until more examples found.
    '\\.(?!' + re.src_ZCc + '|[.]).|' + (opts && opts['---'] ? '\\-(?!--(?:[^-]|$))(?:-*)|' // `---` => long dash, terminate
    : '\\-+|') + '\\,(?!' + re.src_ZCc + ').|' + // allow `,,,` in paths
    '\\!(?!' + re.src_ZCc + '|[!]).|' + '\\?(?!' + re.src_ZCc + '|[?]).' + ')+' + '|\\/' + ')?'; // Allow anything in markdown spec, forbid quote (") at the first position
    // because emails enclosed in quotes are far more common

    re.src_email_name = '[\\-;:&=\\+\\$,\\.a-zA-Z0-9_][\\-;:&=\\+\\$,\\"\\.a-zA-Z0-9_]*';
    re.src_xn = 'xn--[a-z0-9\\-]{1,59}'; // More to read about domain names
    // http://serverfault.com/questions/638260/

    re.src_domain_root = // Allow letters & digits (http://test1)
    '(?:' + re.src_xn + '|' + re.src_pseudo_letter + '{1,63}' + ')';
    re.src_domain = '(?:' + re.src_xn + '|' + '(?:' + re.src_pseudo_letter + ')' + '|' + '(?:' + re.src_pseudo_letter + '(?:-|' + re.src_pseudo_letter + '){0,61}' + re.src_pseudo_letter + ')' + ')';
    re.src_host = '(?:' + // Don't need IP check, because digits are already allowed in normal domain names
    //   src_ip4 +
    // '|' +
    '(?:(?:(?:' + re.src_domain + ')\\.)*' + re.src_domain
    /*_root*/
    + ')' + ')';
    re.tpl_host_fuzzy = '(?:' + re.src_ip4 + '|' + '(?:(?:(?:' + re.src_domain + ')\\.)+(?:%TLDS%))' + ')';
    re.tpl_host_no_ip_fuzzy = '(?:(?:(?:' + re.src_domain + ')\\.)+(?:%TLDS%))';
    re.src_host_strict = re.src_host + re.src_host_terminator;
    re.tpl_host_fuzzy_strict = re.tpl_host_fuzzy + re.src_host_terminator;
    re.src_host_port_strict = re.src_host + re.src_port + re.src_host_terminator;
    re.tpl_host_port_fuzzy_strict = re.tpl_host_fuzzy + re.src_port + re.src_host_terminator;
    re.tpl_host_port_no_ip_fuzzy_strict = re.tpl_host_no_ip_fuzzy + re.src_port + re.src_host_terminator; ////////////////////////////////////////////////////////////////////////////////
    // Main rules
    // Rude test fuzzy links by host, for quick deny

    re.tpl_host_fuzzy_test = 'localhost|www\\.|\\.\\d{1,3}\\.|(?:\\.(?:%TLDS%)(?:' + re.src_ZPCc + '|>|$))';
    re.tpl_email_fuzzy = '(^|' + text_separators + '|"|\\(|' + re.src_ZCc + ')' + '(' + re.src_email_name + '@' + re.tpl_host_fuzzy_strict + ')';
    re.tpl_link_fuzzy = // Fuzzy link can't be prepended with .:/\- and non punctuation.
    // but can start with > (markdown blockquote)
    '(^|(?![.:/\\-_@])(?:[$+<=>^`|\uff5c]|' + re.src_ZPCc + '))' + '((?![$+<=>^`|\uff5c])' + re.tpl_host_port_fuzzy_strict + re.src_path + ')';
    re.tpl_link_no_ip_fuzzy = // Fuzzy link can't be prepended with .:/\- and non punctuation.
    // but can start with > (markdown blockquote)
    '(^|(?![.:/\\-_@])(?:[$+<=>^`|\uff5c]|' + re.src_ZPCc + '))' + '((?![$+<=>^`|\uff5c])' + re.tpl_host_port_no_ip_fuzzy_strict + re.src_path + ')';
    return re;
  };

  // Helpers
  // Merge objects
  //

  function assign$1(obj
  /*from1, from2, from3, ...*/
  ) {
    var sources = Array.prototype.slice.call(arguments, 1);
    sources.forEach(function (source) {
      if (!source) {
        return;
      }

      Object.keys(source).forEach(function (key) {
        obj[key] = source[key];
      });
    });
    return obj;
  }

  function _class(obj) {
    return Object.prototype.toString.call(obj);
  }

  function isString(obj) {
    return _class(obj) === '[object String]';
  }

  function isObject(obj) {
    return _class(obj) === '[object Object]';
  }

  function isRegExp(obj) {
    return _class(obj) === '[object RegExp]';
  }

  function isFunction(obj) {
    return _class(obj) === '[object Function]';
  }

  function escapeRE(str) {
    return str.replace(/[.?*+^$[\]\\(){}|-]/g, '\\$&');
  } ////////////////////////////////////////////////////////////////////////////////


  var defaultOptions = {
    fuzzyLink: true,
    fuzzyEmail: true,
    fuzzyIP: false
  };

  function isOptionsObj(obj) {
    return Object.keys(obj || {}).reduce(function (acc, k) {
      return acc || defaultOptions.hasOwnProperty(k);
    }, false);
  }

  var defaultSchemas = {
    'http:': {
      validate: function (text, pos, self) {
        var tail = text.slice(pos);

        if (!self.re.http) {
          // compile lazily, because "host"-containing variables can change on tlds update.
          self.re.http = new RegExp('^\\/\\/' + self.re.src_auth + self.re.src_host_port_strict + self.re.src_path, 'i');
        }

        if (self.re.http.test(tail)) {
          return tail.match(self.re.http)[0].length;
        }

        return 0;
      }
    },
    'https:': 'http:',
    'ftp:': 'http:',
    '//': {
      validate: function (text, pos, self) {
        var tail = text.slice(pos);

        if (!self.re.no_http) {
          // compile lazily, because "host"-containing variables can change on tlds update.
          self.re.no_http = new RegExp('^' + self.re.src_auth + // Don't allow single-level domains, because of false positives like '//test'
          // with code comments
          '(?:localhost|(?:(?:' + self.re.src_domain + ')\\.)+' + self.re.src_domain_root + ')' + self.re.src_port + self.re.src_host_terminator + self.re.src_path, 'i');
        }

        if (self.re.no_http.test(tail)) {
          // should not be `://` & `///`, that protects from errors in protocol name
          if (pos >= 3 && text[pos - 3] === ':') {
            return 0;
          }

          if (pos >= 3 && text[pos - 3] === '/') {
            return 0;
          }

          return tail.match(self.re.no_http)[0].length;
        }

        return 0;
      }
    },
    'mailto:': {
      validate: function (text, pos, self) {
        var tail = text.slice(pos);

        if (!self.re.mailto) {
          self.re.mailto = new RegExp('^' + self.re.src_email_name + '@' + self.re.src_host_strict, 'i');
        }

        if (self.re.mailto.test(tail)) {
          return tail.match(self.re.mailto)[0].length;
        }

        return 0;
      }
    }
  };
  /*eslint-disable max-len*/
  // RE pattern for 2-character tlds (autogenerated by ./support/tlds_2char_gen.js)

  var tlds_2ch_src_re = 'a[cdefgilmnoqrstuwxz]|b[abdefghijmnorstvwyz]|c[acdfghiklmnoruvwxyz]|d[ejkmoz]|e[cegrstu]|f[ijkmor]|g[abdefghilmnpqrstuwy]|h[kmnrtu]|i[delmnoqrst]|j[emop]|k[eghimnprwyz]|l[abcikrstuvy]|m[acdeghklmnopqrstuvwxyz]|n[acefgilopruz]|om|p[aefghklmnrstwy]|qa|r[eosuw]|s[abcdeghijklmnortuvxyz]|t[cdfghjklmnortvwz]|u[agksyz]|v[aceginu]|w[fs]|y[et]|z[amw]'; // DON'T try to make PRs with changes. Extend TLDs with LinkifyIt.tlds() instead

  var tlds_default = 'biz|com|edu|gov|net|org|pro|web|xxx|aero|asia|coop|info|museum|name|shop|рф'.split('|');
  /*eslint-enable max-len*/
  ////////////////////////////////////////////////////////////////////////////////

  function resetScanCache(self) {
    self.__index__ = -1;
    self.__text_cache__ = '';
  }

  function createValidator(re) {
    return function (text, pos) {
      var tail = text.slice(pos);

      if (re.test(tail)) {
        return tail.match(re)[0].length;
      }

      return 0;
    };
  }

  function createNormalizer() {
    return function (match, self) {
      self.normalize(match);
    };
  } // Schemas compiler. Build regexps.
  //


  function compile(self) {
    // Load & clone RE patterns.
    var re$1 = self.re = re(self.__opts__); // Define dynamic patterns


    var tlds = self.__tlds__.slice();

    self.onCompile();

    if (!self.__tlds_replaced__) {
      tlds.push(tlds_2ch_src_re);
    }

    tlds.push(re$1.src_xn);
    re$1.src_tlds = tlds.join('|');

    function untpl(tpl) {
      return tpl.replace('%TLDS%', re$1.src_tlds);
    }

    re$1.email_fuzzy = RegExp(untpl(re$1.tpl_email_fuzzy), 'i');
    re$1.link_fuzzy = RegExp(untpl(re$1.tpl_link_fuzzy), 'i');
    re$1.link_no_ip_fuzzy = RegExp(untpl(re$1.tpl_link_no_ip_fuzzy), 'i');
    re$1.host_fuzzy_test = RegExp(untpl(re$1.tpl_host_fuzzy_test), 'i'); //
    // Compile each schema
    //

    var aliases = [];
    self.__compiled__ = {}; // Reset compiled data

    function schemaError(name, val) {
      throw new Error('(LinkifyIt) Invalid schema "' + name + '": ' + val);
    }

    Object.keys(self.__schemas__).forEach(function (name) {
      var val = self.__schemas__[name]; // skip disabled methods

      if (val === null) {
        return;
      }

      var compiled = {
        validate: null,
        link: null
      };
      self.__compiled__[name] = compiled;

      if (isObject(val)) {
        if (isRegExp(val.validate)) {
          compiled.validate = createValidator(val.validate);
        } else if (isFunction(val.validate)) {
          compiled.validate = val.validate;
        } else {
          schemaError(name, val);
        }

        if (isFunction(val.normalize)) {
          compiled.normalize = val.normalize;
        } else if (!val.normalize) {
          compiled.normalize = createNormalizer();
        } else {
          schemaError(name, val);
        }

        return;
      }

      if (isString(val)) {
        aliases.push(name);
        return;
      }

      schemaError(name, val);
    }); //
    // Compile postponed aliases
    //

    aliases.forEach(function (alias) {
      if (!self.__compiled__[self.__schemas__[alias]]) {
        // Silently fail on missed schemas to avoid errons on disable.
        // schemaError(alias, self.__schemas__[alias]);
        return;
      }

      self.__compiled__[alias].validate = self.__compiled__[self.__schemas__[alias]].validate;
      self.__compiled__[alias].normalize = self.__compiled__[self.__schemas__[alias]].normalize;
    }); //
    // Fake record for guessed links
    //

    self.__compiled__[''] = {
      validate: null,
      normalize: createNormalizer()
    }; //
    // Build schema condition
    //

    var slist = Object.keys(self.__compiled__).filter(function (name) {
      // Filter disabled & fake schemas
      return name.length > 0 && self.__compiled__[name];
    }).map(escapeRE).join('|'); // (?!_) cause 1.5x slowdown

    self.re.schema_test = RegExp('(^|(?!_)(?:[><\uff5c]|' + re$1.src_ZPCc + '))(' + slist + ')', 'i');
    self.re.schema_search = RegExp('(^|(?!_)(?:[><\uff5c]|' + re$1.src_ZPCc + '))(' + slist + ')', 'ig');
    self.re.pretest = RegExp('(' + self.re.schema_test.source + ')|(' + self.re.host_fuzzy_test.source + ')|@', 'i'); //
    // Cleanup
    //

    resetScanCache(self);
  }
  /**
   * class Match
   *
   * Match result. Single element of array, returned by [[LinkifyIt#match]]
   **/


  function Match(self, shift) {
    var start = self.__index__,
        end = self.__last_index__,
        text = self.__text_cache__.slice(start, end);
    /**
     * Match#schema -> String
     *
     * Prefix (protocol) for matched string.
     **/


    this.schema = self.__schema__.toLowerCase();
    /**
     * Match#index -> Number
     *
     * First position of matched string.
     **/

    this.index = start + shift;
    /**
     * Match#lastIndex -> Number
     *
     * Next position after matched string.
     **/

    this.lastIndex = end + shift;
    /**
     * Match#raw -> String
     *
     * Matched string.
     **/

    this.raw = text;
    /**
     * Match#text -> String
     *
     * Notmalized text of matched string.
     **/

    this.text = text;
    /**
     * Match#url -> String
     *
     * Normalized url of matched string.
     **/

    this.url = text;
  }

  function createMatch(self, shift) {
    var match = new Match(self, shift);

    self.__compiled__[match.schema].normalize(match, self);

    return match;
  }
  /**
   * class LinkifyIt
   **/

  /**
   * new LinkifyIt(schemas, options)
   * - schemas (Object): Optional. Additional schemas to validate (prefix/validator)
   * - options (Object): { fuzzyLink|fuzzyEmail|fuzzyIP: true|false }
   *
   * Creates new linkifier instance with optional additional schemas.
   * Can be called without `new` keyword for convenience.
   *
   * By default understands:
   *
   * - `http(s)://...` , `ftp://...`, `mailto:...` & `//...` links
   * - "fuzzy" links and emails (example.com, foo@bar.com).
   *
   * `schemas` is an object, where each key/value describes protocol/rule:
   *
   * - __key__ - link prefix (usually, protocol name with `:` at the end, `skype:`
   *   for example). `linkify-it` makes shure that prefix is not preceeded with
   *   alphanumeric char and symbols. Only whitespaces and punctuation allowed.
   * - __value__ - rule to check tail after link prefix
   *   - _String_ - just alias to existing rule
   *   - _Object_
   *     - _validate_ - validator function (should return matched length on success),
   *       or `RegExp`.
   *     - _normalize_ - optional function to normalize text & url of matched result
   *       (for example, for @twitter mentions).
   *
   * `options`:
   *
   * - __fuzzyLink__ - recognige URL-s without `http(s):` prefix. Default `true`.
   * - __fuzzyIP__ - allow IPs in fuzzy links above. Can conflict with some texts
   *   like version numbers. Default `false`.
   * - __fuzzyEmail__ - recognize emails without `mailto:` prefix.
   *
   **/


  function LinkifyIt(schemas, options) {
    if (!(this instanceof LinkifyIt)) {
      return new LinkifyIt(schemas, options);
    }

    if (!options) {
      if (isOptionsObj(schemas)) {
        options = schemas;
        schemas = {};
      }
    }

    this.__opts__ = assign$1({}, defaultOptions, options); // Cache last tested result. Used to skip repeating steps on next `match` call.

    this.__index__ = -1;
    this.__last_index__ = -1; // Next scan position

    this.__schema__ = '';
    this.__text_cache__ = '';
    this.__schemas__ = assign$1({}, defaultSchemas, schemas);
    this.__compiled__ = {};
    this.__tlds__ = tlds_default;
    this.__tlds_replaced__ = false;
    this.re = {};
    compile(this);
  }
  /** chainable
   * LinkifyIt#add(schema, definition)
   * - schema (String): rule name (fixed pattern prefix)
   * - definition (String|RegExp|Object): schema definition
   *
   * Add new rule definition. See constructor description for details.
   **/


  LinkifyIt.prototype.add = function add(schema, definition) {
    this.__schemas__[schema] = definition;
    compile(this);
    return this;
  };
  /** chainable
   * LinkifyIt#set(options)
   * - options (Object): { fuzzyLink|fuzzyEmail|fuzzyIP: true|false }
   *
   * Set recognition options for links without schema.
   **/


  LinkifyIt.prototype.set = function set(options) {
    this.__opts__ = assign$1(this.__opts__, options);
    return this;
  };
  /**
   * LinkifyIt#test(text) -> Boolean
   *
   * Searches linkifiable pattern and returns `true` on success or `false` on fail.
   **/


  LinkifyIt.prototype.test = function test(text) {
    // Reset scan cache
    this.__text_cache__ = text;
    this.__index__ = -1;

    if (!text.length) {
      return false;
    }

    var m, ml, me, len, shift, next, re, tld_pos, at_pos; // try to scan for link with schema - that's the most simple rule

    if (this.re.schema_test.test(text)) {
      re = this.re.schema_search;
      re.lastIndex = 0;

      while ((m = re.exec(text)) !== null) {
        len = this.testSchemaAt(text, m[2], re.lastIndex);

        if (len) {
          this.__schema__ = m[2];
          this.__index__ = m.index + m[1].length;
          this.__last_index__ = m.index + m[0].length + len;
          break;
        }
      }
    }

    if (this.__opts__.fuzzyLink && this.__compiled__['http:']) {
      // guess schemaless links
      tld_pos = text.search(this.re.host_fuzzy_test);

      if (tld_pos >= 0) {
        // if tld is located after found link - no need to check fuzzy pattern
        if (this.__index__ < 0 || tld_pos < this.__index__) {
          if ((ml = text.match(this.__opts__.fuzzyIP ? this.re.link_fuzzy : this.re.link_no_ip_fuzzy)) !== null) {
            shift = ml.index + ml[1].length;

            if (this.__index__ < 0 || shift < this.__index__) {
              this.__schema__ = '';
              this.__index__ = shift;
              this.__last_index__ = ml.index + ml[0].length;
            }
          }
        }
      }
    }

    if (this.__opts__.fuzzyEmail && this.__compiled__['mailto:']) {
      // guess schemaless emails
      at_pos = text.indexOf('@');

      if (at_pos >= 0) {
        // We can't skip this check, because this cases are possible:
        // 192.168.1.1@gmail.com, my.in@example.com
        if ((me = text.match(this.re.email_fuzzy)) !== null) {
          shift = me.index + me[1].length;
          next = me.index + me[0].length;

          if (this.__index__ < 0 || shift < this.__index__ || shift === this.__index__ && next > this.__last_index__) {
            this.__schema__ = 'mailto:';
            this.__index__ = shift;
            this.__last_index__ = next;
          }
        }
      }
    }

    return this.__index__ >= 0;
  };
  /**
   * LinkifyIt#pretest(text) -> Boolean
   *
   * Very quick check, that can give false positives. Returns true if link MAY BE
   * can exists. Can be used for speed optimization, when you need to check that
   * link NOT exists.
   **/


  LinkifyIt.prototype.pretest = function pretest(text) {
    return this.re.pretest.test(text);
  };
  /**
   * LinkifyIt#testSchemaAt(text, name, position) -> Number
   * - text (String): text to scan
   * - name (String): rule (schema) name
   * - position (Number): text offset to check from
   *
   * Similar to [[LinkifyIt#test]] but checks only specific protocol tail exactly
   * at given position. Returns length of found pattern (0 on fail).
   **/


  LinkifyIt.prototype.testSchemaAt = function testSchemaAt(text, schema, pos) {
    // If not supported schema check requested - terminate
    if (!this.__compiled__[schema.toLowerCase()]) {
      return 0;
    }

    return this.__compiled__[schema.toLowerCase()].validate(text, pos, this);
  };
  /**
   * LinkifyIt#match(text) -> Array|null
   *
   * Returns array of found link descriptions or `null` on fail. We strongly
   * recommend to use [[LinkifyIt#test]] first, for best speed.
   *
   * ##### Result match description
   *
   * - __schema__ - link schema, can be empty for fuzzy links, or `//` for
   *   protocol-neutral  links.
   * - __index__ - offset of matched text
   * - __lastIndex__ - index of next char after mathch end
   * - __raw__ - matched text
   * - __text__ - normalized text
   * - __url__ - link, generated from matched text
   **/


  LinkifyIt.prototype.match = function match(text) {
    var shift = 0,
        result = []; // Try to take previous element from cache, if .test() called before

    if (this.__index__ >= 0 && this.__text_cache__ === text) {
      result.push(createMatch(this, shift));
      shift = this.__last_index__;
    } // Cut head if cache was used


    var tail = shift ? text.slice(shift) : text; // Scan string until end reached

    while (this.test(tail)) {
      result.push(createMatch(this, shift));
      tail = tail.slice(this.__last_index__);
      shift += this.__last_index__;
    }

    if (result.length) {
      return result;
    }

    return null;
  };
  /** chainable
   * LinkifyIt#tlds(list [, keepOld]) -> this
   * - list (Array): list of tlds
   * - keepOld (Boolean): merge with current list if `true` (`false` by default)
   *
   * Load (or merge) new tlds list. Those are user for fuzzy links (without prefix)
   * to avoid false positives. By default this algorythm used:
   *
   * - hostname with any 2-letter root zones are ok.
   * - biz|com|edu|gov|net|org|pro|web|xxx|aero|asia|coop|info|museum|name|shop|рф
   *   are ok.
   * - encoded (`xn--...`) root zones are ok.
   *
   * If list is replaced, then exact match for 2-chars root zones will be checked.
   **/


  LinkifyIt.prototype.tlds = function tlds(list, keepOld) {
    list = Array.isArray(list) ? list : [list];

    if (!keepOld) {
      this.__tlds__ = list.slice();
      this.__tlds_replaced__ = true;
      compile(this);
      return this;
    }

    this.__tlds__ = this.__tlds__.concat(list).sort().filter(function (el, idx, arr) {
      return el !== arr[idx - 1];
    }).reverse();
    compile(this);
    return this;
  };
  /**
   * LinkifyIt#normalize(match)
   *
   * Default normalizer (if schema does not define it's own).
   **/


  LinkifyIt.prototype.normalize = function normalize(match) {
    // Do minimal possible changes by default. Need to collect feedback prior
    // to move forward https://github.com/markdown-it/linkify-it/issues/1
    if (!match.schema) {
      match.url = 'http://' + match.url;
    }

    if (match.schema === 'mailto:' && !/^mailto:/i.test(match.url)) {
      match.url = 'mailto:' + match.url;
    }
  };
  /**
   * LinkifyIt#onCompile()
   *
   * Override to modify basic RegExp-s.
   **/


  LinkifyIt.prototype.onCompile = function onCompile() {};

  var linkifyIt = LinkifyIt;

  /*! https://mths.be/punycode v1.4.1 by @mathias */

  /** Highest positive signed 32-bit float value */
  var maxInt = 2147483647; // aka. 0x7FFFFFFF or 2^31-1

  /** Bootstring parameters */

  var base = 36;
  var tMin = 1;
  var tMax = 26;
  var skew = 38;
  var damp = 700;
  var initialBias = 72;
  var initialN = 128; // 0x80

  var delimiter = '-'; // '\x2D'

  /** Regular expressions */

  var regexPunycode = /^xn--/;
  var regexNonASCII = /[^\x20-\x7E]/; // unprintable ASCII chars + non-ASCII chars

  var regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g; // RFC 3490 separators

  /** Error messages */

  var errors = {
    'overflow': 'Overflow: input needs wider integers to process',
    'not-basic': 'Illegal input >= 0x80 (not a basic code point)',
    'invalid-input': 'Invalid input'
  };
  /** Convenience shortcuts */

  var baseMinusTMin = base - tMin;
  var floor = Math.floor;
  var stringFromCharCode = String.fromCharCode;
  /*--------------------------------------------------------------------------*/

  /**
   * A generic error utility function.
   * @private
   * @param {String} type The error type.
   * @returns {Error} Throws a `RangeError` with the applicable error message.
   */

  function error(type) {
    throw new RangeError(errors[type]);
  }
  /**
   * A generic `Array#map` utility function.
   * @private
   * @param {Array} array The array to iterate over.
   * @param {Function} callback The function that gets called for every array
   * item.
   * @returns {Array} A new array of values returned by the callback function.
   */


  function map$1(array, fn) {
    var length = array.length;
    var result = [];

    while (length--) {
      result[length] = fn(array[length]);
    }

    return result;
  }
  /**
   * A simple `Array#map`-like wrapper to work with domain name strings or email
   * addresses.
   * @private
   * @param {String} domain The domain name or email address.
   * @param {Function} callback The function that gets called for every
   * character.
   * @returns {Array} A new string of characters returned by the callback
   * function.
   */


  function mapDomain(string, fn) {
    var parts = string.split('@');
    var result = '';

    if (parts.length > 1) {
      // In email addresses, only the domain name should be punycoded. Leave
      // the local part (i.e. everything up to `@`) intact.
      result = parts[0] + '@';
      string = parts[1];
    } // Avoid `split(regex)` for IE8 compatibility. See #17.


    string = string.replace(regexSeparators, '\x2E');
    var labels = string.split('.');
    var encoded = map$1(labels, fn).join('.');
    return result + encoded;
  }
  /**
   * Creates an array containing the numeric code points of each Unicode
   * character in the string. While JavaScript uses UCS-2 internally,
   * this function will convert a pair of surrogate halves (each of which
   * UCS-2 exposes as separate characters) into a single code point,
   * matching UTF-16.
   * @see `punycode.ucs2.encode`
   * @see <https://mathiasbynens.be/notes/javascript-encoding>
   * @memberOf punycode.ucs2
   * @name decode
   * @param {String} string The Unicode input string (UCS-2).
   * @returns {Array} The new array of code points.
   */


  function ucs2decode(string) {
    var output = [],
        counter = 0,
        length = string.length,
        value,
        extra;

    while (counter < length) {
      value = string.charCodeAt(counter++);

      if (value >= 0xD800 && value <= 0xDBFF && counter < length) {
        // high surrogate, and there is a next character
        extra = string.charCodeAt(counter++);

        if ((extra & 0xFC00) == 0xDC00) {
          // low surrogate
          output.push(((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000);
        } else {
          // unmatched surrogate; only append this code unit, in case the next
          // code unit is the high surrogate of a surrogate pair
          output.push(value);
          counter--;
        }
      } else {
        output.push(value);
      }
    }

    return output;
  }
  /**
   * Creates a string based on an array of numeric code points.
   * @see `punycode.ucs2.decode`
   * @memberOf punycode.ucs2
   * @name encode
   * @param {Array} codePoints The array of numeric code points.
   * @returns {String} The new Unicode string (UCS-2).
   */


  function ucs2encode(array) {
    return map$1(array, function (value) {
      var output = '';

      if (value > 0xFFFF) {
        value -= 0x10000;
        output += stringFromCharCode(value >>> 10 & 0x3FF | 0xD800);
        value = 0xDC00 | value & 0x3FF;
      }

      output += stringFromCharCode(value);
      return output;
    }).join('');
  }
  /**
   * Converts a basic code point into a digit/integer.
   * @see `digitToBasic()`
   * @private
   * @param {Number} codePoint The basic numeric code point value.
   * @returns {Number} The numeric value of a basic code point (for use in
   * representing integers) in the range `0` to `base - 1`, or `base` if
   * the code point does not represent a value.
   */


  function basicToDigit(codePoint) {
    if (codePoint - 48 < 10) {
      return codePoint - 22;
    }

    if (codePoint - 65 < 26) {
      return codePoint - 65;
    }

    if (codePoint - 97 < 26) {
      return codePoint - 97;
    }

    return base;
  }
  /**
   * Converts a digit/integer into a basic code point.
   * @see `basicToDigit()`
   * @private
   * @param {Number} digit The numeric value of a basic code point.
   * @returns {Number} The basic code point whose value (when used for
   * representing integers) is `digit`, which needs to be in the range
   * `0` to `base - 1`. If `flag` is non-zero, the uppercase form is
   * used; else, the lowercase form is used. The behavior is undefined
   * if `flag` is non-zero and `digit` has no uppercase form.
   */


  function digitToBasic(digit, flag) {
    //  0..25 map to ASCII a..z or A..Z
    // 26..35 map to ASCII 0..9
    return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
  }
  /**
   * Bias adaptation function as per section 3.4 of RFC 3492.
   * https://tools.ietf.org/html/rfc3492#section-3.4
   * @private
   */


  function adapt(delta, numPoints, firstTime) {
    var k = 0;
    delta = firstTime ? floor(delta / damp) : delta >> 1;
    delta += floor(delta / numPoints);

    for (;
    /* no initialization */
    delta > baseMinusTMin * tMax >> 1; k += base) {
      delta = floor(delta / baseMinusTMin);
    }

    return floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
  }
  /**
   * Converts a Punycode string of ASCII-only symbols to a string of Unicode
   * symbols.
   * @memberOf punycode
   * @param {String} input The Punycode string of ASCII-only symbols.
   * @returns {String} The resulting string of Unicode symbols.
   */


  function decode$2(input) {
    // Don't use UCS-2
    var output = [],
        inputLength = input.length,
        out,
        i = 0,
        n = initialN,
        bias = initialBias,
        basic,
        j,
        index,
        oldi,
        w,
        k,
        digit,
        t,

    /** Cached calculation results */
    baseMinusT; // Handle the basic code points: let `basic` be the number of input code
    // points before the last delimiter, or `0` if there is none, then copy
    // the first basic code points to the output.

    basic = input.lastIndexOf(delimiter);

    if (basic < 0) {
      basic = 0;
    }

    for (j = 0; j < basic; ++j) {
      // if it's not a basic code point
      if (input.charCodeAt(j) >= 0x80) {
        error('not-basic');
      }

      output.push(input.charCodeAt(j));
    } // Main decoding loop: start just after the last delimiter if any basic code
    // points were copied; start at the beginning otherwise.


    for (index = basic > 0 ? basic + 1 : 0; index < inputLength;)
    /* no final expression */
    {
      // `index` is the index of the next character to be consumed.
      // Decode a generalized variable-length integer into `delta`,
      // which gets added to `i`. The overflow checking is easier
      // if we increase `i` as we go, then subtract off its starting
      // value at the end to obtain `delta`.
      for (oldi = i, w = 1, k = base;;
      /* no condition */
      k += base) {
        if (index >= inputLength) {
          error('invalid-input');
        }

        digit = basicToDigit(input.charCodeAt(index++));

        if (digit >= base || digit > floor((maxInt - i) / w)) {
          error('overflow');
        }

        i += digit * w;
        t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;

        if (digit < t) {
          break;
        }

        baseMinusT = base - t;

        if (w > floor(maxInt / baseMinusT)) {
          error('overflow');
        }

        w *= baseMinusT;
      }

      out = output.length + 1;
      bias = adapt(i - oldi, out, oldi == 0); // `i` was supposed to wrap around from `out` to `0`,
      // incrementing `n` each time, so we'll fix that now:

      if (floor(i / out) > maxInt - n) {
        error('overflow');
      }

      n += floor(i / out);
      i %= out; // Insert `n` at position `i` of the output

      output.splice(i++, 0, n);
    }

    return ucs2encode(output);
  }
  /**
   * Converts a string of Unicode symbols (e.g. a domain name label) to a
   * Punycode string of ASCII-only symbols.
   * @memberOf punycode
   * @param {String} input The string of Unicode symbols.
   * @returns {String} The resulting Punycode string of ASCII-only symbols.
   */

  function encode$2(input) {
    var n,
        delta,
        handledCPCount,
        basicLength,
        bias,
        j,
        m,
        q,
        k,
        t,
        currentValue,
        output = [],

    /** `inputLength` will hold the number of code points in `input`. */
    inputLength,

    /** Cached calculation results */
    handledCPCountPlusOne,
        baseMinusT,
        qMinusT; // Convert the input in UCS-2 to Unicode

    input = ucs2decode(input); // Cache the length

    inputLength = input.length; // Initialize the state

    n = initialN;
    delta = 0;
    bias = initialBias; // Handle the basic code points

    for (j = 0; j < inputLength; ++j) {
      currentValue = input[j];

      if (currentValue < 0x80) {
        output.push(stringFromCharCode(currentValue));
      }
    }

    handledCPCount = basicLength = output.length; // `handledCPCount` is the number of code points that have been handled;
    // `basicLength` is the number of basic code points.
    // Finish the basic string - if it is not empty - with a delimiter

    if (basicLength) {
      output.push(delimiter);
    } // Main encoding loop:


    while (handledCPCount < inputLength) {
      // All non-basic code points < n have been handled already. Find the next
      // larger one:
      for (m = maxInt, j = 0; j < inputLength; ++j) {
        currentValue = input[j];

        if (currentValue >= n && currentValue < m) {
          m = currentValue;
        }
      } // Increase `delta` enough to advance the decoder's <n,i> state to <m,0>,
      // but guard against overflow


      handledCPCountPlusOne = handledCPCount + 1;

      if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
        error('overflow');
      }

      delta += (m - n) * handledCPCountPlusOne;
      n = m;

      for (j = 0; j < inputLength; ++j) {
        currentValue = input[j];

        if (currentValue < n && ++delta > maxInt) {
          error('overflow');
        }

        if (currentValue == n) {
          // Represent delta as a generalized variable-length integer
          for (q = delta, k = base;;
          /* no condition */
          k += base) {
            t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;

            if (q < t) {
              break;
            }

            qMinusT = q - t;
            baseMinusT = base - t;
            output.push(stringFromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0)));
            q = floor(qMinusT / baseMinusT);
          }

          output.push(stringFromCharCode(digitToBasic(q, 0)));
          bias = adapt(delta, handledCPCountPlusOne, handledCPCount == basicLength);
          delta = 0;
          ++handledCPCount;
        }
      }

      ++delta;
      ++n;
    }

    return output.join('');
  }
  /**
   * Converts a Punycode string representing a domain name or an email address
   * to Unicode. Only the Punycoded parts of the input will be converted, i.e.
   * it doesn't matter if you call it on a string that has already been
   * converted to Unicode.
   * @memberOf punycode
   * @param {String} input The Punycoded domain name or email address to
   * convert to Unicode.
   * @returns {String} The Unicode representation of the given Punycode
   * string.
   */

  function toUnicode(input) {
    return mapDomain(input, function (string) {
      return regexPunycode.test(string) ? decode$2(string.slice(4).toLowerCase()) : string;
    });
  }
  /**
   * Converts a Unicode string representing a domain name or an email address to
   * Punycode. Only the non-ASCII parts of the domain name will be converted,
   * i.e. it doesn't matter if you call it with a domain that's already in
   * ASCII.
   * @memberOf punycode
   * @param {String} input The domain name or email address to convert, as a
   * Unicode string.
   * @returns {String} The Punycode representation of the given domain name or
   * email address.
   */

  function toASCII(input) {
    return mapDomain(input, function (string) {
      return regexNonASCII.test(string) ? 'xn--' + encode$2(string) : string;
    });
  }
  var version = '1.4.1';
  /**
   * An object of methods to convert from JavaScript's internal character
   * representation (UCS-2) to Unicode code points, and back.
   * @see <https://mathiasbynens.be/notes/javascript-encoding>
   * @memberOf punycode
   * @type Object
   */

  var ucs2 = {
    decode: ucs2decode,
    encode: ucs2encode
  };
  var punycode = {
    version: version,
    ucs2: ucs2,
    toASCII: toASCII,
    toUnicode: toUnicode,
    encode: encode$2,
    decode: decode$2
  };

  // markdown-it default options

  var _default = {
    options: {
      html: false,
      // Enable HTML tags in source
      xhtmlOut: false,
      // Use '/' to close single tags (<br />)
      breaks: false,
      // Convert '\n' in paragraphs into <br>
      langPrefix: 'language-',
      // CSS language prefix for fenced blocks
      linkify: false,
      // autoconvert URL-like texts to links
      // Enable some language-neutral replacements + quotes beautification
      typographer: false,
      // Double + single quotes replacement pairs, when typographer enabled,
      // and smartquotes on. Could be either a String or an Array.
      //
      // For example, you can use '«»„“' for Russian, '„“‚‘' for German,
      // and ['«\xA0', '\xA0»', '‹\xA0', '\xA0›'] for French (including nbsp).
      quotes: '\u201c\u201d\u2018\u2019',

      /* “”‘’ */
      // Highlighter function. Should return escaped HTML,
      // or '' if the source string is not changed and should be escaped externaly.
      // If result starts with <pre... internal wrapper is skipped.
      //
      // function (/*str, lang*/) { return ''; }
      //
      highlight: null,
      maxNesting: 100 // Internal protection, recursion limit

    },
    components: {
      core: {},
      block: {},
      inline: {}
    }
  };

  // "Zero" preset, with nothing enabled. Useful for manual configuring of simple

  var zero = {
    options: {
      html: false,
      // Enable HTML tags in source
      xhtmlOut: false,
      // Use '/' to close single tags (<br />)
      breaks: false,
      // Convert '\n' in paragraphs into <br>
      langPrefix: 'language-',
      // CSS language prefix for fenced blocks
      linkify: false,
      // autoconvert URL-like texts to links
      // Enable some language-neutral replacements + quotes beautification
      typographer: false,
      // Double + single quotes replacement pairs, when typographer enabled,
      // and smartquotes on. Could be either a String or an Array.
      //
      // For example, you can use '«»„“' for Russian, '„“‚‘' for German,
      // and ['«\xA0', '\xA0»', '‹\xA0', '\xA0›'] for French (including nbsp).
      quotes: '\u201c\u201d\u2018\u2019',

      /* “”‘’ */
      // Highlighter function. Should return escaped HTML,
      // or '' if the source string is not changed and should be escaped externaly.
      // If result starts with <pre... internal wrapper is skipped.
      //
      // function (/*str, lang*/) { return ''; }
      //
      highlight: null,
      maxNesting: 20 // Internal protection, recursion limit

    },
    components: {
      core: {
        rules: ['normalize', 'block', 'inline']
      },
      block: {
        rules: ['paragraph']
      },
      inline: {
        rules: ['text'],
        rules2: ['balance_pairs', 'text_collapse']
      }
    }
  };

  // Commonmark default options

  var commonmark = {
    options: {
      html: true,
      // Enable HTML tags in source
      xhtmlOut: true,
      // Use '/' to close single tags (<br />)
      breaks: false,
      // Convert '\n' in paragraphs into <br>
      langPrefix: 'language-',
      // CSS language prefix for fenced blocks
      linkify: false,
      // autoconvert URL-like texts to links
      // Enable some language-neutral replacements + quotes beautification
      typographer: false,
      // Double + single quotes replacement pairs, when typographer enabled,
      // and smartquotes on. Could be either a String or an Array.
      //
      // For example, you can use '«»„“' for Russian, '„“‚‘' for German,
      // and ['«\xA0', '\xA0»', '‹\xA0', '\xA0›'] for French (including nbsp).
      quotes: '\u201c\u201d\u2018\u2019',

      /* “”‘’ */
      // Highlighter function. Should return escaped HTML,
      // or '' if the source string is not changed and should be escaped externaly.
      // If result starts with <pre... internal wrapper is skipped.
      //
      // function (/*str, lang*/) { return ''; }
      //
      highlight: null,
      maxNesting: 20 // Internal protection, recursion limit

    },
    components: {
      core: {
        rules: ['normalize', 'block', 'inline']
      },
      block: {
        rules: ['blockquote', 'code', 'fence', 'heading', 'hr', 'html_block', 'lheading', 'list', 'reference', 'paragraph']
      },
      inline: {
        rules: ['autolink', 'backticks', 'emphasis', 'entity', 'escape', 'html_inline', 'image', 'link', 'newline', 'text'],
        rules2: ['balance_pairs', 'emphasis', 'text_collapse']
      }
    }
  };

  var config = {
    'default': _default,
    zero: zero,
    commonmark: commonmark
  }; ////////////////////////////////////////////////////////////////////////////////
  //
  // This validator can prohibit more than really needed to prevent XSS. It's a
  // tradeoff to keep code simple and to be secure by default.
  //
  // If you need different setup - override validator method as you wish. Or
  // replace it with dummy function and use external sanitizer.
  //

  var BAD_PROTO_RE = /^(vbscript|javascript|file|data):/;
  var GOOD_DATA_RE = /^data:image\/(gif|png|jpeg|webp);/;

  function validateLink(url) {
    // url should be normalized at this point, and existing entities are decoded
    var str = url.trim().toLowerCase();
    return BAD_PROTO_RE.test(str) ? GOOD_DATA_RE.test(str) ? true : false : true;
  } ////////////////////////////////////////////////////////////////////////////////


  var RECODE_HOSTNAME_FOR = ['http:', 'https:', 'mailto:'];

  function normalizeLink(url) {
    var parsed = mdurl.parse(url, true);

    if (parsed.hostname) {
      // Encode hostnames in urls like:
      // `http://host/`, `https://host/`, `mailto:user@host`, `//host/`
      //
      // We don't encode unknown schemas, because it's likely that we encode
      // something we shouldn't (e.g. `skype:name` treated as `skype:host`)
      //
      if (!parsed.protocol || RECODE_HOSTNAME_FOR.indexOf(parsed.protocol) >= 0) {
        try {
          parsed.hostname = punycode.toASCII(parsed.hostname);
        } catch (er) {
          /**/
        }
      }
    }

    return mdurl.encode(mdurl.format(parsed));
  }

  function normalizeLinkText(url) {
    var parsed = mdurl.parse(url, true);

    if (parsed.hostname) {
      // Encode hostnames in urls like:
      // `http://host/`, `https://host/`, `mailto:user@host`, `//host/`
      //
      // We don't encode unknown schemas, because it's likely that we encode
      // something we shouldn't (e.g. `skype:name` treated as `skype:host`)
      //
      if (!parsed.protocol || RECODE_HOSTNAME_FOR.indexOf(parsed.protocol) >= 0) {
        try {
          parsed.hostname = punycode.toUnicode(parsed.hostname);
        } catch (er) {
          /**/
        }
      }
    }

    return mdurl.decode(mdurl.format(parsed));
  }
  /**
   * class MarkdownIt
   *
   * Main parser/renderer class.
   *
   * ##### Usage
   *
   * ```javascript
   * // node.js, "classic" way:
   * var MarkdownIt = require('markdown-it'),
   *     md = new MarkdownIt();
   * var result = md.render('# markdown-it rulezz!');
   *
   * // node.js, the same, but with sugar:
   * var md = require('markdown-it')();
   * var result = md.render('# markdown-it rulezz!');
   *
   * // browser without AMD, added to "window" on script load
   * // Note, there are no dash.
   * var md = window.markdownit();
   * var result = md.render('# markdown-it rulezz!');
   * ```
   *
   * Single line rendering, without paragraph wrap:
   *
   * ```javascript
   * var md = require('markdown-it')();
   * var result = md.renderInline('__markdown-it__ rulezz!');
   * ```
   **/

  /**
   * new MarkdownIt([presetName, options])
   * - presetName (String): optional, `commonmark` / `zero`
   * - options (Object)
   *
   * Creates parser instanse with given config. Can be called without `new`.
   *
   * ##### presetName
   *
   * MarkdownIt provides named presets as a convenience to quickly
   * enable/disable active syntax rules and options for common use cases.
   *
   * - ["commonmark"](https://github.com/markdown-it/markdown-it/blob/master/lib/presets/commonmark.js) -
   *   configures parser to strict [CommonMark](http://commonmark.org/) mode.
   * - [default](https://github.com/markdown-it/markdown-it/blob/master/lib/presets/default.js) -
   *   similar to GFM, used when no preset name given. Enables all available rules,
   *   but still without html, typographer & autolinker.
   * - ["zero"](https://github.com/markdown-it/markdown-it/blob/master/lib/presets/zero.js) -
   *   all rules disabled. Useful to quickly setup your config via `.enable()`.
   *   For example, when you need only `bold` and `italic` markup and nothing else.
   *
   * ##### options:
   *
   * - __html__ - `false`. Set `true` to enable HTML tags in source. Be careful!
   *   That's not safe! You may need external sanitizer to protect output from XSS.
   *   It's better to extend features via plugins, instead of enabling HTML.
   * - __xhtmlOut__ - `false`. Set `true` to add '/' when closing single tags
   *   (`<br />`). This is needed only for full CommonMark compatibility. In real
   *   world you will need HTML output.
   * - __breaks__ - `false`. Set `true` to convert `\n` in paragraphs into `<br>`.
   * - __langPrefix__ - `language-`. CSS language class prefix for fenced blocks.
   *   Can be useful for external highlighters.
   * - __linkify__ - `false`. Set `true` to autoconvert URL-like text to links.
   * - __typographer__  - `false`. Set `true` to enable [some language-neutral
   *   replacement](https://github.com/markdown-it/markdown-it/blob/master/lib/rules_core/replacements.js) +
   *   quotes beautification (smartquotes).
   * - __quotes__ - `“”‘’`, String or Array. Double + single quotes replacement
   *   pairs, when typographer enabled and smartquotes on. For example, you can
   *   use `'«»„“'` for Russian, `'„“‚‘'` for German, and
   *   `['«\xA0', '\xA0»', '‹\xA0', '\xA0›']` for French (including nbsp).
   * - __highlight__ - `null`. Highlighter function for fenced code blocks.
   *   Highlighter `function (str, lang)` should return escaped HTML. It can also
   *   return empty string if the source was not changed and should be escaped
   *   externaly. If result starts with <pre... internal wrapper is skipped.
   *
   * ##### Example
   *
   * ```javascript
   * // commonmark mode
   * var md = require('markdown-it')('commonmark');
   *
   * // default mode
   * var md = require('markdown-it')();
   *
   * // enable everything
   * var md = require('markdown-it')({
   *   html: true,
   *   linkify: true,
   *   typographer: true
   * });
   * ```
   *
   * ##### Syntax highlighting
   *
   * ```js
   * var hljs = require('highlight.js') // https://highlightjs.org/
   *
   * var md = require('markdown-it')({
   *   highlight: function (str, lang) {
   *     if (lang && hljs.getLanguage(lang)) {
   *       try {
   *         return hljs.highlight(lang, str, true).value;
   *       } catch (__) {}
   *     }
   *
   *     return ''; // use external default escaping
   *   }
   * });
   * ```
   *
   * Or with full wrapper override (if you need assign class to `<pre>`):
   *
   * ```javascript
   * var hljs = require('highlight.js') // https://highlightjs.org/
   *
   * // Actual default values
   * var md = require('markdown-it')({
   *   highlight: function (str, lang) {
   *     if (lang && hljs.getLanguage(lang)) {
   *       try {
   *         return '<pre class="hljs"><code>' +
   *                hljs.highlight(lang, str, true).value +
   *                '</code></pre>';
   *       } catch (__) {}
   *     }
   *
   *     return '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + '</code></pre>';
   *   }
   * });
   * ```
   *
   **/


  function MarkdownIt(presetName, options) {
    if (!(this instanceof MarkdownIt)) {
      return new MarkdownIt(presetName, options);
    }

    if (!options) {
      if (!utils.isString(presetName)) {
        options = presetName || {};
        presetName = 'default';
      }
    }
    /**
     * MarkdownIt#inline -> ParserInline
     *
     * Instance of [[ParserInline]]. You may need it to add new rules when
     * writing plugins. For simple rules control use [[MarkdownIt.disable]] and
     * [[MarkdownIt.enable]].
     **/


    this.inline = new parser_inline();
    /**
     * MarkdownIt#block -> ParserBlock
     *
     * Instance of [[ParserBlock]]. You may need it to add new rules when
     * writing plugins. For simple rules control use [[MarkdownIt.disable]] and
     * [[MarkdownIt.enable]].
     **/

    this.block = new parser_block();
    /**
     * MarkdownIt#core -> Core
     *
     * Instance of [[Core]] chain executor. You may need it to add new rules when
     * writing plugins. For simple rules control use [[MarkdownIt.disable]] and
     * [[MarkdownIt.enable]].
     **/

    this.core = new parser_core();
    /**
     * MarkdownIt#renderer -> Renderer
     *
     * Instance of [[Renderer]]. Use it to modify output look. Or to add rendering
     * rules for new token types, generated by plugins.
     *
     * ##### Example
     *
     * ```javascript
     * var md = require('markdown-it')();
     *
     * function myToken(tokens, idx, options, env, self) {
     *   //...
     *   return result;
     * };
     *
     * md.renderer.rules['my_token'] = myToken
     * ```
     *
     * See [[Renderer]] docs and [source code](https://github.com/markdown-it/markdown-it/blob/master/lib/renderer.js).
     **/

    this.renderer = new renderer();
    /**
     * MarkdownIt#linkify -> LinkifyIt
     *
     * [linkify-it](https://github.com/markdown-it/linkify-it) instance.
     * Used by [linkify](https://github.com/markdown-it/markdown-it/blob/master/lib/rules_core/linkify.js)
     * rule.
     **/

    this.linkify = new linkifyIt();
    /**
     * MarkdownIt#validateLink(url) -> Boolean
     *
     * Link validation function. CommonMark allows too much in links. By default
     * we disable `javascript:`, `vbscript:`, `file:` schemas, and almost all `data:...` schemas
     * except some embedded image types.
     *
     * You can change this behaviour:
     *
     * ```javascript
     * var md = require('markdown-it')();
     * // enable everything
     * md.validateLink = function () { return true; }
     * ```
     **/

    this.validateLink = validateLink;
    /**
     * MarkdownIt#normalizeLink(url) -> String
     *
     * Function used to encode link url to a machine-readable format,
     * which includes url-encoding, punycode, etc.
     **/

    this.normalizeLink = normalizeLink;
    /**
     * MarkdownIt#normalizeLinkText(url) -> String
     *
     * Function used to decode link url to a human-readable format`
     **/

    this.normalizeLinkText = normalizeLinkText; // Expose utils & helpers for easy acces from plugins

    /**
     * MarkdownIt#utils -> utils
     *
     * Assorted utility functions, useful to write plugins. See details
     * [here](https://github.com/markdown-it/markdown-it/blob/master/lib/common/utils.js).
     **/

    this.utils = utils;
    /**
     * MarkdownIt#helpers -> helpers
     *
     * Link components parser functions, useful to write plugins. See details
     * [here](https://github.com/markdown-it/markdown-it/blob/master/lib/helpers).
     **/

    this.helpers = utils.assign({}, helpers);
    this.options = {};
    this.configure(presetName);

    if (options) {
      this.set(options);
    }
  }
  /** chainable
   * MarkdownIt.set(options)
   *
   * Set parser options (in the same format as in constructor). Probably, you
   * will never need it, but you can change options after constructor call.
   *
   * ##### Example
   *
   * ```javascript
   * var md = require('markdown-it')()
   *             .set({ html: true, breaks: true })
   *             .set({ typographer, true });
   * ```
   *
   * __Note:__ To achieve the best possible performance, don't modify a
   * `markdown-it` instance options on the fly. If you need multiple configurations
   * it's best to create multiple instances and initialize each with separate
   * config.
   **/


  MarkdownIt.prototype.set = function (options) {
    utils.assign(this.options, options);
    return this;
  };
  /** chainable, internal
   * MarkdownIt.configure(presets)
   *
   * Batch load of all options and compenent settings. This is internal method,
   * and you probably will not need it. But if you with - see available presets
   * and data structure [here](https://github.com/markdown-it/markdown-it/tree/master/lib/presets)
   *
   * We strongly recommend to use presets instead of direct config loads. That
   * will give better compatibility with next versions.
   **/


  MarkdownIt.prototype.configure = function (presets) {
    var self = this,
        presetName;

    if (utils.isString(presets)) {
      presetName = presets;
      presets = config[presetName];

      if (!presets) {
        throw new Error('Wrong `markdown-it` preset "' + presetName + '", check name');
      }
    }

    if (!presets) {
      throw new Error('Wrong `markdown-it` preset, can\'t be empty');
    }

    if (presets.options) {
      self.set(presets.options);
    }

    if (presets.components) {
      Object.keys(presets.components).forEach(function (name) {
        if (presets.components[name].rules) {
          self[name].ruler.enableOnly(presets.components[name].rules);
        }

        if (presets.components[name].rules2) {
          self[name].ruler2.enableOnly(presets.components[name].rules2);
        }
      });
    }

    return this;
  };
  /** chainable
   * MarkdownIt.enable(list, ignoreInvalid)
   * - list (String|Array): rule name or list of rule names to enable
   * - ignoreInvalid (Boolean): set `true` to ignore errors when rule not found.
   *
   * Enable list or rules. It will automatically find appropriate components,
   * containing rules with given names. If rule not found, and `ignoreInvalid`
   * not set - throws exception.
   *
   * ##### Example
   *
   * ```javascript
   * var md = require('markdown-it')()
   *             .enable(['sub', 'sup'])
   *             .disable('smartquotes');
   * ```
   **/


  MarkdownIt.prototype.enable = function (list, ignoreInvalid) {
    var result = [];

    if (!Array.isArray(list)) {
      list = [list];
    }

    ['core', 'block', 'inline'].forEach(function (chain) {
      result = result.concat(this[chain].ruler.enable(list, true));
    }, this);
    result = result.concat(this.inline.ruler2.enable(list, true));
    var missed = list.filter(function (name) {
      return result.indexOf(name) < 0;
    });

    if (missed.length && !ignoreInvalid) {
      throw new Error('MarkdownIt. Failed to enable unknown rule(s): ' + missed);
    }

    return this;
  };
  /** chainable
   * MarkdownIt.disable(list, ignoreInvalid)
   * - list (String|Array): rule name or list of rule names to disable.
   * - ignoreInvalid (Boolean): set `true` to ignore errors when rule not found.
   *
   * The same as [[MarkdownIt.enable]], but turn specified rules off.
   **/


  MarkdownIt.prototype.disable = function (list, ignoreInvalid) {
    var result = [];

    if (!Array.isArray(list)) {
      list = [list];
    }

    ['core', 'block', 'inline'].forEach(function (chain) {
      result = result.concat(this[chain].ruler.disable(list, true));
    }, this);
    result = result.concat(this.inline.ruler2.disable(list, true));
    var missed = list.filter(function (name) {
      return result.indexOf(name) < 0;
    });

    if (missed.length && !ignoreInvalid) {
      throw new Error('MarkdownIt. Failed to disable unknown rule(s): ' + missed);
    }

    return this;
  };
  /** chainable
   * MarkdownIt.use(plugin, params)
   *
   * Load specified plugin with given params into current parser instance.
   * It's just a sugar to call `plugin(md, params)` with curring.
   *
   * ##### Example
   *
   * ```javascript
   * var iterator = require('markdown-it-for-inline');
   * var md = require('markdown-it')()
   *             .use(iterator, 'foo_replace', 'text', function (tokens, idx) {
   *               tokens[idx].content = tokens[idx].content.replace(/foo/g, 'bar');
   *             });
   * ```
   **/


  MarkdownIt.prototype.use = function (plugin
  /*, params, ... */
  ) {
    var args = [this].concat(Array.prototype.slice.call(arguments, 1));
    plugin.apply(plugin, args);
    return this;
  };
  /** internal
   * MarkdownIt.parse(src, env) -> Array
   * - src (String): source string
   * - env (Object): environment sandbox
   *
   * Parse input string and returns list of block tokens (special token type
   * "inline" will contain list of inline tokens). You should not call this
   * method directly, until you write custom renderer (for example, to produce
   * AST).
   *
   * `env` is used to pass data between "distributed" rules and return additional
   * metadata like reference info, needed for the renderer. It also can be used to
   * inject data in specific cases. Usually, you will be ok to pass `{}`,
   * and then pass updated object to renderer.
   **/


  MarkdownIt.prototype.parse = function (src, env) {
    if (typeof src !== 'string') {
      throw new Error('Input data should be a String');
    }

    var state = new this.core.State(src, this, env);
    this.core.process(state);
    return state.tokens;
  };
  /**
   * MarkdownIt.render(src [, env]) -> String
   * - src (String): source string
   * - env (Object): environment sandbox
   *
   * Render markdown string into html. It does all magic for you :).
   *
   * `env` can be used to inject additional metadata (`{}` by default).
   * But you will not need it with high probability. See also comment
   * in [[MarkdownIt.parse]].
   **/


  MarkdownIt.prototype.render = function (src, env) {
    env = env || {};
    return this.renderer.render(this.parse(src, env), this.options, env);
  };
  /** internal
   * MarkdownIt.parseInline(src, env) -> Array
   * - src (String): source string
   * - env (Object): environment sandbox
   *
   * The same as [[MarkdownIt.parse]] but skip all block rules. It returns the
   * block tokens list with the single `inline` element, containing parsed inline
   * tokens in `children` property. Also updates `env` object.
   **/


  MarkdownIt.prototype.parseInline = function (src, env) {
    var state = new this.core.State(src, this, env);
    state.inlineMode = true;
    this.core.process(state);
    return state.tokens;
  };
  /**
   * MarkdownIt.renderInline(src [, env]) -> String
   * - src (String): source string
   * - env (Object): environment sandbox
   *
   * Similar to [[MarkdownIt.render]] but for single paragraph content. Result
   * will NOT be wrapped into `<p>` tags.
   **/


  MarkdownIt.prototype.renderInline = function (src, env) {
    env = env || {};
    return this.renderer.render(this.parseInline(src, env), this.options, env);
  };

  var lib = MarkdownIt;

  var markdownIt = lib;

  var schema = new Schema({
    nodes: {
      doc: {
        content: "block+"
      },
      paragraph: {
        content: "inline*",
        group: "block",
        parseDOM: [{
          tag: "p"
        }],
        toDOM: function toDOM() {
          return ["p", 0];
        }
      },
      blockquote: {
        content: "block+",
        group: "block",
        parseDOM: [{
          tag: "blockquote"
        }],
        toDOM: function toDOM() {
          return ["blockquote", 0];
        }
      },
      horizontal_rule: {
        group: "block",
        parseDOM: [{
          tag: "hr"
        }],
        toDOM: function toDOM() {
          return ["div", ["hr"]];
        }
      },
      heading: {
        attrs: {
          level: {
            default: 1
          }
        },
        content: "inline*",
        group: "block",
        defining: true,
        parseDOM: [{
          tag: "h1",
          attrs: {
            level: 1
          }
        }, {
          tag: "h2",
          attrs: {
            level: 2
          }
        }, {
          tag: "h3",
          attrs: {
            level: 3
          }
        }, {
          tag: "h4",
          attrs: {
            level: 4
          }
        }, {
          tag: "h5",
          attrs: {
            level: 5
          }
        }, {
          tag: "h6",
          attrs: {
            level: 6
          }
        }],
        toDOM: function toDOM(node) {
          return ["h" + node.attrs.level, 0];
        }
      },
      code_block: {
        content: "text*",
        group: "block",
        code: true,
        defining: true,
        marks: "",
        attrs: {
          params: {
            default: ""
          }
        },
        parseDOM: [{
          tag: "pre",
          preserveWhitespace: "full",
          getAttrs: function (node) {
            return {
              params: node.getAttribute("data-params") || ""
            };
          }
        }],
        toDOM: function toDOM(node) {
          return ["pre", node.attrs.params ? {
            "data-params": node.attrs.params
          } : {}, ["code", 0]];
        }
      },
      ordered_list: {
        content: "list_item+",
        group: "block",
        attrs: {
          order: {
            default: 1
          },
          tight: {
            default: false
          }
        },
        parseDOM: [{
          tag: "ol",
          getAttrs: function getAttrs(dom) {
            return {
              order: dom.hasAttribute("start") ? +dom.getAttribute("start") : 1,
              tight: dom.hasAttribute("data-tight")
            };
          }
        }],
        toDOM: function toDOM(node) {
          return ["ol", {
            start: node.attrs.order == 1 ? null : node.attrs.order,
            "data-tight": node.attrs.tight ? "true" : null
          }, 0];
        }
      },
      bullet_list: {
        content: "list_item+",
        group: "block",
        attrs: {
          tight: {
            default: false
          }
        },
        parseDOM: [{
          tag: "ul",
          getAttrs: function (dom) {
            return {
              tight: dom.hasAttribute("data-tight")
            };
          }
        }],
        toDOM: function toDOM(node) {
          return ["ul", {
            "data-tight": node.attrs.tight ? "true" : null
          }, 0];
        }
      },
      list_item: {
        content: "paragraph block*",
        defining: true,
        parseDOM: [{
          tag: "li"
        }],
        toDOM: function toDOM() {
          return ["li", 0];
        }
      },
      text: {
        group: "inline"
      },
      image: {
        inline: true,
        attrs: {
          src: {},
          alt: {
            default: null
          },
          title: {
            default: null
          }
        },
        group: "inline",
        draggable: true,
        parseDOM: [{
          tag: "img[src]",
          getAttrs: function getAttrs(dom) {
            return {
              src: dom.getAttribute("src"),
              title: dom.getAttribute("title"),
              alt: dom.getAttribute("alt")
            };
          }
        }],
        toDOM: function toDOM(node) {
          return ["img", node.attrs];
        }
      },
      hard_break: {
        inline: true,
        group: "inline",
        selectable: false,
        parseDOM: [{
          tag: "br"
        }],
        toDOM: function toDOM() {
          return ["br"];
        }
      }
    },
    marks: {
      em: {
        parseDOM: [{
          tag: "i"
        }, {
          tag: "em"
        }, {
          style: "font-style",
          getAttrs: function (value) {
            return value == "italic" && null;
          }
        }],
        toDOM: function toDOM() {
          return ["em"];
        }
      },
      strong: {
        parseDOM: [{
          tag: "b"
        }, {
          tag: "strong"
        }, {
          style: "font-weight",
          getAttrs: function (value) {
            return /^(bold(er)?|[5-9]\d{2,})$/.test(value) && null;
          }
        }],
        toDOM: function toDOM() {
          return ["strong"];
        }
      },
      link: {
        attrs: {
          href: {},
          title: {
            default: null
          }
        },
        inclusive: false,
        parseDOM: [{
          tag: "a[href]",
          getAttrs: function getAttrs(dom) {
            return {
              href: dom.getAttribute("href"),
              title: dom.getAttribute("title")
            };
          }
        }],
        toDOM: function toDOM(node) {
          return ["a", node.attrs];
        }
      },
      code: {
        parseDOM: [{
          tag: "code"
        }],
        toDOM: function toDOM() {
          return ["code"];
        }
      }
    }
  });

  function maybeMerge(a, b) {
    if (a.isText && b.isText && Mark.sameSet(a.marks, b.marks)) {
      return a.withText(a.text + b.text);
    }
  } // Object used to track the context of a running parse.


  var MarkdownParseState = function MarkdownParseState(schema, tokenHandlers) {
    this.schema = schema;
    this.stack = [{
      type: schema.topNodeType,
      content: []
    }];
    this.marks = Mark.none;
    this.tokenHandlers = tokenHandlers;
  };

  MarkdownParseState.prototype.top = function top() {
    return this.stack[this.stack.length - 1];
  };

  MarkdownParseState.prototype.push = function push(elt) {
    if (this.stack.length) {
      this.top().content.push(elt);
    }
  }; // : (string)
  // Adds the given text to the current position in the document,
  // using the current marks as styling.


  MarkdownParseState.prototype.addText = function addText(text) {
    if (!text) {
      return;
    }

    var nodes = this.top().content,
        last = nodes[nodes.length - 1];
    var node = this.schema.text(text, this.marks),
        merged;

    if (last && (merged = maybeMerge(last, node))) {
      nodes[nodes.length - 1] = merged;
    } else {
      nodes.push(node);
    }
  }; // : (Mark)
  // Adds the given mark to the set of active marks.


  MarkdownParseState.prototype.openMark = function openMark(mark) {
    this.marks = mark.addToSet(this.marks);
  }; // : (Mark)
  // Removes the given mark from the set of active marks.


  MarkdownParseState.prototype.closeMark = function closeMark(mark) {
    this.marks = mark.removeFromSet(this.marks);
  };

  MarkdownParseState.prototype.parseTokens = function parseTokens(toks) {
    for (var i = 0; i < toks.length; i++) {
      var tok = toks[i];
      var handler = this.tokenHandlers[tok.type];

      if (!handler) {
        throw new Error("Token type `" + tok.type + "` not supported by Markdown parser");
      }

      handler(this, tok);
    }
  }; // : (NodeType, ?Object, ?[Node]) → ?Node
  // Add a node at the current position.


  MarkdownParseState.prototype.addNode = function addNode(type, attrs, content) {
    var node = type.createAndFill(attrs, content, this.marks);

    if (!node) {
      return null;
    }

    this.push(node);
    return node;
  }; // : (NodeType, ?Object)
  // Wrap subsequent content in a node of the given type.


  MarkdownParseState.prototype.openNode = function openNode(type, attrs) {
    this.stack.push({
      type: type,
      attrs: attrs,
      content: []
    });
  }; // : () → ?Node
  // Close and return the node that is currently on top of the stack.


  MarkdownParseState.prototype.closeNode = function closeNode() {
    if (this.marks.length) {
      this.marks = Mark.none;
    }

    var info = this.stack.pop();
    return this.addNode(info.type, info.attrs, info.content);
  };

  function attrs(spec, token) {
    if (spec.getAttrs) {
      return spec.getAttrs(token);
    } // For backwards compatibility when `attrs` is a Function
    else if (spec.attrs instanceof Function) {
        return spec.attrs(token);
      } else {
        return spec.attrs;
      }
  } // Code content is represented as a single token with a `content`
  // property in Markdown-it.


  function noOpenClose(type) {
    return type == "code_inline" || type == "code_block" || type == "fence";
  }

  function withoutTrailingNewline(str) {
    return str[str.length - 1] == "\n" ? str.slice(0, str.length - 1) : str;
  }

  function noOp() {}

  function tokenHandlers(schema, tokens) {
    var handlers = Object.create(null);

    var loop = function (type) {
      var spec = tokens[type];

      if (spec.block) {
        var nodeType = schema.nodeType(spec.block);

        if (noOpenClose(type)) {
          handlers[type] = function (state, tok) {
            state.openNode(nodeType, attrs(spec, tok));
            state.addText(withoutTrailingNewline(tok.content));
            state.closeNode();
          };
        } else {
          handlers[type + "_open"] = function (state, tok) {
            return state.openNode(nodeType, attrs(spec, tok));
          };

          handlers[type + "_close"] = function (state) {
            return state.closeNode();
          };
        }
      } else if (spec.node) {
        var nodeType$1 = schema.nodeType(spec.node);

        handlers[type] = function (state, tok) {
          return state.addNode(nodeType$1, attrs(spec, tok));
        };
      } else if (spec.mark) {
        var markType = schema.marks[spec.mark];

        if (noOpenClose(type)) {
          handlers[type] = function (state, tok) {
            state.openMark(markType.create(attrs(spec, tok)));
            state.addText(withoutTrailingNewline(tok.content));
            state.closeMark(markType);
          };
        } else {
          handlers[type + "_open"] = function (state, tok) {
            return state.openMark(markType.create(attrs(spec, tok)));
          };

          handlers[type + "_close"] = function (state) {
            return state.closeMark(markType);
          };
        }
      } else if (spec.ignore) {
        if (noOpenClose(type)) {
          handlers[type] = noOp;
        } else {
          handlers[type + '_open'] = noOp;
          handlers[type + '_close'] = noOp;
        }
      } else {
        throw new RangeError("Unrecognized parsing spec " + JSON.stringify(spec));
      }
    };

    for (var type in tokens) loop(type);

    handlers.text = function (state, tok) {
      return state.addText(tok.content);
    };

    handlers.inline = function (state, tok) {
      return state.parseTokens(tok.children);
    };

    handlers.softbreak = handlers.softbreak || function (state) {
      return state.addText("\n");
    };

    return handlers;
  } // ::- A configuration of a Markdown parser. Such a parser uses
  // [markdown-it](https://github.com/markdown-it/markdown-it) to
  // tokenize a file, and then runs the custom rules it is given over
  // the tokens to create a ProseMirror document tree.


  var MarkdownParser = function MarkdownParser(schema, tokenizer, tokens) {
    // :: Object The value of the `tokens` object used to construct
    // this parser. Can be useful to copy and modify to base other
    // parsers on.
    this.tokens = tokens;
    this.schema = schema;
    this.tokenizer = tokenizer;
    this.tokenHandlers = tokenHandlers(schema, tokens);
  }; // :: (string) → Node
  // Parse a string as [CommonMark](http://commonmark.org/) markup,
  // and create a ProseMirror document as prescribed by this parser's
  // rules.


  MarkdownParser.prototype.parse = function parse(text) {
    var state = new MarkdownParseState(this.schema, this.tokenHandlers),
        doc;
    state.parseTokens(this.tokenizer.parse(text, {}));

    do {
      doc = state.closeNode();
    } while (state.stack.length);

    return doc;
  }; // :: MarkdownParser
  // A parser parsing unextended [CommonMark](http://commonmark.org/),
  // without inline HTML, and producing a document in the basic schema.


  var defaultMarkdownParser = new MarkdownParser(schema, markdownIt("commonmark", {
    html: false
  }), {
    blockquote: {
      block: "blockquote"
    },
    paragraph: {
      block: "paragraph"
    },
    list_item: {
      block: "list_item"
    },
    bullet_list: {
      block: "bullet_list"
    },
    ordered_list: {
      block: "ordered_list",
      getAttrs: function (tok) {
        return {
          order: +tok.attrGet("order") || 1
        };
      }
    },
    heading: {
      block: "heading",
      getAttrs: function (tok) {
        return {
          level: +tok.tag.slice(1)
        };
      }
    },
    code_block: {
      block: "code_block"
    },
    fence: {
      block: "code_block",
      getAttrs: function (tok) {
        return {
          params: tok.info || ""
        };
      }
    },
    hr: {
      node: "horizontal_rule"
    },
    image: {
      node: "image",
      getAttrs: function (tok) {
        return {
          src: tok.attrGet("src"),
          title: tok.attrGet("title") || null,
          alt: tok.children[0] && tok.children[0].content || null
        };
      }
    },
    hardbreak: {
      node: "hard_break"
    },
    em: {
      mark: "em"
    },
    strong: {
      mark: "strong"
    },
    link: {
      mark: "link",
      getAttrs: function (tok) {
        return {
          href: tok.attrGet("href"),
          title: tok.attrGet("title") || null
        };
      }
    },
    code_inline: {
      mark: "code"
    }
  }); // ::- A specification for serializing a ProseMirror document as
  // Markdown/CommonMark text.

  var MarkdownSerializer = function MarkdownSerializer(nodes, marks) {
    // :: Object<(MarkdownSerializerState, Node)> The node serializer
    // functions for this serializer.
    this.nodes = nodes; // :: Object The mark serializer info.

    this.marks = marks;
  }; // :: (Node, ?Object) → string
  // Serialize the content of the given node to
  // [CommonMark](http://commonmark.org/).


  MarkdownSerializer.prototype.serialize = function serialize(content, options) {
    var state = new MarkdownSerializerState(this.nodes, this.marks, options);
    state.renderContent(content);
    return state.out;
  }; // :: MarkdownSerializer
  // A serializer for the [basic schema](#schema).


  var defaultMarkdownSerializer = new MarkdownSerializer({
    blockquote: function blockquote(state, node) {
      state.wrapBlock("> ", null, node, function () {
        return state.renderContent(node);
      });
    },
    code_block: function code_block(state, node) {
      state.write("```" + (node.attrs.params || "") + "\n");
      state.text(node.textContent, false);
      state.ensureNewLine();
      state.write("```");
      state.closeBlock(node);
    },
    heading: function heading(state, node) {
      state.write(state.repeat("#", node.attrs.level) + " ");
      state.renderInline(node);
      state.closeBlock(node);
    },
    horizontal_rule: function horizontal_rule(state, node) {
      state.write(node.attrs.markup || "---");
      state.closeBlock(node);
    },
    bullet_list: function bullet_list(state, node) {
      state.renderList(node, "  ", function () {
        return (node.attrs.bullet || "*") + " ";
      });
    },
    ordered_list: function ordered_list(state, node) {
      var start = node.attrs.order || 1;
      var maxW = String(start + node.childCount - 1).length;
      var space = state.repeat(" ", maxW + 2);
      state.renderList(node, space, function (i) {
        var nStr = String(start + i);
        return state.repeat(" ", maxW - nStr.length) + nStr + ". ";
      });
    },
    list_item: function list_item(state, node) {
      state.renderContent(node);
    },
    paragraph: function paragraph(state, node) {
      state.renderInline(node);
      state.closeBlock(node);
    },
    image: function image(state, node) {
      state.write("![" + state.esc(node.attrs.alt || "") + "](" + state.esc(node.attrs.src) + (node.attrs.title ? " " + state.quote(node.attrs.title) : "") + ")");
    },
    hard_break: function hard_break(state, node, parent, index) {
      for (var i = index + 1; i < parent.childCount; i++) {
        if (parent.child(i).type != node.type) {
          state.write("\\\n");
          return;
        }
      }
    },
    text: function text(state, node) {
      state.text(node.text);
    }
  }, {
    em: {
      open: "*",
      close: "*",
      mixable: true,
      expelEnclosingWhitespace: true
    },
    strong: {
      open: "**",
      close: "**",
      mixable: true,
      expelEnclosingWhitespace: true
    },
    link: {
      open: function open(_state, mark, parent, index) {
        return isPlainURL(mark, parent, index, 1) ? "<" : "[";
      },
      close: function close(state, mark, parent, index) {
        return isPlainURL(mark, parent, index, -1) ? ">" : "](" + state.esc(mark.attrs.href) + (mark.attrs.title ? " " + state.quote(mark.attrs.title) : "") + ")";
      }
    },
    code: {
      open: function open(_state, _mark, parent, index) {
        return backticksFor(parent.child(index), -1);
      },
      close: function close(_state, _mark, parent, index) {
        return backticksFor(parent.child(index - 1), 1);
      },
      escape: false
    }
  });

  function backticksFor(node, side) {
    var ticks = /`+/g,
        m,
        len = 0;

    if (node.isText) {
      while (m = ticks.exec(node.text)) {
        len = Math.max(len, m[0].length);
      }
    }

    var result = len > 0 && side > 0 ? " `" : "`";

    for (var i = 0; i < len; i++) {
      result += "`";
    }

    if (len > 0 && side < 0) {
      result += " ";
    }

    return result;
  }

  function isPlainURL(link, parent, index, side) {
    if (link.attrs.title) {
      return false;
    }

    var content = parent.child(index + (side < 0 ? -1 : 0));

    if (!content.isText || content.text != link.attrs.href || content.marks[content.marks.length - 1] != link) {
      return false;
    }

    if (index == (side < 0 ? 1 : parent.childCount - 1)) {
      return true;
    }

    var next = parent.child(index + (side < 0 ? -2 : 1));
    return !link.isInSet(next.marks);
  } // ::- This is an object used to track state and expose
  // methods related to markdown serialization. Instances are passed to
  // node and mark serialization methods (see `toMarkdown`).


  var MarkdownSerializerState = function MarkdownSerializerState(nodes, marks, options) {
    this.nodes = nodes;
    this.marks = marks;
    this.delim = this.out = "";
    this.closed = false;
    this.inTightList = false; // :: Object
    // The options passed to the serializer.
    // tightLists:: ?bool
    // Whether to render lists in a tight style. This can be overridden
    // on a node level by specifying a tight attribute on the node.
    // Defaults to false.

    this.options = options || {};

    if (typeof this.options.tightLists == "undefined") {
      this.options.tightLists = false;
    }
  };

  MarkdownSerializerState.prototype.flushClose = function flushClose(size) {
    if (this.closed) {
      if (!this.atBlank()) {
        this.out += "\n";
      }

      if (size == null) {
        size = 2;
      }

      if (size > 1) {
        var delimMin = this.delim;
        var trim = /\s+$/.exec(delimMin);

        if (trim) {
          delimMin = delimMin.slice(0, delimMin.length - trim[0].length);
        }

        for (var i = 1; i < size; i++) {
          this.out += delimMin + "\n";
        }
      }

      this.closed = false;
    }
  }; // :: (string, ?string, Node, ())
  // Render a block, prefixing each line with `delim`, and the first
  // line in `firstDelim`. `node` should be the node that is closed at
  // the end of the block, and `f` is a function that renders the
  // content of the block.


  MarkdownSerializerState.prototype.wrapBlock = function wrapBlock(delim, firstDelim, node, f) {
    var old = this.delim;
    this.write(firstDelim || delim);
    this.delim += delim;
    f();
    this.delim = old;
    this.closeBlock(node);
  };

  MarkdownSerializerState.prototype.atBlank = function atBlank() {
    return /(^|\n)$/.test(this.out);
  }; // :: ()
  // Ensure the current content ends with a newline.


  MarkdownSerializerState.prototype.ensureNewLine = function ensureNewLine() {
    if (!this.atBlank()) {
      this.out += "\n";
    }
  }; // :: (?string)
  // Prepare the state for writing output (closing closed paragraphs,
  // adding delimiters, and so on), and then optionally add content
  // (unescaped) to the output.


  MarkdownSerializerState.prototype.write = function write(content) {
    this.flushClose();

    if (this.delim && this.atBlank()) {
      this.out += this.delim;
    }

    if (content) {
      this.out += content;
    }
  }; // :: (Node)
  // Close the block for the given node.


  MarkdownSerializerState.prototype.closeBlock = function closeBlock(node) {
    this.closed = node;
  }; // :: (string, ?bool)
  // Add the given text to the document. When escape is not `false`,
  // it will be escaped.


  MarkdownSerializerState.prototype.text = function text(text$1, escape) {
    var lines = text$1.split("\n");

    for (var i = 0; i < lines.length; i++) {
      var startOfLine = this.atBlank() || this.closed;
      this.write();
      this.out += escape !== false ? this.esc(lines[i], startOfLine) : lines[i];

      if (i != lines.length - 1) {
        this.out += "\n";
      }
    }
  }; // :: (Node)
  // Render the given node as a block.


  MarkdownSerializerState.prototype.render = function render(node, parent, index) {
    if (typeof parent == "number") {
      throw new Error("!");
    }

    this.nodes[node.type.name](this, node, parent, index);
  }; // :: (Node)
  // Render the contents of `parent` as block nodes.


  MarkdownSerializerState.prototype.renderContent = function renderContent(parent) {
    var this$1 = this;
    parent.forEach(function (node, _, i) {
      return this$1.render(node, parent, i);
    });
  }; // :: (Node)
  // Render the contents of `parent` as inline content.


  MarkdownSerializerState.prototype.renderInline = function renderInline(parent) {
    var this$1 = this;
    var active = [],
        trailing = "";

    var progress = function (node, _, index) {
      var marks = node ? node.marks : []; // Remove marks from `hard_break` that are the last node inside
      // that mark to prevent parser edge cases with new lines just
      // before closing marks.
      // (FIXME it'd be nice if we had a schema-agnostic way to
      // identify nodes that serialize as hard breaks)

      if (node && node.type.name === "hard_break") {
        marks = marks.filter(function (m) {
          if (index + 1 == parent.childCount) {
            return false;
          }

          var next = parent.child(index + 1);
          return m.isInSet(next.marks) && (!next.isText || /\S/.test(next.text));
        });
      }

      var leading = trailing;
      trailing = ""; // If whitespace has to be expelled from the node, adjust
      // leading and trailing accordingly.

      if (node && node.isText && marks.some(function (mark) {
        var info = this$1.marks[mark.type.name];
        return info && info.expelEnclosingWhitespace;
      })) {
        var ref = /^(\s*)(.*?)(\s*)$/m.exec(node.text);
        var _$1 = ref[0];
        var lead = ref[1];
        var inner$1 = ref[2];
        var trail = ref[3];
        leading += lead;
        trailing = trail;

        if (lead || trail) {
          node = inner$1 ? node.withText(inner$1) : null;

          if (!node) {
            marks = active;
          }
        }
      }

      var inner = marks.length && marks[marks.length - 1],
          noEsc = inner && this$1.marks[inner.type.name].escape === false;
      var len = marks.length - (noEsc ? 1 : 0); // Try to reorder 'mixable' marks, such as em and strong, which
      // in Markdown may be opened and closed in different order, so
      // that order of the marks for the token matches the order in
      // active.

      outer: for (var i = 0; i < len; i++) {
        var mark = marks[i];

        if (!this$1.marks[mark.type.name].mixable) {
          break;
        }

        for (var j = 0; j < active.length; j++) {
          var other = active[j];

          if (!this$1.marks[other.type.name].mixable) {
            break;
          }

          if (mark.eq(other)) {
            if (i > j) {
              marks = marks.slice(0, j).concat(mark).concat(marks.slice(j, i)).concat(marks.slice(i + 1, len));
            } else if (j > i) {
              marks = marks.slice(0, i).concat(marks.slice(i + 1, j)).concat(mark).concat(marks.slice(j, len));
            }

            continue outer;
          }
        }
      } // Find the prefix of the mark set that didn't change


      var keep = 0;

      while (keep < Math.min(active.length, len) && marks[keep].eq(active[keep])) {
        ++keep;
      } // Close the marks that need to be closed


      while (keep < active.length) {
        this$1.text(this$1.markString(active.pop(), false, parent, index), false);
      } // Output any previously expelled trailing whitespace outside the marks


      if (leading) {
        this$1.text(leading);
      } // Open the marks that need to be opened


      if (node) {
        while (active.length < len) {
          var add = marks[active.length];
          active.push(add);
          this$1.text(this$1.markString(add, true, parent, index), false);
        } // Render the node. Special case code marks, since their content
        // may not be escaped.


        if (noEsc && node.isText) {
          this$1.text(this$1.markString(inner, true, parent, index) + node.text + this$1.markString(inner, false, parent, index + 1), false);
        } else {
          this$1.render(node, parent, index);
        }
      }
    };

    parent.forEach(progress);
    progress(null, null, parent.childCount);
  }; // :: (Node, string, (number) → string)
  // Render a node's content as a list. `delim` should be the extra
  // indentation added to all lines except the first in an item,
  // `firstDelim` is a function going from an item index to a
  // delimiter for the first line of the item.


  MarkdownSerializerState.prototype.renderList = function renderList(node, delim, firstDelim) {
    var this$1 = this;

    if (this.closed && this.closed.type == node.type) {
      this.flushClose(3);
    } else if (this.inTightList) {
      this.flushClose(1);
    }

    var isTight = typeof node.attrs.tight != "undefined" ? node.attrs.tight : this.options.tightLists;
    var prevTight = this.inTightList;
    this.inTightList = isTight;
    node.forEach(function (child, _, i) {
      if (i && isTight) {
        this$1.flushClose(1);
      }

      this$1.wrapBlock(delim, firstDelim(i), node, function () {
        return this$1.render(child, node, i);
      });
    });
    this.inTightList = prevTight;
  }; // :: (string, ?bool) → string
  // Escape the given string so that it can safely appear in Markdown
  // content. If `startOfLine` is true, also escape characters that
  // has special meaning only at the start of the line.


  MarkdownSerializerState.prototype.esc = function esc(str, startOfLine) {
    str = str.replace(/[`*\\~\[\]]/g, "\\$&");

    if (startOfLine) {
      str = str.replace(/^[:#\-*+]/, "\\$&").replace(/^(\d+)\./, "$1\\.");
    }

    return str;
  };

  MarkdownSerializerState.prototype.quote = function quote(str) {
    var wrap = str.indexOf('"') == -1 ? '""' : str.indexOf("'") == -1 ? "''" : "()";
    return wrap[0] + str + wrap[1];
  }; // :: (string, number) → string
  // Repeat the given string `n` times.


  MarkdownSerializerState.prototype.repeat = function repeat(str, n) {
    var out = "";

    for (var i = 0; i < n; i++) {
      out += str;
    }

    return out;
  }; // : (Mark, bool, string?) → string
  // Get the markdown string for a given opening or closing mark.


  MarkdownSerializerState.prototype.markString = function markString(mark, open, parent, index) {
    var info = this.marks[mark.type.name];
    var value = open ? info.open : info.close;
    return typeof value == "string" ? value : value(this, mark, parent, index);
  }; // :: (string) → { leading: ?string, trailing: ?string }
  // Get leading and trailing whitespace from a string. Values of
  // leading or trailing property of the return object will be undefined
  // if there is no match.


  MarkdownSerializerState.prototype.getEnclosingWhitespace = function getEnclosingWhitespace(text) {
    return {
      leading: (text.match(/^(\s+)/) || [])[0],
      trailing: (text.match(/(\s+)$/) || [])[0]
    };
  };

  var base$1 = {
    8: "Backspace",
    9: "Tab",
    10: "Enter",
    12: "NumLock",
    13: "Enter",
    16: "Shift",
    17: "Control",
    18: "Alt",
    20: "CapsLock",
    27: "Escape",
    32: " ",
    33: "PageUp",
    34: "PageDown",
    35: "End",
    36: "Home",
    37: "ArrowLeft",
    38: "ArrowUp",
    39: "ArrowRight",
    40: "ArrowDown",
    44: "PrintScreen",
    45: "Insert",
    46: "Delete",
    59: ";",
    61: "=",
    91: "Meta",
    92: "Meta",
    106: "*",
    107: "+",
    108: ",",
    109: "-",
    110: ".",
    111: "/",
    144: "NumLock",
    145: "ScrollLock",
    160: "Shift",
    161: "Shift",
    162: "Control",
    163: "Control",
    164: "Alt",
    165: "Alt",
    173: "-",
    186: ";",
    187: "=",
    188: ",",
    189: "-",
    190: ".",
    191: "/",
    192: "`",
    219: "[",
    220: "\\",
    221: "]",
    222: "'",
    229: "q"
  };
  var base_1 = base$1;
  var shift = {
    48: ")",
    49: "!",
    50: "@",
    51: "#",
    52: "$",
    53: "%",
    54: "^",
    55: "&",
    56: "*",
    57: "(",
    59: ";",
    61: "+",
    173: "_",
    186: ":",
    187: "+",
    188: "<",
    189: "_",
    190: ">",
    191: "?",
    192: "~",
    219: "{",
    220: "|",
    221: "}",
    222: "\"",
    229: "Q"
  };
  var chrome$1 = typeof navigator != "undefined" && /Chrome\/(\d+)/.exec(navigator.userAgent);
  var safari = typeof navigator != "undefined" && /Apple Computer/.test(navigator.vendor);
  var gecko = typeof navigator != "undefined" && /Gecko\/\d+/.test(navigator.userAgent);
  var mac = typeof navigator != "undefined" && /Mac/.test(navigator.platform);
  var ie$1 = typeof navigator != "undefined" && /MSIE \d|Trident\/(?:[7-9]|\d{2,})\..*rv:(\d+)/.exec(navigator.userAgent);
  var brokenModifierNames = chrome$1 && +chrome$1[1] < 57 || gecko && mac; // Fill in the digit keys

  for (var i$1 = 0; i$1 < 10; i$1++) base$1[48 + i$1] = base$1[96 + i$1] = String(i$1); // The function keys


  for (var i$1 = 1; i$1 <= 24; i$1++) base$1[i$1 + 111] = "F" + i$1; // And the alphabetic keys


  for (var i$1 = 65; i$1 <= 90; i$1++) {
    base$1[i$1] = String.fromCharCode(i$1 + 32);
    shift[i$1] = String.fromCharCode(i$1);
  } // For each code that doesn't have a shift-equivalent, copy the base name


  for (var code$1 in base$1) if (!shift.hasOwnProperty(code$1)) shift[code$1] = base$1[code$1];

  var keyName = function (event) {
    // Don't trust event.key in Chrome when there are modifiers until
    // they fix https://bugs.chromium.org/p/chromium/issues/detail?id=633838
    var ignoreKey = brokenModifierNames && (event.ctrlKey || event.altKey || event.metaKey) || (safari || ie$1) && event.shiftKey && event.key && event.key.length == 1;
    var name = !ignoreKey && event.key || (event.shiftKey ? shift : base$1)[event.keyCode] || event.key || "Unidentified"; // Edge sometimes produces wrong names (Issue #3)

    if (name == "Esc") name = "Escape";
    if (name == "Del") name = "Delete"; // https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/8860571/

    if (name == "Left") name = "ArrowLeft";
    if (name == "Up") name = "ArrowUp";
    if (name == "Right") name = "ArrowRight";
    if (name == "Down") name = "ArrowDown";
    return name;
  };

  var mac$1 = typeof navigator != "undefined" ? /Mac/.test(navigator.platform) : false;

  function normalizeKeyName(name) {
    var parts = name.split(/-(?!$)/),
        result = parts[parts.length - 1];

    if (result == "Space") {
      result = " ";
    }

    var alt, ctrl, shift, meta;

    for (var i = 0; i < parts.length - 1; i++) {
      var mod = parts[i];

      if (/^(cmd|meta|m)$/i.test(mod)) {
        meta = true;
      } else if (/^a(lt)?$/i.test(mod)) {
        alt = true;
      } else if (/^(c|ctrl|control)$/i.test(mod)) {
        ctrl = true;
      } else if (/^s(hift)?$/i.test(mod)) {
        shift = true;
      } else if (/^mod$/i.test(mod)) {
        if (mac$1) {
          meta = true;
        } else {
          ctrl = true;
        }
      } else {
        throw new Error("Unrecognized modifier name: " + mod);
      }
    }

    if (alt) {
      result = "Alt-" + result;
    }

    if (ctrl) {
      result = "Ctrl-" + result;
    }

    if (meta) {
      result = "Meta-" + result;
    }

    if (shift) {
      result = "Shift-" + result;
    }

    return result;
  }

  function normalize$1(map) {
    var copy = Object.create(null);

    for (var prop in map) {
      copy[normalizeKeyName(prop)] = map[prop];
    }

    return copy;
  }

  function modifiers(name, event, shift) {
    if (event.altKey) {
      name = "Alt-" + name;
    }

    if (event.ctrlKey) {
      name = "Ctrl-" + name;
    }

    if (event.metaKey) {
      name = "Meta-" + name;
    }

    if (shift !== false && event.shiftKey) {
      name = "Shift-" + name;
    }

    return name;
  } // :: (Object) → Plugin
  // Create a keymap plugin for the given set of bindings.
  //
  // Bindings should map key names to [command](#commands)-style
  // functions, which will be called with `(EditorState, dispatch,
  // EditorView)` arguments, and should return true when they've handled
  // the key. Note that the view argument isn't part of the command
  // protocol, but can be used as an escape hatch if a binding needs to
  // directly interact with the UI.
  //
  // Key names may be strings like `"Shift-Ctrl-Enter"`—a key
  // identifier prefixed with zero or more modifiers. Key identifiers
  // are based on the strings that can appear in
  // [`KeyEvent.key`](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key).
  // Use lowercase letters to refer to letter keys (or uppercase letters
  // if you want shift to be held). You may use `"Space"` as an alias
  // for the `" "` name.
  //
  // Modifiers can be given in any order. `Shift-` (or `s-`), `Alt-` (or
  // `a-`), `Ctrl-` (or `c-` or `Control-`) and `Cmd-` (or `m-` or
  // `Meta-`) are recognized. For characters that are created by holding
  // shift, the `Shift-` prefix is implied, and should not be added
  // explicitly.
  //
  // You can use `Mod-` as a shorthand for `Cmd-` on Mac and `Ctrl-` on
  // other platforms.
  //
  // You can add multiple keymap plugins to an editor. The order in
  // which they appear determines their precedence (the ones early in
  // the array get to dispatch first).


  function keymap(bindings) {
    return new Plugin({
      props: {
        handleKeyDown: keydownHandler(bindings)
      }
    });
  } // :: (Object) → (view: EditorView, event: dom.Event) → bool
  // Given a set of bindings (using the same format as
  // [`keymap`](#keymap.keymap), return a [keydown
  // handler](#view.EditorProps.handleKeyDown) that handles them.


  function keydownHandler(bindings) {
    var map = normalize$1(bindings);
    return function (view, event) {
      var name = keyName(event),
          isChar = name.length == 1 && name != " ",
          baseName;
      var direct = map[modifiers(name, event, !isChar)];

      if (direct && direct(view.state, view.dispatch, view)) {
        return true;
      }

      if (isChar && (event.shiftKey || event.altKey || event.metaKey) && (baseName = base_1[event.keyCode]) && baseName != name) {
        var fromCode = map[modifiers(baseName, event, true)];

        if (fromCode && fromCode(view.state, view.dispatch, view)) {
          return true;
        }
      } else if (isChar && event.shiftKey) {
        var withShift = map[modifiers(name, event, true)];

        if (withShift && withShift(view.state, view.dispatch, view)) {
          return true;
        }
      }

      return false;
    };
  }

  var GOOD_LEAF_SIZE = 200; // :: class<T> A rope sequence is a persistent sequence data structure
  // that supports appending, prepending, and slicing without doing a
  // full copy. It is represented as a mostly-balanced tree.

  var RopeSequence = function RopeSequence() {};

  RopeSequence.prototype.append = function append(other) {
    if (!other.length) {
      return this;
    }

    other = RopeSequence.from(other);
    return !this.length && other || other.length < GOOD_LEAF_SIZE && this.leafAppend(other) || this.length < GOOD_LEAF_SIZE && other.leafPrepend(this) || this.appendInner(other);
  }; // :: (union<[T], RopeSequence<T>>) → RopeSequence<T>
  // Prepend an array or other rope to this one, returning a new rope.


  RopeSequence.prototype.prepend = function prepend(other) {
    if (!other.length) {
      return this;
    }

    return RopeSequence.from(other).append(this);
  };

  RopeSequence.prototype.appendInner = function appendInner(other) {
    return new Append(this, other);
  }; // :: (?number, ?number) → RopeSequence<T>
  // Create a rope repesenting a sub-sequence of this rope.


  RopeSequence.prototype.slice = function slice(from, to) {
    if (from === void 0) from = 0;
    if (to === void 0) to = this.length;

    if (from >= to) {
      return RopeSequence.empty;
    }

    return this.sliceInner(Math.max(0, from), Math.min(this.length, to));
  }; // :: (number) → T
  // Retrieve the element at the given position from this rope.


  RopeSequence.prototype.get = function get(i) {
    if (i < 0 || i >= this.length) {
      return undefined;
    }

    return this.getInner(i);
  }; // :: ((element: T, index: number) → ?bool, ?number, ?number)
  // Call the given function for each element between the given
  // indices. This tends to be more efficient than looping over the
  // indices and calling `get`, because it doesn't have to descend the
  // tree for every element.


  RopeSequence.prototype.forEach = function forEach(f, from, to) {
    if (from === void 0) from = 0;
    if (to === void 0) to = this.length;

    if (from <= to) {
      this.forEachInner(f, from, to, 0);
    } else {
      this.forEachInvertedInner(f, from, to, 0);
    }
  }; // :: ((element: T, index: number) → U, ?number, ?number) → [U]
  // Map the given functions over the elements of the rope, producing
  // a flat array.


  RopeSequence.prototype.map = function map(f, from, to) {
    if (from === void 0) from = 0;
    if (to === void 0) to = this.length;
    var result = [];
    this.forEach(function (elt, i) {
      return result.push(f(elt, i));
    }, from, to);
    return result;
  }; // :: (?union<[T], RopeSequence<T>>) → RopeSequence<T>
  // Create a rope representing the given array, or return the rope
  // itself if a rope was given.


  RopeSequence.from = function from(values) {
    if (values instanceof RopeSequence) {
      return values;
    }

    return values && values.length ? new Leaf(values) : RopeSequence.empty;
  };

  var Leaf =
  /*@__PURE__*/
  function (RopeSequence) {
    function Leaf(values) {
      RopeSequence.call(this);
      this.values = values;
    }

    if (RopeSequence) Leaf.__proto__ = RopeSequence;
    Leaf.prototype = Object.create(RopeSequence && RopeSequence.prototype);
    Leaf.prototype.constructor = Leaf;
    var prototypeAccessors = {
      length: {
        configurable: true
      },
      depth: {
        configurable: true
      }
    };

    Leaf.prototype.flatten = function flatten() {
      return this.values;
    };

    Leaf.prototype.sliceInner = function sliceInner(from, to) {
      if (from == 0 && to == this.length) {
        return this;
      }

      return new Leaf(this.values.slice(from, to));
    };

    Leaf.prototype.getInner = function getInner(i) {
      return this.values[i];
    };

    Leaf.prototype.forEachInner = function forEachInner(f, from, to, start) {
      for (var i = from; i < to; i++) {
        if (f(this.values[i], start + i) === false) {
          return false;
        }
      }
    };

    Leaf.prototype.forEachInvertedInner = function forEachInvertedInner(f, from, to, start) {
      for (var i = from - 1; i >= to; i--) {
        if (f(this.values[i], start + i) === false) {
          return false;
        }
      }
    };

    Leaf.prototype.leafAppend = function leafAppend(other) {
      if (this.length + other.length <= GOOD_LEAF_SIZE) {
        return new Leaf(this.values.concat(other.flatten()));
      }
    };

    Leaf.prototype.leafPrepend = function leafPrepend(other) {
      if (this.length + other.length <= GOOD_LEAF_SIZE) {
        return new Leaf(other.flatten().concat(this.values));
      }
    };

    prototypeAccessors.length.get = function () {
      return this.values.length;
    };

    prototypeAccessors.depth.get = function () {
      return 0;
    };

    Object.defineProperties(Leaf.prototype, prototypeAccessors);
    return Leaf;
  }(RopeSequence); // :: RopeSequence
  // The empty rope sequence.


  RopeSequence.empty = new Leaf([]);

  var Append =
  /*@__PURE__*/
  function (RopeSequence) {
    function Append(left, right) {
      RopeSequence.call(this);
      this.left = left;
      this.right = right;
      this.length = left.length + right.length;
      this.depth = Math.max(left.depth, right.depth) + 1;
    }

    if (RopeSequence) Append.__proto__ = RopeSequence;
    Append.prototype = Object.create(RopeSequence && RopeSequence.prototype);
    Append.prototype.constructor = Append;

    Append.prototype.flatten = function flatten() {
      return this.left.flatten().concat(this.right.flatten());
    };

    Append.prototype.getInner = function getInner(i) {
      return i < this.left.length ? this.left.get(i) : this.right.get(i - this.left.length);
    };

    Append.prototype.forEachInner = function forEachInner(f, from, to, start) {
      var leftLen = this.left.length;

      if (from < leftLen && this.left.forEachInner(f, from, Math.min(to, leftLen), start) === false) {
        return false;
      }

      if (to > leftLen && this.right.forEachInner(f, Math.max(from - leftLen, 0), Math.min(this.length, to) - leftLen, start + leftLen) === false) {
        return false;
      }
    };

    Append.prototype.forEachInvertedInner = function forEachInvertedInner(f, from, to, start) {
      var leftLen = this.left.length;

      if (from > leftLen && this.right.forEachInvertedInner(f, from - leftLen, Math.max(to, leftLen) - leftLen, start + leftLen) === false) {
        return false;
      }

      if (to < leftLen && this.left.forEachInvertedInner(f, Math.min(from, leftLen), to, start) === false) {
        return false;
      }
    };

    Append.prototype.sliceInner = function sliceInner(from, to) {
      if (from == 0 && to == this.length) {
        return this;
      }

      var leftLen = this.left.length;

      if (to <= leftLen) {
        return this.left.slice(from, to);
      }

      if (from >= leftLen) {
        return this.right.slice(from - leftLen, to - leftLen);
      }

      return this.left.slice(from, leftLen).append(this.right.slice(0, to - leftLen));
    };

    Append.prototype.leafAppend = function leafAppend(other) {
      var inner = this.right.leafAppend(other);

      if (inner) {
        return new Append(this.left, inner);
      }
    };

    Append.prototype.leafPrepend = function leafPrepend(other) {
      var inner = this.left.leafPrepend(other);

      if (inner) {
        return new Append(inner, this.right);
      }
    };

    Append.prototype.appendInner = function appendInner(other) {
      if (this.left.depth >= Math.max(this.right.depth, other.depth) + 1) {
        return new Append(this.left, new Append(this.right, other));
      }

      return new Append(this, other);
    };

    return Append;
  }(RopeSequence);

  var ropeSequence = RopeSequence;

  // state, because ProseMirror supports applying changes without adding
  // them to the history (for example during collaboration).
  //
  // To this end, each 'Branch' (one for the undo history and one for
  // the redo history) keeps an array of 'Items', which can optionally
  // hold a step (an actual undoable change), and always hold a position
  // map (which is needed to move changes below them to apply to the
  // current document).
  //
  // An item that has both a step and a selection bookmark is the start
  // of an 'event' — a group of changes that will be undone or redone at
  // once. (It stores only the bookmark, since that way we don't have to
  // provide a document until the selection is actually applied, which
  // is useful when compressing.)
  // Used to schedule history compression

  var max_empty_items = 500;

  var Branch = function Branch(items, eventCount) {
    this.items = items;
    this.eventCount = eventCount;
  }; // : (EditorState, bool) → ?{transform: Transform, selection: ?SelectionBookmark, remaining: Branch}
  // Pop the latest event off the branch's history and apply it
  // to a document transform.


  Branch.prototype.popEvent = function popEvent(state, preserveItems) {
    var this$1 = this;

    if (this.eventCount == 0) {
      return null;
    }

    var end = this.items.length;

    for (;; end--) {
      var next = this.items.get(end - 1);

      if (next.selection) {
        --end;
        break;
      }
    }

    var remap, mapFrom;

    if (preserveItems) {
      remap = this.remapping(end, this.items.length);
      mapFrom = remap.maps.length;
    }

    var transform = state.tr;
    var selection, remaining;
    var addAfter = [],
        addBefore = [];
    this.items.forEach(function (item, i) {
      if (!item.step) {
        if (!remap) {
          remap = this$1.remapping(end, i + 1);
          mapFrom = remap.maps.length;
        }

        mapFrom--;
        addBefore.push(item);
        return;
      }

      if (remap) {
        addBefore.push(new Item(item.map));
        var step = item.step.map(remap.slice(mapFrom)),
            map;

        if (step && transform.maybeStep(step).doc) {
          map = transform.mapping.maps[transform.mapping.maps.length - 1];
          addAfter.push(new Item(map, null, null, addAfter.length + addBefore.length));
        }

        mapFrom--;

        if (map) {
          remap.appendMap(map, mapFrom);
        }
      } else {
        transform.maybeStep(item.step);
      }

      if (item.selection) {
        selection = remap ? item.selection.map(remap.slice(mapFrom)) : item.selection;
        remaining = new Branch(this$1.items.slice(0, end).append(addBefore.reverse().concat(addAfter)), this$1.eventCount - 1);
        return false;
      }
    }, this.items.length, 0);
    return {
      remaining: remaining,
      transform: transform,
      selection: selection
    };
  }; // : (Transform, ?SelectionBookmark, Object) → Branch
  // Create a new branch with the given transform added.


  Branch.prototype.addTransform = function addTransform(transform, selection, histOptions, preserveItems) {
    var newItems = [],
        eventCount = this.eventCount;
    var oldItems = this.items,
        lastItem = !preserveItems && oldItems.length ? oldItems.get(oldItems.length - 1) : null;

    for (var i = 0; i < transform.steps.length; i++) {
      var step = transform.steps[i].invert(transform.docs[i]);
      var item = new Item(transform.mapping.maps[i], step, selection),
          merged = void 0;

      if (merged = lastItem && lastItem.merge(item)) {
        item = merged;

        if (i) {
          newItems.pop();
        } else {
          oldItems = oldItems.slice(0, oldItems.length - 1);
        }
      }

      newItems.push(item);

      if (selection) {
        eventCount++;
        selection = null;
      }

      if (!preserveItems) {
        lastItem = item;
      }
    }

    var overflow = eventCount - histOptions.depth;

    if (overflow > DEPTH_OVERFLOW) {
      oldItems = cutOffEvents(oldItems, overflow);
      eventCount -= overflow;
    }

    return new Branch(oldItems.append(newItems), eventCount);
  };

  Branch.prototype.remapping = function remapping(from, to) {
    var maps = new Mapping();
    this.items.forEach(function (item, i) {
      var mirrorPos = item.mirrorOffset != null && i - item.mirrorOffset >= from ? maps.maps.length - item.mirrorOffset : null;
      maps.appendMap(item.map, mirrorPos);
    }, from, to);
    return maps;
  };

  Branch.prototype.addMaps = function addMaps(array) {
    if (this.eventCount == 0) {
      return this;
    }

    return new Branch(this.items.append(array.map(function (map) {
      return new Item(map);
    })), this.eventCount);
  }; // : (Transform, number)
  // When the collab module receives remote changes, the history has
  // to know about those, so that it can adjust the steps that were
  // rebased on top of the remote changes, and include the position
  // maps for the remote changes in its array of items.


  Branch.prototype.rebased = function rebased(rebasedTransform, rebasedCount) {
    if (!this.eventCount) {
      return this;
    }

    var rebasedItems = [],
        start = Math.max(0, this.items.length - rebasedCount);
    var mapping = rebasedTransform.mapping;
    var newUntil = rebasedTransform.steps.length;
    var eventCount = this.eventCount;
    this.items.forEach(function (item) {
      if (item.selection) {
        eventCount--;
      }
    }, start);
    var iRebased = rebasedCount;
    this.items.forEach(function (item) {
      var pos = mapping.getMirror(--iRebased);

      if (pos == null) {
        return;
      }

      newUntil = Math.min(newUntil, pos);
      var map = mapping.maps[pos];

      if (item.step) {
        var step = rebasedTransform.steps[pos].invert(rebasedTransform.docs[pos]);
        var selection = item.selection && item.selection.map(mapping.slice(iRebased + 1, pos));

        if (selection) {
          eventCount++;
        }

        rebasedItems.push(new Item(map, step, selection));
      } else {
        rebasedItems.push(new Item(map));
      }
    }, start);
    var newMaps = [];

    for (var i = rebasedCount; i < newUntil; i++) {
      newMaps.push(new Item(mapping.maps[i]));
    }

    var items = this.items.slice(0, start).append(newMaps).append(rebasedItems);
    var branch = new Branch(items, eventCount);

    if (branch.emptyItemCount() > max_empty_items) {
      branch = branch.compress(this.items.length - rebasedItems.length);
    }

    return branch;
  };

  Branch.prototype.emptyItemCount = function emptyItemCount() {
    var count = 0;
    this.items.forEach(function (item) {
      if (!item.step) {
        count++;
      }
    });
    return count;
  }; // Compressing a branch means rewriting it to push the air (map-only
  // items) out. During collaboration, these naturally accumulate
  // because each remote change adds one. The `upto` argument is used
  // to ensure that only the items below a given level are compressed,
  // because `rebased` relies on a clean, untouched set of items in
  // order to associate old items with rebased steps.


  Branch.prototype.compress = function compress(upto) {
    if (upto === void 0) upto = this.items.length;
    var remap = this.remapping(0, upto),
        mapFrom = remap.maps.length;
    var items = [],
        events = 0;
    this.items.forEach(function (item, i) {
      if (i >= upto) {
        items.push(item);

        if (item.selection) {
          events++;
        }
      } else if (item.step) {
        var step = item.step.map(remap.slice(mapFrom)),
            map = step && step.getMap();
        mapFrom--;

        if (map) {
          remap.appendMap(map, mapFrom);
        }

        if (step) {
          var selection = item.selection && item.selection.map(remap.slice(mapFrom));

          if (selection) {
            events++;
          }

          var newItem = new Item(map.invert(), step, selection),
              merged,
              last = items.length - 1;

          if (merged = items.length && items[last].merge(newItem)) {
            items[last] = merged;
          } else {
            items.push(newItem);
          }
        }
      } else if (item.map) {
        mapFrom--;
      }
    }, this.items.length, 0);
    return new Branch(ropeSequence.from(items.reverse()), events);
  };

  Branch.empty = new Branch(ropeSequence.empty, 0);

  function cutOffEvents(items, n) {
    var cutPoint;
    items.forEach(function (item, i) {
      if (item.selection && n-- == 0) {
        cutPoint = i;
        return false;
      }
    });
    return items.slice(cutPoint);
  }

  var Item = function Item(map, step, selection, mirrorOffset) {
    // The (forward) step map for this item.
    this.map = map; // The inverted step

    this.step = step; // If this is non-null, this item is the start of a group, and
    // this selection is the starting selection for the group (the one
    // that was active before the first step was applied)

    this.selection = selection; // If this item is the inverse of a previous mapping on the stack,
    // this points at the inverse's offset

    this.mirrorOffset = mirrorOffset;
  };

  Item.prototype.merge = function merge(other) {
    if (this.step && other.step && !other.selection) {
      var step = other.step.merge(this.step);

      if (step) {
        return new Item(step.getMap().invert(), step, this.selection);
      }
    }
  }; // The value of the state field that tracks undo/redo history for that
  // state. Will be stored in the plugin state when the history plugin
  // is active.


  var HistoryState = function HistoryState(done, undone, prevRanges, prevTime) {
    this.done = done;
    this.undone = undone;
    this.prevRanges = prevRanges;
    this.prevTime = prevTime;
  };

  var DEPTH_OVERFLOW = 20; // : (HistoryState, EditorState, Transaction, Object)
  // Record a transformation in undo history.

  function applyTransaction(history, state, tr, options) {
    var historyTr = tr.getMeta(historyKey),
        rebased;

    if (historyTr) {
      return historyTr.historyState;
    }

    if (tr.getMeta(closeHistoryKey)) {
      history = new HistoryState(history.done, history.undone, null, 0);
    }

    var appended = tr.getMeta("appendedTransaction");

    if (tr.steps.length == 0) {
      return history;
    } else if (appended && appended.getMeta(historyKey)) {
      if (appended.getMeta(historyKey).redo) {
        return new HistoryState(history.done.addTransform(tr, null, options, mustPreserveItems(state)), history.undone, rangesFor(tr.mapping.maps[tr.steps.length - 1]), history.prevTime);
      } else {
        return new HistoryState(history.done, history.undone.addTransform(tr, null, options, mustPreserveItems(state)), null, history.prevTime);
      }
    } else if (tr.getMeta("addToHistory") !== false && !(appended && appended.getMeta("addToHistory") === false)) {
      // Group transforms that occur in quick succession into one event.
      var newGroup = history.prevTime == 0 || !appended && (history.prevTime < (tr.time || 0) - options.newGroupDelay || !isAdjacentTo(tr, history.prevRanges));
      var prevRanges = appended ? mapRanges(history.prevRanges, tr.mapping) : rangesFor(tr.mapping.maps[tr.steps.length - 1]);
      return new HistoryState(history.done.addTransform(tr, newGroup ? state.selection.getBookmark() : null, options, mustPreserveItems(state)), Branch.empty, prevRanges, tr.time);
    } else if (rebased = tr.getMeta("rebased")) {
      // Used by the collab module to tell the history that some of its
      // content has been rebased.
      return new HistoryState(history.done.rebased(tr, rebased), history.undone.rebased(tr, rebased), mapRanges(history.prevRanges, tr.mapping), history.prevTime);
    } else {
      return new HistoryState(history.done.addMaps(tr.mapping.maps), history.undone.addMaps(tr.mapping.maps), mapRanges(history.prevRanges, tr.mapping), history.prevTime);
    }
  }

  function isAdjacentTo(transform, prevRanges) {
    if (!prevRanges) {
      return false;
    }

    if (!transform.docChanged) {
      return true;
    }

    var adjacent = false;
    transform.mapping.maps[0].forEach(function (start, end) {
      for (var i = 0; i < prevRanges.length; i += 2) {
        if (start <= prevRanges[i + 1] && end >= prevRanges[i]) {
          adjacent = true;
        }
      }
    });
    return adjacent;
  }

  function rangesFor(map) {
    var result = [];
    map.forEach(function (_from, _to, from, to) {
      return result.push(from, to);
    });
    return result;
  }

  function mapRanges(ranges, mapping) {
    if (!ranges) {
      return null;
    }

    var result = [];

    for (var i = 0; i < ranges.length; i += 2) {
      var from = mapping.map(ranges[i], 1),
          to = mapping.map(ranges[i + 1], -1);

      if (from <= to) {
        result.push(from, to);
      }
    }

    return result;
  } // : (HistoryState, EditorState, (tr: Transaction), bool)
  // Apply the latest event from one branch to the document and shift the event
  // onto the other branch.


  function histTransaction(history, state, dispatch, redo) {
    var preserveItems = mustPreserveItems(state),
        histOptions = historyKey.get(state).spec.config;
    var pop = (redo ? history.undone : history.done).popEvent(state, preserveItems);

    if (!pop) {
      return;
    }

    var selection = pop.selection.resolve(pop.transform.doc);
    var added = (redo ? history.done : history.undone).addTransform(pop.transform, state.selection.getBookmark(), histOptions, preserveItems);
    var newHist = new HistoryState(redo ? added : pop.remaining, redo ? pop.remaining : added, null, 0);
    dispatch(pop.transform.setSelection(selection).setMeta(historyKey, {
      redo: redo,
      historyState: newHist
    }).scrollIntoView());
  }

  var cachedPreserveItems = false,
      cachedPreserveItemsPlugins = null; // Check whether any plugin in the given state has a
  // `historyPreserveItems` property in its spec, in which case we must
  // preserve steps exactly as they came in, so that they can be
  // rebased.

  function mustPreserveItems(state) {
    var plugins = state.plugins;

    if (cachedPreserveItemsPlugins != plugins) {
      cachedPreserveItems = false;
      cachedPreserveItemsPlugins = plugins;

      for (var i = 0; i < plugins.length; i++) {
        if (plugins[i].spec.historyPreserveItems) {
          cachedPreserveItems = true;
          break;
        }
      }
    }

    return cachedPreserveItems;
  } // :: (Transaction) → Transaction

  var historyKey = new PluginKey("history");
  var closeHistoryKey = new PluginKey("closeHistory"); // :: (?Object) → Plugin
  // Returns a plugin that enables the undo history for an editor. The
  // plugin will track undo and redo stacks, which can be used with the
  // [`undo`](#history.undo) and [`redo`](#history.redo) commands.
  //
  // You can set an `"addToHistory"` [metadata
  // property](#state.Transaction.setMeta) of `false` on a transaction
  // to prevent it from being rolled back by undo.
  //
  //   config::-
  //   Supports the following configuration options:
  //
  //     depth:: ?number
  //     The amount of history events that are collected before the
  //     oldest events are discarded. Defaults to 100.
  //
  //     newGroupDelay:: ?number
  //     The delay between changes after which a new group should be
  //     started. Defaults to 500 (milliseconds). Note that when changes
  //     aren't adjacent, a new group is always started.

  function history(config) {
    config = {
      depth: config && config.depth || 100,
      newGroupDelay: config && config.newGroupDelay || 500
    };
    return new Plugin({
      key: historyKey,
      state: {
        init: function init() {
          return new HistoryState(Branch.empty, Branch.empty, null, 0);
        },
        apply: function apply(tr, hist, state) {
          return applyTransaction(hist, state, tr, config);
        }
      },
      config: config
    });
  } // :: (EditorState, ?(tr: Transaction)) → bool
  // A command function that undoes the last change, if any.


  function undo(state, dispatch) {
    var hist = historyKey.getState(state);

    if (!hist || hist.done.eventCount == 0) {
      return false;
    }

    if (dispatch) {
      histTransaction(hist, state, dispatch, false);
    }

    return true;
  } // :: (EditorState, ?(tr: Transaction)) → bool
  // A command function that redoes the last undone change, if any.


  function redo(state, dispatch) {
    var hist = historyKey.getState(state);

    if (!hist || hist.undone.eventCount == 0) {
      return false;
    }

    if (dispatch) {
      histTransaction(hist, state, dispatch, true);
    }

    return true;
  } // :: (EditorState) → number

  // Delete the selection, if there is one.

  function deleteSelection(state, dispatch) {
    if (state.selection.empty) {
      return false;
    }

    if (dispatch) {
      dispatch(state.tr.deleteSelection().scrollIntoView());
    }

    return true;
  } // :: (EditorState, ?(tr: Transaction), ?EditorView) → bool
  // If the selection is empty and at the start of a textblock, try to
  // reduce the distance between that block and the one before it—if
  // there's a block directly before it that can be joined, join them.
  // If not, try to move the selected block closer to the next one in
  // the document structure by lifting it out of its parent or moving it
  // into a parent of the previous block. Will use the view for accurate
  // (bidi-aware) start-of-textblock detection if given.


  function joinBackward(state, dispatch, view) {
    var ref = state.selection;
    var $cursor = ref.$cursor;

    if (!$cursor || (view ? !view.endOfTextblock("backward", state) : $cursor.parentOffset > 0)) {
      return false;
    }

    var $cut = findCutBefore($cursor); // If there is no node before this, try to lift

    if (!$cut) {
      var range = $cursor.blockRange(),
          target = range && liftTarget(range);

      if (target == null) {
        return false;
      }

      if (dispatch) {
        dispatch(state.tr.lift(range, target).scrollIntoView());
      }

      return true;
    }

    var before = $cut.nodeBefore; // Apply the joining algorithm

    if (!before.type.spec.isolating && deleteBarrier(state, $cut, dispatch)) {
      return true;
    } // If the node below has no content and the node above is
    // selectable, delete the node below and select the one above.


    if ($cursor.parent.content.size == 0 && (textblockAt(before, "end") || NodeSelection.isSelectable(before))) {
      if (dispatch) {
        var tr = state.tr.deleteRange($cursor.before(), $cursor.after());
        tr.setSelection(textblockAt(before, "end") ? Selection.findFrom(tr.doc.resolve(tr.mapping.map($cut.pos, -1)), -1) : NodeSelection.create(tr.doc, $cut.pos - before.nodeSize));
        dispatch(tr.scrollIntoView());
      }

      return true;
    } // If the node before is an atom, delete it


    if (before.isAtom && $cut.depth == $cursor.depth - 1) {
      if (dispatch) {
        dispatch(state.tr.delete($cut.pos - before.nodeSize, $cut.pos).scrollIntoView());
      }

      return true;
    }

    return false;
  }

  function textblockAt(node, side) {
    for (; node; node = side == "start" ? node.firstChild : node.lastChild) {
      if (node.isTextblock) {
        return true;
      }
    }

    return false;
  } // :: (EditorState, ?(tr: Transaction), ?EditorView) → bool
  // When the selection is empty and at the start of a textblock, select
  // the node before that textblock, if possible. This is intended to be
  // bound to keys like backspace, after
  // [`joinBackward`](#commands.joinBackward) or other deleting
  // commands, as a fall-back behavior when the schema doesn't allow
  // deletion at the selected point.


  function selectNodeBackward(state, dispatch, view) {
    var ref = state.selection;
    var $cursor = ref.$cursor;

    if (!$cursor || (view ? !view.endOfTextblock("backward", state) : $cursor.parentOffset > 0)) {
      return false;
    }

    var $cut = findCutBefore($cursor),
        node = $cut && $cut.nodeBefore;

    if (!node || !NodeSelection.isSelectable(node)) {
      return false;
    }

    if (dispatch) {
      dispatch(state.tr.setSelection(NodeSelection.create(state.doc, $cut.pos - node.nodeSize)).scrollIntoView());
    }

    return true;
  }

  function findCutBefore($pos) {
    if (!$pos.parent.type.spec.isolating) {
      for (var i = $pos.depth - 1; i >= 0; i--) {
        if ($pos.index(i) > 0) {
          return $pos.doc.resolve($pos.before(i + 1));
        }

        if ($pos.node(i).type.spec.isolating) {
          break;
        }
      }
    }

    return null;
  } // :: (EditorState, ?(tr: Transaction), ?EditorView) → bool
  // If the selection is empty and the cursor is at the end of a
  // textblock, try to reduce or remove the boundary between that block
  // and the one after it, either by joining them or by moving the other
  // block closer to this one in the tree structure. Will use the view
  // for accurate start-of-textblock detection if given.


  function joinForward(state, dispatch, view) {
    var ref = state.selection;
    var $cursor = ref.$cursor;

    if (!$cursor || (view ? !view.endOfTextblock("forward", state) : $cursor.parentOffset < $cursor.parent.content.size)) {
      return false;
    }

    var $cut = findCutAfter($cursor); // If there is no node after this, there's nothing to do

    if (!$cut) {
      return false;
    }

    var after = $cut.nodeAfter; // Try the joining algorithm

    if (deleteBarrier(state, $cut, dispatch)) {
      return true;
    } // If the node above has no content and the node below is
    // selectable, delete the node above and select the one below.


    if ($cursor.parent.content.size == 0 && (textblockAt(after, "start") || NodeSelection.isSelectable(after))) {
      if (dispatch) {
        var tr = state.tr.deleteRange($cursor.before(), $cursor.after());
        tr.setSelection(textblockAt(after, "start") ? Selection.findFrom(tr.doc.resolve(tr.mapping.map($cut.pos)), 1) : NodeSelection.create(tr.doc, tr.mapping.map($cut.pos)));
        dispatch(tr.scrollIntoView());
      }

      return true;
    } // If the next node is an atom, delete it


    if (after.isAtom && $cut.depth == $cursor.depth - 1) {
      if (dispatch) {
        dispatch(state.tr.delete($cut.pos, $cut.pos + after.nodeSize).scrollIntoView());
      }

      return true;
    }

    return false;
  } // :: (EditorState, ?(tr: Transaction), ?EditorView) → bool
  // When the selection is empty and at the end of a textblock, select
  // the node coming after that textblock, if possible. This is intended
  // to be bound to keys like delete, after
  // [`joinForward`](#commands.joinForward) and similar deleting
  // commands, to provide a fall-back behavior when the schema doesn't
  // allow deletion at the selected point.


  function selectNodeForward(state, dispatch, view) {
    var ref = state.selection;
    var $cursor = ref.$cursor;

    if (!$cursor || (view ? !view.endOfTextblock("forward", state) : $cursor.parentOffset < $cursor.parent.content.size)) {
      return false;
    }

    var $cut = findCutAfter($cursor),
        node = $cut && $cut.nodeAfter;

    if (!node || !NodeSelection.isSelectable(node)) {
      return false;
    }

    if (dispatch) {
      dispatch(state.tr.setSelection(NodeSelection.create(state.doc, $cut.pos)).scrollIntoView());
    }

    return true;
  }

  function findCutAfter($pos) {
    if (!$pos.parent.type.spec.isolating) {
      for (var i = $pos.depth - 1; i >= 0; i--) {
        var parent = $pos.node(i);

        if ($pos.index(i) + 1 < parent.childCount) {
          return $pos.doc.resolve($pos.after(i + 1));
        }

        if (parent.type.spec.isolating) {
          break;
        }
      }
    }

    return null;
  } // :: (EditorState, ?(tr: Transaction)) → bool
  // Join the selected block or, if there is a text selection, the
  // closest ancestor block of the selection that can be joined, with
  // the sibling above it.


  function joinUp(state, dispatch) {
    var sel = state.selection,
        nodeSel = sel instanceof NodeSelection,
        point;

    if (nodeSel) {
      if (sel.node.isTextblock || !canJoin(state.doc, sel.from)) {
        return false;
      }

      point = sel.from;
    } else {
      point = joinPoint(state.doc, sel.from, -1);

      if (point == null) {
        return false;
      }
    }

    if (dispatch) {
      var tr = state.tr.join(point);

      if (nodeSel) {
        tr.setSelection(NodeSelection.create(tr.doc, point - state.doc.resolve(point).nodeBefore.nodeSize));
      }

      dispatch(tr.scrollIntoView());
    }

    return true;
  } // :: (EditorState, ?(tr: Transaction)) → bool
  // Join the selected block, or the closest ancestor of the selection
  // that can be joined, with the sibling after it.


  function joinDown(state, dispatch) {
    var sel = state.selection,
        point;

    if (sel instanceof NodeSelection) {
      if (sel.node.isTextblock || !canJoin(state.doc, sel.to)) {
        return false;
      }

      point = sel.to;
    } else {
      point = joinPoint(state.doc, sel.to, 1);

      if (point == null) {
        return false;
      }
    }

    if (dispatch) {
      dispatch(state.tr.join(point).scrollIntoView());
    }

    return true;
  } // :: (EditorState, ?(tr: Transaction)) → bool
  // Lift the selected block, or the closest ancestor block of the
  // selection that can be lifted, out of its parent node.


  function lift(state, dispatch) {
    var ref = state.selection;
    var $from = ref.$from;
    var $to = ref.$to;
    var range = $from.blockRange($to),
        target = range && liftTarget(range);

    if (target == null) {
      return false;
    }

    if (dispatch) {
      dispatch(state.tr.lift(range, target).scrollIntoView());
    }

    return true;
  } // :: (EditorState, ?(tr: Transaction)) → bool
  // If the selection is in a node whose type has a truthy
  // [`code`](#model.NodeSpec.code) property in its spec, replace the
  // selection with a newline character.


  function newlineInCode(state, dispatch) {
    var ref = state.selection;
    var $head = ref.$head;
    var $anchor = ref.$anchor;

    if (!$head.parent.type.spec.code || !$head.sameParent($anchor)) {
      return false;
    }

    if (dispatch) {
      dispatch(state.tr.insertText("\n").scrollIntoView());
    }

    return true;
  } // :: (EditorState, ?(tr: Transaction)) → bool
  // When the selection is in a node with a truthy
  // [`code`](#model.NodeSpec.code) property in its spec, create a
  // default block after the code block, and move the cursor there.


  function exitCode(state, dispatch) {
    var ref = state.selection;
    var $head = ref.$head;
    var $anchor = ref.$anchor;

    if (!$head.parent.type.spec.code || !$head.sameParent($anchor)) {
      return false;
    }

    var above = $head.node(-1),
        after = $head.indexAfter(-1),
        type = above.contentMatchAt(after).defaultType;

    if (!above.canReplaceWith(after, after, type)) {
      return false;
    }

    if (dispatch) {
      var pos = $head.after(),
          tr = state.tr.replaceWith(pos, pos, type.createAndFill());
      tr.setSelection(Selection.near(tr.doc.resolve(pos), 1));
      dispatch(tr.scrollIntoView());
    }

    return true;
  } // :: (EditorState, ?(tr: Transaction)) → bool
  // If a block node is selected, create an empty paragraph before (if
  // it is its parent's first child) or after it.


  function createParagraphNear(state, dispatch) {
    var ref = state.selection;
    var $from = ref.$from;
    var $to = ref.$to;

    if ($from.parent.inlineContent || $to.parent.inlineContent) {
      return false;
    }

    var type = $from.parent.contentMatchAt($to.indexAfter()).defaultType;

    if (!type || !type.isTextblock) {
      return false;
    }

    if (dispatch) {
      var side = (!$from.parentOffset && $to.index() < $to.parent.childCount ? $from : $to).pos;
      var tr = state.tr.insert(side, type.createAndFill());
      tr.setSelection(TextSelection.create(tr.doc, side + 1));
      dispatch(tr.scrollIntoView());
    }

    return true;
  } // :: (EditorState, ?(tr: Transaction)) → bool
  // If the cursor is in an empty textblock that can be lifted, lift the
  // block.


  function liftEmptyBlock(state, dispatch) {
    var ref = state.selection;
    var $cursor = ref.$cursor;

    if (!$cursor || $cursor.parent.content.size) {
      return false;
    }

    if ($cursor.depth > 1 && $cursor.after() != $cursor.end(-1)) {
      var before = $cursor.before();

      if (canSplit(state.doc, before)) {
        if (dispatch) {
          dispatch(state.tr.split(before).scrollIntoView());
        }

        return true;
      }
    }

    var range = $cursor.blockRange(),
        target = range && liftTarget(range);

    if (target == null) {
      return false;
    }

    if (dispatch) {
      dispatch(state.tr.lift(range, target).scrollIntoView());
    }

    return true;
  } // :: (EditorState, ?(tr: Transaction)) → bool
  // Split the parent block of the selection. If the selection is a text
  // selection, also delete its content.


  function splitBlock(state, dispatch) {
    var ref = state.selection;
    var $from = ref.$from;
    var $to = ref.$to;

    if (state.selection instanceof NodeSelection && state.selection.node.isBlock) {
      if (!$from.parentOffset || !canSplit(state.doc, $from.pos)) {
        return false;
      }

      if (dispatch) {
        dispatch(state.tr.split($from.pos).scrollIntoView());
      }

      return true;
    }

    if (!$from.parent.isBlock) {
      return false;
    }

    if (dispatch) {
      var atEnd = $to.parentOffset == $to.parent.content.size;
      var tr = state.tr;

      if (state.selection instanceof TextSelection) {
        tr.deleteSelection();
      }

      var deflt = $from.depth == 0 ? null : $from.node(-1).contentMatchAt($from.indexAfter(-1)).defaultType;
      var types = atEnd && deflt ? [{
        type: deflt
      }] : null;
      var can = canSplit(tr.doc, tr.mapping.map($from.pos), 1, types);

      if (!types && !can && canSplit(tr.doc, tr.mapping.map($from.pos), 1, deflt && [{
        type: deflt
      }])) {
        types = [{
          type: deflt
        }];
        can = true;
      }

      if (can) {
        tr.split(tr.mapping.map($from.pos), 1, types);

        if (!atEnd && !$from.parentOffset && $from.parent.type != deflt && $from.node(-1).canReplace($from.index(-1), $from.indexAfter(-1), Fragment.from(deflt.create(), $from.parent))) {
          tr.setNodeMarkup(tr.mapping.map($from.before()), deflt);
        }
      }

      dispatch(tr.scrollIntoView());
    }

    return true;
  } // :: (EditorState, ?(tr: Transaction)) → bool
  // Move the selection to the node wrapping the current selection, if
  // any. (Will not select the document node.)


  function selectParentNode(state, dispatch) {
    var ref = state.selection;
    var $from = ref.$from;
    var to = ref.to;
    var pos;
    var same = $from.sharedDepth(to);

    if (same == 0) {
      return false;
    }

    pos = $from.before(same);

    if (dispatch) {
      dispatch(state.tr.setSelection(NodeSelection.create(state.doc, pos)));
    }

    return true;
  } // :: (EditorState, ?(tr: Transaction)) → bool
  // Select the whole document.


  function selectAll(state, dispatch) {
    if (dispatch) {
      dispatch(state.tr.setSelection(new AllSelection(state.doc)));
    }

    return true;
  }

  function joinMaybeClear(state, $pos, dispatch) {
    var before = $pos.nodeBefore,
        after = $pos.nodeAfter,
        index = $pos.index();

    if (!before || !after || !before.type.compatibleContent(after.type)) {
      return false;
    }

    if (!before.content.size && $pos.parent.canReplace(index - 1, index)) {
      if (dispatch) {
        dispatch(state.tr.delete($pos.pos - before.nodeSize, $pos.pos).scrollIntoView());
      }

      return true;
    }

    if (!$pos.parent.canReplace(index, index + 1) || !(after.isTextblock || canJoin(state.doc, $pos.pos))) {
      return false;
    }

    if (dispatch) {
      dispatch(state.tr.clearIncompatible($pos.pos, before.type, before.contentMatchAt(before.childCount)).join($pos.pos).scrollIntoView());
    }

    return true;
  }

  function deleteBarrier(state, $cut, dispatch) {
    var before = $cut.nodeBefore,
        after = $cut.nodeAfter,
        conn,
        match;

    if (before.type.spec.isolating || after.type.spec.isolating) {
      return false;
    }

    if (joinMaybeClear(state, $cut, dispatch)) {
      return true;
    }

    if ($cut.parent.canReplace($cut.index(), $cut.index() + 1) && (conn = (match = before.contentMatchAt(before.childCount)).findWrapping(after.type)) && match.matchType(conn[0] || after.type).validEnd) {
      if (dispatch) {
        var end = $cut.pos + after.nodeSize,
            wrap = Fragment.empty;

        for (var i = conn.length - 1; i >= 0; i--) {
          wrap = Fragment.from(conn[i].create(null, wrap));
        }

        wrap = Fragment.from(before.copy(wrap));
        var tr = state.tr.step(new ReplaceAroundStep($cut.pos - 1, end, $cut.pos, end, new Slice(wrap, 1, 0), conn.length, true));
        var joinAt = end + 2 * conn.length;

        if (canJoin(tr.doc, joinAt)) {
          tr.join(joinAt);
        }

        dispatch(tr.scrollIntoView());
      }

      return true;
    }

    var selAfter = Selection.findFrom($cut, 1);
    var range = selAfter && selAfter.$from.blockRange(selAfter.$to),
        target = range && liftTarget(range);

    if (target != null && target >= $cut.depth) {
      if (dispatch) {
        dispatch(state.tr.lift(range, target).scrollIntoView());
      }

      return true;
    }

    return false;
  } // Parameterized commands
  // :: (NodeType, ?Object) → (state: EditorState, dispatch: ?(tr: Transaction)) → bool
  // Wrap the selection in a node of the given type with the given
  // attributes.


  function wrapIn(nodeType, attrs) {
    return function (state, dispatch) {
      var ref = state.selection;
      var $from = ref.$from;
      var $to = ref.$to;
      var range = $from.blockRange($to),
          wrapping = range && findWrapping(range, nodeType, attrs);

      if (!wrapping) {
        return false;
      }

      if (dispatch) {
        dispatch(state.tr.wrap(range, wrapping).scrollIntoView());
      }

      return true;
    };
  } // :: (NodeType, ?Object) → (state: EditorState, dispatch: ?(tr: Transaction)) → bool
  // Returns a command that tries to set the selected textblocks to the
  // given node type with the given attributes.


  function setBlockType(nodeType, attrs) {
    return function (state, dispatch) {
      var ref = state.selection;
      var from = ref.from;
      var to = ref.to;
      var applicable = false;
      state.doc.nodesBetween(from, to, function (node, pos) {
        if (applicable) {
          return false;
        }

        if (!node.isTextblock || node.hasMarkup(nodeType, attrs)) {
          return;
        }

        if (node.type == nodeType) {
          applicable = true;
        } else {
          var $pos = state.doc.resolve(pos),
              index = $pos.index();
          applicable = $pos.parent.canReplaceWith(index, index + 1, nodeType);
        }
      });

      if (!applicable) {
        return false;
      }

      if (dispatch) {
        dispatch(state.tr.setBlockType(from, to, nodeType, attrs).scrollIntoView());
      }

      return true;
    };
  }

  function markApplies(doc, ranges, type) {
    var loop = function (i) {
      var ref = ranges[i];
      var $from = ref.$from;
      var $to = ref.$to;
      var can = $from.depth == 0 ? doc.type.allowsMarkType(type) : false;
      doc.nodesBetween($from.pos, $to.pos, function (node) {
        if (can) {
          return false;
        }

        can = node.inlineContent && node.type.allowsMarkType(type);
      });

      if (can) {
        return {
          v: true
        };
      }
    };

    for (var i = 0; i < ranges.length; i++) {
      var returned = loop(i);
      if (returned) return returned.v;
    }

    return false;
  } // :: (MarkType, ?Object) → (state: EditorState, dispatch: ?(tr: Transaction)) → bool
  // Create a command function that toggles the given mark with the
  // given attributes. Will return `false` when the current selection
  // doesn't support that mark. This will remove the mark if any marks
  // of that type exist in the selection, or add it otherwise. If the
  // selection is empty, this applies to the [stored
  // marks](#state.EditorState.storedMarks) instead of a range of the
  // document.


  function toggleMark(markType, attrs) {
    return function (state, dispatch) {
      var ref = state.selection;
      var empty = ref.empty;
      var $cursor = ref.$cursor;
      var ranges = ref.ranges;

      if (empty && !$cursor || !markApplies(state.doc, ranges, markType)) {
        return false;
      }

      if (dispatch) {
        if ($cursor) {
          if (markType.isInSet(state.storedMarks || $cursor.marks())) {
            dispatch(state.tr.removeStoredMark(markType));
          } else {
            dispatch(state.tr.addStoredMark(markType.create(attrs)));
          }
        } else {
          var has = false,
              tr = state.tr;

          for (var i = 0; !has && i < ranges.length; i++) {
            var ref$1 = ranges[i];
            var $from = ref$1.$from;
            var $to = ref$1.$to;
            has = state.doc.rangeHasMark($from.pos, $to.pos, markType);
          }

          for (var i$1 = 0; i$1 < ranges.length; i$1++) {
            var ref$2 = ranges[i$1];
            var $from$1 = ref$2.$from;
            var $to$1 = ref$2.$to;

            if (has) {
              tr.removeMark($from$1.pos, $to$1.pos, markType);
            } else {
              tr.addMark($from$1.pos, $to$1.pos, markType.create(attrs));
            }
          }

          dispatch(tr.scrollIntoView());
        }
      }

      return true;
    };
  }
  // Combine a number of command functions into a single function (which
  // calls them one by one until one returns true).


  function chainCommands() {
    var commands = [],
        len = arguments.length;

    while (len--) commands[len] = arguments[len];

    return function (state, dispatch, view) {
      for (var i = 0; i < commands.length; i++) {
        if (commands[i](state, dispatch, view)) {
          return true;
        }
      }

      return false;
    };
  }

  var backspace = chainCommands(deleteSelection, joinBackward, selectNodeBackward);
  var del = chainCommands(deleteSelection, joinForward, selectNodeForward); // :: Object
  // A basic keymap containing bindings not specific to any schema.
  // Binds the following keys (when multiple commands are listed, they
  // are chained with [`chainCommands`](#commands.chainCommands)):
  //
  // * **Enter** to `newlineInCode`, `createParagraphNear`, `liftEmptyBlock`, `splitBlock`
  // * **Mod-Enter** to `exitCode`
  // * **Backspace** and **Mod-Backspace** to `deleteSelection`, `joinBackward`, `selectNodeBackward`
  // * **Delete** and **Mod-Delete** to `deleteSelection`, `joinForward`, `selectNodeForward`
  // * **Mod-Delete** to `deleteSelection`, `joinForward`, `selectNodeForward`
  // * **Mod-a** to `selectAll`

  var pcBaseKeymap = {
    "Enter": chainCommands(newlineInCode, createParagraphNear, liftEmptyBlock, splitBlock),
    "Mod-Enter": exitCode,
    "Backspace": backspace,
    "Mod-Backspace": backspace,
    "Delete": del,
    "Mod-Delete": del,
    "Mod-a": selectAll
  }; // :: Object
  // A copy of `pcBaseKeymap` that also binds **Ctrl-h** like Backspace,
  // **Ctrl-d** like Delete, **Alt-Backspace** like Ctrl-Backspace, and
  // **Ctrl-Alt-Backspace**, **Alt-Delete**, and **Alt-d** like
  // Ctrl-Delete.

  var macBaseKeymap = {
    "Ctrl-h": pcBaseKeymap["Backspace"],
    "Alt-Backspace": pcBaseKeymap["Mod-Backspace"],
    "Ctrl-d": pcBaseKeymap["Delete"],
    "Ctrl-Alt-Backspace": pcBaseKeymap["Mod-Delete"],
    "Alt-Delete": pcBaseKeymap["Mod-Delete"],
    "Alt-d": pcBaseKeymap["Mod-Delete"]
  };

  for (var key in pcBaseKeymap) {
    macBaseKeymap[key] = pcBaseKeymap[key];
  } // declare global: os, navigator


  var mac$2 = typeof navigator != "undefined" ? /Mac/.test(navigator.platform) : typeof os != "undefined" ? os.platform() == "darwin" : false; // :: Object
  // Depending on the detected platform, this will hold
  // [`pcBasekeymap`](#commands.pcBaseKeymap) or
  // [`macBaseKeymap`](#commands.macBaseKeymap).

  var baseKeymap = mac$2 ? macBaseKeymap : pcBaseKeymap;

  // Create a plugin that, when added to a ProseMirror instance,
  // causes a decoration to show up at the drop position when something
  // is dragged over the editor.
  //
  //   options::- These options are supported:
  //
  //     color:: ?string
  //     The color of the cursor. Defaults to `black`.
  //
  //     width:: ?number
  //     The precise width of the cursor in pixels. Defaults to 1.
  //
  //     class:: ?string
  //     A CSS class name to add to the cursor element.

  function dropCursor(options) {
    if (options === void 0) options = {};
    return new Plugin({
      view: function view(editorView) {
        return new DropCursorView(editorView, options);
      }
    });
  }

  var DropCursorView = function DropCursorView(editorView, options) {
    var this$1 = this;
    this.editorView = editorView;
    this.width = options.width || 1;
    this.color = options.color || "black";
    this.class = options.class;
    this.cursorPos = null;
    this.element = null;
    this.timeout = null;
    this.handlers = ["dragover", "dragend", "drop", "dragleave"].map(function (name) {
      var handler = function (e) {
        return this$1[name](e);
      };

      editorView.dom.addEventListener(name, handler);
      return {
        name: name,
        handler: handler
      };
    });
  };

  DropCursorView.prototype.destroy = function destroy() {
    var this$1 = this;
    this.handlers.forEach(function (ref) {
      var name = ref.name;
      var handler = ref.handler;
      return this$1.editorView.dom.removeEventListener(name, handler);
    });
  };

  DropCursorView.prototype.update = function update(editorView, prevState) {
    if (this.cursorPos != null && prevState.doc != editorView.state.doc) {
      this.updateOverlay();
    }
  };

  DropCursorView.prototype.setCursor = function setCursor(pos) {
    if (pos == this.cursorPos) {
      return;
    }

    this.cursorPos = pos;

    if (pos == null) {
      this.element.parentNode.removeChild(this.element);
      this.element = null;
    } else {
      this.updateOverlay();
    }
  };

  DropCursorView.prototype.updateOverlay = function updateOverlay() {
    var $pos = this.editorView.state.doc.resolve(this.cursorPos),
        rect;

    if (!$pos.parent.inlineContent) {
      var before = $pos.nodeBefore,
          after = $pos.nodeAfter;

      if (before || after) {
        var nodeRect = this.editorView.nodeDOM(this.cursorPos - (before ? before.nodeSize : 0)).getBoundingClientRect();
        var top = before ? nodeRect.bottom : nodeRect.top;

        if (before && after) {
          top = (top + this.editorView.nodeDOM(this.cursorPos).getBoundingClientRect().top) / 2;
        }

        rect = {
          left: nodeRect.left,
          right: nodeRect.right,
          top: top - this.width / 2,
          bottom: top + this.width / 2
        };
      }
    }

    if (!rect) {
      var coords = this.editorView.coordsAtPos(this.cursorPos);
      rect = {
        left: coords.left - this.width / 2,
        right: coords.left + this.width / 2,
        top: coords.top,
        bottom: coords.bottom
      };
    }

    var parent = this.editorView.dom.offsetParent;

    if (!this.element) {
      this.element = parent.appendChild(document.createElement("div"));

      if (this.class) {
        this.element.className = this.class;
      }

      this.element.style.cssText = "position: absolute; z-index: 50; pointer-events: none; background-color: " + this.color;
    }

    var parentRect = !parent || parent == document.body && getComputedStyle(parent).position == "static" ? {
      left: -pageXOffset,
      top: -pageYOffset
    } : parent.getBoundingClientRect();
    this.element.style.left = rect.left - parentRect.left + "px";
    this.element.style.top = rect.top - parentRect.top + "px";
    this.element.style.width = rect.right - rect.left + "px";
    this.element.style.height = rect.bottom - rect.top + "px";
  };

  DropCursorView.prototype.scheduleRemoval = function scheduleRemoval(timeout) {
    var this$1 = this;
    clearTimeout(this.timeout);
    this.timeout = setTimeout(function () {
      return this$1.setCursor(null);
    }, timeout);
  };

  DropCursorView.prototype.dragover = function dragover(event) {
    if (!this.editorView.editable) {
      return;
    }

    var pos = this.editorView.posAtCoords({
      left: event.clientX,
      top: event.clientY
    });

    if (pos) {
      var target = pos.pos;

      if (this.editorView.dragging && this.editorView.dragging.slice) {
        target = dropPoint(this.editorView.state.doc, target, this.editorView.dragging.slice);

        if (target == null) {
          target = pos.pos;
        }
      }

      this.setCursor(target);
      this.scheduleRemoval(5000);
    }
  };

  DropCursorView.prototype.dragend = function dragend() {
    this.scheduleRemoval(20);
  };

  DropCursorView.prototype.drop = function drop() {
    this.scheduleRemoval(20);
  };

  DropCursorView.prototype.dragleave = function dragleave(event) {
    if (event.target == this.editorView.dom || !this.editorView.dom.contains(event.relatedTarget)) {
      this.setCursor(null);
    }
  };

  // `$anchor` and `$head` properties both point at the cursor position.

  var GapCursor =
  /*@__PURE__*/
  function (Selection) {
    function GapCursor($pos) {
      Selection.call(this, $pos, $pos);
    }

    if (Selection) GapCursor.__proto__ = Selection;
    GapCursor.prototype = Object.create(Selection && Selection.prototype);
    GapCursor.prototype.constructor = GapCursor;

    GapCursor.prototype.map = function map(doc, mapping) {
      var $pos = doc.resolve(mapping.map(this.head));
      return GapCursor.valid($pos) ? new GapCursor($pos) : Selection.near($pos);
    };

    GapCursor.prototype.content = function content() {
      return Slice.empty;
    };

    GapCursor.prototype.eq = function eq(other) {
      return other instanceof GapCursor && other.head == this.head;
    };

    GapCursor.prototype.toJSON = function toJSON() {
      return {
        type: "gapcursor",
        pos: this.head
      };
    };

    GapCursor.fromJSON = function fromJSON(doc, json) {
      if (typeof json.pos != "number") {
        throw new RangeError("Invalid input for GapCursor.fromJSON");
      }

      return new GapCursor(doc.resolve(json.pos));
    };

    GapCursor.prototype.getBookmark = function getBookmark() {
      return new GapBookmark(this.anchor);
    };

    GapCursor.valid = function valid($pos) {
      var parent = $pos.parent;

      if (parent.isTextblock || !closedBefore($pos) || !closedAfter($pos)) {
        return false;
      }

      var override = parent.type.spec.allowGapCursor;

      if (override != null) {
        return override;
      }

      var deflt = parent.contentMatchAt($pos.index()).defaultType;
      return deflt && deflt.isTextblock;
    };

    GapCursor.findFrom = function findFrom($pos, dir, mustMove) {
      if (!mustMove && GapCursor.valid($pos)) {
        return $pos;
      }

      var pos = $pos.pos,
          next = null; // Scan up from this position

      for (var d = $pos.depth;; d--) {
        var parent = $pos.node(d);

        if (dir > 0 ? $pos.indexAfter(d) < parent.childCount : $pos.index(d) > 0) {
          next = parent.maybeChild(dir > 0 ? $pos.indexAfter(d) : $pos.index(d) - 1);
          break;
        } else if (d == 0) {
          return null;
        }

        pos += dir;
        var $cur = $pos.doc.resolve(pos);

        if (GapCursor.valid($cur)) {
          return $cur;
        }
      } // And then down into the next node


      for (;;) {
        next = dir > 0 ? next.firstChild : next.lastChild;

        if (!next) {
          break;
        }

        pos += dir;
        var $cur$1 = $pos.doc.resolve(pos);

        if (GapCursor.valid($cur$1)) {
          return $cur$1;
        }
      }

      return null;
    };

    return GapCursor;
  }(Selection);

  GapCursor.prototype.visible = false;
  Selection.jsonID("gapcursor", GapCursor);

  var GapBookmark = function GapBookmark(pos) {
    this.pos = pos;
  };

  GapBookmark.prototype.map = function map(mapping) {
    return new GapBookmark(mapping.map(this.pos));
  };

  GapBookmark.prototype.resolve = function resolve(doc) {
    var $pos = doc.resolve(this.pos);
    return GapCursor.valid($pos) ? new GapCursor($pos) : Selection.near($pos);
  };

  function closedBefore($pos) {
    for (var d = $pos.depth; d >= 0; d--) {
      var index = $pos.index(d); // At the start of this parent, look at next one

      if (index == 0) {
        continue;
      } // See if the node before (or its first ancestor) is closed


      for (var before = $pos.node(d).child(index - 1);; before = before.lastChild) {
        if (before.childCount == 0 && !before.inlineContent || before.isAtom || before.type.spec.isolating) {
          return true;
        }

        if (before.inlineContent) {
          return false;
        }
      }
    } // Hit start of document


    return true;
  }

  function closedAfter($pos) {
    for (var d = $pos.depth; d >= 0; d--) {
      var index = $pos.indexAfter(d),
          parent = $pos.node(d);

      if (index == parent.childCount) {
        continue;
      }

      for (var after = parent.child(index);; after = after.firstChild) {
        if (after.childCount == 0 && !after.inlineContent || after.isAtom || after.type.spec.isolating) {
          return true;
        }

        if (after.inlineContent) {
          return false;
        }
      }
    }

    return true;
  } // :: () → Plugin
  // Create a gap cursor plugin. When enabled, this will capture clicks
  // near and arrow-key-motion past places that don't have a normally
  // selectable position nearby, and create a gap cursor selection for
  // them. The cursor is drawn as an element with class
  // `ProseMirror-gapcursor`. You can either include
  // `style/gapcursor.css` from the package's directory or add your own
  // styles to make it visible.


  var gapCursor = function () {
    return new Plugin({
      props: {
        decorations: drawGapCursor,
        createSelectionBetween: function createSelectionBetween(_view, $anchor, $head) {
          if ($anchor.pos == $head.pos && GapCursor.valid($head)) {
            return new GapCursor($head);
          }
        },
        handleClick: handleClick,
        handleKeyDown: handleKeyDown
      }
    });
  };

  var handleKeyDown = keydownHandler({
    "ArrowLeft": arrow("horiz", -1),
    "ArrowRight": arrow("horiz", 1),
    "ArrowUp": arrow("vert", -1),
    "ArrowDown": arrow("vert", 1)
  });

  function arrow(axis, dir) {
    var dirStr = axis == "vert" ? dir > 0 ? "down" : "up" : dir > 0 ? "right" : "left";
    return function (state, dispatch, view) {
      var sel = state.selection;
      var $start = dir > 0 ? sel.$to : sel.$from,
          mustMove = sel.empty;

      if (sel instanceof TextSelection) {
        if (!view.endOfTextblock(dirStr)) {
          return false;
        }

        mustMove = false;
        $start = state.doc.resolve(dir > 0 ? $start.after() : $start.before());
      }

      var $found = GapCursor.findFrom($start, dir, mustMove);

      if (!$found) {
        return false;
      }

      if (dispatch) {
        dispatch(state.tr.setSelection(new GapCursor($found)));
      }

      return true;
    };
  }

  function handleClick(view, pos, event) {
    if (!view.editable) {
      return false;
    }

    var $pos = view.state.doc.resolve(pos);

    if (!GapCursor.valid($pos)) {
      return false;
    }

    var ref = view.posAtCoords({
      left: event.clientX,
      top: event.clientY
    });
    var inside = ref.inside;

    if (inside > -1 && NodeSelection.isSelectable(view.state.doc.nodeAt(inside))) {
      return false;
    }

    view.dispatch(view.state.tr.setSelection(new GapCursor($pos)));
    return true;
  }

  function drawGapCursor(state) {
    if (!(state.selection instanceof GapCursor)) {
      return null;
    }

    var node = document.createElement("div");
    node.className = "ProseMirror-gapcursor";
    return DecorationSet.create(state.doc, [Decoration.widget(state.selection.head, node, {
      key: "gapcursor"
    })]);
  }

  var crel = createCommonjsModule(function (module, exports) {
  //Copyright (C) 2012 Kory Nunn
  //Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
  //The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
  //THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

  /*

      This code is not formatted for readability, but rather run-speed and to assist compilers.

      However, the code's intention should be transparent.

      *** IE SUPPORT ***

      If you require this library to work in IE7, add the following after declaring crel.

      var testDiv = document.createElement('div'),
          testLabel = document.createElement('label');

      testDiv.setAttribute('class', 'a');
      testDiv['className'] !== 'a' ? crel.attrMap['class'] = 'className':undefined;
      testDiv.setAttribute('name','a');
      testDiv['name'] !== 'a' ? crel.attrMap['name'] = function(element, value){
          element.id = value;
      }:undefined;


      testLabel.setAttribute('for', 'a');
      testLabel['htmlFor'] !== 'a' ? crel.attrMap['for'] = 'htmlFor':undefined;



  */
  (function (root, factory) {
    {
      module.exports = factory();
    }
  })(commonjsGlobal, function () {
    var fn = 'function',
        obj = 'object',
        nodeType = 'nodeType',
        textContent = 'textContent',
        setAttribute = 'setAttribute',
        attrMapString = 'attrMap',
        isNodeString = 'isNode',
        isElementString = 'isElement',
        d = typeof document === obj ? document : {},
        isType = function (a, type) {
      return typeof a === type;
    },
        isNode = typeof Node === fn ? function (object) {
      return object instanceof Node;
    } : // in IE <= 8 Node is an object, obviously..
    function (object) {
      return object && isType(object, obj) && nodeType in object && isType(object.ownerDocument, obj);
    },
        isElement = function (object) {
      return crel[isNodeString](object) && object[nodeType] === 1;
    },
        isArray = function (a) {
      return a instanceof Array;
    },
        appendChild = function (element, child) {
      if (isArray(child)) {
        child.map(function (subChild) {
          appendChild(element, subChild);
        });
        return;
      }

      if (!crel[isNodeString](child)) {
        child = d.createTextNode(child);
      }

      element.appendChild(child);
    };

    function crel() {
      var args = arguments,
          //Note: assigned to a variable to assist compilers. Saves about 40 bytes in closure compiler. Has negligable effect on performance.
      element = args[0],
          child,
          settings = args[1],
          childIndex = 2,
          argumentsLength = args.length,
          attributeMap = crel[attrMapString];
      element = crel[isElementString](element) ? element : d.createElement(element); // shortcut

      if (argumentsLength === 1) {
        return element;
      }

      if (!isType(settings, obj) || crel[isNodeString](settings) || isArray(settings)) {
        --childIndex;
        settings = null;
      } // shortcut if there is only one child that is a string


      if (argumentsLength - childIndex === 1 && isType(args[childIndex], 'string') && element[textContent] !== undefined) {
        element[textContent] = args[childIndex];
      } else {
        for (; childIndex < argumentsLength; ++childIndex) {
          child = args[childIndex];

          if (child == null) {
            continue;
          }

          if (isArray(child)) {
            for (var i = 0; i < child.length; ++i) {
              appendChild(element, child[i]);
            }
          } else {
            appendChild(element, child);
          }
        }
      }

      for (var key in settings) {
        if (!attributeMap[key]) {
          if (isType(settings[key], fn)) {
            element[key] = settings[key];
          } else {
            element[setAttribute](key, settings[key]);
          }
        } else {
          var attr = attributeMap[key];

          if (typeof attr === fn) {
            attr(element, settings[key]);
          } else {
            element[setAttribute](attr, settings[key]);
          }
        }
      }

      return element;
    } // Used for mapping one kind of attribute to the supported version of that in bad browsers.


    crel[attrMapString] = {};
    crel[isElementString] = isElement;
    crel[isNodeString] = isNode;

    if (typeof Proxy !== 'undefined') {
      crel.proxy = new Proxy(crel, {
        get: function (target, key) {
          !(key in crel) && (crel[key] = crel.bind(null, key));
          return crel[key];
        }
      });
    }

    return crel;
  });
  });

  var SVG = "http://www.w3.org/2000/svg";
  var XLINK = "http://www.w3.org/1999/xlink";
  var prefix = "ProseMirror-icon";

  function hashPath(path) {
    var hash = 0;

    for (var i = 0; i < path.length; i++) {
      hash = (hash << 5) - hash + path.charCodeAt(i) | 0;
    }

    return hash;
  }

  function getIcon(icon) {
    var node = document.createElement("div");
    node.className = prefix;

    if (icon.path) {
      var name = "pm-icon-" + hashPath(icon.path).toString(16);

      if (!document.getElementById(name)) {
        buildSVG(name, icon);
      }

      var svg = node.appendChild(document.createElementNS(SVG, "svg"));
      svg.style.width = icon.width / icon.height + "em";
      var use = svg.appendChild(document.createElementNS(SVG, "use"));
      use.setAttributeNS(XLINK, "href", /([^#]*)/.exec(document.location)[1] + "#" + name);
    } else if (icon.dom) {
      node.appendChild(icon.dom.cloneNode(true));
    } else {
      node.appendChild(document.createElement("span")).textContent = icon.text || '';

      if (icon.css) {
        node.firstChild.style.cssText = icon.css;
      }
    }

    return node;
  }

  function buildSVG(name, data) {
    var collection = document.getElementById(prefix + "-collection");

    if (!collection) {
      collection = document.createElementNS(SVG, "svg");
      collection.id = prefix + "-collection";
      collection.style.display = "none";
      document.body.insertBefore(collection, document.body.firstChild);
    }

    var sym = document.createElementNS(SVG, "symbol");
    sym.id = name;
    sym.setAttribute("viewBox", "0 0 " + data.width + " " + data.height);
    var path = sym.appendChild(document.createElementNS(SVG, "path"));
    path.setAttribute("d", data.path);
    collection.appendChild(sym);
  }

  var prefix$1 = "ProseMirror-menu"; // ::- An icon or label that, when clicked, executes a command.

  var MenuItem = function MenuItem(spec) {
    // :: MenuItemSpec
    // The spec used to create the menu item.
    this.spec = spec;
  }; // :: (EditorView) → {dom: dom.Node, update: (EditorState) → bool}
  // Renders the icon according to its [display
  // spec](#menu.MenuItemSpec.display), and adds an event handler which
  // executes the command when the representation is clicked.


  MenuItem.prototype.render = function render(view) {
    var spec = this.spec;
    var dom = spec.render ? spec.render(view) : spec.icon ? getIcon(spec.icon) : spec.label ? crel("div", null, translate(view, spec.label)) : null;

    if (!dom) {
      throw new RangeError("MenuItem without icon or label property");
    }

    if (spec.title) {
      var title = typeof spec.title === "function" ? spec.title(view.state) : spec.title;
      dom.setAttribute("title", translate(view, title));
    }

    if (spec.class) {
      dom.classList.add(spec.class);
    }

    if (spec.css) {
      dom.style.cssText += spec.css;
    }

    dom.addEventListener("mousedown", function (e) {
      e.preventDefault();

      if (!dom.classList.contains(prefix$1 + "-disabled")) {
        spec.run(view.state, view.dispatch, view, e);
      }
    });

    function update(state) {
      if (spec.select) {
        var selected = spec.select(state);
        dom.style.display = selected ? "" : "none";

        if (!selected) {
          return false;
        }
      }

      var enabled = true;

      if (spec.enable) {
        enabled = spec.enable(state) || false;
        setClass(dom, prefix$1 + "-disabled", !enabled);
      }

      if (spec.active) {
        var active = enabled && spec.active(state) || false;
        setClass(dom, prefix$1 + "-active", active);
      }

      return true;
    }

    return {
      dom: dom,
      update: update
    };
  };

  function translate(view, text) {
    return view._props.translate ? view._props.translate(text) : text;
  } // MenuItemSpec:: interface
  // The configuration object passed to the `MenuItem` constructor.
  //
  //   run:: (EditorState, (Transaction), EditorView, dom.Event)
  //   The function to execute when the menu item is activated.
  //
  //   select:: ?(EditorState) → bool
  //   Optional function that is used to determine whether the item is
  //   appropriate at the moment. Deselected items will be hidden.
  //
  //   enable:: ?(EditorState) → bool
  //   Function that is used to determine if the item is enabled. If
  //   given and returning false, the item will be given a disabled
  //   styling.
  //
  //   active:: ?(EditorState) → bool
  //   A predicate function to determine whether the item is 'active' (for
  //   example, the item for toggling the strong mark might be active then
  //   the cursor is in strong text).
  //
  //   render:: ?(EditorView) → dom.Node
  //   A function that renders the item. You must provide either this,
  //   [`icon`](#menu.MenuItemSpec.icon), or [`label`](#MenuItemSpec.label).
  //
  //   icon:: ?Object
  //   Describes an icon to show for this item. The object may specify
  //   an SVG icon, in which case its `path` property should be an [SVG
  //   path
  //   spec](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/d),
  //   and `width` and `height` should provide the viewbox in which that
  //   path exists. Alternatively, it may have a `text` property
  //   specifying a string of text that makes up the icon, with an
  //   optional `css` property giving additional CSS styling for the
  //   text. _Or_ it may contain `dom` property containing a DOM node.
  //
  //   label:: ?string
  //   Makes the item show up as a text label. Mostly useful for items
  //   wrapped in a [drop-down](#menu.Dropdown) or similar menu. The object
  //   should have a `label` property providing the text to display.
  //
  //   title:: ?union<string, (EditorState) → string>
  //   Defines DOM title (mouseover) text for the item.
  //
  //   class:: ?string
  //   Optionally adds a CSS class to the item's DOM representation.
  //
  //   css:: ?string
  //   Optionally adds a string of inline CSS to the item's DOM
  //   representation.
  //
  //   execEvent:: ?string
  //   Defines which event on the command's DOM representation should
  //   trigger the execution of the command. Defaults to mousedown.


  var lastMenuEvent = {
    time: 0,
    node: null
  };

  function markMenuEvent(e) {
    lastMenuEvent.time = Date.now();
    lastMenuEvent.node = e.target;
  }

  function isMenuEvent(wrapper) {
    return Date.now() - 100 < lastMenuEvent.time && lastMenuEvent.node && wrapper.contains(lastMenuEvent.node);
  } // ::- A drop-down menu, displayed as a label with a downwards-pointing
  // triangle to the right of it.


  var Dropdown = function Dropdown(content, options) {
    this.options = options || {};
    this.content = Array.isArray(content) ? content : [content];
  }; // :: (EditorView) → {dom: dom.Node, update: (EditorState)}
  // Render the dropdown menu and sub-items.


  Dropdown.prototype.render = function render(view) {
    var this$1 = this;
    var content = renderDropdownItems(this.content, view);
    var label = crel("div", {
      class: prefix$1 + "-dropdown " + (this.options.class || ""),
      style: this.options.css
    }, translate(view, this.options.label));

    if (this.options.title) {
      label.setAttribute("title", translate(view, this.options.title));
    }

    var wrap = crel("div", {
      class: prefix$1 + "-dropdown-wrap"
    }, label);
    var open = null,
        listeningOnClose = null;

    var close = function () {
      if (open && open.close()) {
        open = null;
        window.removeEventListener("mousedown", listeningOnClose);
      }
    };

    label.addEventListener("mousedown", function (e) {
      e.preventDefault();
      markMenuEvent(e);

      if (open) {
        close();
      } else {
        open = this$1.expand(wrap, content.dom);
        window.addEventListener("mousedown", listeningOnClose = function () {
          if (!isMenuEvent(wrap)) {
            close();
          }
        });
      }
    });

    function update(state) {
      var inner = content.update(state);
      wrap.style.display = inner ? "" : "none";
      return inner;
    }

    return {
      dom: wrap,
      update: update
    };
  };

  Dropdown.prototype.expand = function expand(dom, items) {
    var menuDOM = crel("div", {
      class: prefix$1 + "-dropdown-menu " + (this.options.class || "")
    }, items);
    var done = false;

    function close() {
      if (done) {
        return;
      }

      done = true;
      dom.removeChild(menuDOM);
      return true;
    }

    dom.appendChild(menuDOM);
    return {
      close: close,
      node: menuDOM
    };
  };

  function renderDropdownItems(items, view) {
    var rendered = [],
        updates = [];

    for (var i = 0; i < items.length; i++) {
      var ref = items[i].render(view);
      var dom = ref.dom;
      var update = ref.update;
      rendered.push(crel("div", {
        class: prefix$1 + "-dropdown-item"
      }, dom));
      updates.push(update);
    }

    return {
      dom: rendered,
      update: combineUpdates(updates, rendered)
    };
  }

  function combineUpdates(updates, nodes) {
    return function (state) {
      var something = false;

      for (var i = 0; i < updates.length; i++) {
        var up = updates[i](state);
        nodes[i].style.display = up ? "" : "none";

        if (up) {
          something = true;
        }
      }

      return something;
    };
  } // ::- Represents a submenu wrapping a group of elements that start
  // hidden and expand to the right when hovered over or tapped.


  var DropdownSubmenu = function DropdownSubmenu(content, options) {
    this.options = options || {};
    this.content = Array.isArray(content) ? content : [content];
  }; // :: (EditorView) → {dom: dom.Node, update: (EditorState) → bool}
  // Renders the submenu.


  DropdownSubmenu.prototype.render = function render(view) {
    var items = renderDropdownItems(this.content, view);
    var label = crel("div", {
      class: prefix$1 + "-submenu-label"
    }, translate(view, this.options.label));
    var wrap = crel("div", {
      class: prefix$1 + "-submenu-wrap"
    }, label, crel("div", {
      class: prefix$1 + "-submenu"
    }, items.dom));
    var listeningOnClose = null;
    label.addEventListener("mousedown", function (e) {
      e.preventDefault();
      markMenuEvent(e);
      setClass(wrap, prefix$1 + "-submenu-wrap-active");

      if (!listeningOnClose) {
        window.addEventListener("mousedown", listeningOnClose = function () {
          if (!isMenuEvent(wrap)) {
            wrap.classList.remove(prefix$1 + "-submenu-wrap-active");
            window.removeEventListener("mousedown", listeningOnClose);
            listeningOnClose = null;
          }
        });
      }
    });

    function update(state) {
      var inner = items.update(state);
      wrap.style.display = inner ? "" : "none";
      return inner;
    }

    return {
      dom: wrap,
      update: update
    };
  }; // :: (EditorView, [union<MenuElement, [MenuElement]>]) → {dom: ?dom.DocumentFragment, update: (EditorState) → bool}
  // Render the given, possibly nested, array of menu elements into a
  // document fragment, placing separators between them (and ensuring no
  // superfluous separators appear when some of the groups turn out to
  // be empty).


  function renderGrouped(view, content) {
    var result = document.createDocumentFragment();
    var updates = [],
        separators = [];

    for (var i = 0; i < content.length; i++) {
      var items = content[i],
          localUpdates = [],
          localNodes = [];

      for (var j = 0; j < items.length; j++) {
        var ref = items[j].render(view);
        var dom = ref.dom;
        var update$1 = ref.update;
        var span = crel("span", {
          class: prefix$1 + "item"
        }, dom);
        result.appendChild(span);
        localNodes.push(span);
        localUpdates.push(update$1);
      }

      if (localUpdates.length) {
        updates.push(combineUpdates(localUpdates, localNodes));

        if (i < content.length - 1) {
          separators.push(result.appendChild(separator()));
        }
      }
    }

    function update(state) {
      var something = false,
          needSep = false;

      for (var i = 0; i < updates.length; i++) {
        var hasContent = updates[i](state);

        if (i) {
          separators[i - 1].style.display = needSep && hasContent ? "" : "none";
        }

        needSep = hasContent;

        if (hasContent) {
          something = true;
        }
      }

      return something;
    }

    return {
      dom: result,
      update: update
    };
  }

  function separator() {
    return crel("span", {
      class: prefix$1 + "separator"
    });
  } // :: Object
  // A set of basic editor-related icons. Contains the properties
  // `join`, `lift`, `selectParentNode`, `undo`, `redo`, `strong`, `em`,
  // `code`, `link`, `bulletList`, `orderedList`, and `blockquote`, each
  // holding an object that can be used as the `icon` option to
  // `MenuItem`.


  var icons = {
    join: {
      width: 800,
      height: 900,
      path: "M0 75h800v125h-800z M0 825h800v-125h-800z M250 400h100v-100h100v100h100v100h-100v100h-100v-100h-100z"
    },
    lift: {
      width: 1024,
      height: 1024,
      path: "M219 310v329q0 7-5 12t-12 5q-8 0-13-5l-164-164q-5-5-5-13t5-13l164-164q5-5 13-5 7 0 12 5t5 12zM1024 749v109q0 7-5 12t-12 5h-987q-7 0-12-5t-5-12v-109q0-7 5-12t12-5h987q7 0 12 5t5 12zM1024 530v109q0 7-5 12t-12 5h-621q-7 0-12-5t-5-12v-109q0-7 5-12t12-5h621q7 0 12 5t5 12zM1024 310v109q0 7-5 12t-12 5h-621q-7 0-12-5t-5-12v-109q0-7 5-12t12-5h621q7 0 12 5t5 12zM1024 91v109q0 7-5 12t-12 5h-987q-7 0-12-5t-5-12v-109q0-7 5-12t12-5h987q7 0 12 5t5 12z"
    },
    selectParentNode: {
      text: "\u2b1a",
      css: "font-weight: bold"
    },
    undo: {
      width: 1024,
      height: 1024,
      path: "M761 1024c113-206 132-520-313-509v253l-384-384 384-384v248c534-13 594 472 313 775z"
    },
    redo: {
      width: 1024,
      height: 1024,
      path: "M576 248v-248l384 384-384 384v-253c-446-10-427 303-313 509-280-303-221-789 313-775z"
    },
    strong: {
      width: 805,
      height: 1024,
      path: "M317 869q42 18 80 18 214 0 214-191 0-65-23-102-15-25-35-42t-38-26-46-14-48-6-54-1q-41 0-57 5 0 30-0 90t-0 90q0 4-0 38t-0 55 2 47 6 38zM309 442q24 4 62 4 46 0 81-7t62-25 42-51 14-81q0-40-16-70t-45-46-61-24-70-8q-28 0-74 7 0 28 2 86t2 86q0 15-0 45t-0 45q0 26 0 39zM0 950l1-53q8-2 48-9t60-15q4-6 7-15t4-19 3-18 1-21 0-19v-37q0-561-12-585-2-4-12-8t-25-6-28-4-27-2-17-1l-2-47q56-1 194-6t213-5q13 0 39 0t38 0q40 0 78 7t73 24 61 40 42 59 16 78q0 29-9 54t-22 41-36 32-41 25-48 22q88 20 146 76t58 141q0 57-20 102t-53 74-78 48-93 27-100 8q-25 0-75-1t-75-1q-60 0-175 6t-132 6z"
    },
    em: {
      width: 585,
      height: 1024,
      path: "M0 949l9-48q3-1 46-12t63-21q16-20 23-57 0-4 35-165t65-310 29-169v-14q-13-7-31-10t-39-4-33-3l10-58q18 1 68 3t85 4 68 1q27 0 56-1t69-4 56-3q-2 22-10 50-17 5-58 16t-62 19q-4 10-8 24t-5 22-4 26-3 24q-15 84-50 239t-44 203q-1 5-7 33t-11 51-9 47-3 32l0 10q9 2 105 17-1 25-9 56-6 0-18 0t-18 0q-16 0-49-5t-49-5q-78-1-117-1-29 0-81 5t-69 6z"
    },
    code: {
      width: 896,
      height: 1024,
      path: "M608 192l-96 96 224 224-224 224 96 96 288-320-288-320zM288 192l-288 320 288 320 96-96-224-224 224-224-96-96z"
    },
    link: {
      width: 951,
      height: 1024,
      path: "M832 694q0-22-16-38l-118-118q-16-16-38-16-24 0-41 18 1 1 10 10t12 12 8 10 7 14 2 15q0 22-16 38t-38 16q-8 0-15-2t-14-7-10-8-12-12-10-10q-18 17-18 41 0 22 16 38l117 118q15 15 38 15 22 0 38-14l84-83q16-16 16-38zM430 292q0-22-16-38l-117-118q-16-16-38-16-22 0-38 15l-84 83q-16 16-16 38 0 22 16 38l118 118q15 15 38 15 24 0 41-17-1-1-10-10t-12-12-8-10-7-14-2-15q0-22 16-38t38-16q8 0 15 2t14 7 10 8 12 12 10 10q18-17 18-41zM941 694q0 68-48 116l-84 83q-47 47-116 47-69 0-116-48l-117-118q-47-47-47-116 0-70 50-119l-50-50q-49 50-118 50-68 0-116-48l-118-118q-48-48-48-116t48-116l84-83q47-47 116-47 69 0 116 48l117 118q47 47 47 116 0 70-50 119l50 50q49-50 118-50 68 0 116 48l118 118q48 48 48 116z"
    },
    bulletList: {
      width: 768,
      height: 896,
      path: "M0 512h128v-128h-128v128zM0 256h128v-128h-128v128zM0 768h128v-128h-128v128zM256 512h512v-128h-512v128zM256 256h512v-128h-512v128zM256 768h512v-128h-512v128z"
    },
    orderedList: {
      width: 768,
      height: 896,
      path: "M320 512h448v-128h-448v128zM320 768h448v-128h-448v128zM320 128v128h448v-128h-448zM79 384h78v-256h-36l-85 23v50l43-2v185zM189 590c0-36-12-78-96-78-33 0-64 6-83 16l1 66c21-10 42-15 67-15s32 11 32 28c0 26-30 58-110 112v50h192v-67l-91 2c49-30 87-66 87-113l1-1z"
    },
    blockquote: {
      width: 640,
      height: 896,
      path: "M0 448v256h256v-256h-128c0 0 0-128 128-128v-128c0 0-256 0-256 256zM640 320v-128c0 0-256 0-256 256v256h256v-256h-128c0 0 0-128 128-128z"
    }
  }; // :: MenuItem
  // Menu item for the `joinUp` command.

  var joinUpItem = new MenuItem({
    title: "Join with above block",
    run: joinUp,
    select: function (state) {
      return joinUp(state);
    },
    icon: icons.join
  }); // :: MenuItem
  // Menu item for the `lift` command.

  var liftItem = new MenuItem({
    title: "Lift out of enclosing block",
    run: lift,
    select: function (state) {
      return lift(state);
    },
    icon: icons.lift
  }); // :: MenuItem
  // Menu item for the `selectParentNode` command.

  var selectParentNodeItem = new MenuItem({
    title: "Select parent node",
    run: selectParentNode,
    select: function (state) {
      return selectParentNode(state);
    },
    icon: icons.selectParentNode
  }); // :: MenuItem
  // Menu item for the `undo` command.

  var undoItem = new MenuItem({
    title: "Undo last change",
    run: undo,
    enable: function (state) {
      return undo(state);
    },
    icon: icons.undo
  }); // :: MenuItem
  // Menu item for the `redo` command.

  var redoItem = new MenuItem({
    title: "Redo last undone change",
    run: redo,
    enable: function (state) {
      return redo(state);
    },
    icon: icons.redo
  }); // :: (NodeType, Object) → MenuItem
  // Build a menu item for wrapping the selection in a given node type.
  // Adds `run` and `select` properties to the ones present in
  // `options`. `options.attrs` may be an object or a function.

  function wrapItem(nodeType, options) {
    var passedOptions = {
      run: function run(state, dispatch) {
        // FIXME if (options.attrs instanceof Function) options.attrs(state, attrs => wrapIn(nodeType, attrs)(state))
        return wrapIn(nodeType, options.attrs)(state, dispatch);
      },
      select: function select(state) {
        return wrapIn(nodeType, options.attrs instanceof Function ? null : options.attrs)(state);
      }
    };

    for (var prop in options) {
      passedOptions[prop] = options[prop];
    }

    return new MenuItem(passedOptions);
  } // :: (NodeType, Object) → MenuItem
  // Build a menu item for changing the type of the textblock around the
  // selection to the given type. Provides `run`, `active`, and `select`
  // properties. Others must be given in `options`. `options.attrs` may
  // be an object to provide the attributes for the textblock node.


  function blockTypeItem(nodeType, options) {
    var command = setBlockType(nodeType, options.attrs);
    var passedOptions = {
      run: command,
      enable: function enable(state) {
        return command(state);
      },
      active: function active(state) {
        var ref = state.selection;
        var $from = ref.$from;
        var to = ref.to;
        var node = ref.node;

        if (node) {
          return node.hasMarkup(nodeType, options.attrs);
        }

        return to <= $from.end() && $from.parent.hasMarkup(nodeType, options.attrs);
      }
    };

    for (var prop in options) {
      passedOptions[prop] = options[prop];
    }

    return new MenuItem(passedOptions);
  } // Work around classList.toggle being broken in IE11


  function setClass(dom, cls, on) {
    if (on) {
      dom.classList.add(cls);
    } else {
      dom.classList.remove(cls);
    }
  }

  var prefix$2 = "ProseMirror-menubar";

  function isIOS() {
    if (typeof navigator == "undefined") {
      return false;
    }

    var agent = navigator.userAgent;
    return !/Edge\/\d/.test(agent) && /AppleWebKit/.test(agent) && /Mobile\/\w+/.test(agent);
  } // :: (Object) → Plugin
  // A plugin that will place a menu bar above the editor. Note that
  // this involves wrapping the editor in an additional `<div>`.
  //
  //   options::-
  //   Supports the following options:
  //
  //     content:: [[MenuElement]]
  //     Provides the content of the menu, as a nested array to be
  //     passed to `renderGrouped`.
  //
  //     floating:: ?bool
  //     Determines whether the menu floats, i.e. whether it sticks to
  //     the top of the viewport when the editor is partially scrolled
  //     out of view.


  function menuBar(options) {
    return new Plugin({
      view: function view(editorView) {
        return new MenuBarView(editorView, options);
      }
    });
  }

  var MenuBarView = function MenuBarView(editorView, options) {
    var this$1 = this;
    this.editorView = editorView;
    this.options = options;
    this.wrapper = crel("div", {
      class: prefix$2 + "-wrapper"
    });
    this.menu = this.wrapper.appendChild(crel("div", {
      class: prefix$2
    }));
    this.menu.className = prefix$2;
    this.spacer = null;
    editorView.dom.parentNode.replaceChild(this.wrapper, editorView.dom);
    this.wrapper.appendChild(editorView.dom);
    this.maxHeight = 0;
    this.widthForMaxHeight = 0;
    this.floating = false;
    var ref = renderGrouped(this.editorView, this.options.content);
    var dom = ref.dom;
    var update = ref.update;
    this.contentUpdate = update;
    this.menu.appendChild(dom);
    this.update();

    if (options.floating && !isIOS()) {
      this.updateFloat();
      var potentialScrollers = getAllWrapping(this.wrapper);

      this.scrollFunc = function (e) {
        var root = this$1.editorView.root;

        if (!(root.body || root).contains(this$1.wrapper)) {
          potentialScrollers.forEach(function (el) {
            return el.removeEventListener("scroll", this$1.scrollFunc);
          });
        } else {
          this$1.updateFloat(e.target.getBoundingClientRect && e.target);
        }
      };

      potentialScrollers.forEach(function (el) {
        return el.addEventListener('scroll', this$1.scrollFunc);
      });
    }
  };

  MenuBarView.prototype.update = function update() {
    this.contentUpdate(this.editorView.state);

    if (this.floating) {
      this.updateScrollCursor();
    } else {
      if (this.menu.offsetWidth != this.widthForMaxHeight) {
        this.widthForMaxHeight = this.menu.offsetWidth;
        this.maxHeight = 0;
      }

      if (this.menu.offsetHeight > this.maxHeight) {
        this.maxHeight = this.menu.offsetHeight;
        this.menu.style.minHeight = this.maxHeight + "px";
      }
    }
  };

  MenuBarView.prototype.updateScrollCursor = function updateScrollCursor() {
    var selection = this.editorView.root.getSelection();

    if (!selection.focusNode) {
      return;
    }

    var rects = selection.getRangeAt(0).getClientRects();
    var selRect = rects[selectionIsInverted(selection) ? 0 : rects.length - 1];

    if (!selRect) {
      return;
    }

    var menuRect = this.menu.getBoundingClientRect();

    if (selRect.top < menuRect.bottom && selRect.bottom > menuRect.top) {
      var scrollable = findWrappingScrollable(this.wrapper);

      if (scrollable) {
        scrollable.scrollTop -= menuRect.bottom - selRect.top;
      }
    }
  };

  MenuBarView.prototype.updateFloat = function updateFloat(scrollAncestor) {
    var parent = this.wrapper,
        editorRect = parent.getBoundingClientRect(),
        top = scrollAncestor ? Math.max(0, scrollAncestor.getBoundingClientRect().top) : 0;

    if (this.floating) {
      if (editorRect.top >= top || editorRect.bottom < this.menu.offsetHeight + 10) {
        this.floating = false;
        this.menu.style.position = this.menu.style.left = this.menu.style.top = this.menu.style.width = "";
        this.menu.style.display = "";
        this.spacer.parentNode.removeChild(this.spacer);
        this.spacer = null;
      } else {
        var border = (parent.offsetWidth - parent.clientWidth) / 2;
        this.menu.style.left = editorRect.left + border + "px";
        this.menu.style.display = editorRect.top > window.innerHeight ? "none" : "";

        if (scrollAncestor) {
          this.menu.style.top = top + "px";
        }
      }
    } else {
      if (editorRect.top < top && editorRect.bottom >= this.menu.offsetHeight + 10) {
        this.floating = true;
        var menuRect = this.menu.getBoundingClientRect();
        this.menu.style.left = menuRect.left + "px";
        this.menu.style.width = menuRect.width + "px";

        if (scrollAncestor) {
          this.menu.style.top = top + "px";
        }

        this.menu.style.position = "fixed";
        this.spacer = crel("div", {
          class: prefix$2 + "-spacer",
          style: "height: " + menuRect.height + "px"
        });
        parent.insertBefore(this.spacer, this.menu);
      }
    }
  };

  MenuBarView.prototype.destroy = function destroy() {
    if (this.wrapper.parentNode) {
      this.wrapper.parentNode.replaceChild(this.editorView.dom, this.wrapper);
    }
  }; // Not precise, but close enough


  function selectionIsInverted(selection) {
    if (selection.anchorNode == selection.focusNode) {
      return selection.anchorOffset > selection.focusOffset;
    }

    return selection.anchorNode.compareDocumentPosition(selection.focusNode) == Node.DOCUMENT_POSITION_FOLLOWING;
  }

  function findWrappingScrollable(node) {
    for (var cur = node.parentNode; cur; cur = cur.parentNode) {
      if (cur.scrollHeight > cur.clientHeight) {
        return cur;
      }
    }
  }

  function getAllWrapping(node) {
    var res = [window];

    for (var cur = node.parentNode; cur; cur = cur.parentNode) {
      res.push(cur);
    }

    return res;
  }

  // Returns a command function that wraps the selection in a list with
  // the given type an attributes. If `dispatch` is null, only return a
  // value to indicate whether this is possible, but don't actually
  // perform the change.


  function wrapInList(listType, attrs) {
    return function (state, dispatch) {
      var ref = state.selection;
      var $from = ref.$from;
      var $to = ref.$to;
      var range = $from.blockRange($to),
          doJoin = false,
          outerRange = range;

      if (!range) {
        return false;
      } // This is at the top of an existing list item


      if (range.depth >= 2 && $from.node(range.depth - 1).type.compatibleContent(listType) && range.startIndex == 0) {
        // Don't do anything if this is the top of the list
        if ($from.index(range.depth - 1) == 0) {
          return false;
        }

        var $insert = state.doc.resolve(range.start - 2);
        outerRange = new NodeRange($insert, $insert, range.depth);

        if (range.endIndex < range.parent.childCount) {
          range = new NodeRange($from, state.doc.resolve($to.end(range.depth)), range.depth);
        }

        doJoin = true;
      }

      var wrap = findWrapping(outerRange, listType, attrs, range);

      if (!wrap) {
        return false;
      }

      if (dispatch) {
        dispatch(doWrapInList(state.tr, range, wrap, doJoin, listType).scrollIntoView());
      }

      return true;
    };
  }

  function doWrapInList(tr, range, wrappers, joinBefore, listType) {
    var content = Fragment.empty;

    for (var i = wrappers.length - 1; i >= 0; i--) {
      content = Fragment.from(wrappers[i].type.create(wrappers[i].attrs, content));
    }

    tr.step(new ReplaceAroundStep(range.start - (joinBefore ? 2 : 0), range.end, range.start, range.end, new Slice(content, 0, 0), wrappers.length, true));
    var found = 0;

    for (var i$1 = 0; i$1 < wrappers.length; i$1++) {
      if (wrappers[i$1].type == listType) {
        found = i$1 + 1;
      }
    }

    var splitDepth = wrappers.length - found;
    var splitPos = range.start + wrappers.length - (joinBefore ? 2 : 0),
        parent = range.parent;

    for (var i$2 = range.startIndex, e = range.endIndex, first = true; i$2 < e; i$2++, first = false) {
      if (!first && canSplit(tr.doc, splitPos, splitDepth)) {
        tr.split(splitPos, splitDepth);
        splitPos += 2 * splitDepth;
      }

      splitPos += parent.child(i$2).nodeSize;
    }

    return tr;
  } // :: (NodeType) → (state: EditorState, dispatch: ?(tr: Transaction)) → bool
  // Build a command that splits a non-empty textblock at the top level
  // of a list item by also splitting that list item.


  function splitListItem(itemType) {
    return function (state, dispatch) {
      var ref = state.selection;
      var $from = ref.$from;
      var $to = ref.$to;
      var node = ref.node;

      if (node && node.isBlock || $from.depth < 2 || !$from.sameParent($to)) {
        return false;
      }

      var grandParent = $from.node(-1);

      if (grandParent.type != itemType) {
        return false;
      }

      if ($from.parent.content.size == 0) {
        // In an empty block. If this is a nested list, the wrapping
        // list item should be split. Otherwise, bail out and let next
        // command handle lifting.
        if ($from.depth == 2 || $from.node(-3).type != itemType || $from.index(-2) != $from.node(-2).childCount - 1) {
          return false;
        }

        if (dispatch) {
          var wrap = Fragment.empty,
              keepItem = $from.index(-1) > 0; // Build a fragment containing empty versions of the structure
          // from the outer list item to the parent node of the cursor

          for (var d = $from.depth - (keepItem ? 1 : 2); d >= $from.depth - 3; d--) {
            wrap = Fragment.from($from.node(d).copy(wrap));
          } // Add a second list item with an empty default start node


          wrap = wrap.append(Fragment.from(itemType.createAndFill()));
          var tr$1 = state.tr.replace($from.before(keepItem ? null : -1), $from.after(-3), new Slice(wrap, keepItem ? 3 : 2, 2));
          tr$1.setSelection(state.selection.constructor.near(tr$1.doc.resolve($from.pos + (keepItem ? 3 : 2))));
          dispatch(tr$1.scrollIntoView());
        }

        return true;
      }

      var nextType = $to.pos == $from.end() ? grandParent.contentMatchAt(0).defaultType : null;
      var tr = state.tr.delete($from.pos, $to.pos);
      var types = nextType && [null, {
        type: nextType
      }];

      if (!canSplit(tr.doc, $from.pos, 2, types)) {
        return false;
      }

      if (dispatch) {
        dispatch(tr.split($from.pos, 2, types).scrollIntoView());
      }

      return true;
    };
  } // :: (NodeType) → (state: EditorState, dispatch: ?(tr: Transaction)) → bool
  // Create a command to lift the list item around the selection up into
  // a wrapping list.


  function liftListItem(itemType) {
    return function (state, dispatch) {
      var ref = state.selection;
      var $from = ref.$from;
      var $to = ref.$to;
      var range = $from.blockRange($to, function (node) {
        return node.childCount && node.firstChild.type == itemType;
      });

      if (!range) {
        return false;
      }

      if (!dispatch) {
        return true;
      }

      if ($from.node(range.depth - 1).type == itemType) // Inside a parent list
        {
          return liftToOuterList(state, dispatch, itemType, range);
        } else // Outer list node
        {
          return liftOutOfList(state, dispatch, range);
        }
    };
  }

  function liftToOuterList(state, dispatch, itemType, range) {
    var tr = state.tr,
        end = range.end,
        endOfList = range.$to.end(range.depth);

    if (end < endOfList) {
      // There are siblings after the lifted items, which must become
      // children of the last item
      tr.step(new ReplaceAroundStep(end - 1, endOfList, end, endOfList, new Slice(Fragment.from(itemType.create(null, range.parent.copy())), 1, 0), 1, true));
      range = new NodeRange(tr.doc.resolve(range.$from.pos), tr.doc.resolve(endOfList), range.depth);
    }

    dispatch(tr.lift(range, liftTarget(range)).scrollIntoView());
    return true;
  }

  function liftOutOfList(state, dispatch, range) {
    var tr = state.tr,
        list = range.parent; // Merge the list items into a single big item

    for (var pos = range.end, i = range.endIndex - 1, e = range.startIndex; i > e; i--) {
      pos -= list.child(i).nodeSize;
      tr.delete(pos - 1, pos + 1);
    }

    var $start = tr.doc.resolve(range.start),
        item = $start.nodeAfter;
    var atStart = range.startIndex == 0,
        atEnd = range.endIndex == list.childCount;
    var parent = $start.node(-1),
        indexBefore = $start.index(-1);

    if (!parent.canReplace(indexBefore + (atStart ? 0 : 1), indexBefore + 1, item.content.append(atEnd ? Fragment.empty : Fragment.from(list)))) {
      return false;
    }

    var start = $start.pos,
        end = start + item.nodeSize; // Strip off the surrounding list. At the sides where we're not at
    // the end of the list, the existing list is closed. At sides where
    // this is the end, it is overwritten to its end.

    tr.step(new ReplaceAroundStep(start - (atStart ? 1 : 0), end + (atEnd ? 1 : 0), start + 1, end - 1, new Slice((atStart ? Fragment.empty : Fragment.from(list.copy(Fragment.empty))).append(atEnd ? Fragment.empty : Fragment.from(list.copy(Fragment.empty))), atStart ? 0 : 1, atEnd ? 0 : 1), atStart ? 0 : 1));
    dispatch(tr.scrollIntoView());
    return true;
  } // :: (NodeType) → (state: EditorState, dispatch: ?(tr: Transaction)) → bool
  // Create a command to sink the list item around the selection down
  // into an inner list.


  function sinkListItem(itemType) {
    return function (state, dispatch) {
      var ref = state.selection;
      var $from = ref.$from;
      var $to = ref.$to;
      var range = $from.blockRange($to, function (node) {
        return node.childCount && node.firstChild.type == itemType;
      });

      if (!range) {
        return false;
      }

      var startIndex = range.startIndex;

      if (startIndex == 0) {
        return false;
      }

      var parent = range.parent,
          nodeBefore = parent.child(startIndex - 1);

      if (nodeBefore.type != itemType) {
        return false;
      }

      if (dispatch) {
        var nestedBefore = nodeBefore.lastChild && nodeBefore.lastChild.type == parent.type;
        var inner = Fragment.from(nestedBefore ? itemType.create() : null);
        var slice = new Slice(Fragment.from(itemType.create(null, Fragment.from(parent.type.create(null, inner)))), nestedBefore ? 3 : 1, 0);
        var before = range.start,
            after = range.end;
        dispatch(state.tr.step(new ReplaceAroundStep(before - (nestedBefore ? 3 : 1), after, before, after, slice, 1, true)).scrollIntoView());
      }

      return true;
    };
  }

  // that, when typed, causes something to happen. This might be
  // changing two dashes into an emdash, wrapping a paragraph starting
  // with `"> "` into a blockquote, or something entirely different.

  var InputRule = function InputRule(match, handler) {
    this.match = match;
    this.handler = typeof handler == "string" ? stringHandler(handler) : handler;
  };

  function stringHandler(string) {
    return function (state, match, start, end) {
      var insert = string;

      if (match[1]) {
        var offset = match[0].lastIndexOf(match[1]);
        insert += match[0].slice(offset + match[1].length);
        start += offset;
        var cutOff = start - end;

        if (cutOff > 0) {
          insert = match[0].slice(offset - cutOff, offset) + insert;
          start = end;
        }
      }

      return state.tr.insertText(insert, start, end);
    };
  }

  var MAX_MATCH = 500; // :: (config: {rules: [InputRule]}) → Plugin
  // Create an input rules plugin. When enabled, it will cause text
  // input that matches any of the given rules to trigger the rule's
  // action.

  function inputRules(ref) {
    var rules = ref.rules;
    var plugin = new Plugin({
      state: {
        init: function init() {
          return null;
        },
        apply: function apply(tr, prev) {
          var stored = tr.getMeta(this);

          if (stored) {
            return stored;
          }

          return tr.selectionSet || tr.docChanged ? null : prev;
        }
      },
      props: {
        handleTextInput: function handleTextInput(view, from, to, text) {
          return run(view, from, to, text, rules, plugin);
        },
        handleDOMEvents: {
          compositionend: function (view) {
            setTimeout(function () {
              var ref = view.state.selection;
              var $cursor = ref.$cursor;

              if ($cursor) {
                run(view, $cursor.pos, $cursor.pos, "", rules, plugin);
              }
            });
          }
        }
      },
      isInputRules: true
    });
    return plugin;
  }

  function run(view, from, to, text, rules, plugin) {
    if (view.composing) {
      return false;
    }

    var state = view.state,
        $from = state.doc.resolve(from);

    if ($from.parent.type.spec.code) {
      return false;
    }

    var textBefore = $from.parent.textBetween(Math.max(0, $from.parentOffset - MAX_MATCH), $from.parentOffset, null, "\ufffc") + text;

    for (var i = 0; i < rules.length; i++) {
      var match = rules[i].match.exec(textBefore);
      var tr = match && rules[i].handler(state, match, from - (match[0].length - text.length), to);

      if (!tr) {
        continue;
      }

      view.dispatch(tr.setMeta(plugin, {
        transform: tr,
        from: from,
        to: to,
        text: text
      }));
      return true;
    }

    return false;
  } // :: (EditorState, ?(Transaction)) → bool
  // This is a command that will undo an input rule, if applying such a
  // rule was the last thing that the user did.


  function undoInputRule(state, dispatch) {
    var plugins = state.plugins;

    for (var i = 0; i < plugins.length; i++) {
      var plugin = plugins[i],
          undoable = void 0;

      if (plugin.spec.isInputRules && (undoable = plugin.getState(state))) {
        if (dispatch) {
          var tr = state.tr,
              toUndo = undoable.transform;

          for (var j = toUndo.steps.length - 1; j >= 0; j--) {
            tr.step(toUndo.steps[j].invert(toUndo.docs[j]));
          }

          var marks = tr.doc.resolve(undoable.from).marks();
          dispatch(tr.replaceWith(undoable.from, undoable.to, state.schema.text(undoable.text, marks)));
        }

        return true;
      }
    }

    return false;
  } // :: InputRule Converts double dashes to an emdash.


  var emDash = new InputRule(/--$/, "—"); // :: InputRule Converts three dots to an ellipsis character.

  var ellipsis = new InputRule(/\.\.\.$/, "…"); // :: InputRule “Smart” opening double quotes.

  var openDoubleQuote = new InputRule(/(?:^|[\s\{\[\(\<'"\u2018\u201C])(")$/, "“"); // :: InputRule “Smart” closing double quotes.

  var closeDoubleQuote = new InputRule(/"$/, "”"); // :: InputRule “Smart” opening single quotes.

  var openSingleQuote = new InputRule(/(?:^|[\s\{\[\(\<'"\u2018\u201C])(')$/, "‘"); // :: InputRule “Smart” closing single quotes.

  var closeSingleQuote = new InputRule(/'$/, "’"); // :: [InputRule] Smart-quote related input rules.

  var smartQuotes = [openDoubleQuote, closeDoubleQuote, openSingleQuote, closeSingleQuote]; // :: (RegExp, NodeType, ?union<Object, ([string]) → ?Object>, ?([string], Node) → bool) → InputRule
  // Build an input rule for automatically wrapping a textblock when a
  // given string is typed. The `regexp` argument is
  // directly passed through to the `InputRule` constructor. You'll
  // probably want the regexp to start with `^`, so that the pattern can
  // only occur at the start of a textblock.
  //
  // `nodeType` is the type of node to wrap in. If it needs attributes,
  // you can either pass them directly, or pass a function that will
  // compute them from the regular expression match.
  //
  // By default, if there's a node with the same type above the newly
  // wrapped node, the rule will try to [join](#transform.Transform.join) those
  // two nodes. You can pass a join predicate, which takes a regular
  // expression match and the node before the wrapped node, and can
  // return a boolean to indicate whether a join should happen.

  function wrappingInputRule(regexp, nodeType, getAttrs, joinPredicate) {
    return new InputRule(regexp, function (state, match, start, end) {
      var attrs = getAttrs instanceof Function ? getAttrs(match) : getAttrs;
      var tr = state.tr.delete(start, end);
      var $start = tr.doc.resolve(start),
          range = $start.blockRange(),
          wrapping = range && findWrapping(range, nodeType, attrs);

      if (!wrapping) {
        return null;
      }

      tr.wrap(range, wrapping);
      var before = tr.doc.resolve(start - 1).nodeBefore;

      if (before && before.type == nodeType && canJoin(tr.doc, start - 1) && (!joinPredicate || joinPredicate(match, before))) {
        tr.join(start - 1);
      }

      return tr;
    });
  } // :: (RegExp, NodeType, ?union<Object, ([string]) → ?Object>) → InputRule
  // Build an input rule that changes the type of a textblock when the
  // matched text is typed into it. You'll usually want to start your
  // regexp with `^` to that it is only matched at the start of a
  // textblock. The optional `getAttrs` parameter can be used to compute
  // the new node's attributes, and works the same as in the
  // `wrappingInputRule` function.


  function textblockTypeInputRule(regexp, nodeType, getAttrs) {
    return new InputRule(regexp, function (state, match, start, end) {
      var $start = state.doc.resolve(start);
      var attrs = getAttrs instanceof Function ? getAttrs(match) : getAttrs;

      if (!$start.node(-1).canReplaceWith($start.index(-1), $start.indexAfter(-1), nodeType)) {
        return null;
      }

      return state.tr.delete(start, end).setBlockType(start, start, nodeType, attrs);
    });
  }

  var prefix$3 = "ProseMirror-prompt";

  function openPrompt(options) {
    var wrapper = document.body.appendChild(document.createElement("div"));
    wrapper.className = prefix$3;

    var mouseOutside = function (e) {
      if (!wrapper.contains(e.target)) {
        close();
      }
    };

    setTimeout(function () {
      return window.addEventListener("mousedown", mouseOutside);
    }, 50);

    var close = function () {
      window.removeEventListener("mousedown", mouseOutside);

      if (wrapper.parentNode) {
        wrapper.parentNode.removeChild(wrapper);
      }
    };

    var domFields = [];

    for (var name in options.fields) {
      domFields.push(options.fields[name].render());
    }

    var submitButton = document.createElement("button");
    submitButton.type = "submit";
    submitButton.className = prefix$3 + "-submit";
    submitButton.textContent = "OK";
    var cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className = prefix$3 + "-cancel";
    cancelButton.textContent = "Cancel";
    cancelButton.addEventListener("click", close);
    var form = wrapper.appendChild(document.createElement("form"));

    if (options.title) {
      form.appendChild(document.createElement("h5")).textContent = options.title;
    }

    domFields.forEach(function (field) {
      form.appendChild(document.createElement("div")).appendChild(field);
    });
    var buttons = form.appendChild(document.createElement("div"));
    buttons.className = prefix$3 + "-buttons";
    buttons.appendChild(submitButton);
    buttons.appendChild(document.createTextNode(" "));
    buttons.appendChild(cancelButton);
    var box = wrapper.getBoundingClientRect();
    wrapper.style.top = (window.innerHeight - box.height) / 2 + "px";
    wrapper.style.left = (window.innerWidth - box.width) / 2 + "px";

    var submit = function () {
      var params = getValues(options.fields, domFields);

      if (params) {
        close();
        options.callback(params);
      }
    };

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      submit();
    });
    form.addEventListener("keydown", function (e) {
      if (e.keyCode == 27) {
        e.preventDefault();
        close();
      } else if (e.keyCode == 13 && !(e.ctrlKey || e.metaKey || e.shiftKey)) {
        e.preventDefault();
        submit();
      } else if (e.keyCode == 9) {
        window.setTimeout(function () {
          if (!wrapper.contains(document.activeElement)) {
            close();
          }
        }, 500);
      }
    });
    var input = form.elements[0];

    if (input) {
      input.focus();
    }
  }

  function getValues(fields, domFields) {
    var result = Object.create(null),
        i = 0;

    for (var name in fields) {
      var field = fields[name],
          dom = domFields[i++];
      var value = field.read(dom),
          bad = field.validate(value);

      if (bad) {
        reportInvalid(dom, bad);
        return null;
      }

      result[name] = field.clean(value);
    }

    return result;
  }

  function reportInvalid(dom, message) {
    // FIXME this is awful and needs a lot more work
    var parent = dom.parentNode;
    var msg = parent.appendChild(document.createElement("div"));
    msg.style.left = dom.offsetLeft + dom.offsetWidth + 2 + "px";
    msg.style.top = dom.offsetTop - 5 + "px";
    msg.className = "ProseMirror-invalid";
    msg.textContent = message;
    setTimeout(function () {
      return parent.removeChild(msg);
    }, 1500);
  } // ::- The type of field that `FieldPrompt` expects to be passed to it.


  var Field = function Field(options) {
    this.options = options;
  }; // render:: (state: EditorState, props: Object) → dom.Node
  // Render the field to the DOM. Should be implemented by all subclasses.
  // :: (dom.Node) → any
  // Read the field's value from its DOM node.


  Field.prototype.read = function read(dom) {
    return dom.value;
  }; // :: (any) → ?string
  // A field-type-specific validation function.


  Field.prototype.validateType = function validateType(_value) {};

  Field.prototype.validate = function validate(value) {
    if (!value && this.options.required) {
      return "Required field";
    }

    return this.validateType(value) || this.options.validate && this.options.validate(value);
  };

  Field.prototype.clean = function clean(value) {
    return this.options.clean ? this.options.clean(value) : value;
  }; // ::- A field class for single-line text fields.


  var TextField =
  /*@__PURE__*/
  function (Field) {
    function TextField() {
      Field.apply(this, arguments);
    }

    if (Field) TextField.__proto__ = Field;
    TextField.prototype = Object.create(Field && Field.prototype);
    TextField.prototype.constructor = TextField;

    TextField.prototype.render = function render() {
      var input = document.createElement("input");
      input.type = "text";
      input.placeholder = this.options.label;
      input.value = this.options.value || "";
      input.autocomplete = "off";
      return input;
    };

    return TextField;
  }(Field); // Helpers to create specific types of items


  function canInsert(state, nodeType) {
    var $from = state.selection.$from;

    for (var d = $from.depth; d >= 0; d--) {
      var index = $from.index(d);

      if ($from.node(d).canReplaceWith(index, index, nodeType)) {
        return true;
      }
    }

    return false;
  }

  function insertImageItem(nodeType) {
    return new MenuItem({
      title: "Insert image",
      label: "Image",
      enable: function enable(state) {
        return canInsert(state, nodeType);
      },
      run: function run(state, _, view) {
        var ref = state.selection;
        var from = ref.from;
        var to = ref.to;
        var attrs = null;

        if (state.selection instanceof NodeSelection && state.selection.node.type == nodeType) {
          attrs = state.selection.node.attrs;
        }

        openPrompt({
          title: "Insert image",
          fields: {
            src: new TextField({
              label: "Location",
              required: true,
              value: attrs && attrs.src
            }),
            title: new TextField({
              label: "Title",
              value: attrs && attrs.title
            }),
            alt: new TextField({
              label: "Description",
              value: attrs ? attrs.alt : state.doc.textBetween(from, to, " ")
            })
          },
          callback: function callback(attrs) {
            view.dispatch(view.state.tr.replaceSelectionWith(nodeType.createAndFill(attrs)));
            view.focus();
          }
        });
      }
    });
  }

  function cmdItem(cmd, options) {
    var passedOptions = {
      label: options.title,
      run: cmd
    };

    for (var prop in options) {
      passedOptions[prop] = options[prop];
    }

    if ((!options.enable || options.enable === true) && !options.select) {
      passedOptions[options.enable ? "enable" : "select"] = function (state) {
        return cmd(state);
      };
    }

    return new MenuItem(passedOptions);
  }

  function markActive(state, type) {
    var ref = state.selection;
    var from = ref.from;
    var $from = ref.$from;
    var to = ref.to;
    var empty = ref.empty;

    if (empty) {
      return type.isInSet(state.storedMarks || $from.marks());
    } else {
      return state.doc.rangeHasMark(from, to, type);
    }
  }

  function markItem(markType, options) {
    var passedOptions = {
      active: function active(state) {
        return markActive(state, markType);
      },
      enable: true
    };

    for (var prop in options) {
      passedOptions[prop] = options[prop];
    }

    return cmdItem(toggleMark(markType), passedOptions);
  }

  function linkItem(markType) {
    return new MenuItem({
      title: "Add or remove link",
      icon: icons.link,
      active: function active(state) {
        return markActive(state, markType);
      },
      enable: function enable(state) {
        return !state.selection.empty;
      },
      run: function run(state, dispatch, view) {
        if (markActive(state, markType)) {
          toggleMark(markType)(state, dispatch);
          return true;
        }

        openPrompt({
          title: "Create a link",
          fields: {
            href: new TextField({
              label: "Link target",
              required: true
            }),
            title: new TextField({
              label: "Title"
            })
          },
          callback: function callback(attrs) {
            toggleMark(markType, attrs)(view.state, view.dispatch);
            view.focus();
          }
        });
      }
    });
  }

  function wrapListItem(nodeType, options) {
    return cmdItem(wrapInList(nodeType, options.attrs), options);
  } // :: (Schema) → Object
  // Given a schema, look for default mark and node types in it and
  // return an object with relevant menu items relating to those marks:
  //
  // **`toggleStrong`**`: MenuItem`
  //   : A menu item to toggle the [strong mark](#schema-basic.StrongMark).
  //
  // **`toggleEm`**`: MenuItem`
  //   : A menu item to toggle the [emphasis mark](#schema-basic.EmMark).
  //
  // **`toggleCode`**`: MenuItem`
  //   : A menu item to toggle the [code font mark](#schema-basic.CodeMark).
  //
  // **`toggleLink`**`: MenuItem`
  //   : A menu item to toggle the [link mark](#schema-basic.LinkMark).
  //
  // **`insertImage`**`: MenuItem`
  //   : A menu item to insert an [image](#schema-basic.Image).
  //
  // **`wrapBulletList`**`: MenuItem`
  //   : A menu item to wrap the selection in a [bullet list](#schema-list.BulletList).
  //
  // **`wrapOrderedList`**`: MenuItem`
  //   : A menu item to wrap the selection in an [ordered list](#schema-list.OrderedList).
  //
  // **`wrapBlockQuote`**`: MenuItem`
  //   : A menu item to wrap the selection in a [block quote](#schema-basic.BlockQuote).
  //
  // **`makeParagraph`**`: MenuItem`
  //   : A menu item to set the current textblock to be a normal
  //     [paragraph](#schema-basic.Paragraph).
  //
  // **`makeCodeBlock`**`: MenuItem`
  //   : A menu item to set the current textblock to be a
  //     [code block](#schema-basic.CodeBlock).
  //
  // **`makeHead[N]`**`: MenuItem`
  //   : Where _N_ is 1 to 6. Menu items to set the current textblock to
  //     be a [heading](#schema-basic.Heading) of level _N_.
  //
  // **`insertHorizontalRule`**`: MenuItem`
  //   : A menu item to insert a horizontal rule.
  //
  // The return value also contains some prefabricated menu elements and
  // menus, that you can use instead of composing your own menu from
  // scratch:
  //
  // **`insertMenu`**`: Dropdown`
  //   : A dropdown containing the `insertImage` and
  //     `insertHorizontalRule` items.
  //
  // **`typeMenu`**`: Dropdown`
  //   : A dropdown containing the items for making the current
  //     textblock a paragraph, code block, or heading.
  //
  // **`fullMenu`**`: [[MenuElement]]`
  //   : An array of arrays of menu elements for use as the full menu
  //     for, for example the [menu bar](https://github.com/prosemirror/prosemirror-menu#user-content-menubar).


  function buildMenuItems(schema) {
    var r = {},
        type;

    if (type = schema.marks.strong) {
      r.toggleStrong = markItem(type, {
        title: "Toggle strong style",
        icon: icons.strong
      });
    }

    if (type = schema.marks.em) {
      r.toggleEm = markItem(type, {
        title: "Toggle emphasis",
        icon: icons.em
      });
    }

    if (type = schema.marks.code) {
      r.toggleCode = markItem(type, {
        title: "Toggle code font",
        icon: icons.code
      });
    }

    if (type = schema.marks.link) {
      r.toggleLink = linkItem(type);
    }

    if (type = schema.nodes.image) {
      r.insertImage = insertImageItem(type);
    }

    if (type = schema.nodes.bullet_list) {
      r.wrapBulletList = wrapListItem(type, {
        title: "Wrap in bullet list",
        icon: icons.bulletList
      });
    }

    if (type = schema.nodes.ordered_list) {
      r.wrapOrderedList = wrapListItem(type, {
        title: "Wrap in ordered list",
        icon: icons.orderedList
      });
    }

    if (type = schema.nodes.blockquote) {
      r.wrapBlockQuote = wrapItem(type, {
        title: "Wrap in block quote",
        icon: icons.blockquote
      });
    }

    if (type = schema.nodes.paragraph) {
      r.makeParagraph = blockTypeItem(type, {
        title: "Change to paragraph",
        label: "Plain"
      });
    }

    if (type = schema.nodes.code_block) {
      r.makeCodeBlock = blockTypeItem(type, {
        title: "Change to code block",
        label: "Code"
      });
    }

    if (type = schema.nodes.heading) {
      for (var i = 1; i <= 10; i++) {
        r["makeHead" + i] = blockTypeItem(type, {
          title: "Change to heading " + i,
          label: "Level " + i,
          attrs: {
            level: i
          }
        });
      }
    }

    if (type = schema.nodes.horizontal_rule) {
      var hr = type;
      r.insertHorizontalRule = new MenuItem({
        title: "Insert horizontal rule",
        label: "Horizontal rule",
        enable: function enable(state) {
          return canInsert(state, hr);
        },
        run: function run(state, dispatch) {
          dispatch(state.tr.replaceSelectionWith(hr.create()));
        }
      });
    }

    var cut = function (arr) {
      return arr.filter(function (x) {
        return x;
      });
    };

    r.insertMenu = new Dropdown(cut([r.insertImage, r.insertHorizontalRule]), {
      label: "Insert"
    });
    r.typeMenu = new Dropdown(cut([r.makeParagraph, r.makeCodeBlock, r.makeHead1 && new DropdownSubmenu(cut([r.makeHead1, r.makeHead2, r.makeHead3, r.makeHead4, r.makeHead5, r.makeHead6]), {
      label: "Heading"
    })]), {
      label: "Type..."
    });
    r.inlineMenu = [cut([r.toggleStrong, r.toggleEm, r.toggleCode, r.toggleLink])];
    r.blockMenu = [cut([r.wrapBulletList, r.wrapOrderedList, r.wrapBlockQuote, joinUpItem, liftItem, selectParentNodeItem])];
    r.fullMenu = r.inlineMenu.concat([[r.insertMenu, r.typeMenu]], [[undoItem, redoItem]], r.blockMenu);
    return r;
  }

  var mac$3 = typeof navigator != "undefined" ? /Mac/.test(navigator.platform) : false; // :: (Schema, ?Object) → Object
  // Inspect the given schema looking for marks and nodes from the
  // basic schema, and if found, add key bindings related to them.
  // This will add:
  //
  // * **Mod-b** for toggling [strong](#schema-basic.StrongMark)
  // * **Mod-i** for toggling [emphasis](#schema-basic.EmMark)
  // * **Mod-`** for toggling [code font](#schema-basic.CodeMark)
  // * **Ctrl-Shift-0** for making the current textblock a paragraph
  // * **Ctrl-Shift-1** to **Ctrl-Shift-Digit6** for making the current
  //   textblock a heading of the corresponding level
  // * **Ctrl-Shift-Backslash** to make the current textblock a code block
  // * **Ctrl-Shift-8** to wrap the selection in an ordered list
  // * **Ctrl-Shift-9** to wrap the selection in a bullet list
  // * **Ctrl->** to wrap the selection in a block quote
  // * **Enter** to split a non-empty textblock in a list item while at
  //   the same time splitting the list item
  // * **Mod-Enter** to insert a hard break
  // * **Mod-_** to insert a horizontal rule
  // * **Backspace** to undo an input rule
  // * **Alt-ArrowUp** to `joinUp`
  // * **Alt-ArrowDown** to `joinDown`
  // * **Mod-BracketLeft** to `lift`
  // * **Escape** to `selectParentNode`
  //
  // You can suppress or map these bindings by passing a `mapKeys`
  // argument, which maps key names (say `"Mod-B"` to either `false`, to
  // remove the binding, or a new key name string.

  function buildKeymap(schema, mapKeys) {
    var keys = {},
        type;

    function bind(key, cmd) {
      if (mapKeys) {
        var mapped = mapKeys[key];

        if (mapped === false) {
          return;
        }

        if (mapped) {
          key = mapped;
        }
      }

      keys[key] = cmd;
    }

    bind("Mod-z", undo);
    bind("Shift-Mod-z", redo);
    bind("Backspace", undoInputRule);

    if (!mac$3) {
      bind("Mod-y", redo);
    }

    bind("Alt-ArrowUp", joinUp);
    bind("Alt-ArrowDown", joinDown);
    bind("Mod-BracketLeft", lift);
    bind("Escape", selectParentNode);

    if (type = schema.marks.strong) {
      bind("Mod-b", toggleMark(type));
      bind("Mod-B", toggleMark(type));
    }

    if (type = schema.marks.em) {
      bind("Mod-i", toggleMark(type));
      bind("Mod-I", toggleMark(type));
    }

    if (type = schema.marks.code) {
      bind("Mod-`", toggleMark(type));
    }

    if (type = schema.nodes.bullet_list) {
      bind("Shift-Ctrl-8", wrapInList(type));
    }

    if (type = schema.nodes.ordered_list) {
      bind("Shift-Ctrl-9", wrapInList(type));
    }

    if (type = schema.nodes.blockquote) {
      bind("Ctrl->", wrapIn(type));
    }

    if (type = schema.nodes.hard_break) {
      var br = type,
          cmd = chainCommands(exitCode, function (state, dispatch) {
        dispatch(state.tr.replaceSelectionWith(br.create()).scrollIntoView());
        return true;
      });
      bind("Mod-Enter", cmd);
      bind("Shift-Enter", cmd);

      if (mac$3) {
        bind("Ctrl-Enter", cmd);
      }
    }

    if (type = schema.nodes.list_item) {
      bind("Enter", splitListItem(type));
      bind("Mod-[", liftListItem(type));
      bind("Mod-]", sinkListItem(type));
    }

    if (type = schema.nodes.paragraph) {
      bind("Shift-Ctrl-0", setBlockType(type));
    }

    if (type = schema.nodes.code_block) {
      bind("Shift-Ctrl-\\", setBlockType(type));
    }

    if (type = schema.nodes.heading) {
      for (var i = 1; i <= 6; i++) {
        bind("Shift-Ctrl-" + i, setBlockType(type, {
          level: i
        }));
      }
    }

    if (type = schema.nodes.horizontal_rule) {
      var hr = type;
      bind("Mod-_", function (state, dispatch) {
        dispatch(state.tr.replaceSelectionWith(hr.create()).scrollIntoView());
        return true;
      });
    }

    return keys;
  } // : (NodeType) → InputRule
  // Given a blockquote node type, returns an input rule that turns `"> "`
  // at the start of a textblock into a blockquote.


  function blockQuoteRule(nodeType) {
    return wrappingInputRule(/^\s*>\s$/, nodeType);
  } // : (NodeType) → InputRule
  // Given a list node type, returns an input rule that turns a number
  // followed by a dot at the start of a textblock into an ordered list.


  function orderedListRule(nodeType) {
    return wrappingInputRule(/^(\d+)\.\s$/, nodeType, function (match) {
      return {
        order: +match[1]
      };
    }, function (match, node) {
      return node.childCount + node.attrs.order == +match[1];
    });
  } // : (NodeType) → InputRule
  // Given a list node type, returns an input rule that turns a bullet
  // (dash, plush, or asterisk) at the start of a textblock into a
  // bullet list.


  function bulletListRule(nodeType) {
    return wrappingInputRule(/^\s*([-+*])\s$/, nodeType);
  } // : (NodeType) → InputRule
  // Given a code block node type, returns an input rule that turns a
  // textblock starting with three backticks into a code block.


  function codeBlockRule(nodeType) {
    return textblockTypeInputRule(/^```$/, nodeType);
  } // : (NodeType, number) → InputRule
  // Given a node type and a maximum level, creates an input rule that
  // turns up to that number of `#` characters followed by a space at
  // the start of a textblock into a heading whose level corresponds to
  // the number of `#` signs.


  function headingRule(nodeType, maxLevel) {
    return textblockTypeInputRule(new RegExp("^(#{1," + maxLevel + "})\\s$"), nodeType, function (match) {
      return {
        level: match[1].length
      };
    });
  } // : (Schema) → Plugin
  // A set of input rules for creating the basic block quotes, lists,
  // code blocks, and heading.


  function buildInputRules(schema) {
    var rules = smartQuotes.concat(ellipsis, emDash),
        type;

    if (type = schema.nodes.blockquote) {
      rules.push(blockQuoteRule(type));
    }

    if (type = schema.nodes.ordered_list) {
      rules.push(orderedListRule(type));
    }

    if (type = schema.nodes.bullet_list) {
      rules.push(bulletListRule(type));
    }

    if (type = schema.nodes.code_block) {
      rules.push(codeBlockRule(type));
    }

    if (type = schema.nodes.heading) {
      rules.push(headingRule(type, 6));
    }

    return inputRules({
      rules: rules
    });
  } // !! This module exports helper functions for deriving a set of basic
  // menu items, input rules, or key bindings from a schema. These
  // values need to know about the schema for two reasons—they need
  // access to specific instances of node and mark types, and they need
  // to know which of the node and mark types that they know about are
  // actually present in the schema.
  //
  // The `exampleSetup` plugin ties these together into a plugin that
  // will automatically enable this basic functionality in an editor.
  // :: (Object) → [Plugin]
  // A convenience plugin that bundles together a simple menu with basic
  // key bindings, input rules, and styling for the example schema.
  // Probably only useful for quickly setting up a passable
  // editor—you'll need more control over your settings in most
  // real-world situations.
  //
  //   options::- The following options are recognized:
  //
  //     schema:: Schema
  //     The schema to generate key bindings and menu items for.
  //
  //     mapKeys:: ?Object
  //     Can be used to [adjust](#example-setup.buildKeymap) the key bindings created.
  //
  //     menuBar:: ?bool
  //     Set to false to disable the menu bar.
  //
  //     history:: ?bool
  //     Set to false to disable the history plugin.
  //
  //     floatingMenu:: ?bool
  //     Set to false to make the menu bar non-floating.
  //
  //     menuContent:: [[MenuItem]]
  //     Can be used to override the menu content.


  function exampleSetup(options) {
    var plugins = [buildInputRules(options.schema), keymap(buildKeymap(options.schema, options.mapKeys)), keymap(baseKeymap), dropCursor(), gapCursor()];

    if (options.menuBar !== false) {
      plugins.push(menuBar({
        floating: options.floatingMenu !== false,
        content: options.menuContent || buildMenuItems(options.schema).fullMenu
      }));
    }

    if (options.history !== false) {
      plugins.push(history());
    }

    return plugins.concat(new Plugin({
      props: {
        attributes: {
          class: "ProseMirror-example-setup-style"
        }
      }
    }));
  }

  exports.EditorState = EditorState;
  exports.EditorView = EditorView;
  exports.defaultMarkdownParser = defaultMarkdownParser;
  exports.defaultMarkdownSerializer = defaultMarkdownSerializer;
  exports.exampleSetup = exampleSetup;
  exports.schema = schema;

  return exports;

}({}));
