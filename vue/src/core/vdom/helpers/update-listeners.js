/* @flow */

import {
  warn,
  invokeWithErrorHandling
} from 'core/util/index'
import {
  cached,
  isUndef,
  isTrue,
  isPlainObject
} from 'shared/util'

const normalizeEvent = cached((name: string): {
  name: string,
  once: boolean,
  capture: boolean,
  passive: boolean,
  handler ? : Function,
  params ? : Array < any >
} => {
  const passive = name.charAt(0) === '&'
  name = passive ? name.slice(1) : name
  const once = name.charAt(0) === '~' // Prefixed last, checked first
  name = once ? name.slice(1) : name
  const capture = name.charAt(0) === '!'
  name = capture ? name.slice(1) : name
  return {
    name,
    once,
    capture,
    passive
  }
})

export function createFnInvoker(fns: Function | Array < Function > , vm: ? Component): Function {
  function invoker() {
    const fns = invoker.fns
    if (Array.isArray(fns)) {
      // 浅拷贝
      const cloned = fns.slice()
      for (let i = 0; i < cloned.length; i++) {
        // 执行事件
        invokeWithErrorHandling(cloned[i], null, arguments, vm, `v-on handler`)
      }
    } else {
      // return handler return value for single handlers
      return invokeWithErrorHandling(fns, null, arguments, vm, `v-on handler`)
    }
  }
  invoker.fns = fns
  return invoker
}

// 更新组件的事件队列
export function updateListeners(
  on: Object, // 新事件
  oldOn: Object, // 旧事件
  add: Function, // 组件添加事件函数
  remove: Function, // 组件删除事件函数
  createOnceHandler: Function, //once事件
  vm: Component // 组件实例
) {
  let name, def, cur: Function, old, event
  // 遍历listeners
  for (name in on) {
    def = cur = on[name]
    old = oldOn[name]
    // 过滤事件修饰符
    event = normalizeEvent(name)
    /* istanbul ignore if */
    // 针对weex移动端开发
    if (__WEEX__ && isPlainObject(def)) {
      cur = def.handler
      event.params = def.params
    }

    if (isUndef(cur)) {
      process.env.NODE_ENV !== 'production' && warn(
        `Invalid handler for event "${event.name}": got ` + String(cur),
        vm
      )
    }
    // 没有旧事件函数
    else if (isUndef(old)) {
      // 没有现有的事件
      if (isUndef(cur.fns)) {
        // 创建新的事件，这个函数中会将invoker构造函数的fns属性绑定当前cur函数，cur.fns
        cur = on[name] = createFnInvoker(cur, vm)
      }
      // 执行一次的函数
      if (isTrue(event.once)) {
        cur = on[name] = createOnceHandler(event.name, cur, event.capture)
      }
      // 添加新事件到事件队列中
      add(event.name, cur, event.capture, event.passive, event.params)
    } else if (cur !== old) {
      // 交换新、老事件
      old.fns = cur
      on[name] = old
    }
  }
  // 循环移除旧事件
  for (name in oldOn) {
    if (isUndef(on[name])) {
      event = normalizeEvent(name)
      remove(event.name, oldOn[name], event.capture)
    }
  }
}