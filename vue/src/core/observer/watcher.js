/* @flow */

import {
  warn,
  remove,
  isObject,
  parsePath,
  _Set as Set,
  handleError,
  noop
} from '../util/index'

import {
  traverse
} from './traverse'
import {
  queueWatcher
} from './scheduler'
import Dep, {
  pushTarget,
  popTarget
} from './dep'

import type {
  SimpleSet
} from '../util/index'

let uid = 0

/**
 * A watcher parses an expression, collects dependencies,
 * and fires callback when the expression value changes.
 * This is used for both the $watch() api and directives.
 */
export default class Watcher {
  // 组件实例
  vm: Component;
  // watcher的表达式，watch的key
  expression: string;
  // callback 回调
  cb: Function;
  // 主键
  id: number;
  // 下面的都是watch暴露的api
  deep: boolean;
  user: boolean;
  lazy: boolean;
  sync: boolean;
  dirty: boolean;
  active: boolean;

  // 当前watcher所在的deps集合
  deps: Array < Dep > ;
  newDeps: Array < Dep > ;
  depIds: SimpleSet;
  newDepIds: SimpleSet;
  before: ? Function;
  getter: Function;
  value: any;

  constructor(
    vm: Component,
    expOrFn: string | Function,
    cb: Function,
    options ? : ? Object,
    isRenderWatcher ? : boolean
  ) {
    this.vm = vm
    // 自身的watcher实例
    if (isRenderWatcher) {
      vm._watcher = this
    }
    vm._watchers.push(this)
    // options
    if (options) {
      this.deep = !!options.deep
      this.user = !!options.user
      this.lazy = !!options.lazy
      this.sync = !!options.sync
      this.before = options.before
    } else {
      this.deep = this.user = this.lazy = this.sync = false
    }
    this.cb = cb
    // 表示每个watcher的索引
    this.id = ++uid // uid for batching
    this.active = true
    this.dirty = this.lazy // for lazy watchers
    this.deps = []
    this.newDeps = []
    this.depIds = new Set()
    this.newDepIds = new Set()
    this.expression = process.env.NODE_ENV !== 'production' ?
      expOrFn.toString() :
      ''
    // parse expression for getter
    // 这里的getter一定为返回监听表达式或者属性的值的函数
    if (typeof expOrFn === 'function') {
      this.getter = expOrFn
    } else {
      this.getter = parsePath(expOrFn)
      // 表达式类型若没有解析出结果，getter会被空函数替换
      if (!this.getter) {
        this.getter = noop
        process.env.NODE_ENV !== 'production' && warn(
          `Failed watching path: "${expOrFn}" ` +
          'Watcher only accepts simple dot-delimited paths. ' +
          'For full control, use a function instead.',
          vm
        )
      }
    }
    // 如果不是lazy加载，直接执行get方法（这里get方法是Dep类收集watcher的地方）
    this.value = this.lazy ?
      undefined :
      // 这里的get方法会收集依赖
      this.get()
  }

  /**
   * Evaluate the getter, and re-collect dependencies.
   */
  get() {
    // Dep收集watcher
    pushTarget(this)
    let value
    const vm = this.vm
    try {
      // 这里同时会触发监听属性的get函数，哪些dep需要收集就会收集这个watcher
      value = this.getter.call(vm, vm)
    } catch (e) {
      if (this.user) {
        handleError(e, vm, `getter for watcher "${this.expression}"`)
      } else {
        throw e
      }
    } finally {
      // "touch" every property so they are all tracked as
      // dependencies for deep watching
      // 如果是需要深度监听，会递归获取这个属性下面的对象或者数组的所有值，并保存在一个set集合里
      if (this.deep) {
        traverse(value)
      }
      // 取消收集
      popTarget()
      this.cleanupDeps()
    }
    return value
  }

