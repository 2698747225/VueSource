/* @flow */

import {
  isDef
} from 'shared/util'
import {
  isAsyncPlaceholder
} from './is-async-placeholder'

// 返回子组件数组中第一个实例组件（拥有options）或异步组件
export function getFirstComponentChild(children: ? Array < VNode > ): ? VNode {
  if (Array.isArray(children)) {
    for (let i = 0; i < children.length; i++) {
      const c = children[i]
      if (isDef(c) && (isDef(c.componentOptions) || isAsyncPlaceholder(c))) {
        return c
      }
    }
  }
}