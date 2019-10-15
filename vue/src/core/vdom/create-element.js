/* @flow */

import config from '../config'
import VNode, {
  createEmptyVNode
} from './vnode'
import {
  createComponent
} from './create-component'
import {
  traverse
} from '../observer/traverse'

import {
  warn,
  isDef,
  isUndef,
  isTrue,
  isObject,
  isPrimitive,
  resolveAsset
} from '../util/index'

import {
  normalizeChildren,
  simpleNormalizeChildren
} from './helpers/index'

const SIMPLE_NORMALIZE = 1
const ALWAYS_NORMALIZE = 2

// wrapper function for providing a more flexible interface
// without getting yelled at by flow
// 生成虚拟节点函数，为了_createElement外层包了验证
export function createElement(
  context: Component,
  tag: any,
  data: any,
  children: any,
  normalizationType: any,
  alwaysNormalize: boolean
): VNode | Array < VNode > {
  // 第三个参数为数组时，第四个参数作为第三个参数，这就是为什么createElement第二个参数在不为options时，为数组或基础类型时会作为子节点的原因
  if (Array.isArray(data) || isPrimitive(data)) {
    normalizationType = children
    children = data
    data = undefined
  }
  if (isTrue(alwaysNormalize)) {
    normalizationType = ALWAYS_NORMALIZE
  }
  // context为实例，tag为节点，data为标签数据，包括属性，children为子节点
  return _createElement(context, tag, data, children, normalizationType)
}
// 生成虚拟节点私有函数
export function _createElement(
  context: Component,
  tag ? : string | Class < Component > | Function | Object,
  data ? : VNodeData,
  children ? : any,
  normalizationType ? : number
): VNode | Array < VNode > {
  // 这里会排除data.__ob__属性，因为属性被observer后，数据变化会触发视图渲染。
  if (isDef(data) && isDef((data: any).__ob__)) {
    process.env.NODE_ENV !== 'production' && warn(
      `Avoid using observed data object as vnode data: ${JSON.stringify(data)}\n` +
      'Always create fresh vnode data objects in each render!',
      context
    )
    return createEmptyVNode()
  }
  // object syntax in v-bind
  // 只有在作为标签component属性时会使用到v-bind:is
  if (isDef(data) && isDef(data.is)) {
    tag = data.is
  }
  // 不存在tag则创建空vnode，否则tag应该为一个组件vnode
  if (!tag) {
    // in case of component :is set to falsy value
    return createEmptyVNode()
  }
  // warn against non-primitive key
  if (process.env.NODE_ENV !== 'production' &&
    isDef(data) && isDef(data.key) && !isPrimitive(data.key)
  ) {
    if (!__WEEX__ || !('@binding' in data.key)) {
      warn(
        'Avoid using non-primitive value as key, ' +
        'use string/number value instead.',
        context
      )
    }
  }
  // support single function children as default scoped slot
  if (Array.isArray(children) &&
    typeof children[0] === 'function'
  ) {
    data = data || {}
    // 绑定插槽
    data.scopedSlots = {
      default: children[0]
    }
    children.length = 0
  }
  if (normalizationType === ALWAYS_NORMALIZE) {
    //创建一个规范的子节点
    children = normalizeChildren(children)
  } else if (normalizationType === SIMPLE_NORMALIZE) {
    //把所有子节点的数组 子孙连接在一个数组。
    children = simpleNormalizeChildren(children)
  }
  let vnode, ns
  // 如果tag是字符类型
  if (typeof tag === 'string') {
    let Ctor
    // 获取标签命名空间
    ns = (context.$vnode && context.$vnode.ns) || config.getTagNamespace(tag)
    // 若是html标签
    if (config.isReservedTag(tag)) {
      // platform built-in elements
      // 创建一个基础的Vnode节点
      vnode = new VNode(
        config.parsePlatformTagName(tag), data, children,
        undefined, undefined, context
      )
    }
    // 如果不是原生html标签，会从实例的$options的components中查找是否有定义过这个组件标签名（局部注册）
    else if ((!data || !data.pre) && isDef(Ctor = resolveAsset(context.$options, 'components', tag))) {
      // component
      // 从组件库中获取该标签组件，生成组件类型Vnode
      vnode = createComponent(Ctor, data, context, children, tag)
    } else {
      // unknown or unlisted namespaced elements
      // check at runtime because it may get assigned a namespace when its
      // parent normalizes children
      // 其他类型，创建一个基本的vnode，兜底方法
      vnode = new VNode(
        tag, data, children,
        undefined, undefined, context
      )
    }
  } else {
    // tag为组件类型或者对象或者构造直接创建（全局注册）
    // direct component options / constructor
    vnode = createComponent(tag, data, context, children)
  }
  if (Array.isArray(vnode)) {
    return vnode
  } else if (isDef(vnode)) {
    if (isDef(ns)) applyNS(vnode, ns)
    if (isDef(data)) registerDeepBindings(data)
    return vnode
  } else {
    return createEmptyVNode()
  }
}

function applyNS(vnode, ns, force) {
  vnode.ns = ns
  if (vnode.tag === 'foreignObject') {
    // use default namespace inside foreignObject
    ns = undefined
    force = true
  }
  if (isDef(vnode.children)) {
    for (let i = 0, l = vnode.children.length; i < l; i++) {
      const child = vnode.children[i]
      if (isDef(child.tag) && (
          isUndef(child.ns) || (isTrue(force) && child.tag !== 'svg'))) {
        applyNS(child, ns, force)
      }
    }
  }
}

// ref #5318
// necessary to ensure parent re-render when deep bindings like :style and
// :class are used on slot nodes
function registerDeepBindings(data) {
  if (isObject(data.style)) {
    traverse(data.style)
  }
  if (isObject(data.class)) {
    traverse(data.class)
  }
}