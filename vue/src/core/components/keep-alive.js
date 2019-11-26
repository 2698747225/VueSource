/* @flow */

import {
  isRegExp,
  remove
} from 'shared/util'
import {
  getFirstComponentChild
} from 'core/vdom/helpers/index'

type VNodeCache = {
  [key: string]: ? VNode
};

function getComponentName(opts: ? VNodeComponentOptions): ? string {
  return opts && (opts.Ctor.options.name || opts.tag)
}

// pattern正是include或exclude类型
function matches(pattern: string | RegExp | Array < string > , name: string) : boolean {
  // 数组类型
  if (Array.isArray(pattern)) {
    return pattern.indexOf(name) > -1
  } else if (typeof pattern === 'string') {
    // 字符类型
    return pattern.split(',').indexOf(name) > -1
  } else if (isRegExp(pattern)) {
    // 正则
    return pattern.test(name)
  }
  /* istanbul ignore next */
  return false
}

function pruneCache(keepAliveInstance: any, filter: Function) {
  const {
    cache,
    keys,
    _vnode
  } = keepAliveInstance
  for (const key in cache) {
    const cachedNode: ? VNode = cache[key]
    if (cachedNode) {
      const name: ? string = getComponentName(cachedNode.componentOptions)
      if (name && !filter(name)) {
        pruneCacheEntry(cache, key, keys, _vnode)
      }
    }
  }
}

function pruneCacheEntry(
  cache: VNodeCache,
  key: string,
  keys: Array < string > ,
  current ? : VNode
) {
  // 缓存的vnode
  const cached = cache[key]
  // 当前活跃的vnode不为被缓存的vnode
  if (cached && (!current || cached.tag !== current.tag)) {
    // 缓存的vnode销毁
    cached.componentInstance.$destroy()
  }
  cache[key] = null
  // 数组中移除
  remove(keys, key)
}

const patternTypes: Array < Function > = [String, RegExp, Array]

// keep-alive内置组件
export default {
  name: 'keep-alive',
  // 抽象组件标志
  abstract: true,
  // keep-alive允许使用的props
  props: {
    include: patternTypes,
    exclude: patternTypes,
    max: [String, Number]
  },

  created() {
    // 缓存
    this.cache = Object.create(null)
    this.keys = []
  },

  destroyed() {
    for (const key in this.cache) {
      pruneCacheEntry(this.cache, key, this.keys)
    }
  },

  mounted() {
    // 动态include、exclude的监听
    this.$watch('include', val => {
      pruneCache(this, name => matches(val, name))
    })
    this.$watch('exclude', val => {
      pruneCache(this, name => !matches(val, name))
    })
  },
  // 模板渲染函数
  render() {
    // 插槽模板实体
    const slot = this.$slots.default
    // 获取插槽子组件
    const vnode: VNode = getFirstComponentChild(slot)
    const componentOptions: ? VNodeComponentOptions = vnode && vnode.componentOptions
    if (componentOptions) {
      // check pattern
      // 组件名
      const name: ? string = getComponentName(componentOptions)
      const {
        include,
        exclude
      } = this
      // include无匹配到或exclude匹配到的直接返回无缓存的vnode节点
      if (
        // not included
        (include && (!name || !matches(include, name))) ||
        // excluded
        (exclude && name && matches(exclude, name))
      ) {
        return vnode
      }
      // 获取缓存对象和key
      const {
        cache,
        keys
      } = this
      // 无vnode.key时取cid和tag的拼接
      const key: ? string = vnode.key == null
        // same constructor may get registered as different local components
        // so cid alone is not enough (#3269)
        ?
        componentOptions.Ctor.cid + (componentOptions.tag ? `::${componentOptions.tag}` : '') :
        vnode.key
      // 缓存catch中存在key，直接取出来
      if (cache[key]) {
        vnode.componentInstance = cache[key].componentInstance
        // make current key freshest
        // 命中缓存后，会先删除这个key，再插入队尾（这里有一个缓存优先级的问题）
        remove(keys, key)
        keys.push(key)
      } else {
        // catch对象中保存key,keys数组中保存
        cache[key] = vnode
        keys.push(key)
        // prune oldest entry
        // _vnode:当前活跃的组件
        // 删除最老条目（第一个），由于之前命中缓存就是按一个次数排序，因此队头自然就是命中次数最少的
        if (this.max && keys.length > parseInt(this.max)) {
          pruneCacheEntry(cache, keys[0], keys, this._vnode)
        }
      }
      // 已缓存的vnode打上标记
      vnode.data.keepAlive = true
    }
    return vnode || (slot && slot[0])
  }
}