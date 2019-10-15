import {
  initMixin
} from './init'
import {
  stateMixin
} from './state'
import {
  renderMixin
} from './render'
import {
  eventsMixin
} from './events'
import {
  lifecycleMixin
} from './lifecycle'
import {
  warn
} from '../util/index'

// Vue实例化的函数
function Vue(options) {
  if (process.env.NODE_ENV !== 'production' &&
    !(this instanceof Vue)
  ) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  this._init(options)
}

// _init初始化事件绑定prototype
initMixin(Vue)
// 绑定del、set、$watch
stateMixin(Vue)
// 事件的初始化 $on、$once、$off、$emit
eventsMixin(Vue)
// 生命周期初始化，生成dom树 _update、$forceUpdate、$destroy
lifecycleMixin(Vue)
// 生成Vnode树，$nextTick、_render
renderMixin(Vue)

export default Vue