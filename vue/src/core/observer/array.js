/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */

import {
  def
} from '../util/index'

const arrayProto = Array.prototype
export const arrayMethods = Object.create(arrayProto)

// 数组方法的劫持类型
const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]

/**
 * Intercept mutating methods and emit events
 */
methodsToPatch.forEach(function (method) {
  // cache original method
  // 保存数组原生方法
  const original = arrayProto[method]
  // 这里的mutator方法相当于是原生方法的值，参数也就是调用传递的参数
  def(arrayMethods, method, function mutator(...args) {
    // 执行原生方法
    const result = original.apply(this, args)
    // 获取数组对象的观察者
    const ob = this.__ob__
    let inserted
    switch (method) {
      case 'push':
      case 'unshift':
        inserted = args
        break
      case 'splice':
        inserted = args.slice(2)
        break
    }
    // 修改过数组数据后，给新的value值添加observer
    if (inserted) ob.observeArray(inserted)
    // notify change
    // 通知watcher更新
    ob.dep.notify()
    return result
  })
})