/* @flow */

import config from '../config'
import {
  initProxy
} from './proxy'
import {
  initState
} from './state'
import {
  initRender
} from './render'
import {
  initEvents
} from './events'
import {
  mark,
  measure
} from '../util/perf'
import {
  initLifecycle,
  callHook
} from './lifecycle'
import {
  initProvide,
  initInjections
} from './inject'
import {
  extend,
  mergeOptions,
  formatComponentName
} from '../util/index'

let uid = 0

export function initMixin(Vue: Class < Component > ) {

  Vue.prototype._init = function (options ? : Object) {
    const vm: Component = this
    // a uid
    vm._uid = uid++

    let startTag, endTag
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      startTag = `vue-perf-start:${vm._uid}`
      endTag = `vue-perf-end:${vm._uid}`
      mark(startTag)
    }

    // a flag to avoid this being observed
    vm._isVue = true
    // merge options
    // 选项合并
    if (options && options._isComponent) {
      // optimize internal component instantiation
      // since dynamic options merging is pretty slow, and none of the
      // internal component options needs special treatment.
      initInternalComponent(vm, options)
    } else {
      // 通过合并策略，合并了父与子对象的属性，最终挂载到$options上
      vm.$options = mergeOptions(
        resolveConstructorOptions(vm.constructor),
        options || {},
        vm
      )
    }
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      // 初始化代理
      initProxy(vm)
    } else {
      vm._renderProxy = vm
    }
    // expose real self
    vm._self = vm // 这个阶段实例只有$options和一些索引、代理之类的
    /**
     * 初始化生命周期，这个阶段会为组件实例绑定许多状态属性，例如_watcher、_isMounter、_isDestroyed，$root、$children、$parent,以及把组件添到组件树中
     */
    initLifecycle(vm)
    /** 
     * 初始化组件事件的过程，这个方法中会把父组件传递给当前vm组件的函数绑定的vm_events对象上，并且这个阶段会给组件绑定$emit、$on、$once、$off对于事件队列处理的方法
     */
    initEvents(vm)
    // render渲染
    initRender(vm) // 初始化渲染结束后就会有属性、slots、vnode等，并且拥有$createElement等vnode节点渲染方法
    callHook(vm, 'beforeCreate')
    // 在data/props前处理依赖注入
    initInjections(vm) // resolve injections before data/props
    /** 
     * 初始化data、props，observer观察者模式在这里实现，这里会遍历所有data属性，为data属性绑定get、set方法，之后对整个data对象进行observer观察每个属性、劫持getter、setter
     */
    initState(vm)
    initProvide(vm) // resolve provide after data/props
    // 调用created钩子函数
    callHook(vm, 'created')

    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      vm._name = formatComponentName(vm, false)
      mark(endTag)
      measure(`vue ${vm._name} init`, startTag, endTag)
    }

    // 如果有el元素，对实例进行挂载
    if (vm.$options.el) {
      vm.$mount(vm.$options.el)
    }
  }
}

export function initInternalComponent(vm: Component, options: InternalComponentOptions) {
  const opts = vm.$options = Object.create(vm.constructor.options)
  // doing this because it's faster than dynamic enumeration.
  const parentVnode = options._parentVnode
  opts.parent = options.parent
  opts._parentVnode = parentVnode

  const vnodeComponentOptions = parentVnode.componentOptions
  opts.propsData = vnodeComponentOptions.propsData
  opts._parentListeners = vnodeComponentOptions.listeners
  opts._renderChildren = vnodeComponentOptions.children
  opts._componentTag = vnodeComponentOptions.tag

  if (options.render) {
    opts.render = options.render
    opts.staticRenderFns = options.staticRenderFns
  }
}

export function resolveConstructorOptions(Ctor: Class < Component > ) {
  let options = Ctor.options
  if (Ctor.super) {
    const superOptions = resolveConstructorOptions(Ctor.super)
    const cachedSuperOptions = Ctor.superOptions
    if (superOptions !== cachedSuperOptions) {
      // super option changed,
      // need to resolve new options.
      Ctor.superOptions = superOptions
      // check if there are any late-modified/attached options (#4976)
      const modifiedOptions = resolveModifiedOptions(Ctor)
      // update base extend options
      if (modifiedOptions) {
        extend(Ctor.extendOptions, modifiedOptions)
      }
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)
      if (options.name) {
        options.components[options.name] = Ctor
      }
    }
  }
  return options
}

function resolveModifiedOptions(Ctor: Class < Component > ): ? Object {
  let modified
  const latest = Ctor.options
  const sealed = Ctor.sealedOptions
  for (const key in latest) {
    if (latest[key] !== sealed[key]) {
      if (!modified) modified = {}
      modified[key] = latest[key]
    }
  }
  return modified
}