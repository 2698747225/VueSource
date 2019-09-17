/* @flow */

import {
  _Set as Set,
  isObject
} from '../util/index'
import type {
  SimpleSet
} from '../util/index'
import VNode from '../vdom/vnode'

const seenObjects = new Set()

/**
 * Recursively traverse an object to evoke all converted
 * getters, so that every nested property inside the object
 * is collected as a "deep" dependency.
 */
export function traverse(val: any) {
  _traverse(val, seenObjects)
  seenObjects.clear()
}

function _traverse(val: any, seen: SimpleSet) {
  let i, keys
  const isA = Array.isArray(val)
  // 除去了简单类型、冷冻对象类型、VNode节点类型
  if ((!isA && !isObject(val)) || Object.isFrozen(val) || val instanceof VNode) {
    return
  }

  // 存在__ob__说明这个属性是vm.$data下的响应式数据
  if (val.__ob__) {
    const depId = val.__ob__.dep.id
    if (seen.has(depId)) {
      return
    }
    // set集合保存这个响应式数据的dep收集watcherId
    seen.add(depId)
  }
  if (isA) {
    i = val.length
    // 数组类型递归所有值
    while (i--) _traverse(val[i], seen)
  } else {
    // 对象类型递归所有属性值
    keys = Object.keys(val)
    i = keys.length
    while (i--) _traverse(val[keys[i]], seen)
  }
}