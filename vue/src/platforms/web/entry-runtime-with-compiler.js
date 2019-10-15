/* @flow */

import config from 'core/config'
import {
  warn,
  cached
} from 'core/util/index'
import {
  mark,
  measure
} from 'core/util/perf'

import Vue from './runtime/index'
import {
  query
} from './util/index'
import {
  compileToFunctions
} from './compiler/index'
import {
  shouldDecodeNewlines,
  shouldDecodeNewlinesForHref
} from './util/compat'

const idToTemplate = cached(id => {
  const el = query(id)
  return el && el.innerHTML
})
// 这里会先保留原先的$mount函数
const mount = Vue.prototype.$mount
// 重新定义$mount,为包含编译器和不包含编译器的版本提供不同封装，最终调用的是缓存原型上的$mount方法
Vue.prototype.$mount = function (
  el ? : string | Element, // 被挂载的元素
  hydrating ? : boolean // ssr渲染相关
): Component {
  el = el && query(el)

  /* istanbul ignore if */
  if (el === document.body || el === document.documentElement) {
    process.env.NODE_ENV !== 'production' && warn(
      `Do not mount Vue to <html> or <body> - mount to normal elements instead.`
    )
    return this
  }
  // 实例的配置项
  const options = this.$options
  // resolve template/el and convert to render function
  // 不是通过render渲染函数生成的实例的模板，初始化根节点（new Vue后会挂载el，这个阶段是存在render函数的）
  if (!options.render) {
    let template = options.template
    if (template) {
      // 模板是字符串类型
      if (typeof template === 'string') {
        // 带有#的使用的是x-template的innerHtml模板
        if (template.charAt(0) === '#') {
          //获取字符串模板的innerHtml
          template = idToTemplate(template)
          /* istanbul ignore if */
          if (process.env.NODE_ENV !== 'production' && !template) {
            warn(
              `Template element not found or is empty: ${options.template}`,
              this
            )
          }
        }
      }
      // dom节点直接获取html元素的内容
      else if (template.nodeType) {
        template = template.innerHTML
      } else {
        if (process.env.NODE_ENV !== 'production') {
          warn('invalid template option:' + template, this)
        }
        return this
      }
    } else if (el) {
      // 如果没有传入template模板，则默认以el元素所属的根节点作为基础模板
      template = getOuterHTML(el)
    }
    if (template) {
      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        mark('compile')
      }

      // 创建模板，这里就是非render函数走的方法，包含compile器的编译模式，最后会给options上绑定一个render函数
      const {
        render,
        staticRenderFns
      } = compileToFunctions(template, {
        outputSourceRange: process.env.NODE_ENV !== 'production',
        shouldDecodeNewlines,
        shouldDecodeNewlinesForHref,
        delimiters: options.delimiters, // 格式化方法
        comments: options.comments // 注释是否编译进AST树
      }, this)
      options.render = render
      options.staticRenderFns = staticRenderFns

      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        mark('compile end')
        measure(`vue ${this._name} compile`, 'compile', 'compile end')
      }
    }
  }
  // 调用之前原型上的$mount函数（真正的挂载）
  return mount.call(this, el, hydrating)
}

/**
 * Get outerHTML of elements, taking care
 * of SVG elements in IE as well.
 */
function getOuterHTML(el: Element): string {
  if (el.outerHTML) {
    return el.outerHTML
  } else {
    const container = document.createElement('div')
    container.appendChild(el.cloneNode(true))
    return container.innerHTML
  }
}

// vue暴露出去的compile方法实际上是compileToFunctions
Vue.compile = compileToFunctions

export default Vue