  /**
   * Add a dependency to this directive.
   */
  addDep(dep: Dep) {
    const id = dep.id
    // 自身的watcher对象上添加depIds
    /**
     * 在每次watcher初始化后都会触发它需要监听的函数，函数执行一般会访问到被观察的属性，触发属性的get方法，这时属性的私有dep以及对象的实例dep都会调用到这个方法，
     * 并且被监听的函数内若包含多个属性，则每个属性都会添加这个watcher，这里newDepIds是用来做重复过滤
     */
    if (!this.newDepIds.has(id)) {
      this.newDepIds.add(id)
      this.newDeps.push(dep)
      if (!this.depIds.has(id)) {
        // 这个属性的observer上的dep添加watcher
        dep.addSub(this)
      }
    }
  }

  /**
   * Clean up for dependency collection.
   */
  // 这里是在watcher构造函数内，
  cleanupDeps() {
    // 遍历watcher实例的deps
    let i = this.deps.length
    while (i--) {
      const dep = this.deps[i]
      if (!this.newDepIds.has(dep.id)) {
        dep.removeSub(this)
      }
    }
    // 清空newDeps，保存进watcher的deps中
    let tmp = this.depIds
    this.depIds = this.newDepIds
    this.newDepIds = tmp
    this.newDepIds.clear()
    tmp = this.deps
    this.deps = this.newDeps
    this.newDeps = tmp
    this.newDeps.length = 0
  }

  /**
   * Subscriber interface.
   * Will be called when a dependency changes.
   */
  update() {
    /* istanbul ignore else */
    if (this.lazy) {
      this.dirty = true
    } else if (this.sync) {
      this.run()
    } else {
      // 后面再看这个方法
      queueWatcher(this)
    }
  }

  /**
   * Scheduler job interface.
   * Will be called by the scheduler.
   */
  run() {
    if (this.active) {
      // 当前watcher相关的dep重新收集、并重新更新当前watcher下的deps，这个value是监听函数执行的结果
      const value = this.get()
      if (
        // 这里对可能的变化影响又做了过滤。对象变化、或者深度监听这个value的值变化应该很难监听到，因此以上两种类型会一直触发值的更新以及回调函数的执行
        value !== this.value ||
        // Deep watchers and watchers on Object/Arrays should fire even
        // when the value is the same, because the value may
        // have mutated.
        isObject(value) ||
        this.deep
      ) {
        // set new value
        // 重新给watcher的value赋值
        const oldValue = this.value
        this.value = value
        if (this.user) {
          try {
            this.cb.call(this.vm, value, oldValue)
          } catch (e) {
            handleError(e, this.vm, `callback for watcher "${this.expression}"`)
          }
        } else {
          // 返回的回调函数，包含newVal和oldVal
          this.cb.call(this.vm, value, oldValue)
        }
      }
    }
  }

  /**
   * Evaluate the value of the watcher.
   * This only gets called for lazy watchers.
   */
  evaluate() {
    this.value = this.get()
    this.dirty = false
  }

  /**
   * Depend on all deps collected by this watcher.
   */
  // 这个watcher的dep依赖收集集合中添加当前watcher
  depend() {
    let i = this.deps.length
    while (i--) {
      this.deps[i].depend()
    }
  }

  /**
   * Remove self from all dependencies' subscriber list.
   */
  // 所有的依赖dep都释放当前watcher，在组件destroy时以及watch函数的返回的unwatch函数执行时触发
  teardown() {
    if (this.active) {
      // remove self from vm's watcher list
      // this is a somewhat expensive operation so we skip it
      // if the vm is being destroyed.
      if (!this.vm._isBeingDestroyed) {
        // 组件的watchers队列中移除当前watcher
        remove(this.vm._watchers, this)
      }
      let i = this.deps.length
      while (i--) {
        // watcher的deps中移除当前watcher，意思是和这个watch相关联的所有dep都释放它
        this.deps[i].removeSub(this)
      }
      this.active = false
    }
  }
}