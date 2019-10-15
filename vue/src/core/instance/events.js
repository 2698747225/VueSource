/* @flow */

import {
  tip,
  toArray,
  hyphenate,
  formatComponentName,
  invokeWithErrorHandling
} from '../util/index'
import {
  updateListeners
} from '../vdom/helpers/index'

// 事件初始化
export function initEvents(vm: Component) {
  // 创建一个空对象
  vm._events = Object.create(null)
  // 含有钩子事件标志
  vm._hasHookEvent = false
  // init parent attached events，父模板传递的事件
  const listeners = vm.$options._parentListeners
  if (listeners) {
    updateComponentListeners(vm, listeners)
  }
}

let target: any

// 组件添加事件
function add(event, fn) {
  target.$on(event, fn)
}

// 组件删除事件
function remove(event, fn) {
  target.$off(event, fn)
}

function createOnceHandler(event, fn) {
  const _target = target
  return function onceHandler() {
    // 执行函数
    const res = fn.apply(null, arguments)
    if (res !== null) {
      // 注销函数
      _target.$off(event, onceHandler)
    }
  }
}

export function updateComponentListeners(
  vm: Component,
  listeners: Object,
  oldListeners: ? Object
) {
  target = vm
  // 更新新旧事件
  updateListeners(listeners, oldListeners || {}, add, remove, createOnceHandler, vm)
  target = undefined
}

export function eventsMixin(Vue: Class < Component > ) {
  const hookRE = /^hook:/
  /**
   * @desc 事件绑定
   * @param event 事件名
   * @param fn 回调函数
   */

  Vue.prototype.$on = function (event: string | Array < string > , fn: Function): Component {
    const vm: Component = this
    // 遍历事件，数组类型则递归每个数组值，绑定事件
    if (Array.isArray(event)) {
      for (let i = 0, l = event.length; i < l; i++) {
        vm.$on(event[i], fn)
      }
    } else {
      // key为事件名，value为函数，保存在_evnets对象中
      (vm._events[event] || (vm._events[event] = [])).push(fn)
      // optimize hook:event cost by using a boolean flag marked at registration
      // instead of a hash lookup
      // hook:开头的为vue内置的钩子函数
      if (hookRE.test(event)) {
        // 添加标记
        vm._hasHookEvent = true
      }
    }
    return vm
  }
  // 添加只执行一次的函数，方法是在函数外层包装一层，在执行完函数后解绑函数
  Vue.prototype.$once = function (event: string, fn: Function): Component {
    const vm: Component = this

    function on() {
      // 解绑事件
      vm.$off(event, on)
      // 执行事件
      fn.apply(vm, arguments)
    }
    on.fn = fn
    // 添加事件
    vm.$on(event, on)
    return vm
  }

  /**
   * @desc 解绑事件 
   * @param event 事件名
   * @param fn 回调函数
   */
  // 这里解绑的是当前事件名对应的回调某个回调函数，当无回调函数时才会把vm._events中指定event置空
  Vue.prototype.$off = function (event ? : string | Array < string > , fn ? : Function): Component {
    const vm: Component = this
    // all 无参数则解绑全部事件
    if (!arguments.length) {
      // 组件上添加_events对象，用来存放所有事件
      vm._events = Object.create(null)
      return vm
    }
    // array of events
    if (Array.isArray(event)) {
      // 递归解绑
      for (let i = 0, l = event.length; i < l; i++) {
        vm.$off(event[i], fn)
      }
      return vm
    }

    // specific event
    const cbs = vm._events[event]
    if (!cbs) {
      return vm
    }
    // 无回调，清空当前事件的回调
    if (!fn) {
      vm._events[event] = null
      return vm
    }
    // specific handler
    let cb
    // 一个事件名对应多个回调
    let i = cbs.length
    while (i--) {
      cb = cbs[i]
      // 释放回调函数
      if (cb === fn || cb.fn === fn) {
        cbs.splice(i, 1)
        break
      }
    }
    return vm
  }

  // 事件广播
  Vue.prototype.$emit = function (event: string): Component {
    const vm: Component = this
    //
    if (process.env.NODE_ENV !== 'production') {
      const lowerCaseEvent = event.toLowerCase()
      if (lowerCaseEvent !== event && vm._events[lowerCaseEvent]) {
        tip(
          `Event "${lowerCaseEvent}" is emitted in component ` +
          `${formatComponentName(vm)} but the handler is registered for "${event}". ` +
          `Note that HTML attributes are case-insensitive and you cannot use ` +
          `v-on to listen to camelCase events when using in-DOM templates. ` +
          `You should probably use "${hyphenate(event)}" instead of "${event}".`
        )
      }
    }
    // 回调函数组
    let cbs = vm._events[event]
    if (cbs) {
      // 转换cbs类数组对象为纯数组
      cbs = cbs.length > 1 ? toArray(cbs) : cbs
      // 转换arguments为array
      const args = toArray(arguments, 1)
      const info = `event handler for "${event}"`
      for (let i = 0, l = cbs.length; i < l; i++) {
        invokeWithErrorHandling(cbs[i], vm, args, vm, info)
      }
    }
    return vm
  }
}